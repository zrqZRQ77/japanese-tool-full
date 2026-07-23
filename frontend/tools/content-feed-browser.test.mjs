#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const START_PORT = Number(process.env.CONTENT_FEED_TEST_PORT || 5208);
const fallbackPayload = JSON.parse(readFileSync(resolve(FRONTEND_DIR, 'data/content-feed-fallback.json'), 'utf8'));
const SYSTEM_CHROME_EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CUSTOM_CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(SYSTEM_CHROME_EXECUTABLE) ? SYSTEM_CHROME_EXECUTABLE : '');

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
  browser = await chromium.launch({headless:true, ...(CUSTOM_CHROMIUM_EXECUTABLE ? {executablePath:CUSTOM_CHROMIUM_EXECUTABLE} : {})});
  const appUrl = `http://127.0.0.1:${port}/index.html`;

  // Remote-success path.
  {
    const context = await browser.newContext({viewport:{width:1440, height:900}});
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
    await page.waitForFunction(() => window.getContentFeedSource?.() === 'remote');
    assert.equal(await page.locator('#contentFeedSection').count(), 0);
    await page.evaluate(() => enterReadingFromHero());
    await page.locator('.app-sidebar .nav-item[data-view="discover"]').click();
    await page.waitForFunction(() => document.body.dataset.view === 'discover');
    await page.waitForSelector('#gradedMaterialGrid .graded-material-card.is-official');
    assert.equal(await page.locator('.app-sidebar .nav-item[data-view="discover"] .nav-label').textContent(), '素材库');
    assert.equal(await page.locator('#gradedSourceFilters select').count(), 1);
    const remoteCard = page.locator('#gradedMaterialGrid .graded-material-card.is-official');
    assert.equal(await remoteCard.count(), 1);
    assert.match(await remoteCard.textContent(), /生活与就业指南/);
    assert.match(await remoteCard.textContent(), /N3/);
    assert.match(await remoteCard.textContent(), /4 分钟/);
    assert.equal(await remoteCard.locator('.jlpt-level-badge').count(), 1);
    assert.equal((await remoteCard.locator('.graded-card-source-action').textContent()).trim(), '参考：出入国在留管理庁');
    assert.equal(await remoteCard.locator('.graded-card-source-action .external-link-icon').count(), 1);
    assert.equal(await remoteCard.locator('.graded-card-source-menu').count(), 0);
    const remoteCardLayout = await remoteCard.evaluate(element => {
      const title = element.querySelector('h3').getBoundingClientRect();
      const metaStyle = getComputedStyle(element.querySelector('.graded-card-meta'));
      return {titleHeight:Math.round(title.height), divider:metaStyle.borderTopWidth};
    });
    assert.ok(remoteCardLayout.titleHeight >= 40);
    assert.equal(remoteCardLayout.divider, '0px');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(180);
    const cueOpacityBefore = Number(await remoteCard.locator('.graded-card-enter-cue').evaluate(element => getComputedStyle(element).opacity));
    await remoteCard.hover();
    await page.waitForTimeout(180);
    const cueOpacityAfter = Number(await remoteCard.locator('.graded-card-enter-cue').evaluate(element => getComputedStyle(element).opacity));
    assert.ok(cueOpacityAfter > cueOpacityBefore, JSON.stringify({cueOpacityBefore, cueOpacityAfter}));
    assert.equal(await page.locator('#readingQueueList').textContent(), '');
    assert.equal(await page.locator('#readingQueueBrowseButton').textContent(), '浏览素材');
    await page.evaluate(() => {
      window.__browseTarget = '';
      Element.prototype.scrollIntoView = function(){ window.__browseTarget = this.id; };
    });
    await page.locator('#readingQueueBrowseButton').click();
    assert.equal(await page.evaluate(() => window.__browseTarget), 'gradedReadingTitle');
    const emptyQueueHeight = await page.locator('#readingQueuePanel').evaluate(element => Math.round(element.getBoundingClientRect().height));
    assert.ok(emptyQueueHeight < 100, `empty reading queue should stay compact, got ${emptyQueueHeight}px`);
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
    await page.route('**/data/content-feed-fallback.json', route=>route.abort());
    await page.addInitScript(() => {
      localStorage.setItem('reading_queue', JSON.stringify([{
        id:42,
        title:'旧阅读链接',
        url:'https://example.com/legacy-article',
        status:'unread',
        addedAt:'2026-07-01T00:00:00.000Z',
        readAt:null
      }, {
        id:43,
        title:'2026 年第二次 JLPT 将于 12 月 6 日举行',
        url:'https://www.jlpt.jp/',
        sourceUrl:'https://www.jlpt.jp/',
        sourceType:'content_engine',
        contentItemId:'content-202607-jlpt-second-test-date',
        category:'exam',
        learningLevel:'N4',
        status:'read',
        addedAt:'2026-07-02T00:00:00.000Z',
        readAt:'2026-07-02T00:00:00.000Z'
      }]));
      localStorage.setItem('yomeru_content_feed_cache_v2', JSON.stringify({
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
    await page.waitForFunction(() => window.getContentFeedSource?.() === 'fallback');
    assert.equal(await page.locator('#contentFeedSection').count(), 0);
    await page.evaluate(() => { enterReadingFromHero(); openMenu(); });
    await page.locator('#menuPanel .nav-item[data-view="discover"]').click();
    await page.waitForFunction(() => document.body.dataset.view === 'discover');
    await page.waitForSelector('#gradedMaterialGrid .graded-material-card.is-official');
    assert.equal(await page.locator('#menuPanel .nav-item[data-view="discover"]').getAttribute('hidden'), null);
    assert.equal(await page.locator('#gradedMaterialGrid .graded-material-card').count(), 9);
    assert.equal(await page.locator('#gradedMaterialGrid .graded-material-card.is-official').count(), 3);
    assert.equal((await page.locator('#gradedMaterialTotal').textContent())?.trim(), '9');
    assert.match(await page.locator('#gradedMaterialSummary').textContent(), /共 9 篇素材/);
    assert.equal(await page.locator('#gradedClearFiltersButton').isHidden(), true);
    assert.equal(await page.locator('#readingQueueInlineForm').isHidden(), true);
    assert.equal(await page.locator('#gradedQuickTags').count(), 0);
    assert.equal(await page.locator('.discover-panel-desc').count(), 0);
    assert.doesNotMatch(await page.locator('body').textContent(), /用于核对考试|用于寻找新闻|还没有保存的文章/);
    await page.locator('#readingQueueAddButton').click();
    assert.equal(await page.locator('#readingQueueInlineForm').isVisible(), true);
    await page.locator('#readingQueueAddButton').click();
    assert.equal(await page.locator('#readingQueueInlineForm').isHidden(), true);
    const fallbackCards = await page.locator('#gradedMaterialGrid .graded-material-card.is-official').allTextContents();
    assert.ok(fallbackCards.some(text => text.includes('EJU')));
    assert.ok(fallbackCards.some(text => text.includes('JLPT')));
    assert.ok(fallbackCards.some(text => text.includes('生活与就业指南')));
    assert.equal(await page.locator('#gradedMaterialGrid').textContent().then(text => text.includes('过期远程缓存')), false);
    assert.match(await page.locator('#gradedMaterialGrid .graded-material-card.is-official').first().textContent(), /EJU/);
    const jlptCard = page.locator('#gradedMaterialGrid .graded-material-card.is-official').filter({hasText:'JLPT'});
    assert.match(await jlptCard.locator('.graded-material-subtitle').textContent(), /12 月 6 日/);
    assert.equal(await jlptCard.locator('.graded-card-top > span').count(), 2);
    assert.equal(await jlptCard.locator('.jlpt-level-badge').count(), 1);
    const jlptTopText = (await jlptCard.locator('.graded-card-top').textContent()).replace(/\s+/g, ' ').trim();
    assert.equal(jlptTopText, 'N4 日语考试 · 3 分钟');
    assert.doesNotMatch(await jlptCard.textContent(), /官方|12\/6|12\/5|日本国内报名|海外报名/);
    assert.ok((await jlptCard.locator('.graded-material-subtitle').evaluate(element => parseFloat(getComputedStyle(element).marginTop))) >= 10);
    const jlptSource = jlptCard.locator('.graded-card-source-action');
    assert.equal((await jlptSource.textContent()).trim(), '参考：日本語能力試験');
    assert.equal(await jlptSource.getAttribute('href').then(value => new URL(value).pathname), '/topics/list2026.html');
    assert.equal(await jlptSource.locator('.external-link-icon').count(), 1);
    assert.equal(await jlptCard.locator('.graded-card-source-menu, .graded-card-source-popover').count(), 0);
    const guideCard = page.locator('#gradedMaterialGrid .graded-material-card.is-official').filter({hasText:'生活与就业指南'});
    assert.doesNotMatch(await guideCard.locator('.graded-card-meta').textContent(), /2\/26|2\/25|官方/);
    assert.equal((await guideCard.locator('.graded-card-source-action').textContent()).trim(), '参考：出入国在留管理庁');
    assert.equal(await guideCard.locator('.graded-card-source-action .external-link-icon').count(), 1);
    const internalCard = page.locator('#gradedMaterialGrid .graded-material-card.is-internal').first();
    assert.equal(await internalCard.locator('.graded-card-top > span').count(), 2);
    assert.equal((await internalCard.locator('.graded-card-source-label').textContent()).trim(), '原创');
    assert.equal(await internalCard.locator('.external-link-icon').count(), 0);

    await page.locator('#gradedSourceFilters select').selectOption('官方资讯');
    assert.equal(await page.locator('#gradedSourceFilters select').evaluate(element => element.classList.contains('is-filtered')), true);
    assert.equal(await page.locator('#gradedMaterialGrid .graded-material-card').count(), 3);
    assert.match(await page.locator('#gradedMaterialSummary').textContent(), /显示 3 \/ 9 篇/);
    assert.equal(await page.locator('#gradedClearFiltersButton').isVisible(), true);
    await page.locator('#gradedTopicFilters select').selectOption('考试');
    assert.equal(await page.locator('#gradedTopicFilters select').evaluate(element => element.classList.contains('is-filtered')), true);
    assert.equal(await page.locator('#gradedMaterialGrid .graded-material-card').count(), 2);
    assert.match(await page.locator('#gradedMaterialSummary').textContent(), /显示 2 \/ 9 篇/);
    await page.locator('#gradedTopicFilters select').selectOption('全部');
    await page.locator('#gradedSourceFilters select').selectOption('全部');
    assert.equal(await page.locator('#gradedTopicFilters select').evaluate(element => element.classList.contains('is-filtered')), false);
    assert.equal(await page.locator('#gradedSourceFilters select').evaluate(element => element.classList.contains('is-filtered')), false);

    const cardTracks = await page.locator('#gradedMaterialGrid .graded-material-card').evaluateAll(cards => cards.map(card => {
      const cardRect = card.getBoundingClientRect();
      const titleRect = card.querySelector('h3').getBoundingClientRect();
      const subtitleRect = card.querySelector('.graded-material-subtitle').getBoundingClientRect();
      const meta = card.querySelector('.graded-card-meta');
      return {
        height:Math.round(cardRect.height),
        titleHeight:Math.round(titleRect.height),
        subtitleOffset:Math.round(subtitleRect.top - cardRect.top),
        divider:getComputedStyle(meta).borderTopWidth
      };
    }));
    const range = values => Math.max(...values) - Math.min(...values);
    assert.ok(range(cardTracks.map(item => item.height)) <= 1, JSON.stringify(cardTracks));
    assert.ok(range(cardTracks.map(item => item.titleHeight)) <= 1, JSON.stringify(cardTracks));
    assert.ok(range(cardTracks.map(item => item.subtitleOffset)) <= 1, JSON.stringify(cardTracks));
    assert.equal(cardTracks.every(item => item.divider === '0px'), true);
    assert.equal(await page.locator('#gradedMaterialGrid .graded-card-enter-cue').count(), 9);

    const lifeCard = page.locator('#gradedMaterialGrid .graded-material-card.is-official').filter({hasText:'生活与就业指南'});
    await lifeCard.click();
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
    assert.equal(contentItem?.sourceLinks?.[0]?.label, '指南页面');
    assert.ok(Number.isFinite(Number(contentItem?.id)));
    assert.ok(state.activeId === String(contentItem?.id) || (state.activeId === null && contentItem?.status === 'read'));
    assert.ok(legacyItem, 'legacy queue items must survive normalization');
    assert.equal(legacyItem.contentItemId, null);
    assert.match(state.sourceTitle || '', /生活与就业指南/);

    await page.evaluate(() => switchWorkspace('discover'));
    await page.waitForFunction(() => document.getElementById('readingQueueList')?.textContent?.includes('直接学习'));
    assert.match(await page.locator('#readingQueueList').textContent(), /生活 · N3/);
    const migratedJlptQueue = page.locator('#readingQueueList .reading-queue-item').filter({hasText:'JLPT'});
    const migratedJlptLinks = await migratedJlptQueue.locator('a').evaluateAll(nodes => nodes.map(node => ({text:node.textContent.trim(), href:node.href})));
    assert.deepEqual(migratedJlptLinks.map(link => link.text), ['2026年考试日期', '海外报名与实施城市']);
    assert.equal(new URL(migratedJlptLinks[0].href).pathname, '/topics/list2026.html');
    assert.equal(new URL(migratedJlptLinks[1].href).pathname, '/application/overseas_index.html');
    assert.match(await page.locator('#sourceDirectory').textContent(), /官方机构/);
    assert.match(await page.locator('#sourceDirectory').textContent(), /阅读与媒体来源/);
    assert.match(await page.locator('#sourceDirectory').textContent(), /JASSO/);
    assert.match(await page.locator('#sourceDirectory').textContent(), /JLPT/);
    assert.match(await page.locator('#sourceDirectory').textContent(), /出入国在留管理庁/);
    assert.match(await page.locator('#externalSourceSummary').textContent(), /5 个来源/);
    const sourceMetas = await page.locator('#sourceDirectory .source-directory-item p').allTextContents();
    assert.ok(sourceMetas.includes('N4-N2 · 日本留学・EJU'));
    assert.ok(sourceMetas.includes('N5-N1 · 日语考试'));
    assert.ok(sourceMetas.includes('N4-N2 · 在留手续・日本生活'));
    assert.ok(sourceMetas.includes('N5-N3 · 易读新闻・生活'));
    assert.ok(sourceMetas.includes('N5-N3 · 旅行・美食'));
    assert.equal(sourceMetas.some(meta => /留学.*留学|考试.*考试|生活.*生活/.test(meta)), false);
    const groupSurface = await page.locator('#sourceDirectory .source-directory-group').first().evaluate(element => {
      const style = getComputedStyle(element);
      return {border:style.borderTopWidth, background:style.backgroundColor, shadow:style.boxShadow};
    });
    assert.equal(groupSurface.border, '0px');
    assert.equal(groupSurface.background, 'rgba(0, 0, 0, 0)');
    assert.equal(groupSurface.shadow, 'none');
    assert.equal(await page.locator('#sourceDirectory .source-directory-group-head span').count(), 0);
    assert.equal(await page.locator('#sourceDirectory .source-directory-arrow').count(), 5);
    assert.equal(await page.locator('#sourceDirectory .source-directory-arrow .external-link-icon').count(), 5);
    assert.doesNotMatch(await page.locator('#sourceDirectory').textContent(), /↗/);
    const sourceIconTones = await page.evaluate(() => {
      const official = document.querySelector('#sourceDirectory .is-official-source .source-directory-icon');
      const reading = document.querySelector('#sourceDirectory .is-reading-source .source-directory-icon');
      return {
        officialBackground:getComputedStyle(official).backgroundColor,
        officialColor:getComputedStyle(official).color,
        readingBackground:getComputedStyle(reading).backgroundColor,
        readingColor:getComputedStyle(reading).color
      };
    });
    assert.notEqual(sourceIconTones.officialBackground, sourceIconTones.readingBackground);
    assert.notEqual(sourceIconTones.officialColor, sourceIconTones.readingColor);
    const firstSourceGeometry = await page.locator('#sourceDirectory .source-directory-item').first().evaluate(element => {
      const icon = element.querySelector('.source-directory-icon').getBoundingClientRect();
      const copy = element.querySelector('.source-directory-copy').getBoundingClientRect();
      const arrow = element.querySelector('.source-directory-arrow').getBoundingClientRect();
      const card = element.getBoundingClientRect();
      return {
        height:Math.round(card.height),
        iconCenter:Math.round(icon.top + icon.height / 2),
        copyCenter:Math.round(copy.top + copy.height / 2),
        arrowCenter:Math.round(arrow.top + arrow.height / 2)
      };
    });
    assert.ok(firstSourceGeometry.height <= 100);
    assert.ok(Math.abs(firstSourceGeometry.iconCenter - firstSourceGeometry.copyCenter) <= 4, JSON.stringify(firstSourceGeometry));
    assert.ok(Math.abs(firstSourceGeometry.arrowCenter - firstSourceGeometry.copyCenter) <= 4, JSON.stringify(firstSourceGeometry));
    await context.close();
  }

  process.stdout.write('Content feed remote, fallback, queue, and reading bridge browser test passed.\n');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
