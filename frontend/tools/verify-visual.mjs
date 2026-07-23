#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const indexHtml = readFileSync(resolve(FRONTEND_DIR, 'index.html'), 'utf8');
const versions = [
  indexHtml.match(/styles\.css\?v=([^"']+)/)?.[1],
  indexHtml.match(/design-system\.css\?v=([^"']+)/)?.[1],
  indexHtml.match(/grammar-layout\.css\?v=([^"']+)/)?.[1],
  indexHtml.match(/typography\.css\?v=([^"']+)/)?.[1],
  indexHtml.match(/content-feed\.js\?v=([^"']+)/)?.[1],
  indexHtml.match(/app\.js\?v=([^"']+)/)?.[1]
].filter(Boolean);
const uniqueVersions = [...new Set(versions)];
const inferredVersion = uniqueVersions.length === 1 ? uniqueVersions[0] : '';
const version = process.argv[2] || inferredVersion;

if (!/^\d{8}-\d{2}$/.test(version)) {
  throw new Error('Visual verification requires matching CSS and JS cache versions using YYYYMMDD-NN.');
}

function run(script) {
  const result = spawnSync(process.execPath, [resolve(SCRIPT_DIR, script), version], {
    cwd: FRONTEND_DIR,
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

run('visual-snapshot.mjs');
run('visual-snapshot-states.mjs');
console.log(`Visual verification completed for ${version}.`);
