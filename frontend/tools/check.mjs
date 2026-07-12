#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
  const grammarLayout = indexHtml.match(/grammar-layout\.css\?v=([^"']+)/)?.[1] || '';
  const typography = indexHtml.match(/typography\.css\?v=([^"']+)/)?.[1] || '';
  const js = indexHtml.match(/app\.js\?v=([^"']+)/)?.[1] || '';
  return { css, designSystem, grammarLayout, typography, js };
}

function duplicateIds(indexHtml) {
  const ids = [...indexHtml.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
}

function hardcodedFontSizeLocations(sources) {
  const violations = [];
  for (const [file, source] of sources) {
    source.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(/font-size\s*:\s*([^;]+);/g)) {
        if (/\b\d+(?:\.\d+)?px\b/.test(match[1])) {
          violations.push(`${file}:${index + 1}`);
        }
      }
    });
  }
  return violations;
}

const indexHtml = readFileSync(resolve(FRONTEND_DIR, 'index.html'), 'utf8');
const appJs = readFileSync(resolve(FRONTEND_DIR, 'app.js'), 'utf8');
const stylesCss = readFileSync(resolve(FRONTEND_DIR, 'styles.css'), 'utf8');
const designSystemCss = readFileSync(resolve(FRONTEND_DIR, 'design-system.css'), 'utf8');
const grammarLayoutCss = readFileSync(resolve(FRONTEND_DIR, 'grammar-layout.css'), 'utf8');
const inlineSource = `${appJs}\n${indexHtml}`;
const { css, designSystem, grammarLayout, typography, js } = cacheVersions(indexHtml);
const duplicateIdList = duplicateIds(indexHtml);
const hardcodedFontSizes = hardcodedFontSizeLocations([
  ['index.html', indexHtml],
  ['styles.css', stylesCss],
  ['design-system.css', designSystemCss],
  ['grammar-layout.css', grammarLayoutCss]
]);
const requiredFiles = ['styles.css', 'design-system.css', 'grammar-layout.css', 'typography.css', 'app.js'];
const requiredFunctions = ['switchWorkspace', 'addCustomGrammarNote', 'removeGrammarNote', 'renderGrammarBook'];

run('app.js syntax', 'node', ['--check', 'app.js']);
run('git whitespace diff', 'git', ['diff', '--check'], { optional: true });

assertCheck(!/\b(?:alert|confirm)\s*\(/.test(inlineSource), 'no native alert() / confirm() in app.js or index.html');
assertCheck(!/(?:上传 PDF|选择的 PDF|pdfModeSelect|pdfCleanupSelect|排版方向|网页打印\/导出的PDF)/i.test(indexHtml), 'public HTML does not expose withdrawn PDF controls or copy');
assertCheck(requiredFiles.every(file => existsSync(resolve(FRONTEND_DIR, file))), 'required frontend files exist');
assertCheck(duplicateIdList.length === 0, `HTML ids are unique${duplicateIdList.length ? `: ${duplicateIdList.join(', ')}` : ''}`);
assertCheck(requiredFunctions.every(name => new RegExp(`function\\s+${name}\\s*\\(`).test(appJs)), 'required app functions exist');
assertCheck(!appJs.includes("label:'调整今日目标'") && appJs.includes("detail:'查看学习日历、进度和今日建议'"), 'global search matches public MVP navigation');
assertCheck(
  /function\s+resetLevelTest\s*\(\)[\s\S]*?safeStorage\.removeItem\('reading_level_result'\)/.test(appJs)
    && !/function\s+resetLevelTest\s*\(\)[\s\S]*?localStorage\.removeItem\('reading_level_result'\)/.test(appJs),
  'level-test reset uses safe storage'
);
assertCheck(!/\blocalStorage\./.test(indexHtml), 'inline page logic uses safe storage');
assertCheck(appJs.includes("dataset.tokenizerMode = 'built-in'"), 'reading flow exposes tokenizer mode');
assertCheck(
  /async function collectExportRubyUnits\(\)[\s\S]*?if\(!raw \|\| !ENABLE_REMOTE_SMART_SEGMENTATION\) return fallback;[\s\S]*?await initKuromoji\(\)/.test(appJs),
  'reading export respects the remote-tokenizer safety switch'
);
assertCheck(
  /function escapeHtml\(str\)[\s\S]*?&quot;[\s\S]*?&#39;/.test(appJs),
  'HTML escaping covers quoted attribute values'
);
assertCheck(
  /async function restoreHistoryArticle\(id\)[\s\S]*?await renderText\(\)/.test(appJs)
    && !/function restoreHistoryArticle\(id\)[\s\S]*?innerHTML\s*=\s*item\.annotatedHtml/.test(appJs),
  'reading history is regenerated from plain text instead of stored HTML'
);
assertCheck(
  /function normalizeReadingHistoryItem\(item = \{\}, index = 0\)[\s\S]*?const url = readingQueueUrl\(item\.url\);[\s\S]*?\n\s*url,/.test(appJs),
  'reading history URLs use the HTTP(S) allowlist'
);
assertCheck(indexHtml.includes('导出可导入 Anki 的生词文件') && !indexHtml.includes('一键导出Anki牌组'), 'Anki copy matches TSV export');
assertCheck(
  ['pptx', 'png', 'jpeg'].every(format => indexHtml.includes(`<option value="${format}"`))
    && !/downloadRubyDocx|<option value=["']docx["']/.test(inlineSource),
  'reading export formats match the public MVP boundary'
);
assertCheck(hardcodedFontSizes.length === 0, `no hardcoded px font sizes outside typography.css${hardcodedFontSizes.length ? `: ${hardcodedFontSizes.join(', ')}` : ''}`);
assertCheck(css && designSystem && grammarLayout && typography && js && css === designSystem && css === grammarLayout && css === typography && css === js, 'CSS and JS cache versions match');
assertCheck(/^\d{8}-\d{2}$/.test(css), 'cache version format is YYYYMMDD-NN');

if (process.exitCode) {
  process.stderr.write('\nMaintenance checks failed.\n');
} else {
  process.stdout.write('\nAll maintenance checks passed.\n');
}
