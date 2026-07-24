#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyApprovalPacket } from './apply-offline-chinese-human-approval.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const queue = JSON.parse(await readFile(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/review-queue.json'), 'utf8'));
const packet = JSON.parse(await readFile(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/human-approval-packet.json'), 'utf8'));

const queueClone = structuredClone(queue);
const completePacket = structuredClone(packet);
for (const [index, item] of completePacket.items.entries()) {
  item.humanReviewer = 'Test Human Reviewer';
  item.humanReviewedAt = '2026-07-24T20:00:00.000Z';
  if (index === 0) {
    item.humanDecision = 'revise';
    item.approvedChinese = `${item.candidateChinese}（修订）`;
    item.humanNotes = 'Test revision.';
  } else if (index === 1) {
    item.humanDecision = 'reject';
    item.approvedChinese = null;
    item.humanNotes = 'Test rejection.';
  } else {
    item.humanDecision = 'approve';
    item.approvedChinese = item.candidateChinese;
    item.humanNotes = null;
  }
}
completePacket.summary = {
  ...completePacket.summary,
  awaitingHumanReview: 0,
  approved: completePacket.items.length - 2,
  revised: 1,
  rejected: 1,
  completed: true
};

const updated = applyApprovalPacket(queueClone, completePacket);
assert.equal(updated.summary.pendingItems, 0);
assert.equal(updated.summary.draftedItems, 0);
assert.equal(updated.summary.approvedItems, 93);
assert.equal(updated.summary.rejectedItems, 1);
assert.equal(updated.summary.blockedItems, 2);
assert.equal(updated.summary.candidateChineseFilled, 93);
assert.deepEqual(updated.summary.reviewerStatusCounts, { approved: 93, blocked: 2, rejected: 1 });

const revised = updated.items.find(item => item.queueId === completePacket.items[0].queueId);
assert.equal(revised.reviewerStatus, 'approved');
assert.match(revised.candidateChinese, /修订/);
assert.equal(revised.reviewer, 'Test Human Reviewer');
assert.match(revised.notes, /Test revision/);

const rejected = updated.items.find(item => item.queueId === completePacket.items[1].queueId);
assert.equal(rejected.reviewerStatus, 'rejected');
assert.equal(rejected.candidateChinese, null);
assert.equal(rejected.rejectionReason, 'Test rejection.');

const incompletePacket = structuredClone(packet);
assert.throws(() => applyApprovalPacket(structuredClone(queue), incompletePacket), /仍有 .* 项未完成真人审核/);

process.stdout.write('Offline Chinese human-approval application gate tests passed.\n');
