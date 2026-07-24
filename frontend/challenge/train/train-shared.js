(() => {
  'use strict';

  const STORAGE_KEY = 'yomeru_train_typing_v2';
  const LEGACY_STORAGE_KEY = 'yomeru_train_typing_v1';
  const REGISTRY_URL = '/challenge/train/routes/index.json';
  const DEFAULT_ROUTE_ID = 'yamanote-north-short';

  function validMode(value) {
    return value === 'kana-to-kanji' ? value : 'kanji-to-kana';
  }

  function emptyRouteState() {
    return {
      bestByMode: {},
      recentResults: [],
      totalChallenges: 0,
      lastMode: 'kanji-to-kana'
    };
  }

  function defaultStorage() {
    return {
      schemaVersion: 2,
      routes: {},
      lastRouteId: DEFAULT_ROUTE_ID,
      migratedFromV1: false
    };
  }

  function normalizeRouteState(value) {
    return {
      bestByMode: value?.bestByMode && typeof value.bestByMode === 'object' ? value.bestByMode : {},
      recentResults: Array.isArray(value?.recentResults) ? value.recentResults.slice(0, 5) : [],
      totalChallenges: Number.isFinite(Number(value?.totalChallenges)) ? Math.max(0, Number(value.totalChallenges)) : 0,
      lastMode: validMode(value?.lastMode)
    };
  }

  function normalizeStorage(value) {
    const storage = defaultStorage();
    if (!value || value.schemaVersion !== 2 || !value.routes || typeof value.routes !== 'object') return storage;
    storage.lastRouteId = typeof value.lastRouteId === 'string' && value.lastRouteId ? value.lastRouteId : DEFAULT_ROUTE_ID;
    storage.migratedFromV1 = Boolean(value.migratedFromV1);
    for (const [routeId, routeState] of Object.entries(value.routes)) {
      if (!routeId) continue;
      storage.routes[routeId] = normalizeRouteState(routeState);
    }
    return storage;
  }

  function migrateLegacyStorage() {
    let legacy = null;
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
    } catch {}
    const storage = defaultStorage();
    if (!legacy || legacy.schemaVersion !== 1) return storage;
    storage.routes[DEFAULT_ROUTE_ID] = normalizeRouteState(legacy);
    storage.lastRouteId = DEFAULT_ROUTE_ID;
    storage.migratedFromV1 = true;
    writeStorage(storage);
    return storage;
  }

  function readStorage() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (current?.schemaVersion === 2) return normalizeStorage(current);
    } catch {}
    return migrateLegacyStorage();
  }

  function writeStorage(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeStorage(value)));
      return true;
    } catch {
      return false;
    }
  }

  function getRouteState(storage, routeId, { create = false } = {}) {
    if (!storage.routes[routeId] && create) storage.routes[routeId] = emptyRouteState();
    return storage.routes[routeId] || emptyRouteState();
  }

  function resultRecordKey(result) {
    return result.hintCount > 0 ? `${result.mode}:practice` : result.mode;
  }

  function formatElapsed(milliseconds) {
    const safe = Math.max(0, Number(milliseconds) || 0);
    const minutes = Math.floor(safe / 60000);
    const seconds = Math.floor((safe % 60000) / 1000);
    const tenths = Math.floor((safe % 1000) / 100);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }

  function routePlayPath(routeId) {
    return `/challenge/train/play?route=${encodeURIComponent(routeId || DEFAULT_ROUTE_ID)}`;
  }

  function routeShareUrl(routeId, origin = window.location.origin) {
    const path = routePlayPath(routeId);
    return origin === 'https://yomeru.japanese-hub.com'
      ? `https://yomeru.japanese-hub.com${path}`
      : new URL(path, origin).href;
  }

  async function loadRegistry() {
    const response = await fetch(REGISTRY_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Route registry failed: HTTP ${response.status}`);
    const registry = await response.json();
    if (registry?.schemaVersion !== 1 || !Array.isArray(registry.routes) || registry.routes.length < 1) {
      throw new Error('Route registry is invalid.');
    }
    return registry;
  }

  window.YOMERU_TRAIN_SHARED = Object.freeze({
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    REGISTRY_URL,
    DEFAULT_ROUTE_ID,
    validMode,
    emptyRouteState,
    defaultStorage,
    normalizeStorage,
    readStorage,
    writeStorage,
    getRouteState,
    resultRecordKey,
    formatElapsed,
    routePlayPath,
    routeShareUrl,
    loadRegistry
  });
})();
