#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const INDEX_PATH = resolve(FRONTEND_DIR, 'index.html');

function localDateStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

function nextVersion(current, requested) {
  if (requested) {
    if (!/^\d{8}-\d{2}$/.test(requested)) {
      throw new Error('Version must use YYYYMMDD-NN, for example 20260702-15.');
    }
    return requested;
  }
  const today = localDateStamp();
  const match = String(current || '').match(/^(\d{8})-(\d{2})$/);
  if (!match || match[1] !== today) return `${today}-01`;
  return `${today}-${String(Number(match[2]) + 1).padStart(2, '0')}`;
}

const requested = process.argv[2] || '';
const indexHtml = readFileSync(INDEX_PATH, 'utf8');
const currentCss = indexHtml.match(/styles\.css\?v=([^"']+)/)?.[1] || '';
const currentDesignSystem = indexHtml.match(/design-system\.css\?v=([^"']+)/)?.[1] || '';
const currentGrammarLayout = indexHtml.match(/grammar-layout\.css\?v=([^"']+)/)?.[1] || '';
const currentTypography = indexHtml.match(/typography\.css\?v=([^"']+)/)?.[1] || '';
const currentJs = indexHtml.match(/app\.js\?v=([^"']+)/)?.[1] || '';
const current = [currentCss, currentDesignSystem, currentGrammarLayout, currentTypography, currentJs].filter(Boolean).every(value => value === currentCss)
  ? currentCss
  : currentJs || currentCss || currentDesignSystem || currentGrammarLayout || currentTypography;
const version = nextVersion(current, requested);

const updated = indexHtml
  .replace(/styles\.css\?v=[^"']+/g, `styles.css?v=${version}`)
  .replace(/design-system\.css\?v=[^"']+/g, `design-system.css?v=${version}`)
  .replace(/grammar-layout\.css\?v=[^"']+/g, `grammar-layout.css?v=${version}`)
  .replace(/typography\.css\?v=[^"']+/g, `typography.css?v=${version}`)
  .replace(/app\.js\?v=[^"']+/g, `app.js?v=${version}`);

if (updated === indexHtml) {
  throw new Error('No cache query strings found in index.html.');
}

writeFileSync(INDEX_PATH, updated);
process.stdout.write(`Cache version updated to ${version}\n`);
