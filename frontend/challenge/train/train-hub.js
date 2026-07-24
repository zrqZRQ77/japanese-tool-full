(() => {
  'use strict';

  const shared = window.YOMERU_TRAIN_SHARED;
  if (!shared) throw new Error('Yomeru train shared runtime is missing.');

  const {
    readStorage,
    getRouteState,
    resultRecordKey,
    formatElapsed,
    routePlayPath,
    loadRegistry
  } = shared;

  let registry = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function bestPureResult(routeState) {
    const candidates = [
      routeState.bestByMode?.[resultRecordKey({ mode: 'kanji-to-kana', hintCount: 0 })],
      routeState.bestByMode?.[resultRecordKey({ mode: 'kana-to-kanji', hintCount: 0 })]
    ].filter(Boolean);
    if (!candidates.length) return null;
    return [...candidates].sort((a, b) => {
      const accuracyGap = Number(b.accuracy || 0) - Number(a.accuracy || 0);
      if (accuracyGap) return accuracyGap;
      return Number(a.elapsedMs || Number.MAX_SAFE_INTEGER) - Number(b.elapsedMs || Number.MAX_SAFE_INTEGER);
    })[0];
  }

  function modeLabel(mode) {
    return mode === 'kana-to-kanji' ? '假名→汉字' : '汉字→假名';
  }

  function routeCard(route, routeState) {
    const best = bestPureResult(routeState);
    const hasCompleted = routeState.totalChallenges > 0;
    const buttonLabel = hasCompleted ? '再次挑战' : '开始挑战';
    const bestValue = best ? `${formatElapsed(best.elapsedMs)} · ${Math.round(Number(best.accuracy || 0) * 100)}%` : '尚无纪录';
    const bestMode = best ? modeLabel(best.mode) : '完成后显示';
    const style = `--route-signal:${escapeHtml(route.theme?.signal || '#b8dc63')};--route-signal-dark:${escapeHtml(route.theme?.signalDark || '#789d35')}`;
    return `
      <article class="route-card" data-route-id="${escapeHtml(route.routeId)}" style="${style}">
        <div class="route-card-top">
          <p class="route-line-name">${escapeHtml(route.lineNameJa)} / ${escapeHtml(route.lineNameZh)}</p>
          <span class="route-badge">${escapeHtml(route.badge || (hasCompleted ? '已挑战' : '开放'))}</span>
        </div>
        <h3>${escapeHtml(route.titleZh)}</h3>
        <p class="route-subtitle">${escapeHtml(route.subtitleZh)}</p>
        <div class="route-track" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="route-card-meta">
          <span>${Number(route.stationCount) || 0} 站</span>
          <span>${escapeHtml(route.difficulty)}</span>
          <span>推荐 ${escapeHtml(route.recommendedJlpt)}</span>
        </div>
        <div class="route-card-progress">
          <div><span>挑战次数</span><strong>${Number(routeState.totalChallenges) || 0} 次</strong></div>
          <div><span>最佳纯挑战</span><strong>${escapeHtml(bestValue)}</strong><small>${escapeHtml(bestMode)}</small></div>
        </div>
        <a class="route-card-action" href="${escapeHtml(routePlayPath(route.routeId))}"><span>${buttonLabel}</span><span aria-hidden="true">→</span></a>
      </article>
    `;
  }

  function renderSummary(storage) {
    const totalChallenges = registry.routes.reduce((sum, route) => sum + getRouteState(storage, route.routeId).totalChallenges, 0);
    const completedRoutes = registry.routes.filter(route => getRouteState(storage, route.routeId).totalChallenges > 0).length;
    document.getElementById('routeCount').textContent = String(registry.routes.length);
    document.getElementById('totalChallenges').textContent = String(totalChallenges);
    document.getElementById('completedRoutes').textContent = `${completedRoutes} / ${registry.routes.length}`;
  }

  function renderRoutes(storage) {
    const grid = document.getElementById('routeGrid');
    grid.innerHTML = registry.routes.map(route => routeCard(route, getRouteState(storage, route.routeId))).join('');
  }

  async function init() {
    try {
      registry = await loadRegistry();
      const storage = readStorage();
      renderSummary(storage);
      renderRoutes(storage);
      document.body.dataset.routeHubReady = 'true';
    } catch (error) {
      console.error(error);
      document.getElementById('routeGrid').innerHTML = '';
      document.getElementById('hubError').hidden = false;
      document.body.dataset.routeHubError = 'true';
    }
  }

  window.YOMERU_TRAIN_HUB = Object.freeze({
    registry: () => registry,
    bestPureResult
  });

  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
