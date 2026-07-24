#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createReviewServer } from './offline-chinese-human-review-server.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const sourcePacket = JSON.parse(await readFile(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/human-approval-packet.json'), 'utf8'));
for (const item of sourcePacket.items) {
  item.humanDecision = null;
  item.approvedChinese = null;
  item.humanReviewer = null;
  item.humanReviewedAt = null;
  item.humanNotes = null;
}
sourcePacket.summary = {
  ...sourcePacket.summary,
  awaitingHumanReview: sourcePacket.items.length,
  approved: 0,
  revised: 0,
  rejected: 0,
  completed: false
};

const tempDir = await mkdtemp(join(tmpdir(), 'yomeru-human-review-'));
const packetPath = join(tempDir, 'packet.json');
await writeFile(packetPath, `${JSON.stringify(sourcePacket, null, 2)}\n`);

const { server, url } = await createReviewServer({ packetPath, port: 0, openBrowser: false });
try {
  const initial = await fetch(`${url}/api/status`).then(response => response.json());
  assert.equal(initial.total, 94);
  assert.equal(initial.awaiting, 94);
  assert.equal(initial.blocked, 2);

  const target = sourcePacket.items[0];
  const response = await fetch(`${url}/api/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queueId: target.queueId,
      humanDecision: 'approve',
      humanReviewer: 'Test Reviewer',
      approvedChinese: target.candidateChinese,
      humanNotes: 'Verified in test.'
    })
  });
  assert.equal(response.status, 200);
  const saved = JSON.parse(await readFile(packetPath, 'utf8'));
  const savedItem = saved.items.find(item => item.queueId === target.queueId);
  assert.equal(savedItem.humanDecision, 'approve');
  assert.equal(savedItem.humanReviewer, 'Test Reviewer');
  assert.equal(savedItem.approvedChinese, target.candidateChinese);
  assert.equal(saved.summary.awaitingHumanReview, 93);
  assert.equal(saved.summary.approved, 1);

  const invalidResponse = await fetch(`${url}/api/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queueId: sourcePacket.items[1].queueId,
      humanDecision: 'reject',
      humanReviewer: 'Test Reviewer',
      humanNotes: ''
    })
  });
  assert.equal(invalidResponse.status, 400);
  const invalidBody = await invalidResponse.json();
  assert.match(invalidBody.error, /拒绝必须填写理由/);
} finally {
  await new Promise(resolvePromise => server.close(resolvePromise));
  await rm(tempDir, { recursive: true, force: true });
}

process.stdout.write('Offline Chinese local human-review UI tests passed.\n');
