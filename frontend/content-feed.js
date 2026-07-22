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

  // Runtime-safe official snapshot. This guarantees content even when a static JSON fetch is blocked.
  const BUNDLED_FALLBACK_PAYLOAD = {
    "schemaVersion": 1,
    "generatedAt": "2026-07-22T00:00:00+09:00",
    "items": [
      {
        "schemaVersion": 1,
        "id": "content-202607-eju-round2-application",
        "slug": "eju-2026-round2-application-open",
        "contentType": "alert",
        "category": "exam",
        "status": "published",
        "riskLevel": "high",
        "titleJa": "2026年度日本留学試験（第2回）の出願受付が始まりました",
        "titleZh": "2026 年度第二次 EJU 已开放报名",
        "oneLineConclusionZh": "日本国内考生需在 2026 年 7 月 30 日 17:00（日本时间）前完成第二次 EJU 网上报名。",
        "summaryZh": "JASSO 已开放 2026 年度第二次日本留学考试的日本国内报名。",
        "impactZh": "计划使用 EJU 成绩申请日本大学的人，应先确认目标学校要求的科目和年度。",
        "dates": {
          "sourcePublishedAt": "2026-07-06T00:00:00+09:00",
          "effectiveAt": "2026-07-06T00:00:00+09:00",
          "expiresAt": "2026-07-30T17:00:00+09:00",
          "lastVerifiedAt": "2026-07-22T00:00:00+09:00"
        },
        "learning": {
          "titleJa": "EJU第2回の出願期限を確認しよう",
          "textJa": "日本学生支援機構は、2026年度日本留学試験の第2回試験について、出願の受け付けを始めました。日本国内で受験する人の出願期間は、7月6日から7月30日の午後5時までです。受験を考えている人は、志望校が必要とする科目を確認してから、EJUオンラインで手続きを進めましょう。",
          "recommendedLevel": "N3",
          "estimatedMinutes": 4
        },
        "sources": [
          {
            "organization": "日本学生支援機構（JASSO）",
            "title": "2026年度日本留学試験（第2回）出願受付を開始しました",
            "url": "https://www.jasso.go.jp/ryugaku/eju/news/1216740_2562.html",
            "sourceType": "official",
            "isPrimary": true,
            "verifiedAt": "2026-07-22T00:00:00+09:00"
          }
        ],
        "publicationTargets": [
          "yomeru"
        ]
      },
      {
        "schemaVersion": 1,
        "id": "content-202607-jlpt-second-test-date",
        "slug": "jlpt-2026-second-test-date",
        "contentType": "guide",
        "category": "exam",
        "status": "published",
        "riskLevel": "medium",
        "titleJa": "2026年の第2回日本語能力試験は12月6日に実施されます",
        "titleZh": "2026 年第二次 JLPT 将于 12 月 6 日举行",
        "oneLineConclusionZh": "具体报名期间因日本国内与海外考点而异，应查看当地实施机构的通知。",
        "summaryZh": "JLPT 官方公布，2026 年第二次考试定于 12 月 6 日。",
        "impactZh": "准备把 JLPT 成绩用于升学、求职或能力证明的人，应根据所在地确认报名安排。",
        "dates": {
          "sourcePublishedAt": null,
          "effectiveAt": "2026-12-06T00:00:00+09:00",
          "expiresAt": "2026-12-07T00:00:00+09:00",
          "lastVerifiedAt": "2026-07-22T00:00:00+09:00"
        },
        "learning": {
          "titleJa": "JLPTの試験日と申込期間は同じではありません",
          "textJa": "2026年の第2回日本語能力試験は、12月6日の日曜日に行われます。ただし、申込期間は国や地域によって異なります。海外では、7月か12月のどちらか一方だけ試験を行う都市もあります。受験したい人は、地域の実施機関から出る案内を確認しましょう。",
          "recommendedLevel": "N4",
          "estimatedMinutes": 3
        },
        "sources": [
          {
            "organization": "日本語能力試験",
            "title": "日本語能力試験の実施日",
            "url": "https://www.jlpt.jp/guideline/results.html",
            "sourceType": "official",
            "isPrimary": true,
            "verifiedAt": "2026-07-22T00:00:00+09:00"
          }
        ],
        "publicationTargets": [
          "yomeru"
        ]
      },
      {
        "schemaVersion": 1,
        "id": "content-202602-life-work-guidebook-eighth-edition",
        "slug": "life-work-guidebook-eighth-edition",
        "contentType": "guide",
        "category": "life",
        "status": "published",
        "riskLevel": "low",
        "titleJa": "外国人向け「生活・就労ガイドブック」第8版が公開されています",
        "titleZh": "面向外国人的《生活与就业指南》第 8 版已发布",
        "oneLineConclusionZh": "官方提供日语、简单日语、中文等多个语言版本，可作为赴日生活信息入口。",
        "summaryZh": "指南整理了外国人在日本生活和工作时常见的制度与手续。",
        "impactZh": "刚到日本或准备赴日的人可以用它了解居住、工作、医疗、税务和紧急求助等基础信息。",
        "dates": {
          "sourcePublishedAt": "2026-02-26T00:00:00+09:00",
          "effectiveAt": "2026-02-26T00:00:00+09:00",
          "expiresAt": null,
          "lastVerifiedAt": "2026-07-22T00:00:00+09:00"
        },
        "learning": {
          "titleJa": "日本で暮らすための公式ガイドを活用しよう",
          "textJa": "出入国在留管理庁は、外国人のための「生活・就労ガイドブック」を公開しています。日本語版だけでなく、やさしい日本語版や中国語版などでも読むことができます。仕事、病院、税金、災害への備えなどを調べる入口として便利です。実際に手続きをするときは、担当する役所の最新情報も確認しましょう。",
          "recommendedLevel": "N3",
          "estimatedMinutes": 4
        },
        "sources": [
          {
            "organization": "出入国在留管理庁",
            "title": "生活・就労ガイドブック",
            "url": "https://www.moj.go.jp/isa/support/portal/guidebook_all.html",
            "sourceType": "official",
            "isPrimary": true,
            "verifiedAt": "2026-07-22T00:00:00+09:00"
          }
        ],
        "publicationTargets": [
          "yomeru"
        ]
      }
    ]
  };

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

  function contentTopics(item) {
    const explicit = Array.isArray(item?.topics) ? item.topics.map(value => String(value || '').trim()).filter(Boolean) : [];
    if (explicit.length) return [...new Set(explicit)];
    const key = `${item?.slug || ''} ${item?.id || ''}`.toLowerCase();
    if (key.includes('eju')) return ['留学', '考试'];
    if (key.includes('jlpt')) return ['考试', '日语学习'];
    if (item?.category === 'life') return ['生活', '就业'];
    if (item?.category === 'career') return ['就业'];
    if (item?.category === 'admissions') return ['留学'];
    if (item?.category === 'exam') return ['考试'];
    if (item?.category === 'visa') return ['留学', '生活'];
    return ['新闻'];
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
      topics: contentTopics(item),
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
    const items = normalizePayload(BUNDLED_FALLBACK_PAYLOAD);
    if (!items.length) throw new Error('内置内容为空');
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
        document.dispatchEvent(new CustomEvent('content-feed:updated', {
          detail: { items: state.items.slice(), source: state.source }
        }));
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
  window.getContentFeedItems = () => state.items.slice();
  window.getContentFeedSource = () => state.source;
  window.getContentFeedItem = getContentFeedItem;
  window.startContentFeedItem = startContentFeedItem;
  window.openContentFeedQueueItem = openContentFeedQueueItem;
})();
