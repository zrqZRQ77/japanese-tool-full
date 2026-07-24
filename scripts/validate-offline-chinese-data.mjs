#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const FRONTEND = resolve(ROOT, 'frontend');
const AUDIT_DIR = resolve(ROOT, 'audits/offline-chinese-coverage/20260723');
const CHINESE_DIR = resolve(FRONTEND, 'data/chinese-definitions/20260717');
const GENERATED_AT = '2026-07-23T00:00:00.000Z';

const paths = {
  dictionary: resolve(FRONTEND, 'data/dictionary.json'),
  supplement: resolve(FRONTEND, 'data/chinese-definitions-source.json'),
  chineseMetadata: resolve(CHINESE_DIR, 'metadata.json'),
  reviewQueue: resolve(AUDIT_DIR, 'review-queue.json'),
  sourceRegistry: resolve(AUDIT_DIR, 'source-registry.json')
};

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function hashFile(path) {
  const data = await readFile(path);
  return createHash('sha256').update(data).digest('hex');
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function addFinding(target, code, message, details = {}) {
  target.push({ code, message, ...details });
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
}

async function loadChineseForms() {
  const files = (await readdir(CHINESE_DIR)).filter(file => /^shard-\d+\.json$/.test(file)).sort();
  const forms = new Map();
  for (const file of files) {
    const shard = await readJson(resolve(CHINESE_DIR, file));
    for (const [form, entries] of Object.entries(shard)) forms.set(form, entries);
  }
  return { files, forms };
}

const [dictionary, supplementPayload, metadata, queue, registry, chineseIndex, inputHashes] = await Promise.all([
  readJson(paths.dictionary),
  readJson(paths.supplement),
  readJson(paths.chineseMetadata),
  readJson(paths.reviewQueue),
  readJson(paths.sourceRegistry),
  loadChineseForms(),
  Promise.all(Object.entries(paths).map(async ([name, path]) => [name, await hashFile(path)]))
]);

const supplement = supplementPayload.entries || {};
const errors = [];
const warnings = [];
const notes = [];

for (const [word, entry] of Object.entries(dictionary)) {
  if (!nonEmptyString(word)) addFinding(errors, 'dictionary-empty-key', '基础词典存在空键。');
  if (!nonEmptyString(entry?.reading)) addFinding(errors, 'dictionary-empty-reading', '基础词典缺少读音。', { word });
  if (!nonEmptyString(entry?.meaning)) addFinding(errors, 'dictionary-empty-meaning', '基础词典缺少中文释义。', { word });
  if (!nonEmptyString(entry?.pos)) addFinding(warnings, 'dictionary-empty-pos', '基础词典缺少词性。', { word });
}

for (const [word, entry] of Object.entries(supplement)) {
  if (!nonEmptyString(word)) addFinding(errors, 'supplement-empty-key', '补充词典存在空键。');
  if (!nonEmptyString(entry?.reading)) addFinding(errors, 'supplement-empty-reading', '补充词典缺少读音。', { word });
  if (!nonEmptyString(entry?.meaning)) addFinding(errors, 'supplement-empty-meaning', '补充词典缺少中文释义。', { word });
  if (!nonEmptyString(entry?.pos)) addFinding(warnings, 'supplement-empty-pos', '补充词典缺少词性。', { word });
}

const overlaps = Object.keys(supplement).filter(word => Object.hasOwn(dictionary, word)).sort((a, b) => a.localeCompare(b, 'ja'));
if (overlaps.length) addFinding(warnings, 'curated-source-overlap', '基础词典与补充词典存在同词键，构建时需要明确覆盖顺序。', { words: overlaps });

if (metadata.indexedEntryCount !== new Set([...Object.keys(dictionary), ...Object.keys(supplement)]).size) {
  addFinding(errors, 'indexed-entry-count-mismatch', '中文索引词条数与去重后的人工来源词条数不一致。', {
    metadataCount: metadata.indexedEntryCount,
    expectedCount: new Set([...Object.keys(dictionary), ...Object.keys(supplement)]).size
  });
}
if (metadata.formCount !== chineseIndex.forms.size) {
  addFinding(errors, 'indexed-form-count-mismatch', '中文索引 metadata.formCount 与分片实际形式数不一致。', {
    metadataCount: metadata.formCount,
    actualCount: chineseIndex.forms.size
  });
}
if (metadata.shardCount !== chineseIndex.files.length) {
  addFinding(errors, 'indexed-shard-count-mismatch', '中文索引 metadata.shardCount 与实际分片数不一致。', {
    metadataCount: metadata.shardCount,
    actualCount: chineseIndex.files.length
  });
}

const sourceIds = registry.sources.map(source => source.id);
for (const duplicate of duplicates(sourceIds)) addFinding(errors, 'duplicate-source-id', '来源注册表存在重复 source id。', duplicate);
const sourceIdSet = new Set(sourceIds);
const allowedStatuses = new Set(['approved-primary', 'approved-attributed-layer', 'approved-structured-facts', 'conditional-isolated-evidence', 'conditional-example-evidence', 'draft-only', 'prohibited']);
for (const source of registry.sources) {
  if (!allowedStatuses.has(source.status)) addFinding(errors, 'invalid-source-status', '来源注册表存在未知状态。', { sourceId: source.id, status: source.status });
  if (!nonEmptyString(source.licenseClass)) addFinding(errors, 'missing-source-license', '来源注册表缺少 licenseClass。', { sourceId: source.id });
}

const queueIds = queue.items.map(item => item.queueId);
const queueKeys = queue.items.map(item => `${item.word}\u0000${item.reading || ''}`);
for (const duplicate of duplicates(queueIds)) addFinding(errors, 'duplicate-queue-id', '审核队列存在重复 queueId。', duplicate);
for (const duplicate of duplicates(queueKeys)) addFinding(errors, 'duplicate-word-reading', '审核队列存在重复词形与读音。', duplicate);

const validPriorities = new Set(['P0', 'P1', 'P2', 'P3']);
const validReviewerStatuses = new Set(['pending', 'drafted', 'approved', 'rejected']);
const queueAlreadyCovered = [];
const homophoneGroups = new Map();
const readingsByWord = new Map();
let multiPosEvidence = 0;

for (const item of queue.items) {
  if (!validPriorities.has(item.priority)) addFinding(errors, 'invalid-priority', '审核队列存在未知优先级。', { queueId: item.queueId, priority: item.priority });
  if (!validReviewerStatuses.has(item.reviewerStatus)) addFinding(errors, 'invalid-reviewer-status', '审核队列存在未知审核状态。', { queueId: item.queueId, reviewerStatus: item.reviewerStatus });
  if (!nonEmptyString(item.word)) addFinding(errors, 'queue-empty-word', '审核队列存在空词形。', { queueId: item.queueId });
  if (item.reading && !nonEmptyString(item.reading)) addFinding(errors, 'queue-invalid-reading', '审核队列读音格式无效。', { queueId: item.queueId });
  if (chineseIndex.forms.has(item.word) || (item.reading && chineseIndex.forms.has(item.reading))) queueAlreadyCovered.push(item.queueId);

  for (const evidence of item.evidence || []) {
    if (!sourceIdSet.has(evidence.sourceId)) addFinding(errors, 'unknown-evidence-source', '审核证据引用未注册来源。', { queueId: item.queueId, sourceId: evidence.sourceId });
    if (!nonEmptyString(evidence.license)) addFinding(errors, 'evidence-missing-license', '审核证据缺少许可。', { queueId: item.queueId, sourceId: evidence.sourceId });
    if (!Array.isArray(evidence.englishGlosses) || !evidence.englishGlosses.length) addFinding(errors, 'evidence-empty-glosses', 'JMdict 审核证据缺少英文释义。', { queueId: item.queueId });
    if ((evidence.partsOfSpeech || []).length > 1) multiPosEvidence += 1;
  }

  if (!item.evidence?.length && item.reviewType !== 'manual-research-required') addFinding(errors, 'missing-evidence-without-manual-flag', '无证据项目没有标记为人工调查。', { queueId: item.queueId });
  if (item.reviewType === 'manual-research-required' && item.evidence?.length) addFinding(errors, 'manual-research-has-evidence', '人工调查项目意外包含标准证据。', { queueId: item.queueId });

  if (item.reviewerStatus === 'pending') {
    if (item.candidateChinese !== null) addFinding(errors, 'pending-has-candidate', 'pending 项目不应包含正式中文候选。', { queueId: item.queueId });
    if (item.reviewer || item.reviewedAt || item.decision) addFinding(errors, 'pending-has-review-metadata', 'pending 项目不应包含审核完成字段。', { queueId: item.queueId });
  }
  if (item.reviewerStatus === 'drafted') {
    if (!nonEmptyString(item.candidateChinese)) addFinding(errors, 'drafted-empty-candidate', 'drafted 项目必须包含中文候选。', { queueId: item.queueId });
    if (!nonEmptyString(item.reviewer) || !nonEmptyString(item.reviewedAt)) addFinding(errors, 'drafted-missing-reviewer', 'drafted 项目缺少审核代理或时间。', { queueId: item.queueId });
    if (!item.evidence?.length) addFinding(errors, 'drafted-missing-evidence', 'drafted 项目缺少证据。', { queueId: item.queueId });
    if (item.decision !== 'recommend-approve') addFinding(errors, 'drafted-invalid-decision', '当前 drafted 项目的 decision 必须为 recommend-approve。', { queueId: item.queueId });
    if (!item.notes?.includes('置信度：')) addFinding(errors, 'drafted-missing-confidence', 'drafted 项目必须在 notes 中记录置信度。', { queueId: item.queueId });
  }
  if (item.reviewerStatus === 'approved') {
    if (!nonEmptyString(item.candidateChinese)) addFinding(errors, 'approved-empty-candidate', 'approved 项目缺少中文释义。', { queueId: item.queueId });
    if (!nonEmptyString(item.reviewer) || !nonEmptyString(item.reviewedAt)) addFinding(errors, 'approved-missing-reviewer', 'approved 项目缺少审核人或时间。', { queueId: item.queueId });
    if (!item.evidence?.length) addFinding(errors, 'approved-missing-evidence', 'approved 项目缺少证据。', { queueId: item.queueId });
    if (item.decision !== 'approve') addFinding(errors, 'approved-invalid-decision', 'approved 项目的 decision 必须为 approve。', { queueId: item.queueId });
  }
  if (item.reviewerStatus === 'rejected' && !nonEmptyString(item.rejectionReason)) addFinding(errors, 'rejected-missing-reason', 'rejected 项目缺少拒绝原因。', { queueId: item.queueId });

  if (item.reading) {
    const group = homophoneGroups.get(item.reading) || [];
    group.push(item.word);
    homophoneGroups.set(item.reading, group);

    const readings = readingsByWord.get(item.word) || [];
    readings.push(item.reading);
    readingsByWord.set(item.word, readings);
  }
}

if (queueAlreadyCovered.length) addFinding(errors, 'queue-already-covered', '审核队列中存在已被中文索引覆盖的词形或读音。', { queueIds: queueAlreadyCovered });

const homophones = [...homophoneGroups.entries()]
  .filter(([, words]) => new Set(words).size > 1)
  .map(([reading, words]) => ({ reading, words: [...new Set(words)].sort((a, b) => a.localeCompare(b, 'ja')) }))
  .sort((a, b) => a.reading.localeCompare(b.reading, 'ja'));
const sameWrittenFormGroups = [...readingsByWord.entries()]
  .filter(([, readings]) => new Set(readings).size > 1)
  .map(([word, readings]) => ({ word, readings: [...new Set(readings)].sort((a, b) => a.localeCompare(b, 'ja')) }))
  .sort((a, b) => a.word.localeCompare(b.word, 'ja'));
if (homophones.length) addFinding(notes, 'homophone-review-groups', '审核队列中存在需要分别处理的同音词组。', { groups: homophones });
if (sameWrittenFormGroups.length) addFinding(notes, 'same-written-form-review-groups', '审核队列中存在需要按读音分别处理的同形异读词组。', { groups: sameWrittenFormGroups });
if (multiPosEvidence) addFinding(notes, 'multi-pos-evidence', '部分 JMdict 证据包含多个词性，审核时需要按义项选择。', { itemCount: multiPosEvidence });

const inputHashMap = Object.fromEntries(inputHashes);
const report = {
  schemaVersion: 1,
  generatedAt: GENERATED_AT,
  baseline: {
    mainCommit: '6a821a65d56af7576e4312ef4b1df33eb6d889f4',
    chineseDataVersion: metadata.dataVersion,
    reviewQueueVersion: '20260723'
  },
  inputSha256: inputHashMap,
  summary: {
    valid: errors.length === 0,
    errors: errors.length,
    warnings: warnings.length,
    notes: notes.length,
    dictionaryEntries: Object.keys(dictionary).length,
    supplementEntries: Object.keys(supplement).length,
    curatedOverlaps: overlaps.length,
    indexedEntries: metadata.indexedEntryCount,
    indexedForms: metadata.formCount,
    reviewQueueItems: queue.items.length,
    reviewedItems: queue.items.filter(item => item.reviewerStatus !== 'pending').length,
    pendingItems: queue.items.filter(item => item.reviewerStatus === 'pending').length,
    draftedItems: queue.items.filter(item => item.reviewerStatus === 'drafted').length,
    approvedItems: queue.items.filter(item => item.reviewerStatus === 'approved').length,
    rejectedItems: queue.items.filter(item => item.reviewerStatus === 'rejected').length,
    homophoneGroups: homophones.length,
    sameWrittenFormGroups: sameWrittenFormGroups.length,
    multiPosEvidenceItems: multiPosEvidence
  },
  errors,
  warnings,
  notes
};

const markdown = [
  '# Yomeru 离线中文数据质量报告',
  '',
  `Generated: ${GENERATED_AT}`,
  '',
  '## 结论',
  '',
  `- 状态：${report.summary.valid ? 'PASS' : 'FAIL'}`,
  `- 错误：${report.summary.errors}`,
  `- 警告：${report.summary.warnings}`,
  `- 信息项：${report.summary.notes}`,
  `- 当前审核队列：${report.summary.reviewQueueItems} 项；逐项审核 ${report.summary.reviewedItems} 项，其中 drafted ${report.summary.draftedItems}、approved ${report.summary.approvedItems}、pending ${report.summary.pendingItems}。`,
  `- 中文索引：${report.summary.indexedEntries} 条、${report.summary.indexedForms} 个检索形式。`,
  '',
  '## 警告',
  '',
  ...(warnings.length ? warnings.map(item => `- ${item.code}: ${item.message}${item.words ? `（${item.words.join('、')}）` : ''}`) : ['- 无']),
  '',
  '## 信息项',
  '',
  ...(notes.length ? notes.map(item => `- ${item.code}: ${item.message}`) : ['- 无']),
  '',
  '## 门禁说明',
  '',
  '- pending 项目必须保持中文候选为空。',
  '- drafted 项目必须有中文草稿、证据、审核代理、时间、建议结论和置信度，但不得进入正式中文发布层。',
  '- approved 项目必须有中文释义、证据、人工审核人、审核时间和 approve 决定。',
  '- rejected 项目必须填写拒绝原因。',
  '- 审核证据只能引用来源注册表中的 sourceId。',
  '- 已被中文索引覆盖的词不得继续留在缺口审核队列。',
  '- 同音词和多词性证据不自动报错，但必须在人工审核时分别处理。'
].join('\n');

await mkdir(AUDIT_DIR, { recursive: true });
await Promise.all([
  writeFile(resolve(AUDIT_DIR, 'data-quality-report.json'), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(resolve(AUDIT_DIR, 'DATA_QUALITY_REPORT.md'), `${markdown}\n`)
]);

process.stdout.write(`Offline Chinese data quality: ${report.summary.valid ? 'PASS' : 'FAIL'} (${errors.length} errors, ${warnings.length} warnings).\n`);
if (errors.length) process.exitCode = 1;
