#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const START_PORT = Number(process.env.VOCAB_EXPORT_TEST_PORT || 5214);
const TEST_WORD = '輸出確認語';
const TEST_READING = 'ゆしゅつかくにんご';

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
  throw new Error('No local port available for vocabulary export test.');
}

async function downloadText(download) {
  const filePath = await download.path();
  assert.ok(filePath, 'download should have a local file path');
  return readFile(filePath, 'utf8');
}

const { chromium } = await import('playwright');
const { server, port } = await startServerWithFallback();
let browser;

try {
  browser = await chromium.launch({headless:true});
  const context = await browser.newContext({
    viewport:{width:1280, height:720},
    acceptDownloads:true
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  await page.route('https://fonts.googleapis.com/**', route=>route.abort());
  await page.route('https://fonts.gstatic.com/**', route=>route.abort());

  const url = `http://127.0.0.1:${port}/index.html`;
  await page.goto(url, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() =>
    typeof exportVocabCsvFile === 'function'
      && typeof exportAnkiTsv === 'function'
      && typeof normalizeVocabItem === 'function'
  );

  const backupBoundary = await page.evaluate(() => ({
    exportLearningBackup:typeof exportLearningBackup,
    importLearningBackup:typeof importLearningBackup
  }));
  assert.deepEqual(backupBoundary, {
    exportLearningBackup:'function',
    importLearningBackup:'function'
  });

  await page.evaluate(({word, reading}) => {
    vocabData = [normalizeVocabItem({
      word,
      reading,
      meaning:'导出"测试',
      meaningLanguage:'zh',
      meaningSource:'manual',
      pos:'名词',
      level:'N3',
      levelSource:'manual',
      sourceTitle:'测试来源',
      sourceUrl:'https://example.com/export',
      repetition:0,
      interval:0,
      dueAt:Date.now() - 60000,
      lastPracticeAt:null,
      lastPracticeRating:''
    })];
    renderVocab();
  }, {word:TEST_WORD, reading:TEST_READING});

  const csvDownloadPromise = page.waitForEvent('download');
  await page.evaluate(() => exportVocabCsvFile());
  const csvDownload = await csvDownloadPromise;
  assert.equal(csvDownload.suggestedFilename(), '读得懂_生词本导出.csv');
  const csv = await downloadText(csvDownload);
  assert.equal(csv.charCodeAt(0), 0xFEFF, 'CSV should start with a UTF-8 BOM');
  assert.ok(csv.startsWith('\uFEFF单词,假名,释义,释义语言,释义来源,词性,参考等级,等级来源,来源,来源链接,复习状态,下次复习时间（按复习结果自动安排）\n'));
  assert.ok(csv.includes(`"${TEST_WORD}","${TEST_READING}","导出""测试","zh","manual","名词","N3","manual","测试来源","https://example.com/export","没记住",`));

  await page.evaluate(() => {
    vocabData[0].meaning = '导出\t测试\n下一行';
  });
  const tsvDownloadPromise = page.waitForEvent('download');
  await page.evaluate(() => exportAnkiTsv());
  const tsvDownload = await tsvDownloadPromise;
  assert.match(tsvDownload.suggestedFilename(), /^dokedo-anki-\d{8}\.tsv$/);
  const tsv = await downloadText(tsvDownload);
  assert.ok(tsv.startsWith('# 正面\t假名\t释义\t释义语言\t释义来源\t词性\t参考等级\t等级来源\t来源\t来源链接\n'));
  assert.ok(tsv.includes(`${TEST_WORD}\t${TEST_READING}\t导出 测试<br>下一行\tzh\tmanual\t名词\tN3\tmanual\t测试来源\thttps://example.com/export`));

  const backupDownloadPromise = page.waitForEvent('download');
  await page.evaluate(() => exportLearningBackup());
  const backupDownload = await backupDownloadPromise;
  assert.match(backupDownload.suggestedFilename(), /^dokedo-backup-\d{8}\.json$/);
  const backupText = await downloadText(backupDownload);
  const backup = JSON.parse(backupText);
  assert.equal(backup.app, 'dokedo-japanese-reader');
  assert.equal(backup.version, 2);
  assert.ok(backup.vocab.some(item => item.word === TEST_WORD));

  await page.evaluate(async text => {
    vocabData = [];
    await saveVocab();
    const file = new File([text], 'dokedo-backup-test.json', {type:'application/json'});
    await importLearningBackup(file);
  }, backupText);
  await page.waitForFunction(word => vocabData.some(item => item.word === word), TEST_WORD);
  const restored = await page.evaluate(word => ({
    loaded:vocabData.find(item => item.word === word) || null,
    stored:JSON.parse(localStorage.getItem('reading_vocab_list') || '[]').find(item => item.word === word) || null
  }), TEST_WORD);
  assert.equal(restored.loaded?.level, 'N3');
  assert.equal(restored.stored?.sourceTitle, '测试来源');

  const emptyState = await page.evaluate(() => {
    vocabData = [];
    const status = document.getElementById('vocabExportStatusPage');
    if(status) status.textContent = '';
    exportVocabCsv();
    return {
      text:status?.textContent || '',
      className:status?.className || ''
    };
  });
  assert.equal(emptyState.text, '生词本是空的，先添加几个词再导出。');
  assert.match(emptyState.className, /\berror\b/);

  await page.evaluate(() => localStorage.removeItem('reading_vocab_list'));
  process.stdout.write('Vocabulary CSV and Anki TSV browser export tests passed.\n');
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
