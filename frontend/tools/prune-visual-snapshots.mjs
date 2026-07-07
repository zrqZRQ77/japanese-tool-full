#!/usr/bin/env node

import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const SNAPSHOT_ROOT = resolve(FRONTEND_DIR, 'visual-snapshots');
const KEEP_COUNT = Number(process.argv[2] || 2);

if (!Number.isInteger(KEEP_COUNT) || KEEP_COUNT < 1) {
  throw new Error('Keep count must be a positive integer.');
}

await mkdir(SNAPSHOT_ROOT, { recursive: true });
const entries = await readdir(SNAPSHOT_ROOT, { withFileTypes: true });
const versions = entries
  .filter(entry => entry.isDirectory() && /^\d{8}-\d{2}$/.test(entry.name))
  .map(entry => entry.name)
  .sort();

const removeVersions = versions.slice(0, Math.max(0, versions.length - KEEP_COUNT));
for (const version of removeVersions) {
  await rm(resolve(SNAPSHOT_ROOT, version), { recursive: true, force: true });
}

process.stdout.write(`Visual snapshots kept: ${versions.slice(-KEEP_COUNT).join(', ') || '(none)'}\n`);
if (removeVersions.length) {
  process.stdout.write(`Visual snapshots removed: ${removeVersions.join(', ')}\n`);
}
