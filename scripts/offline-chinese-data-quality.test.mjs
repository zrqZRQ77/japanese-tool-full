#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
execFileSync(process.execPath, [resolve(ROOT, 'scripts/validate-offline-chinese-data.mjs')], { cwd: ROOT, stdio: 'pipe' });

const report = JSON.parse(readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/data-quality-report.json'), 'utf8'));
const markdown = readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/DATA_QUALITY_REPORT.md'), 'utf8');

assert.equal(report.schemaVersion, 1);
assert.equal(report.generatedAt, '2026-07-23T00:00:00.000Z');
assert.equal(report.summary.valid, true);
assert.equal(report.summary.errors, 0);
assert.equal(report.summary.warnings, 1);
assert.equal(report.summary.notes, 2);
assert.equal(report.summary.dictionaryEntries, 137);
assert.equal(report.summary.supplementEntries, 22);
assert.equal(report.summary.curatedOverlaps, 1);
assert.equal(report.summary.indexedEntries, 158);
assert.equal(report.summary.indexedForms, 285);
assert.equal(report.summary.reviewQueueItems, 93);
assert.equal(report.summary.pendingItems, 93);
assert.equal(report.summary.approvedItems, 0);
assert.equal(report.summary.homophoneGroups, 6);
assert.equal(report.summary.multiPosEvidenceItems, 34);

assert.equal(report.warnings[0].code, 'curated-source-overlap');
assert.deepEqual(report.warnings[0].words, ['企業']);
const homophones = report.notes.find(item => item.code === 'homophone-review-groups');
assert.ok(homophones);
assert.deepEqual(homophones.groups, [
  { reading: 'あめ', words: ['飴', '雨'] },
  { reading: 'かえる', words: ['蛙', '帰る'] },
  { reading: 'かみ', words: ['紙', '神', '髪'] },
  { reading: 'きる', words: ['切る', '着る'] },
  { reading: 'はし', words: ['橋', '箸'] },
  { reading: 'はな', words: ['花', '鼻'] }
]);
assert.ok(Object.values(report.inputSha256).every(value => /^[a-f0-9]{64}$/.test(value)));
assert.match(markdown, /状态：PASS/);
assert.match(markdown, /企業/);
assert.match(markdown, /approved 项目必须有中文释义、证据、审核人、审核时间/);
assert.match(markdown, /同音词和多词性证据不自动报错/);

process.stdout.write('Offline Chinese data-quality and release-gate tests passed.\n');
