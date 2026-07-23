#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const AUDIT_DIR = resolve(ROOT, 'audits/offline-chinese-coverage/20260723');
const JMDICT_DIR = resolve(ROOT, 'frontend/data/jmdict-common/20260713');
const GAPS_PATH = resolve(AUDIT_DIR, 'high-priority-gaps.json');
const GENERATED_AT = '2026-07-23T00:00:00.000Z';

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function loadJmdictIndex() {
  const files = (await readdir(JMDICT_DIR)).filter(file => /^shard-\d+\.json$/.test(file)).sort();
  const index = new Map();
  for (const file of files) {
    const shard = await readJson(resolve(JMDICT_DIR, file));
    for (const [form, entries] of Object.entries(shard)) {
      const existing = index.get(form) || [];
      index.set(form, [...existing, ...entries]);
    }
  }
  return index;
}

function matchingEntries(gap, index) {
  const entries = [...(index.get(gap.word) || []), ...(index.get(gap.reading) || [])];
  const byId = new Map();
  for (const entry of entries) {
    const key = String(entry.id || `${entry.w}:${entry.r}:${(entry.g || []).join('|')}`);
    if (!byId.has(key)) byId.set(key, entry);
  }
  const uniqueEntries = [...byId.values()];
  const exact = uniqueEntries.filter(entry => entry.w === gap.word && (!gap.reading || entry.r === gap.reading));
  const headword = uniqueEntries.filter(entry => entry.w === gap.word);
  const selected = exact.length ? exact : (headword.length ? headword : uniqueEntries.filter(entry => entry.r === gap.reading));
  return selected.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function priorityTier(gap) {
  if (gap.count >= 3) return 'P0';
  if (gap.count >= 2 || gap.jlptLevels.some(level => ['N5', 'N4'].includes(level))) return 'P1';
  if (gap.jmdictAvailable) return 'P2';
  return 'P3';
}

function riskFlags(gap, entries) {
  const flags = [];
  if (gap.categories.includes('ambiguity')) flags.push('ambiguity');
  if (entries.length > 1) flags.push('multiple-jmdict-entries');
  const readings = unique(entries.map(entry => entry.r));
  if (readings.length > 1) flags.push('multiple-readings');
  const glossGroups = unique(entries.flatMap(entry => entry.g || []));
  if (glossGroups.length >= 6) flags.push('broad-sense-range');
  if (!entries.length) flags.push('no-jmdict-evidence');
  if (gap.categories.includes('proper-nouns')) flags.push('proper-name');
  if (gap.categories.includes('unknown')) flags.push('unknown-token');
  return flags;
}

function reviewType(gap, entries, flags) {
  if (!entries.length) return 'manual-research-required';
  if (flags.includes('proper-name')) return 'entity-disambiguation';
  if (flags.some(flag => ['ambiguity', 'multiple-jmdict-entries', 'multiple-readings', 'broad-sense-range'].includes(flag))) return 'sense-disambiguation';
  if (gap.count >= 2 || gap.jlptLevels.length) return 'high-frequency-lexical';
  return 'standard-lexical';
}

function queueItem(gap, index, position) {
  const entries = matchingEntries(gap, index);
  const flags = riskFlags(gap, entries);
  const EnglishGlosses = unique(entries.flatMap(entry => entry.g || [])).slice(0, 16);
  const partsOfSpeech = unique(entries.flatMap(entry => entry.p || [])).sort();
  return {
    queueId: `zh-review-${String(position + 1).padStart(3, '0')}`,
    priority: priorityTier(gap),
    word: gap.word,
    reading: gap.reading || null,
    corpusFrequency: gap.count,
    corpusCategories: gap.categories,
    jlptLevels: gap.jlptLevels,
    exampleCaseIds: gap.examples,
    reviewType: reviewType(gap, entries, flags),
    riskFlags: flags,
    evidence: entries.length ? [{
      sourceId: 'jmdict-edrdg',
      license: 'CC-BY-SA-4.0',
      entryIds: entries.map(entry => String(entry.id)),
      headwords: unique(entries.map(entry => entry.w)),
      readings: unique(entries.map(entry => entry.r)),
      partsOfSpeech,
      englishGlosses: EnglishGlosses,
      sourceUrl: 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project',
      retrievedAt: '2026-07-23'
    }] : [],
    candidateChinese: null,
    reviewerStatus: 'pending',
    reviewer: null,
    reviewedAt: null,
    decision: null,
    rejectionReason: null,
    notes: flags.includes('no-jmdict-evidence')
      ? '需要独立人工调查；不得由 AI 自动生成正式释义。'
      : 'JMdict 英文只作审核证据；中文措辞必须独立人工确认。'
  };
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = typeof key === 'function' ? key(item) : item[key];
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

const [gapPayload, jmdictIndex] = await Promise.all([readJson(GAPS_PATH), loadJmdictIndex()]);
const items = gapPayload.items.map((gap, index) => queueItem(gap, jmdictIndex, index));
const queue = {
  schemaVersion: 1,
  generatedAt: GENERATED_AT,
  baseline: {
    mainCommit: '01ccdb78c9988a9513199344439d5d5240c758f3',
    coverageAudit: '20260723',
    jmdictDataVersion: '20260713',
    sourceRegistry: 'audits/offline-chinese-coverage/20260723/source-registry.json'
  },
  policy: {
    officialChineseLayer: 'human-reviewed-yomeru-curated-only',
    automaticApprovalAllowed: false,
    aiDraftAllowed: true,
    aiDraftPublishAllowed: false,
    requiredReviewerStatus: 'approved',
    requiredEvidenceCount: 1
  },
  summary: {
    totalItems: items.length,
    priorityCounts: countBy(items, 'priority'),
    reviewTypeCounts: countBy(items, 'reviewType'),
    withJmdictEvidence: items.filter(item => item.evidence.length).length,
    manualResearchRequired: items.filter(item => !item.evidence.length).length,
    ambiguityReview: items.filter(item => item.reviewType === 'sense-disambiguation').length,
    candidateChineseFilled: items.filter(item => item.candidateChinese).length
  },
  items
};

const markdown = [
  '# Yomeru 离线中文释义人工审核队列',
  '',
  `Generated: ${GENERATED_AT}`,
  '',
  '## 队列规则',
  '',
  '- 所有项目初始状态为 `pending`。',
  '- `candidateChinese` 初始为空，不自动生成正式中文释义。',
  '- JMdict 英文释义只作审核证据，不能直接替代中文审核。',
  '- 歧义词、多读音、多 JMdict 条目和宽泛义项必须逐义项处理。',
  '- 无 JMdict 证据的项目需要独立人工调查。',
  '- 只有状态改为 `approved` 且有证据、审核人和审核时间，才能进入正式中文数据。',
  '',
  '## 摘要',
  '',
  `- 总项目：${queue.summary.totalItems}`,
  `- P0：${queue.summary.priorityCounts.P0 || 0}`,
  `- P1：${queue.summary.priorityCounts.P1 || 0}`,
  `- P2：${queue.summary.priorityCounts.P2 || 0}`,
  `- P3：${queue.summary.priorityCounts.P3 || 0}`,
  `- 有 JMdict 证据：${queue.summary.withJmdictEvidence}`,
  `- 需独立人工调查：${queue.summary.manualResearchRequired}`,
  `- 歧义审核：${queue.summary.ambiguityReview}`,
  '',
  '## 前 40 项',
  '',
  '| ID | 优先级 | 词 | 读音 | 次数 | JLPT | 审核类型 | 英文证据 | 风险 |',
  '|---|---|---|---|---:|---|---|---|---|',
  ...items.slice(0, 40).map(item => {
    const glosses = item.evidence[0]?.englishGlosses?.slice(0, 4).join('; ') || '—';
    return `| ${item.queueId} | ${item.priority} | ${item.word} | ${item.reading || ''} | ${item.corpusFrequency} | ${item.jlptLevels.join(', ') || '—'} | ${item.reviewType} | ${glosses} | ${item.riskFlags.join(', ') || '—'} |`;
  }),
  '',
  '## 审核动作',
  '',
  '1. 确认目标词形和读音。',
  '2. 对照语料案例和 JMdict 证据划分义项。',
  '3. 必要时使用 Wikidata、Wiktionary 或 Tatoeba 的隔离证据层补充核验。',
  '4. 独立编写自然、简洁、适合学习者的中文释义。',
  '5. 填写审核人、时间、决定和必要备注。',
  '6. 通过数据质量门禁后才允许进入正式中文发布层。'
].join('\n');

await mkdir(AUDIT_DIR, { recursive: true });
await Promise.all([
  writeFile(resolve(AUDIT_DIR, 'review-queue.json'), `${JSON.stringify(queue, null, 2)}\n`),
  writeFile(resolve(AUDIT_DIR, 'REVIEW_QUEUE.md'), `${markdown}\n`)
]);

process.stdout.write(`Review queue built: ${items.length} items, ${queue.summary.withJmdictEvidence} with JMdict evidence.\n`);
