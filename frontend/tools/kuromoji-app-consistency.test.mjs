#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function extractBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `missing app source section: ${startMarker}`);
  return appSource.slice(start, end);
}

{
  const statuses = [];
  const busyStates = [];
  const analytics = [];
  const context = vm.createContext({
    currentValue: '',
    sourceInputValue() {
      return context.currentValue;
    },
    setImportStatus(text, state) {
      statuses.push({ text, state });
    },
    setSourceAnalysisBusy(value) {
      busyStates.push(value);
    },
    normalizeArticleUrl() {
      return '';
    },
    trackAnalyticsEvent(name) {
      analytics.push(name);
    },
    prewarmLocalKuromojiWorker() {},
    async renderText() {
      const captured = context.currentValue;
      await delay(captured === '文章A' ? 30 : 5);
    },
    showToast() {},
    document: { getElementById: () => null },
    console
  });
  const analyzeSourceInput = extractBetween(
    'async function analyzeSourceInput(){',
    '\nfunction setSourceAnalysisBusy'
  );
  vm.runInContext(
    `let SOURCE_ANALYSIS_GENERATION = 0; let CURRENT_ARTICLE_URL = '';\n${analyzeSourceInput}`,
    context
  );
  context.currentValue = '文章A';
  const oldAnalysis = vm.runInContext('analyzeSourceInput()', context);
  await delay(1);
  context.currentValue = '文章B';
  const newAnalysis = vm.runInContext('analyzeSourceInput()', context);
  await Promise.all([oldAnalysis, newAnalysis]);

  assert.equal(statuses.filter(item => item.text === '已生成可点击阅读材料。').length, 1);
  assert.equal(analytics.filter(name => name === 'analysis_completed').length, 1);
  assert.equal(busyStates.at(-1), false);
  assert.equal(busyStates.filter(value => value === false).length, 1);
}

{
  const saved = [];
  const context = vm.createContext({
    decodeURIComponent,
    JSON,
    String,
    console,
    addCustomToVocab(...args) {
      saved.push(args);
    }
  });
  const snapshotFunction = extractBetween(
    'function addTokenSnapshotToVocab(encodedSnapshot){',
    '\nfunction isSystemGeneratedMeaning'
  );
  vm.runInContext(snapshotFunction, context);
  const oldDetailSnapshot = encodeURIComponent(JSON.stringify({
    surface: '古い語',
    reading: 'ふるいご',
    meaning: '旧详情',
    level: 'N3',
    pos: '名词'
  }));
  context.KUROMOJI_TOKEN_CACHE = [{ surface: '新しい語' }];
  vm.runInContext(`addTokenSnapshotToVocab('${oldDetailSnapshot}')`, context);
  assert.deepEqual(saved[0], [
    '古い語',
    'ふるいご',
    '旧详情',
    'N3',
    '名词',
    { surface:'古い語', reading:'ふるいご', meaning:'旧详情', level:'N3', pos:'名词' }
  ]);
}

{
  const context = vm.createContext({
    DICT: {
      ます:{meaning:'measuring container', level:'N3'},
      あります:{reading:'あります', meaning:'有'},
      開きます:{reading:'ひらきます', meaning:'打开'},
      起きます:{reading:'おきます', meaning:'起床'}
    },
    FALLBACK_DICTIONARY:{},
    String,
    katakanaToHiragana:value=>String(value),
    console
  });
  const dictionaryFunctions = extractBetween(
    'function dictionaryEntryFor(word){',
    '\nfunction renderWithKuromoji(raw'
  );
  vm.runInContext(dictionaryFunctions, context);
  const auxiliary = vm.runInContext(`getTokenInfo({
    surface_form:'ます', basic_form:'ます', reading:'マス',
    pos:'助動詞', pos_detail_1:'*', conjugated_type:'特殊・マス', conjugated_form:'基本形'
  })`, context);
  assert.equal(auxiliary.meaning, '礼貌助动词，用于构成动词的礼貌表达');
  assert.equal(auxiliary.pos, '助动词');
  assert.equal(auxiliary.level, '');
  assert.equal(auxiliary.source, 'grammar-function');
  assert.doesNotMatch(auxiliary.meaning, /measuring container/i);

  for(const [stem, expected] of [['あり', 'あります'], ['開き', '開きます'], ['起き', '起きます']]){
    context.__tokens = [
      {surface_form:stem, basic_form:stem, reading:stem, pos:'動詞'},
      {surface_form:'ます', basic_form:'ます', reading:'マス', pos:'助動詞', conjugated_type:'特殊・マス'}
    ];
    const merged = vm.runInContext('mergeDictionaryCompounds(__tokens)', context);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].surface_form, expected);
  }
}

process.stdout.write('Kuromoji race, immutable detail snapshot, and auxiliary ます tests passed.\n');
