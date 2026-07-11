#!/usr/bin/env node

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'stage4-fixtures');
const OUT = join(ROOT, 'stage4-results', new Date().toISOString().replace(/[:.]/g, '-'));
const SAMPLE = '私は毎朝七時に起きます。図書館で日本語を勉強します。';
const results = [];

const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml' };
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
  const file = resolve(ROOT, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  createReadStream(file).on('error', () => res.writeHead(404).end()).once('open', () => res.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' })).pipe(res);
});
await new Promise((ok, fail) => server.once('error', fail).listen(5194, '127.0.0.1', ok));
await mkdir(OUT, { recursive:true });

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ acceptDownloads:true, viewport:{ width:1280, height:800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

async function open(clean = true) {
  await page.goto('http://127.0.0.1:5194/index.html', { waitUntil:'domcontentloaded' });
  if (clean) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil:'domcontentloaded' });
  }
  await page.waitForLoadState('networkidle', { timeout:8000 }).catch(() => {});
}

async function test(name, fn) {
  try { const detail = await fn(); results.push({ name, status:'PASS', detail }); }
  catch (error) { results.push({ name, status:'FAIL', detail:error.message }); }
}

async function uploadPdf(filename) {
  await page.locator('#heroPdfInput').setInputFiles(join(FIXTURES, filename));
}

await test('PDF text', async () => {
  await open(); await uploadPdf('text-japanese.pdf');
  await page.locator('#importPreviewModal.active').waitFor({ state:'visible', timeout:20000 });
  const text = await page.locator('#importPreviewText').inputValue();
  if (!text.includes('Japanese reading practice')) throw new Error('Text PDF content was not extracted.');
  await page.getByRole('button', { name:'使用这段正文' }).click();
  await page.waitForFunction(() => document.body.classList.contains('has-reading') && (document.querySelector('#output')?.textContent || '').trim().length > 0, null, { timeout:8000 });
  return 'text extracted, previewed, and entered reading workspace';
});

for (const [name, file, expected] of [
  ['PDF scanned', 'scanned-image-only.pdf', '没有可提取文字'],
  ['PDF encrypted', 'encrypted.pdf', '请复制 PDF'],
  ['PDF corrupted', 'corrupted.pdf', '请复制 PDF'],
  ['PDF over 20 MB', 'over-20mb.pdf', '超过大小限制']
]) await test(name, async () => {
  await open(); await uploadPdf(file);
  await page.waitForFunction(text => document.querySelector('#importStatus')?.textContent.includes(text), expected, { timeout:20000 });
  const status = (await page.locator('#importStatus').innerText()).trim();
  if (await page.locator('#importPreviewModal.active').count()) throw new Error('Failure fixture opened import preview.');
  return status;
});

await test('Backup export and restore persistence', async () => {
  await open();
  await page.evaluate(() => {
    localStorage.setItem('reading_vocab_list', JSON.stringify([{ word:'毎朝', reading:'まいあさ', meaning:'每天早晨', pos:'名词', level:'N4', dueAt:0 }]));
    localStorage.setItem('reading_history', JSON.stringify([{ id:101, title:'备份阅读', text:'日本語の文章です。', date:new Date().toISOString(), fingerprint:'backup-reading' }]));
    localStorage.setItem('reading_grammar_book', JSON.stringify([{ id:102, title:'〜てから', note:'顺序', level:'N4', createdAt:new Date().toISOString() }]));
  });
  await page.reload({ waitUntil:'domcontentloaded' });
  const pending = page.waitForEvent('download');
  await page.evaluate(() => exportLearningBackup());
  const download = await pending; const backup = join(OUT, download.suggestedFilename()); await download.saveAs(backup);
  const parsed = JSON.parse(await readFile(backup, 'utf8'));
  if (parsed.app !== 'dokedo-japanese-reader' || !parsed.vocab.length || !parsed.history.length || !parsed.grammarBook.length) throw new Error('Backup file lacks seeded data.');
  await page.evaluate(() => { localStorage.setItem('reading_vocab_list', '[]'); localStorage.setItem('reading_history', '[]'); localStorage.setItem('reading_grammar_book', '[]'); });
  await page.locator('#backupFileInput').setInputFiles(backup);
  await page.getByText('备份已恢复。').waitFor({ state:'visible', timeout:5000 });
  await page.reload({ waitUntil:'domcontentloaded' });
  const restored = await page.evaluate(() => ({ vocab:JSON.parse(localStorage.getItem('reading_vocab_list') || '[]'), history:JSON.parse(localStorage.getItem('reading_history') || '[]'), grammar:JSON.parse(localStorage.getItem('reading_grammar_book') || '[]') }));
  if (!restored.vocab.length || !restored.history.length || !restored.grammar.length) throw new Error('Restored data did not persist after refresh.');
  return backup;
});

await test('SEC-001 malicious backup fields', async () => {
  await open();
  const marker = '<img src=x onerror="window.__stage4Xss=true">';
  const backup = { app:'dokedo-japanese-reader', version:2, vocab:[], history:[{ id:201, title:marker, source:marker, text:`安全正文${marker}`, annotatedHtml:`<script>window.__stage4Xss=true</script>${marker}`, date:new Date().toISOString(), fingerprint:'xss-history' }], grammarBook:[{ id:202, title:marker, note:marker, level:'N4' }] };
  await page.evaluate(() => { window.__stage4Xss = false; });
  await page.locator('#backupFileInput').setInputFiles({ name:'malicious-backup.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(backup)) });
  await page.getByText('备份已恢复。').waitFor({ state:'visible', timeout:5000 });
  await page.evaluate(() => { enterReadingFromHero(); switchWorkspace('history'); renderReadingHistory(); });
  if (await page.evaluate(() => window.__stage4Xss)) throw new Error('Malicious backup executed script.');
  if (await page.locator('#historyList script, #historyList img').count()) throw new Error('Malicious HTML node was rendered.');
  await page.evaluate(() => restoreHistoryArticle(201));
  await page.waitForFunction(() => document.body.dataset.view === 'reading' && (document.querySelector('#output')?.textContent || '').includes('安全正文'));
  if (await page.evaluate(() => window.__stage4Xss)) throw new Error('Malicious history text executed after opening the article.');
  if (await page.locator('#output script, #output img').count()) throw new Error('Malicious history text or annotatedHtml created a node.');
  await page.evaluate(() => switchWorkspace('grammar'));
  await page.locator('#grammarBookList .grammar-book-card').first().waitFor({ state:'visible', timeout:5000 });
  if (await page.locator('#grammarBookList script, #grammarBookList img').count()) throw new Error('Malicious grammar field created a node.');
  if (await page.evaluate(() => window.__stage4Xss)) throw new Error('Malicious grammar field executed script.');
  await page.reload({ waitUntil:'domcontentloaded' });
  if (await page.evaluate(() => window.__stage4Xss)) throw new Error('Malicious backup executed after refresh.');
  await page.evaluate(() => { enterReadingFromHero(); switchWorkspace('grammar'); });
  if (await page.locator('#grammarBookList script, #grammarBookList img').count()) throw new Error('Malicious grammar node appeared after refresh.');
  return 'import, history open, grammar render, and refresh remained inert';
});

await test('Core vocab persistence and full flashcard round', async () => {
  await open();
  await page.locator('#heroInputText').fill(SAMPLE); await page.locator('#heroStartButton').click();
  await page.locator('#output ruby[data-word="毎朝"]').waitFor({ state:'visible', timeout:8000 });
  await page.locator('#output ruby[data-word="毎朝"]').click(); await page.locator('#detailArea .add-vocab-tool').click();
  await page.reload({ waitUntil:'domcontentloaded' });
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('reading_vocab_list') || '[]'));
  if (!persisted.some(item => item.word === '毎朝')) throw new Error('Saved vocab did not persist after refresh.');
  await page.evaluate(() => { enterReadingFromHero(); switchWorkspace('vocab'); });
  await page.locator('#vocabListPage').getByText('毎朝').first().waitFor({ state:'visible', timeout:5000 });
  await page.locator('#vocabPrimaryAction').click();
  await page.locator('#flashArea .flash-stage').click();
  await page.locator('#flashArea .rate-easy').click();
  await page.getByText('复习完成。', { exact:true }).waitFor({ state:'visible', timeout:5000 });
  const state = await page.evaluate(() => ({
    vocab:JSON.parse(localStorage.getItem('reading_vocab_list') || '[]'),
    practice:JSON.parse(localStorage.getItem('reading_practice_history') || '[]')
  }));
  const reviewed = state.vocab.find(item => item.word === '毎朝');
  if (!reviewed || reviewed.lastPracticeRating !== 'easy' || Number(reviewed.repetition) < 1) throw new Error('Flashcard rating was not persisted.');
  if (!state.practice.some(item => Number(item.total || 0) > 0)) throw new Error('Flashcard completion was not recorded in learning history.');
  return 'saved vocab survived refresh; one-card round completed and history persisted';
});

await test('Reading and vocab exports', async () => {
  await open();
  await page.locator('#heroInputText').fill(SAMPLE); await page.locator('#heroStartButton').click();
  await page.locator('#output ruby.w').first().waitFor({ state:'visible', timeout:8000 });
  await page.locator('#output ruby[data-word="毎朝"]').click(); await page.locator('#detailArea .add-vocab-tool').click();
  for (const format of ['pptx','png','jpeg']) {
    await page.evaluate(() => openExportModal());
    await page.locator('#exportFormatSelect').selectOption(format);
    const pending = page.waitForEvent('download', { timeout:30000 }); await page.evaluate(() => runExport());
    const download = await pending; await download.saveAs(join(OUT, download.suggestedFilename()));
  }
  for (const fn of ['exportVocabCsvFile','exportAnkiTsv']) {
    const pending = page.waitForEvent('download'); await page.evaluate(name => window[name](), fn);
    const download = await pending; await download.saveAs(join(OUT, download.suggestedFilename()));
  }
  const files = ['japanese-ruby-text-editable-landscape.pptx','japanese-ruby-text-landscape.png','japanese-ruby-text-landscape.jpeg','读得懂_生词本导出.csv'].map(name => join(OUT,name));
  for (const file of files) if ((await stat(file)).size < 100) throw new Error(`Export too small: ${file}`);
  const csv = await readFile(files[3], 'utf8'); if (!csv.includes('毎朝') || !csv.includes('まいあさ')) throw new Error('CSV content or UTF-8 text is missing.');
  const tsv = (await readdir(OUT)).find(name => name.endsWith('.tsv'));
  const tsvText = await readFile(join(OUT, tsv), 'utf8'); if (!tsvText.includes('毎朝\tまいあさ')) throw new Error('TSV content is missing.');
  return OUT;
});

await test('localStorage corrupted data', async () => {
  await open(); await page.evaluate(() => { localStorage.setItem('reading_vocab_list','{broken'); localStorage.setItem('reading_history','not-json'); localStorage.setItem('reading_grammar_book','['); });
  await page.reload({ waitUntil:'domcontentloaded' });
  if (!(await page.locator('body').isVisible())) throw new Error('Page did not survive corrupt storage.');
  return 'page remained usable';
});

for (const [name, mode] of [['localStorage disabled','disabled'],['localStorage quota exceeded','quota']]) await test(name, async () => {
  const isolated = await browser.newContext();
  await isolated.addInitScript(testMode => {
    const proto = Storage.prototype;
    if (testMode === 'disabled') {
      for (const key of ['getItem','setItem','removeItem']) Object.defineProperty(proto, key, { configurable:true, value(){ throw new DOMException('blocked','SecurityError'); } });
    } else Object.defineProperty(proto, 'setItem', { configurable:true, value(){ throw new DOMException('full','QuotaExceededError'); } });
  }, mode);
  const p = await isolated.newPage(); const pageErrors=[]; p.on('pageerror', e => pageErrors.push(e.message));
  await p.goto('http://127.0.0.1:5194/index.html', { waitUntil:'domcontentloaded' });
  await p.locator('body').waitFor({ state:'visible' });
  await p.evaluate(() => resetLevelTest());
  await p.evaluate(() => setPreferredVoice('Hattori'));
  await p.evaluate(() => openClearLocalDataDialog());
  await p.locator('#clearLocalDataModal.active').waitFor({ state:'visible', timeout:3000 });
  await p.evaluate(() => confirmClearLocalData());
  await p.waitForLoadState('domcontentloaded').catch(() => {});
  if (pageErrors.length) throw new Error(pageErrors.join('; '));
  await isolated.close(); return 'reset, setting save, and data clear completed without uncaught exception';
});

const unexpectedErrors = errors.filter(text => !text.includes('Invalid PDF') && !text.includes('password') && !text.includes('Missing PDF'));
await browser.close(); server.close();
const summary = { startedAt:new Date().toISOString(), outputDir:OUT, pass:results.filter(x=>x.status==='PASS').length, fail:results.filter(x=>x.status==='FAIL').length, results, unexpectedErrors };
await writeFile(join(OUT, 'stage4-report.json'), JSON.stringify(summary, null, 2));
await writeFile(join(OUT, 'stage4-report.md'), ['# Stage 4 Dynamic Audit','',`- PASS: ${summary.pass}`,`- FAIL: ${summary.fail}`,`- Unexpected console errors: ${unexpectedErrors.length}`,'',...results.map(x=>`- ${x.status}: ${x.name} - ${x.detail}`),''].join('\n'));
console.log(join(OUT, 'stage4-report.md'));
if (summary.fail || unexpectedErrors.length) process.exitCode = 1;
