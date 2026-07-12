#!/usr/bin/env node

import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const DEFAULT_PORT = Number(process.env.UI_AUDIT_PORT || 5174);
const SAMPLE_TEXT = '私は毎朝七時に起きます。朝ごはんを食べてから、学校に行きます。今日は友達と一緒に図書館で勉強します。';
const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'desktop-1280', width: 1280, height: 720 }
];
const CUSTOM_CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '';

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

function failMissingPlaywright(error) {
  console.error('\nUI audit needs Playwright.');
  console.error('Install it from the frontend folder:');
  console.error('  npm install');
  console.error('  npx playwright install chromium');
  console.error('\nThen run:');
  console.error('  npm run audit:ui\n');
  if (process.env.UI_AUDIT_DEBUG) console.error(error);
  process.exit(1);
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    failMissingPlaywright(error);
  }
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
      return { server, port };
    } catch (error) {
      if (error?.code === 'EPERM') return { server: null, port: null, mode: 'file' };
      if (error?.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`No available port found from ${DEFAULT_PORT} to ${DEFAULT_PORT + 19}`);
}

function timestampForPath() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function printableMessage(message) {
  if (typeof message === 'string') return message;
  return JSON.stringify(message);
}

function gitValue(args, fallback = 'unavailable') {
  try {
    return execFileSync('git', args, { cwd: resolve(FRONTEND_DIR, '..'), encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

async function auditEnvironment(browser) {
  const indexHtml = await readFile(join(FRONTEND_DIR, 'index.html'), 'utf8');
  const cacheVersion = indexHtml.match(/app\.js\?v=([^"']+)/)?.[1] || 'unavailable';
  return {
    browserVersion: browser.version(),
    executableSource: CUSTOM_CHROMIUM_EXECUTABLE ? 'custom executable' : 'playwright bundled chromium',
    customExecutableConfigured: Boolean(CUSTOM_CHROMIUM_EXECUTABLE),
    gitCommit: gitValue(['rev-parse', 'HEAD']),
    gitWorktree: gitValue(['status', '--porcelain'], '') ? 'dirty' : 'clean',
    cacheVersion
  };
}

async function runAudit() {
  const { chromium } = await loadPlaywright();
  const { server, port, mode = 'server' } = await startServerWithFallback();
  const baseUrl = mode === 'file'
    ? pathToFileURL(join(FRONTEND_DIR, 'index.html')).href
    : `http://127.0.0.1:${port}/index.html`;
  const outputDir = join(FRONTEND_DIR, 'audit-screenshots', timestampForPath());
  await mkdir(outputDir, { recursive: true });

  const report = {
    startedAt: new Date().toISOString(),
    baseUrl,
    mode,
    outputDir,
    steps: [],
    issues: [],
    console: [],
    screenshots: [],
    viewportChecks: [],
    trace: null
  };

  const browser = await chromium.launch({
    headless: true,
    args: mode === 'file' ? ['--allow-file-access-from-files'] : [],
    ...(CUSTOM_CHROMIUM_EXECUTABLE ? { executablePath: CUSTOM_CHROMIUM_EXECUTABLE } : {})
  });
  report.environment = await auditEnvironment(browser);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();

  page.on('console', message => {
    if (!['error', 'warning', 'warn'].includes(message.type())) return;
    report.console.push({
      type: message.type(),
      text: message.text(),
      location: message.location()
    });
  });

  page.on('pageerror', error => {
    report.console.push({ type: 'pageerror', text: error.message });
  });

  page.on('requestfailed', request => {
    const url = request.url();
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) return;
    report.console.push({
      type: 'requestfailed',
      text: `${request.method()} ${url} ${request.failure()?.errorText || ''}`.trim()
    });
  });

  async function screenshot(name, options = {}) {
    const filePath = join(outputDir, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: options.fullPage ?? false });
    report.screenshots.push(filePath);
    return filePath;
  }

  async function step(name, fn) {
    try {
      const result = await fn();
      report.steps.push({ name, ok: true, result: result || null });
      return result;
    } catch (error) {
      report.steps.push({ name, ok: false, error: error.message });
      report.issues.push({ severity: 'error', name, message: error.message });
      return null;
    }
  }

  async function state(label) {
    const result = await page.evaluate(() => {
      const textOf = selector => (document.querySelector(selector)?.innerText || '').trim().slice(0, 500);
      const rectOf = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          bottom: Math.round(window.innerHeight - rect.bottom)
        };
      };

      return {
        view: document.body.dataset.view || '',
        firstVisit: document.body.classList.contains('first-visit'),
        hasReading: document.body.classList.contains('has-reading'),
        tokenizerMode: document.body.dataset.tokenizerMode || 'not-run',
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight
        },
        output: textOf('#output'),
        detail: textOf('#detailArea'),
        vocab: textOf('#vocabListPage') || textOf('#vocabEmptyPage'),
        grammar: textOf('#grammarBookList'),
        grammarCount: textOf('#grammarBookCount'),
        flash: textOf('#flashArea'),
        typing: textOf('#typingResult') || textOf('#typingPromptCn'),
        history: textOf('#historyStatsGrid'),
        nav: rectOf('.sidebar-nav'),
        mobileMenu: rectOf('#mobileMainMenuButton'),
        brand: rectOf('.sidebar-brand'),
        content: rectOf('.app-content')
      };
    });
    report.steps.push({ name: label, ok: true, state: result });
    return result;
  }

  await step('open app', async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await screenshot('01-initial');
    return state('state: initial');
  });

  await step('reading import', async () => {
    await page.locator('#heroInputText').fill(SAMPLE_TEXT);
    await page.locator('button[onclick="analyzeFromHero()"]').click();
    await page.locator('#output ruby.w').first().waitFor({ state: 'visible', timeout: 6000 });
    await page.locator('#rubyToggleBtn').click();
    await page.locator('#iconButtonHint.is-visible').waitFor({state:'attached', timeout:2000});
    const inlineTooltipDisabled = await page.locator('#rubyToggleBtn').evaluate(node => getComputedStyle(node, '::after').display === 'none');
    if(!inlineTooltipDisabled) throw new Error('Toolbar still renders the clipped inline tooltip.');
    const rubyVisible = await page.locator('#output rt').first().evaluate(node => {
      const style = getComputedStyle(node);
      return style.visibility === 'visible' && Number.parseFloat(style.fontSize) > 0;
    });
    if(!rubyVisible) throw new Error('Ruby toggle did not reveal furigana.');
    await screenshot('02-reading');
    return state('state: reading');
  });

  await step('word detail and vocab add', async () => {
    await page.locator('#output ruby[data-word="毎朝"]').click();
    await page.locator('#detailArea .add-vocab-tool').click();
    await page.locator('#vocabListPage').waitFor({ state: 'attached', timeout: 3000 });
    await screenshot('03-word-added');
    return state('state: vocab added');
  });

  await step('vocab page and flashcard', async () => {
    await page.locator('button.nav-vocab').click();
    await page.locator('#vocabPrimaryAction').click();
    const flashStage = page.locator('#flashArea .flash-stage');
    await flashStage.waitFor({ state: 'visible', timeout: 3000 });
    await flashStage.click();
    await screenshot('04-flashcard');
    return state('state: flashcard');
  });

  await step('typing practice', async () => {
    await page.locator('.app-sidebar button[data-view="retell"]').click();
    await page.locator('#startTypingPracticeBtn').click();
    await page.locator('#typingInput').fill('私は学生です。');
    await page.locator('#typingPracticeModule button[onclick="checkTypingAnswer()"]').click();
    await screenshot('05-typing');
    return state('state: typing');
  });

  await step('Safari audio-only retell fallback', async () => {
    await page.evaluate(() => {
      Object.defineProperty(window, 'SpeechRecognition', {value:undefined, configurable:true});
      Object.defineProperty(window, 'webkitSpeechRecognition', {value:undefined, configurable:true});
      const fakeStream = {getTracks:()=>[{stop(){}}]};
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable:true,
        value:{getUserMedia:async()=>fakeStream}
      });
      window.MediaRecorder = class {
        constructor(){ this.state = 'inactive'; this.mimeType = 'audio/mp4'; }
        start(){ this.state = 'recording'; }
        stop(){
          this.state = 'inactive';
          this.ondataavailable?.({data:new Blob(['audio'], {type:'audio/mp4'})});
          this.onstop?.();
        }
      };
    });
    await page.locator('#startRetellPracticeBtn').click();
    await page.locator('#retellRecordBtn').click();
    await page.locator('#retellRecordBtn').filter({hasText:'停止录音'}).waitFor({state:'visible', timeout:3000});
    await page.locator('#retellRecordBtn').click();
    await page.locator('#retellResult audio').waitFor({state:'visible', timeout:3000});
    const ttsReading = await page.evaluate(() => normalizeJapaneseSpeechText('丁寧に教えます。'));
    if(!ttsReading.includes('ていねい')) throw new Error('TTS pronunciation override for 丁寧 was not applied.');
    return {audioPlayback:true, ttsReading};
  });

  await step('history page', async () => {
    await page.locator('.app-sidebar button[data-view="history"]').click();
    await screenshot('06-history');
    return state('state: history');
  });

  await step('delete confirmation', async () => {
    await page.locator('button.nav-vocab').click();
    const exitButton = page.locator('.vocab-review-exit');
    if (await exitButton.isVisible().catch(() => false)) await exitButton.click();
    await page.locator('#vocabListPage .vocab-action-button[aria-label^="删除"]').click();
    await page.locator('#deleteConfirmModal.active').waitFor({ state: 'visible', timeout: 3000 });
    await screenshot('07-delete-confirm');
    return state('state: delete confirm');
  });

  await step('grammar add and persistence', async () => {
    const cancelButton = page.locator('#deleteConfirmCancel');
    if (await cancelButton.isVisible().catch(() => false)) await cancelButton.click();
    await page.locator('.app-sidebar button[data-view="grammar"]').click();
    await page.locator('.grammar-add-trigger').click();
    await page.locator('#grammarCustomTitle').fill('〜てから');
    await page.locator('#grammarCustomLevel').selectOption('N4');
    await page.locator('#grammarCustomNote').fill('动作完成后，再进行下一步。');
    await page.locator('#grammarAddPanel button[onclick="addCustomGrammarNote()"]').click();
    await page.locator('#grammarBookList .grammar-book-card').filter({ hasText: '〜てから' }).waitFor({ state: 'visible', timeout: 3000 });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('reading_grammar_book') || '[]'));
    if (!Array.isArray(saved) || !saved.some(item => item.title === '〜てから')) throw new Error('Grammar note was not saved to localStorage.');
    const practiceHistory = await page.evaluate(() => JSON.parse(localStorage.getItem('reading_practice_history') || '[]'));
    if (!Array.isArray(practiceHistory) || !practiceHistory.some(item => Number(item.total || 0) > 0)) throw new Error('Grammar activity was not added to learning history.');
    await screenshot('08-grammar-saved');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.enterReadingFromHero?.();
      window.switchWorkspace?.('grammar');
    });
    await page.locator('#grammarBookList .grammar-book-card').filter({ hasText: '〜てから' }).waitFor({ state: 'visible', timeout: 3000 });
    return state('state: grammar persisted');
  });

  await step('grammar delete icon and delete flow', async () => {
    const deleteButton = page.locator('#grammarBookList button[onclick^="removeGrammarNote"]').first();
    await deleteButton.waitFor({ state: 'visible', timeout: 3000 });
    const geometry = await deleteButton.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const before = getComputedStyle(element, '::before');
      const after = getComputedStyle(element, '::after');
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        beforeDisplay: before.display,
        beforeWidth: parseFloat(before.width),
        beforeHeight: parseFloat(before.height),
        afterDisplay: after.display
      };
    });
    if (geometry.width < 32 || geometry.width > 44 || geometry.height < 32 || geometry.height > 44) throw new Error(`Grammar delete button has unexpected size: ${geometry.width}x${geometry.height}.`);
    if (geometry.scrollWidth > geometry.width + 1 || geometry.scrollHeight > geometry.height + 1) throw new Error('Grammar delete icon overflows its button.');
    if (geometry.beforeDisplay === 'none' || geometry.beforeWidth < 14 || geometry.beforeHeight < 14) throw new Error('Grammar delete icon is not rendered at the expected size.');
    if (geometry.afterDisplay !== 'none') throw new Error('Grammar delete button renders an unexpected secondary icon.');
    await deleteButton.hover();
    await screenshot('09-grammar-delete-icon');
    await deleteButton.click();
    await page.locator('#deleteConfirmModal.active').waitFor({ state: 'visible', timeout: 3000 });
    await screenshot('10-grammar-delete-confirm');
    await page.locator('#deleteConfirmSubmit').click();
    await page.locator('#grammarBookList .grammar-book-card').filter({ hasText: '〜てから' }).waitFor({ state: 'detached', timeout: 3000 });
    const savedAfterDelete = await page.evaluate(() => JSON.parse(localStorage.getItem('reading_grammar_book') || '[]'));
    if (savedAfterDelete.some(item => item.title === '〜てから')) throw new Error('Grammar note remained in localStorage after deletion.');
    return state('state: grammar deleted');
  });

  await step('reading history URL allowlist', async () => {
    const normalized = await page.evaluate(() => {
      const unsafeUrls = [
        'javascript:window.__historyUrlExecuted=true',
        'data:text/html,<script>window.__historyUrlExecuted=true</script>',
        ' JAVASCRIPT:window.__historyUrlExecuted=true'
      ];
      const history = unsafeUrls.map((url, index) => ({
        id: 9100 + index,
        title: `Unsafe URL ${index + 1}`,
        source: '',
        url,
        date: new Date(Date.now() - index).toISOString(),
        text: `安全测试正文 ${index + 1}`,
        fingerprint: `unsafe-url-${index + 1}`
      }));
      return normalizeReadingHistoryList(history).map(item => ({ title: item.title, url: item.url }));
    });
    if (normalized.length !== 3) throw new Error('Unsafe history URL fixtures were not normalized.');
    if (normalized.some(item => item.url)) throw new Error('Unsafe history URL passed the HTTP(S) allowlist.');
    return { rejected: normalized.length, protocols: ['javascript:', 'data:', 'whitespace-obfuscated javascript:'] };
  });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const publicPdfEntryCount = await page.getByText('上传 PDF', { exact: true }).count();
    if (publicPdfEntryCount !== 0) {
      throw new Error(`Viewport ${viewport.name} still exposes ${publicPdfEntryCount} public PDF upload entr${publicPdfEntryCount === 1 ? 'y' : 'ies'}.`);
    }
    if (viewport.width <= 720) {
      const heroActionsLayout = await page.evaluate(() => {
        const sample = document.querySelector('button[onclick="loadSampleFromHero()"]');
        const more = document.querySelector('.hero-more-menu > summary');
        if (!sample || !more) return null;
        const sampleRect = sample.getBoundingClientRect();
        const moreRect = more.getBoundingClientRect();
        return {
          sampleLeft: Math.round(sampleRect.left),
          sampleTop: Math.round(sampleRect.top),
          moreLeft: Math.round(moreRect.left),
          moreTop: Math.round(moreRect.top)
        };
      });
      if (!heroActionsLayout
        || Math.abs(heroActionsLayout.sampleTop - heroActionsLayout.moreTop) > 3
        || heroActionsLayout.sampleLeft >= heroActionsLayout.moreLeft) {
        throw new Error(`Viewport ${viewport.name} hero secondary actions are not on one left-to-right row: ${JSON.stringify(heroActionsLayout)}.`);
      }
      if (viewport.name === 'mobile-390') await screenshot('viewport-mobile-390-home');
    }
    const moreMenu = page.locator('.hero-more-menu');
    await moreMenu.locator('summary').click();
    await moreMenu.locator('.hero-menu-popover').waitFor({ state: 'visible', timeout: 3000 });
    await page.locator('#heroInputText').fill(SAMPLE_TEXT);
    await page.locator('button[onclick="analyzeFromHero()"]', { hasText: '开始阅读' }).click();
    await page.locator('#output ruby.w').first().waitFor({ state: 'visible', timeout: 6000 });
    if (viewport.width <= 720) {
      const toolbarLayout = await page.evaluate(() => {
        const toolbar = document.querySelector('#readerToolbar');
        const groups = toolbar ? [...toolbar.querySelectorAll('.reader-tool-group')] : [];
        if (!toolbar || groups.length !== 2) return null;
        const first = groups[0].getBoundingClientRect();
        const second = groups[1].getBoundingClientRect();
        const style = getComputedStyle(toolbar);
        return {
          firstTop: Math.round(first.top),
          secondTop: Math.round(second.top),
          flexWrap: style.flexWrap,
          overflowX: style.overflowX
        };
      });
      if (!toolbarLayout
        || Math.abs(toolbarLayout.firstTop - toolbarLayout.secondTop) > 3
        || toolbarLayout.flexWrap !== 'nowrap'
        || !['auto', 'scroll'].includes(toolbarLayout.overflowX)) {
        throw new Error(`Viewport ${viewport.name} reader toolbar is not a single horizontal strip: ${JSON.stringify(toolbarLayout)}.`);
      }
      if (viewport.name === 'mobile-390') await screenshot('viewport-mobile-390-reading-toolbar');
    }
    await page.locator('#rubyToggleBtn').click();
    await page.locator('#iconButtonHint.is-visible').waitFor({state:'attached', timeout:2000});
    const hintBounds = await page.locator('#iconButtonHint').boundingBox();
    if(!hintBounds || hintBounds.x < 0 || hintBounds.x + hintBounds.width > viewport.width + 1){
      throw new Error(`Viewport ${viewport.name} tool hint exceeds the viewport: ${JSON.stringify(hintBounds)}.`);
    }
    const viewportRubyVisible = await page.locator('#output rt').first().evaluate(node => {
      const style = getComputedStyle(node);
      return style.visibility === 'visible' && Number.parseFloat(style.fontSize) > 0;
    });
    if(!viewportRubyVisible) throw new Error(`Viewport ${viewport.name} ruby toggle did not reveal furigana.`);
    await page.locator('#output ruby[data-word="毎朝"]').click();
    await page.locator('#detailArea .add-vocab-tool').click();
    if(viewport.width <= 720){
      const mobileMenuButton = page.locator('#mobileMainMenuButton');
      await mobileMenuButton.waitFor({ state: 'visible', timeout: 3000 });
      await mobileMenuButton.click();
      await page.locator('#menuPanel.active').waitFor({ state: 'visible', timeout: 3000 });
      if(viewport.name === 'mobile-390'){
        await page.waitForTimeout(380);
        await screenshot('viewport-mobile-390-menu');
      }
      await page.locator('#menuPanel .nav-item[data-view="vocab"]').click();
    }else{
      const vocabNav = page.locator('button.nav-vocab');
      await vocabNav.waitFor({ state: 'visible', timeout: 3000 });
      await vocabNav.click();
    }
    await page.waitForFunction(() => document.body.dataset.view === 'vocab');
    await page.locator('#vocabPrimaryAction').click();
    const mobileFlash = page.locator('#flashArea .flash-stage');
    await mobileFlash.waitFor({state:'visible', timeout:3000});
    await mobileFlash.click();
    const viewportState = await state(`viewport: ${viewport.name}`);
    if (viewportState.firstVisit || !viewportState.hasReading || viewportState.view !== 'vocab') {
      throw new Error(`Viewport ${viewport.name} did not reach the vocab state after reading import.`);
    }
    if (viewport.width <= 720) {
      if (!viewportState.mobileMenu || viewportState.mobileMenu.width <= 0 || viewportState.mobileMenu.height <= 0) {
        throw new Error(`Viewport ${viewport.name} mobile menu is not visible.`);
      }
      if (viewportState.nav && viewportState.nav.width > 0 && viewportState.nav.height > 0) {
        throw new Error(`Viewport ${viewport.name} still shows the duplicate bottom navigation.`);
      }
      const flashBounds = await mobileFlash.boundingBox();
      if(!flashBounds || flashBounds.x < 0 || flashBounds.x + flashBounds.width > viewport.width + 1){
        throw new Error(`Viewport ${viewport.name} flashcard exceeds the viewport: ${JSON.stringify(flashBounds)}.`);
      }
    } else if (!viewportState.nav || viewportState.nav.width <= 0 || viewportState.nav.height <= 0) {
      throw new Error(`Viewport ${viewport.name} navigation is not visible.`);
    }
    if (!viewportState.content || viewportState.content.width <= 0 || viewportState.content.height <= 0) {
      throw new Error(`Viewport ${viewport.name} app content is not visible.`);
    }
    const filePath = await screenshot(`viewport-${viewport.name}`);
    report.viewportChecks.push({ ...viewport, screenshot: filePath, state: viewportState });
    if (viewportState.overflowX) {
      report.issues.push({
        severity: 'error',
        name: `viewport ${viewport.name}`,
        message: `Horizontal overflow: ${viewportState.viewport.scrollWidth}px > ${viewportState.viewport.width}px`
      });
    }
  }

  const appLogs = report.console.filter(entry => {
    const text = entry.text || '';
    const isOptionalFontRequest = text.includes('fonts.googleapis.com') || text.includes('fonts.gstatic.com');
    const isOptionalKuromojiRequest = text.includes('cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/');
    const isExpectedTokenizerFallback = text.includes('kuromoji 加载失败,已退回内置词库')
      || text.includes('kuromoji 初始化失败,已退回内置词库');
    return !isOptionalFontRequest && !isOptionalKuromojiRequest && !isExpectedTokenizerFallback;
  });
  const failedSteps = report.steps.filter(item => item.ok === false);
  const summary = {
    ok: failedSteps.length === 0 && report.issues.length === 0 && appLogs.length === 0,
    failedSteps: failedSteps.length,
    issues: report.issues.length,
    consoleWarningsOrErrors: appLogs.length,
    tokenizerMode: report.steps.find(item => item.name === 'state: reading')?.state?.tokenizerMode || 'not-recorded'
  };

  if (!summary.ok) {
    const tracePath = join(outputDir, 'ui-audit-trace.zip');
    await context.tracing.stop({ path: tracePath });
    report.trace = tracePath;
  } else {
    await context.tracing.stop();
  }
  await browser.close();
  if (server) server.close();

  const reportJsonPath = join(outputDir, 'ui-audit-report.json');
  const reportMdPath = join(outputDir, 'ui-audit-report.md');
  await writeFile(reportJsonPath, JSON.stringify({ ...report, summary }, null, 2));
  await writeFile(reportMdPath, markdownReport(report, summary, appLogs));

  console.log(`UI audit complete: ${summary.ok ? 'PASS' : 'CHECK NEEDED'}`);
  console.log(`Mode: ${mode}`);
  console.log(`Report: ${reportMdPath}`);
  console.log(`JSON: ${reportJsonPath}`);
  console.log(`Screenshots: ${outputDir}`);

  if (!summary.ok) process.exitCode = 1;
}

function markdownReport(report, summary, appLogs) {
  const lines = [
    '# UI Audit Report',
    '',
    `Started: ${report.startedAt}`,
    `URL: ${report.baseUrl}`,
    `Result: ${summary.ok ? 'PASS' : 'CHECK NEEDED'}`,
    '',
    '## Summary',
    '',
    `- Failed steps: ${summary.failedSteps}`,
    `- Issues: ${summary.issues}`,
    `- Console warnings/errors: ${summary.consoleWarningsOrErrors}`,
    `- Tokenizer mode: ${summary.tokenizerMode}`,
    `- Browser: ${report.environment.browserVersion}`,
    `- Executable source: ${report.environment.executableSource}`,
    `- Git commit: ${report.environment.gitCommit} (${report.environment.gitWorktree} worktree)`,
    `- Cache version: ${report.environment.cacheVersion}`,
    '',
    '## Steps',
    ''
  ];

  for (const step of report.steps) {
    lines.push(`- ${step.ok ? 'OK' : 'FAIL'}: ${step.name}${step.error ? ` - ${step.error}` : ''}`);
  }

  lines.push('', '## Viewports', '');
  for (const check of report.viewportChecks) {
    lines.push(`- ${check.name} (${check.width}x${check.height}): overflowX=${check.state.overflowX}, screenshot=${check.screenshot}`);
  }

  if (report.issues.length) {
    lines.push('', '## Issues', '');
    for (const issue of report.issues) {
      lines.push(`- [${issue.severity}] ${issue.name}: ${issue.message}`);
    }
  }

  if (appLogs.length) {
    lines.push('', '## Console', '');
    for (const entry of appLogs.slice(0, 40)) {
      lines.push(`- [${entry.type}] ${printableMessage(entry.text)}`);
    }
  }

  lines.push('', '## Screenshots', '');
  for (const screenshot of report.screenshots) lines.push(`- ${screenshot}`);

  return `${lines.join('\n')}\n`;
}

runAudit().catch(error => {
  writeBlockedReport(error).catch(() => {
    console.error(error);
    process.exit(1);
  });
});

async function writeBlockedReport(error) {
  const outputDir = join(FRONTEND_DIR, 'audit-screenshots', timestampForPath());
  await mkdir(outputDir, { recursive: true });
  const message = error?.message || String(error);
  const report = {
    startedAt: new Date().toISOString(),
    result: 'BLOCKED BY TEST ENVIRONMENT',
    outputDir,
    error: message,
    summary: {
      ok: false,
      failedSteps: 0,
      issues: 1,
      consoleWarningsOrErrors: 0
    }
  };
  const reportJsonPath = join(outputDir, 'ui-audit-report.json');
  const reportMdPath = join(outputDir, 'ui-audit-report.md');
  const md = [
    '# UI Audit Report',
    '',
    `Started: ${report.startedAt}`,
    'Result: BLOCKED BY TEST ENVIRONMENT',
    '',
    '## Why It Stopped',
    '',
    message,
    '',
    '## Next Step',
    '',
    'Run this audit in a local terminal or an environment that permits opening a localhost server and launching Chromium:',
    '',
    '```bash',
    'cd /Users/zhouruoqi/Downloads/japaneselearning/frontend',
    'npm run audit:ui',
    '```',
    ''
  ].join('\n');
  await writeFile(reportJsonPath, JSON.stringify(report, null, 2));
  await writeFile(reportMdPath, md);
  console.error('UI audit blocked by the current test environment.');
  console.error(`Report: ${reportMdPath}`);
  console.error(message);
  process.exit(1);
}
