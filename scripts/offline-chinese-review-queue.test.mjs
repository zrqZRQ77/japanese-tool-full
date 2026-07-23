#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
execFileSync(process.execPath, [resolve(ROOT, 'scripts/build-offline-chinese-review-queue.mjs')], { cwd: ROOT, stdio: 'pipe' });

const queue = JSON.parse(readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/review-queue.json'), 'utf8'));
const markdown = readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/REVIEW_QUEUE.md'), 'utf8');

assert.equal(queue.schemaVersion, 1);
assert.equal(queue.generatedAt, '2026-07-23T00:00:00.000Z');
assert.equal(queue.policy.automaticApprovalAllowed, false);
assert.equal(queue.policy.aiDraftPublishAllowed, false);
assert.equal(queue.summary.totalItems, 93);
assert.deepEqual(queue.summary.priorityCounts, { P0: 6, P1: 42, P2: 19, P3: 26 });
assert.deepEqual(queue.summary.reviewTypeCounts, {
  'high-frequency-lexical': 15,
  'manual-research-required': 26,
  'sense-disambiguation': 45,
  'standard-lexical': 7
});
assert.equal(queue.summary.withJmdictEvidence, 67);
assert.equal(queue.summary.manualResearchRequired, 26);
assert.equal(queue.summary.candidateChineseFilled, 0);
assert.equal(new Set(queue.items.map(item => item.queueId)).size, queue.items.length);
assert.equal(new Set(queue.items.map(item => `${item.word}\u0000${item.reading || ''}`)).size, queue.items.length);
assert.ok(queue.items.every(item => item.reviewerStatus === 'pending'));
assert.ok(queue.items.every(item => item.candidateChinese === null));
assert.ok(queue.items.every(item => item.evidence.length || item.reviewType === 'manual-research-required'));
assert.ok(queue.items.filter(item => item.evidence.length).every(item => item.evidence[0].license === 'CC-BY-SA-4.0'));

function item(word) {
  const found = queue.items.find(candidate => candidate.word === word);
  assert.ok(found, `Missing queue item for ${word}`);
  return found;
}

const write = item('書く');
assert.deepEqual(write.evidence[0].headwords, ['書く']);
assert.deepEqual(write.evidence[0].readings, ['かく']);
assert.ok(write.evidence[0].englishGlosses.includes('to write'));
assert.ok(!write.evidence[0].englishGlosses.includes('each'));
assert.ok(!write.evidence[0].englishGlosses.includes('stroke (of a kanji)'));

const wait = item('待つ');
assert.deepEqual(wait.evidence[0].headwords, ['待つ']);
assert.ok(wait.evidence[0].englishGlosses.includes('to wait'));
assert.ok(!wait.evidence[0].englishGlosses.includes('pine tree (Pinus spp.)'));

const rain = item('雨');
assert.deepEqual(rain.evidence[0].headwords, ['雨']);
assert.ok(rain.evidence[0].englishGlosses.includes('rain'));
assert.ok(!rain.evidence[0].englishGlosses.includes('(hard) candy'));

const manual = queue.items.filter(candidate => candidate.reviewType === 'manual-research-required');
assert.equal(manual.length, 26);
assert.ok(manual.every(candidate => candidate.riskFlags.includes('no-jmdict-evidence')));
assert.ok(manual.every(candidate => candidate.notes.includes('不得由 AI 自动生成正式释义')));

assert.match(markdown, /candidateChinese.*初始为空/);
assert.match(markdown, /JMdict 英文释义只作审核证据/);
assert.match(markdown, /无 JMdict 证据的项目需要独立人工调查/);
assert.match(markdown, /只有状态改为 `approved`/);

process.stdout.write('Offline Chinese review queue and homophone-isolation tests passed.\n');
