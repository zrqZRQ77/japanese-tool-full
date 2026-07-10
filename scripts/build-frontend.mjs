#!/usr/bin/env node

import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const FRONTEND_DIR = resolve(ROOT_DIR, 'frontend');
const DIST_DIR = resolve(ROOT_DIR, 'dist');

const FILES = [
  'index.html',
  'yomeru-ui-kit.html',
  'app.js',
  'config.js',
  'styles.css',
  'design-system.css',
  'grammar-layout.css',
  'typography.css'
];

await rm(DIST_DIR, { recursive: true, force: true });
await mkdir(DIST_DIR, { recursive: true });

for (const file of FILES) {
  await cp(resolve(FRONTEND_DIR, file), resolve(DIST_DIR, file));
}

for (const directory of ['assets', 'data']) {
  await cp(resolve(FRONTEND_DIR, directory), resolve(DIST_DIR, directory), { recursive: true });
}

process.stdout.write(`Frontend deployment bundle created at ${DIST_DIR}\n`);
