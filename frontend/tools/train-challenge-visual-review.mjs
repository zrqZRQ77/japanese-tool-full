#!/usr/bin/env node

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = resolve(FRONTEND_DIR, 'audit-screenshots/train-route-hub-latest');
const REGISTRY = JSON.parse(await readFile(resolve(FRONTEND_DIR, 'challenge/train/routes/index.json'), 'utf8'));
const ROUTES = await Promise.all(REGISTRY.routes.map(async entry => ({
  entry,
  data: JSON.parse(await readFile(resolve(FRONTEND_DIR, `.${entry.path}`), 'utf8'))
})));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};
const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'narrow', width: 820, height: 900 },
  { id: 'mobile', width: 390, height: 844 }
];

function pathFor(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname);
  let normalized = pathname;
  if (pathname === '/') normalized = '/index.html';
  if (pathname === '/challenge/train' || pathname === '/challenge/train/') normalized = '/challenge/train/index.html';
  if (pathname === '/challenge/train/play' || pathname === '/challenge/train/play/') normalized = '/challenge/train/play/index.html';
  const filePath = resolve(FRONTEND_DIR, `.${normalized}`);
  return filePath.startsWith(FRONTEND_DIR) ? filePath : null;
}

function startServer(port) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    if (pathname === '/favicon.ico') return response.writeHead(204).end();
    const filePath = pathFor(request.url || '/');
    if (!filePath) return response.writeHead(403).end('Forbidden');
    try {
      await access(filePath);
      response.writeHead(200, {
        'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end('Not found');
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

async function availableServer() {
  for (let port = 5260; port < 5295; port += 1) {
    try {
      return { server: await startServer(port), port };
    } catch (error) {
      if (error?.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error('No local port available for train visual review.');
}

function rectSnapshot(element) {
  if (!element) return null;
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    left: Math.round(box.left),
    top: Math.round(box.top),
    right: Math.round(box.right),
    bottom: Math.round(box.bottom),
    width: Math.round(box.width),
    height: Math.round(box.height),
    display: style.display,
    overflowX: style.overflowX,
    overflowY: style.overflowY
  };
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const visible = element => Boolean(element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0);
    const firstVisible = selector => [...document.querySelectorAll(selector)].find(visible) || null;
    const rectSnapshot = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: Math.round(box.left),
        top: Math.round(box.top),
        right: Math.round(box.right),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height),
        display: style.display,
        overflowX: style.overflowX,
        overflowY: style.overflowY
      };
    };
    const clipping = [...document.querySelectorAll('h1,h2,h3,p,strong,span,a,button,input')]
      .filter(visible)
      .filter(element => element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2)
      .map(element => ({
        tag: element.tagName,
        id: element.id || '',
        className: typeof element.className === 'string' ? element.className : '',
        text: (element.textContent || element.value || '').trim().slice(0, 80),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight
      }))
      .slice(0, 30);
    const overlaps = [];
    const important = [...document.querySelectorAll('.route-card,.route-card-action,.hub-summary,.ticket,.metrics,.rail-map,.question,.answer,.question-tools,.result-card,.result-actions')].filter(visible);
    for (let leftIndex = 0; leftIndex < important.length; leftIndex += 1) {
      const a = important[leftIndex];
      const ar = a.getBoundingClientRect();
      for (let rightIndex = leftIndex + 1; rightIndex < important.length; rightIndex += 1) {
        const b = important[rightIndex];
        if (a.contains(b) || b.contains(a)) continue;
        const br = b.getBoundingClientRect();
        const width = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
        const height = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
        if (width > 3 && height > 3) overlaps.push({
          a: a.id || a.className,
          b: b.id || b.className,
          width: Math.round(width),
          height: Math.round(height)
        });
      }
    }
    const answer = document.querySelector('.answer');
    const saveButton = document.getElementById('saveResultCardButton');
    return {
      state: document.body.dataset.gameState || (document.body.dataset.routeHubReady ? 'hub' : 'unknown'),
      routeId: document.body.dataset.routeId || '',
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1
      },
      hubHero: rectSnapshot(document.querySelector('.hub-hero')),
      routeGrid: rectSnapshot(document.querySelector('.route-grid')),
      routeCards: [...document.querySelectorAll('.route-card')].map(rectSnapshot),
      ticket: rectSnapshot(firstVisible('.ticket')),
      playView: rectSnapshot(firstVisible('.play-view')),
      metrics: rectSnapshot(firstVisible('.metrics')),
      railMap: rectSnapshot(firstVisible('.rail-map')),
      question: rectSnapshot(firstVisible('.question')),
      prompt: rectSnapshot(firstVisible('#questionPrompt')),
      answer: rectSnapshot(answer),
      tools: rectSnapshot(firstVisible('.question-tools')),
      resultCard: rectSnapshot(firstVisible('.result-card')),
      resultActions: rectSnapshot(firstVisible('.result-actions')),
      visibleStops: [...document.querySelectorAll('.rail-stop')].filter(visible).length,
      totalStops: document.querySelectorAll('.rail-stop').length,
      clipping,
      overlaps,
      answerFocus: answer ? {
        focusWithin: answer.matches(':focus-within'),
        activeElementId: document.activeElement?.id || '',
        outlineStyle: getComputedStyle(answer).outlineStyle,
        outlineWidth: getComputedStyle(answer).outlineWidth,
        boxShadow: getComputedStyle(answer).boxShadow
      } : null,
      saveFocus: saveButton ? {
        activeElementId: document.activeElement?.id || '',
        focusVisible: saveButton.matches(':focus-visible'),
        outlineStyle: getComputedStyle(saveButton).outlineStyle,
        outlineWidth: getComputedStyle(saveButton).outlineWidth,
        boxShadow: getComputedStyle(saveButton).boxShadow
      } : null
    };
  });
}

async function capture(page, name, { fullPage = false } = {}) {
  const filename = `${name}${fullPage ? '-full' : ''}.png`;
  await page.screenshot({ path: join(OUTPUT_DIR, filename), fullPage, animations: 'disabled' });
  return filename;
}

async function completeRoute(page, route) {
  for (let index = 0; index < route.stations.length; index += 1) {
    await page.locator('#trainAnswerInput').fill(route.stations[index].reading);
    await page.locator('#trainAnswerSubmitButton').click();
    if (index === route.stations.length - 1) {
      await page.waitForFunction(() => document.body.dataset.gameState === 'result');
    } else {
      await page.waitForFunction(expected => window.YOMERU_TRAIN_CHALLENGE.snapshot().index === expected, index + 1);
    }
  }
}

function reviewPage(report, item) {
  const { metrics, viewport, state, routeId } = item;
  const page = [viewport, routeId, state].filter(Boolean).join(':');
  if (metrics.document.overflowX) report.errors.push({ type: 'horizontal-overflow', page });
  if (metrics.overlaps.length) report.errors.push({ type: 'unexpected-overlap', page, overlaps: metrics.overlaps });
  const meaningfulClipping = metrics.clipping.filter(value => !/skip-link|sr-only|rail-stop/.test(value.className));
  if (meaningfulClipping.length) report.errors.push({ type: 'content-clipping', page, elements: meaningfulClipping });
  if (state === 'hub') {
    const expectedColumns = viewport === 'desktop' ? 3 : viewport === 'narrow' ? 2 : 1;
    const cards = metrics.routeCards;
    if (cards.length !== 3) report.errors.push({ type: 'hub-route-count', page, value: cards.length });
    if (cards.length && viewport === 'desktop' && new Set(cards.map(card => card.top)).size !== 1) report.errors.push({ type: 'hub-desktop-row', page, cards });
    if (cards.length && viewport === 'mobile' && new Set(cards.map(card => card.left)).size !== 1) report.errors.push({ type: 'hub-mobile-column', page, cards });
    if (expectedColumns === 2 && cards.length >= 2 && cards[0].top !== cards[1].top) report.errors.push({ type: 'hub-narrow-grid', page, cards });
  }
  if (state === 'start') {
    if (!metrics.ticket || metrics.ticket.width > (viewport === 'mobile' ? 390 : 900)) report.errors.push({ type: 'start-ticket-width', page, value: metrics.ticket });
  }
  if (state === 'play' || state === 'play-hint') {
    if (state === 'play' && (!metrics.answerFocus?.focusWithin || metrics.answerFocus.activeElementId !== 'trainAnswerInput')) report.errors.push({ type: 'answer-focus-missing', page, value: metrics.answerFocus });
    if (state === 'play' && metrics.answerFocus?.outlineStyle !== 'none') report.errors.push({ type: 'answer-focus-outline', page, value: metrics.answerFocus });
    if (metrics.totalStops < 8 || metrics.totalStops > 15) report.errors.push({ type: 'station-count', page, value: metrics.totalStops });
    if (viewport === 'mobile' && metrics.visibleStops !== metrics.totalStops) report.errors.push({ type: 'mobile-stations-hidden', page, visible: metrics.visibleStops, total: metrics.totalStops });
    const maxQuestionHeight = viewport === 'mobile' ? 300 : 430;
    if (metrics.question?.height > maxQuestionHeight) report.errors.push({ type: 'question-height', page, value: metrics.question.height, max: maxQuestionHeight });
  }
  if (state === 'result-after-save' && (metrics.saveFocus?.activeElementId === 'saveResultCardButton' || metrics.saveFocus?.focusVisible)) {
    report.errors.push({ type: 'save-result-focus-residue', page, value: metrics.saveFocus });
  }
}

async function run() {
  const { chromium } = await import('playwright');
  const { server, port } = await availableServer();
  const browser = await chromium.launch({ headless: true });
  const report = {
    generatedAt: new Date().toISOString(),
    outputDir: OUTPUT_DIR,
    screenshots: [],
    pages: [],
    errors: []
  };
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push({ viewport: viewport.id, type: 'pageerror', message: error.message }));
      page.on('console', message => {
        if (message.type() === 'error') report.errors.push({ viewport: viewport.id, type: 'console', message: message.text() });
      });

      await page.goto(`http://127.0.0.1:${port}/challenge/train`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.body.dataset.routeHubReady === 'true');
      report.screenshots.push(await capture(page, `${viewport.id}-hub`, { fullPage: viewport.id === 'mobile' }));
      report.pages.push({ viewport: viewport.id, routeId: 'hub', state: 'hub', metrics: await pageMetrics(page) });

      for (const { entry, data: route } of ROUTES) {
        await page.goto(`http://127.0.0.1:${port}/challenge/train/play?route=${entry.routeId}`, { waitUntil: 'networkidle' });
        await page.waitForFunction(routeId => window.YOMERU_TRAIN_CHALLENGE?.route()?.routeId === routeId, entry.routeId);
        report.screenshots.push(await capture(page, `${viewport.id}-${entry.routeId}-start`, { fullPage: viewport.id === 'mobile' }));
        report.pages.push({ viewport: viewport.id, routeId: entry.routeId, state: 'start', metrics: await pageMetrics(page) });

        await page.locator('input[value="kanji-to-kana"]').check();
        await page.locator('#trainStartButton').click();
        await page.waitForFunction(() => document.body.dataset.gameState === 'play');
        await page.waitForFunction(() => document.activeElement?.id === 'trainAnswerInput');
        report.screenshots.push(await capture(page, `${viewport.id}-${entry.routeId}-play`));
        report.pages.push({ viewport: viewport.id, routeId: entry.routeId, state: 'play', metrics: await pageMetrics(page) });

        await page.locator('label[for="trainHintTogglePlay"]').click();
        await page.waitForTimeout(60);
        report.screenshots.push(await capture(page, `${viewport.id}-${entry.routeId}-play-hint`));
        report.pages.push({ viewport: viewport.id, routeId: entry.routeId, state: 'play-hint', metrics: await pageMetrics(page) });

        await page.locator('label[for="trainHintTogglePlay"]').click();
        await completeRoute(page, route);
        await page.waitForTimeout(60);
        report.screenshots.push(await capture(page, `${viewport.id}-${entry.routeId}-result`, { fullPage: viewport.id === 'mobile' }));
        report.pages.push({ viewport: viewport.id, routeId: entry.routeId, state: 'result', metrics: await pageMetrics(page) });

        if (viewport.id === 'mobile') {
          const downloadPromise = page.waitForEvent('download');
          await page.locator('#saveResultCardButton').click();
          await downloadPromise;
          await page.waitForTimeout(40);
          report.screenshots.push(await capture(page, `${viewport.id}-${entry.routeId}-result-after-save`, { fullPage: true }));
          report.pages.push({ viewport: viewport.id, routeId: entry.routeId, state: 'result-after-save', metrics: await pageMetrics(page) });
        }
      }
      await context.close();
    }

    // Save one generated card per route for direct image review.
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    for (const { entry, data: route } of ROUTES) {
      await page.goto(`http://127.0.0.1:${port}/challenge/train/play?route=${entry.routeId}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(routeId => window.YOMERU_TRAIN_CHALLENGE?.route()?.routeId === routeId, entry.routeId);
      await page.locator('input[value="kanji-to-kana"]').check();
      await page.locator('#trainStartButton').click();
      await completeRoute(page, route);
      const downloadPromise = page.waitForEvent('download');
      await page.locator('#saveResultCardButton').click();
      const download = await downloadPromise;
      const filename = `card-${entry.routeId}.png`;
      await download.saveAs(join(OUTPUT_DIR, filename));
      report.screenshots.push(filename);
    }
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  }

  for (const item of report.pages) reviewPage(report, item);
  await writeFile(join(OUTPUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    status: report.errors.length ? 'failed' : 'ok',
    output: OUTPUT_DIR,
    screenshots: report.screenshots.length,
    pages: report.pages.length,
    errors: report.errors.length
  }));
  if (report.errors.length) process.exitCode = 1;
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
