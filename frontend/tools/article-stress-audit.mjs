#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(TOOL_DIR, '..');
const ROOT_DIR = resolve(FRONTEND_DIR, '..');
const CORPUS_VERSION = '20260717-01';
const corpusPath = resolve(FRONTEND_DIR, `test-data/article-stress/${CORPUS_VERSION}/articles.json`);
const articles = JSON.parse(await readFile(corpusPath, 'utf8'));
const EXPECTED_CATEGORIES = ['daily_life', 'education', 'news', 'business_finance', 'technology', 'institution_notice'];
const MIME_TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.gz':'application/gzip', '.dat':'application/octet-stream'
};

const ids = articles.map(item=>item.id);
if(articles.length !== 20) throw new Error(`Article corpus must contain exactly 20 fixtures; got ${articles.length}.`);
if(new Set(ids).size !== ids.length) throw new Error('Article corpus IDs must be unique.');
for(const category of EXPECTED_CATEGORIES){
  if(!articles.some(item=>item.category === category)) throw new Error(`Article category is missing: ${category}`);
}
for(const item of articles){
  if(!item.title || !item.text || item.provenance !== 'project-authored-realistic-fixture'){
    throw new Error(`${item.id}: invalid deterministic fixture metadata.`);
  }
}

let baseUrl = '';
const server = createServer((request, response)=>{
  const parsed = new URL(request.url || '/', baseUrl || 'http://127.0.0.1');
  const pathname = decodeURIComponent(parsed.pathname === '/' ? '/index.html' : parsed.pathname);
  const filePath = resolve(FRONTEND_DIR, `.${pathname}`);
  if(!filePath.startsWith(FRONTEND_DIR)){
    response.writeHead(403).end('Forbidden');
    return;
  }
  readFile(filePath).then(()=>{
    response.writeHead(200, {'Content-Type':MIME_TYPES[extname(filePath)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    createReadStream(filePath).pipe(response);
  }).catch(()=>response.writeHead(404).end('Not found'));
});

await new Promise((ready, reject)=>{
  server.once('error', reject);
  server.listen(0, '127.0.0.1', ready);
});
const address = server.address();
if(!address || typeof address === 'string') throw new Error('Local test server unavailable.');
baseUrl = `http://127.0.0.1:${address.port}`;

const startedAt = new Date();
const consoleMessages = [];
let browser;
let browserVersion = '';
let observations = null;
try{
  browser = await chromium.launch({headless:true});
  browserVersion = browser.version();
  const page = await browser.newPage({viewport:{width:1440, height:1000}});
  page.on('console', message=>{
    if(['warning', 'error'].includes(message.type())) consoleMessages.push(`[${message.type()}] ${message.text()}`);
  });
  page.on('requestfailed', request=>consoleMessages.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText || ''}`));
  await page.goto(baseUrl, {waitUntil:'networkidle'});
  observations = await page.evaluate(async corpus=>{
    const isClickable = token=>{
      const surface = String(token?.surface_form || '');
      return Boolean(surface.trim())
        && !/^[。、！？「」『』（）(),.!?]+$/u.test(surface)
        && token?.pos !== '記号';
    };
    const client = window.KuromojiWorkerClient.createClient({
      workerUrl:'/vendor/kuromoji/20260714-01/kuromoji-tokenizer.worker.js',
      initTimeoutMs:60000,
      tokenizeTimeoutMs:15000
    });
    const articleResults = [];
    try{
      for(const item of corpus){
        const result = await client.analyze(item.text);
        const merged = mergeLexicalTokens(result.appTokens || []);
        articleResults.push({
          id:item.id,
          category:item.category,
          ok:Boolean(result.ok),
          mode:String(result.mode || ''),
          paragraphCount:Array.isArray(result.paragraphs) ? result.paragraphs.length : 0,
          reconstructsParagraphs:Array.isArray(result.paragraphs) && result.paragraphs.every(paragraph=>
            (paragraph.tokens || []).map(token=>token.surface).join('') === paragraph.text
          ),
          clickableTokens:merged.filter(isClickable).length,
          contextualCorrections:merged.filter(token=>Boolean(token.contextual_reading_rule)).length,
          metrics:result.metrics || {}
        });
      }
    }finally{
      client.terminate();
    }

    enterReadingFromHero();
    const checkbox = document.getElementById('useKuromoji');
    if(checkbox) checkbox.checked = true;
    document.getElementById('inputText').value = corpus.map(item=>item.text).join('\n\n');
    await renderText();
    const uiClickableTokens = (window.KUROMOJI_TOKEN_CACHE || []).filter(Boolean).length;
    return {
      articles:articleResults,
      ui:{
        mode:document.body.dataset.tokenizerMode || '',
        clickableTokens:uiClickableTokens,
        outputHasText:Boolean(document.getElementById('output')?.textContent?.trim())
      }
    };
  }, articles);
}finally{
  await browser?.close();
  await new Promise(resolveClose=>server.close(resolveClose));
}

const finishedAt = new Date();
const articleResults = observations?.articles || [];
const totalClickableTokens = articleResults.reduce((sum, item)=>sum + Number(item.clickableTokens || 0), 0);
const categoryCounts = Object.fromEntries(EXPECTED_CATEGORIES.map(category=>[
  category,
  articleResults.filter(item=>item.category === category).length
]));
const assertions = {
  articleCount:articleResults.length === 20,
  allCategories:EXPECTED_CATEGORIES.every(category=>categoryCounts[category] > 0),
  workerSuccess:articleResults.every(item=>item.ok && item.mode === 'kuromoji-worker-poc'),
  paragraphReconstruction:articleResults.every(item=>item.reconstructsParagraphs),
  clickableTokenScale:totalClickableTokens >= 1000,
  uiWorkerMode:observations?.ui?.mode === 'kuromoji-worker',
  uiTokenScale:Number(observations?.ui?.clickableTokens || 0) >= 1000,
  uiOutput:observations?.ui?.outputHasText === true,
  noBrowserErrors:consoleMessages.length === 0
};
const status = Object.values(assertions).every(Boolean) ? 'PASS' : 'FAIL';
const branch = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {cwd:ROOT_DIR, encoding:'utf8'}).trim();
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:ROOT_DIR, encoding:'utf8'}).trim();
const report = {
  status,
  corpusVersion:CORPUS_VERSION,
  startedAt:startedAt.toISOString(),
  finishedAt:finishedAt.toISOString(),
  durationMs:finishedAt - startedAt,
  branch,
  commit,
  browser:browserVersion,
  articleCount:articles.length,
  categoryCounts,
  totalClickableTokens,
  ui:observations?.ui || {},
  assertions,
  articles:articleResults,
  consoleMessages,
  safariManual:{status:'PENDING', note:'Requires authorized Preview plus real Mac Safari and iPhone Safari; no result is inferred from Chromium.'}
};
const reportDirectory = resolve(FRONTEND_DIR, 'article-stress-results', startedAt.toISOString().replace(/[:.]/g, '-'));
await mkdir(reportDirectory, {recursive:true});
await writeFile(resolve(reportDirectory, 'article-stress-report.json'), `${JSON.stringify(report, null, 2)}\n`);
const categoryRows = Object.entries(categoryCounts).map(([category, count])=>`| ${category} | ${count} |`).join('\n');
const articleRows = articleResults.map(item=>`| ${item.id} | ${item.category} | ${item.clickableTokens} | ${item.ok ? 'PASS' : 'FAIL'} |`).join('\n');
const markdown = `# Article Stress Audit

- Result: **${status}**
- Corpus version: \`${CORPUS_VERSION}\`
- Branch / commit: \`${branch}\` / \`${commit}\`
- Browser: ${browserVersion}
- Articles: ${articles.length}
- Clickable tokens (Worker): ${totalClickableTokens}
- Clickable tokens (full UI): ${observations?.ui?.clickableTokens || 0}
- Final tokenizer mode: \`${observations?.ui?.mode || ''}\`
- Safari manual: **PENDING** (requires authorized Preview and real devices)

## Categories

| Category | Articles |
|---|---:|
${categoryRows}

## Gates

${Object.entries(assertions).map(([name, passed])=>`- ${passed ? 'PASS' : 'FAIL'}: ${name}`).join('\n')}

## Article Results

| ID | Category | Clickable tokens | Worker |
|---|---|---:|---:|
${articleRows}
`;
await writeFile(resolve(reportDirectory, 'article-stress-report.md'), markdown);

process.stdout.write(`Article stress audit: ${status}\n`);
process.stdout.write(`Articles: ${articles.length}; categories: ${EXPECTED_CATEGORIES.length}; Worker clickable tokens: ${totalClickableTokens}; UI clickable tokens: ${observations?.ui?.clickableTokens || 0}\n`);
process.stdout.write(`Report: ${resolve(reportDirectory, 'article-stress-report.md')}\n`);
if(status !== 'PASS') process.exitCode = 1;
