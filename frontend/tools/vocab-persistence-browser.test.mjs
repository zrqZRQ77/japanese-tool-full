#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const START_PORT = Number(process.env.VOCAB_PERSISTENCE_TEST_PORT || 5194);
const TEST_WORD = '持続確認語';
const TEST_READING = 'じぞくかくにんご';

const MIME_TYPES = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.txt':'text/plain; charset=utf-8',
  '.gz':'application/gzip'
};

function safePathFromUrl(url) {
  const parsed = new URL(url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(parsed.pathname);
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = resolve(FRONTEND_DIR, `.${cleanPath}`);
  return fullPath.startsWith(FRONTEND_DIR) ? fullPath : null;
}

function startServer(port) {
  const server = createServer(async (request, response) => {
    const filePath = safePathFromUrl(request.url || '/');
    if (!filePath) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    try {
      await access(filePath);
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
        'Cache-Control':'no-store'
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      response.end('Not found');
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

async function startServerWithFallback() {
  for (let port = START_PORT; port < START_PORT + 20; port += 1) {
    try {
      return {server:await startServer(port), port};
    } catch (error) {
      if (error?.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error('No local port available for vocabulary persistence test.');
}

const { chromium } = await import('playwright');
const { server, port } = await startServerWithFallback();
let browser;

try {
  browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:1280, height:720}});
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  await page.route('https://fonts.googleapis.com/**', route=>route.abort());
  await page.route('https://fonts.gstatic.com/**', route=>route.abort());

  const url = `http://127.0.0.1:${port}/index.html`;
  await page.goto(url, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof addCustomToVocab === 'function' && typeof switchWorkspace === 'function');
  await page.evaluate(() => localStorage.removeItem('reading_vocab_list'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof addCustomToVocab === 'function' && typeof switchWorkspace === 'function');

  const saved = await page.evaluate(({word, reading}) => addCustomToVocab(
    word,
    reading,
    '持久化验证',
    'N3',
    '名词',
    {baseForm:word, baseReading:reading, partOfSpeech:'名词'}
  ), {word:TEST_WORD, reading:TEST_READING});
  assert.equal(saved, true, 'the vocabulary item should be saved before reload');

  await page.waitForFunction(word => {
    const items = JSON.parse(localStorage.getItem('reading_vocab_list') || '[]');
    return items.some(item => item.word === word);
  }, TEST_WORD);

  const beforeReload = await page.evaluate(word => {
    const items = JSON.parse(localStorage.getItem('reading_vocab_list') || '[]');
    return items.find(item => item.word === word) || null;
  }, TEST_WORD);
  assert.equal(beforeReload?.reading, TEST_READING);
  assert.equal(beforeReload?.baseForm, TEST_WORD);
  assert.equal(beforeReload?.baseReading, TEST_READING);
  assert.equal(beforeReload?.partOfSpeech, '名词');

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(word => {
    const items = JSON.parse(localStorage.getItem('reading_vocab_list') || '[]');
    return items.some(item => item.word === word);
  }, TEST_WORD);
  await page.waitForFunction(word => typeof vocabData !== 'undefined' && vocabData.some(item => item.word === word), TEST_WORD);
  await page.evaluate(() => switchWorkspace('vocab'));
  await page.waitForFunction(word => document.getElementById('vocabListPage')?.textContent?.includes(word), TEST_WORD);

  const afterReload = await page.evaluate(word => {
    const stored = JSON.parse(localStorage.getItem('reading_vocab_list') || '[]').find(item => item.word === word) || null;
    const loaded = typeof vocabData !== 'undefined' ? vocabData.find(item => item.word === word) || null : null;
    const rendered = document.getElementById('vocabListPage')?.textContent?.includes(word) || false;
    return {stored, loaded, rendered};
  }, TEST_WORD);

  assert.equal(afterReload.rendered, true);
  assert.equal(afterReload.loaded?.reading, TEST_READING);
  assert.equal(afterReload.loaded?.baseForm, TEST_WORD);
  assert.equal(afterReload.stored?.lexicalSchemaVersion, 1);

  await page.evaluate(() => localStorage.removeItem('reading_vocab_list'));
  await context.close();
  process.stdout.write('Vocabulary save and reload persistence browser test passed.\n');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
