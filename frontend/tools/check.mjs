#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');

function run(label, command, args, options = {}) {
  process.stdout.write(`- ${label}... `);
  try {
    execFileSync(command, args, { cwd: FRONTEND_DIR, stdio: options.stdio || 'pipe' });
    process.stdout.write('ok\n');
    return true;
  } catch (error) {
    process.stdout.write('failed\n');
    if (error.stdout) process.stderr.write(String(error.stdout));
    if (error.stderr) process.stderr.write(String(error.stderr));
    if (options.optional) return false;
    process.exitCode = 1;
    return false;
  }
}

function assertCheck(condition, message) {
  process.stdout.write(`- ${message}... `);
  if (condition) {
    process.stdout.write('ok\n');
    return;
  }
  process.stdout.write('failed\n');
  process.exitCode = 1;
}

function cacheVersions(indexHtml) {
  const css = indexHtml.match(/styles\.css\?v=([^"']+)/)?.[1] || '';
  const designSystem = indexHtml.match(/design-system\.css\?v=([^"']+)/)?.[1] || '';
  const js = indexHtml.match(/app\.js\?v=([^"']+)/)?.[1] || '';
  return { css, designSystem, js };
}

const indexHtml = readFileSync(resolve(FRONTEND_DIR, 'index.html'), 'utf8');
const appJs = readFileSync(resolve(FRONTEND_DIR, 'app.js'), 'utf8');
const inlineSource = `${appJs}\n${indexHtml}`;
const { css, designSystem, js } = cacheVersions(indexHtml);

run('app.js syntax', 'node', ['--check', 'app.js']);
run('git whitespace diff', 'git', ['diff', '--check'], { optional: true });

assertCheck(!/\b(?:alert|confirm)\s*\(/.test(inlineSource), 'no native alert() / confirm() in app.js or index.html');
assertCheck(css && designSystem && js && css === designSystem && css === js, 'CSS and JS cache versions match');
assertCheck(/^\d{8}-\d{2}$/.test(css), 'cache version format is YYYYMMDD-NN');

if (process.exitCode) {
  process.stderr.write('\nMaintenance checks failed.\n');
} else {
  process.stdout.write('\nAll maintenance checks passed.\n');
}
