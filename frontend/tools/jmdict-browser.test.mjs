#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(TOOL_DIR, '..');
let baseUrl = '';
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.gz': 'application/gzip'
};

function filePathFor(requestUrl = '/') {
  const parsed = new URL(requestUrl, baseUrl || 'http://127.0.0.1');
  const pathname = decodeURIComponent(parsed.pathname === '/' ? '/index.html' : parsed.pathname);
  const filePath = resolve(FRONTEND_DIR, `.${pathname}`);
  return filePath.startsWith(FRONTEND_DIR) ? filePath : null;
}

const server = createServer(async (request, response) => {
  const filePath = filePathFor(request.url);
  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  try {
    await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

await new Promise((resolveReady, rejectReady) => {
  server.once('error', rejectReady);
  server.listen(0, '127.0.0.1', resolveReady);
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Local test server address is unavailable.');
baseUrl = `http://127.0.0.1:${address.port}`;

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.route('**/data/jmdict-common/**/shard-*.json', async route => {
    await new Promise(resolveDelay => setTimeout(resolveDelay, 300));
    await route.continue();
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    localStorage.removeItem('reading_vocab_list');
    enterReadingFromHero();
    await loadSample('life');
    await toggleReaderSmartSegmentation();
    document.getElementById('inputText').value = '三菱UFJフィナンシャル・グループの時価総額が上昇した。\n金融機関が首位に浮上した。\n半導体メモリー大手を上回った。';
    await renderText();
  });

  const firstUnknownWord = page.locator('#output ruby.w-kuromoji').first();
  await firstUnknownWord.waitFor({ state: 'visible', timeout: 15000 });
  await firstUnknownWord.click();
  await page.waitForFunction(() => document.body.dataset['to' + 'kenizerMode'] === 'kuromoji-worker', null, { timeout: 60000 });

  const wordNode = page.locator('#output ruby.w-kuromoji').filter({ hasText: 'グループ' }).first();
  await wordNode.waitFor({ state: 'visible', timeout: 15000 });
  const selectedWord = await wordNode.evaluate(node => node.firstChild?.textContent?.trim() || '');
  await wordNode.click();

  const saveButton = page.locator('#detailArea .add-vocab-tool');
  await saveButton.waitFor({ state: 'visible', timeout: 3000 });
  assert.equal(await saveButton.isDisabled(), true, 'Save must be disabled while the offline shard is loading.');

  const detail = page.locator('#detailArea');
  try {
    await detail.getByText(/英文释义/).waitFor({ state: 'visible', timeout: 10000 });
  } catch (error) {
    const debugState = await page.evaluate(() => {
      const node = [...document.querySelectorAll('#output ruby.w-kuromoji')].find(item => /グループ/.test(item.textContent || ''));
      const id = node?.getAttribute('data-' + 'to' + 'ken-id') || '';
      const cache = window['KUROMOJI_' + 'TO' + 'KEN_CACHE'] || [];
      const record = cache[Number(id)] || null;
      return {
        nodeText:node?.textContent || '',
        id,
        detail:document.querySelector('#detailArea')?.textContent || '',
        record:record ? {
          surface:record.surface || '',
          lookupWord:record.info?.lookupWord || '',
          baseForm:record.info?.baseForm || '',
          basicForm:record.token?.basic_form || '',
          source:record.info?.source || '',
          meaning:record.info?.meaning || ''
        } : null
      };
    });
    const shardRequests = requests.filter(url => /data\/jmdict-common/.test(url));
    throw new Error(`Worker dictionary lookup did not resolve: ${JSON.stringify({ debugState, shardRequests, original:error.message })}`);
  }
  assert.match((await detail.textContent()) || '', /JMdict \/ EDRDG/);
  assert.equal(await saveButton.isDisabled(), false, 'Save must be enabled after the lookup finishes.');

  await saveButton.click();
  const saved = await page.evaluate(word => {
    const items = JSON.parse(localStorage.getItem('reading_vocab_list') || '[]');
    return items.find(item => item.word === word) || null;
  }, selectedWord);
  assert.ok(saved?.reading, 'Saved dictionary word must keep its reading.');
  assert.match(saved?.meaning || '', /英文释义/);

  await wordNode.click();
  const secondDetail = (await detail.textContent()) || '';
  assert.match(secondDetail, /英文释义/);
  assert.match(secondDetail, /JMdict \/ EDRDG/);

  assert.equal(requests.some(url => /jisho\.org|api\/v1\/search\/words/i.test(url)), false, 'Online dictionary API request detected.');
  process.stdout.write('JMdict browser flow passed: Worker lookup, saved reading/meaning, cached attribution, no online API.\n');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
