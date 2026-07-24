#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const AUDIT_DIR = resolve(ROOT, 'audits/offline-chinese-coverage/20260723');
const QUEUE_PATH = resolve(AUDIT_DIR, 'review-queue.json');
const GENERATED_AT = '2026-07-24T00:00:00.000Z';

const queue = JSON.parse(await readFile(QUEUE_PATH, 'utf8'));
const drafted = queue.items.filter(item => item.reviewerStatus === 'drafted');
const blocked = queue.items.filter(item => item.reviewerStatus === 'blocked');

function confidence(item) {
  return item.notes?.match(/置信度：([^。]+)。/)?.[1] || null;
}

function evidenceSummary(item) {
  return item.evidence.map(evidence => {
    const matchType = evidence.matchType || 'exact-jmdict';
    if (matchType === 'exact-jmdict') return `JMdict exact: ${(evidence.entryIds || []).join(', ')}`;
    if (matchType === 'exact-corpus') return `Yomeru corpus: ${(evidence.caseIds || []).join(', ')}`;
    if (matchType === 'compositional') return `JMdict components: ${(evidence.components || []).map(component => `${component.word}(${component.reading})#${component.entryId}`).join(' + ')}`;
    if (matchType === 'semantic-external') return `${evidence.sourceId}: ${evidence.sourceUrl}`;
    return `${evidence.sourceId}: ${matchType}`;
  });
}

const packet = {
  schemaVersion: 1,
  generatedAt: GENERATED_AT,
  sourceQueue: 'audits/offline-chinese-coverage/20260723/review-queue.json',
  policy: {
    automaticApprovalAllowed: false,
    requiredHumanDecision: true,
    allowedDecisions: ['approve', 'revise', 'reject'],
    approvalRequiresReviewer: true,
    approvalRequiresReviewedAt: true,
    approvalRequiresEvidenceCheck: true
  },
  summary: {
    awaitingHumanReview: drafted.length,
    blockedExcluded: blocked.length,
    approved: 0,
    revised: 0,
    rejected: 0
  },
  items: drafted.map(item => ({
    queueId: item.queueId,
    priority: item.priority,
    word: item.word,
    reading: item.reading,
    candidateChinese: item.candidateChinese,
    confidence: confidence(item),
    evidenceSummary: evidenceSummary(item),
    notes: item.notes,
    humanDecision: null,
    approvedChinese: null,
    humanReviewer: null,
    humanReviewedAt: null,
    humanNotes: null
  })),
  blockedItems: blocked.map(item => ({
    queueId: item.queueId,
    priority: item.priority,
    word: item.word,
    reading: item.reading,
    rejectionReason: item.rejectionReason,
    nextEvidence: item.notes
  }))
};

const rows = packet.items.map(item => (
  `| ${item.queueId} | ${item.priority} | ${item.word} | ${item.reading || ''} | ${item.candidateChinese} | ${item.confidence || '—'} | 待审核 |`
));
const blockedRows = packet.blockedItems.map(item => (
  `| ${item.queueId} | ${item.word} | ${item.reading || ''} | ${item.rejectionReason} |`
));

const markdown = [
  '# Yomeru 离线中文词库真实人工复核包',
  '',
  `Generated: ${GENERATED_AT}`,
  '',
  '## 使用规则',
  '',
  '- 本文件不包含任何自动批准。',
  '- 真人审核者必须逐条选择：approve、revise 或 reject。',
  '- approve：确认日文表记、读音、词性、语义范围、中文措辞、同音/同形风险和许可证证据均可靠。',
  '- revise：填写修改后的 approvedChinese 和修改理由。',
  '- reject：填写拒绝理由，不进入正式中文词库。',
  '- 只有填写 humanReviewer、humanReviewedAt 和 humanDecision 后，后续脚本才允许转换为正式 approved。',
  '',
  '## 摘要',
  '',
  `- 等待真人审核：${packet.summary.awaitingHumanReview}`,
  `- blocked 且不进入本轮批准：${packet.summary.blockedExcluded}`,
  `- 自动批准：0`,
  '',
  '## 待审核项目',
  '',
  '| ID | 优先级 | 日文 | 读音 | 中文草稿 | 置信度 | 人工决定 |',
  '|---|---|---|---|---|---|---|',
  ...rows,
  '',
  '## Blocked 项目',
  '',
  '| ID | 日文 | 读音 | 阻断原因 |',
  '|---|---|---|---|',
  ...blockedRows,
  '',
  '## 机器可编辑文件',
  '',
  '- `human-approval-packet.json` 包含每条审核项目的空人工决定字段。',
  '- 不要直接修改 `review-queue.json` 为 approved；应先填写人工复核包，再由后续门禁脚本转换。'
].join('\n');

await mkdir(AUDIT_DIR, { recursive: true });
await Promise.all([
  writeFile(resolve(AUDIT_DIR, 'human-approval-packet.json'), `${JSON.stringify(packet, null, 2)}\n`),
  writeFile(resolve(AUDIT_DIR, 'HUMAN_APPROVAL_PACKET.md'), `${markdown}\n`)
]);

process.stdout.write(`Human approval packet built: ${drafted.length} awaiting review, ${blocked.length} blocked.\n`);
