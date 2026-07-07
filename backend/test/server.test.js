const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { JSDOM } = require('jsdom');
const {
  classifyPdfLayoutItems,
  decodeTextFile,
  extractPdfFootnotesFromText,
  extractDocxText,
  filterPdfRubyItems,
  isAllowedOrigin,
  isLikelyVerticalPdfPage,
  joinVerticalPdfTextItems,
  normalizePdfMode,
  normalizePngExportPayload
} = require('../server');

test('decodes UTF-8 Japanese TXT', () => {
  assert.equal(decodeTextFile(Buffer.from('日本語の文章です。')), '日本語の文章です。');
});

test('removes positioned PDF ruby but preserves standalone kana labels', () => {
  const item = (str, x, y, size, width) => ({
    str,
    width,
    height: size,
    transform: [size, 0, 0, size, x, y],
    hasEOL: false
  });
  const result = filterPdfRubyItems([
    item('住民登録', 80, 700, 20, 100),
    item('じゅうみんとうろく', 80, 716, 7, 70),
    item('ナレーション', 80, 640, 8, 60)
  ]);
  assert.equal(result.removedCount, 1);
  assert.deepEqual(result.items.map(value => value.str), ['住民登録', 'ナレーション']);
});

test('reorders vertical PDF text from right columns to horizontal lines', () => {
  const item = (str, x, y, size = 16) => ({
    str,
    width: size,
    height: size,
    transform: [size, 0, 0, size, x, y],
    hasEOL: false
  });
  const items = [
    item('学', 120, 680), item('校', 120, 660), item('へ', 120, 640), item('行', 120, 620), item('く', 120, 600), item('日', 120, 580),
    item('本', 92, 680), item('語', 92, 660), item('を', 92, 640), item('勉', 92, 620), item('強', 92, 600), item('す', 92, 580), item('る', 92, 560)
  ];
  assert.equal(isLikelyVerticalPdfPage(items), true);
  assert.equal(joinVerticalPdfTextItems(items), '学校へ行く日\n本語を勉強する');
});

test('normalizes PDF extraction mode names', () => {
  assert.equal(normalizePdfMode('vertical-to-horizontal'), 'vertical');
  assert.equal(normalizePdfMode('normal'), 'horizontal');
  assert.equal(normalizePdfMode('unknown'), 'auto');
});

test('classifies PDF rulers and footnotes away from body text', () => {
  const item = (str, x, y, size = 16, width = 20) => ({
    str,
    width,
    height: size,
    transform: [size, 0, 0, size, x, y],
    hasEOL: false
  });
  const result = classifyPdfLayoutItems([
    item('羅生門', 120, 680, 16, 48),
    item('36・・・・・・36', 90, 20, 8, 90),
    item('18 くさめ＝くしゃみ', 12, 18, 7, 90)
  ], { pageNumber: 3, viewport: { width: 200, height: 720 } });
  assert.deepEqual(result.bodyItems.map(value => value.str), ['羅生門']);
  assert.deepEqual(result.footnotes.map(note => [note.id, note.text, note.page]), [['18', 'くさめ＝くしゃみ', 3]]);
});

test('extracts numbered PDF footnotes from compact text', () => {
  assert.deepEqual(
    extractPdfFootnotesFromText('18 くさめ＝くしゃみ\n19 Sentimentalisme フランス語', 5),
    [
      { id: '18', text: 'くさめ＝くしゃみ', page: 5 },
      { id: '19', text: 'Sentimentalisme フランス語', page: 5 }
    ]
  );
});

test('allows local file origins for upload preflight', () => {
  assert.equal(isAllowedOrigin('null'), true);
  assert.equal(isAllowedOrigin('http://localhost:3000'), true);
});

test('rejects disallowed request origins before route handling', () => {
  assert.equal(isAllowedOrigin('https://not-allowed.example'), false);
  const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(
    serverSource,
    /if \(origin && !isAllowedOrigin\(origin\)\) \{\s*return res\.status\(403\)\.json\(\{ ok: false, error: 'ORIGIN_NOT_ALLOWED'/
  );
});

test('extracts paragraphs from DOCX', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.folder('_rels').file('.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.folder('word').file('document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>日本語の資料</w:t></w:r></w:p><w:p><w:r><w:t>今日は図書館で勉強します。</w:t></w:r></w:p></w:body></w:document>');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  assert.equal(await extractDocxText(buffer), '日本語の資料\n\n今日は図書館で勉強します。');
});

test('normalizes PNG export settings and dimensions', () => {
  const payload = normalizePngExportPayload({
    layout: 'portrait',
    baseFont: 999,
    units: [{ base: '日本語', ruby: 'にほんご' }]
  });
  assert.equal(payload.width, 900);
  assert.equal(payload.height, 1600);
  assert.equal(payload.baseFont, 44);
});

test('frontend exposes stable export formats and loads split assets', () => {
  const htmlPath = path.join(__dirname, '../../frontend/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const document = new JSDOM(html).window.document;
  assert.deepEqual(
    Array.from(document.querySelectorAll('#exportFormatSelect option')).map(option => option.value),
    ['pptx', 'png']
  );
  assert.equal(document.querySelector('script[src="config.js"]') !== null, true);
  assert.equal(document.querySelector('link[href^="styles.css"]') !== null, true);
  assert.equal(document.querySelector('script[src^="app.js"]') !== null, true);
  assert.equal(document.querySelector('style'), null);
  assert.equal(document.querySelector('#documentFileInput') !== null, true);
  assert.equal(document.querySelector('#pdfModeSelect') !== null, true);
  assert.equal(document.querySelector('#pdfCleanupSelect') !== null, true);
  assert.equal(document.querySelector('.app-sidebar .nav-item[data-view="retell"]')?.textContent.trim(), '练习');
  assert.equal(document.querySelector('.app-sidebar .nav-resources')?.textContent.trim(), '资料');
  assert.equal(Array.from(document.querySelectorAll('.source-actions button')).some(button => button.textContent.trim() === '水平测试'), true);
  assert.equal(document.querySelector('#startTypingPracticeBtn')?.textContent.trim(), '打字');
});

test('frontend data files are valid JSON and app keeps key safeguards', () => {
  const root = path.join(__dirname, '../../frontend');
  const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'data/dictionary.json'), 'utf8'));
  const sample = JSON.parse(fs.readFileSync(path.join(root, 'data/sample.json'), 'utf8'));
  const typingPrompts = JSON.parse(fs.readFileSync(path.join(root, 'data/typing-prompts.json'), 'utf8'));
  const grammarPoints = JSON.parse(fs.readFileSync(path.join(root, 'data/grammar-points.json'), 'utf8'));
  const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

  assert.equal(dictionary['日本語'].reading, 'にほんご');
  assert.match(sample.text, /図書館/);
  assert.equal(Array.isArray(typingPrompts), true);
  assert.equal(Array.isArray(grammarPoints), true);
  assert.match(appJs, /function connectionHelp/);
  assert.match(appJs, /if\(configured\) return \[\`\$\{configured\}\$\{path\}\`\]/);
  assert.match(appJs, /单词,假名,释义,词性,等级,来源,来源链接,复习状态,下次复习时间/);
  assert.match(appJs, /const csvField = value =>/);
  assert.match(appJs, /\[\s*v\.word,\s*v\.reading,\s*displayVocabMeaning\(v\.meaning\),\s*v\.pos,\s*v\.level,\s*vocabSourceLabel\(v\),\s*v\.sourceUrl,\s*mastery\.label,\s*exportDateTime\(v\.dueAt\)\s*\]\.map\(csvField\)/);
});
