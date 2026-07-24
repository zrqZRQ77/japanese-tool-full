/*
 * Yomeru vocabulary practice and flashcard review.
 *
 * Keep ordinary-script global names for index.html inline handlers and the
 * store/list modules that reset or render review state.
 */

let currentVocabPracticeIndex = 0;
let vocabPracticeAnswerVisible = false;

const SRS_STEPS_MIN = [1, 10, 30, 120, 720, 1440, 4320, 10080, 20160];
let reviewQueue = [];
let currentCardWord = null;
let cardFlipped = false;
let reviewInitialCount = 0;

function getVocabPracticeItems(){
  const vocab = getAllVocab();
  const due = vocab.filter(v => isDue(v));
  return due.length ? due : vocab;
}

function renderVocabPractice(){
  const empty = document.getElementById('vocabPracticeEmpty');
  const body = document.getElementById('vocabPracticeBody');
  const card = document.getElementById('vocabQuizCard');
  if(!empty || !body || !card) return;
  const items = getVocabPracticeItems();
  if(!items.length){
    empty.style.display = 'block';
    body.style.display = 'none';
    card.innerHTML = '';
    const result = document.getElementById('vocabPracticeResult');
    if(result) result.textContent = '';
    return;
  }
  empty.style.display = 'none';
  body.style.display = 'block';
  currentVocabPracticeIndex = Math.max(0, Math.min(currentVocabPracticeIndex, items.length - 1));
  const item = items[currentVocabPracticeIndex];
  card.innerHTML = `
    <div class="typing-meta">
      <span class="typing-chip">${escapeHtml(item.level || '自选')}</span>
      <span class="typing-chip">${currentVocabPracticeIndex + 1} / ${items.length}</span>
      <span class="typing-chip">${isDue(item) ? '到期' : '未到期'}</span>
    </div>
    <div class="vocab-quiz-word">${escapeHtml(item.word)}</div>
    <div class="vocab-quiz-reading">${vocabPracticeAnswerVisible ? escapeHtml(item.reading || '无假名') : '先回想读音和释义'}</div>
    <div class="vocab-quiz-meaning">${vocabPracticeAnswerVisible ? escapeHtml(displayVocabMeaning(item.meaning)) : '点击「显示释义」检查'}</div>
  `;
}

function nextVocabPractice(){
  const items = getVocabPracticeItems();
  if(!items.length) return;
  currentVocabPracticeIndex = (currentVocabPracticeIndex + 1) % items.length;
  vocabPracticeAnswerVisible = false;
  renderVocabPractice();
}

function prevVocabPractice(){
  const items = getVocabPracticeItems();
  if(!items.length) return;
  currentVocabPracticeIndex = (currentVocabPracticeIndex - 1 + items.length) % items.length;
  vocabPracticeAnswerVisible = false;
  renderVocabPractice();
}

function toggleVocabPracticeAnswer(){
  vocabPracticeAnswerVisible = !vocabPracticeAnswerVisible;
  renderVocabPractice();
}

function rateVocabPractice(rating){
  const items = getVocabPracticeItems();
  const item = items[currentVocabPracticeIndex];
  if(!item) return;
  const vocabItem = vocabData.find(v => vocabIdentityKey(v.word) === vocabIdentityKey(item.word));
  if(vocabItem){
    if(rating === 'again'){
      vocabItem.repetition = 0;
    } else if(rating === 'hard'){
      vocabItem.repetition = Math.max(1, vocabItem.repetition || 0);
    } else {
      vocabItem.repetition = Math.min((vocabItem.repetition || 0) + 1, SRS_STEPS_MIN.length - 1);
    }
    vocabItem.lastPracticeAt = Date.now();
    vocabItem.lastPracticeRating = rating;
    const mins = SRS_STEPS_MIN[vocabItem.repetition];
    vocabItem.interval = mins;
    vocabItem.dueAt = Date.now() + mins * 60000;
    saveVocab();
    renderVocab();
  }
  recordPracticeResult('vocab', { rating });
  const reviewKey = `vocab:${item.word}`;
  if(rating === 'again' || rating === 'hard'){
    addPracticeReviewItem({
      key:reviewKey,
      type:'vocab',
      title:item.word,
      prompt:item.reading || '',
      answer:displayVocabMeaning(item.meaning),
      note:rating === 'again' ? '刚才标记为不认识' : '刚才标记为模糊'
    });
  } else {
    resolvePracticeReview(reviewKey);
  }
  const result = document.getElementById('vocabPracticeResult');
  if(result){
    const label = rating === 'again' ? '不认识' : rating === 'hard' ? '模糊' : '认识';
    result.textContent = `已记录：${label}。`;
  }
  vocabPracticeAnswerVisible = false;
  renderPracticeSummary();
  renderDailyPlan();
  nextVocabPractice();
}

function markVocabPracticeKnown(){
  rateVocabPractice('easy');
}

function getFlashArea(){
  return document.getElementById('flashArea');
}

function setFlashArea(message){
  const area = getFlashArea();
  if(area){
    area.classList.remove('has-card');
    area.innerHTML = `<div class="flash-empty">${message}</div>`;
  }
  updateFlashProgress(message ? '复习未开始' : '');
}

function updateFlashProgress(label){
  const progress = document.getElementById('flashProgress');
  if(!progress) return;
  if(label){
    progress.textContent = label;
    return;
  }
  const done = Math.max(0, reviewInitialCount - reviewQueue.length + (currentCardWord ? 1 : 0));
  const total = Math.max(reviewInitialCount, reviewQueue.length || 0);
  progress.textContent = total ? `${Math.min(done, total)} / ${total}` : '复习完成';
}

function openVocabReviewPanel(){
  const page = document.querySelector('.vocab-section-page');
  const list = document.querySelector('.vocab-page-list');
  const panel = document.querySelector('.vocab-review-primary');
  if(list?.contains(document.activeElement)) document.activeElement.blur();
  page?.classList.add('is-reviewing');
  list?.setAttribute('inert', '');
  list?.setAttribute('aria-hidden', 'true');
  panel?.classList.remove('is-hidden');
  panel?.setAttribute('tabindex', '-1');
  panel?.focus({preventScroll:true});
  panel?.scrollIntoView({behavior:'smooth', block:'center'});
}

function exitFlashcards(){
  const page = document.querySelector('.vocab-section-page');
  const list = document.querySelector('.vocab-page-list');
  const panel = document.querySelector('.vocab-review-primary');
  page?.classList.remove('is-reviewing');
  list?.removeAttribute('inert');
  list?.removeAttribute('aria-hidden');
  panel?.classList.add('is-hidden');
  currentCardWord = null;
  cardFlipped = false;
  renderVocab();
  document.getElementById('vocabDueTool')?.focus();
}

function prepareVocabReview(){
  if(!getFlashArea()) return;
  if(!vocabData.length){
    reviewQueue = [];
    currentCardWord = null;
    cardFlipped = false;
    reviewInitialCount = 0;
    setFlashArea('生词本是空的。先去阅读页收藏几个词。');
    return;
  }
  if(reviewQueue.length && currentCardWord && vocabData.some(v => vocabIdentityKey(v.word) === vocabIdentityKey(currentCardWord))){
    renderCard();
    return;
  }
  const dueWords = vocabData.filter(v => v.dueAt <= Date.now()).map(v => v.word);
  reviewQueue = (dueWords.length ? dueWords : vocabData.map(v => v.word)).slice(0, 10);
  reviewInitialCount = reviewQueue.length;
  showNextCard();
}

function startReview(){
  switchWorkspace('vocab');
  openVocabReviewPanel();
  const now = Date.now();
  const scoped = filteredVocabForPage();
  reviewQueue = scoped.filter(v=>v.dueAt<=now).map(v=>v.word);
  if(reviewQueue.length===0){
    reviewInitialCount = 0;
    setFlashArea(scoped.length ? '当前筛选里没有到期词。可以切换筛选，或复习全部筛选结果。' : '当前筛选没有可复习的词。');
    return;
  }
  reviewInitialCount = reviewQueue.length;
  showNextCard();
}

function reviewAllVocab(){
  switchWorkspace('vocab');
  openVocabReviewPanel();
  const scoped = filteredVocabForPage();
  if(!scoped.length){
    setFlashArea(vocabData.length ? '当前筛选没有可复习的词。' : '生词本是空的。先去阅读页分析一篇文章，再收藏几个词。');
    return;
  }
  reviewQueue = [...scoped]
    .sort(()=>Math.random() - 0.5)
    .slice(0, 10)
    .map(v=>v.word);
  reviewInitialCount = reviewQueue.length;
  showNextCard();
}

function showNextCard(){
  cardFlipped = false;
  if(reviewQueue.length===0){
    setFlashArea('复习完成');
    updateFlashProgress('复习完成');
    return;
  }
  currentCardWord = reviewQueue[0];
  renderCard();
}

function renderCard(){
  const v = vocabData.find(x=>vocabIdentityKey(x.word) === vocabIdentityKey(currentCardWord));
  if(!v){ reviewQueue.shift(); showNextCard(); return; }
  const area = getFlashArea();
  if(!area) return;
  area.classList.add('has-card');
  updateFlashProgress();
  const flashCardMarkup = cardFlipped
    ? `
      <div class="flash-card-surface flash-card-surface-back">
        <div class="flash-card-word-group">
          <div class="flash-main-word">${escapeHtml(v.word)}</div>
        </div>
        <div class="flash-card-detail-group">
          <div class="flash-main-reading">${escapeHtml(v.reading || '读音待补充')}</div>
          <div class="flash-main-meaning">${escapeHtml(displayVocabMeaning(v.meaning))}</div>
          <div class="flash-main-level">参考等级：${escapeHtml(formatVisibleVocabLevel(v.level))}</div>
        </div>
      </div>
    `
    : `
      <div class="flash-card-surface flash-card-surface-front">
        <div class="flash-main-word">${escapeHtml(v.word)}</div>
        <div class="flash-main-hint">点击查看释义</div>
      </div>
    `;
  area.innerHTML = `
    <div class="flash-stage flash-stage-solid ${cardFlipped ? 'is-flipped' : ''}" role="button" tabindex="0" aria-label="${cardFlipped ? '已显示' : '查看'} ${escapeHtml(v.word)} 的读音和释义" onclick="flipCard()" onkeydown="handleFlashCardKey(event)">
      ${flashCardMarkup}
    </div>
    ${cardFlipped ? `<div class="flash-rating-row">
      <button class="rate-btn rate-again" onclick="rateCard('again')">没记住</button>
      <button class="rate-btn rate-hard" onclick="rateCard('hard')">有点犹豫</button>
      <button class="rate-btn rate-easy" onclick="rateCard('easy')">记住了</button>
    </div>` : ''}
  `;
}

function flipCard(){
  if(cardFlipped) return;
  cardFlipped = true;
  renderCard();
}

function handleFlashCardKey(event){
  if(event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  flipCard();
}

function rateCard(rating){
  const v = vocabData.find(x=>vocabIdentityKey(x.word) === vocabIdentityKey(currentCardWord));
  if(v){
    const currentRepetition = Number.isFinite(Number(v.repetition)) ? Number(v.repetition) : 0;
    if(rating === 'again'){
      v.repetition = 0;
    } else if(rating === 'hard'){
      v.repetition = Math.max(0, currentRepetition);
    } else {
      v.repetition = Math.min(currentRepetition + 1, SRS_STEPS_MIN.length - 1);
    }
    const mins = SRS_STEPS_MIN[v.repetition];
    v.interval = mins;
    v.dueAt = Date.now() + mins * 60000;
    v.lastPracticeAt = Date.now();
    v.lastPracticeRating = rating;
    saveVocab();
  }
  recordPracticeResult('vocab', {rating});
  reviewQueue.shift();
  showNextCard();
  renderVocab();
  renderVocabPractice();
  renderPracticeSummary();
  renderDailyPlan();
}
