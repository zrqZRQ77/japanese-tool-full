#!/usr/bin/env node

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const ROOT_DIR = resolve(FRONTEND_DIR, '..');
const EVIDENCE_DIR = resolve(ROOT_DIR, '.ai-coordination/evidence/kuromoji-worker-minimal-fix-20260714');
const BASE_URL = process.env.KUROMOJI_POC_BASE_URL || 'http://127.0.0.1:4192';
const CUSTOM_CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '';

const samples = {
  basic: '私は毎朝七時に起きます。\n朝ごはんを食べてから、学校に行きます。\n夜は本を読んで、十一時に寝ます。',
  complex: '三菱UFJフィナンシャル・グループの時価総額が上昇した。\n金融機関が首位に浮上した。\n半導体メモリー大手を上回った。'
};

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

async function resourceMetrics() {
  const runtime = await stat(resolve(FRONTEND_DIR, 'vendor/kuromoji/20260714-01/kuromoji.js'));
  const dictionaryFiles = [
    'base.dat.gz', 'cc.dat.gz', 'check.dat.gz', 'tid.dat.gz', 'tid_map.dat.gz', 'tid_pos.dat.gz',
    'unk.dat.gz', 'unk_char.dat.gz', 'unk_compat.dat.gz', 'unk_invoke.dat.gz', 'unk_map.dat.gz', 'unk_pos.dat.gz'
  ];
  const dictionaryStats = await Promise.all(dictionaryFiles.map(async file => ({
    file,
    bytes: (await stat(resolve(FRONTEND_DIR, 'vendor/kuromoji/20260714-01/dict', file))).size
  })));
  return {
    runtimeBytes: runtime.size,
    dictionaryBytes: dictionaryStats.reduce((sum, item) => sum + item.bytes, 0),
    dictionaryFiles: dictionaryStats
  };
}

await mkdir(EVIDENCE_DIR, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(CUSTOM_CHROMIUM_EXECUTABLE ? { executablePath: CUSTOM_CHROMIUM_EXECUTABLE } : {})
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleMessages = [];
page.on('console', message => consoleMessages.push({ type: message.type(), text: message.text() }));
page.on('pageerror', error => consoleMessages.push({ type: 'pageerror', text: error.message }));

try {
  await page.goto(`${BASE_URL}/poc/kuromoji-worker-poc.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.KuromojiWorkerPoc?.createClient));

  const results = await page.evaluate(async input => {
    async function analyzeOnClient(client, text) {
      let lastTick = performance.now();
      let maxMainThreadGapMs = 0;
      const timer = setInterval(() => {
        const now = performance.now();
        maxMainThreadGapMs = Math.max(maxMainThreadGapMs, now - lastTick);
        lastTick = now;
      }, 10);
      try {
        const result = await client.analyze(text);
        return { ...result, maxMainThreadGapMs };
      } finally {
        clearInterval(timer);
      }
    }

    async function analyzeWithResponsiveness(text) {
      const client = KuromojiWorkerPoc.createClient({ workerUrl: '../vendor/kuromoji/20260714-01/kuromoji-tokenizer.worker.js' });
      try {
        return await analyzeOnClient(client, text);
      } finally {
        client.terminate();
      }
    }

    const persistentClient = KuromojiWorkerPoc.createClient({ workerUrl: '../vendor/kuromoji/20260714-01/kuromoji-tokenizer.worker.js' });
    const cold = await analyzeOnClient(persistentClient, input.complex);
    const hot = await analyzeOnClient(persistentClient, input.basic);
    persistentClient.terminate();
    const cached = await analyzeWithResponsiveness(input.complex);
    const basic = await analyzeWithResponsiveness(input.basic);
    const failedClient = KuromojiWorkerPoc.createClient({
      workerUrl: '../workers/missing-kuromoji-worker.js',
      timeoutMs: 1500
    });
    const fallback = await failedClient.analyzeWithFallback(
      input.basic,
      text => ({ usable: true, paragraphCount: text.split(/\n+/).filter(Boolean).length })
    );
    failedClient.terminate();

    function summarize(result) {
      const wordTokens = result.tokens.filter(token => /[\p{L}\p{N}]/u.test(token.surface));
      const kanjiTokens = wordTokens.filter(token => /[\p{Script=Han}]/u.test(token.surface));
      return {
        paragraphCount: result.paragraphs.length,
        tokenCount: result.tokens.length,
        wordTokenCount: wordTokens.length,
        readingCount: wordTokens.filter(token => Boolean(token.reading)).length,
        kanjiTokenCount: kanjiTokens.length,
        kanjiReadingCount: kanjiTokens.filter(token => Boolean(token.reading)).length,
        metrics: result.metrics,
        maxMainThreadGapMs: result.maxMainThreadGapMs,
        reconstructsParagraphs: result.paragraphs.every(paragraph =>
          paragraph.tokens.map(token => token.surface).join('') === paragraph.text),
        appTokenCompatible: result.appTokens.every(token =>
          typeof token.surface_form === 'string'
          && typeof token.basic_form === 'string'
          && Number.isInteger(token.paragraph_index))
      };
    }

    const selected = ['三菱', 'UFJ', 'フィナンシャル'].map(term => {
      const exact = cold.tokens.find(token => token.surface === term);
      const containing = cold.tokens.find(token => token.surface.includes(term) || term.includes(token.surface));
      const token = exact || containing;
      return { term, token: token?.surface || '', reading: token?.reading || '', found: Boolean(token) };
    });

    return {
      experimentEnabledByDefault: KuromojiWorkerPoc.enabled,
      cold: summarize(cold),
      hot: summarize(hot),
      cached: summarize(cached),
      basic: summarize(basic),
      selected,
      fallback
    };
  }, samples);

  const resources = await resourceMetrics();
  const report = {
    generatedAt: new Date().toISOString(),
    browser: await browser.version(),
    baseUrl: BASE_URL,
    samples,
    resources,
    results,
    consoleMessages
  };

  const selectedReadings = results.selected.filter(item => item.reading).length;
  const assertions = {
    experimentDisabledByDefault: results.experimentEnabledByDefault === false,
    threeParagraphsPreserved: results.cold.paragraphCount === 3 && results.basic.paragraphCount === 3,
    exactParagraphReconstruction: results.cold.reconstructsParagraphs && results.basic.reconstructsParagraphs,
    selectedReadingsImproved: selectedReadings >= 2,
    basicReadingsImproved: results.basic.readingCount > 9,
    appTokenCompatibility: results.cold.appTokenCompatible && results.basic.appTokenCompatible,
    mainThreadRemainsResponsive: Math.max(results.cold.maxMainThreadGapMs, results.cached.maxMainThreadGapMs, results.hot.maxMainThreadGapMs) < 500,
    failureFallsBack: results.fallback.ok === false
      && results.fallback.mode === 'fallback'
      && results.fallback.fallbackValue?.usable === true,
    noUnexpectedConsoleErrors: !consoleMessages.some(message =>
      message.type === 'pageerror' || (message.type === 'error' && !message.text.includes('missing-kuromoji-worker.js')))
  };
  report.assertions = assertions;
  report.status = Object.values(assertions).every(Boolean) ? 'PASS' : 'FAIL';

  await page.evaluate(summary => {
    document.getElementById('result').textContent = JSON.stringify(summary, null, 2);
  }, {
    status: report.status,
    cold: {
      initMs: round(results.cold.metrics.initMs),
      tokenizeMs: round(results.cold.metrics.tokenizeMs),
      roundTripMs: round(results.cold.metrics.roundTripMs),
      maxMainThreadGapMs: round(results.cold.maxMainThreadGapMs)
    },
    cached: {
      initMs: round(results.cached.metrics.initMs),
      tokenizeMs: round(results.cached.metrics.tokenizeMs),
      roundTripMs: round(results.cached.metrics.roundTripMs)
    },
    hot: {
      tokenizeMs: round(results.hot.metrics.tokenizeMs),
      roundTripMs: round(results.hot.metrics.roundTripMs),
      maxMainThreadGapMs: round(results.hot.maxMainThreadGapMs)
    },
    selected: results.selected,
    fallback: { mode: results.fallback.mode, usable: results.fallback.fallbackValue?.usable }
  });
  await page.screenshot({ path: resolve(EVIDENCE_DIR, 'chromium-kuromoji-worker-poc.png'), fullPage: true });
  await writeFile(resolve(EVIDENCE_DIR, 'chromium-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    status: report.status,
    assertions,
    selected: results.selected,
    cold: results.cold,
    hot: results.hot,
    cached: results.cached,
    basic: results.basic,
    fallback: { ok: results.fallback.ok, mode: results.fallback.mode },
    resources
  }, null, 2)}\n`);
  if (report.status !== 'PASS') process.exitCode = 1;
} finally {
  await browser.close();
}
