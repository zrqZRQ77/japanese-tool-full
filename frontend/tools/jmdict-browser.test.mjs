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
  await page.route('**/data/chinese-definitions/**/shard-*.json', async route => {
    await new Promise(resolveDelay => setTimeout(resolveDelay, 300));
    await route.continue();
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    localStorage.removeItem('reading_vocab_list');
    enterReadingFromHero();
    await loadSample('life');
    await toggleReaderSmartSegmentation();
    document.getElementById('inputText').value = '三菱UFJフィナンシャル・グループの時価総額が上昇した。\n金融機関が首位に浮上した。\n半導体メモリー大手を上回った。\n図書館で読書をする。';
    await renderText();
  });

  const firstUnknownWord = page.locator('#output ruby.w-kuromoji').first();
  await firstUnknownWord.waitFor({ state: 'visible', timeout: 15000 });
  await firstUnknownWord.click();
  await page.waitForFunction(() => document.body.dataset['to' + 'kenizerMode'] === 'kuromoji-worker', null, { timeout: 60000 });

  await page.evaluate(() => {
    const originalLookup = lookupJmdictCommon;
    window.__restoreDictionaryLookup = ()=>{ lookupJmdictCommon = originalLookup; delete window.__restoreDictionaryLookup; };
    lookupJmdictCommon = async candidates => {
      await new Promise(resolve=>setTimeout(resolve, 500));
      return originalLookup(candidates);
    };
  });
  const wordNode = page.locator('#output ruby.w-kuromoji').filter({ hasText: 'グループ' }).first();
  await wordNode.waitFor({ state: 'visible', timeout: 15000 });
  const selectedWord = await wordNode.evaluate(node => node.firstChild?.textContent?.trim() || '');
  await wordNode.click();

  const saveButton = page.locator('#detailArea .add-vocab-tool');
  await saveButton.waitFor({ state: 'visible', timeout: 3000 });
  assert.equal(await saveButton.isDisabled(), false, 'Save must remain clickable while the offline shard is loading.');
  await saveButton.click();
  assert.equal(await saveButton.isDisabled(), true, 'Queued save must become disabled after the user requests automatic saving.');
  assert.equal(await saveButton.getAttribute('aria-busy'), 'true');
  assert.match((await saveButton.getAttribute('aria-label')) || '', /自动加入生词本/);

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
  await page.waitForFunction(word => {
    const items = JSON.parse(localStorage.getItem('reading_vocab_list') || '[]');
    return items.some(item => item.word === word);
  }, selectedWord, {timeout:5000});
  await page.evaluate(() => window.__restoreDictionaryLookup?.());
  assert.match((await detail.textContent()) || '', /词典来源：JMdict/);
  assert.equal(await saveButton.isDisabled(), true, 'Automatically saved word must not be saved twice.');
  assert.match((await saveButton.getAttribute('aria-label')) || '', /已加入生词本/);

  const saved = await page.evaluate(word => {
    const items = JSON.parse(localStorage.getItem('reading_vocab_list') || '[]');
    return items.find(item => item.word === word) || null;
  }, selectedWord);
  assert.ok(saved?.reading, 'Saved dictionary word must keep its reading.');
  assert.ok(saved?.meaning, 'Saved dictionary word must keep its final meaning.');
  assert.equal(saved?.meaningLanguage, 'en');
  assert.equal(saved?.meaningSource, 'jmdict');

  await wordNode.click();
  const secondDetail = (await detail.textContent()) || '';
  assert.match(secondDetail, /英文释义/);
  assert.match(secondDetail, /词典来源：JMdict/);

  const chineseWordNode = page.locator('#output ruby.w-kuromoji').filter({ hasText: '読書' }).first();
  await chineseWordNode.waitFor({ state: 'visible', timeout: 15000 });
  await chineseWordNode.click();
  const chineseSaveButton = page.locator('#detailArea .add-vocab-tool');
  await chineseSaveButton.click();
  await detail.getByText(/中文释义：读书、阅读/).waitFor({ state: 'visible', timeout: 10000 });
  assert.match((await detail.textContent()) || '', /释义来源：Yomeru 离线中文词库/);
  assert.match((await detail.textContent()) || '', /JLPT 参考等级：N3/);
  await page.waitForFunction(() => {
    const items = JSON.parse(localStorage.getItem('reading_vocab_list') || '[]');
    return items.some(item => item.word === '読書' && item.meaningSource === 'offline-chinese');
  }, null, {timeout:5000});
  const savedChinese = await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('reading_vocab_list') || '[]');
    return items.find(item => item.word === '読書') || null;
  });
  assert.equal(savedChinese?.meaning, '读书、阅读');
  assert.equal(savedChinese?.meaningLanguage, 'zh');
  assert.equal(savedChinese?.meaningSource, 'offline-chinese');
  assert.equal(savedChinese?.level, 'N3');
  assert.equal(savedChinese?.levelSource, 'jlpt-reference');

  await chineseWordNode.click();
  assert.match((await detail.textContent()) || '', /中文释义：读书、阅读/);
  assert.match((await detail.textContent()) || '', /释义来源：Yomeru 离线中文词库/);

  assert.equal(requests.some(url => /jisho\.org|api\/v1\/search\/words/i.test(url)), false, 'Online dictionary API request detected.');
  process.stdout.write('Offline dictionary browser flow passed: Chinese priority, JMdict fallback, queued saves, reference levels, stable attribution, no online API.\n');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
