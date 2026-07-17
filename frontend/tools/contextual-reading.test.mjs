#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(TOOL_DIR, '..');
const cases = JSON.parse(await readFile(resolve(FRONTEND_DIR, 'test-data/contextual-reading/20260717-01/cases.json'), 'utf8'));
const MIME_TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.gz':'application/gzip', '.dat':'application/octet-stream'
};

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

let browser;
try{
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1280, height:900}});
  await page.goto(baseUrl, {waitUntil:'networkidle'});
  const results = await page.evaluate(async corpus=>{
    const toHiragana = value=>String(value || '').replace(/[ァ-ヶ]/g, char=>String.fromCharCode(char.charCodeAt(0) - 0x60));
    const findSlice = (tokens, surface)=>{
      for(let start = 0; start < tokens.length; start += 1){
        let joined = '';
        for(let end = start; end < tokens.length && joined.length <= surface.length; end += 1){
          joined += String(tokens[end]?.surface_form || '');
          if(joined === surface) return tokens.slice(start, end + 1);
        }
      }
      return [];
    };
    const client = window.KuromojiWorkerClient.createClient({
      workerUrl:'/vendor/kuromoji/20260714-01/kuromoji-tokenizer.worker.js',
      initTimeoutMs:60000,
      tokenizeTimeoutMs:15000
    });
    try{
      const output = [];
      for(const item of corpus){
        const analyzed = await client.analyze(item.sentence);
        const resolved = resolveContextualTokenReadings(analyzed.appTokens || []);
        const slice = findSlice(resolved, item.surface);
        output.push({
          id:item.id,
          found:Boolean(slice.length),
          reading:toHiragana(slice.map(token=>token.reading && token.reading !== '*' ? token.reading : token.surface_form || '').join('')),
          rules:[...new Set(slice.map(token=>token.contextual_reading_rule).filter(Boolean))]
        });
      }
      return output;
    }finally{
      client.terminate();
    }
  }, cases);

  for(const item of cases){
    const actual = results.find(result=>result.id === item.id);
    assert.equal(actual?.found, true, `${item.id}: target surface not found`);
    assert.equal(actual?.reading, item.expectedReading, `${item.id}: contextual reading mismatch`);
    if(item.rule === 'counterexample') assert.deepEqual(actual?.rules, [], `${item.id}: counterexample must not trigger a contextual rule`);
    else assert.ok(actual?.rules.includes(item.rule), `${item.id}: expected rule ${item.rule}`);
  }
  process.stdout.write(`Contextual reading regression passed: ${cases.length} Worker cases.\n`);
}finally{
  await browser?.close();
  await new Promise(resolveClose=>server.close(resolveClose));
}
