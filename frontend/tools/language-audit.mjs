#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(TOOL_DIR, '..');
const CORPUS_DIR = resolve(FRONTEND_DIR, 'test-data/language-corpus/20260717-01');
const DEFAULT_RESULTS_DIR = resolve(FRONTEND_DIR, 'language-audit-results');
const cases = JSON.parse(await readFile(resolve(CORPUS_DIR, 'cases.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(CORPUS_DIR, 'manifest.json'), 'utf8'));
const startedAt = new Date();
const runId = startedAt.toISOString().replace(/[:.]/g, '-');
const outputRoot = process.env.LANGUAGE_AUDIT_OUTPUT_DIR
  ? resolve(process.env.LANGUAGE_AUDIT_OUTPUT_DIR)
  : resolve(DEFAULT_RESULTS_DIR, runId);
const MIME_TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.gz':'application/gzip', '.dat':'application/octet-stream'
};
const THRESHOLDS = {
  surfaceReadingAccuracy:98,
  lemmaAccuracy:97,
  knownChineseAccuracy:95,
  homophoneErrors:0,
  functionWordErrors:0,
  properNounGuessErrors:0,
  jlptErrors:0,
  regressionPassRate:100
};

function gitValue(args){
  const result = spawnSync('git', args, {cwd:resolve(FRONTEND_DIR, '..'), encoding:'utf8'});
  return result.status === 0 ? result.stdout.trim() : '';
}
function percent(correct, total){
  return total ? Number(((correct / total) * 100).toFixed(2)) : 100;
}
function ratio(correct, total){
  return {correct, total, rate:percent(correct, total)};
}
function markdownCell(value){
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
}
function metricLine(label, metric){
  return `- ${label}：${metric.correct}/${metric.total}（${metric.rate.toFixed(2)}%）`;
}

let baseUrl = '';
const server = createServer(async (request, response)=>{
  const parsed = new URL(request.url || '/', baseUrl || 'http://127.0.0.1');
  const pathname = decodeURIComponent(parsed.pathname === '/' ? '/index.html' : parsed.pathname);
  const filePath = resolve(FRONTEND_DIR, `.${pathname}`);
  if(!filePath.startsWith(`${FRONTEND_DIR}/`) && filePath !== FRONTEND_DIR){
    response.writeHead(403).end('Forbidden');
    return;
  }
  try{
    await readFile(filePath);
    response.writeHead(200, {
      'Content-Type':MIME_TYPES[extname(filePath)] || 'application/octet-stream',
      'Cache-Control':'no-store'
    });
    createReadStream(filePath).pipe(response);
  }catch{
    response.writeHead(404).end('Not found');
  }
});

await new Promise((resolveReady, rejectReady)=>{
  server.once('error', rejectReady);
  server.listen(0, '127.0.0.1', resolveReady);
});
const address = server.address();
if(!address || typeof address === 'string') throw new Error('Local language-audit server unavailable.');
baseUrl = `http://127.0.0.1:${address.port}`;

let browser;
let browserVersion = '';
let observations = [];
const consoleMessages = [];
try{
  browser = await chromium.launch({headless:true});
  browserVersion = browser.version();
  const page = await browser.newPage({viewport:{width:1280, height:900}});
  page.on('console', message=>{
    if(['warning', 'error'].includes(message.type())) consoleMessages.push(`[${message.type()}] ${message.text()}`);
  });
  page.on('requestfailed', request=>consoleMessages.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText || ''}`));
  await page.goto(baseUrl, {waitUntil:'networkidle'});
  observations = await page.evaluate(async corpus=>{
    await ensureLearningData();
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
    const isCountedToken = token=>{
      const surface = String(token?.surface_form || '');
      return Boolean(surface.trim()) && !/^[。、！？「」『』（）(),.!?]+$/u.test(surface) && token?.pos !== '記号';
    };
    const client = window.KuromojiWorkerClient.createClient({
      workerUrl:'/vendor/kuromoji/20260714-01/kuromoji-tokenizer.worker.js',
      initTimeoutMs:60000,
      tokenizeTimeoutMs:15000
    });
    const records = [];
    try{
      for(const item of corpus){
        const workerResult = await client.analyze(item.sentence);
        const rawTokens = resolveContextualTokenReadings(workerResult.appTokens || []);
        const mergedTokens = mergeLexicalTokens(rawTokens);
        const slice = findSlice(rawTokens, item.surface);
        const firstLexical = slice.find(token=>!/^(?:助詞|助動詞|記号)$/.test(String(token.pos || ''))) || slice[0] || {};
        const reading = toHiragana(slice.map(token=>{
          if(token.reading && token.reading !== '*') return token.reading;
          return /^[ぁ-んァ-ヶー]+$/u.test(token.surface_form || '') ? token.surface_form : '';
        }).join(''));
        const analysis = normalizeLexicalAnalysis({
          surface:item.surface,
          surfaceReading:item.expectedSurfaceReading,
          lemma:item.expectedLemma,
          lemmaReading:item.expectedLemmaReading,
          partOfSpeech:item.expectedPartOfSpeech,
          partOfSpeechDetail:item.expectedMeaningClass === 'proper-noun-unresolved'
            || (item.expectedMeaningClass === 'numeric-or-latin' && !item.allowReadingLookup)
            ? '固有名詞'
            : '',
          conjugationType:item.expectedConjugationType,
          conjugationForm:item.expectedConjugationForm,
          isFunctionWord:item.expectedMeaningClass === 'function-word',
          isCompound:item.category === 'compounds'
        });
        const lookupPlan = buildLexicalLookupPlan(analysis);
        const [chinese, jmdict, jlpt] = await Promise.all([
          lookupOfflineChinese(lookupPlan, item.surface),
          lookupJmdictCommonWithCompoundFallback(lookupPlan, item.surface),
          lookupJlptReference(lookupPlan)
        ]);
        const expectedPosCategory = lookupPosCategory(item.expectedPartOfSpeech);
        const chinesePos = chinese?.entry ? [...lookupEntryPosCategories(chinese.entry, 'chinese')] : [];
        const jmdictPos = jmdict?.entry ? [...lookupEntryPosCategories(jmdict.entry, 'jmdict')] : [];
        records.push({
          id:item.id,
          workerOk:Boolean(workerResult.ok),
          tokenCount:mergedTokens.filter(isCountedToken).length,
          found:Boolean(slice.length),
          sliceLength:slice.length,
          surfaceReading:reading,
          lemma:String(firstLexical.basic_form && firstLexical.basic_form !== '*' ? firstLexical.basic_form : firstLexical.surface_form || ''),
          partOfSpeech:String(firstLexical.pos && firstLexical.pos !== '*' ? firstLexical.pos : ''),
          chinese:chinese ? {
            term:String(chinese.term || ''),
            meaning:String(chinese.entry?.m || ''),
            kind:String(chinese.candidate?.kind || ''),
            pos:chinesePos,
            posMatches:!expectedPosCategory || chinesePos.includes(expectedPosCategory)
          } : null,
          jmdict:jmdict ? {
            term:String(jmdict.term || ''),
            meaning:Array.isArray(jmdict.entry?.g) ? jmdict.entry.g.join('; ') : '',
            kind:String(jmdict.candidate?.kind || ''),
            pos:jmdictPos,
            posMatches:!expectedPosCategory || jmdictPos.includes(expectedPosCategory)
          } : null,
          jlpt:String(jlpt || '')
        });
      }
    }finally{
      client.terminate();
    }
    return records;
  }, cases);
}finally{
  await browser?.close();
  await new Promise(resolveClose=>server.close(resolveClose));
}

const byId = new Map(observations.map(item=>[item.id, item]));
const failures = [];
const spanMorphologyCategories = new Set(['verbs', 'adjectives']);
const singleTokenMorphologyCategories = new Set(['basic', 'function_words', 'ambiguity']);
let tokenTotal = 0;
let located = 0;
let readingTotal = 0;
let readingCorrect = 0;
let lemmaTotal = 0;
let lemmaCorrect = 0;
let posTotal = 0;
let posCorrect = 0;
let knownChineseTotal = 0;
let knownChineseCorrect = 0;
let fallbackEligible = 0;
let jmdictFallbackHits = 0;
let completeMisses = 0;
let jlptTotal = 0;
let jlptCorrect = 0;
let homophoneErrors = 0;
let functionWordErrors = 0;
let properNounGuessErrors = 0;
const categoryStats = Object.fromEntries(Object.keys(manifest.categories).map(category=>[category,{total:0, pass:0}]));

for(const item of cases){
  const actual = byId.get(item.id) || {};
  const caseFailures = [];
  tokenTotal += Number(actual.tokenCount || 0);
  categoryStats[item.category].total += 1;
  if(actual.found) located += 1;
  else caseFailures.push({type:'surface-not-found', expected:item.surface, actual:''});

  const readingEligible = Boolean(item.expectedSurfaceReading)
    && item.expectedMeaningClass !== 'numeric-or-latin'
    && !/[A-Za-z0-9]/.test(item.surface)
    && /[\u3040-\u30ff\u3400-\u9fff]/u.test(item.surface);
  if(readingEligible){
    readingTotal += 1;
    if(actual.surfaceReading === item.expectedSurfaceReading) readingCorrect += 1;
    else caseFailures.push({type:'surface-reading', expected:item.expectedSurfaceReading, actual:actual.surfaceReading || ''});
  }

  const morphologyEligible = spanMorphologyCategories.has(item.category)
    || (singleTokenMorphologyCategories.has(item.category) && actual.sliceLength === 1);
  if(morphologyEligible && actual.found){
    lemmaTotal += 1;
    posTotal += 1;
    if(actual.lemma === item.expectedLemma) lemmaCorrect += 1;
    else caseFailures.push({type:'lemma', expected:item.expectedLemma, actual:actual.lemma || ''});
    if(actual.partOfSpeech === item.expectedPartOfSpeech) posCorrect += 1;
    else caseFailures.push({type:'part-of-speech', expected:item.expectedPartOfSpeech, actual:actual.partOfSpeech || ''});
  }

  const visibleMeaning = [actual.chinese?.meaning, actual.jmdict?.meaning].filter(Boolean).join(' ');
  const forbiddenMatches = item.mustNotContain.filter(value=>visibleMeaning.includes(value));
  if(forbiddenMatches.length){
    homophoneErrors += 1;
    caseFailures.push({type:'homophone-forbidden-match', expected:`not ${forbiddenMatches.join(', ')}`, actual:visibleMeaning});
  }

  if(item.expectedMeaningClass === 'known-chinese'){
    knownChineseTotal += 1;
    if(actual.chinese && !forbiddenMatches.length) knownChineseCorrect += 1;
    else caseFailures.push({type:'offline-chinese', expected:'hit', actual:actual.chinese ? 'forbidden match' : 'miss'});
  }

  const lookupEligible = !['function-word', 'proper-noun-unresolved', 'numeric-or-latin', 'context-dependent'].includes(item.expectedMeaningClass);
  if(lookupEligible && !actual.chinese){
    fallbackEligible += 1;
    if(actual.jmdict) jmdictFallbackHits += 1;
    else{
      completeMisses += 1;
      if(item.expectedMeaningClass === 'jmdict-fallback') caseFailures.push({type:'jmdict-fallback', expected:'hit', actual:'miss'});
    }
  }

  if(item.expectedJlptLevel){
    jlptTotal += 1;
    if(actual.jlpt === item.expectedJlptLevel) jlptCorrect += 1;
    else caseFailures.push({type:'jlpt', expected:item.expectedJlptLevel, actual:actual.jlpt || ''});
  }else if(actual.jlpt && ['function-word', 'proper-noun-unresolved', 'numeric-or-latin'].includes(item.expectedMeaningClass)){
    caseFailures.push({type:'unexpected-jlpt', expected:'', actual:actual.jlpt});
  }

  if(item.expectedMeaningClass === 'function-word'){
    const mismatched = [actual.chinese, actual.jmdict].filter(result=>result && !result.posMatches);
    if(mismatched.length){
      functionWordErrors += 1;
      caseFailures.push({type:'function-word-pos-mismatch', expected:item.expectedPartOfSpeech, actual:mismatched.map(result=>result.pos.join(',')).join(';')});
    }
  }
  const properResult = actual.chinese || actual.jmdict;
  if(item.expectedMeaningClass === 'proper-noun-unresolved'
    && properResult
    && !['exactSurface', 'lemma'].includes(properResult.kind)){
    properNounGuessErrors += 1;
    caseFailures.push({type:'proper-noun-guess', expected:'unresolved', actual:actual.chinese?.term || actual.jmdict?.term || ''});
  }

  if(caseFailures.length){
    for(const failure of caseFailures){
      failures.push({id:item.id, category:item.category, surface:item.surface, ...failure});
    }
  }else{
    categoryStats[item.category].pass += 1;
  }
}

const failedCaseCount = new Set(failures.map(item=>item.id)).size;
const metrics = {
  tokenTotal,
  cases:{total:cases.length, located, failed:failedCaseCount},
  surfaceReading:ratio(readingCorrect, readingTotal),
  lemma:ratio(lemmaCorrect, lemmaTotal),
  partOfSpeech:ratio(posCorrect, posTotal),
  knownChinese:ratio(knownChineseCorrect, knownChineseTotal),
  jmdictFallback:ratio(jmdictFallbackHits, fallbackEligible),
  completeMiss:ratio(completeMisses, fallbackEligible),
  jlptInheritance:ratio(jlptCorrect, jlptTotal),
  homophoneErrors,
  functionWordErrors,
  properNounGuessErrors,
  regression:ratio(cases.length - failedCaseCount, cases.length)
};
const gates = [
  {name:'surface-reading', pass:metrics.surfaceReading.rate >= THRESHOLDS.surfaceReadingAccuracy, actual:metrics.surfaceReading.rate, expected:`>= ${THRESHOLDS.surfaceReadingAccuracy}%`},
  {name:'lemma', pass:metrics.lemma.rate >= THRESHOLDS.lemmaAccuracy, actual:metrics.lemma.rate, expected:`>= ${THRESHOLDS.lemmaAccuracy}%`},
  {name:'known-chinese', pass:metrics.knownChinese.rate >= THRESHOLDS.knownChineseAccuracy, actual:metrics.knownChinese.rate, expected:`>= ${THRESHOLDS.knownChineseAccuracy}%`},
  {name:'homophone-errors', pass:homophoneErrors === THRESHOLDS.homophoneErrors, actual:homophoneErrors, expected:'0'},
  {name:'function-word-errors', pass:functionWordErrors === THRESHOLDS.functionWordErrors, actual:functionWordErrors, expected:'0'},
  {name:'proper-noun-guess-errors', pass:properNounGuessErrors === THRESHOLDS.properNounGuessErrors, actual:properNounGuessErrors, expected:'0'},
  {name:'jlpt-errors', pass:jlptCorrect === jlptTotal, actual:jlptTotal - jlptCorrect, expected:'0'},
  {name:'known-regressions', pass:metrics.regression.rate === THRESHOLDS.regressionPassRate, actual:metrics.regression.rate, expected:'100%'}
];
const status = gates.every(gate=>gate.pass) ? 'PASS' : 'FAIL';
const finishedAt = new Date();
const report = {
  schemaVersion:1,
  auditVersion:'20260717-01',
  corpusVersion:manifest.corpusVersion,
  startedAt:startedAt.toISOString(),
  finishedAt:finishedAt.toISOString(),
  durationMs:finishedAt.getTime() - startedAt.getTime(),
  status,
  branch:gitValue(['symbolic-ref', '--short', 'HEAD']),
  commit:gitValue(['rev-parse', 'HEAD']),
  worktree:gitValue(['status', '--porcelain=v1']) ? 'dirty' : 'clean',
  browser:{name:'Playwright Chromium', version:browserVersion},
  safariManual:{status:manifest.safariManualStatus, cases:manifest.layers['safari-manual']},
  thresholds:THRESHOLDS,
  metrics,
  categories:Object.fromEntries(Object.entries(categoryStats).map(([category, value])=>[
    category, {...value, rate:percent(value.pass, value.total)}
  ])),
  gates,
  failures,
  consoleMessages:[...new Set(consoleMessages)]
};
const categoryRows = Object.entries(report.categories)
  .map(([category, item])=>`| ${category} | ${item.pass} | ${item.total} | ${item.rate.toFixed(2)}% |`)
  .join('\n');
const gateRows = gates
  .map(gate=>`| ${gate.name} | ${gate.pass ? 'PASS' : 'FAIL'} | ${markdownCell(gate.actual)} | ${markdownCell(gate.expected)} |`)
  .join('\n');
const failureRows = failures.length
  ? failures.map(item=>`| ${item.id} | ${item.category} | ${markdownCell(item.surface)} | ${item.type} | ${markdownCell(item.expected)} | ${markdownCell(item.actual)} |`).join('\n')
  : '| — | — | — | — | — | — |';
const markdown = `# Language Quality Audit\n\n`
  + `- Result: **${status}**\n`
  + `- Audit version: \`${report.auditVersion}\`\n`
  + `- Corpus version: \`${report.corpusVersion}\`\n`
  + `- Started: ${report.startedAt}\n`
  + `- Duration: ${report.durationMs} ms\n`
  + `- Branch / commit: \`${report.branch}\` / \`${report.commit}\`\n`
  + `- Browser: ${report.browser.name} ${report.browser.version}\n`
  + `- Safari manual: ${report.safariManual.status} (${report.safariManual.cases} cases; not counted as automated PASS)\n\n`
  + `## Metrics\n\n`
  + `- Token total: ${metrics.tokenTotal}\n`
  + `- Target cases located: ${metrics.cases.located}/${metrics.cases.total}\n`
  + `${metricLine('Surface-reading accuracy', metrics.surfaceReading)}\n`
  + `${metricLine('Lemma accuracy', metrics.lemma)}\n`
  + `${metricLine('Part-of-speech accuracy', metrics.partOfSpeech)}\n`
  + `${metricLine('Known offline-Chinese accuracy', metrics.knownChinese)}\n`
  + `${metricLine('JMdict fallback rate', metrics.jmdictFallback)}\n`
  + `${metricLine('Complete-miss rate', metrics.completeMiss)}\n`
  + `${metricLine('JLPT inheritance accuracy', metrics.jlptInheritance)}\n`
  + `- Homophone forbidden matches: ${metrics.homophoneErrors}\n`
  + `- Function-word POS mismatches: ${metrics.functionWordErrors}\n`
  + `- Proper-noun guess errors: ${metrics.properNounGuessErrors}\n`
  + `${metricLine('Known-regression pass rate', metrics.regression)}\n\n`
  + `Lemma and POS denominators include the morphology-bearing categories (basic, verbs, adjectives, function words, ambiguity). Compound/proper/news spans are excluded when they do not represent one lexical token. Chinese coverage and JMdict fallback are reported separately; missing Chinese data is never replaced with fabricated content.\n\n`
  + `## Gates\n\n| Gate | Result | Actual | Required |\n|---|---:|---:|---:|\n${gateRows}\n\n`
  + `## Category results\n\n| Category | Passed cases | Total cases | Rate |\n|---|---:|---:|---:|\n${categoryRows}\n\n`
  + `## Failures\n\n| ID | Category | Surface | Type | Expected | Actual |\n|---|---|---|---|---|---|\n${failureRows}\n`;

await mkdir(outputRoot, {recursive:true});
await writeFile(resolve(outputRoot, 'language-audit-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(resolve(outputRoot, 'language-audit-report.md'), markdown);
process.stdout.write(`Language quality audit: ${status}\n`);
process.stdout.write(`Cases: ${cases.length}; tokens: ${metrics.tokenTotal}; failures: ${failedCaseCount}\n`);
process.stdout.write(`Reading ${metrics.surfaceReading.rate.toFixed(2)}%; lemma ${metrics.lemma.rate.toFixed(2)}%; POS ${metrics.partOfSpeech.rate.toFixed(2)}%; Chinese ${metrics.knownChinese.rate.toFixed(2)}%; JLPT ${metrics.jlptInheritance.rate.toFixed(2)}%\n`);
process.stdout.write(`Report: ${resolve(outputRoot, 'language-audit-report.md')}\n`);
process.stdout.write(`JSON: ${resolve(outputRoot, 'language-audit-report.json')}\n`);
if(status !== 'PASS') process.exitCode = 1;
