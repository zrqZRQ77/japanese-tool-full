#!/usr/bin/env node

import { access, cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const FRONTEND_DIR = resolve(ROOT_DIR, 'frontend');
const DIST_DIR = resolve(ROOT_DIR, 'dist');
const KUROMOJI_ASSET_VERSION = '20260714-01';
const KUROMOJI_DIST_DIR = resolve(DIST_DIR, 'vendor/kuromoji', KUROMOJI_ASSET_VERSION);

const FILES = [
  'index.html',
  'yomeru-ui-kit.html',
  'kuromoji-worker-poc.js',
  'lexical-lookup.js',
  'app.js',
  'lexical-lookup-integration.js',
  'analytics.js',
  'search-entry-fix.js',
  'config.js',
  'styles.css',
  'design-system.css',
  'grammar-layout.css',
  'typography.css',
  'hero-menu-refresh.css'
];

await rm(DIST_DIR, { recursive: true, force: true });
await mkdir(DIST_DIR, { recursive: true });

for (const file of FILES) {
  await cp(resolve(FRONTEND_DIR, file), resolve(DIST_DIR, file));
}

for (const directory of ['assets', 'data']) {
  await cp(resolve(FRONTEND_DIR, directory), resolve(DIST_DIR, directory), { recursive: true });
}

await mkdir(KUROMOJI_DIST_DIR, { recursive: true });
await cp(
  resolve(FRONTEND_DIR, 'vendor/kuromoji', KUROMOJI_ASSET_VERSION),
  KUROMOJI_DIST_DIR,
  { recursive: true }
);

const indexHtml = await readFile(resolve(DIST_DIR, 'index.html'), 'utf8');
const localAssets = [...indexHtml.matchAll(/(?:src|href)=["'](?!https?:|data:|#)([^"'?]+)(?:\?[^"']*)?["']/g)]
  .map(match => match[1]);

for (const asset of new Set(localAssets)) {
  await access(resolve(DIST_DIR, asset));
}

process.stdout.write(`Frontend deployment bundle created at ${DIST_DIR}\n`);
