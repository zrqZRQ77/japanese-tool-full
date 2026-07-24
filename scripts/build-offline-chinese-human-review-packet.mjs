#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const AUDIT_DIR = resolve(ROOT, 'audits/offline-chinese-coverage/20260723');
const QUEUE_PATH = resolve(AUDIT_DIR, 'review-queue.json');
const PACKET_PATH = resolve(AUDIT_DIR, 'human-approval-packet.json');
const GENERATED_AT = '2026-07-24T00:00:00.000Z';

async function readOptionalJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function confidence(item) {
  return item.notes?.match(/置信度：([^。]+)。/)?.[1] || null;
}

function evidenceSummary(item) {
  return (item.evidence || []).map(evidence => {
    const matchType = evidence.matchType || 'exact-jmdict';
    if (matchType === 'exact-jmdict') return `JMdict exact: ${(evidence.entryIds || []).join(', ')}`;
    if (matchType === 'exact-corpus') return `Yomeru corpus: ${(evidence.caseIds || []).join(', ')}`;
    if (matchType === 'compositional') return `JMdict components: ${(evidence.components || []).map(component => `${component.word}(${component.reading})#${component.entryId}`).join(' + ')}`;
    if (matchType === 'semantic-external') return `${evidence.sourceId}: ${evidence.sourceUrl}`;
    return `${evidence.sourceId}: ${matchType}`;
  });
}

function validPreservedDecision(previous, item, candidateChinese) {
  if (!previous || !['approve', 'revise', 'reject'].includes(previous.humanDecision)) return false;
  return previous.word === item.word
    && previous.reading === item.reading
    && previous.candidateChinese === candidateChinese
    && typeof previous.humanReviewer === 'string'
    && previous.humanReviewer.trim().length > 0
    && typeof previous.humanReviewedAt === 'string'
    && previous.humanReviewedAt.trim().length > 0;
}

function summarize(items, blockedCount) {
  const count = decision => items.filter(item => item.humanDecision === decision).length;
  return {
    awaitingHumanReview: items.filter(item => !item.humanDecision).length,
    blockedExcluded: blockedCount,
    approved: count('approve'),
    revised: count('revise'),
    rejected: count('reject'),
    completed: items.every(item => Boolean(item.humanDecision))
  };
}

const [queue, existingPacket] = await Promise.all([
  readOptionalJson(QUEUE_PATH),
  readOptionalJson(PACKET_PATH)
]);
if (!queue) throw new Error(`Review queue not found: ${QUEUE_PATH}`);

const previousById = new Map((existingPacket?.items || []).map(item => [item.queueId, item]));
const reviewable = queue.items.filter(item => ['drafted', 'approved', 'rejected'].includes(item.reviewerStatus));
const blocked = queue.items.filter(item => item.reviewerStatus === 'blocked');

const packetItems = reviewable.map(item => {
  const previous = previousById.get(item.queueId);
  const candidateChinese = item.candidateChinese || previous?.candidateChinese || null;
  const preserve = validPreservedDecision(previous, item, candidateChinese);
  return {
    queueId: item.queueId,
    priority: item.priority,
    word: item.word,
    reading: item.reading,
    candidateChinese,
    confidence: confidence(item) || previous?.confidence || null,
    evidenceSummary: evidenceSummary(item).length ? evidenceSummary(item) : (previous?.evidenceSummary || []),
    notes: item.notes || previous?.notes || null,
    humanDecision: preserve ? previous.humanDecision : null,
    approvedChinese: preserve ? previous.approvedChinese : null,
    humanReviewer: preserve ? previous.humanReviewer : null,
    humanReviewedAt: preserve ? previous.humanReviewedAt : null,
    humanNotes: preserve ? previous.humanNotes : null
  };
});

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
  summary: summarize(packetItems, blocked.length),
  items: packetItems,
  blockedItems: blocked.map(item => ({
    queueId: item.queueId,
    priority: item.priority,
    word: item.word,
    reading: item.reading,
    rejectionReason: item.rejectionReason,
    nextEvidence: item.notes
  }))
};

const decisionLabel = item => ({
  approve: '通过',
  revise: '修改后通过',
  reject: '拒绝'
}[item.humanDecision] || '待审核');
const rows = packet.items.map(item => (
  `| ${item.queueId} | ${item.priority} | ${item.word} | ${item.reading || ''} | ${item.candidateChinese || '—'} | ${item.confidence || '—'} | ${decisionLabel(item)} |`
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
  '- 重新生成复核包时，词条和候选释义未变化的人工决定会被保留。',
  '',
  '## 摘要',
  '',
  `- 等待真人审核：${packet.summary.awaitingHumanReview}`,
  `- 已通过：${packet.summary.approved}`,
  `- 修改后通过：${packet.summary.revised}`,
  `- 已拒绝：${packet.summary.rejected}`,
  `- blocked 且不进入本轮批准：${packet.summary.blockedExcluded}`,
  '- 自动批准：0',
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
  '- `human-approval-packet.json` 保存每条人工决定。',
  '- 不要直接修改 `review-queue.json` 为 approved；应先完成本复核包，再由门禁转换。'
].join('\n');

await mkdir(AUDIT_DIR, { recursive: true });
await Promise.all([
  writeFile(PACKET_PATH, `${JSON.stringify(packet, null, 2)}\n`),
  writeFile(resolve(AUDIT_DIR, 'HUMAN_APPROVAL_PACKET.md'), `${markdown}\n`)
]);

process.stdout.write(`Human approval packet built: ${packet.summary.awaitingHumanReview} awaiting, ${packet.summary.approved + packet.summary.revised + packet.summary.rejected} decided, ${blocked.length} blocked.\n`);
