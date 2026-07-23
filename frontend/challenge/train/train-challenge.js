(() => {
  'use strict';

  const ROUTE_URL = 'routes/yamanote-short.json';
  const STORAGE_KEY = 'yomeru_train_typing_v1';
  const MODES = Object.freeze({
    'kanji-to-kana': Object.freeze({
      label: 'KANJI → KANA',
      hint: '请输入这个站名的平假名读音',
      prompt: station => station.display,
      answers: station => station.acceptedKana
    }),
    'kana-to-kanji': Object.freeze({
      label: 'KANA → KANJI',
      hint: '请输入这个读音对应的站名汉字',
      prompt: station => station.reading,
      answers: station => station.acceptedKanji
    })
  });
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
  let timerFrame = 0;
  let game = createIdleGame();

  function createIdleGame(mode = 'kanji-to-kana') {
    return {
      phase: 'start',
      mode,
      index: 0,
      startedAt: null,
      completedAt: null,
      stationStartedAt: null,
      correctSubmissions: 0,
      wrongSubmissions: 0,
      currentStreak: 0,
      bestStreak: 0,
      stationTimes: [],
      correctChars: 0,
      locked: false,
      finished: false,
      lastSubmitAt: Number.NEGATIVE_INFINITY,
      result: null
    };
  }

  function defaultStorage() {
    return {
      schemaVersion: 1,
      bestByMode: {},
      recentResults: [],
      totalChallenges: 0,
      lastMode: 'kanji-to-kana'
    };
  }

  function validMode(value) {
    return Object.hasOwn(MODES, value) ? value : 'kanji-to-kana';
  }

  function readStorage() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!value || value.schemaVersion !== 1) return defaultStorage();
      return {
        schemaVersion: 1,
        bestByMode: value.bestByMode && typeof value.bestByMode === 'object' ? value.bestByMode : {},
        recentResults: Array.isArray(value.recentResults) ? value.recentResults.slice(0, 5) : [],
        totalChallenges: Number.isFinite(Number(value.totalChallenges)) ? Math.max(0, Number(value.totalChallenges)) : 0,
        lastMode: validMode(value.lastMode)
      };
    } catch {
      return defaultStorage();
    }
  }

  function writeStorage(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function normalizeAnswer(value) {
    return String(value || '')
      .normalize('NFKC')
      .trim()
      .replace(/[\s\u3000]+/g, '');
  }

  function formatElapsed(milliseconds) {
    const safe = Math.max(0, Number(milliseconds) || 0);
    const minutes = Math.floor(safe / 60000);
    const seconds = Math.floor((safe % 60000) / 1000);
    const tenths = Math.floor((safe % 1000) / 100);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }

  function formatSeconds(milliseconds) {
    return `${(Math.max(0, Number(milliseconds) || 0) / 1000).toFixed(1)} 秒`;
  }

  function elapsedNow() {
    if (game.startedAt === null) return 0;
    const end = game.completedAt ?? performance.now();
    return Math.max(0, end - game.startedAt);
  }

  function accuracyValue() {
    const total = game.correctSubmissions + game.wrongSubmissions;
    return total ? game.correctSubmissions / total : 0;
  }

  function snapshot() {
    return {
      phase: game.phase,
      mode: game.mode,
      index: game.index,
      correctSubmissions: game.correctSubmissions,
      wrongSubmissions: game.wrongSubmissions,
      currentStreak: game.currentStreak,
      bestStreak: game.bestStreak,
      stationTimes: [...game.stationTimes],
      correctChars: game.correctChars,
      locked: game.locked,
      finished: game.finished,
      elapsedMs: elapsedNow(),
      accuracy: accuracyValue(),
      result: game.result ? { ...game.result } : null
    };
  }

  function setPhase(phase) {
    game.phase = phase;
    document.body.dataset.gameState = phase;
    document.querySelectorAll('[data-challenge-view]').forEach(view => {
      view.hidden = view.dataset.challengeView !== phase;
    });
  }

  function renderStartRoute(stations) {
    const target = document.getElementById('startRouteStops');
    if (!target) return;
    target.innerHTML = stations.map(station => `<span title="${station.reading}">${station.display}</span>`).join('');
  }

  function renderRail() {
    const target = document.getElementById('playRouteStops');
    const marker = document.getElementById('trainMarker');
    if (!target || !routeData) return;
    target.innerHTML = routeData.stations.map((station, index) => {
      const className = index < game.index ? ' completed' : (index === game.index ? ' current' : '');
      return `<span class="rail-stop${className}" aria-current="${index === game.index ? 'step' : 'false'}">${station.display}</span>`;
    }).join('');
    if (marker) {
      const progress = routeData.stations.length > 1 ? game.index / (routeData.stations.length - 1) : 0;
      marker.style.setProperty('--train-position', `${4 + progress * 84}%`);
      marker.alt = `列车当前位于${routeData.stations[game.index]?.display || '终点'}`;
    }
  }

  function selectedMode() {
    return validMode(document.querySelector('input[name="mode"]:checked')?.value);
  }

  function renderStoredSummary() {
    const storage = readStorage();
    const total = document.getElementById('totalChallengeCount');
    if (total) total.textContent = `${storage.totalChallenges} 次`;
    document.querySelectorAll('input[name="mode"]').forEach(input => {
      input.checked = input.value === storage.lastMode;
    });
  }

  function renderMetrics() {
    const totalSubmissions = game.correctSubmissions + game.wrongSubmissions;
    document.getElementById('elapsedValue').textContent = formatElapsed(elapsedNow());
    document.getElementById('progressValue').textContent = `${String(game.index + 1).padStart(2, '0')} / ${String(routeData?.stations.length || 13).padStart(2, '0')}`;
    document.getElementById('accuracyValue').textContent = totalSubmissions ? `${Math.round(accuracyValue() * 100)}%` : '—';
    document.getElementById('streakValue').textContent = String(game.currentStreak);
  }

  function renderQuestion() {
    if (!routeData) return;
    const station = routeData.stations[game.index];
    const next = routeData.stations[game.index + 1];
    const mode = MODES[game.mode];
    document.getElementById('currentStationName').textContent = station.display;
    document.getElementById('nextStationName').textContent = next?.display || '终点';
    document.getElementById('challengeModeLabel').textContent = mode.label;
    document.getElementById('challengeIndexLabel').textContent = String(game.index + 1).padStart(2, '0');
    document.getElementById('questionPrompt').textContent = mode.prompt(station);
    document.getElementById('questionHint').textContent = mode.hint;
    const input = document.getElementById('trainAnswerInput');
    input.value = '';
    input.disabled = false;
    input.placeholder = game.mode === 'kanji-to-kana' ? '输入平假名' : '输入站名汉字';
    document.getElementById('answerField').className = 'answer';
    const feedback = document.getElementById('trainAnswerFeedback');
    feedback.className = 'feedback';
    feedback.textContent = '输入答案后按 Enter。';
    renderMetrics();
    renderRail();
    setTimeout(() => input.focus(), 0);
  }

  function timerTick() {
    if (game.phase !== 'play' || game.finished) return;
    renderMetrics();
    timerFrame = requestAnimationFrame(timerTick);
  }

  function stopTimer() {
    if (timerFrame) cancelAnimationFrame(timerFrame);
    timerFrame = 0;
  }

  function startGame() {
    if (!routeData) return;
    stopTimer();
    const mode = selectedMode();
    const now = performance.now();
    game = createIdleGame(mode);
    game.phase = 'play';
    game.startedAt = now;
    game.stationStartedAt = now;
    const storage = readStorage();
    storage.lastMode = mode;
    writeStorage(storage);
    setPhase('play');
    renderQuestion();
    timerFrame = requestAnimationFrame(timerTick);
  }

  function expectedAnswers(station) {
    return MODES[game.mode].answers(station).map(normalizeAnswer).filter(Boolean);
  }

  function setFeedback(message, type = '') {
    const feedback = document.getElementById('trainAnswerFeedback');
    const field = document.getElementById('answerField');
    feedback.textContent = message;
    feedback.className = `feedback${type ? ` is-${type}` : ''}`;
    field.className = `answer${game.locked ? ' is-locked' : ''}${type ? ` is-${type}` : ''}`;
  }

  function submitAnswer() {
    if (!routeData || game.phase !== 'play' || game.finished || game.locked) return false;
    const now = performance.now();
    if (now - game.lastSubmitAt < 120) return false;
    game.lastSubmitAt = now;

    const input = document.getElementById('trainAnswerInput');
    const answer = normalizeAnswer(input.value);
    if (!answer) {
      setFeedback('请输入答案后再按 Enter。', 'error');
      return false;
    }

    const station = routeData.stations[game.index];
    if (!expectedAnswers(station).includes(answer)) {
      game.wrongSubmissions += 1;
      game.currentStreak = 0;
      setFeedback('还不对。保留当前输入，可以直接修改后再试。', 'error');
      renderMetrics();
      return false;
    }

    game.correctSubmissions += 1;
    game.currentStreak += 1;
    game.bestStreak = Math.max(game.bestStreak, game.currentStreak);
    game.correctChars += [...answer].length;
    game.stationTimes.push(Math.max(0, now - game.stationStartedAt));
    game.locked = true;
    input.disabled = true;
    setFeedback(`正确：${station.display}（${station.reading}）`, 'correct');
    renderMetrics();

    const completedIndex = game.index;
    window.setTimeout(() => {
      if (game.finished || game.index !== completedIndex) return;
      if (game.index >= routeData.stations.length - 1) {
        finishGame();
        return;
      }
      game.index += 1;
      game.stationStartedAt = performance.now();
      game.locked = false;
      renderQuestion();
    }, 260);
    return true;
  }

  function isBetterResult(candidate, current) {
    if (!current) return true;
    if (candidate.accuracy !== current.accuracy) return candidate.accuracy > current.accuracy;
    if (candidate.elapsedMs !== current.elapsedMs) return candidate.elapsedMs < current.elapsedMs;
    return candidate.cpm > current.cpm;
  }

  function persistResult(result) {
    const storage = readStorage();
    storage.totalChallenges += 1;
    storage.lastMode = result.mode;
    storage.recentResults = [result, ...storage.recentResults].slice(0, 5);
    if (isBetterResult(result, storage.bestByMode[result.mode])) storage.bestByMode[result.mode] = result;
    writeStorage(storage);
    return storage;
  }

  function finishGame() {
    if (game.finished) return;
    game.finished = true;
    game.locked = true;
    game.completedAt = performance.now();
    stopTimer();
    const elapsedMs = elapsedNow();
    const accuracy = accuracyValue();
    const averageStationMs = game.stationTimes.length ? game.stationTimes.reduce((sum, value) => sum + value, 0) / game.stationTimes.length : 0;
    const elapsedMinutes = elapsedMs / 60000;
    const cpm = elapsedMinutes > 0 ? game.correctChars / elapsedMinutes : 0;
    const result = {
      schemaVersion: 1,
      completed: true,
      mode: game.mode,
      completedAt: new Date().toISOString(),
      elapsedMs: Math.round(elapsedMs),
      accuracy: Number(accuracy.toFixed(4)),
      averageStationMs: Math.round(averageStationMs),
      cpm: Number(cpm.toFixed(1)),
      bestStreak: game.bestStreak,
      correctSubmissions: game.correctSubmissions,
      wrongSubmissions: game.wrongSubmissions,
      correctChars: game.correctChars
    };
    game.result = result;
    const storage = persistResult(result);
    renderResult(result, storage);
    setPhase('result');
  }

  function renderResult(result, storage) {
    document.getElementById('resultElapsed').textContent = formatElapsed(result.elapsedMs);
    document.getElementById('resultAccuracy').textContent = `${Math.round(result.accuracy * 100)}%`;
    document.getElementById('resultAverage').textContent = formatSeconds(result.averageStationMs);
    document.getElementById('resultCpm').textContent = `${Math.round(result.cpm)} CPM`;
    document.getElementById('resultStreak').textContent = String(result.bestStreak);
    const best = storage.bestByMode[result.mode];
    document.getElementById('resultBest').textContent = best
      ? `本机最佳纪录：${formatElapsed(best.elapsedMs)} · ${Math.round(best.accuracy * 100)}%`
      : '本机最佳纪录：—';
    renderStoredSummary();
  }

  function resetToStart() {
    stopTimer();
    const mode = readStorage().lastMode;
    game = createIdleGame(mode);
    setPhase('start');
    renderStoredSummary();
    document.getElementById('startStatus').textContent = '路线已就绪。点击发车后才开始计时。';
  }

  function bindControls() {
    document.getElementById('trainStartButton')?.addEventListener('click', startGame);
    document.getElementById('trainRetryButton')?.addEventListener('click', resetToStart);
  }

  function bindIme() {
    const input = document.getElementById('trainAnswerInput');
    if (!input) return;
    input.addEventListener('compositionstart', () => {
      compositionActive = true;
      setFeedback('正在使用日语输入法组合文字…');
    });
    input.addEventListener('compositionend', () => {
      compositionActive = false;
      setFeedback('组合完成，按 Enter 提交。');
    });
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (event.isComposing || compositionActive) {
        setFeedback('候选词仍在组合，本次回车没有提交。');
        return;
      }
      submitAnswer();
    });
  }

  async function loadRoute() {
    const response = await fetch(ROUTE_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Route data failed: HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.stations) || payload.stations.length !== 13) throw new Error('Route must contain exactly 13 stations.');
    routeData = payload;
    renderStartRoute(payload.stations);
    renderStoredSummary();
    const startButton = document.getElementById('trainStartButton');
    startButton.disabled = false;
    startButton.firstElementChild.textContent = '发车';
    document.getElementById('startStatus').textContent = '路线已就绪。点击发车后才开始计时。';
  }

  async function init() {
    bindControls();
    bindIme();
    setPhase('start');
    renderStoredSummary();
    try {
      await loadRoute();
    } catch (error) {
      console.error(error);
      document.body.dataset.routeError = 'true';
      document.getElementById('startStatus').textContent = '路线数据载入失败，请刷新页面重试。';
    }
  }

  window.YOMERU_TRAIN_CHALLENGE = Object.freeze({
    route: () => routeData,
    rules: RULES,
    storageKey: STORAGE_KEY,
    normalizeAnswer,
    snapshot,
    readStorage
  });

  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
