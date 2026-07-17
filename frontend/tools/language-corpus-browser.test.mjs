#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(TOOL_DIR, '..');
const cases = JSON.parse(await readFile(resolve(FRONTEND_DIR, 'test-data/language-corpus/20260717-01/cases.json'), 'utf8'));
const workerCases = cases.filter(item=>item.testLayers.includes('worker'));
const dictionaryCases = cases.filter(item=>item.testLayers.includes('dictionary'));
const uiCases = cases.filter(item=>item.testLayers.includes('ui'));
assert.equal(workerCases.length, 32);
assert.equal(dictionaryCases.length, 40);
assert.equal(uiCases.length, 16);

const MIME_TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.gz':'application/gzip', '.dat':'application/octet-stream'
};
let baseUrl = '';
const server = createServer(async (request, response)=>{
  const parsed = new URL(request.url || '/', baseUrl || 'http://127.0.0.1');
  const pathname = decodeURIComponent(parsed.pathname === '/' ? '/index.html' : parsed.pathname);
  const filePath = resolve(FRONTEND_DIR, `.${pathname}`);
  if(!filePath.startsWith(FRONTEND_DIR)){
    response.writeHead(403).end('Forbidden');
    return;
  }
  try{
    await readFile(filePath);
    response.writeHead(200, {'Content-Type':MIME_TYPES[extname(filePath)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    createReadStream(filePath).pipe(response);
  }catch{
    response.writeHead(404).end('Not found');
  }
});
await new Promise((resolveReady, rejectReady)=>{
  server.once('error', rejectReady);
  server.listen(0, '127.0.0.1', resolveReady);
});
const address = server.address();
if(!address || typeof address === 'string') throw new Error('Local test server unavailable.');
baseUrl = `http://127.0.0.1:${address.port}`;

let browser;
try{
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1280, height:900}});
  await page.goto(baseUrl, {waitUntil:'networkidle'});

  const workerResults = await page.evaluate(async corpus=>{
    const toHiragana = value=>String(value || '').replace(/[ァ-ヶ]/g, char=>String.fromCharCode(char.charCodeAt(0) - 0x60));
    const findSlice = (tokens, surface)=>{
      for(let start = 0; start < tokens.length; start += 1){
        let joined = '';
        for(let end = start; end < tokens.length && joined.length <= surface.length; end += 1){
          joined += String(tokens[end]?.surface_form || '');
          if(joined === surface) return tokens.slice(start, end + 1);
        }
      }
      return [];
    };
    const client = window.KuromojiWorkerClient.createClient({
      workerUrl:window.KUROMOJI_ASSET_PATHS?.worker || '/vendor/kuromoji/20260714-01/kuromoji-tokenizer.worker.js',
      initTimeoutMs:60000,
      tokenizeTimeoutMs:15000
    });
    const records = [];
    try{
      for(const item of corpus){
        const result = await client.analyze(item.sentence);
        const slice = findSlice(result.appTokens || [], item.surface);
        const firstLexical = slice.find(token=>!/^(?:助詞|助動詞|記号)$/.test(String(token.pos || ''))) || slice[0] || {};
        records.push({
          id:item.id,
          ok:result.ok,
          found:Boolean(slice.length),
          surfaces:slice.map(token=>token.surface_form),
          reading:toHiragana(slice.map(token=>token.reading && token.reading !== '*' ? token.reading : (/^[ぁ-んァ-ヶー]+$/u.test(token.surface_form || '') ? token.surface_form : '')).join('')),
          lemma:String(firstLexical.basic_form || firstLexical.surface_form || ''),
          pos:String(firstLexical.pos || ''),
          conjugationType:String(firstLexical.conjugated_type === '*' ? '' : firstLexical.conjugated_type || ''),
          conjugationForm:String(firstLexical.conjugated_form === '*' ? '' : firstLexical.conjugated_form || '')
        });
      }
    }finally{
      client.terminate();
    }
    return records;
  }, workerCases);

  const morphologyCategories = new Set(['basic', 'verbs', 'adjectives', 'function_words', 'ambiguity']);
  const workerMismatches = [];
  for(const item of workerCases){
    const actual = workerResults.find(result=>result.id === item.id);
    if(!actual?.ok) workerMismatches.push(`${item.id}: Worker did not complete`);
    if(!actual?.found) workerMismatches.push(`${item.id}: surface not found in Worker tokens`);
    if(item.expectedSurfaceReading && /[\u3040-\u30ff\u3400-\u9fff]/u.test(item.surface)){
      if(actual?.reading !== item.expectedSurfaceReading) workerMismatches.push(`${item.id}: reading expected ${item.expectedSurfaceReading}, got ${actual?.reading || '(empty)'}`);
    }
    if(morphologyCategories.has(item.category)){
      for(const [label, key, expected] of [
        ['lemma', 'lemma', item.expectedLemma], ['POS', 'pos', item.expectedPartOfSpeech],
        ['conjugation type', 'conjugationType', item.expectedConjugationType],
        ['conjugation form', 'conjugationForm', item.expectedConjugationForm]
      ]){
        if(actual?.[key] !== expected) workerMismatches.push(`${item.id}: ${label} expected ${expected || '(empty)'}, got ${actual?.[key] || '(empty)'}`);
      }
    }
  }
  assert.deepEqual(workerMismatches, [], `Worker corpus expectation mismatches:\n${workerMismatches.join('\n')}`);

  const dictionaryResults = await page.evaluate(async corpus=>{
    const records = [];
    for(const item of corpus){
      const analysis = normalizeLexicalAnalysis({
        surface:item.surface,
        surfaceReading:item.expectedSurfaceReading,
        lemma:item.expectedLemma,
        lemmaReading:item.expectedLemmaReading,
        partOfSpeech:item.expectedPartOfSpeech,
        partOfSpeechDetail:item.expectedMeaningClass === 'proper-noun-unresolved'
          || (item.expectedMeaningClass === 'numeric-or-latin' && !item.allowReadingLookup)
          ? '固有名詞'
          : '',
        conjugationType:item.expectedConjugationType,
        conjugationForm:item.expectedConjugationForm,
        isFunctionWord:item.expectedMeaningClass === 'function-word',
        isCompound:item.category === 'compounds'
      });
      const plan = buildLexicalLookupPlan(analysis);
      const [chinese, jmdict, jlpt] = await Promise.all([
        lookupOfflineChinese(plan, item.surface),
        lookupJmdictCommonWithCompoundFallback(plan, item.surface),
        lookupJlptReference(plan)
      ]);
      records.push({
        id:item.id,
        chinese:chinese ? {term:chinese.term, meaning:chinese.entry?.m || ''} : null,
        jmdict:jmdict ? {term:jmdict.term, meaning:(jmdict.entry?.g || []).join('; ')} : null,
        jlpt:jlpt || ''
      });
    }
    return records;
  }, dictionaryCases);
  let chineseHits = 0;
  let jmdictHits = 0;
  let jlptChecks = 0;
  const dictionaryMismatches = [];
  for(const item of dictionaryCases){
    const actual = dictionaryResults.find(result=>result.id === item.id);
    if(actual?.chinese) chineseHits += 1;
    if(actual?.jmdict) jmdictHits += 1;
    if(item.expectedMeaningClass === 'known-chinese'){
      if(!actual?.chinese) dictionaryMismatches.push(`${item.id}: expected offline Chinese lookup hit`);
    }
    if(item.expectedMeaningClass === 'jmdict-fallback'){
      if(!actual?.jmdict) dictionaryMismatches.push(`${item.id}: expected JMdict lookup hit`);
    }
    if(item.expectedJlptLevel){
      jlptChecks += 1;
      if(actual?.jlpt !== item.expectedJlptLevel){
        dictionaryMismatches.push(`${item.id}: JLPT expected ${item.expectedJlptLevel}, got ${actual?.jlpt || '(empty)'}`);
      }
    }
    const visibleMeanings = [actual?.chinese?.meaning, actual?.jmdict?.meaning].filter(Boolean).join(' ');
    for(const forbidden of item.mustNotContain){
      assert.equal(visibleMeanings.includes(forbidden), false, `${item.id}: forbidden dictionary content ${forbidden}`);
    }
  }
  assert.ok(chineseHits >= 20, 'Dictionary subset must exercise offline Chinese hits.');
  assert.ok(jmdictHits >= 10, 'Dictionary subset must exercise JMdict hits.');
  assert.ok(jlptChecks >= 20, 'Dictionary subset must verify JLPT reference levels.');
  assert.deepEqual(dictionaryMismatches, [], `Dictionary corpus expectation mismatches:\n${dictionaryMismatches.join('\n')}`);

  const uiResult = await page.evaluate(async corpus=>{
    localStorage.removeItem('reading_vocab_list');
    enterReadingFromHero();
    await ensureLearningData();
    const checkbox = document.getElementById('useKuromoji');
    if(checkbox) checkbox.checked = true;
    const text = corpus.map(item=>item.sentence).join('\n');
    document.getElementById('inputText').value = text;
    await renderText();
    const outputClone = document.getElementById('output')?.cloneNode(true);
    outputClone?.querySelectorAll('rt').forEach(node=>node.remove());
    const rendered = outputClone?.textContent || '';
    const cache = (window.KUROMOJI_TOKEN_CACHE || []).map(record=>({
      surface:String(record?.surface || record?.token?.surface_form || ''),
      reading:String(record?.info?.reading || record?.lexicalAnalysis?.surfaceReading || '')
    }));
    return {
      mode:document.body.dataset.tokenizerMode || '',
      rendered,
      checks:corpus.map(item=>({
        id:item.id,
        inRendered:rendered.includes(item.surface),
        exactCache:cache.some(record=>record.surface === item.surface)
      }))
    };
  }, uiCases);
  assert.equal(uiResult.mode, 'kuromoji-worker');
  for(const result of uiResult.checks){
    assert.equal(result.inRendered, true, `${result.id}: surface missing from browser UI`);
  }
  assert.ok(uiResult.checks.filter(item=>item.exactCache).length >= 12, 'UI subset must exercise at least 12 exact lexical records.');

  process.stdout.write(`Language corpus browser layers passed: ${workerCases.length} real Worker, ${dictionaryCases.length} dictionary/JLPT, and ${uiCases.length} rendered UI cases.\n`);
}finally{
  await browser?.close();
  await new Promise(resolveClose=>server.close(resolveClose));
}
