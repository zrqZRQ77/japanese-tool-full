/*
 * Yomeru vocabulary store.
 *
 * Keep these declarations in the ordinary-script global lexical environment:
 * lexical-vocab-integration.js, inline handlers, and browser tests depend on
 * the existing names and the reading_vocab_list storage format.
 */

let vocabData = [];

function getAllVocab() {
  return Array.isArray(vocabData) ? vocabData : [];
}

function isDue(vocabItem) {
  return Number(vocabItem?.dueAt || 0) <= Date.now();
}

function vocabIdentityKey(word){
  return String(word || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ja-JP');
}

function normalizeVocabItem(item = {}){
  const rawMeaning = cleanStoredMeaning(item.meaning);
  const legacySource = String(item.meaningSource || '');
  const meaningLanguage = ['zh', 'en'].includes(item.meaningLanguage)
    ? item.meaningLanguage
    : legacySource === 'jmdict' || /^英文释义：/u.test(String(item.meaning || ''))
      ? 'en'
      : rawMeaning && hasCjk(rawMeaning) ? 'zh' : '';
  const meaningSource = ['offline-chinese', 'jmdict', 'manual'].includes(legacySource)
    ? legacySource
    : rawMeaning ? 'manual' : '';
  const level = normalizeVisibleVocabLevel(item.level);
  const lexicalFields = normalizeLexicalVocabFields(item);
  return {
    ...item,
    ...lexicalFields,
    word:lexicalFields.word,
    reading:lexicalFields.reading,
    meaning:displayVocabMeaning(rawMeaning),
    meaningLanguage,
    meaningSource,
    level,
    levelSource:level ? String(item.levelSource || 'legacy') : '',
    pos:lexicalFields.partOfSpeech,
    sourceTitle:String(item.sourceTitle || '').trim(),
    sourceUrl:String(item.sourceUrl || '').trim(),
    repetition:Number.isFinite(Number(item.repetition)) ? Number(item.repetition) : 0,
    interval:Number.isFinite(Number(item.interval)) ? Number(item.interval) : 0,
    dueAt:Number.isFinite(Number(item.dueAt)) ? Number(item.dueAt) : Date.now(),
    lastPracticeAt:item.lastPracticeAt === null || item.lastPracticeAt === undefined ? null : Number(item.lastPracticeAt) || null,
    lastPracticeRating:String(item.lastPracticeRating || '')
  };
}

function normalizeVocabList(items){
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map(normalizeVocabItem)
    .filter(item => item.word)
    .filter(item => {
      const key = vocabIdentityKey(item.word);
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function loadVocab(){
  try{
    if(window.storage && window.storage.get){
      const res = await window.storage.get('reading_vocab_list', false);
      vocabData = res && res.value ? JSON.parse(res.value) : [];
    } else {
      vocabData = JSON.parse(safeStorage.getItem('reading_vocab_list') || '[]');
    }
  }catch(e){ vocabData = []; }
  const rawSnapshot = JSON.stringify(vocabData);
  vocabData = normalizeVocabList(vocabData);
  if(JSON.stringify(vocabData) !== rawSnapshot) saveVocab();
  renderVocab();
  if(document.body.dataset.view === 'vocab') prepareVocabReview();
}

async function saveVocab(){
  try{
    if(window.storage && window.storage.set){
      await window.storage.set('reading_vocab_list', JSON.stringify(vocabData), false);
    } else {
      safeStorage.setItem('reading_vocab_list', JSON.stringify(vocabData));
    }
  }catch(e){ console.error('保存生词本失败', e); }
}

function isSystemGeneratedMeaning(meaning){
  return /(?:kuromoji\s*)?已识别为「[^」]+」。当前内置词库还没有中文释义/.test(String(meaning || ''));
}

function displayVocabMeaning(meaning, fallback = '释义待补充'){
  if(isSystemGeneratedMeaning(meaning)) return '暂无释义，可稍后补充。';
  return String(meaning || '').trim() || fallback;
}

function currentVocabSourceTitle(){
  if(CURRENT_ARTICLE_TEXT && CURRENT_ARTICLE_TEXT.trim()) return articleTitleFromText(CURRENT_ARTICLE_TEXT);
  if(CURRENT_ARTICLE_URL) return readingQueueFallbackTitle(CURRENT_ARTICLE_URL);
  return '';
}

function removeFromVocab(word){
  try{ word = decodeURIComponent(word); }catch{}
  const targetKey = vocabIdentityKey(word);
  if(!vocabData.some(v=>vocabIdentityKey(v.word) === targetKey)) return;
  confirmDeletion({
    title:'删除这个生词？',
    message:'该词的复习进度也会一并删除，操作无法撤销。',
    target:word
  }, ()=>{
    vocabData = vocabData.filter(v=>vocabIdentityKey(v.word) !== targetKey);
    reviewQueue = reviewQueue.filter(item => vocabIdentityKey(item) !== targetKey);
    if(vocabIdentityKey(currentCardWord) === targetKey) currentCardWord = null;
    saveVocab();
    renderVocab();
    if(document.body.dataset.view === 'vocab') prepareVocabReview();
  });
}

function vocabMasteryKey(vocabItem, isDueNow = false){
  if(vocabItem?.lastPracticeRating === 'easy') return 'mastered';
  if(vocabItem?.lastPracticeRating === 'hard') return 'unsure';
  if(vocabItem?.lastPracticeRating === 'again') return 'weak';
  if(isDueNow) return 'weak';
  return 'new';
}

function vocabSourceLabel(vocabItem){
  return vocabItem?.sourceTitle || vocabItem?.source || '手动添加';
}

function clearAllVocab() {
  if (vocabData.length === 0) return;
  confirmDeletion({
    title:'清空整个生词本？',
    message:'全部生词及其复习进度都会被删除，操作无法撤销。',
    target:`共 ${vocabData.length} 个生词`,
    confirmLabel:'确认清空'
  }, ()=>{
    vocabData = [];
    reviewQueue = [];
    currentCardWord = null;
    reviewInitialCount = 0;
    currentVocabPracticeIndex = 0;
    vocabPracticeAnswerVisible = false;
    saveVocab();
    renderVocab();
    renderVocabPractice();
    document.querySelectorAll('.w.active').forEach(el => el.classList.remove('active'));
    resetReadingDetailPanel();
  });
}
