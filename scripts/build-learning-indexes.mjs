#!/usr/bin/env node

import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const DATA_VERSION = process.env.LEARNING_DATA_VERSION || '20260716';
const CHINESE_SHARD_COUNT = 16;
const CHINESE_SOURCE = resolve(ROOT_DIR, 'frontend/data/dictionary.json');
const CHINESE_SUPPLEMENT_SOURCE = resolve(ROOT_DIR, 'frontend/data/chinese-definitions-source.json');
const CHINESE_OUTPUT_ROOT = resolve(ROOT_DIR, 'frontend/data/chinese-definitions');
const CHINESE_OUTPUT_DIR = resolve(CHINESE_OUTPUT_ROOT, DATA_VERSION);
const JLPT_SOURCE_DIR = resolve(ROOT_DIR, 'tmp/jlpt-open-anki');
const JLPT_OUTPUT_ROOT = resolve(ROOT_DIR, 'frontend/data/jlpt-reference');
const JLPT_OUTPUT_DIR = resolve(JLPT_OUTPUT_ROOT, DATA_VERSION);
const JLPT_SOURCE_PROJECT = 'jamsinclair/open-anki-jlpt-decks';
const JLPT_SOURCE_URL = 'https://github.com/jamsinclair/open-anki-jlpt-decks';
const VALID_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

function generatedAtForVersion(version) {
  const match = String(version).match(/^(\d{4})(\d{2})(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z` : null;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function unique(values) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

function shardFor(value, count) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    if (row.some(value => value !== '')) rows.push(row);
  }
  const [header = [], ...body] = rows;
  return body.map(values => Object.fromEntries(header.map((key, index) => [key, values[index] || ''])));
}

async function buildChineseDefinitions() {
  const dictionaryText = await readFile(CHINESE_SOURCE, 'utf8');
  const supplementText = await readFile(CHINESE_SUPPLEMENT_SOURCE, 'utf8');
  const dictionary = JSON.parse(dictionaryText);
  const supplement = JSON.parse(supplementText);
  const combined = new Map();

  for (const [word, item] of Object.entries(dictionary)) {
    combined.set(word, { ...item, source: 'existing-curated' });
  }
  for (const [word, item] of Object.entries(supplement.entries || {})) {
    combined.set(word, { ...item, source: 'round-two-reviewed' });
  }

  const shards = Array.from({ length: CHINESE_SHARD_COUNT }, () => Object.create(null));
  let formCount = 0;
  for (const [word, item] of combined) {
    const entry = {
      w: word,
      r: String(item.reading || '').trim(),
      m: String(item.meaning || '').trim(),
      p: String(item.pos || '').trim(),
      s: item.source
    };
    if (!entry.m) continue;
    const forms = unique([word, entry.r, ...(Array.isArray(item.aliases) ? item.aliases : [])]);
    for (const form of forms) {
      const shard = shards[shardFor(form, CHINESE_SHARD_COUNT)];
      if (!shard[form]) {
        shard[form] = [];
        formCount += 1;
      }
      if (!shard[form].some(existing => existing.w === entry.w && existing.r === entry.r)) {
        shard[form].push(entry);
      }
    }
  }

  await rm(CHINESE_OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(CHINESE_OUTPUT_DIR, { recursive: true });
  const shardFiles = [];
  let totalBytes = 0;
  for (let index = 0; index < CHINESE_SHARD_COUNT; index += 1) {
    const file = `shard-${String(index).padStart(2, '0')}.json`;
    const payload = JSON.stringify(shards[index]);
    await writeFile(resolve(CHINESE_OUTPUT_DIR, file), payload);
    const bytes = Buffer.byteLength(payload);
    totalBytes += bytes;
    shardFiles.push({ file, keys: Object.keys(shards[index]).length, bytes, sha256: sha256(payload) });
  }
  const metadata = {
    schemaVersion: 1,
    dataVersion: DATA_VERSION,
    generatedAt: generatedAtForVersion(DATA_VERSION),
    sourceName: supplement.sourceName,
    generatedMethod: supplement.generatedMethod,
    license: supplement.license,
    existingCuratedEntries: Object.keys(dictionary).length,
    reviewedSupplementEntries: Object.keys(supplement.entries || {}).length,
    indexedEntryCount: combined.size,
    formCount,
    shardCount: CHINESE_SHARD_COUNT,
    totalBytes,
    inputSha256: {
      dictionary: sha256(dictionaryText),
      supplement: sha256(supplementText)
    },
    shards: shardFiles
  };
  await writeFile(resolve(CHINESE_OUTPUT_DIR, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await writeFile(resolve(CHINESE_OUTPUT_DIR, 'SOURCE.md'), `# Yomeru offline Chinese definition index\n\n- Data version: ${DATA_VERSION}\n- Source: project-maintained curated Chinese definitions\n- Existing curated entries: ${metadata.existingCuratedEntries}\n- Round-two reviewed supplements: ${metadata.reviewedSupplementEntries}\n- Indexed entries: ${metadata.indexedEntryCount}\n- Query forms: ${metadata.formCount}\n- Shards: ${metadata.shardCount}\n\nThese Chinese definitions are maintained and reviewed by the Yomeru project and are built offline. They are not represented as original Chinese glosses from JMdict. The browser does not call an online translation or dictionary API at runtime.\n`);
  return metadata;
}

async function buildJlptReference() {
  const formLevels = new Map();
  const sourceFiles = [];
  const entryDistribution = Object.fromEntries(VALID_LEVELS.map(level => [level, 0]));

  for (const level of VALID_LEVELS) {
    const fileName = `${level.toLowerCase()}.csv`;
    const sourceText = await readFile(resolve(JLPT_SOURCE_DIR, fileName), 'utf8');
    const rows = parseCsv(sourceText);
    entryDistribution[level] = rows.length;
    sourceFiles.push({ file: fileName, rows: rows.length, bytes: Buffer.byteLength(sourceText), sha256: sha256(sourceText) });
    for (const row of rows) {
      const expressions = String(row.expression || '').split(/\s*;\s*/u);
      const readings = String(row.reading || '').split(/\s*;\s*/u);
      for (const form of unique([...expressions, ...readings])) {
        if (!formLevels.has(form)) formLevels.set(form, new Set());
        formLevels.get(form).add(level);
      }
    }
  }

  const index = Object.create(null);
  const conflicts = [];
  const formDistribution = Object.fromEntries(VALID_LEVELS.map(level => [level, 0]));
  for (const [form, levels] of formLevels) {
    if (levels.size !== 1) {
      conflicts.push({ form, levels: [...levels].sort() });
      continue;
    }
    const [level] = levels;
    index[form] = level;
    formDistribution[level] += 1;
  }

  const indexPayload = JSON.stringify(index);
  const licenseText = await readFile(resolve(JLPT_SOURCE_DIR, 'LICENSE'), 'utf8');
  const readmeText = await readFile(resolve(JLPT_SOURCE_DIR, 'README.md'), 'utf8');
  await rm(JLPT_OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(JLPT_OUTPUT_DIR, { recursive: true });
  await writeFile(resolve(JLPT_OUTPUT_DIR, 'index.json'), indexPayload);
  await copyFile(resolve(JLPT_SOURCE_DIR, 'LICENSE'), resolve(JLPT_OUTPUT_DIR, 'LICENSE'));
  const metadata = {
    schemaVersion: 1,
    dataVersion: DATA_VERSION,
    generatedAt: generatedAtForVersion(DATA_VERSION),
    sourceProject: JLPT_SOURCE_PROJECT,
    sourceUrl: JLPT_SOURCE_URL,
    sourceDescription: 'Community-maintained JLPT vocabulary reference lists; not an official JLPT vocabulary list.',
    license: 'MIT',
    sourceEntryCount: Object.values(entryDistribution).reduce((sum, value) => sum + value, 0),
    indexedFormCount: Object.keys(index).length,
    conflictFormCount: conflicts.length,
    entryDistribution,
    formDistribution,
    indexBytes: Buffer.byteLength(indexPayload),
    indexSha256: sha256(indexPayload),
    sourceFiles,
    sourceReadmeSha256: sha256(readmeText),
    sourceLicenseSha256: sha256(licenseText),
    conflictExamples: conflicts.slice(0, 50)
  };
  await writeFile(resolve(JLPT_OUTPUT_DIR, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await writeFile(resolve(JLPT_OUTPUT_DIR, 'SOURCE.md'), `# JLPT reference-level index\n\n- Data version: ${DATA_VERSION}\n- Source project: ${JLPT_SOURCE_PROJECT}\n- Source URL: ${JLPT_SOURCE_URL}\n- Licence: MIT (copied as LICENSE)\n- Source rows: ${metadata.sourceEntryCount}\n- Indexed unambiguous forms: ${metadata.indexedFormCount}\n- Cross-level conflicting forms omitted: ${metadata.conflictFormCount}\n\nThis is a community-maintained reference index. It is not an official JLPT vocabulary list. The application labels results as “JLPT 参考等级” or “参考等级”. Forms that occur in more than one source level are intentionally omitted instead of guessed.\n`);
  return metadata;
}

const chinese = await buildChineseDefinitions();
const jlpt = await buildJlptReference();
process.stdout.write(`${JSON.stringify({ chinese, jlpt }, null, 2)}\n`);
