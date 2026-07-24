#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const FRONTEND = resolve(ROOT, 'frontend');
const CHINESE_DIR = resolve(FRONTEND, 'data/chinese-definitions/20260717');
const JMDICT_DIR = resolve(FRONTEND, 'data/jmdict-common/20260713');
const JLPT_DIR = resolve(FRONTEND, 'data/jlpt-reference/20260717');
const CORPUS_PATH = resolve(FRONTEND, 'test-data/language-corpus/20260717-01/cases.json');
const OUTPUT_DIR = resolve(ROOT, 'audits/offline-chinese-coverage/20260723');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadShardKeys(directory) {
  const files = (await readdir(directory)).filter(file => /^shard-\d+\.json$/.test(file)).sort();
  const keys = new Set();
  for (const file of files) {
    const shard = await readJson(resolve(directory, file));
    Object.keys(shard).forEach(key => keys.add(key));
  }
  return { files, keys };
}

function candidateForms(item) {
  return [...new Set([
    item.surface,
    item.expectedLemma,
    item.expectedSurfaceReading,
    item.expectedLemmaReading
  ].map(value => String(value || '').trim()).filter(Boolean))];
}

function firstHit(forms, keys) {
  return forms.find(form => keys.has(form)) || null;
}

function countBy(items, selector) {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja')));
}

function percentage(hit, total) {
  return total ? Number(((hit / total) * 100).toFixed(1)) : 0;
}

const [dictionary, supplement, chineseMetadata, jmdictMetadata, jlptMetadata, corpus, chineseIndex, jmdictIndex] = await Promise.all([
  readJson(resolve(FRONTEND, 'data/dictionary.json')),
  readJson(resolve(FRONTEND, 'data/chinese-definitions-source.json')),
  readJson(resolve(CHINESE_DIR, 'metadata.json')),
  readJson(resolve(JMDICT_DIR, 'metadata.json')),
  readJson(resolve(JLPT_DIR, 'metadata.json')),
  readJson(CORPUS_PATH),
  loadShardKeys(CHINESE_DIR),
  loadShardKeys(JMDICT_DIR)
]);

const excludedClasses = new Set(['function-word', 'proper-noun-unresolved', 'numeric-or-latin', 'context-dependent']);
const caseResults = corpus.map(item => {
  const forms = candidateForms(item);
  const chineseHit = firstHit(forms, chineseIndex.keys);
  const jmdictHit = firstHit(forms, jmdictIndex.keys);
  const eligible = !excludedClasses.has(item.expectedMeaningClass);
  return {
    id: item.id,
    category: item.category,
    surface: item.surface,
    lemma: item.expectedLemma,
    reading: item.expectedLemmaReading || item.expectedSurfaceReading,
    jlpt: item.expectedJlptLevel || null,
    expectedMeaningClass: item.expectedMeaningClass,
    eligible,
    chineseHit,
    jmdictHit,
    resolution: chineseHit ? 'chinese' : (jmdictHit ? 'jmdict-english' : (eligible ? 'unresolved' : 'excluded'))
  };
});

const eligibleCases = caseResults.filter(item => item.eligible);
const chineseHits = eligibleCases.filter(item => item.chineseHit);
const chineseMisses = eligibleCases.filter(item => !item.chineseHit);
const jmdictFallbackHits = chineseMisses.filter(item => item.jmdictHit);
const unresolved = chineseMisses.filter(item => !item.jmdictHit);

const frequency = new Map();
for (const item of chineseMisses) {
  const word = item.lemma || item.surface;
  const key = `${word}\u0000${item.reading || ''}`;
  const current = frequency.get(key) || {
    word,
    reading: item.reading,
    count: 0,
    categories: new Set(),
    jlptLevels: new Set(),
    jmdictAvailable: false,
    examples: []
  };
  current.count += 1;
  current.categories.add(item.category);
  if (item.jlpt) current.jlptLevels.add(item.jlpt);
  current.jmdictAvailable ||= Boolean(item.jmdictHit);
  if (current.examples.length < 3) current.examples.push(item.id);
  frequency.set(key, current);
}

const gaps = [...frequency.values()].map(item => ({
  word: item.word,
  reading: item.reading,
  count: item.count,
  categories: [...item.categories].sort(),
  jlptLevels: [...item.jlptLevels].sort(),
  jmdictAvailable: item.jmdictAvailable,
  examples: item.examples,
  priorityScore: item.count * 10 + (item.jlptLevels.size ? 5 : 0) + (item.jmdictAvailable ? 2 : 0)
})).sort((a, b) => b.priorityScore - a.priorityScore || b.count - a.count || a.word.localeCompare(b.word, 'ja'));

const report = {
  schemaVersion: 1,
  generatedAt: '2026-07-23T00:00:00.000Z',
  baseline: {
    mainCommit: '6a821a65d56af7576e4312ef4b1df33eb6d889f4',
    chineseDataVersion: chineseMetadata.dataVersion,
    jmdictDataVersion: jmdictMetadata.dataVersion,
    jlptDataVersion: jlptMetadata.dataVersion,
    corpusVersion: '20260717-01'
  },
  inventory: {
    dictionaryEntries: Object.keys(dictionary).length,
    supplementEntries: Object.keys(supplement.entries || {}).length,
    indexedChineseEntries: chineseMetadata.indexedEntryCount,
    indexedChineseForms: chineseMetadata.formCount,
    chineseShardCount: chineseIndex.files.length,
    jmdictEntries: jmdictMetadata.indexedEntryCount,
    jmdictForms: jmdictMetadata.formCount,
    jmdictLanguages: jmdictMetadata.languages,
    jmdictShardCount: jmdictIndex.files.length,
    jlptEntries: jlptMetadata.sourceEntryCount,
    jlptForms: jlptMetadata.indexedFormCount
  },
  corpus: {
    totalCases: caseResults.length,
    eligibleLexicalCases: eligibleCases.length,
    excludedCases: caseResults.length - eligibleCases.length,
    chineseHits: chineseHits.length,
    chineseMisses: chineseMisses.length,
    chineseCoveragePercent: percentage(chineseHits.length, eligibleCases.length),
    jmdictFallbackHits: jmdictFallbackHits.length,
    unresolvedAfterJmdict: unresolved.length,
    combinedResolvableCases: chineseHits.length + jmdictFallbackHits.length,
    combinedResolvablePercent: percentage(chineseHits.length + jmdictFallbackHits.length, eligibleCases.length),
    meaningClassDistribution: countBy(caseResults, item => item.expectedMeaningClass),
    categoryDistribution: countBy(caseResults, item => item.category),
    chineseMissesByCategory: countBy(chineseMisses, item => item.category),
    unresolvedByCategory: countBy(unresolved, item => item.category)
  },
  architecture: {
    chinesePriority: 'Project-maintained Chinese index is checked first by surface, lemma and reading forms.',
    englishFallback: 'JMdict common English glosses are used only when no curated Chinese entry is available.',
    jlptRole: 'JLPT reference data supplies level metadata only; it is not a meaning source.',
    runtimeBoundary: 'This audit does not modify runtime lookup, UI, vocabulary storage or exported data.'
  },
  topChineseGaps: gaps.slice(0, 100),
  unresolvedCases: unresolved
};

const reportLines = [
  '# Yomeru 离线中文释义覆盖审计',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '## 结论',
  '',
  `- 当前人工中文索引：${report.inventory.indexedChineseEntries} 条词条、${report.inventory.indexedChineseForms} 个检索形式。`,
  `- 语言语料：${report.corpus.totalCases} 个案例，其中 ${report.corpus.eligibleLexicalCases} 个属于可查词词汇案例。`,
  `- 中文直接命中：${report.corpus.chineseHits}/${report.corpus.eligibleLexicalCases}（${report.corpus.chineseCoveragePercent}%）。`,
  `- 中文未命中但 JMdict 英文可回退：${report.corpus.jmdictFallbackHits}。`,
  `- 中文与 JMdict 均未解决：${report.corpus.unresolvedAfterJmdict}。`,
  `- 中文 + JMdict 综合可解析率：${report.corpus.combinedResolvablePercent}%。`,
  '',
  '## 数据关系',
  '',
  '1. 人工中文索引优先：按表面形、基本形和读音查询。',
  '2. 中文未命中时，回退到 JMdict common 的英文释义。',
  '3. JLPT 数据只提供等级参考，不提供中文或英文释义。',
  '4. 功能词、数字/拉丁字符、未解析专有名词和上下文依赖案例不计入中文覆盖率分母。',
  '',
  '## 中文未命中场景',
  '',
  ...Object.entries(report.corpus.chineseMissesByCategory).map(([category, count]) => `- ${category}: ${count}`),
  '',
  '## 高优先级缺口（前 30）',
  '',
  '| 词 | 读音 | 次数 | 场景 | JLPT | JMdict |',
  '|---|---|---:|---|---|---|',
  ...gaps.slice(0, 30).map(item => `| ${item.word} | ${item.reading || ''} | ${item.count} | ${item.categories.join(', ')} | ${item.jlptLevels.join(', ')} | ${item.jmdictAvailable ? '有' : '无'} |`),
  '',
  '## 下一阶段建议',
  '',
  '1. B2 核验可商用中文数据源、许可证、署名与 ShareAlike 条件。',
  '2. B3 从高频、JLPT 和真实阅读未命中词中建立首批人工审核清单。',
  '3. 专有名词、歧义词和上下文词单独标记，不自动生成正式中文释义。',
  '4. 在电车挑战合并并发布前，不接入运行时 UI 或现有生词模块。',
  ''
];

await mkdir(OUTPUT_DIR, { recursive: true });
await Promise.all([
  writeFile(resolve(OUTPUT_DIR, 'coverage-report.json'), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(resolve(OUTPUT_DIR, 'REPORT.md'), `${reportLines.join('\n')}\n`),
  writeFile(resolve(OUTPUT_DIR, 'high-priority-gaps.json'), `${JSON.stringify({schemaVersion:1, generatedAt:report.generatedAt, items:gaps}, null, 2)}\n`)
]);

process.stdout.write(`Chinese coverage audit complete: ${report.corpus.chineseCoveragePercent}% direct Chinese, ${report.corpus.combinedResolvablePercent}% combined.\n`);
