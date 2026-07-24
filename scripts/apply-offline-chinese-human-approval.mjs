#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const AUDIT_DIR = resolve(ROOT, 'audits/offline-chinese-coverage/20260723');
const DEFAULT_QUEUE_PATH = resolve(AUDIT_DIR, 'review-queue.json');
const DEFAULT_PACKET_PATH = resolve(AUDIT_DIR, 'human-approval-packet.json');

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = typeof key === 'function' ? key(item) : item[key];
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function requireCompleteHumanDecision(item) {
  if (!['approve', 'revise', 'reject'].includes(item.humanDecision)) {
    throw new Error(`尚未完成真人审核：${item.queueId} ${item.word}（${item.reading || ''}）`);
  }
  if (!item.humanReviewer || !item.humanReviewedAt) {
    throw new Error(`人工审核元数据不完整：${item.queueId}`);
  }
  if (item.humanDecision !== 'reject' && !item.approvedChinese) {
    throw new Error(`通过项目缺少最终中文释义：${item.queueId}`);
  }
  if (['revise', 'reject'].includes(item.humanDecision) && !item.humanNotes) {
    throw new Error(`修改或拒绝项目缺少人工说明：${item.queueId}`);
  }
}

export function applyApprovalPacket(queue, packet) {
  if (!queue || !Array.isArray(queue.items)) throw new Error('审核队列格式无效。');
  if (!packet || !Array.isArray(packet.items)) throw new Error('人工复核包格式无效。');
  if (packet.items.length !== 94) throw new Error(`人工复核包项目数异常：${packet.items.length}`);
  if (packet.summary?.awaitingHumanReview !== 0) {
    throw new Error(`仍有 ${packet.summary?.awaitingHumanReview ?? '未知数量'} 项未完成真人审核。`);
  }

  const queueById = new Map(queue.items.map(item => [item.queueId, item]));
  for (const decision of packet.items) {
    requireCompleteHumanDecision(decision);
    const target = queueById.get(decision.queueId);
    if (!target) throw new Error(`审核队列缺少项目：${decision.queueId}`);
    if (target.word !== decision.word || target.reading !== decision.reading) {
      throw new Error(`人工复核包与审核队列词形不一致：${decision.queueId}`);
    }
    if (target.reviewerStatus === 'blocked') {
      throw new Error(`blocked 项目不得通过人工复核包转换：${decision.queueId}`);
    }

    const humanNote = decision.humanNotes ? `人工审核备注：${decision.humanNotes}` : '人工审核备注：无修改。';
    target.reviewer = decision.humanReviewer;
    target.reviewedAt = decision.humanReviewedAt;
    target.notes = `${target.notes || ''}${target.notes ? ' ' : ''}${humanNote}`;

    if (decision.humanDecision === 'reject') {
      target.reviewerStatus = 'rejected';
      target.candidateChinese = null;
      target.decision = 'reject';
      target.rejectionReason = decision.humanNotes;
    } else {
      target.reviewerStatus = 'approved';
      target.candidateChinese = decision.approvedChinese;
      target.decision = 'approve';
      target.rejectionReason = null;
    }
  }

  const pendingItems = queue.items.filter(item => item.reviewerStatus === 'pending');
  const draftedItems = queue.items.filter(item => item.reviewerStatus === 'drafted');
  const approvedItems = queue.items.filter(item => item.reviewerStatus === 'approved');
  const rejectedItems = queue.items.filter(item => item.reviewerStatus === 'rejected');
  const blockedItems = queue.items.filter(item => item.reviewerStatus === 'blocked');

  queue.summary = {
    ...queue.summary,
    remainingPriorityCounts: countBy(pendingItems, 'priority'),
    draftedPriorityCounts: countBy(draftedItems, 'priority'),
    approvedPriorityCounts: countBy(approvedItems, 'priority'),
    rejectedPriorityCounts: countBy(rejectedItems, 'priority'),
    reviewerStatusCounts: countBy(queue.items, 'reviewerStatus'),
    reviewedItems: queue.items.length - pendingItems.length,
    pendingItems: pendingItems.length,
    draftedItems: draftedItems.length,
    approvedItems: approvedItems.length,
    rejectedItems: rejectedItems.length,
    blockedItems: blockedItems.length,
    candidateChineseFilled: queue.items.filter(item => item.candidateChinese).length
  };
  return queue;
}

export async function applyApprovalFiles({
  queuePath = DEFAULT_QUEUE_PATH,
  packetPath = DEFAULT_PACKET_PATH
} = {}) {
  const [queue, packet] = await Promise.all([
    readFile(queuePath, 'utf8').then(JSON.parse),
    readFile(packetPath, 'utf8').then(JSON.parse)
  ]);
  const updated = applyApprovalPacket(queue, packet);
  await writeFile(queuePath, `${JSON.stringify(updated, null, 2)}\n`);
  return updated;
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const updated = await applyApprovalFiles();
  process.stdout.write(`Human approval applied: ${updated.summary.approvedItems} approved, ${updated.summary.rejectedItems} rejected, ${updated.summary.blockedItems} blocked.\n`);
}
