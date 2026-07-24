#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const TRAIN_DIR = resolve(FRONTEND_DIR, 'challenge/train');
const registry = JSON.parse(readFileSync(resolve(TRAIN_DIR, 'routes/index.json'), 'utf8'));
const routes = registry.routes.map(entry => ({
  entry,
  data: JSON.parse(readFileSync(resolve(FRONTEND_DIR, `.${entry.path}`), 'utf8'))
}));
const hubHtml = readFileSync(resolve(TRAIN_DIR, 'index.html'), 'utf8');
const playHtml = readFileSync(resolve(TRAIN_DIR, 'play/index.html'), 'utf8');
const sharedJs = readFileSync(resolve(TRAIN_DIR, 'train-shared.js'), 'utf8');
const challengeJs = readFileSync(resolve(TRAIN_DIR, 'train-challenge.js'), 'utf8');

assert.equal(registry.schemaVersion, 1);
assert.equal(registry.routes.length, 3);
assert.equal(new Set(registry.routes.map(route => route.routeId)).size, 3);
assert.equal(registry.defaultRouteId, 'yamanote-north-short');
assert.match(hubHtml, /id="routeGrid"/);
assert.match(hubHtml, /train-shared\.js/);
assert.match(hubHtml, /train-hub\.js/);
assert.match(playHtml, /data-challenge-view="error"/);
assert.match(playHtml, /href="\/challenge\/train">选择其他路线/);
assert.match(sharedJs, /yomeru_train_typing_v2/);
assert.match(sharedJs, /yomeru_train_typing_v1/);
assert.match(sharedJs, /migrateLegacyStorage/);
assert.match(challengeJs, /routeStorageIsolation/);
assert.match(challengeJs, /event\.isComposing/);
assert.doesNotMatch(challengeJs, /reading_vocab_list/);

for (const { entry, data } of routes) {
  assert.equal(data.schemaVersion, 2);
  assert.equal(data.routeId, entry.routeId);
  assert.equal(data.stations.length, entry.stationCount);
  assert.ok(data.stations.length >= 8 && data.stations.length <= 15);
  assert.ok(data.source?.url?.startsWith('https://'));
  data.stations.forEach((station, index) => {
    assert.equal(station.order, index + 1);
    assert.match(station.reading, /^[ぁ-ゖー]+$/);
    assert.ok(station.acceptedKana.includes(station.reading));
    assert.ok(station.acceptedKanji.includes(station.display));
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function pathFor(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname);
  let normalized = pathname;
  if (pathname === '/') normalized = '/index.html';
  if (pathname === '/challenge/train' || pathname === '/challenge/train/') normalized = '/challenge/train/index.html';
  if (pathname === '/challenge/train/play' || pathname === '/challenge/train/play/') normalized = '/challenge/train/play/index.html';
  const filePath = resolve(FRONTEND_DIR, `.${normalized}`);
  return filePath.startsWith(FRONTEND_DIR) ? filePath : null;
}

function startServer(port) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    if (pathname === '/favicon.ico') return response.writeHead(204).end();
    const filePath = pathFor(request.url || '/');
    if (!filePath) return response.writeHead(403).end('Forbidden');
    try {
      await access(filePath);
      response.writeHead(200, {
        'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolveServer, rejectServer) => {
    server.once('error', rejectServer);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', rejectServer);
      resolveServer(server);
    });
  });
}

async function availableServer() {
  for (let port = 5228; port < 5260; port += 1) {
    try {
      return { server: await startServer(port), port };
    } catch (error) {
      if (error?.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error('No local port available.');
}

async function hasOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

async function submit(page, value) {
  await page.locator('#trainAnswerInput').fill(value);
  await page.locator('#trainAnswerSubmitButton').click();
}

async function completeRoute(page, route, mode) {
  for (let index = 0; index < route.stations.length; index += 1) {
    const station = route.stations[index];
    const answer = mode === 'kana-to-kanji' ? station.display : station.reading;
    await submit(page, answer);
    if (index === route.stations.length - 1) {
      await page.waitForFunction(() => document.body.dataset.gameState === 'result');
    } else {
      await page.waitForFunction(expected => window.YOMERU_TRAIN_CHALLENGE.snapshot().index === expected, index + 1);
    }
  }
}

const { chromium } = await import('playwright');
const { server, port } = await availableServer();
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const origin = `http://127.0.0.1:${port}`;

  // Hub renders all routes and migrates the legacy single-route score.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('yomeru_train_typing_v1', JSON.stringify({
        schemaVersion: 1,
        bestByMode: {
          'kanji-to-kana': {
            schemaVersion: 1,
            mode: 'kanji-to-kana',
            elapsedMs: 65432,
            accuracy: 1,
            hintCount: 0
          }
        },
        recentResults: [],
        totalChallenges: 2,
        lastMode: 'kanji-to-kana',
        lastShowHints: false
      }));
      localStorage.setItem('reading_vocab_list', 'vocab-sentinel');
    });
    const page = await context.newPage();
    await page.goto(`${origin}/challenge/train`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.dataset.routeHubReady === 'true');
    assert.equal(await page.locator('.route-card').count(), 3);
    assert.equal(await page.locator('.route-card[data-route-id="yamanote-north-short"]').count(), 1);
    assert.equal(await page.locator('.route-card[data-route-id="yamanote-east-short"]').count(), 1);
    assert.equal(await page.locator('.route-card[data-route-id="ginza-east-short"]').count(), 1);
    assert.equal(await page.locator('#routeCount').textContent(), '3');
    assert.equal(await page.locator('#totalChallenges').textContent(), '2');
    assert.equal(await page.locator('#completedRoutes').textContent(), '1 / 3');
    assert.match(await page.locator('.route-card[data-route-id="yamanote-north-short"]').textContent(), /01:05\.4/);
    assert.equal(await hasOverflow(page), false, 'desktop route hub overflows');
    const migrated = await page.evaluate(() => ({
      current: JSON.parse(localStorage.getItem('yomeru_train_typing_v2') || 'null'),
      vocab: localStorage.getItem('reading_vocab_list')
    }));
    assert.equal(migrated.current.schemaVersion, 2);
    assert.equal(migrated.current.migratedFromV1, true);
    assert.equal(migrated.current.routes['yamanote-north-short'].totalChallenges, 2);
    assert.equal(migrated.vocab, 'vocab-sentinel');
    await context.close();
  }

  // Invalid route has a safe, navigable error state.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${origin}/challenge/train/play?route=missing-route`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.dataset.gameState === 'error');
    assert.equal(await page.locator('[data-challenge-view="error"]').isVisible(), true);
    assert.match(await page.locator('#routeErrorMessage').textContent(), /missing-route/);
    assert.equal(await hasOverflow(page), false, 'invalid route view overflows');
    await context.close();
  }

  // Every route completes both modes and stores results in its own namespace.
  {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await context.addInitScript(() => {
      localStorage.setItem('reading_vocab_list', 'vocab-sentinel');
      localStorage.setItem('reading_history', 'history-sentinel');
    });
    const page = await context.newPage();

    for (const { entry, data: route } of routes) {
      for (const mode of ['kanji-to-kana', 'kana-to-kanji']) {
        await page.goto(`${origin}/challenge/train/play?route=${entry.routeId}`, { waitUntil: 'networkidle' });
        await page.waitForFunction(routeId => window.YOMERU_TRAIN_CHALLENGE?.route()?.routeId === routeId, entry.routeId);
        assert.equal(await page.locator('#startRouteMap .route-loop-station').count(), route.stations.length);
        assert.match(await page.locator('#routeChip').textContent(), new RegExp(route.titleZh.replace(' → ', '.*')));
        assert.equal(await hasOverflow(page), false, `${entry.routeId} start view overflows`);
        if (mode === 'kana-to-kanji') await page.locator('input[value="kana-to-kanji"]').check();
        await page.locator('#trainStartButton').click();
        await page.waitForFunction(() => document.body.dataset.gameState === 'play');
        await page.waitForFunction(() => document.activeElement?.id === 'trainAnswerInput');
        assert.equal(await page.locator('.rail-stop').count(), route.stations.length);
        assert.equal(await page.evaluate(() => document.activeElement?.id === 'trainAnswerInput'), true);
        assert.equal(await page.locator('#progressValue').textContent(), `01 / ${String(route.stations.length).padStart(2, '0')}`);

        if (entry.routeId === registry.defaultRouteId && mode === 'kanji-to-kana') {
          await page.locator('#trainAnswerInput').fill(route.stations[0].reading);
          await page.locator('#trainAnswerInput').dispatchEvent('compositionstart');
          await page.evaluate(() => {
            document.getElementById('trainAnswerInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
          });
          assert.equal((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).index, 0);
          await page.locator('#trainAnswerInput').dispatchEvent('compositionend');
          await page.locator('#trainAnswerInput').fill('まちがい');
          await page.keyboard.press('Enter');
          assert.equal((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).wrongSubmissions, 1);
          await page.waitForTimeout(140);
        }

        await completeRoute(page, route, mode);
        const state = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
        assert.equal(state.finished, true);
        assert.equal(state.routeId, route.routeId);
        assert.equal(state.result.routeId, route.routeId);
        assert.equal(state.result.stationCount, route.stations.length);
        assert.equal(state.correctSubmissions, route.stations.length);
        assert.equal(state.stationTimes.length, route.stations.length);
        assert.equal(await page.locator('#resultStartStation').textContent(), route.stations[0].display);
        assert.equal(await page.locator('#resultEndStation').textContent(), route.stations.at(-1).display);
        assert.equal(await hasOverflow(page), false, `${entry.routeId} result view overflows`);
      }
    }

    const stored = await page.evaluate(() => ({
      train: JSON.parse(localStorage.getItem('yomeru_train_typing_v2') || 'null'),
      vocab: localStorage.getItem('reading_vocab_list'),
      history: localStorage.getItem('reading_history')
    }));
    assert.equal(stored.train.schemaVersion, 2);
    assert.equal(Object.keys(stored.train.routes).length, 3);
    for (const { entry } of routes) {
      assert.equal(stored.train.routes[entry.routeId].totalChallenges, 2);
      assert.ok(stored.train.routes[entry.routeId].bestByMode['kanji-to-kana']);
      assert.ok(stored.train.routes[entry.routeId].bestByMode['kana-to-kanji']);
    }
    assert.equal(stored.vocab, 'vocab-sentinel');
    assert.equal(stored.history, 'history-sentinel');

    // Result card and share URL preserve the selected route.
    await page.goto(`${origin}/challenge/train/play?route=ginza-east-short`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE?.route()?.routeId === 'ginza-east-short');
    await page.locator('input[value="kanji-to-kana"]').check();
    await page.locator('#trainStartButton').click();
    await completeRoute(page, routes.find(item => item.entry.routeId === 'ginza-east-short').data, 'kanji-to-kana');
    const cardInfo = await page.evaluate(async () => {
      const blob = await window.YOMERU_TRAIN_CHALLENGE.createResultCardBlob();
      return { type: blob.type, size: blob.size };
    });
    assert.equal(cardInfo.type, 'image/png');
    assert.ok(cardInfo.size > 10000);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#saveResultCardButton').click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^yomeru-train-ginza-east-short-kanji-kana-\d{8}\.png$/);
    const downloadedPath = await download.path();
    assert.ok(downloadedPath && statSync(downloadedPath).size > 10000);
    await page.evaluate(() => {
      window.__sharePayload = null;
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: payload => Boolean(payload?.files?.length) });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async payload => { window.__sharePayload = { text: payload.text, url: payload.url, files: payload.files?.length || 0 }; }
      });
    });
    await page.locator('#shareResultButton').click();
    await page.waitForFunction(() => Boolean(window.__sharePayload));
    const shared = await page.evaluate(() => window.__sharePayload);
    assert.equal(shared.files, 1);
    assert.match(shared.text, /浅草到银座/);
    assert.equal(shared.url, `${origin}/challenge/train/play?route=ginza-east-short`);
    await context.close();
  }

  process.stdout.write('Train route hub, three-route engine, storage migration, result-card, sharing, IME, and responsive tests passed.\n');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
