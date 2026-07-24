#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
execFileSync(process.execPath, [resolve(ROOT, 'scripts/audit-offline-chinese-coverage.mjs')], { cwd: ROOT, stdio: 'pipe' });
execFileSync(process.execPath, [resolve(ROOT, 'scripts/build-offline-chinese-review-queue.mjs')], { cwd: ROOT, stdio: 'pipe' });
execFileSync(process.execPath, [resolve(ROOT, 'scripts/build-offline-chinese-human-review-packet.mjs')], { cwd: ROOT, stdio: 'pipe' });

const packet = JSON.parse(readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/human-approval-packet.json'), 'utf8'));
const markdown = readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/HUMAN_APPROVAL_PACKET.md'), 'utf8');
const allowedDecisions = new Set(['approve', 'revise', 'reject']);

assert.equal(packet.schemaVersion, 1);
assert.equal(packet.policy.automaticApprovalAllowed, false);
assert.equal(packet.policy.requiredHumanDecision, true);
assert.deepEqual(packet.policy.allowedDecisions, ['approve', 'revise', 'reject']);
assert.equal(packet.summary.blockedExcluded, 2);
assert.equal(packet.items.length, 94);
assert.equal(packet.blockedItems.length, 2);
assert.equal(new Set(packet.items.map(item => item.queueId)).size, packet.items.length);
assert.equal(
  packet.summary.awaitingHumanReview + packet.summary.approved + packet.summary.revised + packet.summary.rejected,
  packet.items.length
);
assert.equal(packet.summary.completed, packet.summary.awaitingHumanReview === 0);
assert.ok(packet.items.every(item => item.candidateChinese && item.confidence && item.evidenceSummary.length));

for (const item of packet.items) {
  if (!item.humanDecision) {
    assert.equal(item.approvedChinese, null);
    assert.equal(item.humanReviewer, null);
    assert.equal(item.humanReviewedAt, null);
    continue;
  }
  assert.ok(allowedDecisions.has(item.humanDecision));
  assert.ok(item.humanReviewer);
  assert.ok(item.humanReviewedAt);
  if (item.humanDecision === 'reject') {
    assert.equal(item.approvedChinese, null);
    assert.ok(item.humanNotes);
  } else {
    assert.ok(item.approvedChinese);
  }
  if (item.humanDecision === 'revise') assert.ok(item.humanNotes);
}

assert.deepEqual(packet.blockedItems.map(item => `${item.word}\u0000${item.reading}`).sort(), ['一日\u0000ついたち', '人気\u0000ひとけ'].sort());
assert.match(markdown, /本文件不包含任何自动批准/);
assert.match(markdown, /自动批准：0/);
assert.match(markdown, /重新生成复核包时.*人工决定会被保留/);
assert.match(markdown, /不要直接修改 `review-queue.json` 为 approved/);

process.stdout.write('Offline Chinese human-approval packet gate tests passed.\n');
