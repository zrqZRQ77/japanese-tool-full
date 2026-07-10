#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const TARGET_FILES = ['styles.css', 'design-system.css', 'grammar-layout.css'];

const SIZE_TOKENS = new Map([
  ['10px', '--type-size-ruby'],
  ['11px', '--type-size-micro'],
  ['12px', '--type-size-caption'],
  ['13px', '--type-size-meta'],
  ['14px', '--type-size-control'],
  ['15px', '--type-size-body'],
  ['16px', '--type-size-emphasis'],
  ['17px', '--type-size-body-large'],
  ['18px', '--type-size-subtitle'],
  ['19px', '--type-size-lead'],
  ['20px', '--type-size-section-title'],
  ['21px', '--type-size-section-title-large'],
  ['24px', '--type-size-feature-title'],
  ['26px', '--type-size-feature-title-large'],
  ['28px', '--type-size-page-title'],
  ['32px', '--type-size-display'],
  ['36px', '--type-size-hero'],
  ['38px', '--type-size-hero-wide'],
  ['44px', '--type-size-hero-large'],
  ['56px', '--type-size-hero-max'],
  ['9px', '--type-size-step-09'],
  ['10.5px', '--type-size-step-10-5'],
  ['11.5px', '--type-size-step-11-5'],
  ['12.5px', '--type-size-step-12-5'],
  ['13.5px', '--type-size-step-13-5'],
  ['14.5px', '--type-size-step-14-5'],
  ['15.5px', '--type-size-step-15-5'],
  ['22px', '--type-size-step-22'],
  ['23px', '--type-size-step-23'],
  ['25px', '--type-size-step-25'],
  ['29px', '--type-size-step-29'],
  ['30px', '--type-size-step-30'],
  ['31px', '--type-size-step-31'],
  ['34px', '--type-size-step-34'],
  ['40px', '--type-size-step-40'],
  ['42px', '--type-size-step-42'],
  ['48px', '--type-size-step-48'],
  ['52px', '--type-size-step-52'],
  ['58px', '--type-size-step-58'],
  ['62px', '--type-size-step-62'],
  ['64px', '--type-size-step-64'],
  ['68px', '--type-size-step-68'],
  ['72px', '--type-size-step-72']
]);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSource(source) {
  let updated = source;
  for (const [size, token] of SIZE_TOKENS) {
    const directSize = new RegExp(`font-size:\\s*${escapeRegex(size)}(?=\\s*(?:!important\\s*)?;)`, 'g');
    updated = updated.replace(directSize, `font-size: var(${token})`);
  }

  updated = updated.replace(/font-size:\s*clamp\(([^;]+)\)(?=\s*(?:!important\s*)?;)/g, (declaration, values) => {
    const normalizedValues = values.replace(/\b\d+(?:\.\d+)?px\b/g, size => {
      const token = SIZE_TOKENS.get(size);
      return token ? `var(${token})` : size;
    });
    return `font-size: clamp(${normalizedValues})`;
  });

  return updated;
}

let changedCount = 0;
for (const file of TARGET_FILES) {
  const path = resolve(FRONTEND_DIR, file);
  const source = readFileSync(path, 'utf8');
  const updated = normalizeSource(source);
  if (updated === source) {
    process.stdout.write(`${file}: already normalized\n`);
    continue;
  }
  writeFileSync(path, updated);
  changedCount += 1;
  process.stdout.write(`${file}: normalized\n`);
}

process.stdout.write(`Typography normalization complete (${changedCount} file${changedCount === 1 ? '' : 's'} changed).\n`);
