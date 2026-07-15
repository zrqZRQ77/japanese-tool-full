#!/usr/bin/env node

import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(TOOL_DIR, '..');
const ROOT_DIR = resolve(FRONTEND_DIR, '..');
const DIST_DIR = resolve(ROOT_DIR, 'dist');
const VERSION = '20260714-01';
const VERSIONED_DIR = resolve(DIST_DIR, 'vendor/kuromoji', VERSION);

execFileSync(process.execPath, [resolve(ROOT_DIR, 'scripts/build-frontend.mjs')], {
  cwd: ROOT_DIR,
  stdio: 'inherit'
});

await Promise.all([
  access(resolve(VERSIONED_DIR, 'kuromoji-tokenizer.worker.js')),
  access(resolve(VERSIONED_DIR, 'kuromoji.js')),
  access(resolve(VERSIONED_DIR, 'dict/base.dat.gz'))
]);

const [appJs, controllerJs, workerJs, indexHtml, rootVercel, frontendVercel] = await Promise.all([
  readFile(resolve(DIST_DIR, 'app.js'), 'utf8'),
  readFile(resolve(DIST_DIR, 'kuromoji-worker-poc.js'), 'utf8'),
  readFile(resolve(VERSIONED_DIR, 'kuromoji-tokenizer.worker.js'), 'utf8'),
  readFile(resolve(DIST_DIR, 'index.html'), 'utf8'),
  readFile(resolve(ROOT_DIR, 'vercel.json'), 'utf8').then(JSON.parse),
  readFile(resolve(FRONTEND_DIR, 'vercel.json'), 'utf8').then(JSON.parse)
]);

assert.ok(appJs.includes(`LOCAL_KUROMOJI_ASSET_VERSION = '${VERSION}'`));
assert.ok(controllerJs.includes(`KUROMOJI_ASSET_VERSION = '${VERSION}'`));
assert.ok(appJs.includes('vendor/kuromoji/${LOCAL_KUROMOJI_ASSET_VERSION}/kuromoji-tokenizer.worker.js'));
assert.ok(controllerJs.includes('vendor/kuromoji/${KUROMOJI_ASSET_VERSION}/kuromoji-tokenizer.worker.js'));
assert.ok(workerJs.includes("const KUROMOJI_SCRIPT_URL = './kuromoji.js'"));
assert.ok(workerJs.includes("const KUROMOJI_DICTIONARY_URL = './dict/'"));
assert.ok(indexHtml.includes('kuromoji-worker-poc.js?v=20260714-01'));
const pageCacheVersion = indexHtml.match(/app\.js\?v=([^"']+)/)?.[1] || '';
assert.match(pageCacheVersion, /^\d{8}-\d{2}$/);

for (const config of [rootVercel, frontendVercel]) {
  const immutable = config.headers.find(header => header.source === `/vendor/kuromoji/${VERSION}/(.*)`);
  assert.equal(immutable?.headers?.[0]?.value, 'public, max-age=31536000, immutable');
  const entryHeader = config.headers.find(header => header.source.includes('app'));
  assert.ok(entryHeader?.headers?.[0]?.value.includes('must-revalidate'));
  assert.ok(!entryHeader?.headers?.[0]?.value.includes('immutable'));
}

assert.ok(appJs.includes('SOURCE_ANALYSIS_GENERATION'));
assert.ok(appJs.includes("if(analysisGeneration !== SOURCE_ANALYSIS_GENERATION) return;"));
assert.ok(appJs.includes('resetReadingDetailPanel();\n  window.KUROMOJI_TOKEN_CACHE = [];'));
assert.ok(appJs.includes("addTokenSnapshotToVocab('"));
assert.ok(appJs.includes('function addTokenSnapshotToVocab(encodedSnapshot)'));

process.stdout.write('Kuromoji build, cache, race gate, and detail snapshot tests passed.\n');
