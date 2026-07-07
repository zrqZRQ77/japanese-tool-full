const dns = require('node:dns').promises;
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const express = require('express');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { YoutubeTranscript } = require('youtube-transcript');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 12000);
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 60000);
const MAX_HTML_BYTES = Number(process.env.MAX_HTML_BYTES || 4 * 1024 * 1024);
const MAX_PDF_BYTES = Number(process.env.MAX_PDF_BYTES || 20 * 1024 * 1024);
const MAX_PDF_PAGES = Number(process.env.MAX_PDF_PAGES || 80);
const MAX_EXTRACTED_TEXT_CHARS = Number(process.env.MAX_EXTRACTED_TEXT_CHARS || 200000);
const MAX_DOCX_BYTES = Number(process.env.MAX_DOCX_BYTES || 10 * 1024 * 1024);
const MAX_TXT_BYTES = Number(process.env.MAX_TXT_BYTES || 2 * 1024 * 1024);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000);
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(value => value.trim().replace(/\/$/, ''))
  .filter(Boolean);
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
let pngBrowserPromise = null;
const execFileAsync = promisify(execFile);

if (TRUST_PROXY) app.set('trust proxy', 1);

const extractUrlRateLimit = createRateLimiter('extract-url', Number(process.env.EXTRACT_URL_LIMIT || 60));
const youtubeRateLimit = createRateLimiter('extract-youtube', Number(process.env.YOUTUBE_LIMIT || 20));
const fileRateLimit = createRateLimiter('extract-file', Number(process.env.FILE_UPLOAD_LIMIT || 20));
const pngRateLimit = createRateLimiter('export-png', Number(process.env.PNG_EXPORT_LIMIT || 30));
const dictionaryRateLimit = createRateLimiter('dictionary', Number(process.env.DICTIONARY_LIMIT || 120));
const extractUrlConcurrency = createConcurrencyGuard('网页提取', Number(process.env.EXTRACT_URL_CONCURRENCY || 4));
const fileConcurrency = createConcurrencyGuard('文件解析', Number(process.env.FILE_CONCURRENCY || 2));
const pngConcurrency = createConcurrencyGuard('PNG 导出', Number(process.env.PNG_CONCURRENCY || 2));

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ ok: false, error: 'ORIGIN_NOT_ALLOWED', message: '该网页来源未被后端允许。' });
  } else if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-File-Name,X-File-Type,X-Pdf-Mode');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use((req, res, next) => {
  req.setTimeout(API_TIMEOUT_MS);
  res.setTimeout(API_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(504).json({ ok: false, error: 'REQUEST_TIMEOUT', message: '处理超时，请缩短内容后重试。' });
    }
  });
  next();
});

app.use(express.json({ limit: '3mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'nihongo-reader-backend', version: '0.3.0' });
});

app.post('/api/extract-url', extractUrlRateLimit, extractUrlConcurrency, trackMeteredUsage('extract-url'), async (req, res) => {
  try {
    const url = await normalizePublicHttpUrl(req.body && req.body.url);
    const resource = await fetchResource(url);
    res.locals.operationType = resource.type;
    if (resource.type === 'pdf') {
      const pdf = await extractPdfText(resource.buffer, resource.url, { mode: 'auto' });
      return res.json({
        ok: true,
        url: resource.url,
        type: 'pdf',
        title: pdf.title,
        byline: '',
        excerpt: '',
        pageCount: pdf.pageCount,
        removedRubyCount: pdf.removedRubyCount,
        footnotes: pdf.footnotes,
        layoutWarnings: pdf.layoutWarnings,
        text: pdf.text
      });
    }

    const { html } = decodeHtmlBuffer(resource.buffer, resource.contentType);
    const dom = new JSDOM(html, { url });
    const knownSource = extractKnownJapaneseSource(url, dom.window.document);
    if (knownSource && knownSource.error) {
      return res.status(422).json(knownSource);
    }
    const article = knownSource || new Readability(dom.window.document).parse();

    if (!article || !article.textContent || !article.textContent.trim()) {
      return res.status(422).json({
        ok: false,
        error: 'READABILITY_EMPTY',
        message: '没有从该页面提取到正文。这个页面可能是 JS 渲染、反爬限制，或正文结构不适合 Readability。'
      });
    }

    res.json({
      ok: true,
      url: resource.url,
      type: 'html',
      title: article.title || '',
      byline: article.byline || '',
      excerpt: article.excerpt || '',
      text: cleanText(article.textContent)
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/extract-youtube', youtubeRateLimit, async (req, res) => {
  try {
    const { url, videoId } = normalizeYoutubeUrl(req.body && req.body.url);
    const lang = req.body && typeof req.body.lang === 'string' ? req.body.lang : undefined;
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined);

    if (!Array.isArray(transcript) || transcript.length === 0) {
      return res.status(422).json({
        ok: false,
        error: 'YOUTUBE_TRANSCRIPT_EMPTY',
        message: '没有提取到字幕。这个视频可能没有可访问字幕。'
      });
    }

    const items = transcript.map(normalizeTranscriptItem);
    res.json({
      ok: true,
      url,
      videoId,
      items,
      text: items.map(item => `[${formatTimestamp(item.start)}] ${item.text}`).join('\n')
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/dictionary', dictionaryRateLimit, async (req, res) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    if (!keyword || keyword.length > 40) throw httpError(400, 'INVALID_KEYWORD', '请输入有效的日语词语。');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'NihongoReader/0.3 (+dictionary lookup)' }
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw httpError(502, 'DICTIONARY_UPSTREAM_FAILED', '词典服务暂时不可用。');
    const payload = await response.json();
    const entries = (Array.isArray(payload.data) ? payload.data : []).slice(0, 3).map(item => ({
      word: item.japanese?.[0]?.word || item.slug || keyword,
      reading: item.japanese?.[0]?.reading || '',
      parts: [...new Set((item.senses || []).flatMap(sense => sense.parts_of_speech || []))].slice(0, 5),
      meanings: (item.senses || []).flatMap(sense => sense.english_definitions || []).slice(0, 8)
    }));
    if (!entries.length) throw httpError(404, 'DICTIONARY_NOT_FOUND', '没有找到对应词条。');
    res.json({ ok: true, keyword, source: 'JMdict via Jisho', entries });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/extract-file', fileRateLimit, fileConcurrency, trackMeteredUsage('extract-file'), express.raw({ type: () => true, limit: MAX_PDF_BYTES }), async (req, res) => {
  try {
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!buffer.length) {
      throw httpError(400, 'FILE_EMPTY', '请选择一个非空文件。');
    }

    const filename = decodeHeaderFilename(req.get('x-file-name'));
    const extension = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
    if (extension === '.pdf') {
      res.locals.operationType = 'pdf';
      if (buffer.length > MAX_PDF_BYTES) throw httpError(413, 'PDF_TOO_LARGE', 'PDF 不能超过 20 MB。');
      if (buffer.subarray(0, 5).toString() !== '%PDF-') throw httpError(415, 'INVALID_PDF', '文件内容不是有效的 PDF。');
      const pdfMode = normalizePdfMode(req.get('x-pdf-mode'));
      const pdf = await extractPdfText(buffer, filename, { mode: pdfMode });
      return res.json({ ok: true, type: 'pdf', title: pdf.title, pageCount: pdf.pageCount, removedRubyCount: pdf.removedRubyCount, layoutMode: pdf.layoutMode, verticalPageCount: pdf.verticalPageCount, footnotes: pdf.footnotes, layoutWarnings: pdf.layoutWarnings, text: pdf.text });
    }

    if (extension === '.docx') {
      res.locals.operationType = 'docx';
      if (buffer.length > MAX_DOCX_BYTES) throw httpError(413, 'DOCX_TOO_LARGE', 'DOCX 不能超过 10 MB。');
      if (buffer.subarray(0, 2).toString() !== 'PK') throw httpError(415, 'INVALID_DOCX', '文件内容不是有效的 DOCX。');
      const text = await extractDocxText(buffer);
      return res.json({ ok: true, type: 'docx', title: filename, text });
    }

    if (extension === '.txt') {
      res.locals.operationType = 'txt';
      if (buffer.length > MAX_TXT_BYTES) throw httpError(413, 'TXT_TOO_LARGE', 'TXT 不能超过 2 MB。');
      const text = decodeTextFile(buffer);
      if (!text.trim()) throw httpError(422, 'TXT_EMPTY', 'TXT 中没有可提取的文字。');
      return res.json({ ok: true, type: 'txt', title: filename, text: cleanText(text) });
    }

    throw httpError(415, 'UNSUPPORTED_FILE_TYPE', '目前只支持 PDF、Word（DOCX）和 TXT 文件。');
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/export-png', pngRateLimit, pngConcurrency, trackMeteredUsage('export-png'), async (req, res) => {
  try {
    const payload = normalizePngExportPayload(req.body);
    res.locals.operationType = payload.layout;
    const image = await renderRubyPng(payload);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="japanese-ruby-${payload.layout}.png"`);
    res.send(image);
  } catch (error) {
    sendError(res, error);
  }
});

app.use((error, req, res, next) => {
  if (error && error.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: 'FILE_TOO_LARGE', message: '上传内容超过允许的大小。' });
  }
  next(error);
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'NOT_FOUND',
    message: '接口不存在。'
  });
});

if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    console.log(`Nihongo reader backend listening on http://${HOST}:${PORT}`);
  });
  server.requestTimeout = API_TIMEOUT_MS;
  server.headersTimeout = Math.min(API_TIMEOUT_MS, 65000);

  const shutdown = async signal => {
    console.log(`${signal} received, shutting down.`);
    server.close(async () => {
      await closePngBrowser();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === 'null') return true;
  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))) return true;
  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function createRateLimiter(name, maxRequests) {
  const buckets = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.min(RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000));
  cleanup.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
      buckets.set(key, bucket);
    }
    res.setHeader('RateLimit-Limit', maxRequests);
    res.setHeader('RateLimit-Remaining', Math.max(0, maxRequests - bucket.count - 1));
    res.setHeader('RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));
    if (bucket.count >= maxRequests) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ ok: false, error: 'RATE_LIMITED', message: '操作过于频繁，请稍后再试。' });
    }
    bucket.count += 1;
    next();
  };
}

function createConcurrencyGuard(label, maxConcurrent) {
  let active = 0;
  return (req, res, next) => {
    if (active >= maxConcurrent) {
      return res.status(429).json({ ok: false, error: 'SERVER_BUSY', message: `${label}任务较多，请稍后重试。` });
    }
    active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
}

function trackMeteredUsage(operation) {
  return (req, res, next) => {
    const startedAt = Date.now();
    res.once('finish', () => {
      console.log(JSON.stringify({
        event: 'metered-operation',
        operation,
        subtype: res.locals.operationType || 'unknown',
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
        requestBytes: Number(req.get('content-length') || 0)
      }));
    });
    next();
  };
}

async function normalizePublicHttpUrl(value) {
  if (!value || typeof value !== 'string') {
    throw httpError(400, 'INVALID_URL', '请传入 url 字段。');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw httpError(400, 'INVALID_URL', 'URL 格式不正确。');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw httpError(400, 'INVALID_URL_PROTOCOL', '只支持 http/https 链接。');
  }

  if (parsed.username || parsed.password) {
    throw httpError(400, 'URL_CREDENTIALS_BLOCKED', '网址中不能包含用户名或密码。');
  }

  if (isLocalHostname(parsed.hostname)) {
    throw httpError(400, 'PRIVATE_URL_BLOCKED', '不能抓取本机或内网地址。');
  }

  await assertPublicDns(parsed.hostname);
  return parsed.toString();
}

function normalizeYoutubeUrl(value) {
  if (!value || typeof value !== 'string') {
    throw httpError(400, 'INVALID_URL', '请传入 url 字段。');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw httpError(400, 'INVALID_URL', 'YouTube 链接格式不正确。');
  }

  const host = parsed.hostname.replace(/^www\./, '');
  const allowed = host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com';
  if (!allowed) {
    throw httpError(400, 'NOT_YOUTUBE_URL', '请传入 YouTube 视频链接。');
  }

  let videoId = '';
  if (host === 'youtu.be') {
    videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
  } else if (parsed.pathname === '/watch') {
    videoId = parsed.searchParams.get('v') || '';
  } else if (parsed.pathname.startsWith('/shorts/')) {
    videoId = parsed.pathname.split('/').filter(Boolean)[1] || '';
  } else if (parsed.pathname.startsWith('/embed/')) {
    videoId = parsed.pathname.split('/').filter(Boolean)[1] || '';
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw httpError(400, 'INVALID_YOUTUBE_VIDEO_ID', '没有从链接中识别到有效的 YouTube 视频 ID。');
  }

  return {
    url: `https://www.youtube.com/watch?v=${videoId}`,
    videoId
  };
}

function decodeHeaderFilename(value) {
  if (!value) return 'document';
  try {
    return decodeURIComponent(String(value)).replace(/[\\/\0]/g, '_').slice(0, 180);
  } catch {
    return String(value).replace(/[\\/\0]/g, '_').slice(0, 180);
  }
}

async function extractDocxText(buffer) {
  let mammoth;
  try {
    mammoth = require('mammoth');
  } catch {
    return extractDocxXmlText(buffer);
  }
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = cleanText(result.value || '');
    if (!text) throw httpError(422, 'DOCX_EMPTY', 'DOCX 中没有可提取的正文。');
    if (text.length > MAX_EXTRACTED_TEXT_CHARS) throw httpError(413, 'DOCX_TEXT_TOO_LONG', 'DOCX 提取后的文字超过 20 万字。');
    return text;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(422, 'DOCX_INVALID', 'DOCX 无法解析，文件可能已损坏或不是标准 DOCX。');
  }
}

async function extractDocxXmlText(buffer) {
  const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nihongo-docx-'));
  const tempFile = path.join(tempDirectory, 'document.docx');
  try {
    await fs.promises.writeFile(tempFile, buffer);
    const { stdout } = await execFileAsync('unzip', ['-p', tempFile, 'word/document.xml'], {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: MAX_EXTRACTED_TEXT_CHARS * 8
    });
    const dom = new JSDOM(stdout, { contentType: 'text/xml' });
    const paragraphs = Array.from(dom.window.document.getElementsByTagNameNS('*', 'p'));
    const text = cleanText(paragraphs.map(paragraph => {
      const textNodes = Array.from(paragraph.getElementsByTagNameNS('*', 't'));
      return textNodes
        .filter(node => !hasXmlAncestor(node, 'rt'))
        .map(node => node.textContent || '')
        .join('');
    }).filter(Boolean).join('\n'));
    if (!text) throw httpError(422, 'DOCX_EMPTY', 'DOCX 中没有可提取的正文。');
    if (text.length > MAX_EXTRACTED_TEXT_CHARS) throw httpError(413, 'DOCX_TEXT_TOO_LONG', 'DOCX 提取后的文字超过 20 万字。');
    return text;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(422, 'DOCX_INVALID', 'DOCX 无法解析，文件可能已损坏或不是标准 DOCX。');
  } finally {
    await fs.promises.rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

function hasXmlAncestor(node, localName) {
  let current = node.parentNode;
  while (current) {
    if (current.localName === localName) return true;
    current = current.parentNode;
  }
  return false;
}

function decodeTextFile(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return new TextDecoder('utf-16le').decode(swapped);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\ufeff/, '');
  } catch {
    return new TextDecoder('shift_jis').decode(buffer);
  }
}

function normalizePngExportPayload(body) {
  const units = body && Array.isArray(body.units) ? body.units : [];
  if (!units.length || units.length > 10000) throw httpError(400, 'INVALID_EXPORT_TEXT', '请先分析文本，且单次导出不能超过 10000 个文本单元。');
  const layout = body.layout === 'portrait' ? 'portrait' : 'landscape';
  const width = layout === 'portrait' ? 900 : 1600;
  const height = layout === 'portrait' ? 1600 : 900;
  const preset = layout === 'portrait'
    ? { baseFont: 22, rubyFont: 10, rubyGap: 0.16, lineHeight: 0.62, maxCells: 21 }
    : { baseFont: 24, rubyFont: 11, rubyGap: 0.16, lineHeight: 0.64, maxCells: 34 };
  const number = (value, fallback, min, max) => Math.min(max, Math.max(min, Number(value) || fallback));
  return {
    layout,
    width,
    height,
    baseFont: number(body.baseFont, preset.baseFont, 12, 44),
    rubyFont: number(body.rubyFont, preset.rubyFont, 6, 24),
    rubyGap: number(body.rubyGap, preset.rubyGap, 0.05, 0.45),
    lineHeight: number(body.lineHeight, preset.lineHeight, 0.45, 1.2),
    maxCells: number(body.maxCells, preset.maxCells, 18, 50),
    units: units.map(unit => ({
      base: String(unit && unit.base || '').slice(0, 100),
      ruby: String(unit && unit.ruby || '').slice(0, 100)
    })).filter(unit => unit.base)
  };
}

async function getPngBrowser() {
  if (pngBrowserPromise) return pngBrowserPromise;
  pngBrowserPromise = (async () => {
    let playwright;
    try {
      playwright = require('playwright');
    } catch {
      throw httpError(503, 'PNG_ENGINE_MISSING', 'PNG 渲染组件尚未安装，请在 backend 目录运行 npm install。');
    }
    try {
      return await playwright.chromium.launch({ headless: true });
    } catch (bundledError) {
      const executablePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
      ];
      for (const executablePath of executablePaths) {
        if (!fs.existsSync(executablePath)) continue;
        try {
          return await playwright.chromium.launch({ headless: true, executablePath });
        } catch {
          // Try the next installed Chromium-based browser.
        }
      }
      console.error('PNG browser failed to launch:', bundledError);
      throw httpError(503, 'PNG_BROWSER_MISSING', '没有找到可用的 Chromium。请运行 npm run install-browser。');
    }
  })().catch(error => {
    pngBrowserPromise = null;
    throw error;
  });
  return pngBrowserPromise;
}

async function closePngBrowser() {
  if (!pngBrowserPromise) return;
  const browserPromise = pngBrowserPromise;
  pngBrowserPromise = null;
  const browser = await browserPromise.catch(() => null);
  if (browser) await browser.close().catch(() => {});
}

async function renderRubyPng(payload) {
  const browser = await getPngBrowser();
  const page = await browser.newPage({ viewport: { width: payload.width, height: payload.height }, deviceScaleFactor: 1 });
  try {
    await page.setContent(buildRubyExportHtml(payload), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.evaluate(() => {
      const surface = document.getElementById('export-surface');
      const content = document.getElementById('export-content');
      if (!surface || !content || content.scrollHeight <= surface.clientHeight) return;
      const scale = Math.max(0.55, surface.clientHeight / content.scrollHeight);
      content.style.width = `${100 / scale}%`;
      content.style.transform = `scale(${scale})`;
      content.style.transformOrigin = 'top left';
    });
    return await page.screenshot({
      type: 'png',
      omitBackground: true,
      clip: { x: 0, y: 0, width: payload.width, height: payload.height }
    });
  } finally {
    await page.close().catch(() => {});
  }
}

function buildRubyExportHtml(payload) {
  const horizontalPadding = payload.layout === 'portrait' ? 70 : 90;
  const verticalPadding = payload.layout === 'portrait' ? 82 : 72;
  const contentWidth = payload.width - horizontalPadding * 2;
  const basePx = (contentWidth / payload.maxCells) * (payload.baseFont / (payload.layout === 'portrait' ? 22 : 24));
  const rubyPx = basePx * (payload.rubyFont / payload.baseFont);
  const lineHeightPx = Math.max(basePx * 1.55, basePx * (1.0 + payload.lineHeight));
  const rubyOffset = Math.round(payload.rubyGap * 12);
  const content = payload.units.map(unit => unit.ruby
    ? `<ruby>${escapeServerHtml(unit.base)}<rt>${escapeServerHtml(unit.ruby)}</rt></ruby>`
    : escapeServerHtml(unit.base)
  ).join('');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:${payload.width}px;height:${payload.height}px;background:transparent;overflow:hidden}
    #export-surface{width:${payload.width}px;height:${payload.height}px;padding:${verticalPadding}px ${horizontalPadding}px;color:#2b2a28;background:transparent;font-family:"Yu Gothic","Hiragino Sans","Noto Sans JP",sans-serif;font-size:${basePx}px;line-height:${lineHeightPx}px;letter-spacing:0;white-space:pre-wrap;word-break:normal;overflow-wrap:break-word;line-break:strict;text-align:left;overflow:hidden}
    #export-content{width:100%}
    ruby{ruby-position:over;ruby-align:center}rt{font-family:inherit;font-size:${rubyPx}px;line-height:1;color:#6b6459;transform:translateY(-${rubyOffset}px)}
  </style></head><body><main id="export-surface"><div id="export-content">${content}</div></main></body></html>`;
}

function escapeServerHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function extractKnownJapaneseSource(url, document) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const sourceMap = [
    {
      id: 'nhk-easy',
      match: host === 'news.web.nhk' && url.includes('/news/easy/'),
      selectors: [
        '[data-testid*="article"]',
        '[class*="newsDetail"]',
        '[class*="news-detail"]',
        '[class*="articleBody"]',
        '[class*="article-body"]',
        'main article',
        'article',
        '#js-article-body',
        '.article-main__body',
        '.content--detail-body',
        '.body-text',
        '[class*="article"] [class*="body"]'
      ]
    },
    {
      id: 'aozora',
      match: host === 'aozora.gr.jp',
      selectors: [
        '.main_text',
        '.bibliographical_information',
        '#kiji',
        'main',
        'article'
      ]
    },
    {
      id: 'matcha',
      match: host === 'matcha-jp.com',
      selectors: [
        'article',
        '.article__body',
        '.p-articleBody',
        '.entry-content',
        '[class*="article"] [class*="body"]'
      ]
    },
    {
      id: 'tsunagaru',
      match: host === 'tsunagarujp.mext.go.jp',
      selectors: [
        'main',
        'article',
        '#content',
        '#contents',
        '.content',
        '.contents',
        '.main',
        '.text',
        '.article'
      ]
    },
    {
      id: 'nippon',
      match: host === 'nippon.com',
      selectors: [
        'article',
        'main',
        '.article-body',
        '.p-articleBody',
        '.entry-content',
        '[class*="article"] [class*="body"]'
      ]
    }
  ];

  const source = sourceMap.find(item => item.match);
  if (!source) return null;

  const title = pickText(document, ['h1', 'meta[property="og:title"]', 'title']);
  let best = { text: '', score: -Infinity };
  for (const selector of source.selectors) {
    document.querySelectorAll(selector).forEach(node => {
      const text = cleanExtractedArticleText(node.textContent || '');
      const score = scoreArticleCandidate(text, source.id);
      if (score > best.score) best = { text, score };
    });
  }

  if (best.score < 50) {
    if (source.id === 'nhk-easy') {
      return {
        ok: false,
        error: 'SOURCE_ADAPTER_EMPTY',
        message: 'NHK Easy 当前返回的是利用说明/确认页面，不是文章正文。这个来源后续需要用浏览器渲染或专门接口适配。'
      };
    }
    return null;
  }

  return {
    title,
    byline: '',
    excerpt: '',
    textContent: best.text,
    source: source.id
  };
}

function pickText(document, selectors) {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (!node) continue;
    const text = selector.startsWith('meta')
      ? node.getAttribute('content')
      : node.textContent;
    if (text && text.trim()) return cleanText(text);
  }
  return '';
}

function cleanExtractedArticleText(text) {
  return cleanText(text)
    .replace(/このページ(?:ぺーじ)?を見る(?:みる)?には[\s\S]*?サービスを利用しない/g, '')
    .replace(/ご利用(?:りよう)?にあたって[\s\S]*?サービスを利用しない/g, '')
    .replace(/チェック(?:ちぇっく)?ボックス(?:ぼっくす)?にチェック(?:ちぇっく)?をお願い(?:おねがい)?します/g, '')
    .replace(/受信(?:じゅしん)?契約(?:けいやく)[\s\S]*?確認(?:かくにん)?してください/g, '')
    .replace(/シェアする[\s\S]*?$/g, '')
    .trim();
}

function scoreArticleCandidate(text, sourceId) {
  if (!text || text.length < 80) return -Infinity;
  const usagePenalty = /ご利用|利用規約|受信契約|チェックボックス|サービスを利用しない|このページ/.test(text) ? 500 : 0;
  const japaneseChars = (text.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) || []).length;
  const paragraphBonus = (text.match(/\n/g) || []).length * 8;
  const sourceBonus = sourceId === 'aozora' && /底本|入力|校正/.test(text) ? -80 : 0;
  return japaneseChars + paragraphBonus + sourceBonus - usagePenalty;
}

async function fetchResource(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let currentUrl = url;
    let response;
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; NihongoReader/0.2)',
          accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8'
        }
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location) throw httpError(502, 'INVALID_REDIRECT', '网页返回了无效的跳转地址。');
      if (redirectCount === 5) throw httpError(508, 'TOO_MANY_REDIRECTS', '网页跳转次数过多。');
      currentUrl = await normalizePublicHttpUrl(new URL(location, currentUrl).toString());
    }

    if (!response) {
      throw httpError(502, 'FETCH_FAILED', '网页抓取失败。');
    }

    if (!response.ok) {
      throw httpError(response.status, 'FETCH_FAILED', `网页抓取失败，HTTP ${response.status}。`);
    }

    const contentType = response.headers.get('content-type') || '';
    const reader = response.body && response.body.getReader ? response.body.getReader() : null;
    if (!reader) {
      const buffer = Buffer.from(await response.arrayBuffer());
      return classifyFetchedResource(buffer, contentType, currentUrl);
    }

    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_PDF_BYTES) {
        throw httpError(413, 'RESOURCE_TOO_LARGE', '文件超过 20 MB，已停止处理。');
      }
      chunks.push(value);
    }
    return classifyFetchedResource(Buffer.concat(chunks), contentType, currentUrl);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw httpError(504, 'FETCH_TIMEOUT', '网页抓取超时。');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function classifyFetchedResource(buffer, contentType, url) {
  const normalizedType = String(contentType || '').toLowerCase();
  const isPdf = normalizedType.includes('application/pdf') || buffer.subarray(0, 5).toString() === '%PDF-';
  if (isPdf) {
    if (buffer.byteLength > MAX_PDF_BYTES) {
      throw httpError(413, 'PDF_TOO_LARGE', 'PDF 超过 20 MB，已停止处理。');
    }
    return { type: 'pdf', buffer, contentType, url };
  }

  const isHtml = !normalizedType || normalizedType.includes('text/html') || normalizedType.includes('application/xhtml+xml');
  if (!isHtml) {
    throw httpError(415, 'UNSUPPORTED_CONTENT_TYPE', `暂不支持该文件类型：${contentType || '未知类型'}`);
  }
  if (buffer.byteLength > MAX_HTML_BYTES) {
    throw httpError(413, 'HTML_TOO_LARGE', '页面 HTML 太大，已停止处理。');
  }
  return { type: 'html', buffer, contentType, url };
}

async function extractPdfText(buffer, url, options = {}) {
  const requestedMode = normalizePdfMode(options.mode);
  let pdfjs;
  try {
    ensurePdfTextGlobals();
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (error) {
    console.error('PDF engine failed to load:', error);
    throw httpError(503, 'PDF_ENGINE_UNAVAILABLE', 'PDF 解析组件加载失败，请重启后端服务后重试。');
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: true
  });
  let document;
  try {
    document = await loadingTask.promise;
  } catch {
    throw httpError(422, 'PDF_INVALID', 'PDF 无法解析，文件可能已损坏、加密或受密码保护。');
  }

  if (document.numPages > MAX_PDF_PAGES) {
    await document.destroy();
    throw httpError(413, 'PDF_TOO_MANY_PAGES', `PDF 共 ${document.numPages} 页，目前最多支持 ${MAX_PDF_PAGES} 页。`);
  }

  const pages = [];
  let totalChars = 0;
  let removedRubyCount = 0;
  let verticalPageCount = 0;
  const footnotes = [];
  const layoutWarnings = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const layout = classifyPdfLayoutItems(content.items, { pageNumber, viewport });
    removedRubyCount += layout.rubyCount;
    footnotes.push(...layout.footnotes);
    layoutWarnings.push(...layout.warnings);
    const useVerticalLayout = shouldUseVerticalPdfLayout(layout.bodyItems, requestedMode);
    if (useVerticalLayout) verticalPageCount += 1;
    const pageText = cleanPdfText(useVerticalLayout ? joinVerticalPdfTextItems(layout.bodyItems) : joinPdfTextItems(layout.bodyItems));
    totalChars += pageText.length;
    if (totalChars > MAX_EXTRACTED_TEXT_CHARS) {
      await document.destroy();
      throw httpError(413, 'PDF_TEXT_TOO_LONG', 'PDF 提取后的文字超过 20 万字，请使用更短的资料。');
    }
    if (pageText) pages.push(pageText);
    page.cleanup();
  }

  let title = '';
  try {
    const metadata = await document.getMetadata();
    title = cleanText(metadata.info && metadata.info.Title);
  } catch {
    // Metadata is optional and should not block text extraction.
  }
  const pageCount = document.numPages;
  await document.destroy();

  const text = pages.join('\n\n');
  if (text.length < 10) {
    throw httpError(422, 'PDF_TEXT_EMPTY', '没有从 PDF 中识别到文字。它可能是扫描图片版，当前版本暂不支持 OCR。');
  }
  const layoutMode = requestedMode === 'vertical' || verticalPageCount > pageCount / 2 ? 'vertical-to-horizontal' : 'horizontal';
  return { title: title || pdfTitleFromUrl(url), pageCount, removedRubyCount, layoutMode, verticalPageCount, footnotes: mergePdfFootnotes(footnotes), layoutWarnings, text };
}

function normalizePdfMode(value) {
  const mode = String(value || 'auto').toLowerCase();
  if (mode === 'vertical' || mode === 'vertical-to-horizontal') return 'vertical';
  if (mode === 'horizontal' || mode === 'normal') return 'horizontal';
  return 'auto';
}

function classifyPdfLayoutItems(items, context = {}) {
  const visible = items.filter(item => item && String(item.str || '').trim());
  const sizes = visible.map(pdfItemSize).filter(value => value > 0);
  const bodySize = estimatePdfBodySize(visible, sizes);
  const rubyFiltered = filterPdfRubyItems(visible);
  const rubySet = new Set(visible.filter(item => !rubyFiltered.items.includes(item)));
  const bodyItems = [];
  const footnoteItems = [];
  const warnings = [];

  for (const item of visible) {
    if (rubySet.has(item)) continue;
    const text = String(item.str || '').trim();
    if (isPdfRulerOrNoiseText(text)) continue;

    const size = pdfItemSize(item) || bodySize;
    const box = pdfItemBox(item);
    const isSmall = size <= bodySize * 0.74;
    const isBottom = context.viewport && box.y < Number(context.viewport.height || 0) * 0.22;
    const isEdge = context.viewport && (box.left < Number(context.viewport.width || 0) * 0.12 || box.right > Number(context.viewport.width || 0) * 0.88);
    if (isSmall && (isBottom || isEdge || isLikelyFootnoteText(text))) {
      footnoteItems.push(item);
      continue;
    }

    bodyItems.push(item);
  }

  const footnotes = extractPdfFootnotesFromText(joinPdfTextItems(footnoteItems), context.pageNumber);
  if (footnoteItems.length && !footnotes.length) {
    warnings.push({ page: context.pageNumber, type: 'unparsed-footnote', count: footnoteItems.length });
  }

  return {
    bodyItems,
    footnotes,
    warnings,
    rubyCount: rubySet.size
  };
}

function isPdfRulerOrNoiseText(text) {
  const compact = String(text || '').replace(/\s+/g, '');
  if (!compact) return true;
  if (/^\d{1,4}[.…。．・･·•\u2022]{2,}\d{0,4}$/.test(compact)) return true;
  if (/^[.…。．・･·•\u2022]{3,}$/.test(compact)) return true;
  if (/^[-–—•·・･\u2022.\u30fb\d]+$/.test(compact) && !/[\u3040-\u30ff\u3400-\u9fff]/.test(compact)) return true;
  if (/^(?:第)?\d{1,4}(?:页|頁|ページ|p\.)$/i.test(compact)) return true;
  return false;
}

function estimatePdfBodySize(items, sizes) {
  const japaneseSizes = items
    .filter(item => /[\u3040-\u30ff\u3400-\u9fff]/.test(String(item.str || '')) && !isPdfRulerOrNoiseText(String(item.str || '')))
    .map(pdfItemSize)
    .filter(value => value > 0)
    .sort((a, b) => a - b);
  const source = japaneseSizes.length ? japaneseSizes : sizes.slice().sort((a, b) => a - b);
  if (!source.length) return 10;
  return source[Math.floor(source.length * 0.75)] || median(source) || 10;
}

function isLikelyFootnoteText(text) {
  const value = String(text || '').trim();
  return /^(?:\d{1,2}|[＊※*])/.test(value) || /(?:注|註|脚注|語注|語釈|参考)/.test(value);
}

function extractPdfFootnotesFromText(text, pageNumber) {
  const normalized = cleanPdfText(text || '');
  if (!normalized) return [];
  const chunks = normalized
    .replace(/([。．、,，\s])(\d{1,2})(?=[\u3040-\u30ff\u3400-\u9fffA-Za-z])/g, '$1\n$2')
    .split(/\n+/)
    .map(value => value.trim())
    .filter(Boolean);
  const footnotes = [];
  for (const chunk of chunks) {
    const match = chunk.match(/^(\d{1,2}|[＊※*])\s*[.:：．、。-]?\s*(.+)$/);
    if (!match) continue;
    const textValue = match[2].trim();
    if (!textValue || isPdfRulerOrNoiseText(textValue)) continue;
    footnotes.push({ id: match[1], text: textValue, page: pageNumber });
  }
  return footnotes;
}

function mergePdfFootnotes(footnotes) {
  const byKey = new Map();
  footnotes.forEach(note => {
    const key = `${note.page}:${note.id}`;
    if (!byKey.has(key)) byKey.set(key, note);
  });
  return Array.from(byKey.values());
}

function shouldUseVerticalPdfLayout(items, mode = 'auto') {
  if (mode === 'vertical') return true;
  if (mode === 'horizontal') return false;
  return isLikelyVerticalPdfPage(items);
}

function isLikelyVerticalPdfPage(items) {
  const visible = items.filter(item => item && String(item.str || '').trim());
  const japaneseItems = visible.filter(item => /[\u3040-\u30ff\u3400-\u9fff]/.test(String(item.str || '')));
  if (japaneseItems.length < 12) return false;

  const rotatedCount = japaneseItems.filter(isPdfItemRotatedVertical).length;
  if (rotatedCount >= japaneseItems.length * 0.45) return true;

  const singleCharCount = japaneseItems.filter(item => [...String(item.str || '').trim()].length <= 2).length;
  const xClusters = clusterPdfItemsByX(japaneseItems);
  const tallColumns = xClusters.filter(column => column.length >= 5).length;
  const enoughColumns = xClusters.length >= 2 && tallColumns >= 2;
  return singleCharCount >= japaneseItems.length * 0.55 && enoughColumns;
}

function isPdfItemRotatedVertical(item) {
  const transform = item && item.transform || [];
  const a = Math.abs(Number(transform[0]) || 0);
  const b = Math.abs(Number(transform[1]) || 0);
  const c = Math.abs(Number(transform[2]) || 0);
  const d = Math.abs(Number(transform[3]) || 0);
  return (b > a * 1.5 && c > d * 1.5);
}

function clusterPdfItemsByX(items) {
  const visible = items
    .filter(item => item && String(item.str || '').trim())
    .map(item => ({ item, box: pdfItemBox(item), size: pdfItemSize(item) || 10 }))
    .sort((a, b) => b.box.left - a.box.left);
  const medianSize = median(visible.map(entry => entry.size)) || 10;
  const threshold = Math.max(4, medianSize * 1.1);
  const columns = [];
  visible.forEach(entry => {
    let column = columns.find(group => Math.abs(group.x - entry.box.left) <= threshold);
    if (!column) {
      column = { x: entry.box.left, entries: [] };
      columns.push(column);
    }
    column.entries.push(entry);
    column.x = column.entries.reduce((sum, value) => sum + value.box.left, 0) / column.entries.length;
  });
  columns.sort((a, b) => b.x - a.x);
  // Merge thin neighboring columns that are usually the same visual column split apart by x-jitter
  // (this is what caused a handful of characters to end up alone on their own line).
  const merged = [];
  columns.forEach(column => {
    const prev = merged[merged.length - 1];
    if (prev && (prev.entries.length < 3 || column.entries.length < 3) && Math.abs(prev.x - column.x) <= threshold * 1.8) {
      prev.entries.push(...column.entries);
      prev.x = prev.entries.reduce((sum, value) => sum + value.box.left, 0) / prev.entries.length;
      return;
    }
    merged.push(column);
  });
  return merged.sort((a, b) => b.x - a.x).map(column => column.entries.map(entry => entry.item));
}

function joinVerticalPdfTextItems(items) {
  const columns = clusterPdfItemsByX(items);
  const lines = columns.map(column => {
    const sorted = column
      .filter(item => String(item.str || '').trim())
      .sort((a, b) => {
        const ay = pdfItemBox(a).y;
        const by = pdfItemBox(b).y;
        if (Math.abs(by - ay) > 2) return by - ay;
        return pdfItemBox(b).left - pdfItemBox(a).left;
      });
    const text = sorted.map(item => normalizeVerticalPdfTextItem(item)).join('').replace(/\s+/g, '');
    const topY = sorted.length ? pdfItemBox(sorted[0]).y : null;
    return { text, topY };
  }).filter(line => line.text);
  if (!lines.length) return '';

  const tops = lines.map(line => line.topY).filter(value => value !== null);
  const baseTop = tops.length ? median(tops.slice().sort((a, b) => b - a)) : null;
  const sizes = items.map(pdfItemSize).filter(value => value > 0);
  const avgSize = sizes.length ? median(sizes.slice().sort((a, b) => a - b)) : 10;
  const indentThreshold = avgSize * 0.8;

  let output = '';
  lines.forEach((line, index) => {
    if (index === 0) {
      output += line.text;
      return;
    }
    // A column starting noticeably lower than the page's usual top line is a new paragraph's first-line indent.
    const isIndented = baseTop !== null && line.topY !== null && (baseTop - line.topY) > indentThreshold;
    output += isIndented ? `\n\n${line.text}` : `\n${line.text}`;
  });
  return output;
}

function normalizeVerticalPdfTextItem(item) {
  const value = String(item && item.str || '');
  return isPdfItemRotatedVertical(item) ? [...value].join('') : value;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function ensurePdfTextGlobals() {
  // PDF.js 5 checks browser drawing globals during startup, even for text-only extraction.
  if (typeof globalThis.DOMMatrix === 'undefined') globalThis.DOMMatrix = class DOMMatrix {};
  if (typeof globalThis.ImageData === 'undefined') globalThis.ImageData = class ImageData {};
  if (typeof globalThis.Path2D === 'undefined') globalThis.Path2D = class Path2D {};
}

function joinPdfTextItems(items) {
  const lines = [];
  let current = [];
  for (const item of items) {
    if (!String(item && item.str || '')) continue;
    current.push(item);
    if (item.hasEOL) {
      lines.push(current);
      current = [];
    }
  }
  if (current.length) lines.push(current);
  if (!lines.length) return '';

  const lineLefts = lines
    .map(line => {
      const firstVisible = line.find(it => String(it.str || '').trim());
      return firstVisible ? pdfItemBox(firstVisible).left : null;
    })
    .filter(value => value !== null);
  const baseLeft = lineLefts.length ? median(lineLefts.slice().sort((a, b) => a - b)) : 0;
  const sizes = items.map(pdfItemSize).filter(value => value > 0);
  const avgSize = sizes.length ? median(sizes.slice().sort((a, b) => a - b)) : 10;
  const indentThreshold = avgSize * 0.8;

  let output = '';
  lines.forEach((line, index) => {
    let lineText = '';
    line.forEach(item => {
      const value = String(item.str || '');
      if (!value) return;
      const previous = lineText.slice(-1);
      const needsSpace = previous && !/\s/.test(previous) && shouldSeparatePdfText(previous, value[0]);
      lineText += `${needsSpace ? ' ' : ''}${value}`;
    });
    if (!lineText) return;
    const firstVisible = line.find(it => String(it.str || '').trim());
    const left = firstVisible ? pdfItemBox(firstVisible).left : baseLeft;
    const isIndented = left - baseLeft > indentThreshold || /^[　]/.test(lineText);
    const cleanedLine = lineText.replace(/^[　\s]+/, '');
    if (index === 0) {
      output += cleanedLine;
    } else if (isIndented) {
      output += `\n\n${cleanedLine}`;
    } else {
      output += `\n${cleanedLine}`;
    }
  });
  return output;
}

function filterPdfRubyItems(items) {
  const visibleItems = items.filter(item => item && String(item.str || '').trim());
  const rubyIndexes = new Set();

  visibleItems.forEach(candidate => {
    const text = String(candidate.str || '').trim();
    if (!/^[\u3040-\u30ffー・\s]+$/.test(text)) return;

    const candidateSize = pdfItemSize(candidate);
    if (!candidateSize) return;

    const candidateBox = pdfItemBox(candidate);
    const hasBaseTextBelow = visibleItems.some(base => {
      if (base === candidate || !/[\u3400-\u9fff々〆ヶ]/.test(String(base.str || ''))) return false;
      const baseSize = pdfItemSize(base);
      if (!baseSize || candidateSize > baseSize * 0.68) return false;

      const baseBox = pdfItemBox(base);
      const baselineGap = candidateBox.y - baseBox.y;
      if (baselineGap < baseSize * 0.35 || baselineGap > baseSize * 1.35) return false;

      const overlap = Math.min(candidateBox.right, baseBox.right) - Math.max(candidateBox.left, baseBox.left);
      const candidateCenter = (candidateBox.left + candidateBox.right) / 2;
      const horizontallyRelated = overlap >= Math.min(candidateBox.width, baseBox.width) * 0.2 ||
        (candidateCenter >= baseBox.left - baseSize * 0.25 && candidateCenter <= baseBox.right + baseSize * 0.25);
      return horizontallyRelated;
    });

    if (hasBaseTextBelow) rubyIndexes.add(candidate);
  });

  return {
    items: items.filter(item => !rubyIndexes.has(item)),
    removedCount: rubyIndexes.size
  };
}

function pdfItemSize(item) {
  const transformSize = item.transform && Number(item.transform[3]);
  return Math.abs(transformSize || Number(item.height) || 0);
}

function pdfItemBox(item) {
  const left = Number(item.transform && item.transform[4]) || 0;
  const y = Number(item.transform && item.transform[5]) || 0;
  const width = Math.max(0, Number(item.width) || 0);
  return { left, right: left + width, width, y };
}

function cleanPdfText(text) {
  const japanese = '\\u3040-\\u30ff\\u3400-\\u9fff';
  return cleanText(text)
    .replace(new RegExp(`([${japanese}]) +(?=[${japanese}])`, 'g'), '$1')
    .replace(/ +([、。！？）」』】])/g, '$1')
    .replace(/([（「『【]) +/g, '$1');
}

function shouldSeparatePdfText(left, right) {
  const japaneseOrPunctuation = /[\u3040-\u30ff\u3400-\u9fff\u3000-\u303f、。！？「」『』（）]/;
  return !japaneseOrPunctuation.test(left) && !japaneseOrPunctuation.test(right);
}

function pdfTitleFromUrl(url) {
  try {
    const filename = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'PDF 文档');
    return filename.replace(/\.pdf$/i, '') || 'PDF 文档';
  } catch {
    return 'PDF 文档';
  }
}

function decodeHtmlBuffer(buffer, contentType) {
  const fallback = 'utf-8';
  const head = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1');
  const charset = normalizeCharset(
    extractCharsetFromContentType(contentType) ||
    extractCharsetFromMeta(head) ||
    fallback
  );
  try {
    return {
      html: new TextDecoder(charset).decode(buffer),
      charset
    };
  } catch {
    return {
      html: new TextDecoder(fallback).decode(buffer),
      charset: fallback
    };
  }
}

function extractCharsetFromContentType(contentType) {
  const match = String(contentType || '').match(/charset\s*=\s*["']?([^;"'\s]+)/i);
  return match ? match[1] : '';
}

function extractCharsetFromMeta(head) {
  const metaCharset = head.match(/<meta[^>]+charset=["']?\s*([^"'\s/>]+)/i);
  if (metaCharset) return metaCharset[1];
  const contentType = head.match(/<meta[^>]+http-equiv=["']?content-type["']?[^>]+content=["'][^"']*charset=([^"'\s;]+)/i);
  return contentType ? contentType[1] : '';
}

function normalizeCharset(charset) {
  const value = String(charset || '').trim().toLowerCase();
  if (!value) return 'utf-8';
  if (value === 'shift-jis' || value === 'shift_jis' || value === 'sjis' || value === 'windows-31j') return 'shift_jis';
  if (value === 'eucjp' || value === 'euc-jp') return 'euc-jp';
  if (value === 'iso2022jp' || value === 'iso-2022-jp') return 'iso-2022-jp';
  if (value === 'utf8') return 'utf-8';
  return value;
}

async function assertPublicDns(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw httpError(400, 'PRIVATE_URL_BLOCKED', '不能抓取本机或内网地址。');
    }
    return;
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => isPrivateIp(record.address))) {
    throw httpError(400, 'PRIVATE_URL_BLOCKED', '该域名解析到本机或内网地址，已阻止抓取。');
  }
}

function isLocalHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized.endsWith('.localhost');
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      ip === '0.0.0.0'
    );
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }

  return false;
}

function normalizeTranscriptItem(item) {
  const rawStart = Number(item.start ?? item.offset ?? 0);
  const rawDuration = Number(item.duration ?? 0);
  const start = rawStart > 10000 ? rawStart / 1000 : rawStart;
  const duration = rawDuration > 10000 ? rawDuration / 1000 : rawDuration;
  return {
    start,
    duration,
    timestamp: formatTimestamp(start),
    text: cleanText(String(item.text || ''))
  };
}

function cleanText(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function sendError(res, error) {
  const isYoutubeFetchFailed = error && error.message === 'fetch failed';
  const status = error.status || (isYoutubeFetchFailed ? 502 : 500);
  res.status(status).json({
    ok: false,
    error: error.code || (isYoutubeFetchFailed ? 'YOUTUBE_FETCH_FAILED' : 'INTERNAL_ERROR'),
    message: isYoutubeFetchFailed
      ? '后端无法访问 YouTube 字幕服务。通常是网络、代理、地区访问或 YouTube 临时限制导致。'
      : (error.message || '服务器内部错误。')
  });
}

module.exports = {
  app,
  classifyPdfLayoutItems,
  classifyFetchedResource,
  decodeTextFile,
  extractPdfFootnotesFromText,
  extractDocxText,
  extractPdfText,
  filterPdfRubyItems,
  isAllowedOrigin,
  isLikelyVerticalPdfPage,
  joinVerticalPdfTextItems,
  normalizePdfMode,
  normalizePngExportPayload,
  renderRubyPng
};
