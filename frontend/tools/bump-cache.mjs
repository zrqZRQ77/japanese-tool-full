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
const currentHeroMenu = indexHtml.match(/hero-menu-refresh\.css\?v=([^"']+)/)?.[1] || '';
const currentLexicalLookup = indexHtml.match(/lexical-lookup\.js\?v=([^"']+)/)?.[1] || '';
const currentLexicalRecord = indexHtml.match(/lexical-record\.js\?v=([^"']+)/)?.[1] || '';
const currentVocabStore = indexHtml.match(/vocab-store\.js\?v=([^"']+)/)?.[1] || '';
const currentVocabList = indexHtml.match(/vocab-list\.js\?v=([^"']+)/)?.[1] || '';
const currentVocabReview = indexHtml.match(/vocab-review\.js\?v=([^"']+)/)?.[1] || '';
const currentVocabExport = indexHtml.match(/vocab-export\.js\?v=([^"']+)/)?.[1] || '';
const currentJs = indexHtml.match(/app\.js\?v=([^"']+)/)?.[1] || '';
const currentLexicalIntegration = indexHtml.match(/lexical-lookup-integration\.js\?v=([^"']+)/)?.[1] || '';
const currentLexicalDetail = indexHtml.match(/lexical-detail-integration\.js\?v=([^"']+)/)?.[1] || '';
const currentLexicalVocab = indexHtml.match(/lexical-vocab-integration\.js\?v=([^"']+)/)?.[1] || '';
const versionedAssets = [currentCss, currentDesignSystem, currentGrammarLayout, currentTypography, currentHeroMenu, currentLexicalLookup, currentLexicalRecord, currentVocabStore, currentVocabList, currentVocabReview, currentVocabExport, currentJs, currentLexicalIntegration, currentLexicalDetail, currentLexicalVocab].filter(Boolean);
const current = versionedAssets.length && versionedAssets.every(value => value === versionedAssets[0])
  ? versionedAssets[0]
  : currentJs || currentVocabStore || currentVocabList || currentVocabReview || currentVocabExport || currentLexicalLookup || currentLexicalRecord || currentLexicalIntegration || currentLexicalDetail || currentLexicalVocab || currentCss || currentDesignSystem || currentGrammarLayout || currentTypography || currentHeroMenu;
const version = nextVersion(current, requested);

const updated = indexHtml
  .replace(/styles\.css\?v=[^"']+/g, `styles.css?v=${version}`)
  .replace(/design-system\.css\?v=[^"']+/g, `design-system.css?v=${version}`)
  .replace(/grammar-layout\.css\?v=[^"']+/g, `grammar-layout.css?v=${version}`)
  .replace(/typography\.css\?v=[^"']+/g, `typography.css?v=${version}`)
  .replace(/hero-menu-refresh\.css\?v=[^"']+/g, `hero-menu-refresh.css?v=${version}`)
  .replace(/lexical-lookup\.js\?v=[^"']+/g, `lexical-lookup.js?v=${version}`)
  .replace(/lexical-record\.js\?v=[^"']+/g, `lexical-record.js?v=${version}`)
  .replace(/vocab-store\.js\?v=[^"']+/g, `vocab-store.js?v=${version}`)
  .replace(/vocab-list\.js\?v=[^"']+/g, `vocab-list.js?v=${version}`)
  .replace(/vocab-review\.js\?v=[^"']+/g, `vocab-review.js?v=${version}`)
  .replace(/vocab-export\.js\?v=[^"']+/g, `vocab-export.js?v=${version}`)
  .replace(/app\.js\?v=[^"']+/g, `app.js?v=${version}`)
  .replace(/lexical-lookup-integration\.js\?v=[^"']+/g, `lexical-lookup-integration.js?v=${version}`)
  .replace(/lexical-detail-integration\.js\?v=[^"']+/g, `lexical-detail-integration.js?v=${version}`)
  .replace(/lexical-vocab-integration\.js\?v=[^"']+/g, `lexical-vocab-integration.js?v=${version}`);

if (updated === indexHtml) {
  throw new Error('No cache query strings found in index.html.');
}

writeFileSync(INDEX_PATH, updated);
process.stdout.write(`Cache version updated to ${version}\n`);
