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
  const js = indexHtml.match(/app\.js\?v=([^"']+)/)?.[1] || '';
  const lexicalIntegration = indexHtml.match(/lexical-lookup-integration\.js\?v=([^"']+)/)?.[1] || '';
  return { css, designSystem, grammarLayout, typography, heroMenu, lexicalLookup, js, lexicalIntegration };
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
const lexicalLookupJs = readFileSync(resolve(FRONTEND_DIR, 'lexical-lookup.js'), 'utf8');
const lexicalLookupIntegrationJs = readFileSync(resolve(FRONTEND_DIR, 'lexical-lookup-integration.js'), 'utf8');
const stylesCss = readFileSync(resolve(FRONTEND_DIR, 'styles.css'), 'utf8');
const designSystemCss = readFileSync(resolve(FRONTEND_DIR, 'design-system.css'), 'utf8');
const grammarLayoutCss = readFileSync(resolve(FRONTEND_DIR, 'grammar-layout.css'), 'utf8');
const heroMenuCss = readFileSync(resolve(FRONTEND_DIR, 'hero-menu-refresh.css'), 'utf8');
const kuromojiWorkerPocJs = readFileSync(resolve(FRONTEND_DIR, 'kuromoji-worker-poc.js'), 'utf8');
const kuromojiWorkerJs = readFileSync(resolve(FRONTEND_DIR, 'vendor/kuromoji/20260714-01/kuromoji-tokenizer.worker.js'), 'utf8');
const dictionary = JSON.parse(readFileSync(resolve(FRONTEND_DIR, 'data/dictionary.json'), 'utf8'));
const chineseSupplement = JSON.parse(readFileSync(resolve(FRONTEND_DIR, 'data/chinese-definitions-source.json'), 'utf8'));
const inlineSource = `${appJs}\n${lexicalLookupJs}\n${lexicalLookupIntegrationJs}\n${indexHtml}`;
const globalSearchSource = appJs.match(/const GLOBAL_SEARCH_ITEMS = \[[\s\S]*?\n\];/)?.[0] || '';
const { css, designSystem, grammarLayout, typography, heroMenu, lexicalLookup, js, lexicalIntegration } = cacheVersions(indexHtml);
const duplicateIdList = duplicateIds(indexHtml);
const hardcodedFontSizes = hardcodedFontSizeLocations([
  ['index.html', indexHtml],
  ['styles.css', stylesCss],
  ['design-system.css', designSystemCss],
  ['grammar-layout.css', grammarLayoutCss]
]);
const requiredFiles = ['styles.css', 'design-system.css', 'grammar-layout.css', 'typography.css', 'lexical-lookup.js', 'app.js', 'lexical-lookup-integration.js'];
const requiredKuromojiPocFiles = [
  'kuromoji-worker-poc.js',
  'poc/kuromoji-worker-poc.html',
  'vendor/kuromoji/20260714-01/kuromoji-tokenizer.worker.js',
  'vendor/kuromoji/20260714-01/kuromoji.js',
  'vendor/kuromoji/20260714-01/dict/base.dat.gz',
  'vendor/kuromoji/LICENSE-2.0.txt'
];
const requiredFunctions = ['switchWorkspace', 'addCustomGrammarNote', 'removeGrammarNote', 'renderGrammarBook'];
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
run('lexical lookup integration syntax', 'node', ['--check', 'lexical-lookup-integration.js']);
run('git whitespace diff', 'git', ['diff', '--check'], { optional: true });

assertCheck(!/\b(?:alert|confirm)\s*\(/.test(inlineSource), 'no native alert() / confirm() in app.js or index.html');
assertCheck(!/(?:上传 PDF|选择的 PDF|pdfModeSelect|pdfCleanupSelect|排版方向|网页打印\/导出的PDF)/i.test(indexHtml), 'public HTML does not expose withdrawn PDF controls or copy');
assertCheck(requiredFiles.every(file => existsSync(resolve(FRONTEND_DIR, file))), 'required frontend files exist');
assertCheck(duplicateIdList.length === 0, `HTML ids are unique${duplicateIdList.length ? `: ${duplicateIdList.join(', ')}` : ''}`);
assertCheck(requiredFunctions.every(name => new RegExp(`function\\s+${name}\\s*\\(`).test(appJs)), 'required app functions exist');
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
    && /function tokenSnapshotValue\(surface, info\)[\s\S]*?level:normalizeVisibleVocabLevel\(info\?\.level\)/.test(appJs),
  'tokenizer metadata stays in source fields instead of vocabulary level fields'
);
assertCheck(
  /function normalizeVocabItem\(item = \{\}\)[\s\S]*?const level = normalizeVisibleVocabLevel\(item\.level\)[\s\S]*?levelSource:level \? String\(item\.levelSource \|\| 'legacy'\) : ''/.test(appJs)
    && /async function loadVocab\(\)[\s\S]*?const rawSnapshot = JSON\.stringify\(vocabData\);[\s\S]*?if\(JSON\.stringify\(vocabData\) !== rawSnapshot\) saveVocab\(\)/.test(appJs)
    && /function addCustomToVocab\(word, reading = '', meaning = '用户添加', level = ''/.test(appJs),
  'legacy vocabulary levels migrate to the ungraded state and persist after loading'
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
  /meaningLanguage:[\s\S]*?meaningSource:[\s\S]*?levelSource:/.test(appJs)
    && /VOCAB_EDIT_TARGET\.meaningSource = 'manual'/.test(appJs)
    && appJs.includes('参考等级,等级来源')
    && indexHtml.includes('暂无参考等级</button>'),
  'vocabulary metadata, manual edits, ungraded filter, and reference-level export labels stay consistent'
);
assertCheck(
  /function exportVocabCsvFile\(\)[\s\S]*?formatVisibleVocabLevel\(v\.level\)/.test(appJs)
    && /function exportAnkiTsv\(\)[\s\S]*?formatVisibleVocabLevel\(v\.level\)/.test(appJs),
  'CSV and Anki exports use user-visible vocabulary levels'
);
assertCheck(
  /function requestTokenVocabSave\(tokenId\)[\s\S]*?info\.pendingVocabSave = true[\s\S]*?释义加载完成后会自动加入生词本/.test(appJs)
    && /function finishPendingTokenVocabSave\(tokenId, tokenRecord\)[\s\S]*?requestTokenVocabSave\(tokenId\)/.test(appJs)
    && /async function autoLookupTokenMeaning[\s\S]*?info\.lookupState = 'ready'[\s\S]*?finishPendingTokenVocabSave\(tokenId, tokenRecord\)/.test(appJs)
    && /info\.meaning = '释义待补充'[\s\S]*?info\.lookupState = 'failed'/.test(appJs),
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
  /async function loadSample\([\s\S]*?await analyzeSourceInput\(\)/.test(appJs),
  'examples use the same analysis entry point as pasted text'
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
  indexHtml.includes('点击正文中的词语，可以查看读音、释义并加入生词本。')
    && !indexHtml.includes('完成阅读后，可以用这篇文章生成练习。'),
  'reader guidance describes the available word-detail and vocabulary actions'
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
    && appJs.includes('这是专有名词，离线词库暂未收录可靠释义；不会根据名称猜测含义。'),
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
  indexHtml.includes('id="ttsRateCurrentLabel"')
    && indexHtml.includes('id="ttsVoiceCurrentLabel"')
    && indexHtml.includes("currentLabel.textContent = selectedOption.textContent")
    && /settings-tts-controls[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/.test(heroMenuCss)
    && /@media \(max-width: 480px\)[\s\S]*?settings-tts-controls[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/.test(heroMenuCss),
  'TTS setting summaries show selected values and controls fit desktop and mobile layouts'
);
assertCheck(hardcodedFontSizes.length === 0, `no hardcoded px font sizes outside typography.css${hardcodedFontSizes.length ? `: ${hardcodedFontSizes.join(', ')}` : ''}`);
assertCheck(css && designSystem && grammarLayout && typography && heroMenu && lexicalLookup && js && lexicalIntegration && css === designSystem && css === grammarLayout && css === typography && css === heroMenu && css === lexicalLookup && css === js && css === lexicalIntegration, 'CSS and JS cache versions match');
assertCheck(/^\d{8}-\d{2}$/.test(css), 'cache version format is YYYYMMDD-NN');

if (process.exitCode) {
  process.stderr.write('\nMaintenance checks failed.\n');
} else {
  process.stdout.write('\nAll maintenance checks passed.\n');
}
