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
      起きます:{reading:'おきます', meaning:'起床'},
      読む:{reading:'よむ', meaning:'读', level:'N5', levelSource:'jlpt-reference'}
    },
    FALLBACK_DICTIONARY:{},
    String,
    katakanaToHiragana:value=>String(value).replace(/[ァ-ヶ]/g, char=>String.fromCharCode(char.charCodeAt(0) - 0x60)),
    normalizeVisibleVocabLevel:value=>/^N[1-5]$/.test(String(value || '')) ? value : '',
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
  assert.equal(auxiliary.lexicalAnalysis.isFunctionWord, true);
  assert.equal(auxiliary.lexicalAnalysis.isProperNoun, false);
  assert.doesNotMatch(auxiliary.meaning, /measuring container/i);

  const inflected = vm.runInContext(`getTokenInfo({
    surface_form:'読ん', basic_form:'読む', reading:'ヨン',
    pos:'動詞', pos_detail_1:'自立', conjugated_type:'五段・マ行', conjugated_form:'連用タ接続'
  })`, context);
  assert.equal(inflected.reading, 'よん');
  assert.equal(inflected.lookupWord, '読む');
  assert.equal(inflected.baseForm, '読む');
  assert.equal(inflected.level, 'N5');
  assert.deepEqual(
    JSON.parse(JSON.stringify(inflected.lexicalAnalysis)),
    {
      surface:'読ん', surfaceReading:'よん', lemma:'読む', lemmaReading:'よむ',
      partOfSpeech:'動詞', partOfSpeechDetail:'自立',
      conjugationType:'五段・マ行', conjugationForm:'連用タ接続',
      isFunctionWord:false, isProperNoun:false, isCompound:false, sourceRefs:['0:0']
    }
  );

  const properNoun = vm.runInContext(
    "getTokenInfo({surface_form:'キッズドア', basic_form:'キッズドア', reading:'キッズドア', pos:'名詞', pos_detail_1:'固有名詞'})",
    context
  );
  assert.equal(properNoun.lexicalAnalysis.isProperNoun, true);
  assert.equal(properNoun.lexicalAnalysis.isFunctionWord, false);

  for(const [stem, base, expected] of [['あり', 'ある', 'あります'], ['開き', '開く', '開きます'], ['起き', '起きる', '起きます']]){
    context.__tokens = [
      {surface_form:stem, basic_form:base, reading:stem, pos:'動詞'},
      {surface_form:'ます', basic_form:'ます', reading:'マス', pos:'助動詞', conjugated_type:'特殊・マス'}
    ];
    const merged = vm.runInContext('mergeDictionaryCompounds(__tokens)', context);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].surface_form, expected);
    assert.equal(merged[0].basic_form, base);
    assert.equal(merged[0].is_compound, true);
    assert.deepEqual(JSON.parse(JSON.stringify(merged[0].lexical_source_refs)), ['0:0', '0:1']);
    context.__mergedToken = merged[0];
    const mergedInfo = vm.runInContext('getTokenInfo(__mergedToken)', context);
    assert.equal(mergedInfo.lexicalAnalysis.isCompound, true);
    assert.equal(mergedInfo.lexicalAnalysis.lemma, base);
  }
}

process.stdout.write('Kuromoji race, inflection reading/level, immutable detail snapshot, and auxiliary ます tests passed.\n');
