#!/usr/bin/env node

import { createServer } from 'node:http';
import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const SNAPSHOT_ROOT = resolve(FRONTEND_DIR, 'visual-snapshots');
const STATE_SNAPSHOT_SUFFIX = '-states';
const DEFAULT_PORT = Number(process.env.VISUAL_SNAPSHOT_STATES_PORT || 5194);
const SAMPLE_TEXT = '私は毎朝七時に起きます。朝ごはんを食べてから、学校に行きます。今日は友達と一緒に図書館で勉強します。';
const CHROME_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
].filter(Boolean);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8'
};

function cacheVersion(indexHtml) {
  const versions = [
    indexHtml.match(/styles\.css\?v=([^"']+)/)?.[1],
    indexHtml.match(/design-system\.css\?v=([^"']+)/)?.[1],
    indexHtml.match(/grammar-layout\.css\?v=([^"']+)/)?.[1],
    indexHtml.match(/typography\.css\?v=([^"']+)/)?.[1],
    indexHtml.match(/content-feed\.js\?v=([^"']+)/)?.[1],
    indexHtml.match(/app\.js\?v=([^"']+)/)?.[1]
  ].filter(Boolean);
  const unique = [...new Set(versions)];
  if (unique.length !== 1 || !/^\d{8}-\d{2}$/.test(unique[0])) {
    throw new Error('Cache versions must match and use YYYYMMDD-NN before taking state snapshots.');
  }
  return unique[0];
}

function safePathFromUrl(url) {
  const parsed = new URL(url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(parsed.pathname);
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = resolve(FRONTEND_DIR, `.${cleanPath}`);
  if (!fullPath.startsWith(FRONTEND_DIR)) return null;
  return fullPath;
}

function startStaticServer(port) {
  const server = createServer(async (request, response) => {
    const filePath = safePathFromUrl(request.url || '/');
    if (!filePath) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    try {
      await readFile(filePath);
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });

  return new Promise((resolveServer, rejectServer) => {
    server.once('error', rejectServer);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', rejectServer);
      resolveServer(server);
    });
  });
}

async function startServerWithFallback() {
  for (let port = DEFAULT_PORT; port < DEFAULT_PORT + 20; port += 1) {
    try {
      const server = await startStaticServer(port);
      return { server, baseUrl: `http://127.0.0.1:${port}/index.html`, mode: 'server' };
    } catch (error) {
      if (error?.code === 'EPERM') {
        return {
          server: null,
          baseUrl: pathToFileURL(join(FRONTEND_DIR, 'index.html')).href,
          mode: 'file'
        };
      }
      if (error?.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`No available port found from ${DEFAULT_PORT} to ${DEFAULT_PORT + 19}`);
}

async function findBrowserExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue.
    }
  }
  return null;
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    throw new Error(`Playwright is not available: ${error.message}`);
  }
}

async function pruneOldStateSnapshots() {
  await mkdir(SNAPSHOT_ROOT, { recursive: true });
  const entries = await readdir(SNAPSHOT_ROOT, { withFileTypes: true });
  const versions = entries
    .filter(entry => entry.isDirectory() && /^\d{8}-\d{2}-states$/.test(entry.name))
    .map(entry => entry.name)
    .sort();
  for (const version of versions.slice(0, Math.max(0, versions.length - 4))) {
    await rm(resolve(SNAPSHOT_ROOT, version), { recursive: true, force: true });
  }
}

function printableMessage(message) {
  if (typeof message === 'string') return message;
  return JSON.stringify(message);
}

async function writeManifest(outputDir, manifest) {
  await writeFile(resolve(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const lines = [
    `# Visual State Snapshot ${manifest.version}`,
    '',
    `Status: ${manifest.ok ? 'OK' : 'CHECK NEEDED'}`,
    `Created: ${manifest.createdAt}`,
    `Mode: ${manifest.mode || 'unknown'}`,
    '',
    '## States',
    ''
  ];

  for (const shot of manifest.screenshots || []) {
    lines.push(`- ${shot.ok ? 'OK' : 'FAIL'}: ${shot.state}: \`${shot.file || '(no screenshot)'}\`${shot.error ? ` — ${shot.error}` : ''}`);
  }

  if (manifest.console?.length) {
    lines.push('', '## Console warnings/errors', '');
    for (const entry of manifest.console.slice(0, 30)) {
      lines.push(`- [${entry.type}] ${printableMessage(entry.text)}`);
    }
  }

  if (manifest.error) {
    lines.push('', '## Error', '', manifest.error);
  }

  await writeFile(resolve(outputDir, 'README.md'), `${lines.join('\n')}\n`);
}

async function run() {
  const indexHtml = await readFile(resolve(FRONTEND_DIR, 'index.html'), 'utf8');
  const version = process.argv[2] || cacheVersion(indexHtml);
  if (!/^\d{8}-\d{2}$/.test(version)) {
    throw new Error('Version must use YYYYMMDD-NN.');
  }

  await mkdir(SNAPSHOT_ROOT, { recursive: true });
  const outputDir = resolve(SNAPSHOT_ROOT, `${version}${STATE_SNAPSHOT_SUFFIX}`);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const manifest = {
    version,
    createdAt: new Date().toISOString(),
    ok: false,
    screenshots: [],
    console: []
  };

  let server = null;
  let browser = null;

  try {
    const { chromium } = await loadPlaywright();
    const serverInfo = await startServerWithFallback();
    server = serverInfo.server;
    manifest.mode = serverInfo.mode;
    manifest.baseUrl = serverInfo.baseUrl;

    const executablePath = await findBrowserExecutable();
    browser = await chromium.launch({
      headless: true,
      args: serverInfo.mode === 'file' ? ['--allow-file-access-from-files', '--no-sandbox'] : ['--no-sandbox'],
      ...(executablePath ? { executablePath } : {})
    });

    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    page.on('console', message => {
      if (!['error', 'warning', 'warn'].includes(message.type())) return;
      const text = message.text();
      if (text.includes('fonts.googleapis.com') || text.includes('fonts.gstatic.com')) return;
      manifest.console.push({ type: message.type(), text, location: message.location() });
    });

    page.on('pageerror', error => {
      manifest.console.push({ type: 'pageerror', text: error.message });
    });

    page.on('requestfailed', request => {
      const url = request.url();
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) return;
      manifest.console.push({
        type: 'requestfailed',
        text: `${request.method()} ${url} ${request.failure()?.errorText || ''}`.trim()
      });
    });

    async function settle(ms = 300) {
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(ms);
    }

    async function shot(state, fileName) {
      await settle();
      const file = `${fileName}.png`;
      await page.screenshot({ path: resolve(outputDir, file), fullPage: true });
      manifest.screenshots.push({ state, file, ok: true, pageState: await inspectState() });
    }

    async function recordFailure(state, error) {
      const file = `failed-${manifest.screenshots.length + 1}.png`;
      await page.screenshot({ path: resolve(outputDir, file), fullPage: true }).catch(() => {});
      manifest.screenshots.push({ state, file, ok: false, error: error?.message || String(error) });
    }

    async function step(state, fileName, fn) {
      try {
        await fn();
        await shot(state, fileName);
      } catch (error) {
        await recordFailure(state, error);
      }
    }

    async function inspectState() {
      return page.evaluate(() => {
        const visible = selector => {
          const element = document.querySelector(selector);
          if (!element) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        return {
          view: document.body.dataset.view || '',
          hasReading: document.body.classList.contains('has-reading'),
          rubyCount: document.querySelectorAll('#output ruby.w').length,
          detailText: (document.querySelector('#detailArea')?.innerText || '').trim().slice(0, 160),
          translationVisible: visible('.paragraph-translation'),
          fontModalVisible: visible('#readingDisplayModal'),
          exportModalVisible: visible('#exportModal'),
          vocabCountText: (document.querySelector('#vocabFilteredCount')?.textContent || '').trim()
        };
      });
    }

    async function clickPreferredWord() {
      const preferred = page.locator('#output ruby[data-word="毎朝"]').first();
      if (await preferred.isVisible().catch(() => false)) {
        await preferred.click();
        return;
      }
      await page.locator('#output ruby.w').first().click();
    }

    async function closeFontModalIfOpen() {
      const closeButton = page.locator('#readingDisplayModal .reading-display-close');
      if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
    }

    async function closeExportModalIfOpen() {
      const closeButton = page.locator('#exportModal button[aria-label="关闭导出面板"]');
      if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
    }

    await page.goto(serverInfo.baseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      localStorage.clear();
      localStorage.setItem('reading_guide_prompt_seen', '1');
      if (typeof ensureLearningData === 'function') await ensureLearningData();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#heroInputText').fill(SAMPLE_TEXT);
    await page.locator('button[onclick="analyzeFromHero()"]').click();
    await page.locator('#output ruby.w').first().waitFor({ state: 'visible', timeout: 8000 });
    await settle(500);

    await step('词语详解面板', '01-word-detail', async () => {
      await clickPreferredWord();
      await page.locator('#detailArea .detail-box').first().waitFor({ state: 'visible', timeout: 3000 });
    });

    await step('假名隐藏状态', '02-ruby-hidden', async () => {
      await page.locator('#rubyToggleBtn').click();
      await settle();
    });

    await step('假名开启状态', '03-ruby-shown', async () => {
      await page.locator('#rubyToggleBtn').click();
      await page.locator('#output ruby.w rt').first().waitFor({ state: 'attached', timeout: 3000 });
    });

    await step('字号设置弹窗', '04-reading-font-settings', async () => {
      await page.locator('#readingFontSettingsButton').click();
      await page.locator('#readingDisplayModal').waitFor({ state: 'visible', timeout: 3000 });
      const largePreset = page.locator('#readingDisplayModal button[data-preset="large"]');
      if (await largePreset.isVisible().catch(() => false)) await largePreset.click();
    });
    await closeFontModalIfOpen();

    await step('导出弹窗', '05-export-modal', async () => {
      await page.locator('#exportTriggerBtn').click();
      await page.locator('#exportModal').waitFor({ state: 'visible', timeout: 3000 });
      await page.locator('#exportFormatSelect').selectOption('png');
      await page.locator('#exportLayoutSelect').selectOption('portrait');
    });
    await closeExportModalIfOpen();

    await step('收藏生词后的生词本', '06-vocab-saved', async () => {
      await clickPreferredWord();
      const addButton = page.locator('#detailArea .add-vocab-tool').first();
      if (await addButton.isVisible().catch(() => false)) await addButton.click();
      await page.locator('button.nav-vocab').click();
      await page.locator('#vocabListPage, #vocabEmptyPage').first().waitFor({ state: 'attached', timeout: 3000 });
    });

    await step('生词本管理菜单', '07-vocab-management-menu', async () => {
      const menu = page.locator('details.vocab-management-menu summary').first();
      await menu.click();
      await page.locator('.vocab-management-options').waitFor({ state: 'visible', timeout: 3000 });
    });

    await step('JLPT筛选菜单', '08-vocab-jlpt-filter', async () => {
      const managementMenu = page.locator('details.vocab-management-menu').first();
      if (await managementMenu.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape').catch(() => {});
      }
      await page.locator('#vocabJlptFilterMenu summary').click();
      await page.locator('#vocabJlptFilterMenu .vocab-filter-menu-options').waitFor({ state: 'visible', timeout: 3000 });
    });

    await step('日本留学・生活资讯', '09-content-feed', async () => {
      await page.evaluate(() => window.switchWorkspace?.('discover'));
      await page.waitForFunction(() => ['fallback', 'cache', 'remote'].includes(document.getElementById('contentFeedSection')?.dataset.feedSource));
      await page.locator('#contentFeedGrid .content-feed-card').first().waitFor({ state: 'visible', timeout: 3000 });
    });

    manifest.ok = manifest.screenshots.every(item => item.ok) && manifest.console.every(item => item.type !== 'pageerror');
    await writeManifest(outputDir, manifest);
    console.log(`Visual state snapshots saved: ${outputDir}`);
    if (!manifest.ok) process.exitCode = 1;
  } catch (error) {
    manifest.ok = false;
    manifest.error = error?.message || String(error);
    await writeManifest(outputDir, manifest);
    console.error(`Visual state snapshot blocked or failed: ${manifest.error}`);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) server.close();
    await pruneOldStateSnapshots();
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
