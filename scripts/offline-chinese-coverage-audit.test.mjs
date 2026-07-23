#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
execFileSync(process.execPath, [resolve(ROOT, 'scripts/audit-offline-chinese-coverage.mjs')], { cwd: ROOT, stdio: 'pipe' });

const report = JSON.parse(readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/coverage-report.json'), 'utf8'));
const gaps = JSON.parse(readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/high-priority-gaps.json'), 'utf8'));

assert.equal(report.schemaVersion, 1);
assert.equal(report.generatedAt, '2026-07-23T00:00:00.000Z');
assert.equal(report.baseline.mainCommit, '01ccdb78c9988a9513199344439d5d5240c758f3');
assert.equal(report.inventory.dictionaryEntries, 137);
assert.equal(report.inventory.supplementEntries, 22);
assert.equal(report.inventory.indexedChineseEntries, 158);
assert.equal(report.inventory.indexedChineseForms, 285);
assert.equal(report.inventory.jmdictEntries, 22617);
assert.equal(report.inventory.jmdictForms, 50580);
assert.deepEqual(report.inventory.jmdictLanguages, ['eng']);
assert.equal(report.inventory.jlptEntries, 8131);
assert.equal(report.inventory.jlptForms, 13385);
assert.equal(report.corpus.totalCases, 260);
assert.equal(report.corpus.eligibleLexicalCases, 207);
assert.equal(report.corpus.excludedCases, 53);
assert.equal(report.corpus.chineseHits, 83);
assert.equal(report.corpus.chineseMisses, 124);
assert.equal(report.corpus.chineseCoveragePercent, 40.1);
assert.equal(report.corpus.jmdictFallbackHits, 98);
assert.equal(report.corpus.unresolvedAfterJmdict, 26);
assert.equal(report.corpus.combinedResolvablePercent, 87.4);
assert.ok(report.unresolvedCases.every(item => item.expectedMeaningClass === 'unknown'));
assert.ok(Array.isArray(gaps.items));
assert.equal(gaps.items.length, 93);
assert.equal(gaps.items.reduce((sum, item) => sum + item.count, 0), 124);
assert.equal(gaps.items[0].count, 3);
assert.ok(gaps.items.every(item => typeof item.priorityScore === 'number'));

process.stdout.write('Offline Chinese coverage audit and deterministic report tests passed.\n');
