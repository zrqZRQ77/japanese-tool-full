#!/usr/bin/env node

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = resolve(FRONTEND_DIR, 'audit-screenshots/train-challenge-latest');
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
  const normalized = pathname === '/' || pathname === '/challenge/train' || pathname === '/challenge/train/'
    ? '/challenge/train/index.html'
    : pathname;
  const filePath = resolve(FRONTEND_DIR, `.${normalized}`);
  return filePath.startsWith(FRONTEND_DIR) ? filePath : null;
}

function startServer(port) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    if (pathname === '/favicon.ico') {
      response.writeHead(204);
      response.end();
      return;
    }
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
  for (let port = 5260; port < 5290; port += 1) {
    try {
      return { server: await startServer(port), port };
    } catch (error) {
      if (error?.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error('No local port available for train visual review.');
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        left: Math.round(box.left),
        top: Math.round(box.top),
        right: Math.round(box.right),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height)
      };
    };
    return {
      state: document.body.dataset.gameState,
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1
      },
      shell: rect('.shell'),
      ticket: rect('.ticket'),
      playView: rect('.play-view'),
      question: rect('.question'),
      questionMain: rect('.question-main'),
      questionCore: rect('.question-core'),
      answer: rect('.answer'),
      answerStyle: (() => {
        const element = document.querySelector('.answer');
        if (!element) return null;
        const style = getComputedStyle(element);
        return { width: style.width, maxWidth: style.maxWidth, minWidth: style.minWidth, alignSelf: style.alignSelf, flex: style.flex };
      })(),
      tools: rect('.question-tools'),
      resultCard: rect('.result-card'),
      resultActions: rect('.result-actions')
    };
  });
}

async function capture(page, viewportId, state, options = {}) {
  const filename = `${viewportId}-${state}${options.fullPage ? '-full' : ''}.png`;
  const filePath = join(OUTPUT_DIR, filename);
  await page.screenshot({
    path: filePath,
    fullPage: Boolean(options.fullPage),
    animations: 'disabled'
  });
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

async function run() {
  const { chromium } = await import('playwright');
  const route = JSON.parse(await (await import('node:fs/promises')).readFile(resolve(FRONTEND_DIR, 'challenge/train/routes/yamanote-short.json'), 'utf8'));
  const { server, port } = await availableServer();
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {})
  });
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
      await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE?.route()?.stations?.length === 13);
      report.screenshots.push(await capture(page, viewport.id, 'start'));
      report.pages.push({ viewport: viewport.id, state: 'start', metrics: await pageMetrics(page) });

      await page.locator('label[for="trainHintToggleStart"]').click();
      await page.locator('#trainStartButton').click();
      await page.waitForFunction(() => document.body.dataset.gameState === 'play');
      await page.waitForTimeout(120);
      report.screenshots.push(await capture(page, viewport.id, 'play'));
      report.pages.push({ viewport: viewport.id, state: 'play', metrics: await pageMetrics(page) });

      await completeRoute(page, route);
      await page.waitForTimeout(80);
      report.screenshots.push(await capture(page, viewport.id, 'result'));
      if (viewport.id === 'mobile') report.screenshots.push(await capture(page, viewport.id, 'result', { fullPage: true }));
      report.pages.push({ viewport: viewport.id, state: 'result', metrics: await pageMetrics(page) });
      await context.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  }

  const overflowPages = report.pages.filter(item => item.metrics.document.overflowX);
  if (overflowPages.length) {
    report.errors.push({ type: 'horizontal-overflow', pages: overflowPages.map(item => `${item.viewport}:${item.state}`) });
  }
  await writeFile(join(OUTPUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    status: report.errors.length ? 'failed' : 'ok',
    output: OUTPUT_DIR,
    screenshots: report.screenshots.length,
    errors: report.errors.length
  }));
  if (report.errors.length) process.exitCode = 1;
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
