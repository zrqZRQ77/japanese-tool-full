#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
execFileSync(process.execPath, [resolve(ROOT, 'scripts/audit-offline-chinese-coverage.mjs')], { cwd: ROOT, stdio: 'pipe' });
execFileSync(process.execPath, [resolve(ROOT, 'scripts/build-offline-chinese-review-queue.mjs')], { cwd: ROOT, stdio: 'pipe' });

const queue = JSON.parse(readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/review-queue.json'), 'utf8'));
const markdown = readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/REVIEW_QUEUE.md'), 'utf8');

assert.equal(queue.schemaVersion, 1);
assert.equal(queue.generatedAt, '2026-07-23T00:00:00.000Z');
assert.equal(queue.baseline.mainCommit, '6a821a65d56af7576e4312ef4b1df33eb6d889f4');
assert.equal(queue.policy.automaticApprovalAllowed, false);
assert.equal(queue.policy.aiDraftPublishAllowed, false);
assert.equal(queue.summary.totalItems, 96);
assert.deepEqual(queue.summary.priorityCounts, { P0: 5, P1: 43, P2: 22, P3: 26 });
assert.deepEqual(queue.summary.remainingPriorityCounts, { P1: 33, P2: 22, P3: 26 });
assert.deepEqual(queue.summary.draftedPriorityCounts, { P0: 5, P1: 10 });
assert.deepEqual(queue.summary.reviewTypeCounts, {
  'high-frequency-lexical': 15,
  'manual-research-required': 26,
  'sense-disambiguation': 48,
  'standard-lexical': 7
});
assert.deepEqual(queue.summary.reviewerStatusCounts, { drafted: 15, pending: 81 });
assert.equal(queue.summary.reviewedItems, 15);
assert.equal(queue.summary.pendingItems, 81);
assert.equal(queue.summary.draftedItems, 15);
assert.equal(queue.summary.approvedItems, 0);
assert.equal(queue.summary.blockedItems, 0);
assert.equal(queue.summary.withJmdictEvidence, 70);
assert.equal(queue.summary.manualResearchRequired, 26);
assert.equal(queue.summary.sameWrittenFormGroups, 3);
assert.equal(queue.summary.candidateChineseFilled, 15);
assert.equal(new Set(queue.items.map(item => item.queueId)).size, queue.items.length);
assert.equal(new Set(queue.items.map(item => `${item.word}\u0000${item.reading || ''}`)).size, queue.items.length);
assert.ok(queue.items.filter(item => item.reviewerStatus === 'pending').every(item => item.candidateChinese === null));
assert.ok(queue.items.filter(item => item.reviewerStatus === 'drafted').every(item => (
  item.candidateChinese
  && item.reviewer
  && item.reviewedAt === '2026-07-24'
  && item.decision === 'recommend-approve'
  && item.notes.includes('置信度：')
)));
assert.ok(queue.items.every(item => item.evidence.length || item.reviewType === 'manual-research-required'));
assert.ok(queue.items.filter(item => item.evidence.length).every(item => item.evidence[0].license === 'CC-BY-SA-4.0'));

function item(word, reading) {
  const found = queue.items.find(candidate => candidate.word === word && candidate.reading === reading);
  assert.ok(found, `Missing queue item for ${word} (${reading})`);
  return found;
}

const write = item('書く', 'かく');
assert.deepEqual(write.evidence[0].headwords, ['書く']);
assert.deepEqual(write.evidence[0].readings, ['かく']);
assert.ok(write.evidence[0].englishGlosses.includes('to write'));
assert.ok(!write.evidence[0].englishGlosses.includes('each'));
assert.ok(!write.evidence[0].englishGlosses.includes('stroke (of a kanji)'));
assert.equal(write.candidateChinese, '写；书写；创作（文章等）');
assert.equal(write.reviewerStatus, 'drafted');

const wait = item('待つ', 'まつ');
assert.deepEqual(wait.evidence[0].headwords, ['待つ']);
assert.ok(wait.evidence[0].englishGlosses.includes('to wait'));
assert.ok(!wait.evidence[0].englishGlosses.includes('pine tree (Pinus spp.)'));

const rain = item('雨', 'あめ');
assert.deepEqual(rain.evidence[0].headwords, ['雨']);
assert.ok(rain.evidence[0].englishGlosses.includes('rain'));
assert.ok(!rain.evidence[0].englishGlosses.includes('(hard) candy'));

const openAku = item('開く', 'あく');
const openHiraku = item('開く', 'ひらく');
assert.deepEqual(openAku.exampleCaseIds, ['LQ-082', 'LQ-174']);
assert.deepEqual(openHiraku.exampleCaseIds, ['LQ-175']);
assert.deepEqual(openAku.evidence[0].readings, ['あく']);
assert.deepEqual(openHiraku.evidence[0].readings, ['ひらく']);
assert.equal(openAku.reviewerStatus, 'drafted');
assert.equal(openHiraku.reviewerStatus, 'pending');
assert.ok(openAku.riskFlags.includes('same-written-form-multiple-readings'));
assert.ok(openHiraku.riskFlags.includes('same-written-form-multiple-readings'));

assert.deepEqual(item('一日', 'いちにち').exampleCaseIds, ['LQ-178']);
assert.deepEqual(item('一日', 'ついたち').exampleCaseIds, ['LQ-179']);
assert.deepEqual(item('人気', 'にんき').exampleCaseIds, ['LQ-180']);
assert.deepEqual(item('人気', 'ひとけ').exampleCaseIds, ['LQ-181']);
assert.deepEqual(queue.sameWrittenFormGroups, [
  { word: '一日', readings: ['いちにち', 'ついたち'] },
  { word: '開く', readings: ['あく', 'ひらく'] },
  { word: '人気', readings: ['にんき', 'ひとけ'] }
]);

const drafted = queue.items.filter(candidate => candidate.reviewerStatus === 'drafted');
assert.deepEqual(drafted.filter(candidate => candidate.priority === 'P0').map(candidate => candidate.word), ['帰る', '書く', '静か', '待つ', '来る']);
assert.deepEqual(drafted.filter(candidate => candidate.priority === 'P1').map(candidate => candidate.word), ['飲む', '古い', '呼ぶ', '降る', '座る', '撮る', '持つ', '暑い', '乗る', '開く']);

const manual = queue.items.filter(candidate => candidate.reviewType === 'manual-research-required');
assert.equal(manual.length, 26);
assert.ok(manual.every(candidate => candidate.reviewerStatus === 'pending'));
assert.ok(manual.every(candidate => candidate.riskFlags.includes('no-jmdict-evidence')));
assert.ok(manual.every(candidate => candidate.notes.includes('不得由 AI 自动生成正式释义')));

assert.match(markdown, /`drafted` 表示已逐项核验证据/);
assert.match(markdown, /JMdict 英文释义只作审核证据/);
assert.match(markdown, /同形异读隔离/);
assert.match(markdown, /只有状态改为 `approved`/);
assert.match(markdown, /AI 辅助结果只能保留为 drafted/);

process.stdout.write('Offline Chinese review queue, assisted-review, and homograph-isolation tests passed.\n');
