(() => {
  'use strict';

  const ROUTE_URL = '/challenge/train/routes/yamanote-short.json';
  const PUBLIC_CHALLENGE_URL = 'https://yomeru.japanese-hub.com/challenge/train';
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

  function createIdleGame(mode = 'kanji-to-kana', showHints = false) {
    return {
      phase: 'start',
      mode,
      showHints:Boolean(showHints),
      hintedStationIds:new Set(),
      hintCount:0,
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
      lastMode: 'kanji-to-kana',
      lastShowHints: false
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
        lastMode: validMode(value.lastMode),
        lastShowHints: Boolean(value.lastShowHints)
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
      showHints: game.showHints,
      hintCount: game.hintCount,
      hintedStationIds: [...game.hintedStationIds],
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

  function cubicPoint(t, start, controlA, controlB, end) {
    const inverse = 1 - t;
    return {
      x: (inverse ** 3 * start.x) + (3 * inverse ** 2 * t * controlA.x) + (3 * inverse * t ** 2 * controlB.x) + (t ** 3 * end.x),
      y: (inverse ** 3 * start.y) + (3 * inverse ** 2 * t * controlA.y) + (3 * inverse * t ** 2 * controlB.y) + (t ** 3 * end.y)
    };
  }

  function stationLabelLines(label) {
    const chars = [...String(label || '')];
    if (chars.length <= 3) return [chars.join('')];
    const splitAt = Math.ceil(chars.length / 2);
    return [chars.slice(0, splitAt).join(''), chars.slice(splitAt).join('')];
  }

  function startRouteLabel(station, mode) {
    return mode === 'kana-to-kanji' ? station.reading : station.display;
  }

  function renderStartRoute(stations, mode = selectedMode()) {
    const target = document.getElementById('startRouteMap');
    if (!target) return;
    const start = { x: 104, y: 158 };
    const controlA = { x: 234, y: 12 };
    const controlB = { x: 666, y: 12 };
    const end = { x: 796, y: 158 };
    const stationMarkup = stations.map((station, index) => {
      const point = cubicPoint(index / (stations.length - 1), start, controlA, controlB, end);
      const labelY = point.y + (index % 2 ? 44 : 28);
      const label = startRouteLabel(station, mode);
      const labelLines = stationLabelLines(label);
      const tspans = labelLines.map((line, lineIndex) => `<tspan x="${point.x.toFixed(1)}" dy="${lineIndex ? 16 : 0}">${line}</tspan>`).join('');
      const endpointClass = index === 0 || index === stations.length - 1 ? ' is-endpoint' : '';
      const longClass = [...label].length >= 4 ? ' is-long' : '';
      return `<g class="route-loop-station${endpointClass}${longClass}" data-station-id="${station.id}"><circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="13"></circle><text x="${point.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle">${tspans}</text></g>`;
    }).join('');
    target.innerHTML = `<svg viewBox="0 0 900 235" role="img" aria-label="新宿到上野的山手线北侧短程，按照实际车站顺序绘制的原创半环形示意图"><desc>按照实际车站顺序绘制的原创半环形示意图，不是官方线路图。</desc><path class="route-loop-ghost" d="M104 158 C234 236 666 236 796 158"></path><path class="route-loop-line" d="M104 158 C234 12 666 12 796 158"></path>${stationMarkup}</svg>`;
  }

  function stationProgressLabel(station, index) {
    if (game.mode !== 'kana-to-kanji' || index < game.index) return station.display;
    return String(index + 1).padStart(2, '0');
  }

  function renderRail() {
    const target = document.getElementById('playRouteStops');
    const marker = document.getElementById('trainMarker');
    if (!target || !routeData) return;
    target.innerHTML = routeData.stations.map((station, index) => {
      const className = index < game.index ? ' completed' : (index === game.index ? ' current' : '');
      const label = stationProgressLabel(station, index);
      const longClass = [...label].length >= 4 ? ' is-long' : '';
      const nearClass = Math.abs(index - game.index) <= 2 ? ' is-near' : '';
      return `<span class="rail-stop${className}${longClass}${nearClass}" data-station-index="${index}" aria-current="${index === game.index ? 'step' : 'false'}">${label}</span>`;
    }).join('');
    const progress = routeData.stations.length > 1 ? game.index / (routeData.stations.length - 1) : 0;
    target.parentElement?.style.setProperty('--route-progress-ratio', String(progress));
    if (marker) {
      marker.style.setProperty('--train-position', `${4 + progress * 84}%`);
      marker.alt = `列车当前位于${routeData.stations[game.index]?.display || '终点'}`;
    }
  }

  function selectedMode() {
    return validMode(document.querySelector('input[name="mode"]:checked')?.value);
  }

  function selectedHintSetting() {
    return Boolean(document.getElementById('trainHintToggleStart')?.checked);
  }

  function syncHintToggles(enabled) {
    for (const id of ['trainHintToggleStart', 'trainHintTogglePlay']) {
      const input = document.getElementById(id);
      if (input) input.checked = Boolean(enabled);
    }
  }

  function answerHintForStation(station) {
    return game.mode === 'kanji-to-kana'
      ? { label: '读音', value: station.reading }
      : { label: '站名', value: station.display };
  }

  function renderPracticeHint({ countUsage = true } = {}) {
    const panel = document.getElementById('stationAnswerHint');
    if (!panel || !routeData || game.phase !== 'play') return;
    const station = routeData.stations[game.index];
    const hint = answerHintForStation(station);
    panel.hidden = !game.showHints;
    document.getElementById('stationAnswerHintLabel').textContent = hint.label;
    document.getElementById('stationAnswerHintValue').textContent = hint.value;
    if (game.showHints && countUsage && !game.hintedStationIds.has(station.id)) {
      game.hintedStationIds.add(station.id);
      game.hintCount = game.hintedStationIds.size;
    }
  }

  function setHintEnabled(enabled, { countUsage = true } = {}) {
    game.showHints = Boolean(enabled);
    syncHintToggles(game.showHints);
    renderPracticeHint({ countUsage });
  }

  function focusAnswerInput({ resetScroll = false } = {}) {
    const input = document.getElementById('trainAnswerInput');
    window.requestAnimationFrame(() => {
      if (resetScroll) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      try {
        input?.focus({ preventScroll: true });
      } catch {
        input?.focus();
      }
    });
  }

  function renderStoredSummary() {
    const storage = readStorage();
    const total = document.getElementById('totalChallengeCount');
    if (total) total.textContent = `${storage.totalChallenges} 次`;
    document.querySelectorAll('input[name="mode"]').forEach(input => {
      input.checked = input.value === storage.lastMode;
    });
    if (game.phase === 'start') syncHintToggles(false);
  }

  function renderMetrics() {
    const totalSubmissions = game.correctSubmissions + game.wrongSubmissions;
    document.getElementById('elapsedValue').textContent = formatElapsed(elapsedNow());
    document.getElementById('progressValue').textContent = `${String(game.index + 1).padStart(2, '0')} / ${String(routeData?.stations.length || 13).padStart(2, '0')}`;
    document.getElementById('accuracyValue').textContent = totalSubmissions ? `${Math.round(accuracyValue() * 100)}%` : '—';
    document.getElementById('streakValue').textContent = String(game.currentStreak);
  }

  function promptSizeFor(value) {
    const length = [...String(value || '')].length;
    if (length >= 6) return 'extra-long';
    if (length >= 4) return 'long';
    if (length === 3) return 'medium';
    return 'short';
  }

  function renderQuestion({ resetScroll = false } = {}) {
    if (!routeData) return;
    const station = routeData.stations[game.index];
    const next = routeData.stations[game.index + 1];
    const mode = MODES[game.mode];
    const currentContext = game.mode === 'kana-to-kanji' ? `第 ${game.index + 1} 站` : station.display;
    const nextContext = next
      ? (game.mode === 'kana-to-kanji' ? `第 ${game.index + 2} 站` : next.display)
      : '终点';
    document.getElementById('currentStationName').textContent = currentContext;
    document.getElementById('nextStationName').textContent = nextContext;
    document.getElementById('challengeModeLabel').textContent = mode.label;
    document.getElementById('challengeIndexLabel').textContent = String(game.index + 1).padStart(2, '0');
    const prompt = mode.prompt(station);
    const promptElement = document.getElementById('questionPrompt');
    promptElement.textContent = prompt;
    promptElement.dataset.promptSize = promptSizeFor(prompt);
    document.getElementById('questionHint').textContent = mode.hint;
    const input = document.getElementById('trainAnswerInput');
    const submitButton = document.getElementById('trainAnswerSubmitButton');
    input.value = '';
    input.disabled = false;
    input.placeholder = game.mode === 'kanji-to-kana' ? '输入平假名' : '输入站名汉字';
    submitButton.disabled = true;
    document.getElementById('trainAnswerForm').className = 'answer';
    const feedback = document.getElementById('trainAnswerFeedback');
    feedback.className = 'feedback';
    feedback.textContent = '输入答案后点击确认，或按 Enter。';
    renderMetrics();
    renderRail();
    syncHintToggles(game.showHints);
    renderPracticeHint();
    focusAnswerInput({ resetScroll });
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
    const showHints = selectedHintSetting();
    const now = performance.now();
    game = createIdleGame(mode, showHints);
    game.phase = 'play';
    game.startedAt = now;
    game.stationStartedAt = now;
    const storage = readStorage();
    storage.lastMode = mode;
    storage.lastShowHints = false;
    writeStorage(storage);
    setPhase('play');
    renderQuestion({ resetScroll: true });
    timerFrame = requestAnimationFrame(timerTick);
  }

  function expectedAnswers(station) {
    return MODES[game.mode].answers(station).map(normalizeAnswer).filter(Boolean);
  }

  function setFeedback(message, type = '') {
    const feedback = document.getElementById('trainAnswerFeedback');
    const field = document.getElementById('trainAnswerForm');
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
      setFeedback('请输入答案后再确认。', 'error');
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
    document.getElementById('trainAnswerSubmitButton').disabled = true;
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

  function resultRecordKey(result) {
    return result.hintCount > 0 ? `${result.mode}:practice` : result.mode;
  }

  function resultPracticeLabel(result) {
    if (result.hintCount >= (routeData?.stations.length || 13)) return '练习模式 · 全程使用提示';
    if (result.hintCount > 0) return `练习模式 · 使用提示 ${result.hintCount} 站`;
    return '纯挑战 · 未使用提示';
  }

  function persistResult(result) {
    const storage = readStorage();
    storage.totalChallenges += 1;
    storage.lastMode = result.mode;
    storage.lastShowHints = false;
    storage.recentResults = [result, ...storage.recentResults].slice(0, 5);
    const recordKey = resultRecordKey(result);
    if (isBetterResult(result, storage.bestByMode[recordKey])) storage.bestByMode[recordKey] = result;
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
    const averageStationMs = routeData?.stations.length ? elapsedMs / routeData.stations.length : 0;
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
      correctChars: game.correctChars,
      hintCount: game.hintCount,
      assisted: game.hintCount > 0
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
    document.getElementById('resultErrors').textContent = String(result.wrongSubmissions);
    document.getElementById('resultStreak').textContent = String(result.bestStreak);
    document.getElementById('resultHintUsage').textContent = resultPracticeLabel(result);
    const best = storage.bestByMode[resultRecordKey(result)];
    const recordLabel = result.hintCount > 0 ? '练习模式最佳纪录' : '纯挑战最佳纪录';
    document.getElementById('resultBest').textContent = best
      ? `${recordLabel}：${formatElapsed(best.elapsedMs)} · ${Math.round(best.accuracy * 100)}%`
      : `${recordLabel}：—`;
    renderStoredSummary();
  }

  function challengeUrl() {
    if (window.location.hostname === 'yomeru.japanese-hub.com') return PUBLIC_CHALLENGE_URL;
    return new URL('/challenge/train', window.location.origin).href;
  }

  function resultModeName(mode) {
    return mode === 'kana-to-kanji' ? '假名 → 汉字' : '汉字 → 假名';
  }

  function cardFilename(result) {
    const date = String(result.completedAt || new Date().toISOString()).slice(0, 10).replaceAll('-', '');
    const mode = result.mode === 'kana-to-kanji' ? 'kana-kanji' : 'kanji-kana';
    return `yomeru-train-${mode}-${date}.png`;
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawTrainIcon(context, x, y, scale = 1) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.fillStyle = '#fffdf8';
    context.strokeStyle = '#17242d';
    context.lineWidth = 6;
    roundedRectPath(context, -45, -58, 90, 108, 24);
    context.fill();
    context.stroke();
    context.fillStyle = '#b8dc63';
    context.strokeStyle = '#17242d';
    context.lineWidth = 5;
    context.fillRect(-30, -36, 60, 38);
    context.strokeRect(-30, -36, 60, 38);
    context.beginPath();
    context.moveTo(0, -36);
    context.lineTo(0, 2);
    context.stroke();
    context.fillStyle = '#e45a46';
    context.beginPath();
    context.arc(-22, 27, 7, 0, Math.PI * 2);
    context.arc(22, 27, 7, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawResultCard(result) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext('2d');
    const ink = '#17242d';
    const paper = '#f6f4ee';
    const card = '#fffdf8';
    const signal = '#b8dc63';
    const arrival = '#e45a46';
    const soft = '#536068';

    context.fillStyle = ink;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = signal;
    context.fillRect(0, 0, 22, canvas.height);

    context.fillStyle = card;
    context.font = '800 52px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
    context.fillText('Yomeru', 82, 104);
    context.fillStyle = signal;
    context.font = '800 22px Inter, sans-serif';
    context.letterSpacing = '4px';
    context.fillText('TRAIN TYPING CHALLENGE', 82, 148);
    context.letterSpacing = '0px';

    context.strokeStyle = signal;
    context.lineWidth = 12;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(150, 250);
    context.lineTo(930, 250);
    context.stroke();
    for (let index = 0; index < 13; index += 1) {
      const x = 150 + (780 / 12) * index;
      context.fillStyle = index === 0 || index === 12 ? arrival : card;
      context.strokeStyle = ink;
      context.lineWidth = 7;
      context.beginPath();
      context.arc(x, 250, index === 0 || index === 12 ? 18 : 13, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    drawTrainIcon(context, 930, 250, 0.72);
    context.fillStyle = card;
    context.font = '700 24px "Hiragino Kaku Gothic ProN", sans-serif';
    context.textAlign = 'left';
    context.fillText('新宿', 120, 310);
    context.textAlign = 'right';
    context.fillText('上野', 960, 310);

    roundedRectPath(context, 64, 360, 952, 770, 54);
    context.fillStyle = card;
    context.fill();

    context.textAlign = 'left';
    context.fillStyle = '#789d35';
    context.font = '800 22px Inter, sans-serif';
    context.fillText('ARRIVED / 挑战完成', 122, 438);
    context.fillStyle = ink;
    context.font = '800 74px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
    context.fillText('抵达终点。', 118, 535);
    context.fillStyle = soft;
    context.font = '600 24px "PingFang SC", sans-serif';
    const cardModeLabel = `${resultModeName(result.mode)} · ${resultPracticeLabel(result)}`;
    context.fillText(cardModeLabel, 122, 582);

    context.fillStyle = ink;
    context.font = '800 142px "Hiragino Kaku Gothic ProN", Inter, sans-serif';
    context.fillText(formatElapsed(result.elapsedMs), 112, 758);
    context.fillStyle = soft;
    context.font = '600 22px "PingFang SC", sans-serif';
    context.fillText('完成时间', 122, 798);

    const stats = [
      ['正确率', `${Math.round(result.accuracy * 100)}%`],
      ['平均每站', formatSeconds(result.averageStationMs)],
      ['错误次数', String(result.wrongSubmissions)],
      ['最佳连续', String(result.bestStreak)]
    ];
    stats.forEach(([label, value], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 122 + column * 440;
      const y = 890 + row * 118;
      context.fillStyle = soft;
      context.font = '600 21px "PingFang SC", sans-serif';
      context.fillText(label, x, y);
      context.fillStyle = ink;
      context.font = '800 38px "Hiragino Kaku Gothic ProN", Inter, sans-serif';
      context.fillText(value, x, y + 48);
    });

    context.fillStyle = paper;
    context.font = '600 24px "PingFang SC", sans-serif';
    context.fillText('你能用日语开完这条线吗？', 82, 1214);
    context.fillStyle = signal;
    context.font = '700 20px Inter, sans-serif';
    context.fillText(challengeUrl(), 82, 1260);
    context.fillStyle = '#ffffff9e';
    context.font = '500 17px "PingFang SC", sans-serif';
    context.fillText('原创学习活动 · 非铁路运营机构官方产品', 82, 1304);
    return canvas;
  }

  function createResultCardBlob(result = game.result) {
    if (!result) return Promise.reject(new Error('Result is not available.'));
    const canvas = drawResultCard(result);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG generation failed.')), 'image/png', 0.95);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function setShareFeedback(message, type = '') {
    const target = document.getElementById('shareFeedback');
    if (!target) return;
    target.textContent = message;
    target.className = `share-feedback${type ? ` is-${type}` : ''}`;
  }

  function setShareButtonsBusy(busy) {
    for (const id of ['saveResultCardButton', 'shareResultButton']) {
      const button = document.getElementById(id);
      if (button) button.disabled = busy;
    }
  }

  async function saveResultCard() {
    if (!game.result) return false;
    setShareButtonsBusy(true);
    setShareFeedback('正在生成成绩卡…');
    try {
      const blob = await createResultCardBlob(game.result);
      downloadBlob(blob, cardFilename(game.result));
      setShareFeedback('成绩卡已生成，可以在下载记录中查看。', 'success');
      return true;
    } catch (error) {
      console.error(error);
      setShareFeedback('成绩卡生成失败，请稍后重试。', 'error');
      return false;
    } finally {
      setShareButtonsBusy(false);
    }
  }

  async function copyChallengeLink() {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(challengeUrl());
    return true;
  }

  async function shareResult() {
    if (!game.result) return false;
    const result = game.result;
    const title = 'Yomeru 电车日语输入挑战';
    const assistText = result.hintCount > 0 ? `，使用提示 ${result.hintCount} 站` : '，纯挑战';
    const text = `我用 ${formatElapsed(result.elapsedMs)} 完成新宿到上野挑战，正确率 ${Math.round(result.accuracy * 100)}%${assistText}。`;
    setShareButtonsBusy(true);
    setShareFeedback('正在准备分享…');
    try {
      const blob = await createResultCardBlob(result);
      const file = typeof File === 'function' ? new File([blob], cardFilename(result), { type: 'image/png' }) : null;
      if (typeof navigator.share === 'function') {
        const payload = { title, text, url: challengeUrl() };
        if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) payload.files = [file];
        await navigator.share(payload);
        setShareFeedback('已打开系统分享。', 'success');
        return true;
      }
      if (await copyChallengeLink()) {
        setShareFeedback('挑战链接已复制，可以粘贴到小红书或聊天中。', 'success');
        return true;
      }
      downloadBlob(blob, cardFilename(result));
      setShareFeedback('当前浏览器不支持系统分享，已改为下载成绩卡。', 'success');
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') {
        setShareFeedback('已取消分享。');
        return false;
      }
      try {
        if (await copyChallengeLink()) {
          setShareFeedback('系统分享不可用，挑战链接已复制。', 'success');
          return true;
        }
      } catch {}
      console.error(error);
      setShareFeedback('分享失败，请使用保存成绩卡。', 'error');
      return false;
    } finally {
      setShareButtonsBusy(false);
    }
  }

  function resetToStart() {
    stopTimer();
    const storage = readStorage();
    storage.lastShowHints = false;
    writeStorage(storage);
    game = createIdleGame(storage.lastMode, false);
    setPhase('start');
    renderStoredSummary();
    renderStartRoute(routeData?.stations || [], storage.lastMode);
    setShareFeedback('');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const status = document.getElementById('startStatus');
    status.hidden = true;
    status.textContent = '';
  }

  function bindControls() {
    document.getElementById('trainStartButton')?.addEventListener('click', startGame);
    document.getElementById('trainRetryButton')?.addEventListener('click', resetToStart);
    document.getElementById('saveResultCardButton')?.addEventListener('click', saveResultCard);
    document.getElementById('shareResultButton')?.addEventListener('click', shareResult);
    document.querySelectorAll('input[name="mode"]').forEach(input => {
      input.addEventListener('change', () => {
        if (routeData) renderStartRoute(routeData.stations, selectedMode());
      });
    });
    document.getElementById('trainHintToggleStart')?.addEventListener('change', event => {
      syncHintToggles(event.currentTarget.checked);
    });
    document.getElementById('trainHintTogglePlay')?.addEventListener('change', event => {
      setHintEnabled(event.currentTarget.checked);
    });
  }

  function bindIme() {
    const form = document.getElementById('trainAnswerForm');
    const input = document.getElementById('trainAnswerInput');
    const submitButton = document.getElementById('trainAnswerSubmitButton');
    if (!form || !input || !submitButton) return;

    function updateSubmitState() {
      submitButton.disabled = game.locked || !normalizeAnswer(input.value);
    }

    input.addEventListener('input', updateSubmitState);
    submitButton.addEventListener('pointerdown', event => {
      event.preventDefault();
    });
    input.addEventListener('compositionstart', () => {
      compositionActive = true;
      submitButton.disabled = true;
      setFeedback('正在使用日语输入法组合文字…');
    });
    input.addEventListener('compositionend', () => {
      compositionActive = false;
      updateSubmitState();
      setFeedback('候选已确认，可点击“确认”或再次按完成键。');
    });
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      if (event.isComposing || compositionActive) {
        event.preventDefault();
        setFeedback('候选词仍在组合，本次操作没有提交。');
      }
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (compositionActive) {
        setFeedback('请先确认输入法候选，再提交答案。');
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
    renderStoredSummary();
    renderStartRoute(payload.stations, selectedMode());
    const startButton = document.getElementById('trainStartButton');
    startButton.disabled = false;
    startButton.firstElementChild.textContent = '发车';
    const status = document.getElementById('startStatus');
    status.hidden = true;
    status.textContent = '';
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
      const status = document.getElementById('startStatus');
      status.hidden = false;
      status.textContent = '路线数据载入失败，请刷新页面重试。';
    }
  }

  window.YOMERU_TRAIN_CHALLENGE = Object.freeze({
    route: () => routeData,
    rules: RULES,
    storageKey: STORAGE_KEY,
    normalizeAnswer,
    snapshot,
    readStorage,
    createResultCardBlob,
    saveResultCard,
    shareResult
  });

  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
