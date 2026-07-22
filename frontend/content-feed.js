(() => {
  'use strict';

  const CACHE_KEY = 'yomeru_content_feed_cache_v1';
  const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 7000;
  const state = {
    items: [],
    source: 'idle',
    updatedAt: null,
    loading: null
  };

  const categoryLabels = Object.freeze({
    admissions: '考学',
    exam: '考试',
    visa: '签证',
    life: '生活',
    career: '就职',
    major_japan_update: '日本动态'
  });

  function configValue(name, fallback = '') {
    return String(window.NIHONGO_CONFIG?.[name] || fallback).trim();
  }

  function remoteFeedEnabled() {
    return window.NIHONGO_CONFIG?.CONTENT_FEED_REMOTE_ENABLED === true;
  }

  function feedBaseUrl() {
    return configValue('CONTENT_FEED_BASE_URL').replace(/\/+$/, '');
  }

  function fallbackUrl() {
    return configValue('CONTENT_FEED_FALLBACK_URL', 'data/content-feed-fallback.json');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function validHttpUrl(value) {
    try {
      const url = new URL(String(value || '').trim(), window.location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function primarySource(item) {
    const sources = Array.isArray(item?.sources) ? item.sources : [];
    return sources.find(source => source?.isPrimary && validHttpUrl(source?.url))
      || sources.find(source => validHttpUrl(source?.url))
      || null;
  }

  function isExpired(item) {
    const expiresAt = item?.dates?.expiresAt;
    return Boolean(expiresAt && !Number.isNaN(Date.parse(expiresAt)) && Date.parse(expiresAt) <= Date.now());
  }

  function normalizeItem(item) {
    if (!item || item.schemaVersion !== 1 || item.status !== 'published' || isExpired(item)) return null;
    const id = String(item.id || '').trim();
    const slug = String(item.slug || '').trim();
    const titleZh = String(item.titleZh || '').trim();
    const titleJa = String(item.learning?.titleJa || item.titleJa || '').trim();
    const textJa = String(item.learning?.textJa || '').trim();
    const recommendedLevelValue = String(item.learning?.recommendedLevel || '').trim();
    const recommendedLevel = /^N[1-5]$/.test(recommendedLevelValue) ? recommendedLevelValue : 'N3';
    const estimatedMinutesValue = Number(item.learning?.estimatedMinutes);
    const estimatedMinutes = Number.isFinite(estimatedMinutesValue)
      ? Math.min(60, Math.max(1, Math.round(estimatedMinutesValue)))
      : 4;
    const source = primarySource(item);
    if (!id || !slug || !titleZh || !titleJa || !textJa || !source) return null;
    return {
      schemaVersion: 1,
      id,
      slug,
      contentType: String(item.contentType || 'news'),
      category: String(item.category || 'major_japan_update'),
      riskLevel: String(item.riskLevel || 'low'),
      titleZh,
      titleJa,
      oneLineConclusionZh: String(item.oneLineConclusionZh || item.summaryZh || '').trim(),
      summaryZh: String(item.summaryZh || '').trim(),
      impactZh: String(item.impactZh || '').trim(),
      dates: {
        sourcePublishedAt: item.dates?.sourcePublishedAt || null,
        effectiveAt: item.dates?.effectiveAt || null,
        expiresAt: item.dates?.expiresAt || null,
        lastVerifiedAt: item.dates?.lastVerifiedAt || null
      },
      learning: {
        titleJa,
        textJa,
        recommendedLevel,
        estimatedMinutes
      },
      sourceUrl: validHttpUrl(source.url),
      sourceOrganization: String(source.organization || '').trim(),
      sourceTitle: String(source.title || '').trim()
    };
  }

  function normalizePayload(payload) {
    if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.items)) {
      throw new Error('内容数据格式不兼容');
    }
    return payload.items.map(normalizeItem).filter(Boolean);
  }

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || !Array.isArray(cached.items)) return null;
      const items = cached.items.map(normalizeItem).filter(Boolean);
      if (!items.length) return null;
      return {
        items,
        updatedAt: String(cached.updatedAt || ''),
        fresh: Date.now() - Date.parse(cached.updatedAt || 0) < CACHE_MAX_AGE_MS
      };
    } catch {
      return null;
    }
  }

  function writeCache(items) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        items
      }));
    } catch {}
  }

  async function fetchJson(url, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadRemoteItems() {
    if (!remoteFeedEnabled()) throw new Error('远程内容源尚未启用');
    const base = feedBaseUrl();
    if (!base) throw new Error('未配置远程内容地址');
    const payload = await fetchJson(`${base}/content-items?target=yomeru&limit=20`);
    const items = normalizePayload(payload);
    if (!items.length) throw new Error('远程内容为空');
    writeCache(items);
    return items;
  }

  async function loadFallbackItems() {
    const payload = await fetchJson(fallbackUrl(), 4500);
    const items = normalizePayload(payload);
    if (!items.length) throw new Error('本地内容为空');
    return items;
  }

  function dateLabel(item) {
    const value = item.dates.sourcePublishedAt || item.dates.effectiveAt || item.dates.lastVerifiedAt;
    if (!value || Number.isNaN(Date.parse(value))) return '已核验';
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
  }

  function statusCopy() {
    if (state.source === 'remote') return '已连接官方内容源';
    if (state.source === 'cache') return '当前显示最近一次已保存内容';
    if (state.source === 'fallback') return '当前显示内置官方内容快照';
    if (state.source === 'error') return '资讯暂时无法更新，现有阅读功能不受影响';
    return '正在更新资讯…';
  }

  function render() {
    const section = document.getElementById('contentFeedSection');
    const grid = document.getElementById('contentFeedGrid');
    const status = document.getElementById('contentFeedStatus');
    const count = document.getElementById('contentFeedCount');
    if (!section || !grid || !status || !count) return;

    section.dataset.feedSource = state.source;
    status.textContent = statusCopy();
    status.className = `content-feed-status is-${state.source}`;
    count.textContent = `${state.items.length} 篇`;

    if (!state.items.length) {
      grid.innerHTML = '<div class="source-empty-state">暂时没有可用资讯。仍可继续使用自己的日语文本。</div>';
      return;
    }

    grid.innerHTML = state.items.map(item => `
      <article class="content-feed-card" data-content-id="${escapeHtml(item.id)}">
        <div class="content-feed-rail" aria-hidden="true"><span>情报</span><i></i><span>阅读</span></div>
        <div class="content-feed-card-body">
          <div class="content-feed-meta">
            <span class="content-feed-category">${escapeHtml(categoryLabels[item.category] || '日本动态')}</span>
            <span class="material-level level-${escapeHtml(item.learning.recommendedLevel.toLowerCase())}">${escapeHtml(item.learning.recommendedLevel)}</span>
            <span>${escapeHtml(item.learning.estimatedMinutes)} 分钟</span>
            <time>${escapeHtml(dateLabel(item))}</time>
          </div>
          <h3>${escapeHtml(item.titleZh)}</h3>
          <p class="content-feed-ja-title" lang="ja">${escapeHtml(item.titleJa)}</p>
          <p class="content-feed-conclusion">${escapeHtml(item.oneLineConclusionZh)}</p>
          <div class="content-feed-actions">
            <button class="btn-primary" type="button" data-content-action="learn" data-content-id="${escapeHtml(item.id)}">学习这篇</button>
            <a class="btn-ghost" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">官方来源</a>
          </div>
        </div>
      </article>
    `).join('');
  }

  async function refreshContentFeed(options = {}) {
    if (state.loading && !options.force) return state.loading;
    state.source = 'loading';
    render();
    state.loading = (async () => {
      try {
        state.items = await loadRemoteItems();
        state.source = 'remote';
        state.updatedAt = new Date().toISOString();
      } catch (remoteError) {
        const cached = remoteFeedEnabled() ? readCache() : null;
        if (cached?.fresh && cached.items.length) {
          state.items = cached.items;
          state.source = 'cache';
          state.updatedAt = cached.updatedAt;
        } else {
          try {
            state.items = await loadFallbackItems();
            state.source = 'fallback';
            state.updatedAt = new Date().toISOString();
          } catch (fallbackError) {
            console.warn('内容资讯加载失败', remoteError, fallbackError);
            state.items = [];
            state.source = 'error';
          }
        }
      } finally {
        state.loading = null;
        render();
      }
      return state.items;
    })();
    return state.loading;
  }

  function getContentFeedItem(id) {
    return state.items.find(item => item.id === String(id || '')) || null;
  }

  async function startContentFeedItem(id) {
    let item = getContentFeedItem(id);
    if (!item) {
      await refreshContentFeed();
      item = getContentFeedItem(id);
    }
    if (!item) return false;
    if (typeof window.startContentFeedLearning !== 'function') return false;
    return Boolean(await window.startContentFeedLearning(item));
  }

  async function openContentFeedQueueItem(queueItem) {
    return startContentFeedItem(queueItem?.contentItemId);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-content-action="learn"]');
    if (!button) return;
    startContentFeedItem(button.dataset.contentId);
  });

  document.addEventListener('DOMContentLoaded', () => {
    refreshContentFeed();
  });

  window.refreshContentFeed = refreshContentFeed;
  window.getContentFeedItem = getContentFeedItem;
  window.startContentFeedItem = startContentFeedItem;
  window.openContentFeedQueueItem = openContentFeedQueueItem;
})();
