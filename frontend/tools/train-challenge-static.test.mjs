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
  assert.ok(station.romaji.length >= 4);
});
assert.equal((html.match(/data-challenge-view=/g) || []).length, 3);
assert.match(html, /不是铁路运营机构官方产品/);
assert.match(js, /yomeru_train_typing_v1/);
assert.match(js, /compositionstart/);
assert.match(js, /compositionend/);
assert.match(js, /event\.isComposing/);
assert.match(readme, /不做编辑距离、同音字或宽松模糊匹配/);
assert.match(css, /@media\(max-width:600px\)/);
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

const { chromium } = await import('playwright');
const { server, port } = await availableServer();
let browser;
try {
  browser = await chromium.launch({headless:true});
  for (const viewport of [{name:'mobile-390',width:390,height:844},{name:'mobile-430',width:430,height:932},{name:'desktop-1280',width:1280,height:900}]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/challenge/train/index.html`, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.YOMERU_TRAIN_PROTOTYPE?.route()?.stations?.length === 13);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, `${viewport.name} start overflow`);
    await page.locator('.prototype-nav [data-demo-state="play"]').click();
    await page.waitForFunction(() => document.body.dataset.prototypeState === 'play');
    assert.equal(await page.evaluate(() => document.activeElement?.id === 'trainAnswerInput'), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, `${viewport.name} play overflow`);
    await page.locator('.prototype-nav [data-demo-state="result"]').click();
    await page.waitForFunction(() => document.body.dataset.prototypeState === 'result');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, `${viewport.name} result overflow`);
    await context.close();
  }
  process.stdout.write('Train challenge static route, state, IME, and responsive baselines passed.\n');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
