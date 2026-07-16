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

process.stdout.write('Kuromoji article race and immutable detail snapshot tests passed.\n');
