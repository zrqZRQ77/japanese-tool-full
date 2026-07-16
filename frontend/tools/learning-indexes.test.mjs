#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(TOOL_DIR, '..');
const ROOT_DIR = resolve(FRONTEND_DIR, '..');
const VERSION = '20260716';
const CHINESE_DIR = resolve(FRONTEND_DIR, 'data/chinese-definitions', VERSION);
const JLPT_DIR = resolve(FRONTEND_DIR, 'data/jlpt-reference', VERSION);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function shardFor(value, count) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

async function outputDigest() {
  const files = [];
  for (const directory of [CHINESE_DIR, JLPT_DIR]) {
    for (const name of (await readdir(directory)).sort()) {
      files.push(`${name}:${sha256(await readFile(resolve(directory, name)))}`);
    }
  }
  return sha256(files.join('\n'));
}

async function lookupChinese(term, shardCount) {
  const file = resolve(CHINESE_DIR, `shard-${String(shardFor(term, shardCount)).padStart(2, '0')}.json`);
  const shard = JSON.parse(await readFile(file, 'utf8'));
  return shard[term] || [];
}

const chineseMetadata = JSON.parse(await readFile(resolve(CHINESE_DIR, 'metadata.json'), 'utf8'));
const jlptMetadata = JSON.parse(await readFile(resolve(JLPT_DIR, 'metadata.json'), 'utf8'));
const jlptIndex = JSON.parse(await readFile(resolve(JLPT_DIR, 'index.json'), 'utf8'));

assert.deepEqual(
  {
    version: chineseMetadata.dataVersion,
    existing: chineseMetadata.existingCuratedEntries,
    supplement: chineseMetadata.reviewedSupplementEntries,
    entries: chineseMetadata.indexedEntryCount,
    forms: chineseMetadata.formCount,
    shards: chineseMetadata.shardCount,
    bytes: chineseMetadata.totalBytes
  },
  { version: VERSION, existing: 137, supplement: 20, entries: 156, forms: 281, shards: 16, bytes: 32807 }
);

for (const shard of chineseMetadata.shards) {
  const payload = await readFile(resolve(CHINESE_DIR, shard.file));
  assert.equal(payload.byteLength, shard.bytes, `${shard.file} byte count changed`);
  assert.equal(sha256(payload), shard.sha256, `${shard.file} hash changed`);
}

const chineseTerms = ['読書', '来月', '図書館', '新しい', '新聞', '利用時間', '時価総額', '総額', '金融機関', '半導体', 'メモリー', '上昇', '首位', '大手', '開きます', 'あります'];
for (const term of chineseTerms) {
  const entries = await lookupChinese(term, chineseMetadata.shardCount);
  assert.ok(entries[0]?.m, `Offline Chinese index is missing ${term}`);
}

assert.deepEqual(
  {
    version: jlptMetadata.dataVersion,
    rows: jlptMetadata.sourceEntryCount,
    forms: jlptMetadata.indexedFormCount,
    conflicts: jlptMetadata.conflictFormCount,
    distribution: jlptMetadata.formDistribution
  },
  {
    version: VERSION,
    rows: 8131,
    forms: 13385,
    conflicts: 533,
    distribution: { N5: 1112, N4: 1084, N3: 3301, N2: 3089, N1: 4799 }
  }
);
assert.equal(sha256(await readFile(resolve(JLPT_DIR, 'index.json'))), jlptMetadata.indexSha256);
assert.equal(jlptIndex['読書'], 'N3');
assert.equal(jlptIndex['来月'], 'N5');
assert.equal(jlptIndex['図書館'], 'N5');
assert.equal(jlptIndex['新しい'], 'N5');
for (const professionalTerm of ['利用時間', '時価総額', '総額', '金融機関', '半導体', 'メモリー', '首位', '大手']) {
  assert.equal(jlptIndex[professionalTerm], undefined, `${professionalTerm} must not receive a guessed reference level`);
}

const before = await outputDigest();
execFileSync(process.execPath, ['scripts/build-learning-indexes.mjs'], { cwd: ROOT_DIR, stdio: 'pipe' });
const after = await outputDigest();
assert.equal(after, before, 'Learning index build is not byte-for-byte reproducible');

process.stdout.write('Learning indexes passed: 156 Chinese entries, 281 forms, 13,385 JLPT reference forms, reproducible output.\n');
