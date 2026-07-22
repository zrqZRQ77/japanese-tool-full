#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, readFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const START_PORT = Number(process.env.CONTENT_FEED_TEST_PORT || 5208);
const fallbackPayload = JSON.parse(readFileSync(resolve(FRONTEND_DIR, 'data/content-feed-fallback.json'), 'utf8'));

const MIME_TYPES = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.txt':'text/plain; charset=utf-8',
  '.gz':'application/gzip'
};

function safePathFromUrl(url) {
  const parsed = new URL(url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(parsed.pathname);
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = resolve(FRONTEND_DIR, `.${cleanPath}`);
  return fullPath.startsWith(FRONTEND_DIR) ? fullPath : null;
}

function startServer(port) {
  const server = createServer(async (request, response) => {
    const filePath = safePathFromUrl(request.url || '/');
    if (!filePath) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    try {
      await access(filePath);
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
        'Cache-Control':'no-store'
      });
      if (request.method === 'HEAD') return response.end();
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
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
  for (let port = START_PORT; port < START_PORT + 20; port += 1) {
    try {
      return {server:await startServer(port), port};
    } catch (error) {
      if (error?.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error('No local port available for content feed test.');
}

function publicRemotePayload() {
  const sourceItem = fallbackPayload.items.find(candidate => candidate.slug === 'life-work-guidebook-eighth-edition');
  const item = structuredClone(sourceItem);
  item.learning.recommendedLevel = 'invalid-level';
  item.learning.estimatedMinutes = 'invalid-minutes';
  return {
    schemaVersion:1,
    items:[item],
    pageInfo:{total:1, hasNext:false, nextCursor:null}
  };
}

const { chromium } = await import('playwright');
const { server, port } = await startServerWithFallback();
let browser;

try {
  browser = await chromium.launch({headless:true});
  const appUrl = `http://127.0.0.1:${port}/index.html`;

  // Remote-success path.
  {
    const context = await browser.newContext({viewport:{width:1280, height:800}});
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60000);
    await page.route('https://fonts.googleapis.com/**', route=>route.abort());
    await page.route('https://fonts.gstatic.com/**', route=>route.abort());
    await page.route('**/config.js', route=>route.fulfill({
      status:200,
      contentType:'text/javascript',
      body:`window.NIHONGO_CONFIG = Object.freeze({
        CONTENT_FEED_REMOTE_ENABLED: true,
        CONTENT_FEED_BASE_URL: 'https://japan-university-17425oc6a-zrq-projects1.vercel.app/api/public',
        CONTENT_FEED_FALLBACK_URL: 'data/content-feed-fallback.json'
      });`
    }));
    await page.route('https://japan-university-17425oc6a-zrq-projects1.vercel.app/api/public/content-items?**', route=>route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify(publicRemotePayload())
    }));
    await page.goto(appUrl, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.getElementById('contentFeedSection')?.dataset.feedSource === 'remote');
    await page.evaluate(() => { enterReadingFromHero(); switchWorkspace('discover'); });
    await page.waitForSelector('[data-content-id="content-202602-life-work-guidebook-eighth-edition"]');
    assert.match(await page.locator('#contentFeedStatus').textContent(), /官方内容源/);
    assert.equal(await page.locator('#contentFeedGrid .content-feed-card').count(), 1);
    assert.equal(await page.locator('#contentFeedGrid .material-level').textContent(), 'N3');
    assert.match(await page.locator('#contentFeedGrid .content-feed-meta').textContent(), /4 分钟/);
    const bridgeFailure = await page.evaluate(async () => {
      const original = window.startContentFeedLearning;
      window.startContentFeedLearning = () => false;
      try {
        return await window.startContentFeedItem('content-202602-life-work-guidebook-eighth-edition');
      } finally {
        window.startContentFeedLearning = original;
      }
    });
    assert.equal(bridgeFailure, false);
    await context.close();
  }

  // Remote-failure path: bundled snapshot remains usable and old queue data stays valid.
  {
    const context = await browser.newContext({viewport:{width:390, height:844}});
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60000);
    await page.route('https://fonts.googleapis.com/**', route=>route.abort());
    await page.route('https://fonts.gstatic.com/**', route=>route.abort());
    await page.route('https://japan-university-17425oc6a-zrq-projects1.vercel.app/**', route=>route.abort());
    await page.addInitScript(() => {
      localStorage.setItem('reading_queue', JSON.stringify([{
        id:42,
        title:'旧阅读链接',
        url:'https://example.com/legacy-article',
        status:'unread',
        addedAt:'2026-07-01T00:00:00.000Z',
        readAt:null
      }]));
      localStorage.setItem('yomeru_content_feed_cache_v1', JSON.stringify({
        schemaVersion:1,
        updatedAt:'2026-01-01T00:00:00.000Z',
        items:[{
          schemaVersion:1,
          id:'stale-remote-item',
          slug:'stale-remote-item',
          status:'published',
          titleZh:'过期远程缓存',
          titleJa:'古いキャッシュ',
          learning:{titleJa:'古いキャッシュ', textJa:'古い内容です。', recommendedLevel:'N3', estimatedMinutes:3},
          dates:{expiresAt:null},
          sources:[{url:'https://example.com/stale', isPrimary:true}]
        }]
      }));
    });
    await page.goto(appUrl, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.getElementById('contentFeedSection')?.dataset.feedSource === 'fallback');
    await page.evaluate(() => { enterReadingFromHero(); switchWorkspace('discover'); });
    await page.waitForSelector('[data-content-id="content-202602-life-work-guidebook-eighth-edition"]');
    assert.match(await page.locator('#contentFeedStatus').textContent(), /内置官方内容快照/);
    assert.ok(await page.locator('#contentFeedGrid .content-feed-card').count() >= 2);
    assert.equal(await page.locator('[data-content-id="stale-remote-item"]').count(), 0);

    await page.locator('[data-content-id="content-202602-life-work-guidebook-eighth-edition"] [data-content-action="learn"]').click();
    await page.waitForFunction(() => document.body.dataset.view === 'reading');
    await page.waitForFunction(() => document.getElementById('inputText')?.value.includes('生活・就労ガイドブック'));

    const state = await page.evaluate(() => {
      const queue = JSON.parse(localStorage.getItem('reading_queue') || '[]');
      return {
        queue,
        activeId:localStorage.getItem('reading_queue_active_id'),
        sourceTitle:localStorage.getItem('current_article_source_title')
      };
    });
    const contentItem = state.queue.find(item => item.contentItemId === 'content-202602-life-work-guidebook-eighth-edition');
    const legacyItem = state.queue.find(item => item.id === 42);
    assert.equal(contentItem?.sourceType, 'content_engine');
    assert.equal(contentItem?.learningLevel, 'N3');
    assert.equal(contentItem?.category, 'life');
    assert.match(contentItem?.sourceUrl || '', /^https:\/\//);
    assert.ok(Number.isFinite(Number(contentItem?.id)));
    assert.ok(state.activeId === String(contentItem?.id) || (state.activeId === null && contentItem?.status === 'read'));
    assert.ok(legacyItem, 'legacy queue items must survive normalization');
    assert.equal(legacyItem.contentItemId, null);
    assert.match(state.sourceTitle || '', /生活与就业指南/);

    await page.evaluate(() => switchWorkspace('discover'));
    await page.waitForFunction(() => document.getElementById('readingQueueList')?.textContent?.includes('直接学习'));
    assert.match(await page.locator('#readingQueueList').textContent(), /生活 · N3/);
    await context.close();
  }

  process.stdout.write('Content feed remote, fallback, queue, and reading bridge browser test passed.\n');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
