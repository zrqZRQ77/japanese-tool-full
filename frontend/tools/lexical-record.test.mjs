#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const recordSource = await readFile(new URL('../lexical-record.js', import.meta.url), 'utf8');
const detailSource = await readFile(new URL('../lexical-detail-integration.js', import.meta.url), 'utf8');

const context = vm.createContext({
  String,
  Set,
  Boolean,
  document:{createElement(){ return {innerHTML:'', firstElementChild:null}; }},
  window:{},
  escapeHtml(value){ return String(value || ''); },
  detailReadingDisplayHtml(surface, reading){ return `${surface}:${reading}`; },
  detailBadgesHtml(level, part){ return `${level}:${part}`; },
  formatVisibleVocabLevel(value){ return value || '暂无参考等级'; },
  syncTokenSaveButton(){}
});
vm.runInContext(`${recordSource}\n${detailSource}`, context);

const tokenRecord = {
  surface:'寝ます',
  analysis:{
    surface:'寝ます',
    surfaceReading:'ねます',
    lemma:'寝る',
    lemmaReading:'ねる',
    partOfSpeech:'動詞',
    partOfSpeechDetail:'自立',
    conjugationType:'一段',
    conjugationForm:'連用形'
  },
  info:{
    reading:'ねます',
    meaning:'睡觉、就寝',
    meaningLanguage:'zh',
    meaningSource:'offline-chinese',
    level:'N5',
    levelSource:'jlpt-reference',
    lookupMatchedTerm:'寝る',
    lookupMatchedKind:'lemma'
  }
};
context.__record = tokenRecord;
const detail = vm.runInContext("buildLexicalDetailRecord('寝ます', __record.info, __record)", context);
assert.deepEqual(JSON.parse(JSON.stringify(detail)), {
  schemaVersion:1,
  surface:'寝ます',
  surfaceReading:'ねます',
  lemma:'寝る',
  lemmaReading:'ねる',
  partOfSpeech:'動詞',
  partOfSpeechDetail:'自立',
  conjugationType:'一段',
  conjugationForm:'連用形',
  conjugation:'一段 · 連用形',
  meaning:'睡觉、就寝',
  meaningLanguage:'zh',
  meaningSource:'offline-chinese',
  jlptLevel:'N5',
  jlptSource:'jlpt-reference',
  lookupMatchedTerm:'寝る',
  lookupMatchedKind:'lemma'
});

const metadata = vm.runInContext("lexicalVocabMetadata('寝ます', __record.info, __record)", context);
assert.deepEqual(JSON.parse(JSON.stringify(metadata)), {
  lexicalSchemaVersion:1,
  baseForm:'寝る',
  baseReading:'ねる',
  partOfSpeech:'動詞',
  partOfSpeechDetail:'自立',
  conjugationType:'一段',
  conjugationForm:'連用形',
  lookupMatchedTerm:'寝る',
  lookupMatchedKind:'lemma'
});

const detailHtml = vm.runInContext("detailMetaHtml('寝ます', 'ねます', 'N5', '動詞', __record)", context);
assert.match(detailHtml, /寝ます:ねます/);
assert.match(detailHtml, /原形/);
assert.match(detailHtml, /寝る/);
assert.match(detailHtml, /ねる/);
assert.match(detailHtml, /一段 · 連用形/);
assert.equal(tokenRecord.detailRecord?.lookupMatchedTerm, '寝る');

context.__legacy = {word:'旧語', reading:'きゅうご', meaning:'旧数据', pos:'名词', level:'worker'};
const migrated = vm.runInContext('normalizeLexicalVocabFields(__legacy)', context);
assert.deepEqual(JSON.parse(JSON.stringify(migrated)), {
  lexicalSchemaVersion:1,
  word:'旧語',
  reading:'きゅうご',
  baseForm:'旧語',
  baseReading:'きゅうご',
  partOfSpeech:'名词',
  partOfSpeechDetail:'',
  conjugationType:'',
  conjugationForm:'',
  lookupMatchedTerm:'',
  lookupMatchedKind:'',
  pos:'名词'
});

context.__aliased = {
  surface:'読ん', surfaceReading:'よん', lemma:'読む', lemmaReading:'よむ',
  pos:'動詞', conjugationForm:'連用タ接続', lookupMatchedKind:'unsafe'
};
const aliased = vm.runInContext('normalizeLexicalVocabFields(__aliased)', context);
assert.equal(aliased.word, '読ん');
assert.equal(aliased.baseForm, '読む');
assert.equal(aliased.baseReading, 'よむ');
assert.equal(aliased.partOfSpeech, '動詞');
assert.equal(aliased.lookupMatchedKind, '');

context.__editSurface = {word:'古い', reading:'ふるい', baseForm:'古い', baseReading:'ふるい', pos:'形容词'};
vm.runInContext("updateEditedLexicalVocabFields(__editSurface, '古い', 'ふるい', '新しい', 'あたらしい')", context);
assert.equal(context.__editSurface.baseForm, '新しい');
assert.equal(context.__editSurface.baseReading, 'あたらしい');
assert.equal(context.__editSurface.partOfSpeech, '形容词');

context.__editInflected = {word:'読ん', reading:'よん', baseForm:'読む', baseReading:'よむ', partOfSpeech:'動詞'};
vm.runInContext("updateEditedLexicalVocabFields(__editInflected, '読ん', 'よん', '読んだ', 'よんだ')", context);
assert.equal(context.__editInflected.baseForm, '読む');
assert.equal(context.__editInflected.baseReading, 'よむ');

process.stdout.write('Lexical record tests passed: unified details, vocabulary metadata, legacy migration, and edit compatibility.\n');
