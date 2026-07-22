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
  { name: 'desktop-1280', width: 1280, height: 720 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 }
];
const CUSTOM_CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '';
const AUDIT_HIDDEN_LEGACY_MODULES = process.env.UI_AUDIT_LEGACY_MODULES === '1';
const AUDIT_FUNCTIONAL_ONLY = process.env.UI_AUDIT_FUNCTIONAL_ONLY === '1';
const AUDIT_RESPONSIVE_ONLY = process.env.UI_AUDIT_RESPONSIVE_ONLY === '1';

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
  let context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  let page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  const installAuditRoutes = async targetPage => {
    await targetPage.route('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', route=>route.fulfill({
      status:200,
      contentType:'text/javascript; charset=utf-8',
      body:'window.PptxGenJS = window.PptxGenJS || function PptxGenJS(){};'
    }));
    await targetPage.route('https://fonts.googleapis.com/**', route=>route.fulfill({
      status:200,
      contentType:'text/css; charset=utf-8',
      body:''
    }));
    await targetPage.route('https://fonts.gstatic.com/**', route=>route.fulfill({
      status:204,
      body:''
    }));
  };
  await installAuditRoutes(page);

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
    await page.screenshot({
      path: filePath,
      fullPage: options.fullPage ?? false,
      animations: 'disabled',
      timeout: 60000
    });
    report.screenshots.push(filePath);
    return filePath;
  }

  async function step(name, fn) {
    process.stdout.write(`- ${name}... `);
    try {
      const result = await fn();
      report.steps.push({ name, ok: true, result: result || null });
      process.stdout.write('ok\n');
      return result;
    } catch (error) {
      report.steps.push({ name, ok: false, error: error.message });
      report.issues.push({ severity: 'error', name, message: error.message });
      process.stdout.write(`failed: ${error.message}\n`);
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

  if(!AUDIT_RESPONSIVE_ONLY){
  await step('open app', async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await screenshot('01-initial');
    return state('state: initial');
  });

  await step('iPhone Safari TTS keeps utterances, chunks articles and uses a Japanese voice', async () => {
    const ttsState = await page.evaluate(async () => {
      const spoken = [];
      class MockUtterance {
        constructor(text){
          this.text = text;
          this.lang = '';
          this.rate = 1;
          this.pitch = 1;
          this.voice = null;
          this.onstart = null;
          this.onend = null;
          this.onerror = null;
        }
      }
      const voices = [
        {name:'Andrew Multilingual', lang:'en-US', localService:true},
        {name:'Kyoko', lang:'ja-JP', localService:true, voiceURI:'com.apple.voice.kyoko'},
        {name:' Kyoko ', lang:'ja_JP', localService:true, voiceURI:'com.apple.voice.kyoko.duplicate'},
        {name:'Nanami', lang:'ja-JP', localService:true, voiceURI:'com.apple.voice.nanami'}
      ];
      const synthesis = {
        speaking:false,
        paused:false,
        getVoices:()=>voices,
        speak(utterance){
          this.speaking = true;
          spoken.push({
            text:utterance.text,
            lang:utterance.lang,
            voice:utterance.voice?.name || '',
            retained:CURRENT_TTS_UTTERANCE === utterance
          });
          queueMicrotask(()=>{
            utterance.onstart?.();
            setTimeout(()=>{
              this.speaking = false;
              utterance.onend?.();
            }, 2);
          });
        },
        cancel(){ this.speaking = false; this.paused = false; },
        pause(){ this.paused = true; },
        resume(){ this.paused = false; }
      };
      try{ Object.defineProperty(navigator, 'userAgent', {configurable:true, value:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 Version/26.4 Mobile Safari/604.1'}); }catch{}
      try{ Object.defineProperty(navigator, 'platform', {configurable:true, value:'iPhone'}); }catch{}
      try{ Object.defineProperty(navigator, 'maxTouchPoints', {configurable:true, value:5}); }catch{}
      Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:synthesis});
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {configurable:true, value:MockUtterance});
      populateVoiceOptions();
      const article = '市の図書館は来月、新しい読書室を開きます。読書室には日本語の本や新聞があります。利用時間は午前九時から午後六時までです。'.repeat(5);
      speakJapanese(article, null, false);
      await new Promise(resolve=>setTimeout(resolve, 700));
      return {
        spoken,
        ios:isIOSWebKit(),
        voiceNames:sortedJapaneseVoices(true).map(voice=>voice.name.trim()),
        optionNames:[...document.querySelectorAll('#ttsVoiceSelect option:not([disabled])')].map(option=>option.value.trim()),
        queueFinished:CURRENT_TTS_UTTERANCE === null && CURRENT_TTS_QUEUE.length === 0
      };
    });
    if(!ttsState.ios || ttsState.spoken.length < 2 || !ttsState.queueFinished){
      throw new Error(`iPhone TTS lifecycle failed: ${JSON.stringify(ttsState)}.`);
    }
    if(ttsState.spoken.some(item => item.lang !== 'ja-JP' || item.voice !== 'Kyoko' || !item.retained || item.text.length > 90)){
      throw new Error(`iPhone TTS voice, retention, or chunking failed: ${JSON.stringify(ttsState.spoken)}.`);
    }
    if(new Set(ttsState.voiceNames).size !== ttsState.voiceNames.length || new Set(ttsState.optionNames).size !== ttsState.optionNames.length){
      throw new Error(`Safari TTS voice list contains duplicates: ${JSON.stringify(ttsState)}.`);
    }
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForLoadState('networkidle', {timeout:8000}).catch(() => {});
    return ttsState;
  });

  await step('legacy vocabulary levels migrate without exposing internal metadata', async () => {
    const legacyItems = [
      {word:'旧語一', reading:'きゅうごいち', meaning:'旧数据一', level:'kuromoji'},
      {word:'旧語二', reading:'きゅうごに', meaning:'旧数据二', level:'worker'},
      {word:'旧語三', reading:'きゅうごさん', meaning:'旧数据三', level:'tokenizer'},
      {word:'旧語四', reading:'きゅうごよん', meaning:'旧数据四', level:'fallback'},
      {word:'既知語', reading:'きちご', meaning:'合法等级', level:'N3'}
    ];
    await page.evaluate(items => localStorage.setItem('reading_vocab_list', JSON.stringify(items)), legacyItems);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => typeof getAllVocab === 'function' && getAllVocab().length === 5, null, {timeout:5000});
    await page.evaluate(() => switchWorkspace('vocab'));
    const migration = await page.evaluate(() => {
      const downloads = {};
      const originalDownload = window.downloadTextFile;
      window.downloadTextFile = (filename, content) => { downloads[filename] = String(content); };
      exportVocabCsvFile();
      exportAnkiTsv();
      window.downloadTextFile = originalDownload;
      reviewAllVocab();
      flipCard();
      return {
        stored:JSON.parse(localStorage.getItem('reading_vocab_list') || '[]').map(item => ({
          word:item.word,
          reading:item.reading,
          level:item.level,
          baseForm:item.baseForm,
          baseReading:item.baseReading,
          partOfSpeech:item.partOfSpeech,
          pos:item.pos,
          lexicalSchemaVersion:item.lexicalSchemaVersion
        })),
        vocabText:document.querySelector('#vocabListPage')?.innerText || '',
        flashText:document.querySelector('#flashArea')?.innerText || '',
        visibleText:document.body.innerText || '',
        downloads
      };
    });
    const forbidden = /kuromoji|worker|tokenizer|fallback/i;
    const migratedInternal = migration.stored.filter(item => /^旧語/.test(item.word));
    const preservedJlpt = migration.stored.find(item => item.word === '既知語');
    const exportText = Object.values(migration.downloads).join('\n');
    if(migratedInternal.length !== 4 || migratedInternal.some(item => item.level !== '')){
      throw new Error(`Legacy internal levels were not migrated: ${JSON.stringify(migration.stored)}.`);
    }
    if(preservedJlpt?.level !== 'N3') throw new Error(`Valid JLPT level was damaged: ${JSON.stringify(preservedJlpt)}.`);
    if(migration.stored.some(item => item.lexicalSchemaVersion !== 1
      || item.baseForm !== item.word
      || item.baseReading !== item.reading
      || !item.partOfSpeech
      || item.pos !== item.partOfSpeech)){
      throw new Error(`Legacy vocabulary lexical fields were not migrated: ${JSON.stringify(migration.stored)}.`);
    }
    if((migration.vocabText.match(/暂无参考等级/g) || []).length < 4 || !/N3/.test(migration.vocabText)){
      throw new Error(`Vocabulary page did not render migrated levels correctly: ${JSON.stringify(migration.vocabText)}.`);
    }
    if(forbidden.test(migration.vocabText) || forbidden.test(migration.flashText) || forbidden.test(exportText) || forbidden.test(migration.visibleText)){
      throw new Error(`Internal metadata is visible after migration: ${JSON.stringify(migration)}.`);
    }
    if(!/暂无参考等级/.test(exportText)) throw new Error(`Exports did not format unknown levels as ungraded: ${JSON.stringify(migration.downloads)}.`);
    await page.evaluate(() => localStorage.clear());
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForLoadState('networkidle', {timeout:8000}).catch(() => {});
    return migration;
  });

  await step('homepage keeps settings out of the primary task', async () => {
    if (await page.locator('.mvp-settings-button').isVisible()) throw new Error('Legacy floating settings entry is still visible.');
  });

  await step('reading import', async () => {
    await page.locator('#heroInputText').fill(SAMPLE_TEXT);
    await page.locator('button[onclick="analyzeFromHero()"]').click();
    await page.locator('#output ruby.w').first().waitFor({ state: 'visible', timeout: 6000 });
    await page.locator('#rubyToggleBtn').click();
    const tokenizerStatus = page.locator('#tokenizerStatus');
    await tokenizerStatus.waitFor({state:'visible', timeout:2000});
    const immediateTokenizerStatus = await tokenizerStatus.textContent();
    if(!/(?:正在|假名已显示)/.test(immediateTokenizerStatus || '')){
      throw new Error(`Furigana action did not expose immediate user feedback: ${JSON.stringify(immediateTokenizerStatus)}.`);
    }
    await page.locator('#iconButtonHint.is-visible').waitFor({state:'attached', timeout:2000});
    const inlineTooltipDisabled = await page.locator('#rubyToggleBtn').evaluate(node => getComputedStyle(node, '::after').display === 'none');
    if(!inlineTooltipDisabled) throw new Error('Toolbar still renders the clipped inline tooltip.');
    const rubyVisible = await page.locator('#output rt').first().evaluate(node => {
      const style = getComputedStyle(node);
      return style.visibility === 'visible' && Number.parseFloat(style.fontSize) > 0;
    });
    if(!rubyVisible) throw new Error('Ruby toggle did not reveal furigana.');
    await page.waitForFunction(() => document.body.dataset.tokenizerMode === 'kuromoji-worker', null, {timeout:45000});
    const completedTokenizerStatus = await tokenizerStatus.textContent();
    const tokenizerMetrics = await page.evaluate(() => window.YOMERU_TOKENIZER_METRICS || null);
    if(!/假名已显示/.test(completedTokenizerStatus || '')){
      throw new Error(`Furigana completion status is not user-visible: ${JSON.stringify(completedTokenizerStatus)}.`);
    }
    if(/kuromoji|worker/i.test(completedTokenizerStatus || '')) throw new Error('Tokenizer status exposes internal technology names.');
    if(!tokenizerMetrics || !Number.isFinite(Number(tokenizerMetrics.roundTripMs))){
      throw new Error(`Tokenizer performance metrics are missing: ${JSON.stringify(tokenizerMetrics)}.`);
    }
    await screenshot('02-reading');
    return state('state: reading');
  });

  await step('reduced MVP public navigation and settings', async () => {
    const publicState = await page.evaluate(() => ({
      desktopNav: [...document.querySelectorAll('.app-sidebar .sidebar-nav .nav-item')]
        .filter(node => !node.hidden && getComputedStyle(node).display !== 'none')
        .map(node => node.textContent.trim()),
      hiddenViewsVisible: [...document.querySelectorAll('[data-mvp-hidden]')]
        .filter(node => getComputedStyle(node).display !== 'none').length,
      translationVisible: Boolean(document.querySelector('#translationToggleBtn') && getComputedStyle(document.querySelector('#translationToggleBtn')).display !== 'none'),
      translationPromotion: /句子翻译/.test(document.querySelector('#heroIntro')?.textContent || ''),
      settingsVisible: Boolean(document.querySelector('.sidebar-footer .sidebar-utility-button') && getComputedStyle(document.querySelector('.sidebar-footer .sidebar-utility-button')).display !== 'none'),
      floatingSettingsVisible: Boolean(document.querySelector('.mvp-settings-button') && getComputedStyle(document.querySelector('.mvp-settings-button')).display !== 'none')
    }));
    if(JSON.stringify(publicState.desktopNav) !== JSON.stringify(['阅读', '生词本'])) throw new Error(`Unexpected primary navigation: ${JSON.stringify(publicState.desktopNav)}.`);
    if(publicState.hiddenViewsVisible) throw new Error(`${publicState.hiddenViewsVisible} MVP-hidden entries are still visible.`);
    if(publicState.translationVisible || publicState.translationPromotion) throw new Error('Translation UI is still publicly visible.');
    if(!publicState.settingsVisible || publicState.floatingSettingsVisible) throw new Error(`Low-frequency settings placement is incorrect: ${JSON.stringify(publicState)}.`);
    await page.locator('.sidebar-footer .sidebar-utility-button').click();
    await page.locator('.settings-section').waitFor({state:'visible', timeout:3000});
    const dataActions = await page.evaluate(() => ({
      backup:/备份数据/.test(document.querySelector('.settings-section')?.textContent || ''),
      restore:/恢复备份/.test(document.querySelector('.settings-section')?.textContent || ''),
      clear:/清除本机学习数据/.test(document.querySelector('.settings-section')?.textContent || '')
    }));
    if(!dataActions.backup || !dataActions.restore || !dataActions.clear) throw new Error(`Settings data actions missing: ${JSON.stringify(dataActions)}.`);
    const ttsSettings = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('.settings-tts-controls')].filter(node => getComputedStyle(node).display !== 'none');
      const geometry = controls.map(node => {
        const menu = node.querySelector('.settings-choice-menu');
        const button = node.querySelector('.settings-secondary-action');
        const menuRect = menu?.getBoundingClientRect();
        const buttonRect = button?.getBoundingClientRect();
        return {
          sameRow:Boolean(menuRect && buttonRect && Math.abs(menuRect.top - buttonRect.top) <= 2),
          equalHeight:Boolean(menuRect && buttonRect && Math.abs(menuRect.height - buttonRect.height) <= 2),
          insideViewport:Boolean(buttonRect && buttonRect.right <= innerWidth + 1 && menuRect.left >= -1)
        };
      });
      return {
        rateLabel:document.getElementById('ttsRateCurrentLabel')?.textContent || '',
        voiceLabel:document.getElementById('ttsVoiceCurrentLabel')?.textContent || '',
        overflow:document.documentElement.scrollWidth > innerWidth + 2,
        geometry
      };
    });
    if(ttsSettings.rateLabel !== '自然速度' || /朗读速度|朗读音色/.test(`${ttsSettings.rateLabel} ${ttsSettings.voiceLabel}`)
      || ttsSettings.overflow || ttsSettings.geometry.some(item => !item.sameRow || !item.equalHeight || !item.insideViewport)){
      throw new Error(`TTS setting controls do not show their selected values in one desktop row: ${JSON.stringify(ttsSettings)}.`);
    }
    await page.locator('.app-sidebar .nav-item[data-view="reading"]').click();
    return {publicState, dataActions, ttsSettings};
  });

  await step('public sample uses pasted-text analysis path', async () => {
    await page.evaluate(async () => loadSample('life'));
    const sampleResult = await page.evaluate(() => ({
      id:'life',
      view:document.body.dataset.view,
      paragraphs:document.querySelectorAll('#output .reading-translation-pair').length,
      hasReading:document.body.classList.contains('has-reading')
    }));
    if(sampleResult.view !== 'reading' || !sampleResult.hasReading || sampleResult.paragraphs < 2) throw new Error(`Public sample did not use the normal reading path: ${JSON.stringify(sampleResult)}.`);
    await page.evaluate(async text => {
      document.getElementById('inputText').value = text;
      await renderText();
    }, SAMPLE_TEXT);
    return sampleResult;
  });

  await step('inflected readings, base-form levels, and new Chinese meanings stay aligned', async () => {
    await page.evaluate(async () => loadSample('life'));
    await page.waitForFunction(() => document.body.dataset.tokenizerMode === 'kuromoji-worker', null, {timeout:45000});
    const readingState = await page.evaluate(() => {
      const cache = window.KUROMOJI_TOKEN_CACHE.filter(Boolean);
      const read = cache.find(item => item.surface === '読ん');
      const sleep = cache.find(item => item.surface === '寝ます');
      return {
        read:{reading:read?.info?.reading || '', lookupWord:read?.info?.lookupWord || '', level:read?.info?.level || ''},
        sleepTokenId:window.KUROMOJI_TOKEN_CACHE.findIndex(item => item?.surface === '寝ます'),
        sleepBase:sleep?.info?.baseForm || ''
      };
    });
    if(JSON.stringify(readingState.read) !== JSON.stringify({reading:'よん', lookupWord:'読む', level:'N5'})
      || readingState.sleepTokenId < 0 || readingState.sleepBase !== '寝る'){
      throw new Error(`Inflection reading/base-form split failed: ${JSON.stringify(readingState)}.`);
    }
    await page.evaluate(tokenId => showTokenDetail(tokenId, null), readingState.sleepTokenId);
    await page.waitForFunction(() => /睡觉、就寝/.test(document.querySelector('#detailArea')?.textContent || '')
      && /JLPT 参考等级：N5/.test(document.querySelector('#detailArea')?.textContent || ''), null, {timeout:6000});
    const sleepDetailText = await page.locator('#detailArea').textContent();
    if(!/原形\s*寝る（ねる）/.test(sleepDetailText || '') || !/词形/.test(sleepDetailText || '')){
      throw new Error(`Unified inflection detail is incomplete: ${JSON.stringify(sleepDetailText)}.`);
    }
    await page.evaluate(tokenId => requestTokenVocabSave(tokenId), readingState.sleepTokenId);
    const savedSleep = await page.evaluate(() => getAllVocab().find(item => item.word === '寝ます') || null);
    if(!savedSleep
      || savedSleep.lexicalSchemaVersion !== 1
      || savedSleep.reading !== 'ねます'
      || savedSleep.baseForm !== '寝る'
      || savedSleep.baseReading !== 'ねる'
      || !/動詞|动词/.test(savedSleep.partOfSpeech || '')
      || !savedSleep.conjugationForm
      || savedSleep.lookupMatchedTerm !== '寝る'
      || savedSleep.lookupMatchedKind !== 'lemma'
      || savedSleep.level !== 'N5'){
      throw new Error(`Inflected vocabulary metadata was not preserved: ${JSON.stringify(savedSleep)}.`);
    }

    await page.evaluate(async () => {
      document.getElementById('inputText').value = 'この施設は無償で利用できます。';
      await renderText();
    });
    const freeTokenId = await page.evaluate(() => window.KUROMOJI_TOKEN_CACHE.findIndex(item => item?.surface === '無償'));
    if(freeTokenId < 0) throw new Error('Worker output did not expose 無償 as a token.');
    await page.evaluate(tokenId => showTokenDetail(tokenId, null), freeTokenId);
    await page.waitForFunction(() => /免费、无偿（不收取费用）/.test(document.querySelector('#detailArea')?.textContent || ''), null, {timeout:6000});
    return {readingState, freeTokenId};
  });

  await step('real pasted text uses local Worker with paragraphs, readings and details', async () => {
    const pasted = '三菱UFJフィナンシャル・グループの時価総額が上昇した。\n金融機関が首位に浮上した。\n半導体メモリー大手を上回った。';
    await page.evaluate(async text => {
      document.getElementById('inputText').value = text;
      await renderText();
    }, pasted);
    const paragraphCount = await page.locator('#output .reading-translation-pair').count();
    if(paragraphCount < 3) throw new Error(`Single line breaks collapsed: ${paragraphCount} paragraph(s).`);
    const unknown = page.locator('#output ruby.w-kuromoji').first();
    await unknown.waitFor({state:'visible', timeout:3000});
    await unknown.click();
    await page.locator('#detailArea .add-vocab-tool').waitFor({state:'visible', timeout:3000});
    await page.waitForFunction(() => document.body.dataset.tokenizerMode === 'kuromoji-worker', null, {timeout:45000});
    const workerState = await page.evaluate(() => {
      const cache = window.KUROMOJI_TOKEN_CACHE.filter(Boolean);
      const selected = ['三菱', 'UFJ', 'フィナンシャル'].map(term => {
        const item = cache.find(entry => entry.surface === term)
          || cache.find(entry => entry.surface.includes(term) || term.includes(entry.surface));
        return {term, surface:item?.surface || '', reading:item?.info?.reading || ''};
      });
      return {
        paragraphs:document.querySelectorAll('#output .reading-translation-pair').length,
        selected,
        tokenCount:cache.length,
        readingCount:cache.filter(item => Boolean(item.info?.reading)).length,
        fallback:document.body.dataset.tokenizerFallback || '',
        exportBreaks:collectRubyUnits().filter(unit => unit.base === '\n').length,
        exportRows:buildEditablePptRows(collectRubyUnits(), 35).map(row => row.length)
      };
    });
    if(workerState.paragraphs !== 3 || workerState.selected.filter(item => item.reading).length < 2 || workerState.readingCount < 20 || workerState.fallback){
      throw new Error(`Local Worker integration did not meet the reading baseline: ${JSON.stringify(workerState)}.`);
    }
    await page.evaluate(() => {
      const originalLookup = lookupJmdictCommon;
      window.__restoreDelayedLookup = ()=>{ lookupJmdictCommon = originalLookup; delete window.__restoreDelayedLookup; };
      lookupJmdictCommon = async candidates => {
        await new Promise(resolve=>setTimeout(resolve, 1500));
        return originalLookup(candidates);
      };
    });
    const jmdictToken = page.locator('#output ruby.w-kuromoji').filter({hasText:'グループ'}).first();
    await jmdictToken.waitFor({state:'visible', timeout:3000});
    await jmdictToken.click();
    const queuedWord = (await page.locator('#detailArea .detail-word').textContent() || '').trim();
    const pendingSaveButton = page.locator('#detailArea .add-vocab-tool');
    await pendingSaveButton.click();
    const pendingState = {
      disabled:await pendingSaveButton.isDisabled(),
      busy:await pendingSaveButton.getAttribute('aria-busy'),
      label:await pendingSaveButton.getAttribute('aria-label')
    };
    if(!queuedWord || !pendingState.disabled || pendingState.busy !== 'true' || !/自动加入生词本/.test(pendingState.label || '')){
      throw new Error(`Pending dictionary save did not expose clear feedback: ${JSON.stringify({queuedWord, pendingState})}.`);
    }
    await page.waitForFunction(word => getAllVocab().some(item => item.word === word), queuedWord, {timeout:7000});
    await page.evaluate(() => window.__restoreDelayedLookup?.());
    const queuedJmdictWord = await page.evaluate(word => getAllVocab().find(item => item.word === word), queuedWord);
    if(!queuedJmdictWord?.meaning || queuedJmdictWord.meaning === '释义待补充'){
      throw new Error(`Queued JMdict word did not save its final meaning: ${JSON.stringify(queuedJmdictWord)}.`);
    }
    const jmdictMeaning = page.locator('#detailArea .detail-meaning');
    await jmdictMeaning.getByText(/英文释义/).waitFor({state:'visible', timeout:5000});
    const jmdictDetail = await page.locator('#detailArea').textContent();
    const sourceNote = page.locator('#detailArea .dictionary-source-note');
    const sourceText = await sourceNote.textContent();
    const sourceAria = await sourceNote.locator('a').getAttribute('aria-label');
    if(!/词典来源：JMdict/.test(sourceText || '') || !/EDRDG/.test(sourceAria || '')){
      throw new Error(`Offline dictionary attribution is missing or too prominent: ${JSON.stringify({sourceText, sourceAria, jmdictDetail})}.`);
    }
    if(!/暂无参考等级/.test(jmdictDetail || '') || /kuromoji|worker|tokenizer|fallback/i.test(jmdictDetail || '')){
      throw new Error(`Word detail exposed internal metadata or missed the ungraded label: ${JSON.stringify(jmdictDetail)}.`);
    }
    if(workerState.exportBreaks !== 2 || workerState.exportRows.length > 4 || workerState.exportRows.some(length => length === 0)){
      throw new Error(`PPT export introduced layout whitespace or unnecessary pages: ${JSON.stringify(workerState)}.`);
    }
    const historyRestore = await page.evaluate(async () => {
      const item = READING_HISTORY.find(entry => /三菱UFJ/.test(entry.text || ''));
      if(!item) return {found:false};
      await restoreHistoryArticle(item.id);
      return {
        found:true,
        mode:document.body.dataset.tokenizerMode,
        paragraphs:document.querySelectorAll('#output .reading-translation-pair').length
      };
    });
    if(!historyRestore.found || historyRestore.mode !== 'kuromoji-worker' || historyRestore.paragraphs !== 3){
      throw new Error(`Reading history did not restore through the Worker path: ${JSON.stringify(historyRestore)}.`);
    }
    await page.evaluate(() => {
      const tokenId = window.KUROMOJI_TOKEN_CACHE.findIndex(item => item?.surface === '三菱');
      document.querySelector(`#output ruby[data-token-id="${tokenId}"]`)?.click();
    });
    await page.waitForFunction(() => /みつびし/.test(document.querySelector('#detailArea')?.textContent || ''));
    await page.locator('#detailArea .add-vocab-tool').click();
    await page.waitForFunction(() => getAllVocab().some(item => item.word === '三菱'), null, {timeout:5000});
    const savedWorkerWord = await page.evaluate(() => getAllVocab().find(item => item.word === '三菱'));
    if(savedWorkerWord?.reading !== 'みつびし' || !savedWorkerWord?.meaning){
      throw new Error(`Worker word was not saved with its reading and safe meaning state: ${JSON.stringify(savedWorkerWord)}.`);
    }
    if(savedWorkerWord?.level !== ''){
      throw new Error(`Worker word retained internal level metadata: ${JSON.stringify(savedWorkerWord)}.`);
    }
    const savedWorkerRow = await page.evaluate(() => {
      switchWorkspace('vocab');
      const row = [...document.querySelectorAll('#vocabListPage .vocab-table-row')]
        .find(item => /三菱/.test(item.textContent || ''));
      return row?.innerText || '';
    });
    if(!/暂无参考等级/.test(savedWorkerRow) || /kuromoji|worker|tokenizer|fallback/i.test(savedWorkerRow)){
      throw new Error(`Saved Worker word is not user-safe in the vocabulary page: ${JSON.stringify(savedWorkerRow)}.`);
    }
    await page.evaluate(() => switchWorkspace('reading'));
    const retryState = await page.evaluate(async text => {
      const originalGetClient = getLocalKuromojiWorkerClient;
      const originalSetStatus = setTokenizerStatus;
      const successfulResult = await originalGetClient().analyze(text);
      const statuses = [];
      let firstScenarioCalls = 0;
      let failureScenarioCalls = 0;
      const fakeClient = analyze => ({analyze, terminate(){}});
      try{
        setTokenizerStatus = (message, state, options) => {
          statuses.push({message, state});
          return originalSetStatus(message, state, options);
        };
        getLocalKuromojiWorkerClient = () => {
          firstScenarioCalls += 1;
          return firstScenarioCalls === 1
            ? fakeClient(async()=>{ throw new Error('simulated first cold-start failure'); })
            : fakeClient(async()=>successfulResult);
        };
        document.getElementById('inputText').value = text;
        await renderText();
        const recovered = {
          mode:document.body.dataset.tokenizerMode,
          fallback:document.body.dataset.tokenizerFallback || '',
          finalStatus:document.getElementById('tokenizerStatus')?.textContent || '',
          interimCount:statuses.filter(item => item.message === '首次加载未完成，正在自动重试……' && item.state === 'loading').length
        };

        statuses.length = 0;
        getLocalKuromojiWorkerClient = () => {
          failureScenarioCalls += 1;
          return fakeClient(async()=>{ throw new Error(`simulated terminal failure ${failureScenarioCalls}`); });
        };
        await renderText();
        const failed = {
          mode:document.body.dataset.tokenizerMode,
          fallback:document.body.dataset.tokenizerFallback || '',
          finalStatus:document.getElementById('tokenizerStatus')?.textContent || '',
          finalErrorCount:statuses.filter(item => item.message === '假名生成没有完成，请点击重新生成。' && item.state === 'error').length,
          noticeVisible:Boolean(document.querySelector('#output .fallback-notice')),
          retryFlag:TOKENIZER_LAST_ATTEMPT_FAILED
        };

        getLocalKuromojiWorkerClient = originalGetClient;
        await toggleReaderSmartSegmentation();
        const manualRetry = {
          mode:document.body.dataset.tokenizerMode,
          fallback:document.body.dataset.tokenizerFallback || '',
          retryFlag:TOKENIZER_LAST_ATTEMPT_FAILED
        };
        return {firstScenarioCalls, failureScenarioCalls, recovered, failed, manualRetry};
      }finally{
        getLocalKuromojiWorkerClient = originalGetClient;
        setTokenizerStatus = originalSetStatus;
      }
    }, pasted);
    if(retryState.firstScenarioCalls !== 2 || retryState.recovered.mode !== 'kuromoji-worker' || retryState.recovered.fallback || retryState.recovered.interimCount !== 1){
      throw new Error(`Cold-start retry did not recover exactly once: ${JSON.stringify(retryState)}.`);
    }
    if(retryState.failureScenarioCalls !== 2 || retryState.failed.mode !== 'built-in' || retryState.failed.fallback !== 'true'
      || retryState.failed.finalErrorCount !== 1 || retryState.failed.noticeVisible || !retryState.failed.retryFlag){
      throw new Error(`Terminal Worker failure was not reported once after two attempts: ${JSON.stringify(retryState)}.`);
    }
    if(retryState.manualRetry.mode !== 'kuromoji-worker' || retryState.manualRetry.fallback || retryState.manualRetry.retryFlag){
      throw new Error(`Manual furigana retry did not recover after the final error: ${JSON.stringify(retryState)}.`);
    }

    const auxiliaryMasuState = await page.evaluate(() => {
      const token = {
        surface_form:'ます', basic_form:'ます', reading:'マス',
        pos:'助動詞', pos_detail_1:'*', conjugated_type:'特殊・マス', conjugated_form:'基本形'
      };
      const info = getTokenInfo(token);
      const merged = ['あり', '開き', '起き'].map(stem => mergeDictionaryCompounds([
        {surface_form:stem, basic_form:stem, reading:stem, pos:'動詞'},
        token
      ]).map(item => item.surface_form));
      return {info, merged, grammarUnit:isGrammarReadingUnit(info)};
    });
    if(auxiliaryMasuState.info.meaning !== '礼貌助动词，用于构成动词的礼貌表达'
      || auxiliaryMasuState.info.pos !== '助动词' || auxiliaryMasuState.info.level
      || /measuring container/i.test(auxiliaryMasuState.info.meaning)
      || !auxiliaryMasuState.grammarUnit
      || JSON.stringify(auxiliaryMasuState.merged) !== JSON.stringify([['あります'], ['開きます'], ['起きます']])){
      throw new Error(`Auxiliary ます context handling failed: ${JSON.stringify(auxiliaryMasuState)}.`);
    }
    return {...state('state: real pasted text'), workerState, historyRestore, savedWorkerWord, retryState, auxiliaryMasuState};
  });

  await step('word detail and vocab add', async () => {
    await page.evaluate(() => {
      const tokenId = window.KUROMOJI_TOKEN_CACHE.findIndex(item => item?.surface === '毎朝');
      document.querySelector(`#output ruby[data-token-id="${tokenId}"]`)?.click();
    });
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

  if(AUDIT_HIDDEN_LEGACY_MODULES) await step('typing practice', async () => {
    await page.evaluate(() => switchWorkspace('retell'));
    await page.locator('#startTypingPracticeBtn').click();
    await page.locator('#typingInput').fill('私は学生です。');
    await page.locator('#typingPracticeModule button[onclick="checkTypingAnswer()"]').click();
    await screenshot('05-typing');
    return state('state: typing');
  });

  if(AUDIT_HIDDEN_LEGACY_MODULES) await step('Safari audio-only retell fallback', async () => {
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

  if(AUDIT_HIDDEN_LEGACY_MODULES) await step('history page', async () => {
    await page.evaluate(() => switchWorkspace('history'));
    await screenshot('06-history');
    return state('state: history');
  });

  await step('delete confirmation', async () => {
    await page.locator('button.nav-vocab').click();
    const exitButton = page.locator('.vocab-review-exit');
    if (await exitButton.isVisible().catch(() => false)) await exitButton.click();
    await page.locator('#vocabListPage .vocab-action-button[aria-label^="删除"]').first().click();
    await page.locator('#deleteConfirmModal.active').waitFor({ state: 'visible', timeout: 3000 });
    await screenshot('07-delete-confirm');
    return state('state: delete confirm');
  });

  if(AUDIT_HIDDEN_LEGACY_MODULES) await step('grammar add and persistence', async () => {
    const cancelButton = page.locator('#deleteConfirmCancel');
    if (await cancelButton.isVisible().catch(() => false)) await cancelButton.click();
    await page.evaluate(() => switchWorkspace('grammar'));
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

  if(AUDIT_HIDDEN_LEGACY_MODULES) await step('grammar delete icon and delete flow', async () => {
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

  await step('hidden module data remains intact', async () => {
    const result = await page.evaluate(() => {
      const keys = ['reading_grammar_book', 'reading_practice_history', 'reading_history'];
      const before = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
      switchWorkspace('reading');
      switchWorkspace('vocab');
      switchWorkspace('settings');
      switchWorkspace('reading');
      const after = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
      return {before, after};
    });
    if(JSON.stringify(result.before) !== JSON.stringify(result.after)) throw new Error(`Hidden module data changed during public navigation: ${JSON.stringify(result)}.`);
    return {keys:Object.keys(result.before), unchanged:true};
  });
  }

  // Start responsive checks in a fresh context so the long functional trace
  // cannot exhaust Chromium before the mobile/desktop viewport pass begins.
  if(!AUDIT_FUNCTIONAL_ONLY){
    if(!AUDIT_RESPONSIVE_ONLY){
      await context.tracing.stop();
      await context.close();
      context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      page = await context.newPage();
      page.setDefaultNavigationTimeout(60000);
      await installAuditRoutes(page);
      page.on('console', message => {
        if (!['error', 'warning', 'warn'].includes(message.type())) return;
        report.console.push({ type: message.type(), text: message.text(), location: message.location() });
      });
      page.on('pageerror', error => report.console.push({ type: 'pageerror', text: error.message }));
      page.on('requestfailed', request => {
        const url = request.url();
        if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) return;
        report.console.push({ type: 'requestfailed', text: `${request.method()} ${url} ${request.failure()?.errorText || ''}`.trim() });
      });
    }

  for (const viewport of VIEWPORTS) {
    process.stdout.write(`- viewport ${viewport.name}... `);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    process.stdout.write('size ');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    process.stdout.write('goto ');
    await page.evaluate(async () => {
      localStorage.clear();
      if (typeof ensureLearningData === 'function') await ensureLearningData();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    process.stdout.write('reload ');
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    process.stdout.write('ready ');
    const publicPdfEntryCount = await page.getByText('上传 PDF', { exact: true }).count();
    process.stdout.write('pdf ');
    if (publicPdfEntryCount !== 0) {
      throw new Error(`Viewport ${viewport.name} still exposes ${publicPdfEntryCount} public PDF upload entr${publicPdfEntryCount === 1 ? 'y' : 'ies'}.`);
    }
    if (viewport.width <= 720) {
      const heroActionsLayout = await page.evaluate(() => {
        const sample = document.querySelector('button[onclick="loadSampleFromHero()"]');
        const start = document.getElementById('heroStartButton');
        if (!sample || !start) return null;
        const sampleRect = sample.getBoundingClientRect();
        const startRect = start.getBoundingClientRect();
        return {
          sampleLeft: Math.round(sampleRect.left),
          sampleTop: Math.round(sampleRect.top),
          startLeft: Math.round(startRect.left),
          startTop: Math.round(startRect.top)
        };
      });
      if (!heroActionsLayout
        || heroActionsLayout.startTop >= heroActionsLayout.sampleTop
        || Math.abs(heroActionsLayout.sampleLeft - heroActionsLayout.startLeft) > 3) {
        throw new Error(`Viewport ${viewport.name} hero actions do not keep the primary action first in one vertical column: ${JSON.stringify(heroActionsLayout)}.`);
      }
      if (viewport.name === 'mobile-390') await screenshot('viewport-mobile-390-home');
    }
    process.stdout.write('hero ');
    await page.locator('#heroInputText').fill(SAMPLE_TEXT);
    await page.locator('button[onclick="analyzeFromHero()"]', { hasText: '开始阅读' }).click();
    await page.locator('#output ruby.w').first().waitFor({ state: 'visible', timeout: 6000 });
    process.stdout.write('reading ');
    if (viewport.width <= 720) {
      const toolbarLayout = await page.evaluate(() => {
        const toolbar = document.querySelector('#readerToolbar');
        const groups = toolbar ? [...toolbar.querySelectorAll('.reader-tool-group')] : [];
        if (!toolbar || groups.length !== 2) return null;
        const first = groups[0].getBoundingClientRect();
        const second = groups[1].getBoundingClientRect();
        const style = getComputedStyle(toolbar);
        return {
          firstLeft: Math.round(first.left),
          firstTop: Math.round(first.top),
          firstBottom: Math.round(first.bottom),
          secondLeft: Math.round(second.left),
          secondTop: Math.round(second.top),
          display: style.display,
          overflowX: style.overflowX,
          clientWidth: toolbar.clientWidth,
          scrollWidth: toolbar.scrollWidth
        };
      });
      if (!toolbarLayout
        || Math.abs(toolbarLayout.firstLeft - toolbarLayout.secondLeft) > 3
        || toolbarLayout.secondTop < toolbarLayout.firstBottom
        || toolbarLayout.display !== 'grid'
        || toolbarLayout.scrollWidth > toolbarLayout.clientWidth + 2) {
        throw new Error(`Viewport ${viewport.name} reader toolbar is not two visible left-aligned rows: ${JSON.stringify(toolbarLayout)}.`);
      }
      if (viewport.name === 'mobile-390') await screenshot('viewport-mobile-390-reading-toolbar');
    }
    await page.locator('#readerToolbar .import-tool').click();
    await page.locator('#sourceComposer').waitFor({ state: 'visible', timeout: 3000 });
    const withdrawnPdfUi = await page.evaluate(() => {
      const composer = document.querySelector('#sourceComposer');
      return {
        pdfControls: composer?.querySelectorAll('#pdfModeSelect, #pdfCleanupSelect, input[accept*="pdf"], button').length
          ? [...composer.querySelectorAll('#pdfModeSelect, #pdfCleanupSelect, input[accept*="pdf"], button')]
            .filter(node => /pdf|排版方向|资料类型/i.test(`${node.id || ''} ${node.textContent || ''} ${node.getAttribute('accept') || ''}`)).length
          : 0,
        pdfCopy: /pdf|排版方向|资料类型|竖排|横排|网页打印/i.test(composer?.innerText || '')
      };
    });
    if (withdrawnPdfUi.pdfControls || withdrawnPdfUi.pdfCopy) {
      throw new Error(`Viewport ${viewport.name} edit-source flow still exposes withdrawn PDF UI: ${JSON.stringify(withdrawnPdfUi)}.`);
    }
    await page.locator('#analyzeSourceBtn').click();
    await page.locator('#output ruby.w').first().waitFor({ state: 'visible', timeout: 6000 });
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
      const mobileNavLabels = await page.evaluate(() => [...document.querySelectorAll('#menuPanel .nav-item')]
        .filter(node => node.dataset.view !== 'settings' && !node.hidden && getComputedStyle(node).display !== 'none')
        .map(node => node.textContent.trim()));
      if(JSON.stringify(mobileNavLabels) !== JSON.stringify(['阅读', '生词本'])) throw new Error(`Viewport ${viewport.name} exposes unexpected mobile navigation: ${JSON.stringify(mobileNavLabels)}.`);
      const mobileSettingsVisible = await page.locator('#menuPanel .menu-settings-entry').isVisible();
      if(!mobileSettingsVisible) throw new Error(`Viewport ${viewport.name} does not expose settings at the bottom of the menu.`);
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
    const vocabLayout = await page.evaluate(() => {
      const workbar = document.querySelector('.vocab-workbar');
      const search = document.querySelector('.vocab-search-shell');
      const reviewButton = document.querySelector('.vocab-workbar button');
      const manageButton = document.querySelector('.vocab-management-menu');
      const list = document.querySelector('.vocab-page-list');
      const row = document.querySelector('#vocabListPage .vocab-table-row');
      const actions = row?.querySelector('.vocab-row-actions');
      const workbarRect = workbar?.getBoundingClientRect();
      const searchRect = search?.getBoundingClientRect();
      const reviewRect = reviewButton?.getBoundingClientRect();
      const manageRect = manageButton?.getBoundingClientRect();
      const listRect = list?.getBoundingClientRect();
      const actionsRect = actions?.getBoundingClientRect();
      return {
        documentOverflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        listOverflowX: Boolean(list && list.scrollWidth > list.clientWidth + 2),
        rowOverflowX: Boolean(row && row.scrollWidth > row.clientWidth + 2),
        actionsInsideList: Boolean(listRect && actionsRect && actionsRect.right <= listRect.right + 1 && actionsRect.left >= listRect.left - 1),
        actionsInsideViewport: Boolean(actionsRect && actionsRect.right <= window.innerWidth + 1 && actionsRect.left >= -1),
        actionsVisible: actions ? getComputedStyle(actions).opacity !== '0' : false,
        workbarRect: workbarRect ? {left:workbarRect.left, right:workbarRect.right, width:workbarRect.width} : null,
        searchRect: searchRect ? {left:searchRect.left, right:searchRect.right, top:searchRect.top, bottom:searchRect.bottom, width:searchRect.width} : null,
        reviewRect: reviewRect ? {left:reviewRect.left, right:reviewRect.right, top:reviewRect.top, bottom:reviewRect.bottom, width:reviewRect.width} : null,
        manageRect: manageRect ? {left:manageRect.left, right:manageRect.right, top:manageRect.top, bottom:manageRect.bottom, width:manageRect.width} : null,
        firstRowAligned: Boolean(searchRect && manageRect && Math.abs(searchRect.top - manageRect.top) <= 2),
        reviewOnSecondRow: Boolean(reviewRect && searchRect && manageRect && reviewRect.top >= Math.max(searchRect.bottom, manageRect.bottom) - 1),
        reviewMatchesContentWidth: Boolean(reviewRect && searchRect && manageRect
          && Math.abs(reviewRect.left - searchRect.left) <= 2
          && Math.abs(reviewRect.right - manageRect.right) <= 2),
        listRect: listRect ? {left:listRect.left, right:listRect.right, width:listRect.width} : null,
        rowRect: row ? (() => { const rect = row.getBoundingClientRect(); return {left:rect.left, right:rect.right, width:rect.width}; })() : null,
        actionsRect: actionsRect ? {left:actionsRect.left, right:actionsRect.right, width:actionsRect.width} : null,
        rowGrid: row ? getComputedStyle(row).gridTemplateColumns : null
      };
    });
    const actionsClipped = viewport.width > 720 ? !vocabLayout.actionsInsideList : !vocabLayout.actionsInsideViewport;
    if(vocabLayout.documentOverflowX || vocabLayout.listOverflowX || vocabLayout.rowOverflowX || actionsClipped || !vocabLayout.actionsVisible){
      throw new Error(`Viewport ${viewport.name} vocab table clips or scrolls its actions: ${JSON.stringify(vocabLayout)}.`);
    }
    if(['mobile-390', 'mobile-430'].includes(viewport.name)
      && (!vocabLayout.firstRowAligned || !vocabLayout.reviewOnSecondRow || !vocabLayout.reviewMatchesContentWidth)){
      throw new Error(`Viewport ${viewport.name} mobile vocab workbar hierarchy regressed: ${JSON.stringify(vocabLayout)}.`);
    }
    if(viewport.width > 720) await screenshot(`viewport-${viewport.name}-vocab`);
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
    const settingsLayout = await page.evaluate(() => {
      switchWorkspace('settings');
      const controls = [...document.querySelectorAll('.settings-tts-controls')].filter(node => getComputedStyle(node).display !== 'none');
      return {
        overflow:document.documentElement.scrollWidth > innerWidth + 2,
        labels:[
          document.getElementById('ttsRateCurrentLabel')?.textContent || '',
          document.getElementById('ttsVoiceCurrentLabel')?.textContent || ''
        ],
        rows:controls.map(node => {
          const menuRect = node.querySelector('.settings-choice-menu')?.getBoundingClientRect();
          const buttonRect = node.querySelector('.settings-secondary-action')?.getBoundingClientRect();
          return {
            sameRow:Boolean(menuRect && buttonRect && Math.abs(menuRect.top - buttonRect.top) <= 2),
            insideViewport:Boolean(menuRect && buttonRect && menuRect.left >= -1 && buttonRect.right <= innerWidth + 1)
          };
        })
      };
    });
    if(settingsLayout.overflow || settingsLayout.rows.some(item => !item.insideViewport)
      || (viewport.width > 480 && settingsLayout.rows.some(item => !item.sameRow))
      || /朗读速度|朗读音色/.test(settingsLayout.labels.join(' '))){
      throw new Error(`Viewport ${viewport.name} TTS settings layout regressed: ${JSON.stringify(settingsLayout)}.`);
    }
    await page.evaluate(() => switchWorkspace('vocab'));
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
    process.stdout.write('ok\n');
  }
  }

  const appLogs = report.console.filter(entry => {
    const text = entry.text || '';
    const isOptionalFontRequest = text.includes('fonts.googleapis.com') || text.includes('fonts.gstatic.com');
    const isOptionalKuromojiRequest = text.includes('cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/');
    const isExpectedTokenizerFallback = text.includes('kuromoji 加载失败,已退回内置词库')
      || text.includes('kuromoji 初始化失败,已退回内置词库')
      || text.includes('本地 Kuromoji Worker 分析失败，已退回内置词库')
      || text.includes('/workers/missing-kuromoji-worker.js')
      || text.includes('simulated first cold-start failure')
      || text.includes('simulated terminal failure');
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
