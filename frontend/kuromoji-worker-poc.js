/*
 * Main-thread controller for the isolated Kuromoji Worker PoC.
 * Loading this controller does not start or download the Worker by itself.
 */

(function exposeKuromojiWorkerPoc(global) {
  'use strict';

  const ENABLE_KUROMOJI_WORKER_POC = false;
  const KUROMOJI_ASSET_VERSION = '20260714-01';
  const DEFAULT_WORKER_URL = `vendor/kuromoji/${KUROMOJI_ASSET_VERSION}/kuromoji-tokenizer.worker.js`;
  const DEFAULT_INIT_TIMEOUT_MS = 90000;
  const DEFAULT_TOKENIZE_TIMEOUT_MS = 10000;

  function toAppToken(token) {
    return {
      surface_form: token.surface,
      basic_form: token.basicForm,
      pos: token.pos,
      pos_detail_1: token.posDetail,
      conjugated_type: token.conjugatedType,
      conjugated_form: token.conjugatedForm,
      reading: token.rawReading || token.reading,
      pronunciation: token.rawPronunciation || token.pronunciation,
      word_position: token.start + 1,
      paragraph_index: token.paragraphIndex
    };
  }

  function createClient(options = {}) {
    const workerUrl = options.workerUrl || DEFAULT_WORKER_URL;
    const initTimeoutMs = Number(options.initTimeoutMs || DEFAULT_INIT_TIMEOUT_MS);
    const tokenizeTimeoutMs = Number(
      options.tokenizeTimeoutMs || options.timeoutMs || DEFAULT_TOKENIZE_TIMEOUT_MS
    );
    let current = null;
    let sequence = 0;
    let generation = 0;
    const pending = new Map();

    function rejectGeneration(targetGeneration, error) {
      pending.forEach((request, id) => {
        if (request.generation !== targetGeneration) return;
        clearTimeout(request.timer);
        pending.delete(id);
        request.reject(error);
      });
    }

    function destroy(record, error) {
      if (!record || !record.active) return;
      record.active = false;
      record.worker.removeEventListener?.('message', record.onMessage);
      record.worker.removeEventListener?.('error', record.onError);
      rejectGeneration(record.generation, error);
      record.worker.terminate();
      if (current === record) current = null;
    }

    function isCurrent(record) {
      return Boolean(record?.active && current === record && record.generation === generation);
    }

    function settleRequest(record, message) {
      if (!isCurrent(record)) return;
      const request = pending.get(message.id);
      if (!request || request.generation !== record.generation) return;
      if (request.type === 'initialize' && !['ready', 'error'].includes(message.type)) return;
      if (request.type === 'tokenize' && !['result', 'error'].includes(message.type)) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.type === 'error') {
        const error = new Error(message.error || 'Kuromoji Worker failed.');
        request.reject(error);
        if (request.type === 'initialize') destroy(record, error);
        return;
      }
      request.resolve(message);
    }

    function createRequest(record, type, payload, activeTimeout) {
      const id = `kuromoji-poc-${Date.now()}-${++sequence}`;
      return new Promise((resolve, reject) => {
        const startedAt = performance.now();
        const timer = setTimeout(() => {
          if (!isCurrent(record)) return;
          const error = new Error(
            `Kuromoji Worker ${type === 'initialize' ? 'initialization' : 'tokenization'} timed out after ${activeTimeout}ms.`
          );
          destroy(record, error);
        }, activeTimeout);
        pending.set(id, {
          resolve,
          reject,
          timer,
          startedAt,
          type,
          generation: record.generation
        });
        try {
          record.worker.postMessage({ id, type, ...payload });
        } catch (error) {
          destroy(record, error instanceof Error ? error : new Error(String(error)));
        }
      });
    }

    function ensureWorker() {
      if (current?.active) return current;
      const createdWorker = new Worker(workerUrl);
      const record = {
        worker: createdWorker,
        generation: ++generation,
        active: true,
        readyPromise: null,
        onMessage: null,
        onError: null
      };
      record.onMessage = event => settleRequest(record, event.data || {});
      record.onError = event => {
        if (!isCurrent(record)) return;
        destroy(record, new Error(event.message || 'Kuromoji Worker could not load.'));
      };
      createdWorker.addEventListener('message', record.onMessage);
      createdWorker.addEventListener('error', record.onError);
      current = record;
      return record;
    }

    function initialize(requestOptions = {}) {
      const record = ensureWorker();
      if (record.readyPromise) return record.readyPromise;
      const activeTimeout = Number(requestOptions.initTimeoutMs || initTimeoutMs);
      record.readyPromise = createRequest(record, 'initialize', {}, activeTimeout)
        .then(message => ({
          generation: record.generation,
          metrics: message.metrics || {}
        }));
      return record.readyPromise;
    }

    async function analyze(text, requestOptions = {}) {
      const startedAt = performance.now();
      const ready = await initialize(requestOptions);
      const record = current;
      if (!record || !isCurrent(record) || record.generation !== ready.generation) {
        throw new Error('Kuromoji Worker was replaced before tokenization.');
      }
      const activeTimeout = Number(requestOptions.tokenizeTimeoutMs || requestOptions.timeoutMs || tokenizeTimeoutMs);
      const message = await createRequest(
        record,
        'tokenize',
        { text: String(text || '') },
        activeTimeout
      );
      return {
        ok: true,
        mode: 'kuromoji-worker-poc',
        paragraphs: message.paragraphs,
        tokens: message.tokens,
        appTokens: message.tokens.map(toAppToken),
        metrics: {
          ...message.metrics,
          roundTripMs: performance.now() - startedAt
        }
      };
    }

    async function analyzeWithFallback(text, fallback, requestOptions = {}) {
      try {
        return await analyze(text, requestOptions);
      } catch (error) {
        return {
          ok: false,
          mode: 'fallback',
          error: error instanceof Error ? error.message : String(error),
          fallbackValue: typeof fallback === 'function' ? await fallback(text) : fallback
        };
      }
    }

    function terminate() {
      if (current) destroy(current, new Error('Kuromoji Worker client terminated.'));
    }

    function debugState() {
      return {
        generation,
        hasWorker: Boolean(current?.active),
        ready: Boolean(current?.readyPromise),
        pendingCount: pending.size
      };
    }

    return {
      analyze,
      analyzeWithFallback,
      initialize,
      terminate,
      workerUrl,
      debugState
    };
  }

  const api = Object.freeze({
    enabled: ENABLE_KUROMOJI_WORKER_POC,
    assetVersion: KUROMOJI_ASSET_VERSION,
    createClient,
    toAppToken
  });
  global.KuromojiWorkerClient = api;
  // Preserve the PoC name for the isolated benchmark and its archived evidence.
  global.KuromojiWorkerPoc = api;
})(window);
