#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');
const TRAIN_DIR = resolve(FRONTEND_DIR, 'challenge/train');
const route = JSON.parse(readFileSync(resolve(TRAIN_DIR, 'routes/yamanote-short.json'), 'utf8'));
const html = readFileSync(resolve(TRAIN_DIR, 'index.html'), 'utf8');
const css = readFileSync(resolve(TRAIN_DIR, 'train-challenge.css'), 'utf8');
const js = readFileSync(resolve(TRAIN_DIR, 'train-challenge.js'), 'utf8');
const readme = readFileSync(resolve(TRAIN_DIR, 'README.md'), 'utf8');
const expected = ['新宿','新大久保','高田馬場','目白','池袋','大塚','巣鴨','駒込','田端','西日暮里','日暮里','鶯谷','上野'];

assert.equal(route.schemaVersion, 1);
assert.equal(route.stations.length, 13);
assert.deepEqual(route.stations.map(item => item.display), expected);
assert.equal(new Set(route.stations.map(item => item.id)).size, 13);
route.stations.forEach((station, index) => {
  assert.equal(station.order, index + 1);
  assert.match(station.reading, /^[ぁ-ゖー]+$/);
  assert.ok(station.acceptedKana.includes(station.reading));
  assert.ok(station.acceptedKanji.includes(station.display));
});
assert.ok(route.stations.find(item => item.display === '高田馬場').acceptedKanji.includes('高田马场'));
assert.ok(route.stations.find(item => item.display === '巣鴨').acceptedKanji.includes('巢鸭'));
assert.ok(route.stations.find(item => item.display === '駒込').acceptedKanji.includes('驹込'));
assert.ok(route.stations.find(item => item.display === '鶯谷').acceptedKanji.includes('莺谷'));
assert.equal((html.match(/data-challenge-view=/g) || []).length, 3);
assert.match(html, /id="trainStartButton"/);
assert.match(html, /class="start-controls"/);
assert.match(html, /<h1 id="startTitle">输入站名，开到终点。<\/h1>/);
assert.doesNotMatch(html, /class="start-meta"/);
assert.doesNotMatch(html, /看汉字输入假名，或看假名输入汉字/);
assert.doesNotMatch(html, /原创简化示意 · 按实际站序/);
assert.doesNotMatch(html, /class="board"/);
assert.match(html, /class="question-main"/);
assert.match(html, /class="question-tools"/);
assert.match(html, /id="resultErrors"/);
assert.doesNotMatch(html, /id="resultCpm"/);
assert.match(html, /class="result-route"><span>新宿<\/span><i><\/i><span>上野<\/span><img/);
assert.match(html, /id="saveResultCardButton"/);
assert.match(html, /id="shareResultButton"/);
assert.match(html, /id="startRouteMap"/);
assert.match(html, /id="trainHintToggleStart"/);
assert.match(html, /id="trainHintTogglePlay"/);
assert.match(html, /id="stationAnswerHint"/);
assert.match(html, /id="trainAnswerForm"/);
assert.match(html, /id="trainAnswerSubmitButton"/);
assert.match(html, /enterkeyhint="done"/);
assert.match(html, /id="resultHintUsage"/);
assert.match(html, /站序参考 JR 东日本 · 不是铁路运营机构官方产品/);
assert.doesNotMatch(html, /站名与顺序为事实数据/);
assert.doesNotMatch(html, /核验来源：JR东日本线路图/);
assert.match(html, /href="\/challenge\/train\/train-challenge\.css"/);
assert.match(html, /src="\/challenge\/train\/train-challenge\.js"/);
assert.match(html, /src="\/challenge\/train\/assets\/train\.svg"/);
assert.match(js, /yomeru_train_typing_v1/);
assert.match(js, /const ROUTE_URL = '\/challenge\/train\/routes\/yamanote-short\.json'/);
assert.match(js, /const PUBLIC_CHALLENGE_URL = 'https:\/\/yomeru\.japanese-hub\.com\/challenge\/train'/);
assert.match(js, /window\.location\.hostname === 'yomeru\.japanese-hub\.com'/);
assert.match(js, /new URL\('\/challenge\/train', window\.location\.origin\)/);
assert.match(js, /drawTrainIcon\(context, 930, 250, 0\.72\)/);
assert.match(js, /compositionstart/);
assert.match(js, /event\.isComposing/);
assert.match(js, /submitButton\.addEventListener\('pointerdown'/);
assert.doesNotMatch(js, /input\.disabled = true/);
assert.match(js, /recentResults.*slice\(0, 5\)/s);
assert.match(js, /lastShowHints/);
assert.match(js, /resultRecordKey/);
assert.match(js, /preventScroll/);
assert.match(js, /route-loop-ghost/);
assert.match(js, /stationProgressLabel/);
assert.match(js, /lastShowHints = false/);
assert.match(js, /elapsedMs \/ routeData\.stations\.length/);
assert.match(js, /Number\.NEGATIVE_INFINITY/);
assert.match(js, /日文标准站名写作/);
assert.match(js, /我完成了山手线站名练习/);
assert.match(js, /result-hint-usage.*is-assisted/s);
assert.doesNotMatch(js, /<title id="routeLoopTitle">/);
assert.match(readme, /最后一站只能触发一次结算/);
assert.match(css, /route-loop-line/);
assert.match(css, /answer\.is-error:focus-within/);
assert.match(css, /data-prompt-size="long"/);
assert.match(css, /result-actions\{align-self:start/);
assert.match(css, /metrics\{position:static/);
assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css, /rail-stop\.is-near/);
assert.match(css, /answer button/);
assert.match(css, /start-controls/);
assert.match(css, /start-view h1/);
assert.match(css, /question-tools/);
assert.match(css, /result-hint-usage\.is-assisted/);
assert.match(css, /grid-template-columns:repeat\(13,minmax\(0,1fr\)\)/);
assert.match(css, /body\[data-game-state="play"\] \.page-footer\{display:none\}/);
assert.match(css, /white-space:nowrap/);
assert.match(css, /env\(safe-area-inset-top\)/);
assert.match(css, /prefers-reduced-motion/);

const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
function pathFor(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname);
  const normalizedPath = pathname === '/' || pathname === '/challenge/train' || pathname === '/challenge/train/'
    ? '/challenge/train/index.html'
    : pathname;
  const filePath = resolve(FRONTEND_DIR, `.${normalizedPath}`);
  return filePath.startsWith(FRONTEND_DIR) ? filePath : null;
}
function startServer(port) {
  const server = createServer(async (request, response) => {
    const filePath = pathFor(request.url || '/');
    if (!filePath) return response.writeHead(403).end('Forbidden');
    try {
      await access(filePath);
      response.writeHead(200, {'Content-Type':mime[extname(filePath)] || 'application/octet-stream','Cache-Control':'no-store'});
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolveServer, rejectServer) => {
    server.once('error', rejectServer);
    server.listen(port, '127.0.0.1', () => { server.off('error', rejectServer); resolveServer(server); });
  });
}
async function availableServer() {
  for (let port = 5228; port < 5248; port += 1) {
    try { return {server:await startServer(port), port}; } catch (error) { if (error?.code !== 'EADDRINUSE') throw error; }
  }
  throw new Error('No local port available.');
}

async function hasOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

async function submit(page, value) {
  await page.locator('#trainAnswerInput').fill(value);
  await page.locator('#trainAnswerSubmitButton').click();
}

const { chromium } = await import('playwright');
const { server, port } = await availableServer();
let browser;
try {
  browser = await chromium.launch({headless:true});
  const appUrl = `http://127.0.0.1:${port}/challenge/train`;
  const expectedLocalShareUrl = appUrl;

  // Full kana-mode completion on the narrowest supported viewport.
  {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript(() => {
      localStorage.setItem('yomeru_train_typing_v1', '{damaged-json');
      localStorage.setItem('reading_vocab_list', 'vocab-sentinel');
      localStorage.setItem('reading_history', 'history-sentinel');
    });
    const page = await context.newPage();
    await page.goto(appUrl, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE?.route()?.stations?.length === 13);
    const loadedAssets = await page.evaluate(() => ({
      stylesheet: [...document.styleSheets].some(sheet => sheet.href?.endsWith('/challenge/train/train-challenge.css')),
      script: [...document.scripts].some(script => script.src.endsWith('/challenge/train/train-challenge.js')),
      ticketRadius: getComputedStyle(document.querySelector('.ticket')).borderRadius
    }));
    assert.equal(loadedAssets.stylesheet, true, 'challenge stylesheet did not load from the clean URL');
    assert.equal(loadedAssets.script, true, 'challenge script did not load from the clean URL');
    assert.notEqual(loadedAssets.ticketRadius, '0px', 'challenge styles were not applied');
    assert.equal(await page.locator('#startRouteMap svg').count(), 1);
    assert.equal(await page.locator('#startRouteMap .route-loop-station').count(), 13);
    assert.equal(await page.locator('#startRouteMap .route-loop-line').count(), 1);
    assert.equal(await page.locator('#startRouteMap .route-loop-ghost').count(), 1);
    assert.equal(await page.locator('#startRouteMap title').count(), 0, 'native SVG tooltip title is still present');
    assert.ok(await page.locator('#startRouteMap tspan').count() > 13, 'long station names were not split across lines');
    const endpointPositions = await page.locator('#startRouteMap .route-loop-station.is-endpoint circle').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('cx'))));
    assert.deepEqual(endpointPositions, [104, 796]);
    const labelOffsets = await page.locator('#startRouteMap .route-loop-station').evaluateAll(nodes => nodes.map(node => {
      const circle = node.querySelector('circle');
      const text = node.querySelector('text');
      return Math.round(Number(text.getAttribute('y')) - Number(circle.getAttribute('cy')));
    }));
    assert.deepEqual([...new Set(labelOffsets)], [32], `route labels have inconsistent offsets: ${labelOffsets.join(',')}`);
    assert.equal(await page.locator('#trainHintToggleStart').isChecked(), false);
    assert.equal(await page.locator('#trainStartButton').isEnabled(), true);
    assert.equal(await page.locator('#startStatus').isHidden(), true);
    assert.equal(await hasOverflow(page), false, 'mobile-390 start view overflows');
    const startViewport = await page.evaluate(() => ({
      buttonBottom: Math.round(document.getElementById('trainStartButton').getBoundingClientRect().bottom),
      viewportHeight: innerHeight,
      ticketHeight: Math.round(document.querySelector('.ticket').getBoundingClientRect().height),
      routeHeight: Math.round(document.querySelector('.route-loop').getBoundingClientRect().height)
    }));
    assert.ok(startViewport.buttonBottom <= startViewport.viewportHeight, `departure button is below first viewport: ${JSON.stringify(startViewport)}`);
    assert.equal((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).elapsedMs, 0);
    await page.waitForTimeout(150);
    assert.equal((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).elapsedMs, 0, 'timer started before departure');

    await page.locator('#trainStartButton').click();
    await page.waitForFunction(() => document.body.dataset.gameState === 'play');
    assert.equal(await page.evaluate(() => document.activeElement?.id === 'trainAnswerInput'), true);
    const initialFocusState = await page.evaluate(() => ({
      scrollY: window.scrollY,
      outlineColor: getComputedStyle(document.getElementById('trainAnswerForm')).outlineColor,
      outlineWidth: Number.parseFloat(getComputedStyle(document.getElementById('trainAnswerForm')).outlineWidth),
      metricsPosition: getComputedStyle(document.querySelector('.metrics')).position,
      metricsHeight: Math.round(document.querySelector('.metrics').getBoundingClientRect().height),
      railHeight: Math.round(document.getElementById('railMap').getBoundingClientRect().height),
      nearbyStops: document.querySelectorAll('.rail-stop.is-near').length,
      visibleStops: [...document.querySelectorAll('.rail-stop')].filter(node => getComputedStyle(node).display !== 'none').length,
      promptSize: document.getElementById('questionPrompt').dataset.promptSize,
      promptFontSize: Number.parseFloat(getComputedStyle(document.getElementById('questionPrompt')).fontSize),
      answerBottom: Math.round(document.getElementById('trainAnswerForm').getBoundingClientRect().bottom),
      toolsBottom: Math.round(document.querySelector('.question-tools').getBoundingClientRect().bottom),
      viewportHeight: innerHeight
    }));
    assert.ok(initialFocusState.scrollY <= 1, `departure focus scrolled the page to ${initialFocusState.scrollY}`);
    assert.notEqual(initialFocusState.outlineColor, 'rgb(228, 90, 70)', 'normal focus still looks like an error');
    assert.ok(initialFocusState.outlineWidth <= 2, JSON.stringify(initialFocusState));
    assert.equal(initialFocusState.metricsPosition, 'sticky');
    assert.ok(initialFocusState.metricsHeight <= 60, JSON.stringify(initialFocusState));
    assert.ok(initialFocusState.railHeight <= 60, JSON.stringify(initialFocusState));
    assert.ok(initialFocusState.nearbyStops >= 3 && initialFocusState.nearbyStops <= 5, JSON.stringify(initialFocusState));
    assert.equal(initialFocusState.visibleStops, 13, JSON.stringify(initialFocusState));
    assert.equal(initialFocusState.promptSize, 'short');
    assert.ok(initialFocusState.promptFontSize <= 46, JSON.stringify(initialFocusState));
    assert.ok(initialFocusState.answerBottom <= initialFocusState.viewportHeight, JSON.stringify(initialFocusState));
    assert.ok(initialFocusState.toolsBottom <= initialFocusState.viewportHeight, JSON.stringify(initialFocusState));
    assert.equal(await page.locator('#trainAnswerSubmitButton').isDisabled(), true);
    assert.equal(await page.locator('#stationAnswerHint').isVisible(), false);
    await page.waitForTimeout(180);
    assert.ok((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).elapsedMs >= 100);

    // IME composition Enter is ignored.
    await page.locator('#trainAnswerInput').fill(route.stations[0].reading);
    await page.locator('#trainAnswerInput').dispatchEvent('compositionstart');
    await page.evaluate(() => {
      document.getElementById('trainAnswerInput').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, isComposing:true}));
    });
    assert.equal((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).index, 0);
    assert.equal((await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot())).correctSubmissions, 0);
    await page.locator('#trainAnswerInput').dispatchEvent('compositionend');
    assert.equal(await page.locator('#trainAnswerSubmitButton').isEnabled(), true);

    // Wrong answers remain editable and do not advance.
    await page.locator('#trainAnswerInput').fill('まちがい');
    await page.keyboard.press('Enter');
    let state = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
    assert.equal(state.index, 0);
    assert.equal(state.wrongSubmissions, 1);
    assert.equal(await page.locator('#trainAnswerInput').inputValue(), 'まちがい');
    await page.waitForTimeout(140);

    // Two rapid Enter events on a correct answer advance only once.
    await page.locator('#trainAnswerInput').fill(route.stations[0].reading);
    await page.locator('#trainAnswerSubmitButton').click();
    await page.evaluate(() => document.getElementById('trainAnswerForm').requestSubmit());
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE.snapshot().index === 1);
    state = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
    assert.equal(state.correctSubmissions, 1);
    assert.equal(state.wrongSubmissions, 1);
    assert.equal(await page.locator('#trainAnswerInput').isDisabled(), false);
    assert.equal(await page.evaluate(() => document.activeElement?.id === 'trainAnswerInput'), true);
    const longPromptState = await page.evaluate(() => ({
      text: document.getElementById('questionPrompt').textContent,
      size: document.getElementById('questionPrompt').dataset.promptSize,
      fontSize: Number.parseFloat(getComputedStyle(document.getElementById('questionPrompt')).fontSize)
    }));
    assert.equal(longPromptState.text, '新大久保');
    assert.equal(longPromptState.size, 'long');
    assert.ok(longPromptState.fontSize < initialFocusState.promptFontSize, JSON.stringify({ initialFocusState, longPromptState }));

    for (let index = 1; index < route.stations.length; index += 1) {
      await submit(page, route.stations[index].reading);
      if (index === route.stations.length - 1) {
        await page.waitForFunction(() => document.body.dataset.gameState === 'result');
      } else {
        await page.waitForFunction(expectedIndex => window.YOMERU_TRAIN_CHALLENGE.snapshot().index === expectedIndex, index + 1);
      }
    }

    state = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
    assert.equal(state.phase, 'result');
    assert.equal(state.finished, true);
    assert.equal(state.correctSubmissions, 13);
    assert.equal(state.wrongSubmissions, 1);
    assert.equal(state.stationTimes.length, 13);
    assert.equal(state.bestStreak, 13);
    assert.equal(state.hintCount, 0);
    assert.equal(state.result.hintCount, 0);
    assert.equal(state.result.assisted, false);
    assert.ok(state.result.elapsedMs > 0);
    assert.equal(Math.round(state.result.accuracy * 100), 93);
    assert.ok(Math.abs(state.result.averageStationMs - Math.round(state.result.elapsedMs / 13)) <= 1);
    assert.equal(await page.locator('#resultErrors').textContent(), '1');
    assert.equal(await page.locator('#resultHintUsage').textContent(), '纯挑战 · 未使用提示');
    assert.match(await page.locator('#resultBest').textContent(), /^纯挑战最佳纪录：/);
    const resultLayout = await page.evaluate(() => ({
      actionHeights: [...document.querySelectorAll('.result-actions > button')].map(button => Math.round(button.getBoundingClientRect().height)),
      hintTop: document.getElementById('resultHintUsage').getBoundingClientRect().top,
      timeTop: document.querySelector('.finish-time').getBoundingClientRect().top
    }));
    assert.ok(resultLayout.actionHeights.every(height => height <= 72), JSON.stringify(resultLayout));
    assert.ok(resultLayout.hintTop < resultLayout.timeTop, JSON.stringify(resultLayout));
    assert.equal(await hasOverflow(page), false, 'mobile-390 result view overflows');

    const stored = await page.evaluate(() => ({
      train: JSON.parse(localStorage.getItem('yomeru_train_typing_v1')),
      vocab: localStorage.getItem('reading_vocab_list'),
      history: localStorage.getItem('reading_history')
    }));
    assert.equal(stored.train.schemaVersion, 1);
    assert.equal(stored.train.totalChallenges, 1);
    assert.equal(stored.train.recentResults.length, 1);
    assert.equal(stored.train.lastShowHints, false);
    assert.ok(stored.train.bestByMode['kanji-to-kana']);
    assert.equal(stored.train.bestByMode['kanji-to-kana:practice'], undefined);
    assert.equal(stored.vocab, 'vocab-sentinel');
    assert.equal(stored.history, 'history-sentinel');

    const cardInfo = await page.evaluate(async () => {
      const blob = await window.YOMERU_TRAIN_CHALLENGE.createResultCardBlob();
      return { type: blob.type, size: blob.size };
    });
    assert.equal(cardInfo.type, 'image/png');
    assert.ok(cardInfo.size > 10000, `result card PNG is unexpectedly small: ${cardInfo.size}`);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#saveResultCardButton').click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^yomeru-train-kanji-kana-\d{8}\.png$/);
    const downloadedPath = await download.path();
    assert.ok(downloadedPath && statSync(downloadedPath).size > 10000);
    await page.waitForFunction(() => document.getElementById('shareFeedback')?.textContent?.includes('成绩卡已生成'));

    await page.evaluate(() => {
      window.__sharePayload = null;
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: payload => Boolean(payload?.files?.length) });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async payload => {
          window.__sharePayload = { title: payload.title, text: payload.text, url: payload.url, files: payload.files?.length || 0 };
        }
      });
    });
    await page.locator('#shareResultButton').click();
    await page.waitForFunction(() => document.getElementById('shareFeedback')?.textContent?.includes('系统分享'));
    const shared = await page.evaluate(() => window.__sharePayload);
    assert.equal(shared.files, 1);
    assert.match(shared.text, /正确率 93%/);
    assert.equal(shared.url, expectedLocalShareUrl);

    await page.evaluate(() => {
      window.__copiedLink = '';
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async value => { window.__copiedLink = value; } }
      });
    });
    await page.locator('#shareResultButton').click();
    await page.waitForFunction(() => document.getElementById('shareFeedback')?.textContent?.includes('链接已复制'));
    assert.equal(await page.evaluate(() => window.__copiedLink), expectedLocalShareUrl);

    await page.locator('#trainRetryButton').click();
    await page.waitForFunction(() => document.body.dataset.gameState === 'start');
    assert.equal(await page.locator('#trainHintToggleStart').isChecked(), false);
    await context.close();
  }

  // Kanji-mode strict matching and full-width-space normalization.
  {
    const context = await browser.newContext({viewport:{width:430,height:932}});
    const page = await context.newPage();
    await page.goto(appUrl, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE?.route()?.stations?.length === 13);
    await page.locator('input[value="kana-to-kanji"]').check();
    await page.waitForFunction(() => document.getElementById('startRouteMap')?.textContent?.includes('01'));
    const numberedRouteText = await page.locator('#startRouteMap').textContent();
    assert.equal(numberedRouteText.includes('しんじゅく'), false, 'dense kana labels remain on the kana-to-kanji start route');
    assert.equal(numberedRouteText.includes('新宿'), false, 'kanji answers leak on the kana-to-kanji start route');
    await page.locator('label[for="trainHintToggleStart"]').click();
    assert.equal(await page.locator('#trainHintToggleStart').isChecked(), true);
    await page.locator('#trainStartButton').click();
    await page.waitForFunction(() => document.body.dataset.gameState === 'play');
    assert.equal(await page.locator('#currentStationName').textContent(), '第 1 站');
    assert.equal(await page.locator('#nextStationName').textContent(), '第 2 站');
    assert.equal(await page.locator('.rail-stop.current').textContent(), '01');
    assert.equal((await page.locator('#playRouteStops').textContent()).includes('新宿'), false, 'current/future kanji answers leak in the route');
    assert.equal(await page.locator('#questionPrompt').textContent(), 'しんじゅく');
    const kanaPromptStyle = await page.evaluate(() => ({
      size: document.getElementById('questionPrompt').dataset.promptSize,
      fontSize: Number.parseFloat(getComputedStyle(document.getElementById('questionPrompt')).fontSize)
    }));
    assert.equal(kanaPromptStyle.size, 'long');
    assert.ok(kanaPromptStyle.fontSize <= 68, JSON.stringify(kanaPromptStyle));
    assert.equal(await page.locator('#stationAnswerHint').isVisible(), true);
    assert.equal(await page.locator('#stationAnswerHintLabel').textContent(), '站名');
    assert.equal(await page.locator('#stationAnswerHintValue').textContent(), '新宿');
    let practiceState = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
    assert.equal(practiceState.showHints, true);
    assert.equal(practiceState.hintCount, 1);
    await page.locator('label[for="trainHintTogglePlay"]').click();
    assert.equal(await page.locator('#trainHintTogglePlay').isChecked(), false);
    assert.equal(await page.locator('#stationAnswerHint').isVisible(), false);
    practiceState = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
    assert.equal(practiceState.showHints, false);
    assert.equal(practiceState.hintCount, 1);
    await submit(page, '新　宿');
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE.snapshot().index === 1);
    assert.equal(await page.locator('.rail-stop.completed').first().textContent(), '新宿');
    assert.equal(await page.locator('.rail-stop.current').textContent(), '02');
    await submit(page, 'シンオオクボ');
    let state = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
    assert.equal(state.index, 1);
    assert.equal(state.wrongSubmissions, 1, 'katakana was accepted by strict kanji mode');
    await page.waitForTimeout(140);
    await submit(page, '新大久保');
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE.snapshot().index === 2);
    await page.locator('#trainAnswerInput').fill('高田马场');
    await page.locator('#trainAnswerSubmitButton').click();
    assert.match(await page.locator('#trainAnswerFeedback').textContent(), /日文标准站名写作「高田馬場」/);
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE.snapshot().index === 3);
    state = await page.evaluate(() => window.YOMERU_TRAIN_CHALLENGE.snapshot());
    assert.equal(state.wrongSubmissions, 1, 'accepted Chinese glyph variant changed the error count');
    assert.equal(await hasOverflow(page), false, 'mobile-430 play view overflows');
    await context.close();
  }

  // Desktop baseline.
  {
    const context = await browser.newContext({viewport:{width:1280,height:900}});
    const page = await context.newPage();
    await page.goto(appUrl, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.YOMERU_TRAIN_CHALLENGE?.route()?.stations?.length === 13);
    assert.equal(await hasOverflow(page), false, 'desktop start view overflows');
    const startLayout = await page.evaluate(() => ({
      shellWidth: Math.round(document.querySelector('.shell').getBoundingClientRect().width),
      ticketWidth: Math.round(document.querySelector('.ticket').getBoundingClientRect().width),
      titleWhiteSpace: getComputedStyle(document.getElementById('startTitle')).whiteSpace,
      titleFontSize: Number.parseFloat(getComputedStyle(document.getElementById('startTitle')).fontSize),
      routeWidth: Math.round(document.querySelector('.route-loop').getBoundingClientRect().width),
      modesWidth: Math.round(document.querySelector('.modes').getBoundingClientRect().width),
      practiceWidth: Math.round(document.querySelector('.start-practice').getBoundingClientRect().width),
      buttonWidth: Math.round(document.getElementById('trainStartButton').getBoundingClientRect().width),
      buttonBottom: Math.round(document.getElementById('trainStartButton').getBoundingClientRect().bottom),
      viewportHeight: innerHeight,
      boardCount: document.querySelectorAll('.board').length,
      longRailLabels: document.querySelectorAll('.route-loop-station.is-long').length
    }));
    assert.ok(startLayout.shellWidth <= 960, JSON.stringify(startLayout));
    assert.ok(startLayout.ticketWidth <= 880, JSON.stringify(startLayout));
    assert.equal(startLayout.titleWhiteSpace, 'nowrap');
    assert.ok(startLayout.titleFontSize <= 38, JSON.stringify(startLayout));
    assert.ok(startLayout.routeWidth <= 760, JSON.stringify(startLayout));
    assert.equal(startLayout.boardCount, 0);
    assert.ok(startLayout.modesWidth <= 460, JSON.stringify(startLayout));
    assert.ok(startLayout.practiceWidth <= 190, JSON.stringify(startLayout));
    assert.ok(startLayout.buttonWidth <= 140, JSON.stringify(startLayout));
    assert.ok(startLayout.buttonBottom <= startLayout.viewportHeight, JSON.stringify(startLayout));
    assert.ok(startLayout.longRailLabels >= 3, JSON.stringify(startLayout));
    await page.locator('#trainStartButton').click();
    await page.waitForFunction(() => document.body.dataset.gameState === 'play');
    const desktopPlayLayout = await page.evaluate(() => {
      const metrics = document.querySelector('.metrics').getBoundingClientRect();
      const rail = document.getElementById('railMap').getBoundingClientRect();
      const question = document.querySelector('.question').getBoundingClientRect();
      const main = document.querySelector('.question-main').getBoundingClientRect();
      const tools = document.querySelector('.question-tools').getBoundingClientRect();
      const firstStop = document.querySelector('.rail-stop:first-child').getBoundingClientRect();
      const lastStop = document.querySelector('.rail-stop:last-child').getBoundingClientRect();
      const marker = document.getElementById('trainMarker').getBoundingClientRect();
      return {
        playWidth: Math.round(document.querySelector('.play-view').getBoundingClientRect().width),
        metricsPosition: getComputedStyle(document.querySelector('.metrics')).position,
        metricsHeight: Math.round(metrics.height),
        metricsBottom: metrics.bottom,
        questionTop: document.getElementById('questionPrompt').getBoundingClientRect().top,
        questionHeight: Math.round(question.height),
        questionBottom: Math.round(question.bottom),
        railWidth: Math.round(rail.width),
        railTop: Math.round(rail.top),
        railBottom: Math.round(rail.bottom),
        railLeft: Math.round(rail.left),
        railRight: Math.round(rail.right),
        firstStopTop: Math.round(firstStop.top),
        lastStopBottom: Math.round(lastStop.bottom),
        markerLeft: Math.round(marker.left),
        markerRight: Math.round(marker.right),
        promptFontSize: Number.parseFloat(getComputedStyle(document.getElementById('questionPrompt')).fontSize),
        toolsLeft: Math.round(tools.left),
        mainRight: Math.round(main.right),
        viewportHeight: innerHeight
      };
    });
    assert.ok(desktopPlayLayout.playWidth <= 900, JSON.stringify(desktopPlayLayout));
    assert.equal(desktopPlayLayout.metricsPosition, 'static');
    assert.ok(desktopPlayLayout.metricsHeight <= 56, JSON.stringify(desktopPlayLayout));
    assert.ok(desktopPlayLayout.metricsBottom < desktopPlayLayout.questionTop, JSON.stringify(desktopPlayLayout));
    assert.ok(desktopPlayLayout.railWidth <= 150, JSON.stringify(desktopPlayLayout));
    assert.ok(desktopPlayLayout.questionHeight <= 300, JSON.stringify(desktopPlayLayout));
    assert.ok(desktopPlayLayout.questionBottom <= desktopPlayLayout.viewportHeight, JSON.stringify(desktopPlayLayout));
    assert.ok(desktopPlayLayout.firstStopTop >= desktopPlayLayout.railTop, JSON.stringify(desktopPlayLayout));
    assert.ok(desktopPlayLayout.lastStopBottom <= desktopPlayLayout.railBottom, JSON.stringify(desktopPlayLayout));
    assert.ok(desktopPlayLayout.markerLeft >= desktopPlayLayout.railLeft + 90, JSON.stringify(desktopPlayLayout));
    assert.ok(desktopPlayLayout.markerRight <= desktopPlayLayout.railRight, JSON.stringify(desktopPlayLayout));
    assert.ok(desktopPlayLayout.promptFontSize <= 60, JSON.stringify(desktopPlayLayout));
    assert.ok(desktopPlayLayout.toolsLeft >= desktopPlayLayout.mainRight, JSON.stringify(desktopPlayLayout));
    assert.equal(await hasOverflow(page), false, 'desktop play view overflows');
    await context.close();
  }

  process.stdout.write('Train challenge A3 game, result-card, sharing, persistence, and responsive tests passed.\n');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
