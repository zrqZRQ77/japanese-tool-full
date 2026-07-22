#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(SCRIPT_DIR, '..');

function run(label, command, args, options = {}) {
  process.stdout.write(`- ${label}... `);
  try {
    execFileSync(command, args, { cwd: FRONTEND_DIR, stdio: options.stdio || 'pipe' });
    process.stdout.write('ok\n');
    return true;
  } catch (error) {
    process.stdout.write('failed\n');
    if (error.stdout) process.stderr.write(String(error.stdout));
    if (error.stderr) process.stderr.write(String(error.stderr));
    if (options.optional) return false;
    process.exitCode = 1;
    return false;
  }
}

function assertCheck(condition, message) {
  process.stdout.write(`- ${message}... `);
  if (condition) {
    process.stdout.write('ok\n');
    return;
  }
  process.stdout.write('failed\n');
  process.exitCode = 1;
}


function simpleFunctionSource(source, name) {
  return source.match(new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] || '';
}

function cacheVersions(indexHtml) {
  const css = indexHtml.match(/styles\.css\?v=([^"']+)/)?.[1] || '';
  const designSystem = indexHtml.match(/design-system\.css\?v=([^"']+)/)?.[1] || '';
  const grammarLayout = indexHtml.match(/grammar-layout\.css\?v=([^"']+)/)?.[1] || '';
  const typography = indexHtml.match(/typography\.css\?v=([^"']+)/)?.[1] || '';
  const heroMenu = indexHtml.match(/hero-menu-refresh\.css\?v=([^"']+)/)?.[1] || '';
  const lexicalLookup = indexHtml.match(/lexical-lookup\.js\?v=([^"']+)/)?.[1] || '';
  const lexicalRecord = indexHtml.match(/lexical-record\.js\?v=([^"']+)/)?.[1] || '';
  const vocabStore = indexHtml.match(/vocab-store\.js\?v=([^"']+)/)?.[1] || '';
  const vocabList = indexHtml.match(/vocab-list\.js\?v=([^"']+)/)?.[1] || '';
  const vocabReview = indexHtml.match(/vocab-review\.js\?v=([^"']+)/)?.[1] || '';
  const vocabExport = indexHtml.match(/vocab-export\.js\?v=([^"']+)/)?.[1] || '';
  const contentFeed = indexHtml.match(/content-feed\.js\?v=([^"']+)/)?.[1] || '';
  const js = indexHtml.match(/app\.js\?v=([^"']+)/)?.[1] || '';
  const lexicalIntegration = indexHtml.match(/lexical-lookup-integration\.js\?v=([^"']+)/)?.[1] || '';
  const lexicalDetail = indexHtml.match(/lexical-detail-integration\.js\?v=([^"']+)/)?.[1] || '';
  const lexicalVocab = indexHtml.match(/lexical-vocab-integration\.js\?v=([^"']+)/)?.[1] || '';
  return { css, designSystem, grammarLayout, typography, heroMenu, lexicalLookup, lexicalRecord, vocabStore, vocabList, vocabReview, vocabExport, contentFeed, js, lexicalIntegration, lexicalDetail, lexicalVocab };
}

function duplicateIds(indexHtml) {
  const ids = [...indexHtml.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
}

function hardcodedFontSizeLocations(sources) {
  const violations = [];
  for (const [file, source] of sources) {
    source.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(/font-size\s*:\s*([^;]+);/g)) {
        if (/\b\d+(?:\.\d+)?px\b/.test(match[1])) {
          violations.push(`${file}:${index + 1}`);
        }
      }
    });
  }
  return violations;
}

const indexHtml = readFileSync(resolve(FRONTEND_DIR, 'index.html'), 'utf8');
const appJs = readFileSync(resolve(FRONTEND_DIR, 'app.js'), 'utf8');
const analyticsJs = readFileSync(resolve(FRONTEND_DIR, 'analytics.js'), 'utf8');
const configJs = readFileSync(resolve(FRONTEND_DIR, 'config.js'), 'utf8');
const lexicalLookupJs = readFileSync(resolve(FRONTEND_DIR, 'lexical-lookup.js'), 'utf8');
const lexicalRecordJs = readFileSync(resolve(FRONTEND_DIR, 'lexical-record.js'), 'utf8');
const vocabStoreJs = readFileSync(resolve(FRONTEND_DIR, 'vocab-store.js'), 'utf8');
const vocabListJs = readFileSync(resolve(FRONTEND_DIR, 'vocab-list.js'), 'utf8');
const vocabReviewJs = readFileSync(resolve(FRONTEND_DIR, 'vocab-review.js'), 'utf8');
const vocabExportJs = readFileSync(resolve(FRONTEND_DIR, 'vocab-export.js'), 'utf8');
const contentFeedJs = readFileSync(resolve(FRONTEND_DIR, 'content-feed.js'), 'utf8');
const lexicalLookupIntegrationJs = readFileSync(resolve(FRONTEND_DIR, 'lexical-lookup-integration.js'), 'utf8');
const lexicalDetailIntegrationJs = readFileSync(resolve(FRONTEND_DIR, 'lexical-detail-integration.js'), 'utf8');
const lexicalVocabIntegrationJs = readFileSync(resolve(FRONTEND_DIR, 'lexical-vocab-integration.js'), 'utf8');
const mvpStabilityFixesJs = readFileSync(resolve(FRONTEND_DIR, 'mvp-stability-fixes.js'), 'utf8');
const stylesCss = readFileSync(resolve(FRONTEND_DIR, 'styles.css'), 'utf8');
const designSystemCss = readFileSync(resolve(FRONTEND_DIR, 'design-system.css'), 'utf8');
const grammarLayoutCss = readFileSync(resolve(FRONTEND_DIR, 'grammar-layout.css'), 'utf8');
const heroMenuCss = readFileSync(resolve(FRONTEND_DIR, 'hero-menu-refresh.css'), 'utf8');
const kuromojiWorkerPocJs = readFileSync(resolve(FRONTEND_DIR, 'kuromoji-worker-poc.js'), 'utf8');
const kuromojiWorkerJs = readFileSync(resolve(FRONTEND_DIR, 'vendor/kuromoji/20260714-01/kuromoji-tokenizer.worker.js'), 'utf8');
const dictionary = JSON.parse(readFileSync(resolve(FRONTEND_DIR, 'data/dictionary.json'), 'utf8'));
const chineseSupplement = JSON.parse(readFileSync(resolve(FRONTEND_DIR, 'data/chinese-definitions-source.json'), 'utf8'));
const contentFeedFallback = JSON.parse(readFileSync(resolve(FRONTEND_DIR, 'data/content-feed-fallback.json'), 'utf8'));
const inlineSource = `${appJs}\n${lexicalLookupJs}\n${lexicalRecordJs}\n${vocabStoreJs}\n${vocabListJs}\n${vocabReviewJs}\n${vocabExportJs}\n${contentFeedJs}\n${lexicalLookupIntegrationJs}\n${lexicalDetailIntegrationJs}\n${lexicalVocabIntegrationJs}\n${indexHtml}`;
const globalSearchSource = appJs.match(/const GLOBAL_SEARCH_ITEMS = \[[\s\S]*?\n\];/)?.[0] || '';
const { css, designSystem, grammarLayout, typography, heroMenu, lexicalLookup, lexicalRecord, vocabStore, vocabList, vocabReview, vocabExport, contentFeed, js, lexicalIntegration, lexicalDetail, lexicalVocab } = cacheVersions(indexHtml);
const duplicateIdList = duplicateIds(indexHtml);
const hardcodedFontSizes = hardcodedFontSizeLocations([
  ['index.html', indexHtml],
  ['styles.css', stylesCss],
  ['design-system.css', designSystemCss],
  ['grammar-layout.css', grammarLayoutCss]
]);
const requiredFiles = ['styles.css', 'design-system.css', 'grammar-layout.css', 'typography.css', 'lexical-lookup.js', 'lexical-record.js', 'vocab-store.js', 'vocab-list.js', 'vocab-review.js', 'vocab-export.js', 'content-feed.js', 'app.js', 'data/content-feed-fallback.json', 'lexical-lookup-integration.js', 'lexical-detail-integration.js', 'lexical-vocab-integration.js'];
const requiredKuromojiPocFiles = [
  'kuromoji-worker-poc.js',
  'poc/kuromoji-worker-poc.html',
  'vendor/kuromoji/20260714-01/kuromoji-tokenizer.worker.js',
  'vendor/kuromoji/20260714-01/kuromoji.js',
  'vendor/kuromoji/20260714-01/dict/base.dat.gz',
  'vendor/kuromoji/LICENSE-2.0.txt'
];
const requiredFunctions = ['switchWorkspace', 'addCustomGrammarNote', 'removeGrammarNote', 'renderGrammarBook'];
const deduplicatedLexicalFunctionNames = [
  'lookupOfflineChinese',
  'lookupJlptReference',
  'enrichInfoWithJlpt',
  'lookupJmdictCommon',
  'lookupJmdictCommonWithCompoundFallback',
  'autoLookupTokenMeaning',
  'detailInflectionHtml',
  'detailMetaHtml',
  'refreshVisibleTokenDetail',
  'requestTokenVocabSave',
  'addToVocab',
  'addTokenToVocab',
  'addTokenSnapshotToVocab',
  'addCustomToVocab',
  'submitVocabEdit'
];
const duplicateLexicalDefinitionsInApp = deduplicatedLexicalFunctionNames.filter(name =>
  new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(appJs)
);
const lexicalVocabGlobalFunctionNames = [
  'requestTokenVocabSave',
  'addToVocab',
  'addTokenToVocab',
  'addTokenSnapshotToVocab',
  'addCustomToVocab',
  'submitVocabEdit'
];
const vocabModuleFunctionNames = [
  'getAllVocab', 'isDue', 'vocabIdentityKey', 'normalizeVocabItem', 'normalizeVocabList',
  'loadVocab', 'saveVocab', 'isSystemGeneratedMeaning', 'displayVocabMeaning',
  'currentVocabSourceTitle', 'removeFromVocab', 'vocabMasteryKey', 'vocabSourceLabel',
  'clearAllVocab', 'openVocabPanel', 'closeVocabPanel', 'removeVocabIcon',
  'syncVocabPanelData', 'runVocabPrimaryAction', 'vocabMatchesFilter', 'vocabMeaningTone',
  'filteredVocabForPage', 'setVocabFilter', 'setVocabJlptFilter', 'clearVocabFilters',
  'closeVocabFilterMenu', 'closeVocabManagementMenu', 'closeOpenVocabMenus',
  'syncVocabHeaderFilters', 'renderVocabFilterSummary', 'vocabWordMarkup', 'vocabListMarkup',
  'editVocabItem', 'ensureVocabEditDialog', 'openVocabEditDialog', 'closeVocabEditDialog',
  'vocabMasteryLabel', 'syncVocabSourceFilterOptions', 'renderVocab', 'vocabPracticeTag',
  'formatDue', 'updateDueCount', 'getVocabPracticeItems', 'renderVocabPractice',
  'nextVocabPractice', 'prevVocabPractice', 'toggleVocabPracticeAnswer', 'rateVocabPractice',
  'markVocabPracticeKnown', 'getFlashArea', 'setFlashArea', 'updateFlashProgress',
  'openVocabReviewPanel', 'exitFlashcards', 'prepareVocabReview', 'startReview',
  'reviewAllVocab', 'showNextCard', 'renderCard', 'flipCard', 'handleFlashCardKey',
  'rateCard', 'downloadTextFile', 'todayStamp', 'exportDateTime', 'setInlineStatus',
  'setVocabExportStatus', 'runVocabExportSelect', 'exportVocabCsv', 'exportVocabCsvFile',
  'exportAnkiTsv'
];
const vocabImplementationSources = [appJs, vocabStoreJs, vocabListJs, vocabReviewJs, vocabExportJs];
const invalidVocabFunctionCounts = vocabModuleFunctionNames
  .map(name => ({
    name,
    count:vocabImplementationSources.reduce((total, source) =>
      total + (source.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`, 'g')) || []).length,
    0)
  }))
  .filter(item => item.count !== 1);
const levelHelpersSource = [
  simpleFunctionSource(appJs, 'normalizeVisibleVocabLevel'),
  simpleFunctionSource(appJs, 'formatVisibleVocabLevel')
].join('\n');
let levelHelpers = null;
try {
  levelHelpers = Function(`${levelHelpersSource}; return { normalizeVisibleVocabLevel, formatVisibleVocabLevel };`)();
} catch {}
const internalLevelSamples = ['kuromoji', 'worker', 'tokenizer', 'fallback', 'particle', 'trap', '已识别词', '待整理'];
const validJlptSamples = ['N5', 'N4', 'N3', 'N2', 'N1'];

run('app.js syntax', 'node', ['--check', 'app.js']);
run('lexical lookup syntax', 'node', ['--check', 'lexical-lookup.js']);
run('lexical record syntax', 'node', ['--check', 'lexical-record.js']);
run('vocabulary store syntax', 'node', ['--check', 'vocab-store.js']);
run('vocabulary list syntax', 'node', ['--check', 'vocab-list.js']);
run('vocabulary review syntax', 'node', ['--check', 'vocab-review.js']);
run('vocabulary export syntax', 'node', ['--check', 'vocab-export.js']);
run('content feed syntax', 'node', ['--check', 'content-feed.js']);
run('content feed browser test syntax', 'node', ['--check', 'tools/content-feed-browser.test.mjs']);
run('lexical lookup integration syntax', 'node', ['--check', 'lexical-lookup-integration.js']);
run('lexical detail integration syntax', 'node', ['--check', 'lexical-detail-integration.js']);
run('lexical vocab integration syntax', 'node', ['--check', 'lexical-vocab-integration.js']);
run('vocabulary persistence browser test syntax', 'node', ['--check', 'tools/vocab-persistence-browser.test.mjs']);
run('vocabulary export browser test syntax', 'node', ['--check', 'tools/vocab-export-browser.test.mjs']);
run('git whitespace diff', 'git', ['diff', '--check'], { optional: true });

assertCheck(!/\b(?:alert|confirm)\s*\(/.test(inlineSource), 'no native alert() / confirm() in app.js or index.html');
assertCheck(!/(?:上传 PDF|选择的 PDF|pdfModeSelect|pdfCleanupSelect|排版方向|网页打印\/导出的PDF)/i.test(indexHtml), 'public HTML does not expose withdrawn PDF controls or copy');
assertCheck(requiredFiles.every(file => existsSync(resolve(FRONTEND_DIR, file))), 'required frontend files exist');
assertCheck(indexHtml.includes('contentFeedSection') && contentFeedJs.includes('CONTENT_FEED_BASE_URL') && contentFeedJs.includes('openContentFeedQueueItem'), 'content feed UI, remote adapter, and queue bridge are wired');
assertCheck(contentFeedFallback.schemaVersion === 1 && Array.isArray(contentFeedFallback.items) && contentFeedFallback.items.length >= 3, 'bundled content feed fallback is valid');
assertCheck(!/(editorial|internalNotes|reviewedBy)/.test(JSON.stringify(contentFeedFallback)), 'bundled content feed fallback excludes internal editorial fields');
assertCheck(duplicateIdList.length === 0, `HTML ids are unique${duplicateIdList.length ? `: ${duplicateIdList.join(', ')}` : ''}`);
assertCheck(requiredFunctions.every(name => new RegExp(`function\\s+${name}\\s*\\(`).test(appJs)), 'required app functions exist');
assertCheck(
  indexHtml.indexOf('lexical-record.js') < indexHtml.indexOf('vocab-store.js')
    && indexHtml.indexOf('vocab-store.js') < indexHtml.indexOf('vocab-list.js')
    && indexHtml.indexOf('vocab-list.js') < indexHtml.indexOf('vocab-review.js')
    && indexHtml.indexOf('vocab-review.js') < indexHtml.indexOf('vocab-export.js')
    && indexHtml.indexOf('vocab-export.js') < indexHtml.indexOf('content-feed.js')
    && indexHtml.indexOf('content-feed.js') < indexHtml.indexOf('app.js')
    && indexHtml.indexOf('app.js') < indexHtml.indexOf('lexical-vocab-integration.js'),
  'vocabulary module scaffolds load in the planned ordinary-script order'
);
assertCheck(
  invalidVocabFunctionCounts.length === 0,
  `vocabulary functions have one implementation source${invalidVocabFunctionCounts.length ? `: ${invalidVocabFunctionCounts.map(item => `${item.name}=${item.count}`).join(', ')}` : ''}`
);
assertCheck(
  /const SRS_STEPS_MIN = \[1, 10, 30, 120, 720, 1440, 4320, 10080, 20160\]/.test(vocabReviewJs)
    && /function rateVocabPractice\(rating\)[\s\S]*?SRS_STEPS_MIN/.test(vocabReviewJs)
    && /function rateCard\(rating\)[\s\S]*?SRS_STEPS_MIN/.test(vocabReviewJs)
    && ['currentVocabPracticeIndex', 'vocabPracticeAnswerVisible', 'reviewQueue', 'currentCardWord', 'cardFlipped', 'reviewInitialCount'].every(name =>
      new RegExp(`let\\s+${name}\\b`).test(vocabReviewJs) && !new RegExp(`let\\s+${name}\\b`).test(appJs)
    )
    && !/const SRS_STEPS_MIN\b/.test(appJs),
  'vocabulary practice and flashcards share one review state and SRS schedule'
);
assertCheck(
  duplicateLexicalDefinitionsInApp.length === 0,
  `lexical integration functions have one implementation source${duplicateLexicalDefinitionsInApp.length ? `: ${duplicateLexicalDefinitionsInApp.join(', ')}` : ''}`
);
assertCheck(
  lexicalVocabGlobalFunctionNames.every(name =>
    new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(lexicalVocabIntegrationJs)
  )
    && indexHtml.indexOf('app.js') < indexHtml.indexOf('lexical-vocab-integration.js')
    && indexHtml.includes("onclick=\"addCustomToVocab('食べる'")
    && vocabListJs.includes('onsubmit=\"submitVocabEdit(event)\"'),
  'vocabulary inline actions resolve from lexical vocab integration globals'
);
assertCheck(
  levelHelpers
    && validJlptSamples.every(level => levelHelpers.normalizeVisibleVocabLevel(level) === level)
    && internalLevelSamples.every(level => levelHelpers.normalizeVisibleVocabLevel(level) === '')
    && internalLevelSamples.every(level => levelHelpers.formatVisibleVocabLevel(level) === '暂无参考等级'),
  'visible vocabulary level formatter preserves JLPT values and hides internal metadata'
);
assertCheck(
  !/level\s*:\s*['"](?:kuromoji|worker|tokenizer|fallback)['"]/.test(appJs)
    && /function fallbackTokenInfo\(surface\)[\s\S]*?level:''[\s\S]*?source:'fallback'/.test(appJs)
    && /function getTokenInfo\(token\)[\s\S]*?level:''[\s\S]*?source:'kuromoji'/.test(appJs)
    && /function tokenSnapshotValue\(surface, info, tokenRecord = null\)[\s\S]*?level:normalizeVisibleVocabLevel\(info\?\.level\)/.test(inlineSource),
  'tokenizer metadata stays in source fields instead of vocabulary level fields'
);
assertCheck(
  /function normalizeVocabItem\(item = \{\}\)[\s\S]*?normalizeLexicalVocabFields\(item\)[\s\S]*?levelSource:level \? String\(item\.levelSource \|\| 'legacy'\) : ''/.test(vocabStoreJs)
    && /async function loadVocab\(\)[\s\S]*?const rawSnapshot = JSON\.stringify\(vocabData\);[\s\S]*?if\(JSON\.stringify\(vocabData\) !== rawSnapshot\) saveVocab\(\)/.test(vocabStoreJs)
    && lexicalRecordJs.includes('function normalizeLexicalVocabFields')
    && lexicalVocabIntegrationJs.includes("function addCustomToVocab(word, reading = '', meaning = '用户添加', level = ''"),
  'legacy vocabulary and levels migrate to the unified lexical record and persist after loading'
);
assertCheck(
  appJs.includes("const LEARNING_DATA_VERSION = '20260717'")
    && lexicalLookupJs.includes('function buildLexicalLookupPlan')
    && lexicalLookupIntegrationJs.includes('async function lookupOfflineChinese')
    && lexicalLookupIntegrationJs.includes('async function lookupJlptReference')
    && appJs.includes('buildCuratedLexicalLookupPlan(word, info)')
    && !appJs.includes('enrichInfoWithJlpt([word, info.reading], info)')
    && /async function autoLookupTokenMeaning[\s\S]*?buildLexicalLookupPlan\(lexicalAnalysis[\s\S]*?lookupOfflineChinese\(lookupPlan, surface\)[\s\S]*?lookupJmdictCommonWithCompoundFallback\(lookupPlan, surface\)/.test(lexicalLookupIntegrationJs)
    && appJs.includes('释义来源：Yomeru 离线中文词库')
    && appJs.includes('JLPT 参考等级：')
    && indexHtml.includes('data-level="ungraded"'),
  'offline Chinese meanings, reference levels, and JMdict share one lexical lookup plan'
);
assertCheck(
  ['exactSurface', 'lemma', 'compound', 'reading', 'fallback'].every(kind=>lexicalLookupJs.includes(`'${kind}'`))
    && lexicalLookupJs.includes('allowReadingMatch:true')
    && lexicalLookupJs.includes('requirePosMatch:true')
    && /add\(analysis\.surfaceReading, 'reading'[\s\S]*?allowJlpt:false[\s\S]*?allowReadingMatch:true/.test(lexicalLookupJs)
    && indexHtml.indexOf('lexical-lookup.js') < indexHtml.indexOf('app.js')
    && indexHtml.indexOf('app.js') < indexHtml.indexOf('lexical-lookup-integration.js'),
  'lexical lookup candidates keep typed priority, source permissions, POS safeguards, and load order'
);
assertCheck(
  ['baseForm', 'baseReading', 'partOfSpeech', 'conjugationForm', 'lookupMatchedTerm', 'lookupMatchedKind'].every(field=>lexicalRecordJs.includes(field))
    && lexicalRecordJs.includes('function buildLexicalDetailRecord')
    && lexicalRecordJs.includes('function normalizeLexicalVocabFields')
    && lexicalDetailIntegrationJs.includes('function detailMetaHtml')
    && lexicalVocabIntegrationJs.includes('lexicalVocabMetadata(surface, info, tokenRecord)')
    && lexicalLookupIntegrationJs.includes('function recordLexicalLookupMatch')
    && indexHtml.indexOf('lexical-record.js') < indexHtml.indexOf('app.js')
    && indexHtml.indexOf('lexical-lookup-integration.js') < indexHtml.indexOf('lexical-detail-integration.js')
    && indexHtml.indexOf('lexical-detail-integration.js') < indexHtml.indexOf('lexical-vocab-integration.js'),
  'details, vocabulary saves, lookup matches, and legacy migration share one lexical record'
);
assertCheck(
  /meaningLanguage:[\s\S]*?meaningSource:[\s\S]*?levelSource:/.test(inlineSource)
    && /VOCAB_EDIT_TARGET\.meaningSource = 'manual'/.test(lexicalVocabIntegrationJs)
    && vocabExportJs.includes('参考等级,等级来源')
    && indexHtml.includes('暂无参考等级</button>'),
  'vocabulary metadata, manual edits, ungraded filter, and reference-level export labels stay consistent'
);
assertCheck(
  /function exportVocabCsvFile\(\)[\s\S]*?formatVisibleVocabLevel\(v\.level\)/.test(vocabExportJs)
    && /function exportAnkiTsv\(\)[\s\S]*?formatVisibleVocabLevel\(v\.level\)/.test(vocabExportJs)
    && vocabExportJs.includes('单词,假名,释义,释义语言,释义来源,词性,参考等级,等级来源,来源,来源链接,复习状态,下次复习时间（按复习结果自动安排）')
    && vocabExportJs.includes('# 正面\\t假名\\t释义\\t释义语言\\t释义来源\\t词性\\t参考等级\\t等级来源\\t来源\\t来源链接')
    && vocabExportJs.includes('读得懂_生词本导出.csv')
    && vocabExportJs.includes('dokedo-anki-${todayStamp()}.tsv')
    && appJs.includes('function exportLearningBackup')
    && appJs.includes('async function importLearningBackup')
    && !vocabExportJs.includes('function exportLearningBackup')
    && !vocabExportJs.includes('function importLearningBackup'),
  'CSV and Anki exports preserve formats while complete backup stays in app.js'
);
assertCheck(
  /function requestTokenVocabSave\(tokenId\)[\s\S]*?info\.pendingVocabSave = true[\s\S]*?释义加载完成后会自动加入生词本/.test(lexicalVocabIntegrationJs)
    && /function finishPendingTokenVocabSave\(tokenId, tokenRecord\)[\s\S]*?requestTokenVocabSave\(tokenId\)/.test(appJs)
    && /async function autoLookupTokenMeaning[\s\S]*?info\.lookupState = 'ready'[\s\S]*?finishPendingTokenVocabSave\(tokenId, tokenRecord\)/.test(lexicalLookupIntegrationJs)
    && /info\.meaning = '释义待补充'[\s\S]*?info\.lookupState = 'failed'/.test(lexicalLookupIntegrationJs),
  'dictionary lookup supports queued saving and safe failed-lookup placeholders'
);
assertCheck(
  /词典来源：<a[\s\S]*?>JMdict<\/a>/.test(appJs)
    && /aria-label="JMdict，由 EDRDG 维护"/.test(appJs)
    && !/>JMdict \/ EDRDG<\//.test(appJs),
  'dictionary attribution stays available without dominating the word detail'
);
assertCheck(
  globalSearchSource.includes("label:'开始阅读'")
    && globalSearchSource.includes("label:'整理生词本'")
    && globalSearchSource.includes("label:'备份数据'")
    && !/(?:语法本|水平测试|学习历史|找阅读材料|句型打字|文章理解练习)/.test(globalSearchSource),
  'global search matches reduced public MVP navigation'
);
assertCheck(
  !indexHtml.includes('句子翻译')
    && /id="translationToggleBtn"[^>]*hidden[^>]*data-mvp-hidden="translation"/.test(indexHtml),
  'translation promotion and reader translation control are not public'
);
assertCheck(
  !indexHtml.includes('hero-more-menu')
    && !indexHtml.includes('使用说明')
    && !indexHtml.includes('onclick="openOnboarding()"'),
  'homepage more menu and obsolete onboarding entries are not public'
);
assertCheck(
  ['grammar', 'retell', 'discover', 'history'].every(view => new RegExp(`data-view="${view}"[^>]*hidden[^>]*data-mvp-hidden`).test(indexHtml))
    && /class="mvp-settings-button"[^>]*data-view="settings"[^>]*hidden[^>]*data-mvp-hidden="floating-settings"/.test(indexHtml)
    && /class="sidebar-footer"[\s\S]*?data-view="settings"/.test(indexHtml)
    && /class="nav-item menu-settings-entry"[^>]*data-view="settings"/.test(indexHtml),
  'only reading and vocabulary remain in primary navigation and settings is low frequency'
);
assertCheck(
  (indexHtml.match(/onclick="loadSample\('(life|story|news)'\)"/g) || []).length === 3
    && !/(?:三菱|株式|時価総額|金融機関)/.test(indexHtml),
  'public examples are limited to three basic non-financial texts'
);
assertCheck(
  /async function loadSample\([\s\S]*?await analyzeSourceInput\(\{inputSource:'sample'\}\)/.test(appJs),
  'examples use the same analysis entry point as pasted text'
);
assertCheck(
  configJs.includes("GA_MEASUREMENT_ID: 'G-E2DE3HE7E7'")
    && analyticsJs.includes("window.location.hostname === 'yomeru.japanese-hub.com'")
    && analyticsJs.includes("query.get('analytics_debug') === '1'")
    && analyticsJs.includes('debug_mode:debugMode')
    && !indexHtml.includes('googletagmanager.com/gtag/js'),
  'GA4 reuses the centralized Japanese Hub ID and stays opt-in outside production'
);
assertCheck(
  ['app_ready', 'tokenizer_ready', 'reading_start', 'reading_generate_success', 'reading_generate_error', 'furigana_edit_start', 'furigana_edit_save', 'vocab_save', 'export_open', 'export_complete', 'export_error', 'tts_preview', 'feedback_open']
    .every(eventName=>analyticsJs.includes(`${eventName}:`))
    && analyticsJs.includes("/^[a-z0-9_-]{1,48}$/i")
    && !/(?:article_text|article_content|word|meaning|email)\s*:/.test(analyticsJs),
  'analytics events use a strict privacy-safe event and parameter allowlist'
);
assertCheck(
  configJs.includes("FEEDBACK_FORM_URL: 'https://h5xjhwnvwx.feishu.cn/share/base/form/shrcnqw8wZCF6xoGwYTbbn9MhUg'")
    && /id="feedbackSettingsSection" hidden/.test(indexHtml)
    && /id="feedbackFormLink"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/.test(indexHtml)
    && appJs.includes("trackAnalyticsEvent('feedback_open', {entry_location:'settings'})"),
  'feedback settings entry stays hidden until a valid configured URL is present'
);
assertCheck(
  !indexHtml.includes('pptxgen.bundle.js')
    && /async function downloadRubyPptx[\s\S]*?loadExternalScript\(THIRD_PARTY_SCRIPTS\.pptx, 'PptxGenJS'\)/.test(appJs)
    && appJs.includes('function scheduleLearningDataHydration')
    && appJs.includes("recordPerformanceMark('app_shell_visible')")
    && appJs.includes("recordPerformanceMark('hero_interactive')")
    && appJs.includes("recordPerformanceMark('tokenizer_load_start')")
    && appJs.includes("recordPerformanceMark('tokenizer_worker_ready')")
    && appJs.includes("recordPerformanceMark('dictionary_ready')")
    && appJs.includes("recordPerformanceMark('reading_ready')"),
  'first paint avoids PPT code and records the required staged performance marks'
);
assertCheck(appJs.includes('const ENABLE_REMOTE_SMART_SEGMENTATION = false;'), 'remote smart segmentation remains disabled');
assertCheck(
  requiredKuromojiPocFiles.every(file => existsSync(resolve(FRONTEND_DIR, file)))
    && kuromojiWorkerPocJs.includes('const ENABLE_KUROMOJI_WORKER_POC = false;')
    && kuromojiWorkerJs.includes("importScripts(KUROMOJI_SCRIPT_URL)")
    && appJs.includes('const ENABLE_LOCAL_KUROMOJI_WORKER = true;')
    && indexHtml.includes('src="kuromoji-worker-poc.js?v=')
    && !indexHtml.includes('cdn.jsdelivr.net/npm/kuromoji@')
    && !indexHtml.includes('poc/kuromoji-worker-poc.html'),
  'local Kuromoji Worker is integrated without exposing the PoC page or main-thread CDN runtime'
);
assertCheck(
  /class="engine-status" id="tokenizerStatus"[^>]*role="status"/.test(indexHtml)
    && !/class="reading-hidden-controls"[\s\S]*?id="tokenizerStatus"/.test(indexHtml),
  'furigana progress status is visible and not stored in hidden controls'
);
assertCheck(
  appJs.includes('function scheduleLocalKuromojiPrewarm')
    && appJs.includes('window.YOMERU_TOKENIZER_METRICS')
    && appJs.includes('首次使用正在加载本地日语词典'),
  'furigana flow prewarms locally, exposes progress, and records performance metrics'
);
assertCheck(
  /const maxAttempts = 2;/.test(appJs)
    && appJs.includes('首次加载未完成，正在自动重试……')
    && appJs.includes('假名生成没有完成，请点击重新生成。')
    && !appJs.includes('showFallbackNotice()'),
  'Safari cold-start analysis retries once before showing one final error'
);
assertCheck(
  /function isAuxiliaryMasuToken/.test(appJs)
    && appJs.includes("meaning:'礼貌助动词，用于构成动词的礼貌表达'")
    && /source:'grammar-function'/.test(appJs)
    && /const exactEntry = dictionaryEntryFor\(surface\);[\s\S]*?if\(exactEntry \|\| shouldMergePoliteVerbTokens\(parts\)\)/.test(appJs),
  'auxiliary ます bypasses homophone dictionary metadata while polite verbs remain merged'
);
assertCheck(
  /function\s+resetLevelTest\s*\(\)[\s\S]*?safeStorage\.removeItem\('reading_level_result'\)/.test(appJs)
    && !/function\s+resetLevelTest\s*\(\)[\s\S]*?localStorage\.removeItem\('reading_level_result'\)/.test(appJs),
  'level-test reset uses safe storage'
);
assertCheck(!/\blocalStorage\./.test(indexHtml), 'inline page logic uses safe storage');
assertCheck(appJs.includes("dataset.tokenizerMode = 'built-in'"), 'reading flow exposes tokenizer mode');
assertCheck(
  appJs.includes(".split(/\\n+/)") && appJs.includes(".join('\\n\\n');"),
  'pasted single line breaks remain paragraph boundaries'
);
assertCheck(
  /function\s+addParagraphTranslations[\s\S]*?parts\.map\([\s\S]*?reading-translation-pair/.test(appJs),
  'reading output renders preserved paragraphs as separate blocks'
);
assertCheck(
  appJs.includes("new Intl.Segmenter('ja', {granularity:'word'})")
    && /window\.KUROMOJI_TOKEN_CACHE\[tokenId\][\s\S]*?showTokenDetail/.test(appJs),
  'unknown Japanese words remain clickable and saveable'
);
assertCheck(
  /async function collectExportRubyUnits\(\)[\s\S]*?if\(!raw \|\| !ENABLE_REMOTE_SMART_SEGMENTATION\) return fallback;[\s\S]*?await initKuromoji\(\)/.test(appJs),
  'reading export respects the remote-tokenizer safety switch'
);
assertCheck(
  /function escapeHtml\(str\)[\s\S]*?&quot;[\s\S]*?&#39;/.test(appJs),
  'HTML escaping covers quoted attribute values'
);
assertCheck(
  /async function restoreHistoryArticle\(id\)[\s\S]*?await renderText\(\)/.test(appJs)
    && !/function restoreHistoryArticle\(id\)[\s\S]*?innerHTML\s*=\s*item\.annotatedHtml/.test(appJs),
  'reading history is regenerated from plain text instead of stored HTML'
);
assertCheck(
  /function normalizeReadingHistoryItem\(item = \{\}, index = 0\)[\s\S]*?const url = readingQueueUrl\(item\.url\);[\s\S]*?\n\s*url,/.test(appJs),
  'reading history URLs use the HTTP(S) allowlist'
);
assertCheck(indexHtml.includes('导出为可在 Anki 中导入的 TSV 文件') && !indexHtml.includes('一键导出Anki牌组'), 'Anki copy matches TSV export');
assertCheck(
  ['pptx', 'png', 'jpeg'].every(format => indexHtml.includes(`<option value="${format}"`))
    && !/downloadRubyDocx|<option value=["']docx["']/.test(inlineSource),
  'reading export formats match the public MVP boundary'
);
assertCheck(
  mvpStabilityFixesJs.includes("portraitOption.hidden = portraitPptUnavailable")
    && mvpStabilityFixesJs.includes("portraitOption.disabled = portraitPptUnavailable")
    && mvpStabilityFixesJs.includes("layoutSelect.value = 'landscape'")
    && mvpStabilityFixesJs.includes("wrapExportFunction('runExport', true)")
    && indexHtml.includes('PPTX（可编辑）')
    && indexHtml.includes('<option value="portrait">竖版</option>'),
  'portrait layout stays available for images but is blocked for editable PPTX'
);
assertCheck(
  !indexHtml.includes('点击正文中的词语，可以查看读音、释义并加入生词本。')
    && !indexHtml.includes('完成阅读后，可以用这篇文章生成练习。'),
  'reading page omits redundant fixed helper copy'
);
assertCheck(
  indexHtml.includes('class="hero-home-name">読める</span>')
    && !indexHtml.includes('假名课件生成')
    && ['假名标注', '课件导出', '保存生词'].every(title => indexHtml.includes(`<h2 class="home-feature-title">${title}</h2>`))
    && !indexHtml.includes('<h2 class="home-feature-title">点击查词</h2>')
    && (indexHtml.match(/class="hero-flow-item home-feature/g) || []).length === 3,
  'homepage uses the compact brand lockup and three vertically stacked feature sections'
);
assertCheck(
  /function collectRubyUnits\(\)[\s\S]*?\.reading-translation-pair \.reading-japanese/.test(appJs)
    && /if\(current\.length\) rows\.push\(current\)/.test(appJs)
    && appJs.includes('const lineX = outerMarginX;'),
  'editable PPT export ignores layout whitespace, packs rows, and starts at the upper-left content edge'
);
assertCheck(
  ['主要', '出願', '産学連携', '国際競争力', '知財戦略'].every(word => dictionary[word]?.meaning),
  'article vocabulary has local Chinese meanings for the reported gaps'
);
assertCheck(
  ['寝る', '無償'].every(word => chineseSupplement.entries?.[word]?.meaning)
    && lexicalLookupIntegrationJs.includes('这是专有名词，离线词库暂未收录可靠释义；不会根据名称猜测含义。'),
  'new Chinese coverage and safe proper-noun miss guidance are present'
);
assertCheck(
  /function normalizeLexicalAnalysis/.test(appJs)
    && /function analyzeLexicalToken/.test(appJs)
    && /function mergeLexicalTokens/.test(appJs)
    && /reading:lexicalAnalysis\.surfaceReading \|\| dictInfo\.reading/.test(appJs)
    && /basic_form:lexicalValue\(parts\[0\]\.basic_form\)/.test(appJs),
  'inflected surface readings stay separate from dictionary base-form lookup and level inheritance'
);
assertCheck(
  appJs.includes('const DEFAULT_TTS_RATE = 0.94;')
    && appJs.includes('let CURRENT_TTS_UTTERANCE = null;')
    && appJs.includes('function splitJapaneseSpeechChunks')
    && /CURRENT_TTS_UTTERANCE = utterance[\s\S]*?window\.speechSynthesis\.speak\(utterance\)/.test(appJs)
    && /function sortedJapaneseVoices\(strictJapanese = isIOSWebKit\(\)\)[\s\S]*?voices\.filter\(voice=>\/\^ja/.test(appJs)
    && /function uniqueSpeechVoices\(voices = \[\]\)/.test(appJs)
    && /setTimeout\(\(\)=>speakCurrentTtsChunk\(session, true\), 80\)/.test(appJs),
  'TTS retains utterances, chunks long text, prefers Japanese voices on iOS, and retries with the system voice'
);
assertCheck(
  indexHtml.includes('id="ttsRateCurrentLabel">自然速度</span>')
    && indexHtml.includes('id="ttsVoiceCurrentLabel"')
    && indexHtml.includes("currentLabel.textContent = selectedOption.textContent")
    && !indexHtml.includes('自然速度（-6%）')
    && !indexHtml.includes('优先使用 Microsoft Andrew Multilingual')
    && /settings-choice-menu\s*\{[\s\S]*?width:\s*240px/.test(heroMenuCss)
    && /settings-choice-menu--voice\s*\{[\s\S]*?width:\s*240px/.test(heroMenuCss)
    && /settings-tts-controls[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/.test(heroMenuCss)
    && /@media \(max-width: 480px\)[\s\S]*?settings-tts-controls[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/.test(heroMenuCss),
  'TTS setting summaries are concise and both dropdowns share one responsive width'
);
assertCheck(
  indexHtml.includes('settings-action-item--restore')
    && indexHtml.includes('settings-action-item--danger')
    && indexHtml.includes('恢复会覆盖当前学习数据。')
    && indexHtml.includes('将删除当前浏览器中的全部学习数据，且无法撤销。')
    && !designSystem.includes('--settings-warning')
    && !/255,\s*252,\s*247|255,\s*245,\s*243/.test(designSystem)
    && heroMenuCss.includes('font-family: var(--type-font-ui-zh) !important;')
    && heroMenuCss.includes('.settings-action-item--danger'),
  'settings copy, typography, restore styling, and destructive styling follow the shared design system'
);
assertCheck(hardcodedFontSizes.length === 0, `no hardcoded px font sizes outside typography.css${hardcodedFontSizes.length ? `: ${hardcodedFontSizes.join(', ')}` : ''}`);
assertCheck(css && designSystem && grammarLayout && typography && heroMenu && lexicalLookup && lexicalRecord && vocabStore && vocabList && vocabReview && vocabExport && contentFeed && js && lexicalIntegration && lexicalDetail && lexicalVocab && css === designSystem && css === grammarLayout && css === typography && css === heroMenu && css === lexicalLookup && css === lexicalRecord && css === vocabStore && css === vocabList && css === vocabReview && css === vocabExport && css === contentFeed && css === js && css === lexicalIntegration && css === lexicalDetail && css === lexicalVocab, 'CSS and JS cache versions match');
assertCheck(/^\d{8}-\d{2}$/.test(css), 'cache version format is YYYYMMDD-NN');

if (process.exitCode) {
  process.stderr.write('\nMaintenance checks failed.\n');
} else {
  process.stdout.write('\nAll maintenance checks passed.\n');
}
