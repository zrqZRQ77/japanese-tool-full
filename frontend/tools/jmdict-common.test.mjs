#!/usr/bin/env node

import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(TOOL_DIR, '..');
const DATA_VERSION = '20260713';
const DATA_DIR = resolve(FRONTEND_DIR, 'data/jmdict-common', DATA_VERSION);
const metadata = JSON.parse(await readFile(resolve(DATA_DIR, 'metadata.json'), 'utf8'));
const localDictionary = JSON.parse(await readFile(resolve(FRONTEND_DIR, 'data/dictionary.json'), 'utf8'));
const appJs = await readFile(resolve(FRONTEND_DIR, 'app.js'), 'utf8');

function shardFor(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % metadata.shardCount;
}

async function lookup(term) {
  const file = resolve(DATA_DIR, `shard-${String(shardFor(term)).padStart(2, '0')}.json`);
  const shard = JSON.parse(await readFile(file, 'utf8'));
  return shard[term] || [];
}

assert.equal(metadata.dataVersion, DATA_VERSION);
assert.equal(metadata.commonOnly, true);
assert.ok(metadata.sourceEntryCount >= 22000);
assert.ok(metadata.formCount >= 50000);
assert.equal(metadata.shardCount, 64);
assert.ok(metadata.totalBytes > 1_000_000 && metadata.totalBytes < 10_000_000);
await access(resolve(FRONTEND_DIR, 'data/jmdict-common/EDRDG-LICENSE.html'));
await access(resolve(DATA_DIR, 'SOURCE.md'));

for (const term of ['総額', '金融機関', '半導体', 'メモリー']) {
  const entries = await lookup(term);
  assert.ok(entries.length, `JMdict common index is missing ${term}`);
  assert.ok(entries[0].g?.length, `JMdict common index has no gloss for ${term}`);
}

for (const term of ['時価総額', '総額', '金融機関', '半導体', 'メモリー', '上昇', '首位', '浮上', '大手', '上回る']) {
  assert.ok(localDictionary[term]?.meaning, `Curated Chinese dictionary is missing ${term}`);
}

assert.ok(appJs.includes("const JMDICT_COMMON_DATA_VERSION = '20260713'"));
assert.ok(appJs.includes('async function lookupJmdictCommon'));
assert.ok(appJs.includes('英文释义：'));
assert.ok(!appJs.includes('jisho.org/api/v1/search/words'));

process.stdout.write(`JMdict common index tests passed: ${metadata.sourceEntryCount} entries, ${metadata.formCount} forms, ${metadata.totalBytes} bytes.\n`);
