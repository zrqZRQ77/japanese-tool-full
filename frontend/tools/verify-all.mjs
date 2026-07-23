#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const version = process.argv[2] || '';

function run(script, args = []) {
  const result = spawnSync(process.execPath, [resolve(SCRIPT_DIR, script), ...args], {
    cwd: FRONTEND_DIR,
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

run('check.mjs');
run('content-feed-browser.test.mjs');
run('language-corpus.test.mjs');
run('language-corpus-browser.test.mjs');
run('contextual-reading.test.mjs');
run('language-audit.mjs');
run('article-stress-audit.mjs');
run('ui-audit.mjs');
run('verify-visual.mjs', version ? [version] : []);
console.log('All verification layers completed successfully.');
