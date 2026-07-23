#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, readFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const TRAIN_DIR = resolve(FRONTEND_DIR, 'challenge/train');
const route = JSON.parse(readFileSync(resolve(TRAIN_DIR, 'routes/yamanote-short.json'), 'utf8'));
const html = readFileSync(resolve(TRAIN_DIR, 'index.html'), 'utf8');
const css = readFileSync(resolve(TRAIN_DIR, 'train-challenge.css'), 'utf8');
const js = readFileSync(resolve(TRAIN_DIR, 'train-challenge.js'), 'utf8');
const readme = readFileSync(resolve(TRAIN_DIR, 'README.md'), 'utf8');
const expected = ['新宿','新大久保','高田馬場','目白','池袋','大塚','巣鴨','駒込','田端','西日暮里','日暮里','鶯谷','上野'];

assert.equal(route.schemaVersion, 1);
assert.equal(route.stations.length, 13);
assert.deepEqual(route.stations.map(item => item.display), expected);
assert.equal(new Set(route.stations.map(item => item.id)).size, 13);
route.stations.forEach((station, index) => {
  assert.equal(station.order, index + 1);
  assert.match(station.reading, /^[ぁ-ゖー]+$/);
  assert.ok(station.acceptedKana.includes(station.reading));
  assert.ok(station.acceptedKanji.includes(station.display));
});
assert.equal((html.match(/data-challenge-view=/g) || []).length, 3);
assert.match(html, /id="trainStartButton"/);
assert.match(html, /id="resultCpm"/);
assert.match(html, /不是铁路运营机构官方产品/);
assert.match(js, /yomeru_train_typing_v1/);
assert.match(js, /compositionstart/);
assert.match(js, /event\.isComposing/);
assert.match(js, /recentResults.*slice\(0, 5\)/s);
assert.match(js, /Number\.NEGATIVE_INFINITY/);
assert.match(readme, /最后一站只能触发一次结算/);
assert.match(css, /prefers-reduced-motion/);

const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
function pathFor(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname);
  const filePath = resolve(FRONTEND_DIR, `.${pathname === '/' ? '/challenge/train/index.html' : pathname}`);
  return filePath.startsWith(FRONTEND_DIR) ? filePath : null;
}
function startServer(port) {
  const server = createServer(async (request, response) => {
    const filePath = pathFor(request.url || '/');
    if (!filePath) return response.writeHead(403).end('Forbidden');
    try {
      await access(filePath);
      response.writeHead(200, {'Content-Type':mime[extname(filePath)] || 'application/octet-stream','Cache-Control':'no-store'});
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolveServer, rejectServer) => {
    server.once('error', rejectServer);
    server.listen(port, '127.0.0.1', () => { server.off('error', rejectServer); resolveServer(server); });
  });
}
async function availableServer() {
  for (let port = 5228; port < 5248; port += 1) {
    try { return {server:await startServer(port), port}; } catch (error) { if (error?.code !== 'EADDRINUSE') throw error; }
  }
  throw new Error('No local port available.');
}

async function hasOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

async function submit(page, value) {
  await page.locator('#trainAnswerInput').fill(value);
  await page.keyboard.press('Enter');
}

const { chromium } = await import('playwright');
const { server, port } = await availableServer();
let browser;
try {
  browser = await chromium.launch({headless:true});
  const appUrl = `http://127.0.0.1:${port}/challenge/train/index.html`;

  // Full kana-mode completion on the narrowest supported viewport.
  {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript(() => {
      localStorage.setItem('yomeru_train_typing_v1', '{damaged-json');
      localStorage.setItem('reading_vocab_list', 'vocab-sentinel');
      localStorage.setItem('reading_history', 'history-sentinel');
    });
    const page = await context.newPage();
    await page.goto(appUrl, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE?.route()?.stations?.length === 13);
    assert.equal(await page.locator('#trainStartButton').isEnabled(), true);
    assert.equal(await hasOverflow(page), false, 'mobile-390 start view overflows');
    assert.equal(await page.evaluate(() => document.getElementById('trainStartButton').getBoundingClientRect().bottom <= innerHeight), true, 'departure button is below first viewport');
    assert.equal((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).elapsedMs, 0);
    await page.waitForTimeout(150);
    assert.equal((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).elapsedMs, 0, 'timer started before departure');

    await page.locator('#trainStartButton').click();
    await page.waitForFunction(() => document.body.dataset.gameState === 'play');
    assert.equal(await page.evaluate(() => document.activeElement?.id === 'trainAnswerInput'), true);
    await page.waitForTimeout(180);
    assert.ok((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).elapsedMs >= 100);

    // IME composition Enter is ignored.
    await page.locator('#trainAnswerInput').fill(route.stations[0].reading);
    await page.locator('#trainAnswerInput').dispatchEvent('compositionstart');
    await page.evaluate(() => {
      document.getElementById('trainAnswerInput').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, isComposing:true}));
    });
    assert.equal((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).index, 0);
    assert.equal((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).correctSubmissions, 0);
    await page.locator('#trainAnswerInput').dispatchEvent('compositionend');

    // Wrong answers remain editable and do not advance.
    await page.locator('#trainAnswerInput').fill('まちがい');
    await page.keyboard.press('Enter');
    let state = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
    assert.equal(state.index, 0);
    assert.equal(state.wrongSubmissions, 1);
    assert.equal(await page.locator('#trainAnswerInput').inputValue(), 'まちがい');
    await page.waitForTimeout(140);

    // Two rapid Enter events on a correct answer advance only once.
    await page.locator('#trainAnswerInput').fill(route.stations[0].reading);
    await page.evaluate(() => {
      const input = document.getElementById('trainAnswerInput');
      input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
    });
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE.snapshot().index === 1);
    state = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
    assert.equal(state.correctSubmissions, 1);
    assert.equal(state.wrongSubmissions, 1);

    for (let index = 1; index < route.stations.length; index += 1) {
      await submit(page, route.stations[index].reading);
      if (index === route.stations.length - 1) {
        await page.waitForFunction(() => document.body.dataset.gameState === 'result');
      } else {
        await page.waitForFunction(expectedIndex => window.YOMERU_TRAIN_CHALLENGE.snapshot().index === expectedIndex, index + 1);
      }
    }

    state = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
    assert.equal(state.phase, 'result');
    assert.equal(state.finished, true);
    assert.equal(state.correctSubmissions, 13);
    assert.equal(state.wrongSubmissions, 1);
    assert.equal(state.stationTimes.length, 13);
    assert.equal(state.bestStreak, 13);
    assert.ok(state.result.elapsedMs > 0);
    assert.equal(Math.round(state.result.accuracy * 100), 93);
    assert.equal(await hasOverflow(page), false, 'mobile-390 result view overflows');

    const stored = await page.evaluate(() => ({
      train: JSON.parse(localStorage.getItem('yomeru_train_typing_v1')),
      vocab: localStorage.getItem('reading_vocab_list'),
      history: localStorage.getItem('reading_history')
    }));
    assert.equal(stored.train.schemaVersion, 1);
    assert.equal(stored.train.totalChallenges, 1);
    assert.equal(stored.train.recentResults.length, 1);
    assert.ok(stored.train.bestByMode['kanji-to-kana']);
    assert.equal(stored.vocab, 'vocab-sentinel');
    assert.equal(stored.history, 'history-sentinel');

    await page.locator('#trainRetryButton').click();
    await page.waitForFunction(() => document.body.dataset.gameState === 'start');
    assert.equal(await page.locator('#totalChallengeCount').textContent(), '1 次');
    await context.close();
  }

  // Kanji-mode strict matching and full-width-space normalization.
  {
    const context = await browser.newContext({viewport:{width:430,height:932}});
    const page = await context.newPage();
    await page.goto(appUrl, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE?.route()?.stations?.length === 13);
    await page.locator('input[value="kana-to-kanji"]').check();
    await page.locator('#trainStartButton').click();
    await page.waitForFunction(() => document.body.dataset.gameState === 'play');
    assert.equal(await page.locator('#questionPrompt').textContent(), 'しんじゅく');
    await submit(page, '新　宿');
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE.snapshot().index === 1);
    await submit(page, 'シンオオクボ');
    const state = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
    assert.equal(state.index, 1);
    assert.equal(state.wrongSubmissions, 1, 'katakana was accepted by strict kanji mode');
    assert.equal(await hasOverflow(page), false, 'mobile-430 play view overflows');
    await context.close();
  }

  // Desktop baseline.
  {
    const context = await browser.newContext({viewport:{width:1280,height:900}});
    const page = await context.newPage();
    await page.goto(appUrl, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE?.route()?.stations?.length === 13);
    assert.equal(await hasOverflow(page), false, 'desktop start view overflows');
    await page.locator('#trainStartButton').click();
    await page.waitForFunction(() => document.body.dataset.gameState === 'play');
    assert.equal(await hasOverflow(page), false, 'desktop play view overflows');
    await context.close();
  }

  process.stdout.write('Train challenge A2 game, IME, scoring, persistence, and responsive tests passed.\n');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
