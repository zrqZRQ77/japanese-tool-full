#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const DEFAULT_SOURCE = resolve(ROOT_DIR, 'tmp/jmdict/jmdict-eng-common-3.6.2.json');
const OUTPUT_ROOT = resolve(ROOT_DIR, 'frontend/data/jmdict-common');
const SHARD_COUNT = 64;
const SOURCE_PROJECT = 'scriptin/jmdict-simplified';
const DEFAULT_RELEASE_URL = 'https://github.com/scriptin/jmdict-simplified/releases/tag/3.6.2+20260713141310';

const sourcePath = resolve(process.argv[2] || DEFAULT_SOURCE);
const releaseUrl = process.argv[3] || DEFAULT_RELEASE_URL;
const raw = JSON.parse(await readFile(sourcePath, 'utf8'));
const words = Array.isArray(raw.words) ? raw.words : [];

if (!raw.commonOnly || !words.length) {
  throw new Error('Expected a non-empty JMdict common-only JSON file.');
}
const dataVersion = String(raw.dictDate || raw.version || '').replace(/\D/g, '').slice(0, 8) || 'current';
const OUTPUT_DIR = resolve(OUTPUT_ROOT, dataVersion);

function shardFor(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % SHARD_COUNT;
}

function unique(values, limit = Infinity) {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function preferredReading(entry, form) {
  const kana = Array.isArray(entry.kana) ? entry.kana : [];
  const exactKana = kana.find(item => item.text === form);
  if (exactKana) return exactKana.text;
  const matching = kana
    .filter(item => {
      const applies = Array.isArray(item.appliesToKanji) ? item.appliesToKanji : [];
      return applies.includes('*') || applies.includes(form) || applies.length === 0;
    })
    .sort((left, right) => Number(Boolean(right.common)) - Number(Boolean(left.common)));
  return matching[0]?.text || kana[0]?.text || '';
}

function compactEntry(entry, form) {
  const kanji = Array.isArray(entry.kanji) ? entry.kanji : [];
  const kana = Array.isArray(entry.kana) ? entry.kana : [];
  const preferredWord = kanji.find(item => item.common)?.text
    || kanji[0]?.text
    || kana.find(item => item.common)?.text
    || kana[0]?.text
    || form;
  const senses = Array.isArray(entry.sense) ? entry.sense : [];
  const glosses = unique(
    senses.flatMap(sense => (sense.gloss || []))
      .filter(gloss => !gloss.lang || gloss.lang === 'eng')
      .map(gloss => String(gloss.text || '').trim()),
    8
  );
  const parts = unique(senses.flatMap(sense => sense.partOfSpeech || []), 6);
  return {
    id: String(entry.id || ''),
    w: preferredWord,
    r: preferredReading(entry, form),
    p: parts,
    g: glosses
  };
}

const shards = Array.from({ length: SHARD_COUNT }, () => Object.create(null));
let formCount = 0;
let indexedEntryCount = 0;

for (const entry of words) {
  const forms = unique([
    ...(entry.kanji || []).map(item => String(item.text || '').trim()),
    ...(entry.kana || []).map(item => String(item.text || '').trim())
  ]);
  if (!forms.length) continue;
  indexedEntryCount += 1;
  for (const form of forms) {
    if (!form) continue;
    const shard = shards[shardFor(form)];
    if (!shard[form]) {
      shard[form] = [];
      formCount += 1;
    }
    if (shard[form].length >= 3) continue;
    const compact = compactEntry(entry, form);
    if (!compact.g.length) continue;
    if (shard[form].some(item => item.id === compact.id)) continue;
    shard[form].push(compact);
  }
}

await rm(OUTPUT_ROOT, { recursive: true, force: true });
await mkdir(OUTPUT_DIR, { recursive: true });

const shardFiles = [];
let totalBytes = 0;
for (let index = 0; index < SHARD_COUNT; index += 1) {
  const fileName = `shard-${String(index).padStart(2, '0')}.json`;
  const payload = JSON.stringify(shards[index]);
  await writeFile(resolve(OUTPUT_DIR, fileName), payload);
  shardFiles.push({ file: fileName, keys: Object.keys(shards[index]).length, bytes: Buffer.byteLength(payload) });
  totalBytes += Buffer.byteLength(payload);
}

const metadata = {
  schemaVersion: 1,
  dataVersion,
  generatedAt: new Date().toISOString(),
  sourceProject: SOURCE_PROJECT,
  sourceRelease: releaseUrl,
  sourceVersion: raw.version || '',
  dictionaryDate: raw.dictDate || '',
  dictionaryRevisions: raw.dictRevisions || [],
  languages: raw.languages || ['eng'],
  commonOnly: true,
  sourceEntryCount: words.length,
  indexedEntryCount,
  formCount,
  shardCount: SHARD_COUNT,
  totalBytes,
  shards: shardFiles
};

await writeFile(resolve(OUTPUT_DIR, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
await writeFile(resolve(OUTPUT_DIR, 'SOURCE.md'), `# JMdict common-only index\n\n- Source project: ${SOURCE_PROJECT}\n- Source release: ${releaseUrl}\n- Dictionary date: ${raw.dictDate || 'unknown'}\n- Source entries: ${words.length}\n- Indexed forms: ${formCount}\n- Output shards: ${SHARD_COUNT}\n\nThis directory is generated from the English common-only JMdict distribution. The application keeps its curated Chinese definitions as the first layer and uses this index as an English fallback for broader coverage.\n\nJMdict data is owned by the Electronic Dictionary Research and Development Group (EDRDG) and is used under the EDRDG dictionary licence / CC BY-SA 4.0 terms. Update this index from a current JMdict release at least monthly before production releases.\n`);

process.stdout.write(`${JSON.stringify({ sourceEntries: words.length, indexedEntries: indexedEntryCount, forms: formCount, shards: SHARD_COUNT, totalBytes }, null, 2)}\n`);
