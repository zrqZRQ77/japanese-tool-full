(() => {
  'use strict';

  const ROUTE_URL = 'routes/yamanote-short.json';
  const STORAGE_KEY = 'yomeru_train_typing_v1';
  const STATES = new Set(['start', 'play', 'result']);
  const RULES = Object.freeze({
    timerStartsOnDeparture: true,
    ignoreEnterWhileComposing: true,
    normalization: ['trim', 'remove-spaces', 'unicode-nfkc'],
    kanaMode: 'listed-hiragana-only',
    kanjiMode: 'listed-kanji-only',
    scorePriority: ['completed', 'accuracy', 'elapsedMs', 'cpm'],
    localStorageNamespace: STORAGE_KEY
  });

  let routeData = null;
  let compositionActive = false;

  function setState(nextState, updateUrl = true) {
    const state = STATES.has(nextState) ? nextState : 'start';
    document.body.dataset.prototypeState = state;
    document.querySelectorAll('[data-challenge-view]').forEach(view => {
      view.hidden = view.dataset.challengeView !== state;
    });
    document.querySelectorAll('.prototype-nav [data-demo-state]').forEach(button => {
      button.setAttribute('aria-current', button.dataset.demoState === state ? 'page' : 'false');
    });
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('state', state);
      history.replaceState({ state }, '', url);
    }
    if (state === 'play') setTimeout(() => document.getElementById('trainAnswerInput')?.focus(), 0);
  }

  function renderRoute(stations) {
    const start = document.getElementById('startRouteStops');
    const play = document.getElementById('playRouteStops');
    if (start) start.innerHTML = stations.map(station => `<span title="${station.reading}">${station.display}</span>`).join('');
    if (play) play.innerHTML = stations.map((station, index) => {
      const state = index < 4 ? ' passed' : index === 4 ? ' current' : '';
      return `<span class="rail-stop${state}">${station.display}</span>`;
    }).join('');
  }

  async function loadRoute() {
    const response = await fetch(ROUTE_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Route data failed: HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.stations) || payload.stations.length !== 13) throw new Error('Route must contain 13 stations.');
    routeData = payload;
    renderRoute(payload.stations);
  }

  function bindControls() {
    document.addEventListener('click', event => {
      const control = event.target.closest('[data-demo-state]');
      if (control) setState(control.dataset.demoState);
    });
  }

  function bindImeBaseline() {
    const input = document.getElementById('trainAnswerInput');
    const feedback = document.getElementById('trainAnswerFeedback');
    if (!input || !feedback) return;
    input.addEventListener('compositionstart', () => {
      compositionActive = true;
      feedback.textContent = '正在使用日语输入法组合文字…';
    });
    input.addEventListener('compositionend', () => {
      compositionActive = false;
      feedback.textContent = '组合完成。A2 阶段将允许按 Enter 提交。';
    });
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (event.isComposing || compositionActive) {
        feedback.textContent = '候选词仍在组合，本次回车没有提交。';
        return;
      }
      feedback.textContent = '静态原型：答案提交将在 A2 阶段启用。';
    });
  }

  async function init() {
    const initialState = new URLSearchParams(location.search).get('state');
    setState(STATES.has(initialState) ? initialState : 'start', false);
    bindControls();
    bindImeBaseline();
    try {
      await loadRoute();
    } catch (error) {
      console.error(error);
      document.body.dataset.routeError = 'true';
    }
  }

  window.YOMERU_TRAIN_PROTOTYPE = Object.freeze({ route: () => routeData, rules: RULES, storageKey: STORAGE_KEY, setState });
  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
