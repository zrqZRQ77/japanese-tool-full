#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const CASES_URL = new URL('../test-data/language-corpus/20260717-01/cases.json', import.meta.url);
const MANIFEST_URL = new URL('../test-data/language-corpus/20260717-01/manifest.json', import.meta.url);
const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const lookupSource = await readFile(new URL('../lexical-lookup.js', import.meta.url), 'utf8');
const cases = JSON.parse(await readFile(CASES_URL, 'utf8'));
const manifest = JSON.parse(await readFile(MANIFEST_URL, 'utf8'));

const REQUIRED_FIELDS = [
  'id', 'category', 'sentence', 'surface', 'expectedSurfaceReading', 'expectedLemma',
  'expectedLemmaReading', 'expectedPartOfSpeech', 'expectedConjugationType',
  'expectedConjugationForm', 'expectedMeaningClass', 'expectedJlptLevel',
  'allowReadingLookup', 'expectedLookupKinds', 'mustNotContain', 'testLayers'
];
const EXPECTED_CATEGORIES = {
  basic:40,
  verbs:60,
  adjectives:30,
  function_words:30,
  ambiguity:25,
  compounds:25,
  proper_mixed:20,
  news:30
};
const EXPECTED_LAYERS = {pure:260, worker:32, dictionary:40, ui:16, 'safari-manual':12};
const ALLOWED_MEANING_CLASSES = new Set([
  'known-chinese', 'jmdict-fallback', 'function-word', 'context-dependent',
  'proper-noun-unresolved', 'numeric-or-latin', 'unknown'
]);
const ALLOWED_LOOKUP_KINDS = new Set(['exactSurface', 'lemma', 'compound', 'reading', 'fallback']);
const ALLOWED_LAYERS = new Set(Object.keys(EXPECTED_LAYERS));

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.corpusVersion, '20260717-01');
assert.equal(manifest.deterministic, true);
assert.equal(manifest.totalCases, 260);
assert.equal(manifest.safariManualStatus, 'PENDING');
assert.equal(cases.length, 260);

const ids = new Set();
const categoryCounts = Object.fromEntries(Object.keys(EXPECTED_CATEGORIES).map(key=>[key, 0]));
const layerCounts = Object.fromEntries(Object.keys(EXPECTED_LAYERS).map(key=>[key, 0]));
for(const [index, item] of cases.entries()){
  assert.deepEqual(Object.keys(item), REQUIRED_FIELDS, `${item.id || index}: schema fields/order changed`);
  assert.match(item.id, /^LQ-\d{3}$/);
  assert.equal(item.id, `LQ-${String(index + 1).padStart(3, '0')}`);
  assert.equal(ids.has(item.id), false, `${item.id}: duplicate id`);
  ids.add(item.id);
  assert.ok(Object.hasOwn(EXPECTED_CATEGORIES, item.category), `${item.id}: invalid category`);
  categoryCounts[item.category] += 1;
  for(const field of [
    'sentence', 'surface', 'expectedSurfaceReading', 'expectedLemma', 'expectedLemmaReading',
    'expectedPartOfSpeech', 'expectedConjugationType', 'expectedConjugationForm',
    'expectedMeaningClass', 'expectedJlptLevel'
  ]) assert.equal(typeof item[field], 'string', `${item.id}.${field}: expected string`);
  assert.ok(item.sentence.includes(item.surface), `${item.id}: sentence must contain surface`);
  assert.ok(item.expectedLemma, `${item.id}: lemma must not be empty`);
  assert.ok(ALLOWED_MEANING_CLASSES.has(item.expectedMeaningClass), `${item.id}: invalid meaning class`);
  assert.match(item.expectedJlptLevel, /^(?:N[1-5])?$/, `${item.id}: invalid JLPT reference`);
  assert.equal(typeof item.allowReadingLookup, 'boolean');
  for(const [field, allowed] of [['expectedLookupKinds', ALLOWED_LOOKUP_KINDS], ['testLayers', ALLOWED_LAYERS]]){
    assert.ok(Array.isArray(item[field]) && item[field].length, `${item.id}.${field}: expected non-empty array`);
    assert.equal(new Set(item[field]).size, item[field].length, `${item.id}.${field}: duplicates`);
    for(const value of item[field]) assert.ok(allowed.has(value), `${item.id}.${field}: invalid ${value}`);
  }
  assert.ok(item.testLayers.includes('pure'), `${item.id}: every case must enter pure layer`);
  assert.ok(Array.isArray(item.mustNotContain));
  assert.equal(new Set(item.mustNotContain).size, item.mustNotContain.length);
  for(const value of item.mustNotContain) assert.ok(typeof value === 'string' && value.trim());
  for(const layer of item.testLayers) layerCounts[layer] += 1;
}
assert.deepEqual(categoryCounts, EXPECTED_CATEGORIES);
assert.deepEqual(layerCounts, EXPECTED_LAYERS);
assert.deepEqual(manifest.layers, EXPECTED_LAYERS);

function extractBetween(startMarker, endMarker){
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `missing app source section: ${startMarker}`);
  return appSource.slice(start, end);
}
function toHiragana(value){
  return String(value || '').replace(/[ァ-ヶ]/g, char=>String.fromCharCode(char.charCodeAt(0) - 0x60));
}

const context = vm.createContext({
  String, Array, Set, Map, Boolean, Number, RegExp,
  __dictionary:Object.create(null),
  katakanaToHiragana:toHiragana,
  dictionaryLookupForms(values){
    const items = Array.isArray(values) ? values : [values];
    return [...new Set(items.map(value=>String(value || '').trim()).filter(Boolean))];
  },
  dictionaryEntryFor(word){ return context.__dictionary[word] || null; },
  tokenSurfaceReading(token = {}){
    const surface = String(token.surface_form || '');
    const raw = token.reading && token.reading !== '*' ? token.reading : '';
    return raw ? toHiragana(raw) : (/^[\u3040-\u30ffー]+$/u.test(surface) ? toHiragana(surface) : '');
  }
});
const lexicalModelSource = extractBetween('function lexicalValue(value){', '\n\nfunction isProperNounInfo');
vm.runInContext(`${lexicalModelSource}\n${lookupSource}`, context);

for(const item of cases){
  context.__dictionary = {
    [item.expectedLemma]:{reading:item.expectedLemmaReading},
    ...(item.expectedLemma === item.surface ? {[item.surface]:{reading:item.expectedSurfaceReading}} : {})
  };
  context.__token = {
    surface_form:item.surface,
    basic_form:item.expectedLemma,
    reading:item.expectedSurfaceReading,
    pos:item.expectedPartOfSpeech,
    pos_detail_1:item.expectedMeaningClass === 'proper-noun-unresolved'
      || (item.expectedMeaningClass === 'numeric-or-latin' && !item.allowReadingLookup)
      ? '固有名詞'
      : '',
    conjugated_type:item.expectedConjugationType,
    conjugated_form:item.expectedConjugationForm,
    is_compound:item.category === 'compounds'
  };
  const analysis = vm.runInContext('analyzeLexicalToken(__token)', context);
  assert.equal(analysis.surface, item.surface, `${item.id}: surface`);
  assert.equal(analysis.surfaceReading, item.expectedSurfaceReading, `${item.id}: surface reading`);
  assert.equal(analysis.lemma, item.expectedLemma, `${item.id}: lemma`);
  assert.equal(analysis.lemmaReading, item.expectedLemmaReading, `${item.id}: lemma reading`);
  assert.equal(analysis.partOfSpeech, item.expectedPartOfSpeech, `${item.id}: POS`);
  assert.equal(analysis.conjugationType, item.expectedConjugationType, `${item.id}: conjugation type`);
  assert.equal(analysis.conjugationForm, item.expectedConjugationForm, `${item.id}: conjugation form`);
  context.__analysis = analysis;
  const plan = vm.runInContext('buildLexicalLookupPlan(__analysis)', context);
  const actualKinds = [...new Set(plan.candidates.map(candidate=>candidate.kind))];
  assert.deepEqual(actualKinds, item.expectedLookupKinds, `${item.id}: lookup kinds`);
  if(!item.allowReadingLookup){
    assert.equal(plan.candidates.some(candidate=>candidate.kind === 'reading'), false, `${item.id}: forbidden reading lookup`);
  }
}

const requiredInflections = new Map(cases.map(item=>[`${item.expectedLemma}::${item.surface}`, item]));
for(const [lemma, surfaces] of Object.entries({
  '読む':['読ん', '読んだ', '読んで', '読まない'],
  '書く':['書いて', '書いた'],
  '行く':['行った', '行きます'],
  '待つ':['待って', '待った'],
  '寝る':['寝ます', '寝ない', '寝た'],
  '食べる':['食べます', '食べられる'],
  'する':['します', 'した', 'させる'],
  '来る':['来ます', '来ない', '来なかった'],
  '高い':['高く', '高かった', '高くない'],
  '静か':['静かです', '静かだった']
})){
  for(const surface of surfaces){
    assert.ok(requiredInflections.has(`${lemma}::${surface}`), `missing required inflection: ${lemma} -> ${surface}`);
  }
}

process.stdout.write(`Language corpus pure layer passed: ${cases.length} cases, 8 categories, deterministic schema/model/lookup validation.\n`);
