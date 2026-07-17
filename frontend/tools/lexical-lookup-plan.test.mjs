#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const lookupSource = await readFile(new URL('../lexical-lookup.js', import.meta.url), 'utf8');
const integrationSource = await readFile(new URL('../lexical-lookup-integration.js', import.meta.url), 'utf8');

function extractBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `missing app source section: ${startMarker}`);
  return appSource.slice(start, end);
}

const chineseEntries = {
  '読む': [{w:'読む', r:'よむ', m:'读', p:'动词'}],
  'よむ': [
    {w:'詠む', r:'よむ', m:'吟诵', p:'动词'},
    {w:'夜務', r:'よむ', m:'夜间工作', p:'名词'}
  ],
  'ます': [{w:'枡', r:'ます', m:'量具', p:'名词'}]
};
const jmdictEntries = {
  'よむ': [
    {w:'夜務', r:'よむ', p:['n'], g:['night duty']},
    {w:'読む', r:'よむ', p:['v5m', 'vt'], g:['to read']}
  ],
  'ます': [{w:'枡', r:'ます', p:['n'], g:['measuring container']}]
};
const jlptIndex = {'読む':'N5', 'よむ':'N1', 'ます':'N3'};

const context = vm.createContext({
  console,
  String,
  Array,
  Set,
  Map,
  Boolean,
  Number,
  RegExp,
  katakanaToHiragana(value) {
    return String(value || '').replace(/[ァ-ヶ]/g, char=>String.fromCharCode(char.charCodeAt(0) - 0x60));
  },
  dictionaryLookupForms(values) {
    const items = Array.isArray(values) ? values : [values];
    return [...new Set(items.map(value=>String(value || '').trim()).filter(Boolean))];
  },
  dictionaryEntryFor() { return null; },
  tokenSurfaceReading(token = {}) {
    return context.katakanaToHiragana(token.reading || token.surface_form || '');
  },
  normalizeVisibleVocabLevel(value) {
    return /^N[1-5]$/.test(String(value || '')) ? String(value) : '';
  },
  offlineShardFor(term) { return term; },
  jmdictCommonShardFor(term) { return term; },
  async loadChineseDefinitionShard(term) { return {[term]:chineseEntries[term] || []}; },
  async loadJmdictCommonShard(term) { return {[term]:jmdictEntries[term] || []}; },
  async loadJlptReferenceIndex() { return jlptIndex; },
  CHINESE_DEFINITIONS_SHARD_COUNT:16,
  document:{getElementById(){ return null; }}
});

const lexicalModelSource = extractBetween('function lexicalValue(value){', '\n\nfunction isProperNounInfo');
vm.runInContext(`${lexicalModelSource}\n${lookupSource}\n${integrationSource}`, context);

const inflectedPlan = vm.runInContext(`buildLexicalLookupPlan(normalizeLexicalAnalysis({
  surface:'読ん', surfaceReading:'よん', lemma:'読む', lemmaReading:'よむ',
  partOfSpeech:'動詞', partOfSpeechDetail:'自立',
  conjugationType:'五段・マ行', conjugationForm:'連用タ接続'
}), {fallbackTerms:['読ん', '読む']})`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(inflectedPlan.candidates.map(item=>[item.term, item.kind, item.allowJlpt]))),
  [
    ['読ん', 'exactSurface', true],
    ['読む', 'lemma', true],
    ['よん', 'reading', false],
    ['よむ', 'reading', false]
  ]
);

const curatedPlan = vm.runInContext("buildCuratedLexicalLookupPlan('読む', {reading:'よむ', pos:'动词'})", context);
assert.equal(curatedPlan.candidates[0].term, '読む');
assert.equal(curatedPlan.candidates[0].allowJlpt, true);
assert.equal(curatedPlan.candidates.some(candidate=>candidate.kind === 'reading' && candidate.allowJlpt), false);

context.__plan = inflectedPlan;
const chineseResult = await vm.runInContext('lookupOfflineChinese(__plan)', context);
assert.equal(chineseResult.term, '読む');
assert.equal(chineseResult.candidate.kind, 'lemma');
assert.equal(chineseResult.entry.m, '读');

const level = await vm.runInContext('lookupJlptReference(__plan)', context);
assert.equal(level, 'N5', 'JLPT must use the lemma and must not inherit a reading-only level.');

const englishResult = await vm.runInContext('lookupJmdictCommon(__plan)', context);
assert.equal(englishResult.term, 'よむ');
assert.equal(englishResult.candidate.kind, 'reading');
assert.equal(englishResult.entry.w, '読む');
assert.deepEqual(JSON.parse(JSON.stringify(englishResult.entry.p)), ['v5m', 'vt']);

const auxiliaryPlan = vm.runInContext(`buildLexicalLookupPlan(normalizeLexicalAnalysis({
  surface:'ます', surfaceReading:'ます', lemma:'ます', lemmaReading:'ます',
  partOfSpeech:'助動詞', conjugationType:'特殊・マス', conjugationForm:'基本形'
}))`, context);
assert.equal(auxiliaryPlan.analysis.isFunctionWord, true);
assert.equal(auxiliaryPlan.candidates.some(item=>item.kind === 'reading'), false);
assert.equal(auxiliaryPlan.candidates.every(item=>item.allowJlpt === false), true);
context.__auxiliaryPlan = auxiliaryPlan;
assert.equal(await vm.runInContext('lookupOfflineChinese(__auxiliaryPlan)', context), null);
assert.equal(await vm.runInContext('lookupJmdictCommon(__auxiliaryPlan)', context), null);
assert.equal(await vm.runInContext('lookupJlptReference(__auxiliaryPlan)', context), '');

const properNounPlan = vm.runInContext(`buildLexicalLookupPlan(normalizeLexicalAnalysis({
  surface:'キッズドア', surfaceReading:'キッズドア', lemma:'キッズドア', lemmaReading:'キッズドア',
  partOfSpeech:'名詞', partOfSpeechDetail:'固有名詞', isProperNoun:true
}))`, context);
assert.equal(properNounPlan.candidates.some(item=>item.kind === 'reading'), false);
assert.equal(properNounPlan.candidates.every(item=>item.allowJlpt === false), true);

const compoundPlan = vm.runInContext(`buildLexicalLookupPlan(normalizeLexicalAnalysis({
  surface:'フィナンシャル・グループ', surfaceReading:'フィナンシャル・グループ',
  lemma:'フィナンシャル・グループ', lemmaReading:'フィナンシャル・グループ',
  partOfSpeech:'名詞', isCompound:true
}))`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(compoundPlan.candidates.filter(item=>item.kind === 'compound').map(item=>item.term))),
  ['グループ', 'フィナンシャル']
);
assert.equal(compoundPlan.candidates.filter(item=>item.kind === 'compound').every(item=>item.allowJlpt === false), true);

const verbReadingCandidate = {
  term:'かえる', kind:'reading', posCategory:'verb', allowReadingMatch:true, requirePosMatch:true
};
const homophones = [
  {w:'蛙', r:'かえる', p:['n'], g:['frog']},
  {w:'帰る', r:'かえる', p:['v5r', 'vi'], g:['to return']}
];
context.__homophones = homophones;
context.__verbReadingCandidate = verbReadingCandidate;
const selectedHomophone = vm.runInContext("selectLookupEntry(__homophones, __verbReadingCandidate, 'jmdict')", context);
assert.equal(selectedHomophone.w, '帰る');

const kanaVerbPlan = vm.runInContext(`buildLexicalLookupPlan(normalizeLexicalAnalysis({
  surface:'かえる', surfaceReading:'かえる', lemma:'かえる', lemmaReading:'かえる',
  partOfSpeech:'動詞', partOfSpeechDetail:'自立'
}))`, context);
const kanaCandidate = kanaVerbPlan.candidates[0];
assert.equal(kanaCandidate.kind, 'exactSurface');
assert.equal(kanaCandidate.allowReadingMatch, true);
assert.equal(kanaCandidate.requirePosMatch, true);
context.__kanaCandidate = kanaCandidate;
const selectedKanaVerb = vm.runInContext("selectLookupEntry(__homophones, __kanaCandidate, 'jmdict')", context);
assert.equal(selectedKanaVerb.w, '帰る');

process.stdout.write('Lexical lookup plan passed: typed priority, shared sources, POS-safe readings, function-word and proper-noun guards.\n');
