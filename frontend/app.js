// ===== 全局错误处理 =====
window.onerror = function(msg, url, line, col, error) {
  console.error('Global error:', {msg, url, line, col, error});
  showToast('发生了一个错误，请刷新页面重试', 'error');
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  showToast('操作失败，请重试', 'error');
});

function trackAnalyticsEvent(eventName, parameters = {}){
  return window.yomeruAnalytics?.track(eventName, parameters) || false;
}

const YOMERU_PERFORMANCE_MARK_NAMES = [
  'app_shell_visible',
  'hero_interactive',
  'tokenizer_load_start',
  'tokenizer_worker_ready',
  'dictionary_ready',
  'reading_ready'
];
let YOMERU_COLD_START = true;
try{ YOMERU_COLD_START = !sessionStorage.getItem('yomeru_app_ready'); }catch{}
let PERFORMANCE_DEBUG_LOGGED = false;
let PERFORMANCE_DEBUG_TIMER = 0;

function performanceMarkTime(name){
  return Math.max(0, Math.round(performance.getEntriesByName?.(name, 'mark')?.[0]?.startTime || 0));
}

function emitPerformanceDebugLog(){
  if(PERFORMANCE_DEBUG_LOGGED || !window.yomeruAnalytics?.debugMode) return;
  PERFORMANCE_DEBUG_LOGGED = true;
  clearTimeout(PERFORMANCE_DEBUG_TIMER);
  const marks = Object.fromEntries(YOMERU_PERFORMANCE_MARK_NAMES.map(name=>[name, performanceMarkTime(name) || null]));
  const payload = {
    type:'yomeru_performance',
    cold_start:YOMERU_COLD_START,
    marks
  };
  window.YOMERU_PERFORMANCE = payload;
  console.info('[Yomeru performance]', payload);
}

function recordPerformanceMark(name){
  if(!YOMERU_PERFORMANCE_MARK_NAMES.includes(name)) return 0;
  if(!performance.getEntriesByName?.(name, 'mark')?.length) performance.mark(name);
  const time = performanceMarkTime(name);
  const workerReady = performanceMarkTime('tokenizer_worker_ready');
  const readingReady = performanceMarkTime('reading_ready');
  if((name === 'tokenizer_worker_ready' && readingReady) || (name === 'reading_ready' && workerReady)){
    setTimeout(emitPerformanceDebugLog, 0);
  }
  return time;
}

function navigationCacheStatus(){
  const navigation = performance.getEntriesByType?.('navigation')?.[0];
  if(!navigation) return 'unknown';
  return navigation.transferSize === 0 && navigation.decodedBodySize > 0 ? 'hit' : 'miss';
}

function characterCountBucket(text){
  const count = [...String(text || '')].length;
  if(count <= 100) return '1_100';
  if(count <= 500) return '101_500';
  if(count <= 1000) return '501_1000';
  return '1001_plus';
}

function analyticsErrorCode(error){
  const value = String(error?.message || error || '').toLowerCase();
  if(/timeout|timed out|超时/.test(value)) return 'timeout';
  if(/worker/.test(value)) return 'worker_error';
  if(/network|fetch|load|加载/.test(value)) return 'load_error';
  if(/unsupported|不可用/.test(value)) return 'unsupported';
  return 'unknown';
}

// 资源加载失败处理
window.addEventListener('error', function(e) {
  if(e.target?.dataset?.yomeruAnalytics === 'true') return;
  if (e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK') {
    console.error('Resource failed to load:', e.target.src || e.target.href);
    showToast('部分资源加载失败，功能可能受限', 'warning');
  }
}, true);

// Toast通知函数
function showToast(message, type = 'info') {
  if(!document.body) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 安全的localStorage操作
const safeStorage = {
  setItem: function(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('localStorage空间已满:', e);
        showToast('存储空间不足，部分数据可能无法保存', 'warning');
      } else {
        console.error('localStorage写入失败:', e);
      }
      return false;
    }
  },
  getItem: function(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('localStorage读取失败:', e);
      return null;
    }
  },
  removeItem: function(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('localStorage删除失败:', e);
      return false;
    }
  },
  clear: function() {
    try {
      localStorage.clear();
      return true;
    } catch (e) {
      console.error('localStorage清除失败:', e);
      return false;
    }
  }
};

function setSidebarCollapsed(isCollapsed, shouldPersist = true) {
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  const collapseButton = document.getElementById('collapseSidebarButton');
  const restoreButton = document.getElementById('restoreSidebarButton');
  if(collapseButton){
    collapseButton.setAttribute('aria-label', isCollapsed ? '显示左侧目录' : '隐藏左侧目录');
    collapseButton.setAttribute('aria-expanded', String(!isCollapsed));
  }
  if(restoreButton){
    restoreButton.setAttribute('aria-expanded', String(!isCollapsed));
  }
  if(shouldPersist) safeStorage.setItem('reading_sidebar_collapsed', isCollapsed ? '1' : '0');
}

function toggleSidebar(forceExpanded) {
  const nextCollapsed = typeof forceExpanded === 'boolean'
    ? !forceExpanded
    : !document.body.classList.contains('sidebar-collapsed');
  setSidebarCollapsed(nextCollapsed);
}

const READING_DISPLAY_DEFAULTS = {
  base: 22,
  ruby: 12,
  rubyGap: 0.16,
  lineHeight: 2.0
};

const READING_DISPLAY_PRESETS = {
  compact: {base: 18, ruby: 9, rubyGap: 0.12, lineHeight: 1.6},
  standard: {base: 20, ruby: 10, rubyGap: 0.14, lineHeight: 1.8},
  comfortable: READING_DISPLAY_DEFAULTS,
  large: {base: 26, ruby: 14, rubyGap: 0.18, lineHeight: 2.2}
};

let readingDisplayBeforeOpen = null;

function getReadingDisplayValues(){
  return {
    base: Number(document.getElementById('readingFontSizeInput')?.value || safeStorage.getItem('reading_font_size') || READING_DISPLAY_DEFAULTS.base),
    ruby: Number(document.getElementById('rubyFontSizeInput')?.value || safeStorage.getItem('reading_ruby_font_size') || READING_DISPLAY_DEFAULTS.ruby),
    rubyGap: Number(document.getElementById('readingRubyGapInput')?.value || safeStorage.getItem('reading_ruby_gap') || READING_DISPLAY_DEFAULTS.rubyGap),
    lineHeight: Number(document.getElementById('readingLineHeightInput')?.value || safeStorage.getItem('reading_line_height') || READING_DISPLAY_DEFAULTS.lineHeight)
  };
}

function normalizeReadingDisplayValues(values = {}){
  return {
    base: Math.min(40, Math.max(12, Number(values.base) || READING_DISPLAY_DEFAULTS.base)),
    ruby: Math.min(24, Math.max(8, Number(values.ruby) || READING_DISPLAY_DEFAULTS.ruby)),
    rubyGap: Math.min(0.32, Math.max(0.06, Number(values.rubyGap) || READING_DISPLAY_DEFAULTS.rubyGap)),
    lineHeight: Math.min(2.4, Math.max(1.2, Number(values.lineHeight) || READING_DISPLAY_DEFAULTS.lineHeight))
  };
}

function setReadingDisplayInputs(values){
  const normalized = normalizeReadingDisplayValues(values);
  const baseInput = document.getElementById('readingFontSizeInput');
  const rubyInput = document.getElementById('rubyFontSizeInput');
  const rubyGapInput = document.getElementById('readingRubyGapInput');
  const lineHeightInput = document.getElementById('readingLineHeightInput');
  if(baseInput) baseInput.value = String(normalized.base);
  if(rubyInput) rubyInput.value = String(normalized.ruby);
  if(rubyGapInput) rubyGapInput.value = normalized.rubyGap.toFixed(2);
  if(lineHeightInput) lineHeightInput.value = normalized.lineHeight.toFixed(1);
  updateReadingDisplayLabels(normalized);
  updateReadingDisplayPreview(normalized);
  updateReadingDisplayPresetState(normalized);
}

function updateReadingDisplayLabels(values = getReadingDisplayValues()){
  const normalized = normalizeReadingDisplayValues(values);
  const baseCurrent = document.getElementById('readingFontSizeCurrent');
  const rubyCurrent = document.getElementById('rubyFontSizeCurrent');
  const rubyGapCurrent = document.getElementById('readingRubyGapCurrent');
  const lineHeightCurrent = document.getElementById('readingLineHeightCurrent');
  if(baseCurrent) baseCurrent.textContent = String(normalized.base);
  if(rubyCurrent) rubyCurrent.textContent = String(normalized.ruby);
  if(rubyGapCurrent) rubyGapCurrent.textContent = normalized.rubyGap.toFixed(2);
  if(lineHeightCurrent) lineHeightCurrent.textContent = normalized.lineHeight.toFixed(1);
}

function updateReadingDisplayPreview(values = getReadingDisplayValues()){
  const normalized = normalizeReadingDisplayValues(values);
  const preview = document.getElementById('readingDisplayPreview');
  if(!preview) return;
  preview.style.setProperty('--preview-base-font', `${normalized.base}px`);
  preview.style.setProperty('--preview-ruby-font', `${normalized.ruby}px`);
  preview.style.setProperty('--preview-ruby-gap', `${normalized.rubyGap}em`);
  preview.style.setProperty('--preview-line-height', normalized.lineHeight.toFixed(1));
}

function updateReadingDisplayPresetState(values = getReadingDisplayValues()){
  const normalized = normalizeReadingDisplayValues(values);
  document.querySelectorAll('.reading-display-preset-grid button').forEach(button=>{
    const preset = READING_DISPLAY_PRESETS[button.dataset.preset];
    const selected = preset
      && normalized.base === preset.base
      && normalized.ruby === preset.ruby
      && Math.abs(normalized.rubyGap - preset.rubyGap) < 0.001
      && Math.abs(normalized.lineHeight - preset.lineHeight) < 0.001;
    button.classList.toggle('is-selected', Boolean(selected));
  });
}

function setReadingDisplayCss(values){
  const normalized = normalizeReadingDisplayValues(values);
  document.documentElement.style.setProperty('--reading-base-font', `${normalized.base}px`);
  document.documentElement.style.setProperty('--reading-ruby-font', `${normalized.ruby}px`);
  document.documentElement.style.setProperty('--reading-ruby-gap', `${normalized.rubyGap}em`);
  document.documentElement.style.setProperty('--reading-ruby-mobile-gap', `${(normalized.rubyGap * 0.6).toFixed(3)}em`);
  document.documentElement.style.setProperty('--reading-line-height', normalized.lineHeight.toFixed(1));
  setReadingDisplayInputs(normalized);
}

function persistReadingDisplayValues(values){
  const normalized = normalizeReadingDisplayValues(values);
  safeStorage.setItem('reading_font_size', String(normalized.base));
  safeStorage.setItem('reading_ruby_font_size', String(normalized.ruby));
  safeStorage.setItem('reading_ruby_gap', normalized.rubyGap.toFixed(2));
  safeStorage.setItem('reading_line_height', normalized.lineHeight.toFixed(1));
}

function applyReadingFontSize(baseSize, rubySize){
  const base = Math.min(40, Math.max(12, Number(baseSize) || 20));
  const ruby = Math.min(24, Math.max(8, Number(rubySize) || 10));
  const current = getReadingDisplayValues();
  setReadingDisplayCss({...current, base, ruby});
}

function updateReadingFontSize(){
  const base = Number(document.getElementById('readingFontSizeInput')?.value || 20);
  const ruby = Number(document.getElementById('rubyFontSizeInput')?.value || 10);
  const current = {...getReadingDisplayValues(), base, ruby};
  setReadingDisplayCss(current);
  persistReadingDisplayValues(current);
}

function updateReadingDisplayDraft(){
  const values = getReadingDisplayValues();
  updateReadingDisplayLabels(values);
  updateReadingDisplayPreview(values);
  updateReadingDisplayPresetState(values);
}

function setReadingFontSize(kind, value, button){
  const input = document.getElementById(kind === 'ruby' ? 'rubyFontSizeInput' : 'readingFontSizeInput');
  if(input) input.value = String(value);
  updateReadingDisplayDraft();
}

function stepReadingFontSize(kind, direction){
  const input = document.getElementById(kind === 'ruby' ? 'rubyFontSizeInput' : 'readingFontSizeInput');
  const current = Number(input?.value || (kind === 'ruby' ? 10 : 20));
  const step = kind === 'ruby' ? 1 : 2;
  setReadingFontSize(kind, current + (Number(direction) || 0) * step);
}

function applyReadingLineHeight(value){
  const lineHeight = Math.min(2.4, Math.max(1.2, Number(value) || 1.8));
  const normalized = lineHeight.toFixed(1);
  document.documentElement.style.setProperty('--reading-line-height', normalized);
  const input = document.getElementById('readingLineHeightInput');
  const current = document.getElementById('readingLineHeightCurrent');
  if(input) input.value = normalized;
  if(current) current.textContent = normalized;
  updateReadingDisplayPreview({...getReadingDisplayValues(), lineHeight});
  updateReadingDisplayPresetState({...getReadingDisplayValues(), lineHeight});
}

function stepReadingLineHeight(direction){
  const input = document.getElementById('readingLineHeightInput');
  const current = Number(input?.value || 1.8);
  const next = current + (Number(direction) || 0) * 0.1;
  if(input) input.value = next.toFixed(1);
  updateReadingDisplayDraft();
}

function initReadingFontSize(){
  setReadingDisplayCss({
    base: safeStorage.getItem('reading_font_size') || READING_DISPLAY_DEFAULTS.base,
    ruby: safeStorage.getItem('reading_ruby_font_size') || READING_DISPLAY_DEFAULTS.ruby,
    rubyGap: safeStorage.getItem('reading_ruby_gap') || READING_DISPLAY_DEFAULTS.rubyGap,
    lineHeight: safeStorage.getItem('reading_line_height') || READING_DISPLAY_DEFAULTS.lineHeight
  });
}

function openReadingDisplaySettings(){
  const modal = document.getElementById('readingDisplayModal');
  readingDisplayBeforeOpen = getReadingDisplayValues();
  setReadingDisplayInputs(readingDisplayBeforeOpen);
  setDialogVisibility(modal, true, document.getElementById('readingFontSizeInput'));
  document.getElementById('readingFontSettingsButton')?.classList.add('is-active');
}

function closeReadingDisplaySettings(){
  if(readingDisplayBeforeOpen) setReadingDisplayInputs(readingDisplayBeforeOpen);
  setDialogVisibility(document.getElementById('readingDisplayModal'), false);
  document.getElementById('readingFontSettingsButton')?.classList.remove('is-active');
  readingDisplayBeforeOpen = null;
}

function applyReadingDisplayPreset(name){
  const preset = READING_DISPLAY_PRESETS[name];
  if(!preset) return;
  setReadingDisplayInputs(preset);
}

function resetReadingDisplaySettings(){
  setReadingDisplayInputs(READING_DISPLAY_DEFAULTS);
}

function applyReadingDisplaySettings(){
  const values = getReadingDisplayValues();
  setReadingDisplayCss(values);
  persistReadingDisplayValues(values);
  setDialogVisibility(document.getElementById('readingDisplayModal'), false);
  document.getElementById('readingFontSettingsButton')?.classList.remove('is-active');
  readingDisplayBeforeOpen = null;
}

async function toggleParagraphTranslation(){
  SHOW_PARAGRAPH_TRANSLATION = !SHOW_PARAGRAPH_TRANSLATION;
  const button = document.getElementById('translationToggleBtn');
  button?.classList.toggle('is-active', SHOW_PARAGRAPH_TRANSLATION);
  await renderText();
  if(SHOW_PARAGRAPH_TRANSLATION && CURRENT_ARTICLE_TEXT.trim()){
    const hasTranslation = [...document.querySelectorAll('.paragraph-translation')]
      .some(node => node.textContent.trim() !== LOCAL_TRANSLATION_FALLBACK);
    if(!hasTranslation){
      showToast('这篇文章暂时没有可靠的本地译文。仍可点击词语查看或补充释义。', 'info');
    }
    trackAnalyticsEvent('translation_completed');
  }
}

async function toggleReaderSmartSegmentation(){
  const input = document.getElementById('useKuromoji');
  if(!input) return;
  const retryFailedAttempt = input.checked && TOKENIZER_LAST_ATTEMPT_FAILED;
  if(!retryFailedAttempt) input.checked = !input.checked;
  TOKENIZER_LAST_ATTEMPT_FAILED = false;
  document.getElementById('rubyToggleBtn')?.classList.toggle('is-active', input.checked);
  if(input.checked){
    startTokenizerProgress();
  }else{
    clearTokenizerProgressTimers();
    setRubyToggleBusy(false);
    setTokenizerStatus('', '');
  }
  await renderText();
}

function toggleReadingInsights(){
  const button = document.getElementById('readingAnalysisButton');
  if(!button) return;
  const state = button.dataset.analysisState || '';
  if(state === 'loading') return;
  if(state === 'ready') return;
  if(LAST_READING_ANALYSIS){
    scheduleReadingDifficultyAnalysis(LAST_READING_ANALYSIS, 0);
    return;
  }
  if(CURRENT_ARTICLE_TEXT.trim()){
    setReadingDifficultyButtonState('error');
    showToast('还没有可用的难度结果，请重新导入或稍后再试。', 'warning');
    return;
  }
  setReadingDifficultyButtonState('idle');
}

function speakCurrentReading(trigger){
  const selected = plainSelectedText() || currentSelectionText;
  speakJapanese(selected || CURRENT_ARTICLE_TEXT, trigger);
}

// ===== Hero首屏逻辑 =====
function enterReadingFromHero(){
  document.body.classList.remove('first-visit');
  safeStorage.setItem('hasUsedApp', 'true');
  safeStorage.setItem('reading_workspace', 'reading');
  switchWorkspace('reading');
}

function openContentFeed(){
  document.body.classList.remove('first-visit');
  safeStorage.setItem('hasUsedApp', 'true');
  safeStorage.setItem('reading_workspace', 'discover');
  switchWorkspace('discover');
  window.refreshContentFeed?.();
  requestAnimationFrame(()=>{
    document.getElementById('contentFeedSection')?.scrollIntoView({behavior:'smooth', block:'start'});
  });
}

function updateHeroStartState(){
  const input = document.getElementById('heroInputText');
  const button = document.getElementById('heroStartButton');
  if(!input || !button) return;
  const hasContent = input.value.trim().length > 0;
  button.setAttribute('aria-disabled', hasContent ? 'false' : 'true');
}

function closeOtherHeroMenus(currentMenu = null){
  document.querySelectorAll('.hero-menu-details[open]').forEach(menu=>{
    if(menu !== currentMenu) menu.removeAttribute('open');
  });
}

document.addEventListener('click', event=>{
  document.querySelectorAll('.hero-menu-details[open]').forEach(menu=>{
    if(!menu.contains(event.target)) menu.removeAttribute('open');
  });
});

function analyzeFromHero() {
  const text = document.getElementById('heroInputText').value.trim();
  if (!text) {
    showToast('请先粘贴日语文本。', 'warning');
    document.getElementById('heroInputText')?.focus();
    return;
  }
  enterReadingFromHero();
  document.getElementById('inputText').value = text;
  analyzeSourceInput();
}

function loadSampleFromHero(sampleId = 'life') {
  enterReadingFromHero();
  loadSample(sampleId);
}

function startGuidedSampleFromHero(){
  safeStorage.setItem('reading_guide_prompt_seen', '1');
  enterReadingFromHero();
  loadSample('life', true);
}

function dismissHeroGuidePrompt(){
  safeStorage.setItem('reading_guide_prompt_seen', '1');
  document.getElementById('heroGuidePrompt')?.classList.add('is-hidden');
}

function toggleHeroWordDemo(button){
  const demo = document.getElementById('heroDemoReader');
  if(!demo) return;
  const isActive = !demo.classList.contains('is-active');
  demo.classList.toggle('is-active', isActive);
  button?.setAttribute('aria-pressed', String(isActive));
}

function flipHeroFlashcard(button){
  const card = button instanceof HTMLElement ? button.closest('.hero-demo-flashcard') : null;
  if(!card) return;
  const isFlipped = !card.classList.contains('is-flipped');
  card.classList.toggle('is-flipped', isFlipped);
  card.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(isFlipped)));
}

function checkHeroPracticeDemo(){
  const input = document.getElementById('heroPracticeInput');
  const result = document.getElementById('heroPracticeResult');
  const shell = input?.closest('.hero-demo-practice');
  const value = String(input?.value || '').trim();
  const isCorrect = ['はん', '飯', 'ごはん', 'ご飯'].includes(value);
  shell?.classList.toggle('is-correct', isCorrect);
  shell?.classList.toggle('is-wrong', !!value && !isCorrect);
  if(result) result.textContent = !value ? '试着补全句子' : isCorrect ? '正确：朝ごはん' : '再试一次：提示是「ごはん」';
}

function resetToHero() {
  document.body.classList.add('first-visit');
  safeStorage.setItem('reading_workspace', document.body.dataset.view || 'reading');
  document.getElementById('heroInputText')?.focus();
}

// Vocabulary list, filters, panel, and edit dialog live in vocab-list.js.

let PENDING_DELETE_ACTION = null;
let DELETE_CONFIRM_TRIGGER = null;
let EXPORT_MODAL_TRIGGER = null;
let IMPORT_PREVIEW_TRIGGER = null;

const DIALOG_FOCUS_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function focusableDialogControls(container){
  return Array.from(container?.querySelectorAll(DIALOG_FOCUS_SELECTOR) || [])
    .filter(el => {
      if(!(el instanceof HTMLElement) || el.hidden) return false;
      const style = window.getComputedStyle(el);
      return style.visibility !== 'hidden' && style.display !== 'none' && el.getClientRects().length > 0;
    });
}

function setDialogVisibility(dialog, isOpen, focusTarget){
  if(!dialog) return;
  dialog.classList.toggle('active', isOpen);
  dialog.setAttribute('aria-hidden', String(!isOpen));
  dialog.inert = !isOpen;
  if(!isOpen) return;
  window.setTimeout(()=>{
    const preferred = focusTarget instanceof HTMLElement ? focusTarget : null;
    const target = preferred || focusableDialogControls(dialog)[0] || dialog;
    if(target instanceof HTMLElement) target.focus({preventScroll:true});
  }, 0);
}

function activeDialogRoot(){
  return ['deleteConfirmModal', 'vocabEditModal', 'retellPermissionModal', 'readingDisplayModal', 'importPreviewModal', 'exportModal', 'menuPanel']
    .map(id => document.getElementById(id))
    .find(el => el?.classList.contains('active')) || null;
}

function trapDialogFocus(event, root){
  const controls = focusableDialogControls(root);
  if(!controls.length){
    event.preventDefault();
    if(root instanceof HTMLElement) root.focus({preventScroll:true});
    return;
  }
  const first = controls[0];
  const last = controls[controls.length - 1];
  if(event.shiftKey && document.activeElement === first){
    event.preventDefault();
    last.focus();
  }else if(!event.shiftKey && document.activeElement === last){
    event.preventDefault();
    first.focus();
  }
}

function closeTopLayer(){
  const vocabEditModal = document.getElementById('vocabEditModal');
  if(vocabEditModal?.classList.contains('active')){ closeVocabEditDialog(); return true; }
  const deleteModal = document.getElementById('deleteConfirmModal');
  if(deleteModal?.classList.contains('active')){ closeDeleteConfirm(); return true; }
  const retellModal = document.getElementById('retellPermissionModal');
  if(retellModal?.classList.contains('active')){ closeRetellPermissionModal(); return true; }
  const readingDisplayModal = document.getElementById('readingDisplayModal');
  if(readingDisplayModal?.classList.contains('active')){ closeReadingDisplaySettings(); return true; }
  const importModal = document.getElementById('importPreviewModal');
  if(importModal?.classList.contains('active')){ closeImportPreview(); return true; }
  const exportModal = document.getElementById('exportModal');
  if(exportModal?.classList.contains('active')){ closeExportModal(); return true; }
  const menu = document.getElementById('menuPanel');
  if(menu?.classList.contains('active')){ closeMenu(); return true; }
  return false;
}

function ensureDeleteConfirmModal(){
  let modal = document.getElementById('deleteConfirmModal');
  if(modal) return modal;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="delete-confirm-modal" id="deleteConfirmModal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="deleteConfirmTitle" inert>
      <div class="delete-confirm-dialog">
        <div class="delete-confirm-head">
          <span class="delete-confirm-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 8v5"></path><path d="M12 16.5h.01"></path><path d="M10.3 4.6 2.8 18a1.6 1.6 0 0 0 1.4 2.4h15.6a1.6 1.6 0 0 0 1.4-2.4L13.7 4.6a1.9 1.9 0 0 0-3.4 0Z"></path></svg>
          </span>
          <div>
            <span class="module-kicker" id="deleteConfirmKicker">操作确认</span>
            <strong id="deleteConfirmTitle">确认操作？</strong>
          </div>
          <button class="delete-confirm-close" type="button" onclick="closeDeleteConfirm()" aria-label="关闭确认窗口">×</button>
        </div>
        <div class="delete-confirm-body">
          <p id="deleteConfirmMessage">请确认后继续。</p>
          <div class="delete-confirm-target is-hidden" id="deleteConfirmTarget"></div>
        </div>
        <div class="delete-confirm-actions">
          <button class="btn-secondary delete-confirm-cancel" id="deleteConfirmCancel" type="button" onclick="closeDeleteConfirm()">取消</button>
          <button class="btn-primary delete-confirm-submit" id="deleteConfirmSubmit" type="button" onclick="runDeleteConfirm()">确认</button>
        </div>
      </div>
    </div>
  `.trim();
  modal = wrapper.firstElementChild;
  if(!(modal instanceof HTMLElement)) return null;
  modal.addEventListener('click', event=>{
    if(event.target === event.currentTarget) closeDeleteConfirm();
  });
  document.body.appendChild(modal);
  return modal;
}

function confirmDeletion(options, action){
  const modal = ensureDeleteConfirmModal();
  if(!modal || typeof action !== 'function'){
    showToast('确认窗口没有加载，请刷新后重试。', 'error');
    return;
  }
  const settings = typeof options === 'string' ? {message:options} : (options || {});
  const title = document.getElementById('deleteConfirmTitle');
  const message = document.getElementById('deleteConfirmMessage');
  const target = document.getElementById('deleteConfirmTarget');
  const submit = document.getElementById('deleteConfirmSubmit');
  const kicker = document.getElementById('deleteConfirmKicker');
  if(title) title.textContent = settings.title || '确认删除？';
  if(message) message.textContent = settings.message || '删除后将无法撤销，请确认后继续。';
  if(kicker) kicker.textContent = Object.prototype.hasOwnProperty.call(settings, 'kicker') ? settings.kicker : (settings.intent === 'neutral' ? '操作确认' : '删除确认');
  if(target){
    target.textContent = settings.target || '';
    target.classList.toggle('is-hidden', !settings.target);
  }
  if(submit) submit.textContent = settings.confirmLabel || '确认删除';
  modal.classList.toggle('is-neutral', settings.intent === 'neutral');
  PENDING_DELETE_ACTION = action;
  DELETE_CONFIRM_TRIGGER = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  setDialogVisibility(modal, true, document.getElementById('deleteConfirmCancel'));
}

function closeDeleteConfirm(restoreFocus = true){
  const modal = document.getElementById('deleteConfirmModal');
  setDialogVisibility(modal, false);
  PENDING_DELETE_ACTION = null;
  if(restoreFocus && DELETE_CONFIRM_TRIGGER?.isConnected) DELETE_CONFIRM_TRIGGER.focus();
  DELETE_CONFIRM_TRIGGER = null;
}

function runDeleteConfirm(){
  const action = PENDING_DELETE_ACTION;
  closeDeleteConfirm(false);
  if(typeof action === 'function') action();
}

// ===== 菜单面板逻辑 =====
let menuReturnFocus = null;

function openMenu() {
  hideIconButtonHint(null, true);
  const select = document.getElementById('interfaceLanguageSelect');
  if(select) select.value = safeStorage.getItem('interface_language') || 'zh';
  const menu = document.getElementById('menuPanel');
  if(!menu) return;
  menuReturnFocus = document.activeElement;
  document.body.classList.add('menu-open');
  setDialogVisibility(menu, true, document.getElementById('menuCloseButton'));
}

function closeMenu() {
  const menu = document.getElementById('menuPanel');
  if(!menu?.classList.contains('active')) return;
  setDialogVisibility(menu, false);
  document.body.classList.remove('menu-open');
  if(menuReturnFocus instanceof HTMLElement) menuReturnFocus.focus();
  menuReturnFocus = null;
}

function setInterfaceLanguage(value, silent = false){
  const lang = ['zh', 'ja', 'en'].includes(value) ? value : 'zh';
  safeStorage.setItem('interface_language', lang);
  document.documentElement.lang = lang === 'ja' ? 'ja' : lang === 'en' ? 'en' : 'zh-CN';
  document.querySelectorAll('#interfaceLanguageSelect, #settingsLanguageSelect').forEach(select => {
    if(select) select.value = lang;
  });
  if(!silent) showToast('语言偏好已保存。完整三语界面需要后续接入统一文案表。', 'success');
}

// 图标按钮使用页面级提示层，避免在窄卡片和抽屉中被裁切。
let activeIconHintControl = null;
let iconHintHideTimer = null;
let iconHintPinned = false;

function iconHintControlFromTarget(target){
  if(!(target instanceof Element)) return null;
  const control = target.closest('button, [role="button"], summary, label.reader-tool-toggle');
  if(!control) return null;
  if(control.closest('#output')) return null;
  const text = control.textContent.trim();
  const hasExplicitHint = control.hasAttribute('data-tooltip') || control.hasAttribute('title');
  const isSvgIconOnly = control.querySelector('svg') && !text;
  const isToolSymbol = control.matches('.reader-tool, .reader-tool-details > summary, label.reader-tool-toggle');
  const hasHint = hasExplicitHint || (isSvgIconOnly && control.hasAttribute('aria-label'));
  const isIconOnly = hasExplicitHint || isSvgIconOnly || isToolSymbol;
  return hasHint && isIconOnly ? control : null;
}

function iconHintLabel(control){
  return control?.dataset.tooltip
    || control?.getAttribute('aria-label')
    || control?.getAttribute('title')
    || '';
}

function positionIconButtonHint(control, hint){
  const anchor = control.getBoundingClientRect();
  const bubble = hint.getBoundingClientRect();
  const edge = 8;
  const gap = 9;
  let left = anchor.left + anchor.width / 2 - bubble.width / 2;
  left = Math.max(edge, Math.min(left, window.innerWidth - bubble.width - edge));
  let top = anchor.top - bubble.height - gap;
  let placement = 'top';
  if(top < edge){
    top = Math.min(window.innerHeight - bubble.height - edge, anchor.bottom + gap);
    placement = 'bottom';
  }
  hint.style.left = `${Math.round(left)}px`;
  hint.style.top = `${Math.round(top)}px`;
  hint.dataset.placement = placement;
  const anchorCenter = anchor.left + anchor.width / 2;
  hint.style.setProperty('--hint-arrow-left', `${Math.round(Math.max(10, Math.min(bubble.width - 10, anchorCenter - left)))}px`);
}

function showIconButtonHint(control, duration = 0){
  if(document.body?.classList.contains('sample-tour-active')){
    hideIconButtonHint(null, true);
    return;
  }
  const hint = document.getElementById('iconButtonHint');
  const label = iconHintLabel(control);
  if(!hint || !label) return;
  clearTimeout(iconHintHideTimer);
  iconHintPinned = duration > 0;
  activeIconHintControl?.removeAttribute('aria-describedby');
  activeIconHintControl = control;
  if(control.hasAttribute('title')){
    control.dataset.tooltip = label;
    control.removeAttribute('title');
  }
  control.setAttribute('aria-describedby', 'iconButtonHint');
  hint.textContent = label;
  hint.setAttribute('aria-hidden', 'false');
  hint.classList.add('is-visible');
  positionIconButtonHint(control, hint);
  if(duration > 0){
    iconHintHideTimer = setTimeout(()=>hideIconButtonHint(control, true), duration);
  }
}

function hideIconButtonHint(control, force = false){
  if(control && activeIconHintControl !== control) return;
  if(iconHintPinned && !force) return;
  const hint = document.getElementById('iconButtonHint');
  activeIconHintControl?.removeAttribute('aria-describedby');
  activeIconHintControl = null;
  iconHintPinned = false;
  if(hint){
    hint.classList.remove('is-visible');
    hint.setAttribute('aria-hidden', 'true');
  }
}

function initIconButtonHints(){
  document.addEventListener('mouseover', event=>{
    const control = iconHintControlFromTarget(event.target);
    if(control) showIconButtonHint(control);
  });
  document.addEventListener('mouseout', event=>{
    const control = iconHintControlFromTarget(event.target);
    if(control && !control.contains(event.relatedTarget)) hideIconButtonHint(control);
  });
  document.addEventListener('focusin', event=>{
    const control = iconHintControlFromTarget(event.target);
    if(control) showIconButtonHint(control);
  });
  document.addEventListener('focusout', event=>{
    const control = iconHintControlFromTarget(event.target);
    if(control) hideIconButtonHint(control);
  });
  document.addEventListener('click', event=>{
    const control = iconHintControlFromTarget(event.target);
    if(control) showIconButtonHint(control, 1400);
  }, true);
  window.addEventListener('resize', ()=>hideIconButtonHint(null, true));
  window.addEventListener('scroll', ()=>{
    if(iconHintPinned && activeIconHintControl?.isConnected){
      const hint = document.getElementById('iconButtonHint');
      if(hint) positionIconButtonHint(activeIconHintControl, hint);
      return;
    }
    hideIconButtonHint(null, true);
  }, true);
}

// ===== 检测首次访问 =====
window.addEventListener('DOMContentLoaded', () => {
  setSidebarCollapsed(safeStorage.getItem('reading_sidebar_collapsed') === '1', false);
  initIconButtonHints();
  initializeFeedbackEntry();
  document.getElementById('heroInputText')?.addEventListener('input', updateHeroStartState);
  document.getElementById('heroInputText')?.addEventListener('input', event=>{
    scheduleLocalKuromojiPrewarm(event.currentTarget?.value || '');
  });
  document.getElementById('inputText')?.addEventListener('input', event=>{
    scheduleLocalKuromojiPrewarm(event.currentTarget?.value || '');
  });
  updateHeroStartState();
  requestAnimationFrame(()=>{
    const hero = document.getElementById('heroIntro');
    const input = document.getElementById('heroInputText');
    const button = document.getElementById('heroStartButton');
    if(hero?.getBoundingClientRect().width) recordPerformanceMark('app_shell_visible');
    if(input && button && !input.disabled && !button.disabled) recordPerformanceMark('hero_interactive');
    const readyAt = performanceMarkTime('hero_interactive') || Math.round(performance.now());
    trackAnalyticsEvent('app_ready', {
      duration_ms:readyAt,
      cold_start:YOMERU_COLD_START,
      cache_status:navigationCacheStatus()
    });
    try{ sessionStorage.setItem('yomeru_app_ready', '1'); }catch{}
    PERFORMANCE_DEBUG_TIMER = setTimeout(emitPerformanceDebugLog, 6000);
  });
});

function feedbackFormUrl(){
  const configured = String(window.NIHONGO_CONFIG?.FEEDBACK_FORM_URL || '').trim();
  try{
    const url = new URL(configured);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  }catch{
    return '';
  }
}

function initializeFeedbackEntry(){
  const section = document.getElementById('feedbackSettingsSection');
  const link = document.getElementById('feedbackFormLink');
  if(!section || !link) return;
  const url = feedbackFormUrl();
  section.hidden = !url;
  link.href = url || '';
}

function openFeedback(event){
  const url = feedbackFormUrl();
  if(!url){
    event?.preventDefault?.();
    return false;
  }
  trackAnalyticsEvent('feedback_open', {entry_location:'settings'});
  return true;
}

// ---------------- 数据 ----------------
// 词库、示例文本、练习题和语法点从 data/*.json 加载，便于非代码方式维护。
let DICT = {};
let SAMPLE_TEXT = '';
let SAMPLE_ARTICLES = [];
let TYPING_PROMPTS = [];
let GRAMMAR_POINTS = [];
let GRAMMAR_BOOK = loadGrammarBook();
let SAMPLE_FLOW_ACTIVE = false;
let SAMPLE_FLOW_VISITED_VOCAB = false;
let SAMPLE_FLOW_VISITED_PRACTICE = false;
let SAMPLE_FLOW_INITIAL_VOCAB_COUNT = 0;
let DATA_READY = null;
const JMDICT_COMMON_DATA_VERSION = '20260713';
const JMDICT_COMMON_BASE_URL = `data/jmdict-common/${JMDICT_COMMON_DATA_VERSION}`;
const JMDICT_COMMON_SHARD_COUNT = 64;
const JMDICT_COMMON_SHARD_CACHE = new Map();
const JMDICT_COMMON_SOURCE_URL = 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project';
const LEARNING_DATA_VERSION = '20260717';
const CHINESE_DEFINITIONS_BASE_URL = `data/chinese-definitions/${LEARNING_DATA_VERSION}`;
const CHINESE_DEFINITIONS_SHARD_COUNT = 16;
const CHINESE_DEFINITIONS_SHARD_CACHE = new Map();
const JLPT_REFERENCE_URL = `data/jlpt-reference/${LEARNING_DATA_VERSION}/index.json`;
let JLPT_REFERENCE_READY = null;

const FALLBACK_SAMPLE_ARTICLES = [
  {
    id:'life',
    title:'简单生活短文',
    text:'私は毎朝七時に起きます。\n朝ごはんを食べてから、学校に行きます。\n夜は本を読んで、十一時に寝ます。'
  },
  {
    id:'story',
    title:'基础故事',
    text:'ある日、小さな猫が公園に来ました。\n猫は木の下で休んでいました。\n女の子が水を持ってきたので、猫はうれしそうに飲みました。'
  },
  {
    id:'news',
    title:'难度较低的普通资讯',
    text:'市の図書館は来月、新しい読書室を開きます。\n読書室には日本語の本や新聞があります。\n利用時間は午前九時から午後六時までです。'
  }
];
const FALLBACK_SAMPLE_TEXT = FALLBACK_SAMPLE_ARTICLES[0].text;

const FALLBACK_DICTIONARY = {
  '私': {reading:'わたし', level:'N5', pos:'名词', meaning:'我'},
  '毎朝': {reading:'まいあさ', level:'N5', pos:'名词', meaning:'每天早上'},
  '七時': {reading:'しちじ', level:'N5', pos:'名词', meaning:'七点'},
  '起きます': {reading:'おきます', level:'N5', pos:'动词', meaning:'起床'},
  '朝ごはん': {reading:'あさごはん', level:'N5', pos:'名词', meaning:'早饭'},
  '食べて': {reading:'たべて', level:'N5', pos:'动词', meaning:'吃'},
  '学校': {reading:'がっこう', level:'N5', pos:'名词', meaning:'学校'},
  '行きます': {reading:'いきます', level:'N5', pos:'动词', meaning:'去'},
  '今日': {reading:'きょう', level:'N5', pos:'名词', meaning:'今天'},
  '友達': {reading:'ともだち', level:'N5', pos:'名词', meaning:'朋友'},
  '一緒': {reading:'いっしょ', level:'N5', pos:'名词', meaning:'一起'},
  '図書館': {reading:'としょかん', level:'N5', pos:'名词', meaning:'图书馆'},
  '勉強': {reading:'べんきょう', level:'N5', pos:'名词/动词', meaning:'学习'},
  '予定': {reading:'よてい', level:'N4', pos:'名词', meaning:'计划'},
  '先生': {reading:'せんせい', level:'N5', pos:'名词', meaning:'老师'},
  '親切': {reading:'しんせつ', level:'N4', pos:'形容动词', meaning:'亲切'},
  '丁寧': {reading:'ていねい', level:'N4', pos:'形容动词', meaning:'认真、礼貌'},
  'でも': {reading:'でも', level:'N5', pos:'接续词', meaning:'但是、不过'},
  '教えて': {reading:'おしえて', level:'N5', pos:'动词', meaning:'教、告诉'},
  '週末': {reading:'しゅうまつ', level:'N4', pos:'名词', meaning:'周末'},
  '時間': {reading:'じかん', level:'N5', pos:'名词', meaning:'时间'},
  '映画': {reading:'えいが', level:'N5', pos:'名词', meaning:'电影'},
  '本': {reading:'ほん', level:'N5', pos:'名词', meaning:'书'},
  '読み': {reading:'よみ', level:'N5', pos:'动词', meaning:'读'}
};

const FALLBACK_TYPING_PROMPTS = [
  {level:'N5', grammar:'です', cn:'我是学生。', ja:'私は学生です。', hint:'私は + 名词 + です'},
  {level:'N5', grammar:'ます形', cn:'我每天早上七点起床。', ja:'私は毎朝七時に起きます。', hint:'毎朝 / 七時 / 起きます'},
  {level:'N5', grammar:'を', cn:'我吃早饭。', ja:'朝ごはんを食べます。', hint:'对象 + を + 动词'},
  {level:'N5', grammar:'で', cn:'我在图书馆学习。', ja:'図書館で勉強します。', hint:'地点 + で + 动作'},
  {level:'N4', grammar:'てから', cn:'吃早饭之后去学校。', ja:'朝ごはんを食べてから、学校に行きます。', hint:'て形 + から'},
  {level:'N4', grammar:'たりたり', cn:'周末看电影、读书。', ja:'週末は映画を見たり、本を読んだりします。', hint:'見たり / 読んだり'}
];

const DATA_ASSET_VERSION = '20260719-02';
const DATA_FILES = {
  dictionary: `data/dictionary.json?v=${DATA_ASSET_VERSION}`,
  sample: `data/sample.json?v=${DATA_ASSET_VERSION}`,
  typingPrompts: `data/typing-prompts.json?v=${DATA_ASSET_VERSION}`,
  grammarPoints: `data/grammar-points.json?v=${DATA_ASSET_VERSION}`
};

const THIRD_PARTY_SCRIPTS = {
  kuromoji:'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js',
  pptx:'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
  pdfjs:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  pdfjsWorker:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
};
// Building the remote Kuromoji dictionary on the main thread can freeze or
// crash a fresh browser tab. Keep the responsive local dictionary path as the
// MVP default until the tokenizer is self-hosted and moved off the main thread.
const ENABLE_REMOTE_SMART_SEGMENTATION = false;
const ENABLE_LOCAL_KUROMOJI_WORKER = true;
const LOCAL_KUROMOJI_ASSET_VERSION = '20260714-01';
const LOCAL_KUROMOJI_WORKER_URL = `vendor/kuromoji/${LOCAL_KUROMOJI_ASSET_VERSION}/kuromoji-tokenizer.worker.js`;
const LOCAL_KUROMOJI_WORKER_INIT_TIMEOUT_MS = 90000;
const LOCAL_KUROMOJI_WORKER_TOKENIZE_TIMEOUT_MS = 10000;
const EXTERNAL_SCRIPT_LOADS = new Map();

function withTimeout(promise, ms, message){
  let timer = null;
  const timeout = new Promise((_, reject)=>{
    timer = setTimeout(()=>reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(()=>clearTimeout(timer));
}

function loadExternalScript(src, globalName){
  if(window[globalName]) return Promise.resolve(window[globalName]);
  if(EXTERNAL_SCRIPT_LOADS.has(src)) return EXTERNAL_SCRIPT_LOADS.get(src);
  const loading = new Promise((resolve, reject)=>{
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = ()=>window[globalName]
      ? resolve(window[globalName])
      : reject(new Error(`${globalName} 加载后不可用`));
    script.onerror = ()=>reject(new Error(`${globalName} 加载失败`));
    document.head.appendChild(script);
  }).catch(error=>{
    EXTERNAL_SCRIPT_LOADS.delete(src);
    throw error;
  });
  EXTERNAL_SCRIPT_LOADS.set(src, loading);
  return loading;
}

async function fetchJson(path){
  const response = await withTimeout(fetch(path), 4500, `${path} 加载超时`);
  if(!response.ok) throw new Error(`${path} 加载失败（HTTP ${response.status}）`);
  return response.json();
}

async function loadLearningData(){
  if(location.protocol === 'file:'){
    DICT = prepareCuratedDictionary(FALLBACK_DICTIONARY);
    SAMPLE_ARTICLES = [...FALLBACK_SAMPLE_ARTICLES];
    SAMPLE_TEXT = FALLBACK_SAMPLE_TEXT;
    TYPING_PROMPTS = [...FALLBACK_TYPING_PROMPTS];
    GRAMMAR_POINTS = [];
    recordPerformanceMark('dictionary_ready');
    console.warn('当前通过本地文件打开页面，浏览器会阻止读取 data/*.json，已使用内置兜底数据。建议通过本地网页服务或正式部署地址打开。');
    return;
  }
  const [dictionaryResult, sampleResult, typingResult, grammarResult] = await Promise.allSettled([
    fetchJson(DATA_FILES.dictionary),
    fetchJson(DATA_FILES.sample),
    fetchJson(DATA_FILES.typingPrompts),
    fetchJson(DATA_FILES.grammarPoints)
  ]);
  DICT = prepareCuratedDictionary(dictionaryResult.status === 'fulfilled' && dictionaryResult.value
    ? dictionaryResult.value
    : FALLBACK_DICTIONARY);
  await applyJlptReferenceToDictionary(DICT);
  SAMPLE_ARTICLES = sampleResult.status === 'fulfilled' && Array.isArray(sampleResult.value?.samples) && sampleResult.value.samples.length
    ? sampleResult.value.samples.slice(0, 3)
    : [...FALLBACK_SAMPLE_ARTICLES];
  SAMPLE_TEXT = SAMPLE_ARTICLES[0]?.text || FALLBACK_SAMPLE_TEXT;
  TYPING_PROMPTS = typingResult.status === 'fulfilled' && Array.isArray(typingResult.value) && typingResult.value.length
    ? typingResult.value
    : [...FALLBACK_TYPING_PROMPTS];
  GRAMMAR_POINTS = grammarResult.status === 'fulfilled' && Array.isArray(grammarResult.value)
    ? grammarResult.value
    : [];
  const failed = [dictionaryResult, sampleResult, typingResult, grammarResult].filter(result => result.status === 'rejected');
  if(failed.length){
    console.warn('部分学习数据加载失败,已使用本地兜底数据', failed.map(result => result.reason));
  }
  recordPerformanceMark('dictionary_ready');
}

function prepareCuratedDictionary(dictionary){
  return Object.fromEntries(Object.entries(dictionary || {}).map(([word, item])=>[word, {
    ...item,
    meaning:cleanStoredMeaning(item?.meaning),
    meaningLanguage:'zh',
    meaningSource:'offline-chinese'
  }]));
}

async function applyJlptReferenceToDictionary(dictionary){
  const index = await loadJlptReferenceIndex();
  if(!index) return;
  for(const [word, info] of Object.entries(dictionary || {})){
    const lookupPlan = buildCuratedLexicalLookupPlan(word, info);
    const level = lookupCandidatesForSource(lookupPlan, 'jlpt')
      .map(candidate=>index[candidate.term])
      .find(normalizeVisibleVocabLevel) || '';
    info.level = normalizeVisibleVocabLevel(level);
    info.levelSource = 'jlpt-reference';
  }
}

function showDataLoadError(error){
  const message = '学习数据没有加载成功。请通过本地网页服务或正式部署地址打开页面，然后刷新重试。';
  const output = document.getElementById('output');
  if(output){
    output.innerHTML = `<span style="color:var(--trap);font-size:14.5px;">${escapeHtml(message)}</span>`;
  }
  const grammar = document.getElementById('grammarGrid');
  if(grammar){
    grammar.innerHTML = `<div class="grammar-empty">${escapeHtml(message)}</div>`;
  }
  setTokenizerStatus('学习数据未加载，暂时不能分析文本', '');
  setImportStatus(`${message}${error?.message ? ' 浏览器提示: ' + error.message : ''}`, 'error');
}

function ensureLearningData(){
  if(!DATA_READY) DATA_READY = loadLearningData();
  return DATA_READY;
}

function scheduleLearningDataHydration(){
  const hydrate = async ()=>{
    try{
      await ensureLearningData();
    }catch(error){
      showDataLoadError(error);
    }
    renderGrammar();
    renderTypingPractice();
  };
  if(typeof requestIdleCallback === 'function') requestIdleCallback(hydrate, {timeout:1200});
  else setTimeout(hydrate, 300);
}

let currentTypingIndex = 0;
let articlePracticeMode = 'cloze';
let ACTIVE_PRACTICE_MODULE = 'quiz';
let PRACTICE_STATS = loadPracticeStats();
let PRACTICE_HISTORY = loadPracticeHistory();
syncPracticeHistory();
let CURRENT_ARTICLE_TEXT = '';
let CURRENT_ARTICLE_URL = '';
let CURRENT_ARTICLE_PRACTICE_KEY = '';
let SHOW_PARAGRAPH_TRANSLATION = false;
let READING_QUIZ_ITEMS = [];
let READING_QUIZ_CURRENT_INDEX = 0;
let READING_QUIZ_ATTEMPT_RECORDED = false;
let READING_QUIZ_HAS_RESULT = false;
let READING_QUIZ_HISTORY = loadReadingQuizHistory();
let RETELL_RECOGNITION = null;
let RETELL_RECORDING = false;
let RETELL_MEDIA_RECORDER = null;
let RETELL_AUDIO_CHUNKS = [];
let RETELL_AUDIO_URL = null;
let RETELL_PERMISSION_TRIGGER = null;
let RETELL_SPEAKING = false;

let KUROMOJI_TOKENIZER = null;
let KUROMOJI_LOADING = null;
let LOCAL_KUROMOJI_WORKER_CLIENT = null;
let LOCAL_KUROMOJI_PREWARM_PROMISE = null;
let LOCAL_KUROMOJI_PREWARM_STATE = 'idle';
let LOCAL_KUROMOJI_LAST_METRICS = null;
let LOCAL_KUROMOJI_PREWARM_TIMER = 0;
let TOKENIZER_STATUS_HIDE_TIMER = 0;
let TOKENIZER_PROGRESS_TIMERS = [];
let LOCAL_KUROMOJI_RENDER_GENERATION = 0;
let TOKENIZER_LAST_ATTEMPT_FAILED = false;
let TOKENIZER_READY_EVENT_SENT = false;
let TOKENIZER_CACHE_STATUS_AT_START = 'cold';
let LAST_READING_RETRY_COUNT = 0;
let LAST_READING_GENERATION_RESULT = null;
let SOURCE_ANALYSIS_GENERATION = 0;
window.KUROMOJI_TOKEN_CACHE = [];
let RUBY_OVERRIDES = {};
try{ RUBY_OVERRIDES = JSON.parse(safeStorage.getItem('reading_ruby_overrides') || '{}'); }catch{}
// Correct a bad reading that was written by an older build. Keep all other
// user edits, but never allow this known-corrupt legacy value to win.
if(RUBY_OVERRIDES['丁寧']?.reading === 'あつやす'){
  RUBY_OVERRIDES['丁寧'] = {reading:'ていねい', hidden:false};
  safeStorage.setItem('reading_ruby_overrides', JSON.stringify(RUBY_OVERRIDES));
}
let IS_ANNOTATION_EDITING = false;
let ANNOTATION_EDIT_SNAPSHOT = [];
let CURRENT_FOOTNOTES = [];
let READING_HISTORY = [];
let READING_QUEUE = loadReadingQueue();
let ACTIVE_READING_QUEUE_ID = Number(safeStorage.getItem('reading_queue_active_id') || 0) || null;
let LEARNING_GOALS = loadLearningGoals();
let PRACTICE_REVIEW = loadPracticeReview();

function practiceDateKey(){
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function defaultPracticeStats(){
  return {
    date: practiceDateKey(),
    total: 0,
    vocab: { again:0, hard:0, easy:0 },
    typing: { count:0, lastScore:null },
    cloze: { count:0, lastCorrect:null, lastTotal:null }
  };
}

function loadPracticeStats(){
  try{
    const stored = JSON.parse(safeStorage.getItem('reading_practice_stats') || 'null');
    if(stored && stored.date === practiceDateKey()){
      return {
        ...defaultPracticeStats(),
        ...stored,
        vocab: { again:0, hard:0, easy:0, ...(stored.vocab || {}) },
        typing: { count:0, lastScore:null, ...(stored.typing || {}) },
        cloze: { count:0, lastCorrect:null, lastTotal:null, ...(stored.cloze || {}) }
      };
    }
  }catch{}
  return defaultPracticeStats();
}

function savePracticeStats(){
  safeStorage.setItem('reading_practice_stats', JSON.stringify(PRACTICE_STATS));
}

function normalizePracticeStats(stats, date = practiceDateKey()){
  return {
    ...defaultPracticeStats(),
    ...(stats || {}),
    date,
    vocab: { again:0, hard:0, easy:0, ...(stats?.vocab || {}) },
    typing: { count:0, lastScore:null, ...(stats?.typing || {}) },
    cloze: { count:0, lastCorrect:null, lastTotal:null, ...(stats?.cloze || {}) }
  };
}

function loadPracticeHistory(){
  try{
    const stored = JSON.parse(safeStorage.getItem('reading_practice_history') || '[]');
    if(!Array.isArray(stored)) return [];
    return stored
      .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item?.date || ''))
      .map(item => normalizePracticeStats(item, item.date))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
  }catch{
    return [];
  }
}

function syncPracticeHistory(){
  if(PRACTICE_STATS.date !== practiceDateKey()){
    const previous = normalizePracticeStats(PRACTICE_STATS, PRACTICE_STATS.date || practiceDateKey());
    PRACTICE_HISTORY = [
      previous,
      ...PRACTICE_HISTORY.filter(item => item.date !== previous.date)
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
    PRACTICE_STATS = defaultPracticeStats();
    savePracticeStats();
  }
  const normalized = normalizePracticeStats(PRACTICE_STATS, PRACTICE_STATS.date);
  const remaining = PRACTICE_HISTORY.filter(item => item.date !== normalized.date);
  PRACTICE_HISTORY = [normalized, ...remaining]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
  safeStorage.setItem('reading_practice_history', JSON.stringify(PRACTICE_HISTORY));
}

function recordPracticeResult(type, payload = {}){
  if(PRACTICE_STATS.date !== practiceDateKey()) PRACTICE_STATS = defaultPracticeStats();
  PRACTICE_STATS.total += 1;
  if(type === 'typing'){
    PRACTICE_STATS.typing.count += 1;
    PRACTICE_STATS.typing.lastScore = payload.score;
  }
  if(type === 'cloze' || type === 'quiz'){
    PRACTICE_STATS.cloze.count += 1;
    PRACTICE_STATS.cloze.lastCorrect = payload.correct;
    PRACTICE_STATS.cloze.lastTotal = payload.total;
  }
  if(type === 'vocab'){
    const rating = payload.rating || 'hard';
    PRACTICE_STATS.vocab[rating] = (PRACTICE_STATS.vocab[rating] || 0) + 1;
  }
  savePracticeStats();
  syncPracticeHistory();
  renderPracticeSummary();
  renderPracticeReview();
  renderLearningProgress();
  renderDailyPlan();
  if(document.body.dataset.view === 'history') renderReadingHistory();
}

function loadPracticeReview(){
  try{
    const stored = JSON.parse(safeStorage.getItem('reading_practice_review') || '[]');
    if(!Array.isArray(stored)) return [];
    return stored
      .filter(item => item && item.id && item.type && item.title)
      .map(item => ({
        id:String(item.id),
        key:String(item.key || item.id),
        type:String(item.type),
        title:String(item.title),
        prompt:String(item.prompt || ''),
        answer:String(item.answer || ''),
        note:String(item.note || ''),
        createdAt:Number(item.createdAt || Date.now()),
        lastSeenAt:Number(item.lastSeenAt || item.createdAt || Date.now()),
        count:Math.max(1, Number(item.count || 1)),
        status:item.status === 'done' ? 'done' : 'active',
        target:Number.isFinite(Number(item.target)) ? Number(item.target) : null
      }))
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, 30);
  }catch{
    return [];
  }
}

function savePracticeReview(){
  safeStorage.setItem('reading_practice_review', JSON.stringify(PRACTICE_REVIEW.slice(0, 30)));
}

function addPracticeReviewItem(item){
  const now = Date.now();
  const key = String(item.key || `${item.type}:${item.title}`);
  const existing = PRACTICE_REVIEW.find(entry => entry.key === key);
  if(existing){
    existing.title = String(item.title || existing.title);
    existing.prompt = String(item.prompt || existing.prompt || '');
    existing.answer = String(item.answer || existing.answer || '');
    existing.note = String(item.note || existing.note || '');
    existing.target = Number.isFinite(Number(item.target)) ? Number(item.target) : existing.target;
    existing.count = Math.max(1, Number(existing.count || 1) + 1);
    existing.lastSeenAt = now;
    existing.status = 'active';
  } else {
    PRACTICE_REVIEW.unshift({
      id:`${now}-${Math.random().toString(36).slice(2, 8)}`,
      key,
      type:String(item.type || 'practice'),
      title:String(item.title || '需要回看'),
      prompt:String(item.prompt || ''),
      answer:String(item.answer || ''),
      note:String(item.note || ''),
      createdAt:now,
      lastSeenAt:now,
      count:1,
      status:'active',
      target:Number.isFinite(Number(item.target)) ? Number(item.target) : null
    });
  }
  PRACTICE_REVIEW = PRACTICE_REVIEW
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, 30);
  savePracticeReview();
  renderPracticeReview();
}

function resolvePracticeReview(key){
  const item = PRACTICE_REVIEW.find(entry => entry.key === key);
  if(!item || item.status === 'done') return;
  item.status = 'done';
  savePracticeReview();
  renderPracticeReview();
}

function clearPracticeReview(){
  PRACTICE_REVIEW = PRACTICE_REVIEW.filter(item => item.status !== 'done');
  savePracticeReview();
  renderPracticeReview();
}

function practiceReviewTypeLabel(type){
  return {
    vocab:'生词',
    typing:'打字',
    cloze:'选择题',
    quiz:'选择题'
  }[type] || '练习';
}

function renderPracticeReview(){
  const list = document.getElementById('practiceReviewList');
  if(!list) return;
  const active = PRACTICE_REVIEW.filter(item => item.status !== 'done').slice(0, 6);
  if(!active.length){
    list.innerHTML = '<div class="practice-review-empty">还没有错题。做练习时，不认识的生词、打字失误和选择题错题会自动出现在这里。</div>';
    return;
  }
  list.innerHTML = active.map(item => `
    <article class="practice-review-item">
      <div>
        <div class="practice-review-meta">
          <span>${practiceReviewTypeLabel(item.type)}</span>
          <span>出现 ${item.count} 次</span>
        </div>
        <h4>${escapeHtml(item.title)}</h4>
        ${item.prompt ? `<p>${escapeHtml(item.prompt)}</p>` : ''}
        ${item.answer ? `<small>参考：${escapeHtml(item.answer)}</small>` : ''}
        ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}
      </div>
      <div class="practice-review-actions">
        <button class="btn-primary" type="button" onclick="openPracticeReviewItem('${encodeURIComponent(item.id)}')">去补</button>
        <button class="btn-ghost" type="button" onclick="markPracticeReviewDone('${encodeURIComponent(item.id)}')">已掌握</button>
      </div>
    </article>
  `).join('');
}

function findPracticeReviewItem(encodedId){
  const id = decodeURIComponent(encodedId || '');
  return PRACTICE_REVIEW.find(item => item.id === id);
}

function openPracticeReviewItem(encodedId){
  const item = findPracticeReviewItem(encodedId);
  if(!item) return;
  if(item.type === 'vocab'){
    switchWorkspace('vocab');
    return;
  }
  if(item.type === 'typing'){
    if(Number.isInteger(item.target) && TYPING_PROMPTS[item.target]) currentTypingIndex = item.target;
    switchWorkspace('retell');
    renderTypingPractice();
    document.getElementById('typingPracticeModule')?.scrollIntoView({behavior:'smooth', block:'start'});
    return;
  }
  switchWorkspace('retell');
  focusPracticeModule('quiz');
  document.getElementById('articlePracticeModule')?.scrollIntoView({behavior:'smooth', block:'start'});
}

function markPracticeReviewDone(encodedId){
  const item = findPracticeReviewItem(encodedId);
  if(!item) return;
  item.status = 'done';
  savePracticeReview();
  renderPracticeReview();
}

function renderPracticeSummary(){
  syncPracticeHistory();
  const grid = document.getElementById('practiceSummaryGrid');
  if(!grid) return;
  const typingScore = PRACTICE_STATS.typing.lastScore === null ? '未练习' : `${PRACTICE_STATS.typing.lastScore}%`;
  const clozeScore = PRACTICE_STATS.cloze.lastTotal === null ? '未练习' : `${PRACTICE_STATS.cloze.lastCorrect}/${PRACTICE_STATS.cloze.lastTotal}`;
  grid.innerHTML = `
    <div><b>${PRACTICE_STATS.total}</b><span>今日练习</span></div>
    <div><b>${PRACTICE_STATS.vocab.easy}</b><span>认识</span></div>
    <div><b>${PRACTICE_STATS.vocab.hard}</b><span>模糊</span></div>
    <div><b>${PRACTICE_STATS.vocab.again}</b><span>不认识</span></div>
    <div><b>${typingScore}</b><span>打字最近</span></div>
    <div><b>${clozeScore}</b><span>选择题最近</span></div>
  `;
}

function recentPracticeDays(count = 7){
  const byDate = new Map(PRACTICE_HISTORY.map(item => [item.date, item]));
  return Array.from({length:count}, (_, offset) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - offset));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return byDate.get(key) || normalizePracticeStats(null, key);
  });
}

function practiceStreak(){
  const practiced = new Set(PRACTICE_HISTORY.filter(item => item.total > 0).map(item => item.date));
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if(!practiced.has(practiceDateKey())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while(streak < 365){
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if(!practiced.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderLearningProgress(){
  const summary = document.getElementById('weeklyProgressSummary');
  const days = recentPracticeDays();
  const total = days.reduce((sum, day) => sum + Number(day.total || 0), 0);
  const activeDays = days.filter(day => day.total > 0).length;
  const needsReview = days.reduce((sum, day) => sum + Number(day.vocab.again || 0), 0);
  const maxTotal = Math.max(1, ...days.map(day => Number(day.total || 0)));
  if(summary){
    summary.innerHTML = `
      <div><b>${total}</b><span>7 天练习</span></div>
      <div><b>${activeDays}</b><span>练习天数</span></div>
      <div><b>${practiceStreak()}</b><span>连续天数</span></div>
      <div><b>${needsReview}</b><span>需加强词汇</span></div>
    `;
  }
  const oldChart = document.getElementById('weeklyPracticeChart');
  if(oldChart){
    oldChart.innerHTML = days.map(day => {
      const date = new Date(`${day.date}T12:00:00`);
      const label = date.toLocaleDateString('zh-CN', {weekday:'short'}).replace('周', '');
      const height = day.total ? Math.max(14, Math.round(day.total / maxTotal * 100)) : 4;
      return `<div class="weekly-practice-day" title="${day.date}：${day.total} 次练习">
        <span class="weekly-practice-value">${day.total || ''}</span>
        <span class="weekly-practice-bar${day.total ? ' is-active' : ''}" style="height:${height}%"></span>
        <span class="weekly-practice-label">${label}</span>
      </div>`;
    }).join('');
  }
  const heatmap = document.getElementById('historyHeatmap');
  if(heatmap){
    heatmap.innerHTML = recentActivityDays(30).map(day => `
      <div class="history-heat-box ${heatClassForActivity(day.total)}" title="${day.date}：${day.total} 次学习"></div>
    `).join('');
  }
  const barChart = document.getElementById('historyBarChart');
  const barLabels = document.getElementById('historyBarLabels');
  if(barChart){
    barChart.innerHTML = days.map(day => {
      const height = day.total ? Math.max(12, Math.round(day.total / maxTotal * 100)) : 4;
      const active = day.total === maxTotal && day.total > 0 ? ' is-strong' : '';
      return `<div class="history-bar${active}" style="height:${height}%" title="${day.date}：${day.total} 次练习"></div>`;
    }).join('');
  }
  if(barLabels){
    barLabels.innerHTML = days.map(day => {
    const date = new Date(`${day.date}T12:00:00`);
    const label = date.toLocaleDateString('zh-CN', {weekday:'short'}).replace('周', '');
    return `<span>${label}</span>`;
    }).join('');
  }
}

function isDateToday(value){
  const date = new Date(value);
  const today = new Date();
  if(Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function defaultLearningGoals(){
  return {
    readingTarget: 1,
    vocabTarget: 5,
    practiceTarget: 1,
    focus: 'balanced'
  };
}

function clampGoalNumber(value, min, max, fallback){
  const number = Math.round(Number(value));
  if(!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeLearningGoals(goals){
  const fallback = defaultLearningGoals();
  const focus = ['balanced', 'reading', 'vocab', 'practice'].includes(goals?.focus) ? goals.focus : fallback.focus;
  return {
    readingTarget: clampGoalNumber(goals?.readingTarget, 0, 5, fallback.readingTarget),
    vocabTarget: clampGoalNumber(goals?.vocabTarget, 0, 50, fallback.vocabTarget),
    practiceTarget: clampGoalNumber(goals?.practiceTarget, 0, 20, fallback.practiceTarget),
    focus
  };
}

function loadLearningGoals(){
  try{
    return normalizeLearningGoals(JSON.parse(safeStorage.getItem('reading_learning_goals') || 'null'));
  }catch{
    return defaultLearningGoals();
  }
}

function saveLearningGoals(event){
  if(event) event.preventDefault();
  LEARNING_GOALS = normalizeLearningGoals({
    readingTarget: document.getElementById('goalReadingTarget')?.value,
    vocabTarget: document.getElementById('goalVocabTarget')?.value,
    practiceTarget: document.getElementById('goalPracticeTarget')?.value,
    focus: document.getElementById('goalFocus')?.value
  });
  safeStorage.setItem('reading_learning_goals', JSON.stringify(LEARNING_GOALS));
  renderLearningGoals();
  renderDailyPlan();
  document.getElementById('dailyGoalSettings')?.classList.add('is-hidden');
}

function toggleLearningGoalSettings(){
  const panel = document.getElementById('dailyGoalSettings');
  if(!panel) return;
  renderLearningGoals();
  panel.classList.toggle('is-hidden');
}

function focusLabel(value){
  return {
    balanced:'均衡',
    reading:'阅读优先',
    vocab:'生词优先',
    practice:'练习优先'
  }[value] || '均衡';
}

function renderLearningGoals(){
  const goals = normalizeLearningGoals(LEARNING_GOALS);
  LEARNING_GOALS = goals;
  const readingInput = document.getElementById('goalReadingTarget');
  const vocabInput = document.getElementById('goalVocabTarget');
  const practiceInput = document.getElementById('goalPracticeTarget');
  const focusSelect = document.getElementById('goalFocus');
  if(readingInput) readingInput.value = goals.readingTarget;
  if(vocabInput) vocabInput.value = goals.vocabTarget;
  if(practiceInput) practiceInput.value = goals.practiceTarget;
  if(focusSelect) focusSelect.value = goals.focus;
  const summary = document.getElementById('dailyGoalSummary');
  if(summary){
    summary.textContent = '';
  }
}

function localDateKey(value = new Date()){
  const date = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function learningActivityStreak(){
  const activeDates = new Set(
    PRACTICE_HISTORY.filter(item => Number(item.total || 0) > 0).map(item => item.date)
  );
  READING_HISTORY.forEach(item => {
    const key = localDateKey(item.date);
    if(key) activeDates.add(key);
  });
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if(!activeDates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while(streak < 365 && activeDates.has(localDateKey(cursor))){
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function dailyTaskState(){
  syncPracticeHistory();
  const vocab = getAllVocab();
  const dueCount = vocab.filter(item => isDue(item)).length;
  const vocabPracticeCount = Object.values(PRACTICE_STATS.vocab).reduce((sum, count) => sum + Number(count || 0), 0);
  const exerciseCount = Number(PRACTICE_STATS.typing.count || 0) + Number(PRACTICE_STATS.cloze.count || 0);
  const goals = normalizeLearningGoals(LEARNING_GOALS);
  const readingCount = READING_HISTORY.filter(item => isDateToday(item.date)).length;
  const hasReadToday = readingCount >= goals.readingTarget;
  const hasEnoughVocabPractice = goals.vocabTarget <= 0 || vocabPracticeCount >= goals.vocabTarget;
  const hasEnoughPractice = exerciseCount >= goals.practiceTarget;
  const tasks = [
    {
      type:'reading',
      title:goals.readingTarget <= 0 ? '阅读今日休息' : goals.readingTarget > 1 ? `阅读 ${goals.readingTarget} 篇文章` : '阅读一篇文章',
      detail:goals.readingTarget <= 0 ? '今天不安排阅读任务' : hasReadToday ? `已读 ${readingCount}/${goals.readingTarget} 篇` : `已读 ${readingCount}/${goals.readingTarget}，导入文章并分析`,
      done:hasReadToday,
      action:'去阅读'
    },
    {
      type:'vocab',
      title:goals.vocabTarget > 0 ? `练 ${goals.vocabTarget} 个生词` : '生词今日休息',
      detail:goals.vocabTarget <= 0 ? '今天不安排生词任务' : !vocab.length ? `已练 0/${goals.vocabTarget}，先收藏生词` : dueCount ? `已练 ${vocabPracticeCount}/${goals.vocabTarget}，${dueCount} 个到期` : `已练 ${vocabPracticeCount}/${goals.vocabTarget}`,
      done:hasEnoughVocabPractice,
      action:!vocab.length ? '去收藏' : dueCount ? '去复习' : '再练一组'
    },
    {
      type:'practice',
      title:goals.practiceTarget <= 0 ? '练习今日休息' : goals.practiceTarget > 1 ? `完成 ${goals.practiceTarget} 次练习` : '完成一次练习',
      detail:goals.practiceTarget <= 0 ? '今天不安排练习任务' : hasEnoughPractice ? `已做 ${exerciseCount}/${goals.practiceTarget} 次` : `已做 ${exerciseCount}/${goals.practiceTarget}，文章理解或句型打字`,
      done:hasEnoughPractice,
      action:'去练习'
    }
  ];
  if(goals.focus !== 'balanced'){
    tasks.sort((a, b) => Number(b.type === goals.focus) - Number(a.type === goals.focus));
  }
  return tasks;
}

function renderDailyPlan(){
  renderLearningGoals();
  renderLearningPath();
}

function guidedPathSteps(){
  const hasReading = !!CURRENT_ARTICLE_TEXT.trim() || READING_HISTORY.some(item => isDateToday(item.date));
  const vocabCount = getAllVocab().length;
  const vocabPracticeCount = Object.values(PRACTICE_STATS.vocab).reduce((sum, count) => sum + Number(count || 0), 0);
  const exerciseCount = Number(PRACTICE_STATS.typing.count || 0) + Number(PRACTICE_STATS.cloze.count || 0);
  const hasSourceReading = READING_HISTORY.some(item => !!item.url);
  return [
    {
      type:'reading',
      title:'放入一篇文章',
      detail:hasReading ? '已经有可学习的文章' : '先粘贴日语文本',
      done:hasReading,
      action:'开始阅读'
    },
    {
      type:'vocab',
      title:'点词并收藏生词',
      detail:vocabCount ? `生词本已有 ${vocabCount} 个词` : '阅读时点击词语，先收藏几个',
      done:vocabCount > 0,
      action:vocabCount ? '复习生词' : '去收藏'
    },
    {
      type:'practice',
      title:'做一次练习',
      detail:(vocabPracticeCount + exerciseCount) ? '今天已经开始练习' : '文章理解、生词或句型打字任选一种',
      done:(vocabPracticeCount + exerciseCount) > 0,
      action:'去练习'
    },
    {
      type:'discover',
      title:'找下一篇材料',
      detail:hasSourceReading ? '已经从推荐来源读过文章' : '从资料页选择适合的阅读来源',
      done:hasSourceReading,
      action:'找材料'
    }
  ];
}

function nextGuidedStep(){
  const steps = guidedPathSteps();
  return steps.find(step => !step.done) || steps[0];
}

function renderLearningPath(){
  const list = document.getElementById('learningPathSteps');
  const action = document.getElementById('learningPathAction');
  const progress = document.getElementById('dailyPlanProgress');
  const title = document.getElementById('dailyPlanTitle');
  const readingNextAction = document.getElementById('readingNextAction');
  if(!list) return;
  const steps = guidedPathSteps();
  const next = steps.find(step => !step.done);
  const completed = steps.filter(step => step.done).length;
  if(next){
    if(title) title.textContent = next.title;
    if(action){
      action.textContent = next.action;
      action.dataset.step = next.type;
    }
    if(readingNextAction) readingNextAction.textContent = '去练习';
  }else{
    if(title) title.textContent = '今天的学习已完成';
    if(action){
      action.textContent = '找下一篇';
      action.dataset.step = 'discover';
    }
    if(readingNextAction) readingNextAction.textContent = '去练习';
  }
  if(progress){
    progress.textContent = `${completed} / ${steps.length}`;
    progress.classList.toggle('is-complete', completed === steps.length);
  }
  const pathMarkup = steps.map((step, index) => `
    <button class="learning-path-step${step.done ? ' is-done' : ''}${step.type === next?.type ? ' is-current' : ''}" type="button" onclick="openGuidedStep('${step.type}')">
      <span>${step.done ? '✓' : index + 1}</span>
      <b>${step.title}</b>
      <small>${step.detail}</small>
    </button>
  `).join('');
  list.innerHTML = pathMarkup;
}

function openGuidedStep(type = ''){
  const target = type || document.getElementById('learningPathAction')?.dataset.step || nextGuidedStep().type;
  if(target === 'reading') return openDailyTask('reading');
  if(target === 'vocab') return openDailyTask('vocab');
  if(target === 'practice') return openDailyTask('practice');
  if(target === 'discover'){
    switchWorkspace('discover');
  }
}

const GLOBAL_SEARCH_ITEMS = [
  {label:'开始阅读', detail:'粘贴日语文本', keywords:'阅读 开始 粘贴 日语 文本', action:()=>switchWorkspace('reading')},
  {label:'整理生词本', detail:'搜索、筛选、管理收藏词', keywords:'生词 单词 词汇 收藏 搜索 筛选', action:()=>switchWorkspace('vocab')},
  {label:'素材库', detail:'浏览分级短文、官方资讯与阅读来源', keywords:'素材 阅读 资讯 新闻 留学 EJU JLPT 日本生活 官方', action:()=>openContentFeed()},
  {label:'复习到期词', detail:'打开闪卡复习', keywords:'复习 闪卡 到期 生词', action:()=>startReview()},
  {label:'练生词', detail:'打开生词本闪卡复习', keywords:'练习 生词 自测 闪卡', action:()=>switchWorkspace('vocab')},
  {label:'备份数据', detail:'在设置与数据管理中导出或恢复学习数据', keywords:'备份 恢复 导出 数据 设置', action:()=>switchWorkspace('settings')}
];

function globalSearchMatches(item, keyword){
  const text = `${item.label} ${item.detail} ${item.keywords}`.toLowerCase();
  return text.includes(keyword.toLowerCase());
}

function renderGlobalSearch(){
  const input = document.getElementById('globalSearchInput');
  const panel = document.getElementById('globalSearchResults');
  if(!input || !panel) return;
  const keyword = input.value.trim();
  if(!keyword){
    panel.innerHTML = '';
    panel.classList.remove('active');
    return;
  }
  const matches = GLOBAL_SEARCH_ITEMS.filter(item => globalSearchMatches(item, keyword)).slice(0, 6);
  panel.classList.add('active');
  panel.innerHTML = matches.length
    ? matches.map((item, index) => `
      <button type="button" onclick="openGlobalSearchResult(${index})">
        <b>${escapeHtml(item.label)}</b>
        <small>${escapeHtml(item.detail)}</small>
      </button>
    `).join('')
    : '<div class="global-search-empty">没有找到对应功能</div>';
  panel.dataset.matches = JSON.stringify(matches.map(item => item.label));
}

function openGlobalSearchResult(index = 0){
  const input = document.getElementById('globalSearchInput');
  const keyword = (input?.value || '').trim();
  const matches = keyword ? GLOBAL_SEARCH_ITEMS.filter(item => globalSearchMatches(item, keyword)).slice(0, 6) : [];
  const item = matches[index];
  if(!item) return;
  item.action();
  if(input) input.value = '';
  const panel = document.getElementById('globalSearchResults');
  if(panel){
    panel.innerHTML = '';
    panel.classList.remove('active');
  }
}

function handleGlobalSearchKey(event){
  if(event.key === 'Enter'){
    event.preventDefault();
    openGlobalSearchResult(0);
  }
  if(event.key === 'Escape'){
    event.currentTarget.value = '';
    renderGlobalSearch();
  }
}

function openDailyTask(type){
  if(type === 'reading'){
    const nextUnread = READING_QUEUE.find(item => item.status !== 'read');
    if(nextUnread){
      openReadingQueueItem(nextUnread.id);
      return;
    }
    switchWorkspace('reading');
    document.getElementById('sourceComposer')?.scrollIntoView({behavior:'smooth', block:'start'});
    return;
  }
  if(type === 'vocab'){
    const vocab = getAllVocab();
    if(!vocab.length){
      switchWorkspace('reading');
      document.getElementById('output')?.scrollIntoView({behavior:'smooth', block:'start'});
    } else if(vocab.some(item => isDue(item))){
      startReview();
    } else {
      reviewAllVocab();
    }
    return;
  }
  switchWorkspace('retell');
  document.querySelector('.retell-section')?.scrollIntoView({behavior:'smooth', block:'start'});
}

function loadReadingQueue(){
  try{
    const stored = JSON.parse(safeStorage.getItem('reading_queue') || '[]');
    return normalizeReadingQueueItems(stored);
  }catch{
    return [];
  }
}

function normalizeReadingQueueItems(items){
  if(!Array.isArray(items)) return [];
  const now = Date.now();
  return items.flatMap((item, index) => {
    const url = readingQueueUrl(item?.url);
    if(!url) return [];
    const storedId = Number(item?.id);
    return [{
      id:Number.isFinite(storedId) && storedId > 0 ? storedId : now + index,
      title:String(item?.title || readingQueueFallbackTitle(url)).trim().slice(0, 80),
      url,
      status:item?.status === 'read' ? 'read' : 'unread',
      addedAt:String(item?.addedAt || new Date().toISOString()),
      readAt:item?.status === 'read' ? String(item?.readAt || new Date().toISOString()) : null,
      contentItemId:String(item?.contentItemId || '').trim() || null,
      sourceType:item?.sourceType === 'content_engine' ? 'content_engine' : null,
      category:String(item?.category || '').trim() || null,
      learningLevel:/^N[1-5]$/.test(String(item?.learningLevel || '')) ? String(item.learningLevel) : null,
      sourceUrl:readingQueueUrl(item?.sourceUrl || url) || url,
      sourceLinks:normalizeReadingQueueSourceLinks(item?.sourceLinks, item?.sourceUrl || url)
    }];
  }).slice(0, 100);
}

function saveReadingQueue(){
  safeStorage.setItem('reading_queue', JSON.stringify(READING_QUEUE.slice(0, 100)));
}

function readingQueueUrl(value){
  try{
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  }catch{
    return '';
  }
}

function normalizeReadingQueueSourceLinks(links, fallbackUrl = ''){
  const normalized = (Array.isArray(links) ? links : []).map(link=>{
    const url = readingQueueUrl(link?.url);
    if(!url) return null;
    return {
      label:String(link?.label || link?.title || '官方来源').trim().slice(0, 40),
      url
    };
  }).filter(Boolean);
  if(normalized.length) return normalized;
  const url = readingQueueUrl(fallbackUrl);
  return url ? [{label:'官方来源', url}] : [];
}

function syncReadingQueueContentSources(){
  let changed = false;
  READING_QUEUE.forEach(item=>{
    if(item?.sourceType !== 'content_engine' || !item.contentItemId) return;
    const current = window.getContentFeedItem?.(item.contentItemId);
    if(!current) return;
    const sourceUrl = readingQueueUrl(current.sourceUrl || '');
    const sourceLinks = normalizeReadingQueueSourceLinks(current.sourceLinks, sourceUrl);
    const next = {
      title:String(current.titleZh || current.titleJa || item.title || '').trim().slice(0, 80),
      url:sourceUrl || item.url,
      sourceUrl:sourceUrl || item.sourceUrl || item.url,
      sourceLinks,
      category:String(current.category || item.category || '').trim() || null,
      learningLevel:/^N[1-5]$/.test(String(current.learning?.recommendedLevel || ''))
        ? String(current.learning.recommendedLevel)
        : item.learningLevel
    };
    if(item.title !== next.title
      || item.url !== next.url
      || item.sourceUrl !== next.sourceUrl
      || item.category !== next.category
      || item.learningLevel !== next.learningLevel
      || JSON.stringify(item.sourceLinks || []) !== JSON.stringify(next.sourceLinks)){
      Object.assign(item, next);
      changed = true;
    }
  });
  if(changed) saveReadingQueue();
  return changed;
}

function readingQueueFallbackTitle(url){
  try{
    return new URL(url).hostname.replace(/^www\./, '');
  }catch{
    return '未命名文章';
  }
}

function readingQueueCategoryLabel(category){
  return ({
    admissions:'考学',
    exam:'考试',
    visa:'签证',
    life:'生活',
    career:'就职',
    major_japan_update:'日本动态'
  })[category] || '日本资讯';
}

function readingQueueMeta(item){
  if(item?.sourceType !== 'content_engine') return readingQueueFallbackTitle(item?.url);
  return [
    readingQueueCategoryLabel(item.category),
    item.learningLevel,
    readingQueueFallbackTitle(item.sourceUrl || item.url)
  ].filter(Boolean).join(' · ');
}

function readingQueuePrimaryLabel(item){
  return item?.sourceType === 'content_engine' ? '直接学习' : '粘贴文本学习';
}

function setReadingQueueStatus(message, type = '', targetId = 'readingQueueStatus'){
  const target = document.getElementById(targetId);
  if(!target) return;
  target.textContent = message;
  target.className = `reading-queue-status ${type}`.trim();
}

function toggleReadingQueueForm(forceOpen){
  const form = document.getElementById('readingQueueInlineForm');
  const button = document.getElementById('readingQueueAddButton');
  const panel = document.getElementById('readingQueuePanel');
  if(!form || !button) return;
  const open = typeof forceOpen === 'boolean' ? forceOpen : form.hidden;
  form.hidden = !open;
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.textContent = open ? '收起添加' : '添加文章';
  panel?.classList.toggle('is-form-open', open);
  if(open) requestAnimationFrame(()=>document.getElementById('readingQueueUrlInput')?.focus());
}

function readingQueueSourceActions(item){
  if(item?.sourceType !== 'content_engine'){
    return `<a class="btn-ghost" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">打开原文</a>`;
  }
  const links = normalizeReadingQueueSourceLinks(item.sourceLinks, item.sourceUrl || item.url);
  return links.map(link=>`<a class="btn-ghost" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join('');
}

function addReadingQueueItem(event, titleId = 'readingQueueTitleInput', urlId = 'readingQueueUrlInput', statusId = 'readingQueueStatus'){
  event?.preventDefault();
  const titleInput = document.getElementById(titleId);
  const urlInput = document.getElementById(urlId);
  const url = readingQueueUrl(urlInput?.value);
  if(!url){
    setReadingQueueStatus('请输入以 http:// 或 https:// 开头的有效文章链接。', 'error', statusId);
    urlInput?.focus();
    return;
  }
  if(READING_QUEUE.some(item => item.url === url)){
    setReadingQueueStatus('这篇文章已经在阅读清单里。', 'error', statusId);
    return;
  }
  READING_QUEUE.unshift({
    id:Date.now(),
    title:String(titleInput?.value || '').trim() || readingQueueFallbackTitle(url),
    url,
    status:'unread',
    addedAt:new Date().toISOString(),
    readAt:null
  });
  saveReadingQueue();
  if(titleInput) titleInput.value = '';
  if(urlInput) urlInput.value = '';
  setReadingQueueStatus('已加入阅读清单。', 'ok', statusId);
  toggleReadingQueueForm(false);
  renderReadingQueue();
  renderDailyPlan();
}

function renderReadingQueue(){
  syncReadingQueueContentSources();
  const list = document.getElementById('readingQueueList');
  const count = document.getElementById('readingQueueCount');
  if(!list || !count) return;
  const sorted = [...READING_QUEUE].sort((a, b) => {
    if(a.status !== b.status) return a.status === 'unread' ? -1 : 1;
    return String(b.addedAt || '').localeCompare(String(a.addedAt || ''));
  });
  const unreadCount = sorted.filter(item => item.status !== 'read').length;
  const readCount = sorted.length - unreadCount;
  count.textContent = sorted.length ? `${sorted.length} 篇 · ${unreadCount} 未读` : '0 篇';
  const panel = document.getElementById('readingQueuePanel');
  if(panel){
    panel.classList.toggle('is-empty', !sorted.length);
    panel.classList.toggle('has-items', Boolean(sorted.length));
  }
  const savedStat = document.getElementById('resourceSavedCount');
  const unreadStat = document.getElementById('resourceUnreadCount');
  const readStat = document.getElementById('resourceReadCount');
  const sourceStat = document.getElementById('resourceSourceCount');
  if(savedStat) savedStat.textContent = String(sorted.length);
  if(unreadStat) unreadStat.textContent = String(unreadCount);
  if(readStat) readStat.textContent = String(readCount);
  if(sourceStat) sourceStat.textContent = String(READING_SOURCES.length);
  if(!sorted.length){
    list.innerHTML = '<div class="reading-queue-empty-compact">还没有保存的文章。点击“添加文章”可加入外部阅读链接。</div>';
    return;
  }
  list.innerHTML = sorted.map(item => `
    <article class="reading-queue-item${item.status === 'read' ? ' is-read' : ''}">
      <span class="reading-queue-state">${item.status === 'read' ? '已读' : '未读'}</span>
      <div class="reading-queue-copy">
        <h3>${escapeHtml(item.title || readingQueueFallbackTitle(item.url))}</h3>
        <p>${escapeHtml(readingQueueMeta(item))}</p>
      </div>
      <div class="reading-queue-actions">
        ${item.status === 'read' && item.sourceType !== 'content_engine' ? '' : `<button class="btn-primary" onclick="openReadingQueueItem(${item.id})">${readingQueuePrimaryLabel(item)}</button>`}
        ${readingQueueSourceActions(item)}
        <button class="btn-ghost" onclick="toggleReadingQueueItem(${item.id})">${item.status === 'read' ? '重新加入' : '标为已读'}</button>
        <button class="reading-queue-remove" onclick="removeReadingQueueItem(${item.id})" title="删除" aria-label="从阅读清单删除 ${escapeHtml(item.title || '')}">${removeVocabIcon()}</button>
      </div>
    </article>
  `).join('');
}

function openReadingQueueItem(id){
  const item = READING_QUEUE.find(entry => entry.id === id);
  if(!item) return;
  ACTIVE_READING_QUEUE_ID = item.id;
  safeStorage.setItem('reading_queue_active_id', String(item.id));
  if(item.sourceType === 'content_engine'){
    if(typeof window.openContentFeedQueueItem === 'function'){
      Promise.resolve(window.openContentFeedQueueItem(item)).then(opened=>{
        if(!opened) showToast('这篇资讯暂时无法加载，请稍后重试。', 'warning');
      });
    }else{
      showToast('资讯阅读模块暂时不可用。', 'warning');
    }
    return;
  }
  const input = document.getElementById('inputText');
  if(input) input.value = '';
  switchWorkspace('reading');
  editSourceText();
  setImportStatus(`请打开「${item.title}」的原文，复制需要学习的日语文本后粘贴到这里。`);
  input?.focus();
}

function toggleReadingQueueItem(id){
  const item = READING_QUEUE.find(entry => entry.id === id);
  if(!item) return;
  item.status = item.status === 'read' ? 'unread' : 'read';
  item.readAt = item.status === 'read' ? new Date().toISOString() : null;
  saveReadingQueue();
  renderReadingQueue();
  renderDailyPlan();
}

function removeReadingQueueItem(id){
  const item = READING_QUEUE.find(entry => entry.id === id);
  if(!item) return;
  const title = item.title || readingQueueFallbackTitle(item.url);
  confirmDeletion({
    title:'删除这篇文章？',
    message:'文章将从阅读清单中移除，删除后无法撤销。',
    target:title
  }, ()=>{
    READING_QUEUE = READING_QUEUE.filter(entry => entry.id !== id);
    if(ACTIVE_READING_QUEUE_ID === id){
      ACTIVE_READING_QUEUE_ID = null;
      safeStorage.removeItem('reading_queue_active_id');
    }
    saveReadingQueue();
    renderReadingQueue();
    renderDailyPlan();
  });
}

function startContentFeedLearning(item){
  const contentItemId = String(item?.id || '').trim();
  const text = String(item?.learning?.textJa || '').trim();
  const sourceUrl = readingQueueUrl(item?.sourceUrl || '');
  if(!contentItemId || !text || !sourceUrl){
    showToast('这篇资讯缺少可学习正文或官方来源。', 'warning');
    return false;
  }
  const existingIndex = READING_QUEUE.findIndex(entry => entry.contentItemId === contentItemId);
  const existing = existingIndex >= 0 ? READING_QUEUE.splice(existingIndex, 1)[0] : null;
  const queueItem = {
    id:existing?.id || Date.now(),
    title:String(item.titleZh || item.titleJa || '日本资讯').trim().slice(0, 80),
    url:sourceUrl,
    status:'unread',
    addedAt:existing?.addedAt || new Date().toISOString(),
    readAt:null,
    contentItemId,
    sourceType:'content_engine',
    category:String(item.category || '').trim() || null,
    learningLevel:/^N[1-5]$/.test(String(item.learning?.recommendedLevel || '')) ? String(item.learning.recommendedLevel) : null,
    sourceUrl,
    sourceLinks:normalizeReadingQueueSourceLinks(item.sourceLinks, sourceUrl)
  };
  READING_QUEUE.unshift(queueItem);
  saveReadingQueue();
  ACTIVE_READING_QUEUE_ID = queueItem.id;
  safeStorage.setItem('reading_queue_active_id', String(queueItem.id));
  safeStorage.setItem('current_article_source_title', queueItem.title);
  CURRENT_ARTICLE_URL = sourceUrl;
  const input = document.getElementById('inputText');
  if(input) input.value = text;
  switchWorkspace('reading');
  analyzeSourceInput({inputSource:'content_feed', preserveArticleUrl:true});
  renderReadingQueue();
  trackAnalyticsEvent('content_feed_reading_start', {
    category:queueItem.category || 'unknown',
    learning_level:queueItem.learningLevel || 'ungraded'
  });
  return true;
}
window.startContentFeedLearning = startContentFeedLearning;

function clearActiveReadingQueueItem(){
  ACTIVE_READING_QUEUE_ID = null;
  safeStorage.removeItem('reading_queue_active_id');
}

function markActiveReadingQueueRead(){
  if(!ACTIVE_READING_QUEUE_ID) return;
  const item = READING_QUEUE.find(entry => entry.id === ACTIVE_READING_QUEUE_ID);
  if(item){
    item.status = 'read';
    item.readAt = new Date().toISOString();
    saveReadingQueue();
  }
  clearActiveReadingQueueItem();
  renderReadingQueue();
}

const SOURCE_LEVEL_FILTERS = ['全部', 'N5', 'N4', 'N3', 'N2', 'N1'];
let ACTIVE_SOURCE_LEVEL = '全部';
const SOURCE_TYPE_FILTERS = ['全部', '新闻', '留学', '考试', '日语学习', '生活', '就业', '旅行', '美食', '故事', '商业', '文化', '科技'];
let ACTIVE_SOURCE_TYPE = '全部';
const GRADED_LEVEL_FILTERS = ['全部', 'N5', 'N4', 'N3', 'N2', 'N1'];
const GRADED_TOPIC_FILTERS = ['全部', '留学', '考试', '日语学习', '生活', '就业', '新闻', '科技', '旅行', '美食', '商业'];
const GRADED_SOURCE_FILTERS = ['全部', '官方资讯', '站内短文'];
let ACTIVE_GRADED_LEVEL = '全部';
let ACTIVE_GRADED_TOPIC = '全部';
let ACTIVE_GRADED_SOURCE = '全部';

const GRADED_READING_MATERIALS = [
  {
    id:'n5-day',
    level:'N5',
    topic:'生活',
    title:'私の一日 —— 我的一天是怎样度过的',
    excerpt:'私は毎朝七時に起きます。朝ごはんを食べてから、学校に行きます。今日は友達と一緒に…',
    minutes:3,
    words:128,
    progress:0,
    text:'私は毎朝七時に起きます。朝ごはんを食べてから、学校に行きます。今日は友達と一緒に図書館で勉強します。夜は家で日本語の単語を復習します。'
  },
  {
    id:'n4-weather',
    level:'N4',
    topic:'新闻',
    title:'今週の天気とお知らせ —— 本周天气与生活提示',
    excerpt:'今週は全国的に気温が下がり、週末には雨の予報が出ています。外出の際は…',
    minutes:4,
    words:156,
    progress:64,
    text:'今週は全国的に気温が下がり、週末には雨の予報が出ています。外出の際は傘を持ち、朝と夜の気温差に注意してください。学校や会社へ行く人は、交通情報も確認しましょう。'
  },
  {
    id:'n3-kyoto',
    level:'N3',
    topic:'旅行',
    title:'京都で一日観光 —— 京都一日游怎么安排',
    excerpt:'京都には古い神社やお寺がたくさんあります。朝早く出発すれば、一日で主要な…',
    minutes:6,
    words:240,
    progress:0,
    text:'京都には古い神社やお寺がたくさんあります。朝早く出発すれば、一日で主要な観光地をいくつか回ることができます。移動には電車とバスが便利ですが、混雑する時間帯を避けると、より落ち着いて楽しめます。'
  },
  {
    id:'n2-remote',
    level:'N2',
    topic:'商业',
    title:'日本企業のリモートワーク事情 —— 日本企业的远程办公现状',
    excerpt:'近年、日本企業でもリモートワークを導入する動きが加速している。一方で…',
    minutes:8,
    words:320,
    progress:100,
    text:'近年、日本企業でもリモートワークを導入する動きが加速している。一方で、対面での会議や社内コミュニケーションを重視する文化も残っている。企業は効率性とチームの一体感を両立させる方法を探している。'
  },
  {
    id:'n4-ramen',
    level:'N4',
    topic:'美食',
    title:'おすすめのラーメン屋 —— 值得一试的拉面店',
    excerpt:'この店のラーメンはスープが濃厚で、特に醤油味が人気です。営業時間は…',
    minutes:3,
    words:110,
    progress:0,
    text:'この店のラーメンはスープが濃厚で、特に醤油味が人気です。営業時間は昼から夜までで、駅から歩いて五分の場所にあります。週末は混むので、少し早めに行くのがおすすめです。'
  },
  {
    id:'n1-ai',
    level:'N1',
    topic:'科技',
    title:'AI技術の進化と社会への影響 —— AI技术演进及其社会影响',
    excerpt:'人工知能技術の急速な発展は、労働市場や教育制度に大きな変革を迫っている…',
    minutes:10,
    words:410,
    progress:0,
    text:'人工知能技術の急速な発展は、労働市場や教育制度に大きな変革を迫っている。単純作業の自動化が進む一方で、人間に求められる能力は、創造性や判断力、異なる分野を結びつける思考へと移りつつある。'
  }
];

const READING_SOURCES = [
  {
    id:'watanoc',
    level:'N5-N3',
    title:'Watanoc わたのC',
    url:'https://watanoc.com/',
    domain:'watanoc.com',
    type:'やさしい日本語',
    category:'新闻',
    note:'免费的やさしい日本语新闻/生活杂志，文章标题直接标注 N5/N4/N3 等级，汉字全部配假名。',
    traits:['新闻', '生活', '不定期更新'],
    icon:'W'
  },
  {
    id:'nhk-world',
    level:'N3-N1',
    title:'NHK WORLD-JAPAN',
    url:'https://www3.nhk.or.jp/nhkworld/',
    domain:'nhk.or.jp',
    type:'多语言新闻',
    category:'新闻',
    note:'NHK 面向海外发布的多语言新闻站点，可让日语原文与其他语言版本对照阅读。',
    traits:['新闻', '商业', '每日更新'],
    caution:'NHK NEWS WEB EASY 自 2025 年起改为付费服务，不建议再作为免费入口推荐。',
    icon:'N'
  },
  {
    id:'matcha-easy',
    level:'N5-N3',
    title:'MATCHA やさしい日本语版',
    url:'https://matcha-jp.com/easy/',
    domain:'matcha-jp.com',
    type:'旅行文化',
    category:'旅行',
    note:'面向访日外国人的やさしい日本语版，覆盖饮品、街区、观光路线和日常小知识。',
    traits:['旅行', '美食', '持续更新'],
    icon:'旅'
  },
  {
    id:'yomujp',
    level:'N6-N1',
    title:'日本语多读道场 Yomujp',
    url:'https://yomujp.com/',
    domain:'yomujp.com',
    type:'多读文章',
    category:'生活',
    note:'按 JLPT 等级分类的多读文章站，题材涵盖地理、饮食、动植物、文化历史和汉字部首。',
    traits:['生活', '科技', '近乎每周更新'],
    caution:'站内部分深度内容为付费订阅，阅读时需区分免费/付费文章。',
    icon:'読'
  },
  {
    id:'tadoku',
    level:'N5-N3',
    title:'たどく Tadoku 分级读物库',
    url:'https://tadoku.org/japanese/en/graded-readers-en/',
    domain:'tadoku.org',
    type:'分级读物',
    category:'故事',
    note:'专为多读法设计的分级绘本/故事库，配图丰富，部分附朗读音频。',
    traits:['故事', '生活', '定期新增'],
    caution:'部分书目为纸质出版物链接，线上可读内容和购买链接需分开处理。',
    icon:'本'
  },
  {
    level:'N1',
    id:'toyokeizai',
    title:'东洋经济 Online',
    url:'https://toyokeizai.net/',
    domain:'toyokeizai.net',
    type:'财经媒体',
    category:'商业',
    note:'覆盖企业动态、产业分析、宏观经济报道，用词专业正式，适合 N1 水平学习者泛读。',
    traits:['商业', '每日更新', '高难度'],
    caution:'存在广告拦截检测机制和部分付费内容，建议先作为外链入口，不强求站内全文抓取。',
    icon:'経'
  },
  {
    id:'jasso',
    level:'N4-N2',
    title:'日本学生支援機構 JASSO',
    url:'https://www.jasso.go.jp/ryugaku/',
    domain:'jasso.go.jp',
    type:'官方留学信息',
    category:'留学',
    note:'发布 EJU、奖学金与留学生支援信息，适合确认报名、考试和制度变化。',
    traits:['留学', '考试', '官方更新'],
    icon:'学',
    official:true
  },
  {
    id:'jlpt-official',
    level:'N5-N1',
    title:'日本語能力試験 JLPT',
    url:'https://www.jlpt.jp/',
    domain:'jlpt.jp',
    type:'官方考试信息',
    category:'考试',
    note:'发布 JLPT 考试日期、实施地区、报名和成绩相关信息。',
    traits:['考试', '日语学习', '官方更新'],
    icon:'試',
    official:true
  },
  {
    id:'isa-guide',
    level:'N4-N2',
    title:'出入国在留管理庁',
    url:'https://www.moj.go.jp/isa/',
    domain:'moj.go.jp',
    type:'官方生活指南',
    category:'生活',
    note:'提供在留手续、生活与就业指南等面向外国人的官方信息。',
    traits:['生活', '就业', '官方指南'],
    icon:'在',
    official:true
  }
];

const SOURCE_RECOMMENDATIONS = {
  'N5': [
    {title:'今天选 1 篇 Watanoc 短文', source:'Watanoc わたのC', detail:'优先选标题标注 N5/N4 的文章，读完后做选择题。', url:'https://watanoc.com/'},
    {title:'读一篇 Tadoku 入门故事', source:'たどく Tadoku', detail:'图片和上下文多，适合不查太多词也能读完一篇。', url:'https://tadoku.org/japanese/en/graded-readers-en/'},
    {title:'旅行生活短文', source:'MATCHA やさしい日本语版', detail:'看饮食、地点、交通类文章，词汇更贴近日常。', url:'https://matcha-jp.com/easy/'}
  ],
  'N4': [
    {title:'Watanoc 生活新闻', source:'Watanoc わたのC', detail:'句子不太长，但信息量比入门短文更完整。', url:'https://watanoc.com/category/japan-news'},
    {title:'Yomujp 生活专题', source:'日本语多读道场 Yomujp', detail:'适合练习“原因、建议、说明”这类常见表达。', url:'https://yomujp.com/'},
    {title:'MATCHA 简短旅行文章', source:'MATCHA やさしい日本语版', detail:'看地点、交通、饮食类文章，词汇更贴近日常。', url:'https://matcha-jp.com/easy/'}
  ],
  'N3': [
    {title:'MATCHA 城市/文化介绍', source:'MATCHA やさしい日本语版', detail:'段落更长，适合训练抓主旨和段落结构。', url:'https://matcha-jp.com/easy/'},
    {title:'Yomujp 文化类文章', source:'日本语多读道场 Yomujp', detail:'先选生活文化类，难度通常比评论类更友好。', url:'https://yomujp.com/'},
    {title:'新闻专题精读', source:'Watanoc / NHK WORLD-JAPAN', detail:'同一主题连续读 2–3 篇，训练主题词复现。', url:'https://watanoc.com/'}
  ],
  'N2': [
    {title:'NHK WORLD-JAPAN 新闻', source:'NHK WORLD-JAPAN', detail:'适合积累抽象名词、连接表达和正式报道语气。', url:'https://www3.nhk.or.jp/nhkworld/'},
    {title:'Yomujp 深度文化文章', source:'日本语多读道场 Yomujp', detail:'从熟悉主题过渡到长句说明文，压力较小。', url:'https://yomujp.com/'},
    {title:'商业新闻入门', source:'NHK WORLD-JAPAN', detail:'先选经济相关短报道，不必一口气读完整专题。', url:'https://www3.nhk.or.jp/nhkworld/'}
  ],
  'N1': [
    {title:'东洋经济产业报道', source:'东洋经济 Online', detail:'适合训练专业词汇、抽象句和正式评论语气。', url:'https://toyokeizai.net/'},
    {title:'NHK WORLD-JAPAN 经济报道', source:'NHK WORLD-JAPAN', detail:'信息密度高，适合做复述和观点整理。', url:'https://www3.nhk.or.jp/nhkworld/'},
    {title:'同主题多来源对读', source:'进阶泛读', detail:'选择一个社会主题，连续读新闻、评论、文化介绍。', url:'https://www3.nhk.or.jp/nhkworld/'}
  ]
};

const LEVEL_TEST_QUESTIONS = [
  {level:'N5', q:'「私は学生です。」的意思是？', options:['我是学生。','我去学校。','这是学校。'], answer:0},
  {level:'N5', q:'「昨日、パンを食べました。」里「食べました」表示？', options:['吃了','正在吃','想吃'], answer:0},
  {level:'N4', q:'「雨が降っているので、出かけません。」最自然的理解是？', options:['因为在下雨，所以不出门。','虽然下雨，但要出门。','为了下雨而出门。'], answer:0},
  {level:'N4', q:'「この本は読みやすいです。」里的「やすい」表示？', options:['容易读','便宜地读','安静地读'], answer:0},
  {level:'N3', q:'「電車が遅れたため、会議に間に合わなかった。」的重点是？', options:['因为电车晚点，没赶上会议。','为了会议，电车晚点了。','会议结束后电车来了。'], answer:0},
  {level:'N3', q:'「彼は忙しいにもかかわらず、手伝ってくれた。」里的「にもかかわらず」接近？', options:['尽管如此','正因为如此','如果这样'], answer:0},
  {level:'N2', q:'「努力したからといって、必ず成功するとは限らない。」的意思是？', options:['即使努力，也不一定成功。','只要努力就一定成功。','因为努力所以不能成功。'], answer:0},
  {level:'N2', q:'「この問題は専門家でさえ解けない。」里的「でさえ」表示？', options:['连……都','只有……才','为了……'], answer:0},
  {level:'N1', q:'「彼の発言は、誤解を招きかねない。」里的「かねない」表示？', options:['有可能导致','绝不会导致','已经导致'], answer:0},
  {level:'N1', q:'「知れば知るほど、奥深さを思い知らされる。」最接近？', options:['越了解，越感到其深奥。','知道以后就忘了。','因为深奥所以不需要了解。'], answer:0}
];
const LEVEL_TEST_STATE = { index: 0, answers: [] };

function clearTokenizerProgressTimers(){
  TOKENIZER_PROGRESS_TIMERS.forEach(timer => clearTimeout(timer));
  TOKENIZER_PROGRESS_TIMERS = [];
}

function setTokenizerStatus(text, state = '', options = {}){
  const el = document.getElementById('tokenizerStatus');
  if(!el) return;
  clearTimeout(TOKENIZER_STATUS_HIDE_TIMER);
  const message = String(text || '').trim();
  el.textContent = message;
  el.className = `engine-status ${state}`.trim();
  el.hidden = !message;
  el.setAttribute('aria-busy', String(state === 'loading'));
  if(message && options.autoHideMs){
    TOKENIZER_STATUS_HIDE_TIMER = setTimeout(()=>{
      if(el.textContent !== message) return;
      el.hidden = true;
      el.textContent = '';
      el.className = 'engine-status';
      el.setAttribute('aria-busy', 'false');
    }, options.autoHideMs);
  }
}

function setRubyToggleBusy(isBusy){
  const button = document.getElementById('rubyToggleBtn');
  if(!button) return;
  button.classList.toggle('is-loading', !!isBusy);
  button.setAttribute('aria-busy', String(!!isBusy));
  button.dataset.tooltip = isBusy ? '正在生成假名' : '显示或隐藏假名';
}

function startTokenizerProgress(){
  clearTokenizerProgressTimers();
  setRubyToggleBusy(true);
  setTokenizerStatus('正在生成假名……', 'loading');
  TOKENIZER_PROGRESS_TIMERS.push(setTimeout(()=>{
    setTokenizerStatus('首次使用正在加载本地日语词典，完成后再次使用会更快……', 'loading');
  }, 1200));
  TOKENIZER_PROGRESS_TIMERS.push(setTimeout(()=>{
    setTokenizerStatus('仍在生成假名，请保持页面打开；正文可以先正常阅读。', 'loading');
  }, 10000));
}

function finishTokenizerProgress(message, state = 'ready'){
  clearTokenizerProgressTimers();
  setRubyToggleBusy(false);
  setTokenizerStatus(message, state, state === 'ready' ? {autoHideMs:6000} : {});
}

function resetLocalKuromojiWorkerClient(){
  LOCAL_KUROMOJI_WORKER_CLIENT?.terminate();
  LOCAL_KUROMOJI_WORKER_CLIENT = null;
  LOCAL_KUROMOJI_PREWARM_PROMISE = null;
  LOCAL_KUROMOJI_PREWARM_STATE = 'idle';
}

function markTokenizerLoadStart(){
  if(!performanceMarkTime('tokenizer_load_start')){
    try{ TOKENIZER_CACHE_STATUS_AT_START = sessionStorage.getItem('yomeru_tokenizer_ready') ? 'warm' : 'cold'; }catch{}
    recordPerformanceMark('tokenizer_load_start');
  }
}

function markTokenizerWorkerReady(mode = 'kuromoji-worker'){
  recordPerformanceMark('tokenizer_worker_ready');
  try{ sessionStorage.setItem('yomeru_tokenizer_ready', '1'); }catch{}
  if(TOKENIZER_READY_EVENT_SENT) return;
  TOKENIZER_READY_EVENT_SENT = true;
  trackAnalyticsEvent('tokenizer_ready', {
    duration_ms:Math.max(0, performanceMarkTime('tokenizer_worker_ready') - performanceMarkTime('tokenizer_load_start')),
    cache_status:TOKENIZER_CACHE_STATUS_AT_START,
    tokenizer_mode:mode,
    success:true
  });
}

function markTokenizerFailure(mode = 'kuromoji-worker'){
  if(TOKENIZER_READY_EVENT_SENT) return;
  TOKENIZER_READY_EVENT_SENT = true;
  trackAnalyticsEvent('tokenizer_ready', {
    duration_ms:Math.max(0, Math.round(performance.now()) - performanceMarkTime('tokenizer_load_start')),
    cache_status:TOKENIZER_CACHE_STATUS_AT_START,
    tokenizer_mode:mode,
    success:false
  });
}

function getLocalKuromojiWorkerClient(){
  if(LOCAL_KUROMOJI_WORKER_CLIENT) return LOCAL_KUROMOJI_WORKER_CLIENT;
  if(!window.KuromojiWorkerClient?.createClient){
    throw new Error('本地 Kuromoji Worker 控制器不可用');
  }
  LOCAL_KUROMOJI_WORKER_CLIENT = window.KuromojiWorkerClient.createClient({
    workerUrl:LOCAL_KUROMOJI_WORKER_URL,
    initTimeoutMs:LOCAL_KUROMOJI_WORKER_INIT_TIMEOUT_MS,
    tokenizeTimeoutMs:LOCAL_KUROMOJI_WORKER_TOKENIZE_TIMEOUT_MS
  });
  return LOCAL_KUROMOJI_WORKER_CLIENT;
}

async function analyzeWithLocalKuromojiWorker(raw, options = {}){
  const maxAttempts = 2;
  let finalError = null;
  markTokenizerLoadStart();
  for(let attempt = 1; attempt <= maxAttempts; attempt += 1){
    try{
      const result = await getLocalKuromojiWorkerClient().analyze(raw);
      LAST_READING_RETRY_COUNT = attempt - 1;
      markTokenizerWorkerReady('kuromoji-worker');
      return {...result, retryCount:attempt - 1};
    }catch(error){
      finalError = error;
      console.warn(`本地假名分析第 ${attempt} 次未完成`, error);
      resetLocalKuromojiWorkerClient();
      const canRetry = attempt < maxAttempts && (typeof options.canRetry !== 'function' || options.canRetry());
      if(!canRetry) break;
      setTokenizerStatus('首次加载未完成，正在自动重试……', 'loading');
    }
  }
  LAST_READING_RETRY_COUNT = maxAttempts - 1;
  markTokenizerFailure('kuromoji-worker');
  return {ok:false, mode:'fallback', error:finalError?.message || String(finalError || ''), retryCount:maxAttempts - 1};
}

function rememberLocalTokenizerMetrics(metrics = {}, phase = 'analysis'){
  const normalized = {
    phase,
    initMs:Math.max(0, Math.round(Number(metrics.initMs || 0))),
    tokenizeMs:Math.max(0, Math.round(Number(metrics.tokenizeMs || 0))),
    roundTripMs:Math.max(0, Math.round(Number(metrics.roundTripMs || 0))),
    recordedAt:new Date().toISOString()
  };
  LOCAL_KUROMOJI_LAST_METRICS = normalized;
  window.YOMERU_TOKENIZER_METRICS = normalized;
  document.body.dataset.tokenizerInitMs = String(normalized.initMs);
  document.body.dataset.tokenizerRoundTripMs = String(normalized.roundTripMs);
  return normalized;
}

function tokenizerElapsedLabel(metrics = {}){
  const elapsed = Math.max(0, Number(metrics.roundTripMs || metrics.initMs || 0));
  if(!elapsed) return '';
  if(elapsed < 1000) return `${Math.max(1, Math.round(elapsed))} 毫秒`;
  return `${(elapsed / 1000).toFixed(elapsed < 10000 ? 1 : 0)} 秒`;
}

function finishLocalTokenizerSuccess(result){
  TOKENIZER_LAST_ATTEMPT_FAILED = false;
  LOCAL_KUROMOJI_PREWARM_STATE = 'ready';
  const metrics = rememberLocalTokenizerMetrics(result?.metrics || {}, 'analysis');
  const elapsedLabel = tokenizerElapsedLabel(metrics);
  finishTokenizerProgress(`假名已显示${elapsedLabel ? `（本次 ${elapsedLabel}）` : ''}。`, 'ready');
  return metrics;
}

async function prewarmLocalKuromojiWorker(options = {}){
  if(!ENABLE_LOCAL_KUROMOJI_WORKER || location.protocol === 'file:') return null;
  const showStatus = options.showStatus === true;
  if(LOCAL_KUROMOJI_PREWARM_STATE === 'ready') return LOCAL_KUROMOJI_LAST_METRICS;
  if(LOCAL_KUROMOJI_PREWARM_PROMISE) return LOCAL_KUROMOJI_PREWARM_PROMISE;

  LOCAL_KUROMOJI_PREWARM_STATE = 'loading';
  markTokenizerLoadStart();
  if(showStatus) setTokenizerStatus('正在后台准备假名功能，正文可以先正常阅读……', 'loading');
  const startedAt = performance.now();
  LOCAL_KUROMOJI_PREWARM_PROMISE = getLocalKuromojiWorkerClient().initialize()
    .then(result=>{
      LOCAL_KUROMOJI_PREWARM_STATE = 'ready';
      const metrics = rememberLocalTokenizerMetrics({
        ...(result?.metrics || {}),
        roundTripMs:performance.now() - startedAt
      }, 'prewarm');
      markTokenizerWorkerReady('kuromoji-worker');
      if(showStatus && !document.getElementById('useKuromoji')?.checked){
        setTokenizerStatus('假名功能已准备好。', 'ready', {autoHideMs:4000});
      }
      return metrics;
    })
    .catch(error=>{
      LOCAL_KUROMOJI_PREWARM_STATE = 'idle';
      LOCAL_KUROMOJI_PREWARM_PROMISE = null;
      console.warn('假名功能后台准备未完成，将在用户开启时重试', error);
      if(showStatus){
        setTokenizerStatus('假名功能尚未准备完成，点击「あ」时会自动重试。', 'error', {autoHideMs:6000});
      }
      return null;
    });
  return LOCAL_KUROMOJI_PREWARM_PROMISE;
}

function scheduleLocalKuromojiPrewarm(text, options = {}){
  const value = String(text || '');
  const japaneseChars = (value.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  if(japaneseChars < 4 || LOCAL_KUROMOJI_PREWARM_STATE !== 'idle') return;
  clearTimeout(LOCAL_KUROMOJI_PREWARM_TIMER);
  LOCAL_KUROMOJI_PREWARM_TIMER = setTimeout(()=>{
    const run = ()=>prewarmLocalKuromojiWorker({showStatus:options.showStatus === true});
    if(typeof requestIdleCallback === 'function') requestIdleCallback(run, {timeout:800});
    else setTimeout(run, 0);
  }, Number(options.delayMs ?? 250));
}

function initKuromoji(){
  if(KUROMOJI_TOKENIZER) return Promise.resolve(KUROMOJI_TOKENIZER);
  if(KUROMOJI_LOADING) return KUROMOJI_LOADING;
  setTokenizerStatus('自动标假名加载中……', 'loading');
  KUROMOJI_LOADING = withTimeout(loadExternalScript(THIRD_PARTY_SCRIPTS.kuromoji, 'kuromoji'), 3500, '智能分词脚本加载超时')
    .then(()=>withTimeout(new Promise(resolve=>{
      window.kuromoji
        .builder({ dicPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/' })
        .build((err, tokenizer)=>{
          if(err || !tokenizer){
            console.warn('kuromoji 初始化失败,已退回内置词库', err);
            resolve(null);
            return;
          }
          KUROMOJI_TOKENIZER = tokenizer;
          resolve(tokenizer);
        });
    }), 4500, '智能分词词典加载超时'))
    .then(tokenizer=>{
      setTokenizerStatus(tokenizer ? '自动标假名已启用：会先切分词语，再补充读音和释义' : '自动标假名加载失败，当前使用基础词库匹配', tokenizer ? 'ready' : '');
      return tokenizer;
    })
    .catch(error=>{
      console.warn('kuromoji 加载失败,已退回内置词库', error);
      setTokenizerStatus('自动标假名加载失败，当前使用基础词库匹配', '');
      KUROMOJI_LOADING = null;
      return null;
    });
  return KUROMOJI_LOADING;
}

async function loadSample(sampleId = 'life', useGuidedTour = false){
  if(typeof sampleId === 'boolean'){
    useGuidedTour = sampleId;
    sampleId = 'life';
  }
  await ensureLearningData().catch(error=>{
    console.warn('示例数据加载失败,使用内置示例', error);
    DICT = Object.keys(DICT).length ? DICT : {...FALLBACK_DICTIONARY};
    SAMPLE_ARTICLES = [...FALLBACK_SAMPLE_ARTICLES];
  });
  const sample = SAMPLE_ARTICLES.find(item=>item.id === sampleId) || SAMPLE_ARTICLES[0] || FALLBACK_SAMPLE_ARTICLES[0];
  SAMPLE_TEXT = sample.text;
  clearActiveReadingQueueItem();
  document.getElementById('inputText').value = SAMPLE_TEXT;
  switchWorkspace('reading');
  if(useGuidedTour) startSampleFlow();
  await analyzeSourceInput({inputSource:'sample'});
  if(useGuidedTour) renderSampleFlow();
}

function sampleFlowSteps(){
  const hasReading = !!CURRENT_ARTICLE_TEXT.trim();
  const hasNewVocab = getAllVocab().length > SAMPLE_FLOW_INITIAL_VOCAB_COUNT;
  return [
    {
      type:'reading',
      label:'阅读',
      title:'读示例文章',
      detail:hasReading ? '已生成可点击正文' : '先生成示例正文',
      done:hasReading,
      action:'生成示例'
    },
    {
      type:'collect',
      label:'点词',
      title:'点词并收藏',
      detail:hasNewVocab ? '已收藏一个新词' : '点击高亮词后加入生词本',
      done:hasNewVocab,
      action:'下一步'
    },
    {
      type:'vocab',
      label:'生词',
      title:'查看生词本',
      detail:SAMPLE_FLOW_VISITED_VOCAB ? '已看过生词本' : '确认刚收藏的词',
      done:SAMPLE_FLOW_VISITED_VOCAB,
      action:'查看生词'
    },
    {
      type:'practice',
      label:'练习',
      title:'进入练习',
      detail:SAMPLE_FLOW_VISITED_PRACTICE ? '流程已完成' : '用文章或生词练一次',
      done:SAMPLE_FLOW_VISITED_PRACTICE,
      action:'开始练习'
    }
  ];
}

function currentSampleFlowStep(){
  const steps = sampleFlowSteps();
  return steps.find(step => !step.done) || steps[steps.length - 1];
}

function startSampleFlow(){
  SAMPLE_FLOW_ACTIVE = true;
  SAMPLE_FLOW_VISITED_VOCAB = false;
  SAMPLE_FLOW_VISITED_PRACTICE = false;
  SAMPLE_FLOW_INITIAL_VOCAB_COUNT = getAllVocab().length;
  hideIconButtonHint(null, true);
  document.body.classList.add('sample-tour-active');
  renderSampleFlow();
}

function dismissSampleFlow(){
  SAMPLE_FLOW_ACTIVE = false;
  document.body.classList.remove('sample-tour-active', 'sample-tour-word-step', 'sample-tour-add-step');
  document.getElementById('guidedTour')?.classList.add('is-hidden');
  document.querySelectorAll('.tour-highlight').forEach(node=>node.classList.remove('tour-highlight'));
}

function renderSampleFlow(){
  const guide = document.getElementById('guidedTour');
  if(!guide || !SAMPLE_FLOW_ACTIVE) return;
  const steps = sampleFlowSteps();
  const current = currentSampleFlowStep();
  const completed = steps.filter(step => step.done).length;
  const target = sampleFlowTarget(current.type);
  if(!target) return;
  hideIconButtonHint(null, true);
  document.body.classList.add('sample-tour-active');
  document.body.classList.remove('sample-tour-word-step', 'sample-tour-add-step');
  if(current.type === 'collect'){
    document.body.classList.add(target.matches?.('.add-vocab-tool') ? 'sample-tour-add-step' : 'sample-tour-word-step');
  }
  guide.classList.remove('is-hidden');
  document.querySelectorAll('.tour-highlight').forEach(node=>node.classList.remove('tour-highlight'));
  target.classList.add('tour-highlight');
  const title = document.getElementById('guidedTitle');
  const text = document.getElementById('guidedText');
  const action = document.getElementById('guidedFallbackAction');
  if(title) title.textContent = completed === steps.length ? '示例引导完成' : current.title;
  if(text) text.textContent = guidedInstruction(current.type, completed === steps.length);
  if(action){
    action.textContent = completed === steps.length ? '找下一篇' : current.action;
    action.dataset.step = completed === steps.length ? 'discover' : current.type;
  }
  positionGuidedTour(target);
}

function sampleFlowTarget(type){
  if(type === 'reading') return document.getElementById('output') || document.getElementById('analyzeSourceBtn');
  if(type === 'collect'){
    return document.querySelector('#detailArea .add-vocab-tool') || document.querySelector('#output .w') || document.getElementById('output');
  }
  if(type === 'vocab') return document.querySelector('.nav-item[data-view="vocab"]');
  if(type === 'practice') return document.querySelector('.nav-item[data-view="retell"]');
  return document.querySelector('.nav-item[data-view="discover"]');
}

function guidedInstruction(type, isComplete){
  if(isComplete) return '你已经走完阅读、点词、生词本和练习的完整路径。';
  if(type === 'reading') return '示例文章已经生成。现在看正文区域，下一步点击一个带颜色的词。';
  if(type === 'collect' && document.querySelector('#detailArea .add-vocab-tool')) return '词义已经显示在右侧。点击「加入生词本」，把这个词保存下来。';
  if(type === 'collect') return '点击正文里带颜色的词，右侧会出现词义和加入生词本按钮。';
  if(type === 'vocab') return '点击左侧「生词本」，确认刚才收藏的词已经保存。';
  if(type === 'practice') return '点击左侧「练习」，用刚才的阅读内容或生词做一次练习。';
  return '继续下一步。';
}

function positionGuidedTour(target){
  const guide = document.getElementById('guidedTour');
  const callout = document.getElementById('guidedCallout');
  if(!guide || !callout || !target) return;
  const rect = target.getBoundingClientRect();
  if(!rect.width || !rect.height) return;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spotlightPadding = 7;
  const edge = 14;
  const gap = 14;
  const hole = {
    left: Math.max(0, rect.left - spotlightPadding),
    top: Math.max(0, rect.top - spotlightPadding),
    right: Math.min(viewportWidth, rect.right + spotlightPadding),
    bottom: Math.min(viewportHeight, rect.bottom + spotlightPadding)
  };
  const masks = {
    top: guide.querySelector('.guided-mask--top'),
    right: guide.querySelector('.guided-mask--right'),
    bottom: guide.querySelector('.guided-mask--bottom'),
    left: guide.querySelector('.guided-mask--left')
  };
  const setMask = (mask, left, top, width, height)=>{
    if(!mask) return;
    mask.style.left = `${Math.round(left)}px`;
    mask.style.top = `${Math.round(top)}px`;
    mask.style.width = `${Math.max(0, Math.round(width))}px`;
    mask.style.height = `${Math.max(0, Math.round(height))}px`;
  };
  setMask(masks.top, 0, 0, viewportWidth, hole.top);
  setMask(masks.right, hole.right, hole.top, viewportWidth - hole.right, hole.bottom - hole.top);
  setMask(masks.bottom, 0, hole.bottom, viewportWidth, viewportHeight - hole.bottom);
  setMask(masks.left, 0, hole.top, hole.left, hole.bottom - hole.top);

  callout.style.left = '0px';
  callout.style.top = '0px';
  const calloutWidth = callout.offsetWidth;
  const calloutHeight = callout.offsetHeight;
  const available = {
    right: viewportWidth - hole.right,
    left: hole.left,
    bottom: viewportHeight - hole.bottom,
    top: hole.top
  };
  let placement = 'right';
  if(available.right >= calloutWidth + gap + edge) placement = 'right';
  else if(available.left >= calloutWidth + gap + edge) placement = 'left';
  else if(available.bottom >= calloutHeight + gap + edge) placement = 'bottom';
  else if(available.top >= calloutHeight + gap + edge) placement = 'top';
  else placement = Object.entries(available).sort((a, b)=>b[1] - a[1])[0][0];

  let left = edge;
  let top = edge;
  if(placement === 'right' || placement === 'left'){
    left = placement === 'right' ? hole.right + gap : hole.left - calloutWidth - gap;
    top = rect.top + rect.height / 2 - calloutHeight / 2;
  }else{
    left = rect.left + rect.width / 2 - calloutWidth / 2;
    top = placement === 'bottom' ? hole.bottom + gap : hole.top - calloutHeight - gap;
  }
  left = Math.max(edge, Math.min(left, viewportWidth - calloutWidth - edge));
  top = Math.max(edge, Math.min(top, viewportHeight - calloutHeight - edge));

  callout.dataset.placement = placement;
  callout.style.left = `${Math.round(left)}px`;
  callout.style.top = `${Math.round(top)}px`;
  const arrowOffset = placement === 'right' || placement === 'left'
    ? rect.top + rect.height / 2 - top
    : rect.left + rect.width / 2 - left;
  const arrowLimit = placement === 'right' || placement === 'left' ? calloutHeight : calloutWidth;
  callout.style.setProperty('--guided-arrow-offset', `${Math.round(Math.max(20, Math.min(arrowLimit - 20, arrowOffset)))}px`);
}

async function runSampleFlowAction(){
  const target = document.getElementById('guidedFallbackAction')?.dataset.step || currentSampleFlowStep().type;
  if(target === 'reading'){
    await loadSample();
    return;
  }
  if(target === 'collect'){
    switchWorkspace('reading');
    document.getElementById('output')?.scrollIntoView({behavior:'smooth', block:'center'});
    showToast('点击正文里带颜色的词，再点「加入生词本」。', 'info');
    return;
  }
  if(target === 'vocab'){
    switchWorkspace('vocab');
    return;
  }
  if(target === 'practice'){
    switchWorkspace('retell');
    return;
  }
  switchWorkspace('discover');
}

function sourceInputValue(){
  return document.getElementById('inputText')?.value.trim() || '';
}

function isArticleUrl(value){
  return /^https?:\/\/\S+$/i.test(String(value || '').trim());
}

function normalizeArticleUrl(value){
  const trimmed = String(value || '').trim();
  if(!trimmed || /\s/.test(trimmed)) return '';
  if(isArticleUrl(trimmed)) return trimmed;
  if(/^\/\//.test(trimmed)) return `https:${trimmed}`;
  const hasJapanese = /[\u3040-\u30ff\u3400-\u9fff]/.test(trimmed);
  const looksLikeDomain = /^(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:[/?#].*)?$/i.test(trimmed);
  return !hasJapanese && looksLikeDomain ? `https://${trimmed}` : '';
}

async function analyzeSourceInput(options = {}){
  const analysisGeneration = ++SOURCE_ANALYSIS_GENERATION;
  const value = sourceInputValue();
  if(!value){
    setImportStatus('请先粘贴日语文本。', 'error');
    document.getElementById('inputText')?.focus();
    return;
  }
  const inputSource = options.inputSource === 'sample' ? 'sample' : (options.inputSource === 'content_feed' ? 'content_feed' : 'paste');
  const countBucket = characterCountBucket(value);
  const startedAt = performance.now();
  let generationEventSent = false;
  setSourceAnalysisBusy(true);
  try{
    const normalizedUrl = normalizeArticleUrl(value);
    if(normalizedUrl){
      setImportStatus('暂不支持自动读取网页正文。请打开原文，复制需要学习的日语文本后粘贴到这里。', 'error');
      showToast('请复制原文中的日语文本后粘贴分析', 'info');
      return;
    }
    trackAnalyticsEvent('reading_start', {
      input_source:inputSource,
      character_count_bucket:countBucket
    });
    if(!options.preserveArticleUrl) CURRENT_ARTICLE_URL = '';
    prewarmLocalKuromojiWorker({showStatus:false});
    setImportStatus('正在分析文本……');
    await renderText();
    if(analysisGeneration !== SOURCE_ANALYSIS_GENERATION) return;
    const outcome = LAST_READING_GENERATION_RESULT || {status:'success', tokenizerMode:document.body.dataset.tokenizerMode || 'built-in', retryCount:0};
    if(outcome.status === 'error'){
      trackAnalyticsEvent('reading_generate_error', {
        stage:outcome.stage || 'render',
        error_code:outcome.errorCode || 'unknown',
        retry_count:Number(outcome.retryCount || 0)
      });
    }else{
      trackAnalyticsEvent('reading_generate_success', {
        duration_ms:performance.now() - startedAt,
        character_count_bucket:countBucket,
        tokenizer_mode:outcome.tokenizerMode || document.body.dataset.tokenizerMode || 'built-in',
        retry_count:Number(outcome.retryCount || 0)
      });
    }
    generationEventSent = true;
    setImportStatus('已生成可点击阅读材料。', 'ok');
  }catch(error){
    if(analysisGeneration !== SOURCE_ANALYSIS_GENERATION) return;
    console.error('文本分析失败', error);
    if(!generationEventSent){
      trackAnalyticsEvent('reading_generate_error', {
        stage:'render',
        error_code:analyticsErrorCode(error),
        retry_count:LAST_READING_RETRY_COUNT
      });
    }
    setImportStatus(`分析没有完成：${error?.message || '请稍后重试'}。可以先关闭智能分词再试一次。`, 'error');
    showToast('分析没有完成，请查看提示', 'error');
  }finally{
    if(analysisGeneration === SOURCE_ANALYSIS_GENERATION) setSourceAnalysisBusy(false);
  }
}

function setSourceAnalysisBusy(isBusy){
  const button = document.getElementById('analyzeSourceBtn');
  if(!button) return;
  button.disabled = isBusy;
  button.setAttribute('aria-busy', String(isBusy));
  button.textContent = isBusy ? '分析中……' : '开始阅读';
}

function setPostAnalysisActionsVisible(visible){
  document.getElementById('annotationEditBtn')?.classList.toggle('is-hidden', !visible);
  document.getElementById('exportTriggerBtn')?.classList.toggle('is-hidden', !visible);
  const readerToolbar = document.getElementById('readerToolbar');
  if(readerToolbar) readerToolbar.style.display = visible ? 'flex' : 'none';
  const nextStepBar = document.getElementById('nextStepBar');
  if(nextStepBar) nextStepBar.style.display = visible ? 'flex' : 'none';
  updatePostReadingMilestone();
}

function detailEmptyHtml(){
  return defaultDetailExampleHtml();
}

function setReadingDetailCollapsed(collapsed){
  document.body.classList.toggle('reading-detail-collapsed', !!collapsed);
  const toggle = document.getElementById('readingDetailToggleBtn');
  if(toggle){
    const isOpen = !collapsed;
    toggle.classList.toggle('is-active', isOpen);
    toggle.setAttribute('aria-pressed', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? '隐藏详解' : '显示详解');
    toggle.dataset.tooltip = isOpen ? '隐藏详解' : '显示详解';
  }
}

function setReadingDetailVisible(visible){
  setReadingDetailCollapsed(!visible);
}

function toggleReadingDetailPanel(){
  setReadingDetailCollapsed(!document.body.classList.contains('reading-detail-collapsed'));
}

function resetReadingDetailPanel(){
  const detailArea = document.getElementById('detailArea');
  if(detailArea) detailArea.innerHTML = detailEmptyHtml();
  setDetailHeadActions();
  setReadingDetailCollapsed(false);
}

function updatePostReadingMilestone(){
  const target = document.getElementById('postReadingStats');
  if(!target) return;
  const chars = CURRENT_ARTICLE_TEXT.trim().length;
  if(!chars){
    target.textContent = '放入文章后，这里会显示阅读成果';
    return;
  }
  const vocabCount = getAllVocab().length;
  const sentenceCount = getArticlePracticeSentences(CURRENT_ARTICLE_TEXT).length || 1;
  target.textContent = `本文约 ${chars} 字 · ${sentenceCount} 句 · 生词本 ${vocabCount} 词`;
}

function setReadingReady(ready){
  document.body.classList.toggle('has-reading', !!ready);
  document.body.classList.remove('is-editing-source');
  const composer = document.getElementById('sourceComposer');
  if(composer && ready) composer.classList.remove('is-open');
  updatePostReadingMilestone();
  renderLearningPath();
}

function editSourceText(){
  const composer = document.getElementById('sourceComposer');
  if(!composer) return;
  document.body.classList.add('is-editing-source');
  composer.classList.add('is-open');
  document.getElementById('inputText')?.focus();
}

function openRecommendedSource(url){
  clearActiveReadingQueueItem();
  window.open(url, '_blank', 'noopener,noreferrer');
  const input = document.getElementById('inputText');
  if(input) input.focus();
  setImportStatus('来源已在新窗口打开。复制需要学习的日语文本，再回到这里粘贴分析。');
}

function setImportStatus(message, type = ''){
  const status = document.getElementById('importStatus');
  if(!status) return;
  status.textContent = message;
  status.className = `import-status ${type}`.trim();
}

let pendingImportMeta = null;
function switchWorkspace(view){
  if(!['reading','typing','grammar','retell','discover','test','history','vocab','settings'].includes(view)) return;
  if(view === 'typing') view = 'retell';
  closeVocabPanel();
  closeMenu();
  document.body.dataset.view = view;
  document.querySelectorAll('.app-sidebar .nav-item, #menuPanel .nav-item[data-view]').forEach(button=>{
    const navView = button.dataset.view;
    const isPractice = (view === 'typing' || view === 'retell') && navView === 'retell';
    const isReadingSetup = view === 'test' && navView === 'reading';
    const isActive = navView === view || isPractice || isReadingSetup;
    button.classList.toggle('active', isActive);
    if(isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelectorAll('.workspace-tab').forEach(button=>{
    button.classList.toggle('active', button.dataset.view === view);
  });
  document.querySelectorAll('.sidebar-utility-button[data-view]').forEach(button=>{
    const isActive = button.dataset.view === view;
    button.classList.toggle('active', isActive);
    if(isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  safeStorage.setItem('reading_workspace', view);
  if(view === 'retell'){
    refreshRetellAdvice();
    renderTypingPractice();
    renderVocabPractice();
    renderPracticeSummary();
    renderPracticeReview();
    renderPracticeModuleVisibility();
  }
  if(view === 'discover'){
    renderReadingQueue();
    renderSourceDirectory();
    window.refreshContentFeed?.();
  }
  if(view === 'settings'){
    document.querySelectorAll('#settingsLanguageSelect, #interfaceLanguageSelect').forEach(select=>{
      if(select) select.value = safeStorage.getItem('interface_language') || 'zh';
    });
  }
  if(view === 'history') renderReadingHistory();
  if(view === 'vocab'){
    syncVocabPanelData();
    prepareVocabReview();
  }
  if(view === 'grammar'){
    renderGrammarBook();
    renderGrammar();
  }
  if(SAMPLE_FLOW_ACTIVE && view === 'vocab') SAMPLE_FLOW_VISITED_VOCAB = true;
  if(SAMPLE_FLOW_ACTIVE && view === 'retell') SAMPLE_FLOW_VISITED_PRACTICE = true;
  if(view === 'reading') renderDailyPlan();
  updateResourceTabs(view);
  renderLearningPath();
  renderSampleFlow();
}

function updateResourceTabs(view){
  const pageLabel = {
    reading:'阅读工作台',
    vocab:'生词本',
    retell:'练习',
    discover:'资料中心',
    test:'水平测试',
    history:'学习历史',
    grammar:'语法本'
  }[view] || '阅读工作台';
  document.title = `${pageLabel} · 読める`;
}

function openImportPreview(text, meta = {}){
  pendingImportMeta = meta;
  IMPORT_PREVIEW_TRIGGER = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const editor = document.getElementById('importPreviewText');
  editor.value = cleanImportedText(String(text || ''), meta).trim();
  updateImportPreviewSummary();
  setDialogVisibility(document.getElementById('importPreviewModal'), true, editor);
}

function closeImportPreview(){
  setDialogVisibility(document.getElementById('importPreviewModal'), false);
  if(IMPORT_PREVIEW_TRIGGER?.isConnected) IMPORT_PREVIEW_TRIGGER.focus();
  IMPORT_PREVIEW_TRIGGER = null;
}

function cleanImportedText(text, meta = {}){
  const isPdf = meta.type === 'pdf' || /\.pdf$/i.test(meta.title || '');
  let value = stripUnrenderableSymbols(String(text || '').replace(/\r\n?/g, '\n'));
  if(isPdf) value = cleanPdfImportedText(value);
  if(meta.cleanupMode === 'web-article') value = cleanWebArticlePdfText(value);
  return value.trim();
}

function stripUnrenderableSymbols(text){
  // Icon/bullet glyphs from web pages often have no matching glyph in the export font
  // and render as a tofu box. Strip these symbol/private-use/emoji ranges on import.
  return String(text || '')
    .replace(/[\u2190-\u27bf]/g, '')
    .replace(/[\u2b00-\u2bff]/g, '')
    .replace(/[\ue000-\uf8ff]/g, '')
    .replace(/[\u{1f300}-\u{1faff}]/gu, '');
}

function cleanPdfImportedText(text){
  const lines = String(text || '').split('\n');
  const cleaned = [];
  for(const line of lines){
    const trimmed = line.trim();
    if(!trimmed){
      cleaned.push('');
      continue;
    }
    if(isPdfNoiseLine(trimmed)) continue;
    if(isPdfAnnotationLine(trimmed)) continue;
    cleaned.push(stripPdfInlineAnnotationMarkers(line));
  }
  return cleaned
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanWebArticlePdfText(text){
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const cleaned = [];
  const seen = new Set();
  for(const rawLine of lines){
    const line = rawLine.replace(/[ \t]+/g, ' ').trim();
    if(!line){
      if(cleaned.length && cleaned[cleaned.length - 1] !== '') cleaned.push('');
      continue;
    }
    if(isWebArticleNoiseLine(line)) continue;
    const normalized = line.replace(/\s+/g, '');
    if(seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(line);
  }
  return joinJapaneseArticleLines(cleaned).replace(/\n{3,}/g, '\n\n').trim();
}

function isWebArticleNoiseLine(line){
  const compact = line.replace(/\s+/g, '');
  const hasJapanese = /[\u3040-\u30ff\u3400-\u9fff]/.test(line);
  const japaneseCount = (line.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  if(isPdfNoiseLine(line)) return true;
  if(/https?:\/\/|www\.|nhk\.or\.jp|www3\.nhk\.or\.jp|\.html?|\.pdf/i.test(line)) return true;
  if(/^(NHK|NEWS WEB EASY|NEWS|WEB|Easy Japanese|Japan|日本語|English|中文|한국어)$/i.test(line)) return true;
  if(/(?:シェア|共有|印刷|トップ|ホーム|メニュー|検索|ログイン|本文へ|戻る|前へ|次へ|一覧|関連|おすすめ|広告|PR|動画|音声|画像|写真|このページ|ページの先頭|利用規約|プライバシー|お問い合わせ|Copyright|All Rights Reserved|©)/i.test(line) && japaneseCount < 18) return true;
  if(/^\d{4}年\d{1,2}月\d{1,2}日(?:\s+\d{1,2}時\d{1,2}分)?$/.test(compact)) return true;
  if(/^\d{1,2}月\d{1,2}日(?:\s+\d{1,2}時\d{1,2}分)?$/.test(compact)) return true;
  if(!hasJapanese && line.length < 32) return true;
  if(hasJapanese && line.length <= 2) return true;
  return false;
}

function joinJapaneseArticleLines(lines){
  const output = [];
  for(const line of lines){
    if(!line){
      if(output.length && output[output.length - 1] !== '') output.push('');
      continue;
    }
    const prev = output[output.length - 1];
    // Headline-list pages (news portals) pack short, unrelated titles one per line with
    // no terminal punctuation - joining those onto the previous line mashes unrelated
    // headlines together. A genuine line-wrap from a printed PDF is consistently close to
    // the page's full width and rarely ends in an ellipsis (a common headline-truncation
    // marker), so only join lines that look like that.
    const looksLikeWrappedSentence = prev && prev.length >= 18 && !/[\u2026\u22ef]$/.test(prev);
    const shouldJoin = looksLikeWrappedSentence
      && !/[\u3002\uff01\uff1f!?\u300d\u300f\uff09)]$/.test(prev)
      && /^[\u3040-\u30ff\u3400-\u9fffA-Za-z0-9\u300c\u300e\uff08(]/.test(line)
      && (prev.length + line.length) < 95;
    if(shouldJoin) output[output.length - 1] = `${prev}${line}`;
    else output.push(line);
  }
  return output.join('\n');
}

function isPdfNoiseLine(line){
  const noJapanese = !/[\u3040-\u30ff\u3400-\u9fff]/.test(line);
  const compact = line.replace(/\s+/g, '');
  if(/^[-–—•·・･\u2022.\u30fb\s\d]+$/.test(line) && noJapanese) return true;
  if(/^(?:[-–—•·・･\u2022]\s*)?\d{1,4}(?:\s*[-–—•·・･\u2022])?$/.test(line)) return true;
  if(/^[.…。．・･·•\u2022]{2,}$/.test(compact)) return true;
  if(/^(?:参考)?(?:图片|插图|图|圖|画像|写真|figure|fig\.?)\s*[:：]?\s*\d*$/i.test(line)) return true;
  if(/^(?:第\s*)?\d{1,4}\s*(?:页|頁|ページ|p\.)$/i.test(line)) return true;
  if(/^\d{1,3}\s*[.…。．・･·•\u2022]{2,}\s*\d{0,3}$/.test(line)) return true;
  return false;
}

function isPdfAnnotationLine(line){
  const markerCount = (line.match(/(?:^|[\s。．、,，])\d{1,2}(?=[\u3040-\u30ff\u3400-\u9fffA-Za-z])/g) || []).length;
  const hasManyDefinitions = markerCount >= 3 && line.length < 260;
  const hasAnnotationKeywords = /(?:注|註|脚注|参考|語注|語釈|用語|Sentimentalisme|figure|fig\.)/i.test(line);
  return hasManyDefinitions || (hasAnnotationKeywords && markerCount >= 1);
}

function stripPdfInlineAnnotationMarkers(line){
  return line
    .replace(/(^|[\s。．、,，])\d{1,2}(?=[\u3040-\u30ff\u3400-\u9fffA-Za-z])/g, '$1')
    .replace(/\d{1,3}\s*[.…。．・･·•\u2022]{2,}\s*\d{0,3}/g, '')
    .replace(/[.…。．・･·•\u2022]{3,}/g, '')
    .replace(/[ \t]{2,}/g, ' ');
}

function updateImportPreviewSummary(){
  const text = document.getElementById('importPreviewText')?.value || '';
  const lines = text ? text.split(/\n/).length : 0;
  const japaneseCount = (text.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  const summary = document.getElementById('importPreviewSummary');
  if(!summary) return;
  const mayNotBeJapaneseText = text.trim().length > 0 && japaneseCount < 20;
  summary.classList.toggle('has-warning', mayNotBeJapaneseText);
  summary.innerHTML = `
    <span>${escapeHtml(pendingImportMeta?.title || '导入内容')}</span>
    <span>${text.length.toLocaleString()} 字符</span>
    <span>${lines} 行</span>
    <span>${japaneseCount.toLocaleString()} 个日文字符</span>
    ${mayNotBeJapaneseText ? '<b class="import-preview-warning">这段内容里的日文较少，可能不是正文。</b>' : ''}
  `;
}

function cleanImportText(mode){
  const editor = document.getElementById('importPreviewText');
  if(!editor) return;
  let text = editor.value;
  if(mode === 'article') text = cleanWebArticlePdfText(cleanPdfImportedText(text));
  if(mode === 'blank') text = text.replace(/\n{3,}/g, '\n\n');
  if(mode === 'spaces') text = text.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n');
  if(mode === 'edges'){
    const lines = text.split(/\n/);
    while(lines.length > 1 && lines[0].trim().length < 8) lines.shift();
    while(lines.length > 1 && lines[lines.length - 1].trim().length < 8) lines.pop();
    text = lines.join('\n');
  }
  editor.value = text.trim();
  updateImportPreviewSummary();
}

async function confirmImportPreview(){
  const editor = document.getElementById('importPreviewText');
  const text = cleanImportedText(editor?.value || '', pendingImportMeta || {}).trim();
  if(!text){
    setImportStatus('导入预览是空的，请保留正文内容后再继续。', 'error');
    showToast('导入正文为空', 'warning');
    editor?.focus();
    return;
  }
  CURRENT_FOOTNOTES = Array.isArray(pendingImportMeta?.footnotes) ? pendingImportMeta.footnotes : [];
  CURRENT_ARTICLE_URL = readingQueueUrl(pendingImportMeta?.url || '');
  document.getElementById('inputText').value = text;
  const sourceType = String(pendingImportMeta?.type || 'file').toLowerCase();
  closeImportPreview();
  switchWorkspace('reading');
  setSourceAnalysisBusy(true);
  try{
    const startedAt = performance.now();
    const countBucket = characterCountBucket(text);
    trackAnalyticsEvent('reading_start', {input_source:'paste', character_count_bucket:countBucket});
    setImportStatus(`正在分析: ${pendingImportMeta?.title || '正文'}……`);
    await renderText();
    const outcome = LAST_READING_GENERATION_RESULT || {status:'success', tokenizerMode:document.body.dataset.tokenizerMode || 'built-in', retryCount:0};
    if(outcome.status === 'error'){
      trackAnalyticsEvent('reading_generate_error', {
        stage:outcome.stage || 'tokenizer',
        error_code:outcome.errorCode || 'unknown',
        retry_count:Number(outcome.retryCount || 0)
      });
    }else{
      trackAnalyticsEvent('reading_generate_success', {
        duration_ms:performance.now() - startedAt,
        character_count_bucket:countBucket,
        tokenizer_mode:outcome.tokenizerMode || 'built-in',
        retry_count:Number(outcome.retryCount || 0)
      });
    }
    setImportStatus(`已导入: ${pendingImportMeta?.title || '正文'}`, 'ok');
  }catch(error){
    console.error('导入正文分析失败', error);
    trackAnalyticsEvent('reading_generate_error', {stage:'import', error_code:analyticsErrorCode(error), retry_count:LAST_READING_RETRY_COUNT});
    setImportStatus(`导入成功，但分析没有完成：${error?.message || '请稍后重试'}。`, 'error');
    showToast('导入后分析失败，请查看提示', 'error');
  }finally{
    setSourceAnalysisBusy(false);
  }
}

async function loadPdfJs(){
  await loadExternalScript(THIRD_PARTY_SCRIPTS.pdfjs, 'pdfjsLib');
  if(!window.pdfjsLib) throw new Error('PDF 本地解析组件加载失败。');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = THIRD_PARTY_SCRIPTS.pdfjsWorker;
  return window.pdfjsLib;
}

async function extractPdfTextInBrowser(file){
  const pdfjsLib = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data:buffer }).promise;
  if(pdf.numPages > 80) throw new Error(`PDF 共 ${pdf.numPages} 页，当前最多支持 80 页。`);
  const mode = document.getElementById('pdfModeSelect')?.value || 'auto';
  const pageTexts = [];
  for(let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1){
    setImportStatus(`正在本地解析 PDF：${pageNumber}/${pdf.numPages} 页……`);
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale:1 });
    const items = (content.items || [])
      .map(item => ({
        text:String(item.str || ''),
        x:Number(item.transform?.[4] || 0),
        y:Number(item.transform?.[5] || 0),
        width:Number(item.width || 0),
        height:Number(item.height || item.transform?.[3] || item.transform?.[0] || 10),
        transform:item.transform || [],
        hasEOL:!!item.hasEOL
      }))
      .filter(item => item.text.trim());
    const layout = classifyBrowserPdfLayoutItems(items, viewport);
    const text = pdfItemsToReadableText(layout.bodyItems, mode);
    if(text) pageTexts.push(text);
  }
  const text = pageTexts.join('\n\n').trim();
  if(!text) throw new Error('这个 PDF 没有可提取文字，可能是扫描图片版。');
  return { text, pageCount:pdf.numPages, layoutMode:mode === 'vertical' ? 'vertical-to-horizontal' : 'browser-local' };
}

function pdfItemsToReadableText(items, mode = 'auto'){
  if(!items.length) return '';
  const shouldTreatAsVertical = mode === 'vertical' || (mode === 'auto' && isLikelyVerticalBrowserPdfPage(items));
  if(shouldTreatAsVertical) return verticalPdfItemsToText(items);
  return horizontalPdfItemsToText(items);
}

function horizontalPdfItemsToText(items){
  const lines = [];
  let current = [];
  items.forEach(item => {
    if(!String(item.text || '').trim()) return;
    current.push(item);
    if(item.hasEOL){
      lines.push(current);
      current = [];
    }
  });
  if(current.length) lines.push(current);
  if(!lines.length) return '';

  const lineLefts = lines
    .map(line => line.find(item => String(item.text || '').trim()))
    .filter(Boolean)
    .map(item => pdfBrowserItemBox(item).left);
  const baseLeft = lineLefts.length ? medianBrowserPdf(lineLefts) : 0;
  const avgSize = medianBrowserPdf(items.map(pdfBrowserItemSize).filter(value => value > 0)) || 10;
  const indentThreshold = avgSize * 0.8;

  let output = '';
  lines.forEach((line, index) => {
    let lineText = '';
    line.forEach(item => {
      const value = String(item.text || '');
      if(!value) return;
      const previous = lineText.slice(-1);
      const needsSpace = previous && !/\s/.test(previous) && shouldSeparateBrowserPdfText(previous, value[0]);
      lineText += `${needsSpace ? ' ' : ''}${value}`;
    });
    if(!lineText.trim()) return;
    const firstVisible = line.find(item => String(item.text || '').trim());
    const left = firstVisible ? pdfBrowserItemBox(firstVisible).left : baseLeft;
    const isIndented = left - baseLeft > indentThreshold || /^[　]/.test(lineText);
    const cleanedLine = lineText.replace(/^[　\s]+/, '');
    if(index === 0) output += cleanedLine;
    else output += isIndented ? `\n\n${cleanedLine}` : `\n${cleanedLine}`;
  });
  return cleanBrowserPdfText(output);
}

function verticalPdfItemsToText(items){
  const bodySize = estimateBrowserPdfBodySize(items);
  const readableItems = filterVerticalBrowserPdfAnnotationItems(items, bodySize);
  const columns = clusterBrowserPdfItemsByX(readableItems);
  const lines = columns.map(column => {
    const sorted = column
      .filter(item => String(item.text || '').trim())
      .sort((a, b) => {
        const ay = pdfBrowserItemBox(a).y;
        const by = pdfBrowserItemBox(b).y;
        if(Math.abs(by - ay) > 2) return by - ay;
        return pdfBrowserItemBox(b).left - pdfBrowserItemBox(a).left;
      });
    const text = sorted.map(normalizeVerticalBrowserPdfTextItem).join('').replace(/\s+/g, '');
    const topY = sorted.length ? pdfBrowserItemBox(sorted[0]).y : null;
    return { text, topY };
  }).filter(line => line.text);
  if(!lines.length) return '';

  const tops = lines.map(line => line.topY).filter(value => value !== null);
  const baseTop = tops.length ? medianBrowserPdf(tops) : null;
  const avgSize = medianBrowserPdf(readableItems.map(pdfBrowserItemSize).filter(value => value > 0)) || 10;
  const indentThreshold = avgSize * 0.8;

  let output = '';
  lines.forEach((line, index) => {
    if(index === 0){
      output += line.text;
      return;
    }
    const isIndented = baseTop !== null && line.topY !== null && (baseTop - line.topY) > indentThreshold;
    output += isIndented ? `\n\n${line.text}` : `\n${line.text}`;
  });
  return cleanBrowserPdfText(stripVerticalBrowserPdfAnnotationText(output));
}

function filterVerticalBrowserPdfAnnotationItems(items, bodySize){
  const threshold = (bodySize || 10) * 0.86;
  return items.filter(item => {
    const text = String(item?.text || '').trim();
    if(!text) return false;
    const size = pdfBrowserItemSize(item);
    if(!size) return true;
    return size > threshold;
  });
}

function stripVerticalBrowserPdfAnnotationText(text){
  return String(text || '')
    .replace(/[・･][^・･\n。！？]{1,36}[。！？]/g, '')
    .replace(/[・･][^・･\n]{1,20}(?=\n|$)/g, '');
}

function classifyBrowserPdfLayoutItems(items, viewport){
  const visible = items.filter(item => item && String(item.text || '').trim());
  const bodySize = estimateBrowserPdfBodySize(visible);
  const rubyFiltered = filterBrowserPdfRubyItems(visible);
  const rubySet = new Set(visible.filter(item => !rubyFiltered.includes(item)));
  return {
    bodyItems:visible.filter(item => {
      if(rubySet.has(item)) return false;
      const value = String(item.text || '').trim();
      if(isBrowserPdfNoiseText(value)) return false;
      const size = pdfBrowserItemSize(item) || bodySize;
      const box = pdfBrowserItemBox(item);
      const isSmall = size <= bodySize * 0.74;
      const isBottom = viewport && box.y < Number(viewport.height || 0) * 0.22;
      const isEdge = viewport && (box.left < Number(viewport.width || 0) * 0.08 || box.right > Number(viewport.width || 0) * 0.92);
      return !(isSmall && (isBottom || isEdge || isLikelyBrowserPdfFootnote(value)));
    })
  };
}

function estimateBrowserPdfBodySize(items){
  const sizes = items
    .filter(item => /[\u3040-\u30ff\u3400-\u9fff]/.test(String(item.text || '')) && !isBrowserPdfNoiseText(String(item.text || '')))
    .map(pdfBrowserItemSize)
    .filter(value => value > 0)
    .sort((a, b) => a - b);
  if(!sizes.length) return 10;
  return sizes[Math.floor(sizes.length * 0.75)] || medianBrowserPdf(sizes) || 10;
}

function filterBrowserPdfRubyItems(items){
  return items.filter(candidate => {
    const text = String(candidate.text || '').trim();
    if(!/^[\u3040-\u30ffー・\s]+$/.test(text)) return true;
    const candidateSize = pdfBrowserItemSize(candidate);
    if(!candidateSize) return true;
    const candidateBox = pdfBrowserItemBox(candidate);
    const hasBaseTextBelow = items.some(base => {
      if(base === candidate || !/[\u3400-\u9fff々〆ヶ]/.test(String(base.text || ''))) return false;
      const baseSize = pdfBrowserItemSize(base);
      if(!baseSize || candidateSize > baseSize * 0.68) return false;
      const baseBox = pdfBrowserItemBox(base);
      const baselineGap = candidateBox.y - baseBox.y;
      if(baselineGap < baseSize * 0.35 || baselineGap > baseSize * 1.35) return false;
      const overlap = Math.min(candidateBox.right, baseBox.right) - Math.max(candidateBox.left, baseBox.left);
      const candidateCenter = (candidateBox.left + candidateBox.right) / 2;
      return overlap >= Math.min(candidateBox.width, baseBox.width) * 0.2 ||
        (candidateCenter >= baseBox.left - baseSize * 0.25 && candidateCenter <= baseBox.right + baseSize * 0.25);
    });
    return !hasBaseTextBelow;
  });
}

function isLikelyVerticalBrowserPdfPage(items){
  const japaneseItems = items.filter(item => /[\u3040-\u30ff\u3400-\u9fff]/.test(String(item.text || '')));
  if(japaneseItems.length < 12) return false;
  const rotatedCount = japaneseItems.filter(isBrowserPdfItemRotatedVertical).length;
  if(rotatedCount >= japaneseItems.length * 0.45) return true;
  const singleCharCount = japaneseItems.filter(item => [...String(item.text || '').trim()].length <= 2).length;
  const xClusters = clusterBrowserPdfItemsByX(japaneseItems);
  const tallColumns = xClusters.filter(column => column.length >= 5).length;
  return singleCharCount >= japaneseItems.length * 0.55 && xClusters.length >= 2 && tallColumns >= 2;
}

function clusterBrowserPdfItemsByX(items){
  const entries = items
    .filter(item => item && String(item.text || '').trim())
    .map(item => ({ item, box:pdfBrowserItemBox(item), size:pdfBrowserItemSize(item) || 10 }))
    .sort((a, b) => b.box.left - a.box.left);
  const threshold = Math.max(4, (medianBrowserPdf(entries.map(entry => entry.size)) || 10) * 1.1);
  const columns = [];
  entries.forEach(entry => {
    let column = columns.find(group => Math.abs(group.x - entry.box.left) <= threshold);
    if(!column){
      column = { x:entry.box.left, entries:[] };
      columns.push(column);
    }
    column.entries.push(entry);
    column.x = column.entries.reduce((sum, value) => sum + value.box.left, 0) / column.entries.length;
  });
  const merged = [];
  columns.sort((a, b) => b.x - a.x).forEach(column => {
    const prev = merged[merged.length - 1];
    if(prev && (prev.entries.length < 3 || column.entries.length < 3) && Math.abs(prev.x - column.x) <= threshold * 1.8){
      prev.entries.push(...column.entries);
      prev.x = prev.entries.reduce((sum, value) => sum + value.box.left, 0) / prev.entries.length;
      return;
    }
    merged.push(column);
  });
  return merged.sort((a, b) => b.x - a.x).map(column => column.entries.map(entry => entry.item));
}

function pdfBrowserItemSize(item){
  const transformSize = Number(item.transform?.[3]);
  return Math.abs(transformSize || Number(item.height) || 0);
}

function pdfBrowserItemBox(item){
  const left = Number(item.x || item.transform?.[4] || 0);
  const y = Number(item.y || item.transform?.[5] || 0);
  const width = Math.max(0, Number(item.width) || 0);
  return { left, right:left + width, width, y };
}

function isBrowserPdfItemRotatedVertical(item){
  const transform = item?.transform || [];
  const a = Math.abs(Number(transform[0]) || 0);
  const b = Math.abs(Number(transform[1]) || 0);
  const c = Math.abs(Number(transform[2]) || 0);
  const d = Math.abs(Number(transform[3]) || 0);
  return b > a * 1.5 && c > d * 1.5;
}

function normalizeVerticalBrowserPdfTextItem(item){
  const value = String(item?.text || '');
  return isBrowserPdfItemRotatedVertical(item) ? [...value].join('') : value;
}

function isBrowserPdfNoiseText(text){
  const compact = String(text || '').replace(/\s+/g, '');
  if(!compact) return true;
  if(/^\d{1,4}[.…。．・･·•\u2022]{2,}\d{0,4}$/.test(compact)) return true;
  if(/^[.…。．・･·•\u2022]{3,}$/.test(compact)) return true;
  if(/^[-–—•·・･\u2022.\u30fb\d]+$/.test(compact) && !/[\u3040-\u30ff\u3400-\u9fff]/.test(compact)) return true;
  if(/^(?:第)?\d{1,4}(?:页|頁|ページ|p\.)$/i.test(compact)) return true;
  return false;
}

function isLikelyBrowserPdfFootnote(text){
  return /^(?:\d{1,2}|[＊※*])/.test(String(text || '').trim()) || /(?:注|註|脚注|語注|語釈|参考)/.test(String(text || ''));
}

function shouldSeparateBrowserPdfText(left, right){
  const japaneseOrPunctuation = /[\u3040-\u30ff\u3400-\u9fff\u3000-\u303f、。！？「」『』（）]/;
  return !japaneseOrPunctuation.test(left) && !japaneseOrPunctuation.test(right);
}

function cleanBrowserPdfText(text){
  return String(text || '').normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/([、。！？）」』】])\s+/g, '$1')
    .replace(/ +([、。！？）」』】])/g, '$1')
    .replace(/([（「『【]) +/g, '$1')
    .replace(/([\u3040-\u30ff\u3400-\u9fff]) +(?=[\u3040-\u30ff\u3400-\u9fff])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function medianBrowserPdf(values){
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if(!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function extractLocalDocumentFile(file, extension){
  if(extension === '.pdf'){
    const result = await extractPdfTextInBrowser(file);
    const cleanupMode = document.getElementById('pdfCleanupSelect')?.value || 'normal';
    return {
      text:result.text,
      meta:{
        title:file.name,
        type:'pdf',
        cleanupMode,
        pageCount:result.pageCount,
        layoutMode:result.layoutMode,
        layoutWarnings:result.layoutMode === 'browser-local' ? ['PDF Beta 适合文字型 PDF；扫描件和复杂排版可能无法正确识别。'] : []
      },
      status:`已在浏览器本地读取 ${file.name}${result.pageCount ? `，${result.pageCount} 页` : ''}，请检查内容`
    };
  }
  throw new Error('目前支持文字型 PDF（Beta），其他格式请复制文本后粘贴。');
}

async function extractUploadedFile(file){
  await ensureLearningData();
  const resetFileInputs = ()=>document.querySelectorAll('#documentFileInput,#heroPdfInput').forEach(node=>{ node.value = ''; });
  if(!file) return;

  // 基本验证
  if(file.size === 0){
    showToast('文件为空，请选择有效的文件', 'error');
    resetFileInputs();
    return;
  }

  document.body.classList.remove('first-visit');
  safeStorage.setItem('hasUsedApp', 'true');
  switchWorkspace('reading');
  const extension = (file.name.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
  const limits = {'.pdf':20 * 1024 * 1024};
  if(!limits[extension]){
    setImportStatus('目前支持文字型 PDF（Beta）。其他格式请复制日语文本后粘贴分析。', 'error');
    showToast('不支持的文件格式', 'error');
    resetFileInputs();
    return;
  }
  if(file.size > limits[extension]){
    const limitMB = Math.round(limits[extension] / 1024 / 1024);
    const fileMB = Math.round(file.size / 1024 / 1024);
    setImportStatus(`${extension.slice(1).toUpperCase()} 文件超过大小限制（${fileMB}MB > ${limitMB}MB）。`, 'error');
    showToast(`文件过大：${fileMB}MB（限制${limitMB}MB）`, 'error');
    resetFileInputs();
    return;
  }

  if(extension === '.pdf'){
    setImportStatus(`正在浏览器本地解析 ${file.name}……`);
    try{
      const result = await extractLocalDocumentFile(file, extension);
      setImportStatus(result.status, 'ok');
      openImportPreview(result.text, result.meta);
      showToast('PDF 解析成功，请先检查提取内容', 'success');
      resetFileInputs();
      return;
    }catch(error){
      setImportStatus(`${error.message || 'PDF 解析失败。'} 请复制 PDF 中需要学习的日语文本后粘贴分析。扫描件、图片型 PDF 和复杂排版目前可能无法识别。`, 'error');
      showToast('PDF 解析失败，请改用复制粘贴', 'error');
      resetFileInputs();
      return;
    }
  }
}

function escapeHtml(str){
  return String(str ?? '')
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function plainSelectedText(){
  const selection = window.getSelection();
  if(!selection || !selection.rangeCount) return '';
  const container = document.createElement('div');
  for(let i = 0; i < selection.rangeCount; i += 1){
    container.appendChild(selection.getRangeAt(i).cloneContents());
  }
  container.querySelectorAll('rt').forEach(node=>node.remove());
  return (container.textContent || selection.toString() || '').replace(/\s+/g, ' ').trim();
}

function shouldShowRuby(surface, reading){
  if(!reading || reading === '*' || surface === reading) return false;
  if(/^[。、！？「」『』（）\(\)、,.!?\s]+$/.test(surface)) return false;
  const hasKanji = /[\u4e00-\u9fff]/.test(surface);
  const hasKana = /[\u3040-\u309f\u30a0-\u30ffー]/.test(surface);
  if(hasKanji && hasKana) return true;
  if(/^[\u3040-\u309fー]+$/.test(surface)) return false;
  return hasKanji || /[\u30a0-\u30ff]/.test(surface);
}

function isMixedKanjiKana(surface){
  return /[\u4e00-\u9fff]/.test(surface) && /[\u3040-\u309f\u30a0-\u30ffー]/.test(surface);
}

function renderWordNode(surface, reading, cls, attrs, onClick){
  const override = RUBY_OVERRIDES[surface];
  if(override) reading = override.hidden ? '' : override.reading;
  const safeSurface = escapeHtml(surface);
  const safeReading = escapeHtml(reading || '');
  const allAttrs = {...(attrs || {}), 'data-reading':reading || ''};
  const attrText = Object.entries(allAttrs).map(([key,value]) => `${key}="${escapeHtml(String(value))}"`).join(' ');
  const groupCls = isMixedKanjiKana(surface) ? ' w-grouped' : '';
  const content = shouldShowRuby(surface, reading)
    ? `${safeSurface}<rt>${safeReading}</rt>`
    : safeSurface;
  const label = `${surface}${reading ? '，读音 ' + reading : ''}。查看释义`;
  return `<ruby class="w ${cls}${groupCls}" ${attrText} role="button" tabindex="0" aria-label="${escapeHtml(label)}" onclick="${onClick}" onkeydown="activateWordNode(event,this)">${content}</ruby>`;
}

function activateWordNode(event, el){
  if(event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  el?.click();
}

function footnoteForId(id){
  return CURRENT_FOOTNOTES.find(note => String(note.id) === String(id));
}

function renderFootnoteRef(id){
  const safe = escapeHtml(String(id));
  return `<sup class="footnote-ref" role="button" tabindex="0" aria-label="查看脚注 ${safe}" onclick="showFootnoteDetail('${safe}')" onkeydown="activateWordNode(event,this)">${safe}</sup>`;
}

function renderPlainTextWithFootnotes(text){
  const value = String(text || '');
  if(!CURRENT_FOOTNOTES.length) return escapeHtml(value);
  return value.replace(/\d{1,2}/g, match => footnoteForId(match) ? renderFootnoteRef(match) : escapeHtml(match));
}

function renderRubyUnitNode(unit, index){
  const safeBase = escapeHtml(unit.base || '');
  const safeRuby = escapeHtml(unit.ruby || '');
  const cls = unit.cls || 'w-kuromoji';
  const content = shouldShowRuby(unit.base, unit.ruby)
    ? `${safeBase}<rt>${safeRuby}</rt>`
    : safeBase;
  return `<ruby class="w ${cls}" data-edited-unit="${index}" data-reading="${safeRuby}">${content}</ruby>`;
}

const LOCAL_SENTENCE_TRANSLATIONS = new Map([
  ['私は毎朝七時に起きます。', '我每天早上七点起床。'],
  ['朝ごはんを食べてから、学校に行きます。', '吃完早饭后，我去学校。'],
  ['今日は友達と一緒に図書館で勉強する予定です。', '今天我打算和朋友一起去图书馆学习。'],
  ['先生はとても親切で、いつも丁寧に教えてくれます。', '老师非常亲切，总是耐心地教我。'],
  ['週末は時間があれば、映画を見たり、本を読んだりします。', '周末有时间的话，我会看看电影、读读书。'],
  ['でも、隣の友達が結束のために手紙を書いていて、ちょっと邪魔でした。', '不过，旁边的朋友为了团结大家一直在写信，稍微有点打扰到我。']
]);

function conciseDictionaryMeaning(info){
  return String(info?.meaning || '')
    .split(/[（(「]/)[0]
    .replace(/[，,、].*$/, '')
    .trim();
}

const LOCAL_TRANSLATION_FALLBACK = '暂时没有可用的本地译文。可以继续点词查看释义。';

function localSentenceTranslation(sentence){
  const clean = String(sentence || '').trim();
  if(!clean) return '';
  if(LOCAL_SENTENCE_TRANSLATIONS.has(clean)) return LOCAL_SENTENCE_TRANSLATIONS.get(clean);

  // Joining isolated dictionary meanings produces fluent-looking but false
  // translations. For unknown text, be explicit about the local MVP limit.
  return LOCAL_TRANSLATION_FALLBACK;
}

function localParagraphTranslation(text){
  const sentences = String(text || '')
    .match(/[^。！？!?]+[。！？!?]?/g) || [String(text || '')];
  const translations = sentences.map(localSentenceTranslation).filter(Boolean);
  const usefulTranslations = translations.filter(text => text !== LOCAL_TRANSLATION_FALLBACK);
  if(!usefulTranslations.length) return LOCAL_TRANSLATION_FALLBACK;
  return usefulTranslations.join('');
}

function addParagraphTranslations(html, raw){
  const paragraphs = normalizeReadingInput(raw).split(/\n{2,}/);
  const parts = String(html).split(/\n{2,}/);
  if(parts.length !== paragraphs.length){
    const translation = SHOW_PARAGRAPH_TRANSLATION
      ? `<div class="paragraph-translation" lang="zh-CN">${escapeHtml(localParagraphTranslation(raw))}</div>`
      : '';
    return `<section class="reading-translation-pair"><div class="reading-japanese">${html}</div>${translation}</section>`;
  }
  return parts.map((part, index)=>`
    <section class="reading-translation-pair">
      <div class="reading-japanese">${part}</div>
      ${SHOW_PARAGRAPH_TRANSLATION ? `<div class="paragraph-translation" lang="zh-CN">${escapeHtml(localParagraphTranslation(paragraphs[index]))}</div>` : ''}
    </section>
  `).join('');
}

async function renderText(){
  const renderGeneration = ++LOCAL_KUROMOJI_RENDER_GENERATION;
  LAST_READING_GENERATION_RESULT = null;
  await ensureLearningData();
  const showRuby = !!document.getElementById('useKuromoji')?.checked;
  const useLocalKuromojiWorker = showRuby && ENABLE_LOCAL_KUROMOJI_WORKER;
  const useRemoteKuromoji = showRuby && !useLocalKuromojiWorker && ENABLE_REMOTE_SMART_SEGMENTATION;
  document.body.dataset.tokenizerMode = 'built-in';
  document.body.classList.toggle('reading-ruby-visible', showRuby);
  document.getElementById('rubyToggleBtn')?.classList.toggle('is-active', showRuby);
  const raw = normalizeReadingInput(document.getElementById('inputText').value).trim();
  const nextPracticeKey = articlePracticeKey(raw);
  const out = document.getElementById('output');
  const statsBar = document.getElementById('statsBar');
  if(!raw){
    out.innerHTML = '<span style="color:var(--ink-soft);font-size:14.5px;">请先粘贴文本，或点击「用示例开始」。</span>';
    if(statsBar) statsBar.innerHTML = '';
    renderReadingAnalysis(null);
    CURRENT_ARTICLE_TEXT = '';
    resetArticlePracticeState('');
    refreshRetellAdvice();
    setPostAnalysisActionsVisible(false);
    setReadingReady(false);
    resetReadingDetailPanel();
    return;
  }

  CURRENT_ARTICLE_TEXT = raw;
  if(nextPracticeKey !== CURRENT_ARTICLE_PRACTICE_KEY) resetArticlePracticeState(nextPracticeKey);
  refreshRetellAdvice();
  setPostAnalysisActionsVisible(true);
  setReadingReady(true);
  resetReadingDetailPanel();
  renderSampleFlow();

  // 显示阅读辅助状态
  const statusBar = document.getElementById('statusBar');
  const legendInline = document.getElementById('legendInline');
  const readingHint = document.getElementById('readingHint');
  if(statusBar) statusBar.style.display = 'flex';
  if(legendInline) legendInline.style.display = 'none';
  if(readingHint) readingHint.style.display = 'none';

  if(useLocalKuromojiWorker){
    renderWithDictionary(raw, out, statsBar);
    if(!document.getElementById('rubyToggleBtn')?.classList.contains('is-loading')) startTokenizerProgress();
    const workerResult = await analyzeWithLocalKuromojiWorker(raw, {
      canRetry:()=>renderGeneration === LOCAL_KUROMOJI_RENDER_GENERATION
        && normalizeReadingInput(document.getElementById('inputText')?.value || '').trim() === raw
    });
    const currentRaw = normalizeReadingInput(document.getElementById('inputText')?.value || '').trim();
    if(renderGeneration !== LOCAL_KUROMOJI_RENDER_GENERATION || currentRaw !== raw) return;
    if(workerResult.ok){
      document.body.dataset.tokenizerMode = 'kuromoji-worker';
      delete document.body.dataset.tokenizerFallback;
      renderWithKuromojiWorkerResult(raw, workerResult, out, statsBar);
      finishLocalTokenizerSuccess(workerResult);
      LAST_READING_GENERATION_RESULT = {
        status:'success',
        tokenizerMode:'kuromoji-worker',
        retryCount:Number(workerResult.retryCount || 0)
      };
      saveCurrentArticleToHistory();
      return;
    }
    document.body.dataset.tokenizerFallback = 'true';
    TOKENIZER_LAST_ATTEMPT_FAILED = true;
    finishTokenizerProgress('假名生成没有完成，请点击重新生成。', 'error');
    LAST_READING_GENERATION_RESULT = {
      status:'error',
      stage:'tokenizer',
      errorCode:analyticsErrorCode(workerResult.error),
      retryCount:Number(workerResult.retryCount || 0)
    };
    emitPerformanceDebugLog();
    saveCurrentArticleToHistory();
    return;
  }

  if(useRemoteKuromoji){
    if(!KUROMOJI_TOKENIZER){
      renderWithDictionary(raw, out, statsBar);
    }
    const tokenizer = await initKuromoji();
    if(tokenizer){
      document.body.dataset.tokenizerMode = 'kuromoji';
      renderWithKuromoji(raw, tokenizer, out, statsBar);
      LAST_READING_GENERATION_RESULT = {status:'success', tokenizerMode:'kuromoji', retryCount:0};
      saveCurrentArticleToHistory();
      return;
    }
  }
  renderWithDictionary(raw, out, statsBar);
  LAST_READING_GENERATION_RESULT = {status:'success', tokenizerMode:'built-in', retryCount:0};
  saveCurrentArticleToHistory();
}

function normalizeReadingInput(text){
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n\n');
}

function segmentUnknownJapaneseText(text){
  const value = String(text || '');
  if(!value) return [];
  if(typeof Intl?.Segmenter !== 'function'){
    return [...value].map(segment => ({segment, isWordLike:/[\p{L}\p{N}]/u.test(segment)}));
  }
  const segmenter = new Intl.Segmenter('ja', {granularity:'word'});
  return [...segmenter.segment(value)].map(item=>({
    segment:item.segment,
    isWordLike:item.isWordLike !== false && /[\p{L}\p{N}]/u.test(item.segment)
  }));
}

function fallbackTokenInfo(surface){
  const override = RUBY_OVERRIDES[surface];
  const lexicalAnalysis = analyzeLexicalToken({
    surface_form:surface,
    basic_form:surface,
    reading:override && !override.hidden ? override.reading : ''
  });
  return {
    reading:lexicalAnalysis.surfaceReading,
    level:'',
    pos:'未收录词',
    meaning:'本地词库暂未收录，可以先收藏并补充读音或释义。',
    dictWord:surface,
    baseForm:surface,
    lookupWord:surface,
    lexicalAnalysis,
    source:'fallback'
  };
}

function renderWithDictionary(raw, out, statsBar){
  const words = Object.keys(DICT).sort((a,b)=>b.length-a.length);
  let segments = [{text: raw, matched:null}];

  words.forEach(word=>{
    const next = [];
    segments.forEach(seg=>{
      if(seg.matched){ next.push(seg); return; }
      const parts = seg.text.split(word);
      for(let i=0;i<parts.length;i++){
        if(parts[i]) next.push({text:parts[i], matched:null});
        if(i < parts.length-1) next.push({text:word, matched:word});
      }
    });
    segments = next;
  });

  let html = '';
  window.KUROMOJI_TOKEN_CACHE = [];
  const counts = {N5:0,N4:0,N3:0,particle:0,trap:0};
  let matchedChars = 0;
  const totalChars = raw.replace(/[\s\n。、！？「」]/g,'').length;

  segments.forEach(seg=>{
    if(seg.matched){
      const info = DICT[seg.matched];
      counts[info.level] = (counts[info.level]||0) + 1;
      matchedChars += seg.matched.length;
      const cls = info.level === 'trap' ? 'w-trap' : (info.level === 'particle' ? 'w-particle' : 'w-'+info.level.toLowerCase());
      html += renderWordNode(seg.matched, info.reading, cls, {"data-word":seg.matched}, `showDetail('${seg.matched}', this)`);
    } else {
      segmentUnknownJapaneseText(seg.text).forEach(part=>{
        if(!part.isWordLike){
          html += renderPlainTextWithFootnotes(part.segment);
          return;
        }
        const tokenId = window.KUROMOJI_TOKEN_CACHE.length;
        const info = fallbackTokenInfo(part.segment);
        window.KUROMOJI_TOKEN_CACHE[tokenId] = {
          surface:part.segment,
          info,
          token:{surface_form:part.segment, basic_form:part.segment},
          analysis:info.lexicalAnalysis
        };
        html += renderWordNode(part.segment, info.reading, 'w-kuromoji', {"data-token-id":tokenId}, `showTokenDetail(${tokenId}, this)`);
      });
    }
  });

  out.innerHTML = addParagraphTranslations(html, raw);

  const coverage = totalChars > 0 ? Math.round((matchedChars/totalChars)*100) : 0;
  if(statsBar) statsBar.innerHTML = '';
  renderReadingAnalysis({
    mode:'dictionary',
    chars:totalChars,
    coverage,
    counts,
    recognized:counts.N5 + counts.N4 + counts.N3 + counts.trap,
    totalTerms:counts.N5 + counts.N4 + counts.N3 + counts.trap + counts.particle
  });
  recordPerformanceMark('reading_ready');
}

function katakanaToHiragana(str){
  return (str || '').replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function offlineShardFor(value, count){
  let hash = 2166136261;
  const text = String(value || '');
  for(let index = 0; index < text.length; index += 1){
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

function dictionaryLookupForms(candidates){
  const values = (Array.isArray(candidates) ? candidates : [candidates])
    .map(value=>String(value || '').trim())
    .filter(Boolean);
  return [...new Set(values.flatMap(value=>[value, katakanaToHiragana(value)]).filter(Boolean))];
}

async function loadChineseDefinitionShard(index){
  const normalizedIndex = Number(index);
  if(CHINESE_DEFINITIONS_SHARD_CACHE.has(normalizedIndex)) return CHINESE_DEFINITIONS_SHARD_CACHE.get(normalizedIndex);
  const fileName = `shard-${String(normalizedIndex).padStart(2, '0')}.json`;
  const request = fetch(`${CHINESE_DEFINITIONS_BASE_URL}/${fileName}`)
    .then(response=>{
      if(!response.ok) throw new Error(`Chinese definition shard returned ${response.status}.`);
      return response.json();
    })
    .catch(error=>{
      CHINESE_DEFINITIONS_SHARD_CACHE.delete(normalizedIndex);
      throw error;
    });
  CHINESE_DEFINITIONS_SHARD_CACHE.set(normalizedIndex, request);
  return request;
}

function loadJlptReferenceIndex(){
  if(!JLPT_REFERENCE_READY){
    JLPT_REFERENCE_READY = fetch(JLPT_REFERENCE_URL)
      .then(response=>{
        if(!response.ok) throw new Error(`JLPT reference returned ${response.status}.`);
        return response.json();
      })
      .catch(error=>{
        JLPT_REFERENCE_READY = null;
        console.warn('JLPT 参考等级加载失败', error);
        return null;
      });
  }
  return JLPT_REFERENCE_READY;
}

function jmdictCommonShardFor(value){
  return offlineShardFor(value, JMDICT_COMMON_SHARD_COUNT);
}

async function loadJmdictCommonShard(index){
  const normalizedIndex = Number(index);
  if(JMDICT_COMMON_SHARD_CACHE.has(normalizedIndex)) return JMDICT_COMMON_SHARD_CACHE.get(normalizedIndex);
  const fileName = `shard-${String(normalizedIndex).padStart(2, '0')}.json`;
  const request = fetch(`${JMDICT_COMMON_BASE_URL}/${fileName}`)
    .then(response=>{
      if(!response.ok) throw new Error(`Dictionary shard returned ${response.status}.`);
      return response.json();
    })
    .catch(error=>{
      JMDICT_COMMON_SHARD_CACHE.delete(normalizedIndex);
      throw error;
    });
  JMDICT_COMMON_SHARD_CACHE.set(normalizedIndex, request);
  return request;
}

function jmdictEnglishMeaning(entry){
  const glosses = [...new Set((entry?.g || []).map(value=>String(value || '').trim()).filter(Boolean))].slice(0, 5);
  return glosses.join('；');
}

function dictionarySourceNoteHtml(){
  return `<small class="dictionary-source-note">词典来源：<a href="${JMDICT_COMMON_SOURCE_URL}" target="_blank" rel="noopener noreferrer" aria-label="JMdict，由 EDRDG 维护">JMdict</a></small>`;
}

function jmdictMeaningHtml(entry){
  const meaning = jmdictEnglishMeaning(entry);
  if(!meaning) return '';
  return `<span>英文释义：${escapeHtml(meaning)}</span>${dictionarySourceNoteHtml()}`;
}

function storedJmdictMeaningHtml(info){
  const meaning = cleanStoredMeaning(info?.meaning);
  return meaning ? `<span>英文释义：${escapeHtml(meaning)}</span>${dictionarySourceNoteHtml()}` : '';
}

function cleanStoredMeaning(meaning){
  return String(meaning || '').trim().replace(/^(?:中文释义|英文释义)：\s*/u, '');
}

function chineseMeaningHtml(info){
  const meaning = cleanStoredMeaning(info?.meaning);
  if(!meaning) return '';
  return `<span>中文释义：${escapeHtml(meaning)}</span><small class="dictionary-source-note">释义来源：Yomeru 离线中文词库</small>`;
}

function storedMeaningHtml(info){
  if(info?.meaningLanguage === 'zh' || info?.meaningSource === 'offline-chinese') return chineseMeaningHtml(info);
  if(info?.meaningLanguage === 'en' || info?.meaningSource === 'jmdict') return storedJmdictMeaningHtml(info);
  return escapeHtml(cleanStoredMeaning(info?.meaning) || '释义待补充');
}

function tokenSnapshotValue(surface, info, tokenRecord = null){
  const lexicalMetadata = lexicalVocabMetadata(surface, info, tokenRecord);
  return encodeURIComponent(JSON.stringify({
    surface,
    reading:info?.reading || '',
    meaning:info?.meaning || '',
    meaningLanguage:info?.meaningLanguage || '',
    meaningSource:info?.meaningSource || '',
    level:normalizeVisibleVocabLevel(info?.level),
    levelSource:info?.levelSource || '',
    pos:lexicalMetadata.partOfSpeech || info?.pos || '未收录词',
    ...lexicalMetadata
  })).replace(/'/g, '%27');
}

function syncTokenSaveButton(detailBox, tokenId, info){
  const saveButton = detailBox?.querySelector('.add-vocab-tool');
  if(!saveButton) return;
  saveButton.setAttribute('onclick', `requestTokenVocabSave(${tokenId})`);
  if(info?.lookupState === 'loading' && info?.pendingVocabSave){
    saveButton.disabled = true;
    saveButton.setAttribute('aria-busy', 'true');
    saveButton.setAttribute('aria-label', '释义加载完成后自动加入生词本');
    saveButton.dataset.tooltip = '释义加载完成后自动收藏';
    return;
  }
  if(info?.lookupState === 'saved'){
    saveButton.disabled = true;
    saveButton.removeAttribute('aria-busy');
    saveButton.setAttribute('aria-label', '已加入生词本');
    saveButton.dataset.tooltip = '已加入生词本';
    return;
  }
  saveButton.disabled = false;
  saveButton.removeAttribute('aria-busy');
  saveButton.setAttribute('aria-label', '加入生词本');
  saveButton.dataset.tooltip = info?.lookupState === 'loading' ? '加载完成后自动收藏' : '加入生词本';
}

function finishPendingTokenVocabSave(tokenId, tokenRecord){
  if(!tokenRecord?.info?.pendingVocabSave) return;
  tokenRecord.info.pendingVocabSave = false;
  requestTokenVocabSave(tokenId);
}

function dictionaryEntryFor(word){
  return DICT[word] || FALLBACK_DICTIONARY[word] || null;
}

function tokenSurfaceReading(token = {}){
  const surface = String(token.surface_form || '');
  const rawReading = token.reading && token.reading !== '*' ? token.reading : '';
  return rawReading
    ? katakanaToHiragana(rawReading)
    : (/^[\u3040-\u30ffー]+$/u.test(surface) ? katakanaToHiragana(surface) : '');
}

function lexicalValue(value){
  const normalized = String(value ?? '').trim();
  return normalized === '*' ? '' : normalized;
}

function normalizeLexicalAnalysis(input = {}){
  const surface = lexicalValue(input.surface);
  const lemma = lexicalValue(input.lemma) || surface;
  const surfaceReading = katakanaToHiragana(lexicalValue(input.surfaceReading));
  const lemmaReading = katakanaToHiragana(
    lexicalValue(input.lemmaReading) || (lemma === surface ? surfaceReading : '')
  );
  const partOfSpeech = lexicalValue(input.partOfSpeech);
  const partOfSpeechDetail = lexicalValue(input.partOfSpeechDetail);
  const conjugationType = lexicalValue(input.conjugationType);
  const conjugationForm = lexicalValue(input.conjugationForm);
  const grammaticalContext = [partOfSpeech, partOfSpeechDetail, conjugationType, conjugationForm]
    .filter(Boolean)
    .join('・');
  const sourceRefs = Array.isArray(input.sourceRefs)
    ? [...new Set(input.sourceRefs.map(value=>lexicalValue(value)).filter(Boolean))]
    : [];
  return {
    surface,
    surfaceReading,
    lemma,
    lemmaReading,
    partOfSpeech,
    partOfSpeechDetail,
    conjugationType,
    conjugationForm,
    isFunctionWord: input.isFunctionWord === undefined
      ? /助詞|助词|助動詞|助动词|系動詞|系动词|接続詞|接续词|連体詞|连体词/.test(grammaticalContext)
      : Boolean(input.isFunctionWord),
    isProperNoun: input.isProperNoun === undefined
      ? /固有名詞|专有名词|專有名詞/.test(grammaticalContext)
      : Boolean(input.isProperNoun),
    isCompound:Boolean(input.isCompound),
    sourceRefs
  };
}

function lexicalSourceRefs(token = {}, index = 0){
  if(Array.isArray(token.lexical_source_refs) && token.lexical_source_refs.length){
    return token.lexical_source_refs;
  }
  const paragraph = Number.isFinite(Number(token.paragraph_index)) ? Number(token.paragraph_index) : 0;
  const position = Number.isFinite(Number(token.word_position)) ? Number(token.word_position) : index;
  return [`${paragraph}:${position}`];
}

function analyzeLexicalToken(token = {}, index = 0){
  const surface = lexicalValue(token.surface_form || token.surface);
  const lemma = lexicalValue(token.basic_form || token.lemma) || surface;
  const exactInfo = dictionaryEntryFor(surface);
  const lemmaInfo = dictionaryEntryFor(lemma);
  const rawReading = tokenSurfaceReading(token);
  return normalizeLexicalAnalysis({
    surface,
    surfaceReading:rawReading || lexicalValue(exactInfo?.reading),
    lemma,
    lemmaReading:lexicalValue(lemmaInfo?.reading) || (lemma === surface ? rawReading : ''),
    partOfSpeech:token.pos,
    partOfSpeechDetail:token.pos_detail_1 || token.posDetail,
    conjugationType:token.conjugated_type || token.conjugatedType,
    conjugationForm:token.conjugated_form || token.conjugatedForm,
    isCompound:token.is_compound,
    sourceRefs:lexicalSourceRefs(token, index)
  });
}


function isProperNounInfo(info = {}){
  return Boolean(info.lexicalAnalysis?.isProperNoun)
    || /固有名詞|专有名词|專有名詞/.test(String(info.pos || ''));
}

function isAuxiliaryMasuToken(token = {}){
  const surface = String(token.surface_form || '');
  const part = [token.pos, token.pos_detail_1, token.conjugated_type, token.conjugated_form]
    .filter(value=>value && value !== '*')
    .join('・');
  return surface === 'ます' && /助動詞|助动词/.test(part) && /マス|ます|礼貌/.test(part);
}

function shouldMergePoliteVerbTokens(parts){
  if(parts.length !== 2 || !isAuxiliaryMasuToken(parts[1])) return false;
  return /動詞|动词/.test(String(parts[0]?.pos || ''));
}

const CONTEXTUAL_READING_OPEN_SUBJECTS = new Set(['ドア', '戸', '扉', '店', '窓', '幕', '口', '穴', '門']);
const CONTEXTUAL_READING_MARKETPLACE_CONTEXTS = new Set(['朝', '魚', '青果', '卸売', '築地', '豊洲']);

function resolveContextualTokenReadings(rawTokens){
  const tokens = (Array.isArray(rawTokens) ? rawTokens : []).map(token=>({...token}));
  const surfaceAt = index=>String(tokens[index]?.surface_form || '');
  const setReading = (index, reading, rule)=>{
    if(index < 0 || index >= tokens.length) return;
    tokens[index].reading = reading;
    tokens[index].contextual_reading_rule = rule;
  };

  for(let index = 0; index < tokens.length; index += 1){
    const surface = surfaceAt(index);
    const previous = surfaceAt(index - 1);
    const previousTwo = surfaceAt(index - 2);
    const next = surfaceAt(index + 1);
    const nextTwo = surfaceAt(index + 2);

    if(surface === '七' && next === '時') setReading(index, 'シチ', 'counter-hour-seven');
    if(surface === '七時') setReading(index, 'シチジ', 'counter-hour-seven');

    if(surface === '開く' && previous === 'が' && CONTEXTUAL_READING_OPEN_SUBJECTS.has(previousTwo)){
      setReading(index, 'アク', 'intransitive-opening-subject');
    }

    if(surface === '生' && next === 'と' && nextTwo === '死') setReading(index, 'セイ', 'life-death-contrast');
    if(surface === '一日' && /月$/u.test(previous || previousTwo)) setReading(index, 'ツイタチ', 'calendar-first-day');
    if(surface === '一' && next === '日' && /月$/u.test(previous || previousTwo)){
      setReading(index, 'ツイ', 'calendar-first-day');
      setReading(index + 1, 'タチ', 'calendar-first-day');
    }

    if(surface === '人気' && ((next === 'の' && nextTwo === 'ない') || (next === 'が' && nextTwo === 'ない'))){
      setReading(index, 'ヒトケ', 'absence-of-people');
    }

    if(surface === '市場' && previous === 'の' && CONTEXTUAL_READING_MARKETPLACE_CONTEXTS.has(previousTwo)){
      setReading(index, 'イチバ', 'physical-marketplace-context');
    }

    if(surface === '今日中') setReading(index, 'キョウジュウ', 'within-today-compound');
    if(surface === '中' && previous === '今日') setReading(index, 'ジュウ', 'within-today-compound');
    if(surface === '避難所') setReading(index, 'ヒナンジョ', 'evacuation-shelter-compound');
    if(surface === '所' && previous === '避難') setReading(index, 'ジョ', 'evacuation-shelter-compound');
  }
  return tokens;
}

function mergeLexicalTokens(rawTokens){
  const tokens = resolveContextualTokenReadings(rawTokens).map((token, index)=>({
    ...token,
    is_compound:Boolean(token?.is_compound),
    lexical_source_refs:lexicalSourceRefs(token, index)
  }));
  const merged = [];
  for(let i = 0; i < tokens.length; i += 1){
    let compound = null;
    for(const size of [4, 3, 2]){
      if(i + size > tokens.length) continue;
      const parts = tokens.slice(i, i + size);
      if(parts.some(token => !token.surface_form || /^\s+$/.test(token.surface_form))) continue;
      const surface = parts.map(token => token.surface_form).join('');
      const exactEntry = dictionaryEntryFor(surface);
      if(exactEntry || shouldMergePoliteVerbTokens(parts)){
        const contextualReading = parts.some(token=>token.contextual_reading_rule)
          ? parts.map(token=>lexicalValue(token.reading) || token.surface_form).join('')
          : '';
        compound = {
          ...parts[0],
          surface_form:surface,
          basic_form:lexicalValue(parts[0].basic_form) || surface,
          reading:contextualReading
            || lexicalValue(exactEntry?.reading)
            || parts.map(token=>lexicalValue(token.reading) || token.surface_form).join(''),
          is_compound:true,
          lexical_source_refs:[...new Set(parts.flatMap(token=>token.lexical_source_refs || []))]
        };
        i += size - 1;
        break;
      }
    }
    merged.push(compound || tokens[i]);
  }
  return merged;
}

function mergeDictionaryCompounds(rawTokens){
  return mergeLexicalTokens(rawTokens);
}

function getTokenInfo(token){
  const lexicalAnalysis = analyzeLexicalToken(token);
  const surface = lexicalAnalysis.surface;
  const base = lexicalAnalysis.lemma;
  const tokenPos = [lexicalAnalysis.partOfSpeech, lexicalAnalysis.partOfSpeechDetail]
    .filter(Boolean)
    .join('・') || '已识别词';
  if(isAuxiliaryMasuToken(token)){
    return {
      reading:lexicalAnalysis.surfaceReading || 'ます',
      level:'',
      levelSource:'',
      pos:'助动词',
      meaning:'礼貌助动词，用于构成动词的礼貌表达',
      meaningLanguage:'',
      meaningSource:'',
      dictWord:surface,
      baseForm:base,
      lookupWord:surface,
      lexicalAnalysis,
      source:'grammar-function'
    };
  }
  const surfaceEntry = dictionaryEntryFor(surface);
  const dictInfo = surfaceEntry || dictionaryEntryFor(base);
  if(dictInfo){
    const dictWord = surfaceEntry ? surface : base;
    return {
      ...dictInfo,
      reading:lexicalAnalysis.surfaceReading || dictInfo.reading,
      level:dictInfo.level,
      levelSource:dictInfo.levelSource || (dictInfo.level ? 'jlpt-reference' : ''),
      pos:dictInfo.pos || tokenPos,
      dictWord,
      baseForm:base,
      lookupWord:dictWord,
      lexicalAnalysis,
      source:'DICT'
    };
  }
  return {
    reading:lexicalAnalysis.surfaceReading,
    level:'',
    pos:tokenPos,
    meaning:'暂无释义，可稍后补充。',
    dictWord:surface,
    baseForm:base,
    lookupWord:base,
    lexicalAnalysis,
    source:'kuromoji'
  };
}

function renderWithKuromoji(raw, tokenizer, out, statsBar){
  const rawTokens = tokenizer.tokenize(raw);
  const tokens = mergeDictionaryCompounds(rawTokens);
  renderWithKuromojiTokens(raw, tokens, out, statsBar, 'kuromoji');
}

function renderWithKuromojiWorkerResult(raw, result, out, statsBar){
  const paragraphTokens = [];
  const appTokens = Array.isArray(result?.appTokens) ? result.appTokens : [];
  const paragraphCount = Array.isArray(result?.paragraphs) ? result.paragraphs.length : 0;
  for(let paragraphIndex = 0; paragraphIndex < paragraphCount; paragraphIndex += 1){
    const tokens = appTokens.filter(token=>Number(token.paragraph_index) === paragraphIndex);
    paragraphTokens.push(...mergeDictionaryCompounds(tokens));
    if(paragraphIndex < paragraphCount - 1){
      paragraphTokens.push({surface_form:'\n\n', basic_form:'\n\n', paragraph_index:paragraphIndex});
    }
  }
  renderWithKuromojiTokens(raw, paragraphTokens, out, statsBar, 'kuromoji-worker');
}

function renderWithKuromojiTokens(raw, tokens, out, statsBar, mode = 'kuromoji'){
  resetReadingDetailPanel();
  window.KUROMOJI_TOKEN_CACHE = [];
  const counts = {N5:0,N4:0,N3:0,particle:0,trap:0,kuromoji:0};
  let dictChars = 0;
  let tokenChars = 0;
  const html = tokens.map((token, i)=>{
    const surface = token.surface_form;
    if(/^\d{1,2}$/.test(surface) && footnoteForId(surface)) return renderFootnoteRef(surface);
    if(/^\s+$/.test(surface)) return escapeHtml(surface);
    if(/^[。、！？「」『』（）\(\)、,.!?]+$/.test(surface)) return escapeHtml(surface);

    const info = getTokenInfo(token);
    const analysisBucket = internalTokenAnalysisBucket(info);
    counts[analysisBucket] = (counts[analysisBucket] || 0) + 1;
    tokenChars += surface.length;
    if(info.source === 'DICT') dictChars += surface.length;

    const cls = info.level === 'trap'
      ? 'w-trap'
      : info.level === 'particle'
        ? 'w-particle'
        : info.source === 'kuromoji' || info.source === 'fallback'
          ? 'w-kuromoji'
          : 'w-' + (normalizeVisibleVocabLevel(info.level) || 'ungraded').toLowerCase();
    window.KUROMOJI_TOKEN_CACHE[i] = { surface, info, token, analysis:info.lexicalAnalysis };
    return renderWordNode(surface, info.reading, cls, {"data-token-id":i}, `showTokenDetail(${i}, this)`);
  }).join('');

  out.innerHTML = addParagraphTranslations(html, raw);
  const coverage = tokenChars > 0 ? Math.round((dictChars/tokenChars)*100) : 0;
  if(statsBar) statsBar.innerHTML = '';
  renderReadingAnalysis({
    mode,
    chars:tokenChars,
    coverage,
    counts,
    recognized:counts.N5 + counts.N4 + counts.N3 + counts.trap + counts.kuromoji,
    totalTerms:tokens.length
  });
  recordPerformanceMark('reading_ready');
}

function estimateReadingLevel(summary){
  const counts = summary?.counts || {};
  const chars = Number(summary?.chars || 0);
  const hardTerms = Number(counts.N3 || 0) + Number(counts.trap || 0) + Math.round(Number(counts.kuromoji || 0) * 0.35);
  const studyTerms = Number(summary?.recognized || 0);
  const density = chars ? Math.round((studyTerms / chars) * 100) : 0;
  const hardRatio = studyTerms ? hardTerms / studyTerms : 0;
  let score = 0;
  if(chars > 700) score += 1;
  if(chars > 1400) score += 1;
  if(density > 8) score += 1;
  if(density > 14) score += 1;
  if(hardRatio > 0.24) score += 1;
  if(hardRatio > 0.42) score += 1;
  if(Number(counts.trap || 0) >= 3) score += 1;
  if(Number(counts.kuromoji || 0) >= 18) score += 1;
  if(score <= 1) return {level:'N5', tone:'easy', label:'入门短文'};
  if(score <= 3) return {level:'N4', tone:'easy', label:'基础阅读'};
  if(score <= 5) return {level:'N3', tone:'fit', label:'适合精读'};
  if(score <= 7) return {level:'N2', tone:'hard', label:'偏难材料'};
  return {level:'N1', tone:'hard', label:'高阶材料'};
}

function readingActionAdvice(summary, level){
  const counts = summary?.counts || {};
  const hardTerms = Number(counts.N3 || 0) + Number(counts.trap || 0);
  if(level.level === 'N1') return '建议分段阅读，先抓主旨，再处理长句和抽象词。';
  if(level.level === 'N2') return '适合慢读：先点开难词，再用这篇文章做一次理解练习。';
  if(level.level === 'N3') return '适合精读，读完后可以做复述或整理重点句型。';
  if(hardTerms >= 3) return '这篇有几个容易误解的词，读完后建议整理生词。';
  return '难度比较顺，适合快速阅读后做一次基础练习。';
}

let LAST_READING_ANALYSIS = null;
let READING_DIFFICULTY_TIMER = null;

function setReadingDifficultyButtonState(state, levelLabel = ''){
  const button = document.getElementById('readingAnalysisButton');
  if(!button) return;
  button.dataset.analysisState = state || 'idle';
  button.dataset.analysisLevel = levelLabel || '';
  button.classList.toggle('is-active', state === 'ready');
  button.classList.toggle('is-loading', state === 'loading');
  button.setAttribute('aria-busy', String(state === 'loading'));
  if(state === 'loading'){
    button.textContent = '分析中…';
    button.dataset.tooltip = '正在判断文章难度';
    button.setAttribute('aria-label', '正在判断文章难度');
  }else if(state === 'ready' && levelLabel){
    button.textContent = levelLabel;
    button.dataset.tooltip = `文章难度：${levelLabel}`;
    button.setAttribute('aria-label', `文章难度：${levelLabel}`);
  }else if(state === 'error'){
    button.textContent = '点击分析';
    button.dataset.tooltip = '重新判断文章难度';
    button.setAttribute('aria-label', '重新判断文章难度');
  }else{
    button.textContent = '难度';
    button.dataset.tooltip = '文章难度';
    button.setAttribute('aria-label', '文章难度');
  }
}

function scheduleReadingDifficultyAnalysis(summary, delay = 180){
  LAST_READING_ANALYSIS = summary || null;
  clearTimeout(READING_DIFFICULTY_TIMER);
  if(!summary){
    setReadingDifficultyButtonState('idle');
    return;
  }
  setReadingDifficultyButtonState('loading');
  READING_DIFFICULTY_TIMER = setTimeout(()=>{
    try{
      const level = estimateReadingLevel(summary);
      setReadingDifficultyButtonState('ready', `${level.level}水平`);
    }catch(error){
      console.warn('难度分析失败', error);
      setReadingDifficultyButtonState('error');
    }
  }, delay);
}

function renderReadingAnalysis(summary){
  const card = document.getElementById('readingAnalysisCard');
  const button = document.getElementById('readingAnalysisButton');
  if(!summary){
    LAST_READING_ANALYSIS = null;
    clearTimeout(READING_DIFFICULTY_TIMER);
    if(card){
      card.style.display = 'none';
      card.innerHTML = '';
    }
    setReadingDifficultyButtonState('idle');
    return;
  }
  if(card){
    card.style.display = 'none';
    card.innerHTML = '';
  }
  if(button) scheduleReadingDifficultyAnalysis(summary);
}

function collectRubyUnits(){
  const out = document.getElementById('output');
  const units = [];
  function visit(node){
    if(node.nodeType === Node.TEXT_NODE){
      [...node.textContent].forEach(ch=>units.push({base:ch, ruby:''}));
      return;
    }
    if(node.nodeType !== Node.ELEMENT_NODE) return;
    if(node.tagName.toLowerCase() === 'br'){
      units.push({base:'\n', ruby:''});
      return;
    }
    if(['div','p'].includes(node.tagName.toLowerCase()) && units.length && units[units.length - 1].base !== '\n'){
      units.push({base:'\n', ruby:''});
    }
    if(node.matches('ruby.w')){
      const rt = node.querySelector('rt');
      const ruby = rt ? rt.textContent : (node.dataset.reading || '');
      const base = [...node.childNodes]
        .filter(child=>!(child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'rt'))
        .map(child=>child.textContent)
        .join('');
      units.push({base, ruby:shouldShowRuby(base, ruby) ? ruby : ''});
      return;
    }
    node.childNodes.forEach(visit);
  }
  const readingRoots = [...out.querySelectorAll('.reading-translation-pair .reading-japanese')];
  const contentRoots = readingRoots.length ? readingRoots : [out];
  contentRoots.forEach((root, index)=>{
    if(index && units.length && units[units.length - 1].base !== '\n'){
      units.push({base:'\n', ruby:''});
    }
    root.childNodes.forEach(visit);
  });

  const normalized = [];
  units.filter(unit=>unit.base).forEach(unit=>{
    if(unit.base === '\n'){
      while(normalized.length && /^[ \t]+$/.test(normalized[normalized.length - 1].base)) normalized.pop();
      if(normalized.length && normalized[normalized.length - 1].base !== '\n') normalized.push(unit);
      return;
    }
    if((!normalized.length || normalized[normalized.length - 1].base === '\n') && /^[ \t]+$/.test(unit.base)) return;
    normalized.push(unit);
  });
  while(normalized.length && normalized[normalized.length - 1].base === '\n') normalized.pop();
  return normalized;
}

async function collectExportRubyUnits(){
  const fallback = collectRubyUnits();
  const raw = String(CURRENT_ARTICLE_TEXT || '').trim();
  if(!raw || !ENABLE_REMOTE_SMART_SEGMENTATION) return fallback;
  try{
    const tokenizer = await initKuromoji();
    if(!tokenizer) return fallback;
    const units = [];
    mergeDictionaryCompounds(tokenizer.tokenize(raw)).forEach(token=>{
      const surface = token.surface_form || '';
      if(!surface) return;
      if(/^\s+$/.test(surface)){
        [...surface].forEach(ch=>units.push({base:ch === '\n' ? '\n' : ch, ruby:''}));
        return;
      }
      const info = getTokenInfo(token);
      const override = RUBY_OVERRIDES[surface];
      const reading = override
        ? (override.hidden ? '' : override.reading)
        : (shouldShowRuby(surface, info.reading) ? info.reading : '');
      units.push({base:surface, ruby:reading || ''});
    });
    return units.length ? units : fallback;
  }catch(error){
    console.warn('导出时未能补全假名，使用页面现有标注。', error);
    return fallback;
  }
}

function toggleAnnotationEditMode(){
  if(IS_ANNOTATION_EDITING){
    finishAnnotationEditMode();
  } else {
    startAnnotationEditMode();
  }
}

function startAnnotationEditMode(){
  const out = document.getElementById('output');
  if(!out || !out.querySelector('ruby.w')) return;
  cancelPendingRubyEdit();
  ANNOTATION_EDIT_SNAPSHOT = collectRubyUnits();
  IS_ANNOTATION_EDITING = true;
  trackAnalyticsEvent('furigana_edit_start');
  out.classList.add('editing');
  out.setAttribute('contenteditable', 'true');
  out.setAttribute('spellcheck', 'false');
  out.addEventListener('keydown', handleAnnotationEditKeydown);
  const button = document.getElementById('annotationEditBtn');
  if(button){
    button.textContent = '完成';
    button.classList.add('is-editing');
    button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', '完成假名编辑');
    button.dataset.tooltip = '完成假名编辑';
  }
  out.focus();
}

async function finishAnnotationEditMode(){
  const out = document.getElementById('output');
  IS_ANNOTATION_EDITING = false;
  const button = document.getElementById('annotationEditBtn');
  if(button){
    button.textContent = '编辑';
    button.classList.remove('is-editing');
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', '编辑假名');
    button.dataset.tooltip = '编辑假名';
  }
  cancelPendingRubyEdit();
  document.querySelectorAll('#output ruby.w.active, #output ruby.w.is-just-selected, #output ruby.w[aria-current="true"]').forEach(node=>{
    node.classList.remove('active', 'is-just-selected');
    node.removeAttribute('aria-current');
  });
  if(!out){
    ANNOTATION_EDIT_SNAPSHOT = [];
    return;
  }
  out.classList.remove('editing');
  out.removeAttribute('contenteditable');
  out.removeAttribute('spellcheck');
  out.removeEventListener('keydown', handleAnnotationEditKeydown);
  const units = collectRubyUnits()
    .map(unit=>unit.base === '\n' ? unit : {base:unit.base.trim(), ruby:(unit.ruby || '').trim()})
    .filter(unit=>unit.base);
  let overridesChanged = false;
  units.forEach((unit, index)=>{
    if(unit.base === '\n') return;
    const previous = ANNOTATION_EDIT_SNAPSHOT[index];
    if(previous && previous.base === unit.base && (previous.ruby || '') !== (unit.ruby || '')){
      RUBY_OVERRIDES[unit.base] = unit.ruby
        ? {reading:unit.ruby, hidden:false}
        : {reading:'', hidden:true};
      overridesChanged = true;
    }
  });
  if(overridesChanged) safeStorage.setItem('reading_ruby_overrides', JSON.stringify(RUBY_OVERRIDES));
  ANNOTATION_EDIT_SNAPSHOT = [];
  CURRENT_ARTICLE_TEXT = units.map(unit=>unit.base).join('');
  const sourceInput = document.getElementById('inputText');
  if(sourceInput) sourceInput.value = CURRENT_ARTICLE_TEXT;
  try{
    await renderText();
    trackAnalyticsEvent('furigana_edit_save', {success:true});
  }catch(error){
    trackAnalyticsEvent('furigana_edit_save', {success:false});
    throw error;
  }
}

function handleAnnotationEditKeydown(event){
  if(!IS_ANNOTATION_EDITING) return;
  if(event.key === 'Enter'){
    event.preventDefault();
    document.execCommand('insertLineBreak');
    return;
  }
  if(event.key === 'Backspace' || event.key === 'Delete'){
    const selection = window.getSelection();
    if(selection && selection.rangeCount && !selection.getRangeAt(0).collapsed) return;
    event.preventDefault();
    document.execCommand(event.key === 'Backspace' ? 'delete' : 'forwardDelete');
  }
}

function renderEditedOutput(units){
  const out = document.getElementById('output');
  if(!out) return;
  let html = '';
  units.forEach((unit, index)=>{
    if(unit.base === '\n'){
      html += '<br>';
      return;
    }
    html += renderRubyUnitNode(unit, index);
  });
  out.innerHTML = html || '<span style="color:var(--ink-soft);font-size:14.5px;">内容已清空。</span>';
}

function openExportModal(){
  const modal = document.getElementById('exportModal');
  if(!modal) return;
  EXPORT_MODAL_TRIGGER = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  syncExportOptions();
  trackAnalyticsEvent('export_open', {format:selectedExportFormat(), layout:selectedExportLayout()});
  setDialogVisibility(modal, true, document.getElementById('exportLayoutSelect'));
}

function closeExportModal(){
  setDialogVisibility(document.getElementById('exportModal'), false);
  if(EXPORT_MODAL_TRIGGER?.isConnected) EXPORT_MODAL_TRIGGER.focus();
  EXPORT_MODAL_TRIGGER = null;
}

function selectedExportFormat(){
  return document.getElementById('exportFormatSelect')?.value || 'pptx';
}

function selectedExportLayout(){
  return document.getElementById('exportLayoutSelect')?.value || 'landscape';
}

const EXPORT_PRESETS = {
  landscape: { baseFont:22, rubyFont:10, rubyGap:0.04, lineHeight:0.40, maxCells:35 },
  portrait: { baseFont:22, rubyFont:10, rubyGap:0.04, lineHeight:0.40, maxCells:22 }
};
let lastExportLayout = null;

function applyExportPreset(layout){
  const preset = EXPORT_PRESETS[layout];
  if(!preset) return;
  document.getElementById('pptBaseFont').value = preset.baseFont;
  document.getElementById('pptRubyFont').value = preset.rubyFont;
  document.getElementById('pptRubyGap').value = preset.rubyGap.toFixed(2);
  document.getElementById('pptLineHeight').value = preset.lineHeight.toFixed(2);
  document.getElementById('pptMaxCells').value = preset.maxCells;
}

function resetExportPreset(){
  applyExportPreset(selectedExportLayout());
}

function syncExportOptions(){
  const layout = selectedExportLayout();
  const settings = document.getElementById('pptExportSettings');
  const note = document.getElementById('exportFormatNote');
  if(!settings) return;
  settings.classList.remove('is-hidden');
  if(note){
    const format = selectedExportFormat();
    note.textContent = format === 'png' || format === 'jpeg'
      ? `${format.toUpperCase()} 适合直接保存和分享；导出后不能编辑文字。`
      : 'PPTX 中的正文和假名可以继续编辑；不同演示软件之间可能有轻微位置差异。';
  }
  if(lastExportLayout !== layout){
    applyExportPreset(layout);
    lastExportLayout = layout;
  }
}

async function runExport(){
  const format = selectedExportFormat();
  const layout = selectedExportLayout();
  const startedAt = performance.now();
  setExportBusy(true, '');
  try{
    await new Promise(resolve=>setTimeout(resolve, 30));
    if(format === 'png' || format === 'jpeg'){
      await downloadRubyImage(layout, format);
    } else {
      await downloadRubyPptx(layout);
    }
    trackAnalyticsEvent('export_complete', {
      format,
      layout,
      duration_ms:performance.now() - startedAt,
      success:true
    });
    setExportBusy(false, '');
  }catch(error){
    trackAnalyticsEvent('export_error', {format, layout, error_code:analyticsErrorCode(error)});
    setExportBusy(false, error?.message || '导出失败');
    showToast('导出失败', 'error');
  }finally{
    setTimeout(()=>setExportBusy(false, ''), 1800);
  }
}

function setExportBusy(isBusy, message){
  const status = document.getElementById('exportStatus');
  const button = document.getElementById('exportDownloadBtn');
  if(status) status.textContent = message || '';
  if(button){
    button.disabled = isBusy;
    button.textContent = isBusy ? '下载中' : '下载';
  }
}

function exportPayload(orientation = 'landscape', units = collectRubyUnits()){
  return {
    units,
    layout:orientation,
    baseFont:numberValue('pptBaseFont', 24),
    rubyFont:numberValue('pptRubyFont', 11),
    rubyGap:numberValue('pptRubyGap', 0.20),
    lineHeight:numberValue('pptLineHeight', 0.78),
    maxCells:numberValue('pptMaxCells', 34)
  };
}

async function downloadRubyImage(orientation = 'landscape', format = 'png'){
  const units = await collectExportRubyUnits();
  if(!units.length){
    throw new Error(`请先分析文本，再导出 ${format.toUpperCase()}。`);
  }
  const payload = exportPayload(orientation, units);
  await downloadClientRubyImage(payload, format);
  closeExportModal();
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 0);
}

async function downloadClientRubyImage(payload, format = 'png'){
  const isJpeg = format === 'jpeg';
  const canvases = buildRubyCanvases(payload, { paged:false, background:isJpeg ? '#fffdf8' : 'transparent' });
  const canvas = canvases[0];
  const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
  const blob = await new Promise(resolve=>canvas.toBlob(resolve, mimeType, isJpeg ? 0.92 : undefined));
  if(!blob) throw new Error('浏览器没有生成图片。');
  downloadBlob(blob, `japanese-ruby-text-${payload.layout}.${isJpeg ? 'jpeg' : 'png'}`);
}

function buildRubyCanvases(payload, options = {}){
  const width = payload.layout === 'portrait' ? 900 : 1600;
  const defaultHeight = payload.layout === 'portrait' ? 1600 : 900;
  const padX = payload.layout === 'portrait' ? 70 : 90;
  const padY = payload.layout === 'portrait' ? 82 : 72;
  const contentWidth = width - padX * 2;
  const cellPx = contentWidth / payload.maxCells;
  const basePx = Math.max(18, cellPx * (payload.baseFont / 24) * 0.92);
  const rubyPx = Math.max(9, basePx * (payload.rubyFont / payload.baseFont));
  const rubySlot = rubyPx + Math.round(payload.rubyGap * 32);
  const rowPx = Math.max(basePx + rubySlot + 10, basePx * (1.45 + payload.lineHeight * 0.5));
  const rows = buildMeasuredImageRows(payload.units, {
    fontSize:basePx,
    rubySize:rubyPx,
    availableW:contentWidth
  });
  const rowsPerPage = options.paged ? Math.max(1, Math.floor((defaultHeight - padY * 2) / rowPx)) : rows.length;
  const pages = chunkRows(rows, rowsPerPage || rows.length || 1);
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  return pages.map(pageRows=>{
    const height = options.paged ? defaultHeight : Math.max(defaultHeight, Math.ceil(padY * 2 + pageRows.length * rowPx));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if(!ctx) throw new Error('浏览器没有可用的图片绘制环境。');
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, width, height);
    if(options.background && options.background !== 'transparent'){
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.textBaseline = 'top';

    pageRows.forEach((row, rowIndex)=>{
      row.forEach(unit=>{
        const boxX = padX + unit.x;
        const boxW = unit.boxW;
        const centerX = boxX + boxW / 2;
        const y = padY + rowIndex * rowPx;
        if(unit.ruby){
          ctx.font = `${rubyPx}px "Yu Gothic","Hiragino Sans","Noto Sans JP",sans-serif`;
          ctx.fillStyle = '#6b6459';
          ctx.textAlign = 'center';
          ctx.fillText(unit.ruby, centerX, y);
        }
        ctx.font = `${basePx}px "Yu Gothic","Hiragino Sans","Noto Sans JP",sans-serif`;
        ctx.fillStyle = '#2b2a28';
        ctx.textAlign = 'center';
        ctx.fillText(unit.base, centerX, y + rubySlot);
      });
    });
    return canvas;
  });
}

function layoutRubyUnits(units, config){
  const rows = [];
  let x = config.marginX;
  let current = [];
  units.forEach(unit=>{
    const width = Math.max(
      unit.base.length * config.baseCharW,
      unit.ruby.length * config.rubyCharW,
      config.baseCharW * 0.8
    );
    if(x + width > config.maxWidth && current.length){
      rows.push(current);
      current = [];
      x = config.marginX;
    }
    current.push({...unit, x, width});
    x += width + config.gap;
  });
  if(current.length) rows.push(current);
  return rows;
}

function visualLength(str){
  return [...(str || '')].length;
}

function isLineHeadPunctuation(str){
  return /^[、。！？!?）」』】〕〉》,.;:，．；：]/.test(str || '');
}

function makeMeasureContext(fontSize){
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px "Yu Gothic","Hiragino Sans","Noto Sans JP",sans-serif`;
  return ctx;
}

function measuredTextWidth(ctx, text){
  return Math.max(ctx.measureText(text || '').width, 1);
}

function buildMeasuredImageRows(units, config){
  const baseCtx = makeMeasureContext(config.fontSize);
  const rubyCtx = makeMeasureContext(config.rubySize);
  const rows = [];
  let row = [];
  let x = 0;
  const gap = config.fontSize * 0.02;

  units.forEach(unit=>{
    if(unit.base === '\n'){
      if(row.length){
        rows.push(row);
        row = [];
        x = 0;
      }
      return;
    }
    const baseW = measuredTextWidth(baseCtx, unit.base);
    const rubyW = unit.ruby ? measuredTextWidth(rubyCtx, unit.ruby) : 0;
    const boxW = Math.max(baseW, rubyW * 0.92, config.fontSize * 0.55) + gap;
    const baseOffset = (boxW - baseW) / 2;
    const measured = { ...unit, baseW, rubyW, boxW, baseOffset };

    if(x + boxW > config.availableW && row.length && !isLineHeadPunctuation(unit.base)){
      rows.push(row);
      row = [];
      x = 0;
    }

    if(row.length === 0 && isLineHeadPunctuation(unit.base) && rows.length){
      const previous = rows[rows.length - 1];
      const previousWidth = previous.reduce((sum, item)=>sum + item.boxW, 0);
      if(previousWidth + boxW <= config.availableW + config.fontSize * 0.6){
        previous.push({ ...measured, x:previousWidth });
        return;
      }
    }

    row.push({ ...measured, x });
    x += boxW;
  });

  if(row.length) rows.push(row);
  return rows;
}

function makeImageGlyphs(units){
  const glyphs = [];
  units.forEach((unit, groupIndex)=>{
    [...unit.base].forEach(ch=>{
      glyphs.push({
        ch,
        ruby: unit.ruby || '',
        groupIndex,
        width: isLineHeadPunctuation(ch) ? 0.5 : 1
      });
    });
  });
  return glyphs;
}

function buildImageRows(units, maxCells){
  const glyphs = makeImageGlyphs(units);
  const rows = [];
  let current = [];
  let currentWidth = 0;
  for(let i = 0; i < glyphs.length; i++){
    const glyph = glyphs[i];
    const projected = currentWidth + glyph.width;
    const canKeepEndingMark = isLineHeadPunctuation(glyph.ch) && projected <= maxCells + 0.5;
    if(projected > maxCells && current.length && !canKeepEndingMark){
      rows.push(current);
      current = [];
      currentWidth = 0;
    }
    if(current.length === 0 && isLineHeadPunctuation(glyph.ch) && rows.length){
      const lastRow = rows[rows.length - 1];
      const lastWidth = lastRow.reduce((sum, item)=>sum + item.width, 0);
      if(lastWidth + glyph.width <= maxCells + 0.5){
        lastRow.push(glyph);
        continue;
      }
      if(lastRow.length > 1){
        const moved = lastRow.pop();
        rows.push([moved, glyph]);
        continue;
      }
    }
    current.push(glyph);
    currentWidth += glyph.width;
  }
  if(current.length) rows.push(current);
  return rows;
}

function buildImageRowsFromPptRows(rows){
  return rows.map(row=>{
    let cursor = 0;
    return row.map(unit=>{
      const start = cursor;
      cursor += Math.max(unit.cell || baseCellsForCursor(unit), 1);
      return { ...unit, start };
    });
  });
}

function getRowGlyphPositions(row){
  let cursor = 0;
  return row.map(glyph=>{
    const start = cursor;
    const end = cursor + glyph.width;
    cursor = end;
    return { start, end, center:(start + end) / 2 };
  });
}

function collectRowRubySegments(row, positions){
  const segments = [];
  let active = null;
  row.forEach((glyph, index)=>{
    if(!glyph.ruby){
      if(active){
        active.end = positions[index - 1]?.end ?? active.end;
        segments.push(active);
        active = null;
      }
      return;
    }
    if(active && active.groupIndex === glyph.groupIndex && active.ruby === glyph.ruby){
      active.end = positions[index].end;
      return;
    }
    if(active) segments.push(active);
    active = {
      groupIndex: glyph.groupIndex,
      ruby: glyph.ruby,
      start: positions[index].start,
      end: positions[index].end
    };
  });
  if(active) segments.push(active);
  return segments;
}

function buildVisualRows(units, maxCells){
  const rows = [];
  let current = [];
  let cells = 0;
  units.forEach(unit=>{
    const baseCells = Math.max(visualLength(unit.base), 1);
    if(cells + baseCells > maxCells && current.length && !isLineHeadPunctuation(unit.base)){
      rows.push(current);
      current = [];
      cells = 0;
    }
    current.push({...unit, cell:baseCells, baseCells, rubyCells:Math.max(visualLength(unit.ruby || ''), 1)});
    cells += baseCells;
  });
  if(current.length) rows.push(current);
  return rows;
}

function buildEditablePptRows(units, maxCells){
  const rows = [];
  let current = [];
  let cells = 0;
  units.forEach(unit=>{
    if(unit.base === '\n'){
      if(current.length) rows.push(current);
      current = [];
      cells = 0;
      return;
    }
    const baseCells = Math.max(visualLength(unit.base), 1);
    const rubyCells = Math.max(visualLength(unit.ruby || ''), 1);
    const cell = baseCells;
    if(cells + cell > maxCells && current.length && !isLineHeadPunctuation(unit.base)){
      rows.push(current);
      current = [];
      cells = 0;
    }
    current.push({...unit, cell, baseCells, rubyCells});
    cells += cell;
  });
  if(current.length) rows.push(current);
  return rows.map(row=>row.reduce((merged, unit)=>{
    const previous = merged[merged.length - 1];
    if(previous && !previous.ruby && !unit.ruby){
      previous.base += unit.base;
      previous.cell += unit.cell;
      previous.baseCells += unit.baseCells;
      return merged;
    }
    merged.push({...unit});
    return merged;
  }, []));
}

function numberValue(id, fallback){
  const value = Number(document.getElementById(id)?.value);
  return Number.isFinite(value) ? value : fallback;
}

async function downloadRubyPptx(orientation = 'landscape'){
  const units = await collectExportRubyUnits();
  if(!units.length){
    throw new Error('请先分析文本，再导出 PPTX。');
  }
  if(!window.PptxGenJS){
    await loadExternalScript(THIRD_PARTY_SCRIPTS.pptx, 'PptxGenJS');
  }

  const pptx = new window.PptxGenJS();
  const isPortrait = orientation === 'portrait';
  if(isPortrait){
    pptx.defineLayout({ name:'PORTRAIT_9_16', width:7.5, height:13.333 });
    pptx.layout = 'PORTRAIT_9_16';
  } else {
    pptx.layout = 'LAYOUT_WIDE';
  }
  pptx.author = 'Nihongo Reader';
  pptx.subject = 'Japanese ruby text';
  pptx.title = 'Japanese Ruby Text';

  const payload = exportPayload(orientation, units);
  const slideW = isPortrait ? 7.5 : 13.333;
  const slideH = isPortrait ? 13.333 : 7.5;
  const outerMarginX = isPortrait ? 0.52 : 0.68;
  const marginY = isPortrait ? 0.58 : 0.50;
  const contentW = slideW - outerMarginX * 2;
  const contentH = slideH - marginY * 2;
  const rubyH = Math.max(0.18, payload.rubyFont / 72 * 1.35);
  const baseH = Math.max(0.30, payload.baseFont / 72 * 1.45);
  const rubyGap = Math.max(0.02, payload.rubyGap);
  const lineGap = Math.max(0.05, payload.lineHeight * 0.14);
  const rowH = rubyH + rubyGap + baseH + lineGap;
  const rowsPerPage = Math.max(1, Math.floor(contentH / rowH));
  const naturalCellW = payload.baseFont / 72;
  const lineW = Math.min(contentW, naturalCellW * payload.maxCells);
  const lineX = outerMarginX;
  const cellW = lineW / payload.maxCells;
  const rows = buildEditablePptRows(payload.units, payload.maxCells);
  const pages = chunkRows(rows, rowsPerPage);

  pages.forEach((pageRows, pageIndex)=>{
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFDF8' };
    pageRows.forEach((row, rowIndex)=>{
      let cursorCell = 0;
      const y = marginY + rowIndex * rowH;
      row.forEach(unit=>{
        const unitCells = Math.max(unit.cell || 1, 1);
        const x = lineX + cursorCell * cellW;
        const baseW = Math.max(unitCells * cellW, cellW * 0.7);
        if(unit.ruby){
          const rubyNaturalW = Math.max(unit.rubyCells || 1, 1) * payload.rubyFont / 72;
          const rubyW = Math.max(baseW, rubyNaturalW);
          const rubyX = x + (baseW - rubyW) / 2;
          slide.addText(unit.ruby, {
            x:rubyX, y, w:rubyW, h:rubyH,
            fontFace:'Yu Gothic',
            fontSize:payload.rubyFont,
            color:'6B6459',
            align:'center',
            valign:'mid',
            margin:0,
            breakLine:false
          });
        }
        const baseFontFace = /[\u3400-\u4dbf\u4e00-\u9fff]/.test(unit.base) && !/[\u3040-\u30ff]/.test(unit.base)
          ? 'PingFang SC'
          : 'Yu Gothic';
        slide.addText(unit.base, {
          x, y:y + rubyH + rubyGap, w:baseW, h:baseH,
          fontFace:baseFontFace,
          fontSize:payload.baseFont,
          color:'2B2A28',
          bold:false,
          align:'center',
          valign:'mid',
          margin:0,
          breakLine:false
        });
        cursorCell += unitCells;
      });
    });
    if(pages.length > 1){
      slide.addText(`${pageIndex + 1} / ${pages.length}`, {
        x: slideW - 0.72, y: 0.22, w: 0.52, h: 0.18,
        fontFace: 'Microsoft YaHei',
        fontSize: 8,
        color: 'A49A8A',
        align: 'right',
        margin: 0
      });
    }
    slide.addNotes('可编辑版本：正文和假名均为文本对象。不同字体或演示软件可能导致轻微位置变化。');
  });

  await pptx.writeFile({ fileName: `japanese-ruby-text-editable-${isPortrait ? 'portrait' : 'landscape'}.pptx` });
}

function baseCellsForCursor(unit){
  return Math.max(unit.baseCells || visualLength(unit.base), 1);
}

function chunkRows(rows, rowsPerPage){
  const chunks = [];
  for(let i = 0; i < rows.length; i += rowsPerPage){
    chunks.push(rows.slice(i, i + rowsPerPage));
  }
  return chunks.length ? chunks : [[]];
}

function normalizeVisibleVocabLevel(value){
  const normalized = String(value || '').trim().toUpperCase();
  return /^N[1-5]$/.test(normalized) ? normalized : '';
}

function formatVisibleVocabLevel(value){
  return normalizeVisibleVocabLevel(value) || '暂无参考等级';
}

function internalTokenAnalysisBucket(info = {}){
  const jlptLevel = normalizeVisibleVocabLevel(info.level);
  if(jlptLevel) return jlptLevel;
  if(info.level === 'particle' || info.level === 'trap') return info.level;
  if(info.source === 'kuromoji' || info.source === 'fallback') return 'kuromoji';
  return 'ungraded';
}
const LEVEL_COLOR = {N5:'var(--n5)',N4:'var(--n4)',N3:'var(--n3)',particle:'var(--particle)',trap:'var(--trap)',kuromoji:'var(--km)'};
const LEVEL_BG = {N5:'var(--n5-bg)',N4:'var(--n4-bg)',N3:'var(--n3-bg)',particle:'var(--particle-bg)',trap:'var(--trap-bg)',kuromoji:'var(--km-bg)'};

const PART_LABELS_ZH = {
  n:'名词', noun:'名词', v:'动词', verb:'动词', adj:'形容词', adverb:'副词', adv:'副词',
  expression:'表达', exp:'表达', particle:'助词', prefix:'接头词', suffix:'接尾词',
  interjection:'感叹词', conjunction:'连词', pronoun:'代词', auxiliary:'助动词',
  ichidan:'一段动词', godan:'五段动词', transitive:'他动词', intransitive:'自动词'
};

const COMMON_GLOSS_ZH = {
  'to be':'是；存在', 'to do':'做', 'to go':'去', 'to come':'来', 'to see':'看见；查看',
  'to look':'看', 'to say':'说', 'to speak':'说话', 'to eat':'吃', 'to drink':'喝',
  'to read':'读', 'to write':'写', 'to listen':'听', 'to hear':'听见', 'to think':'想；认为',
  'person':'人', 'thing':'事物', 'time':'时间', 'place':'地方', 'today':'今天',
  'tomorrow':'明天', 'yesterday':'昨天', 'now':'现在', 'good':'好', 'bad':'不好；坏',
  'many':'许多', 'few':'少量', 'big':'大', 'small':'小', 'new':'新', 'old':'旧；老',
  'water':'水', 'book':'书', 'school':'学校', 'teacher':'老师', 'student':'学生',
  'friend':'朋友', 'family':'家人', 'house':'房子；家', 'work':'工作', 'money':'钱'
};

function hasCjk(text){
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(text || ''));
}

function partLabelZh(part){
  const key = String(part || '').toLowerCase().replace(/[^a-z]/g, '');
  return PART_LABELS_ZH[key] || '';
}

function glossToChinese(gloss){
  const value = String(gloss || '').trim();
  if(!value) return '';
  if(hasCjk(value)) return value;
  const normalized = value.toLowerCase().replace(/\(.+?\)/g, '').replace(/^to\s+/, 'to ').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ').trim();
  if(COMMON_GLOSS_ZH[normalized]) return COMMON_GLOSS_ZH[normalized];
  const phrase = Object.keys(COMMON_GLOSS_ZH).find(key => normalized.includes(key));
  return phrase ? COMMON_GLOSS_ZH[phrase] : '';
}

function dictionaryEntryChinese(entry){
  const parts = (entry.parts || []).map(partLabelZh).filter(Boolean);
  const meanings = (entry.meanings || []).map(glossToChinese).filter(Boolean);
  const partText = parts.length ? ` · ${escapeHtml([...new Set(parts)].join('、'))}` : '';
  const meaningText = meanings.length
    ? escapeHtml([...new Set(meanings)].slice(0, 4).join('；'))
    : '<span style="color:var(--ink-soft);">中文释义暂未收录。可以先查看读音和词性，后续补充中文词库。</span>';
  return `<b>${escapeHtml(entry.word || '')}</b> ${escapeHtml(entry.reading || '')}${partText}<br>${meaningText}`;
}

function rubyEditorHtml(){
  return '';
}

function detailReadingDisplayHtml(surface, reading){
  const override = RUBY_OVERRIDES[surface];
  const value = override && !override.hidden ? override.reading : reading;
  const encoded = encodeURIComponent(surface);
  return `<div class="detail-reading-control" id="detailReadingControl">
    <span class="detail-reading-text" id="detailReadingText">${escapeHtml(value || '暂无读音')}</span>
    <button class="detail-reading-edit" type="button" onclick="beginRubyEdit('${encoded}')" data-tooltip="修改读音" aria-label="修改 ${escapeHtml(surface)} 的读音">${editIconSvg()}</button>
  </div>`;
}

function beginRubyEdit(encoded){
  const control = document.getElementById('detailReadingControl');
  if(!control) return;
  const surface = decodeURIComponent(encoded);
  trackAnalyticsEvent('furigana_edit_start');
  const current = document.getElementById('detailReadingText')?.textContent.trim() || '';
  const value = current === '暂无读音' ? '' : current;
  control.dataset.previousReading = value;
  control.dataset.editSurface = surface;
  control.classList.add('is-editing');
  control.innerHTML = `
    <input id="rubyEditInput" type="text" value="${escapeHtml(value)}" placeholder="输入平假名" aria-label="读音" onkeydown="handleRubyEditKeydown(event, '${encoded}')">
    <button class="detail-reading-action save-ruby-tool" type="button" onclick="saveRubyOverride('${encoded}')" data-tooltip="保存修改" aria-label="保存修改">${saveIconSvg()}</button>
    <button class="detail-reading-action cancel-ruby-tool" type="button" onclick="cancelRubyEdit('${encoded}')" data-tooltip="取消修改" aria-label="取消修改">${cancelIconSvg()}</button>
  `;
  const input = document.getElementById('rubyEditInput');
  input?.focus();
  input?.select();
}

function saveRubyOverride(encoded){
  const surface = decodeURIComponent(encoded);
  const reading = document.getElementById('rubyEditInput')?.value.trim();
  if(!reading){
    trackAnalyticsEvent('furigana_edit_save', {success:false});
    return;
  }
  RUBY_OVERRIDES[surface] = {reading, hidden:false};
  const saved = safeStorage.setItem('reading_ruby_overrides', JSON.stringify(RUBY_OVERRIDES));
  trackAnalyticsEvent('furigana_edit_save', {success:saved});
  renderText();
  const control = document.getElementById('detailReadingControl');
  if(control) control.outerHTML = detailReadingDisplayHtml(surface, reading);
  showToast('读音已保存', 'success');
}

function cancelRubyEdit(encoded){
  cancelPendingRubyEdit(decodeURIComponent(encoded), true);
}

function cancelPendingRubyEdit(fallbackSurface = '', restoreFocus = false){
  const control = document.getElementById('detailReadingControl');
  if(!control) return;
  const surface = control.dataset.editSurface || fallbackSurface;
  if(!surface){
    control.classList.remove('is-editing');
    control.querySelector('#rubyEditInput')?.remove();
    return;
  }
  control.outerHTML = detailReadingDisplayHtml(surface, control.dataset.previousReading || '');
  if(restoreFocus) document.querySelector('.detail-reading-edit')?.focus();
}

function handleRubyEditKeydown(event, encoded){
  if(event.key === 'Enter'){
    event.preventDefault();
    saveRubyOverride(encoded);
  }else if(event.key === 'Escape'){
    event.preventDefault();
    event.stopPropagation();
    cancelRubyEdit(encoded);
  }
}

function hideRubyOverride(encoded){
  const surface = decodeURIComponent(encoded);
  RUBY_OVERRIDES[surface] = {reading:'', hidden:true};
  safeStorage.setItem('reading_ruby_overrides', JSON.stringify(RUBY_OVERRIDES));
  renderText();
}

function resetRubyOverride(encoded){
  delete RUBY_OVERRIDES[decodeURIComponent(encoded)];
  safeStorage.setItem('reading_ruby_overrides', JSON.stringify(RUBY_OVERRIDES));
  renderText();
}

async function lookupDictionary(encoded, tokenId = ''){
  const word = decodeURIComponent(encoded);
  const target = document.getElementById('dictionaryLookupResult');
  if(DICT[word]){
    const info = DICT[word];
    target.innerHTML = `<b>${escapeHtml(info.reading)}</b> · ${escapeHtml(info.pos)}<br>${escapeHtml(info.meaning)}`;
    return;
  }
  target.textContent = '本地词库暂未收录这个词，可以先收藏后补充释义。';
}

function speakerIconSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"></path><path d="M16 8.2a5.5 5.5 0 0 1 0 7.6M18.8 5.5a9 9 0 0 1 0 13"></path></svg>';
}

function addVocabIconSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12v17l-6-3.8-6 3.8v-17Z"></path><path d="M12 7v6M9 10h6"></path></svg>';
}

function addGrammarIconSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"></path><path d="M8 8h8M8 12h5M8 16h7"></path><path d="M17 13v6M14 16h6"></path></svg>';
}

function editIconSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 17 9.8-9.8 3 3L7 20H4v-3Z"></path><path d="m15.5 5.5 1.7-1.7a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-1.7 1.7"></path></svg>';
}

function saveIconSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5V4Z"></path><path d="M8 4v6h8V4"></path><path d="M8 17h8"></path></svg>';
}

function cancelIconSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>';
}

function hideRubyIconSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.2-5.5 9-5.5S21 12 21 12s-3.2 5.5-9 5.5S3 12 3 12Z"></path><path d="M4 4l16 16"></path></svg>';
}

function detailIconActions(addAction, speakAction, actionType = 'vocab'){
  const saveButton = !addAction || actionType === 'none' ? '' : actionType === 'grammar'
    ? `<button class="reader-tool detail-icon-button add-grammar-tool" type="button" onclick="${addAction}" data-tooltip="加入语法本" aria-label="加入语法本">${addGrammarIconSvg()}</button>`
    : `<button class="reader-tool detail-icon-button add-vocab-tool" type="button" onclick="${addAction}" data-tooltip="加入生词本" aria-label="加入生词本">${addVocabIconSvg()}</button>`;
  return `
    <div class="detail-icon-actions">
      <button class="reader-tool reader-speech-tool detail-icon-button" type="button" onclick="${speakAction}" data-tooltip="朗读" aria-label="朗读">${speakerIconSvg()}</button>
      ${saveButton}
    </div>
  `;
}

function selectReadingWord(el){
  document.querySelectorAll('.w.active').forEach(n=>n.classList.remove('active', 'is-just-selected'));
  if(!el) return;
  el.classList.add('active', 'is-just-selected');
  el.setAttribute('aria-current', 'true');
  document.querySelectorAll('.w[aria-current="true"]').forEach(node=>{
    if(node !== el) node.removeAttribute('aria-current');
  });
  clearTimeout(el._readingSelectTimer);
  el._readingSelectTimer = setTimeout(()=>el.classList.remove('is-just-selected'), 260);
}

function detailWordHeaderHtml(surface, addAction, speakAction, actionType = 'vocab'){
  return `<div class="detail-word-header">
    <div class="detail-word">${escapeHtml(surface)}</div>
    ${detailIconActions(addAction, speakAction, actionType)}
  </div>`;
}

const READING_GRAMMAR_POINT_MAP = {
  'は':'は と が の違い',
  'が':'は と が の違い',
  'ば':'ば形(假定条件)',
  'のに':'のに(轻微不满的转折)',
  'ている':'ている(进行/状态)',
  'なければならない':'なければならない(义务/必须)',
  'ようだ':'ようだ・みたい(推量/比喻)',
  'みたい':'ようだ・みたい(推量/比喻)'
};

function grammarPointForReadingUnit(surface){
  const title = READING_GRAMMAR_POINT_MAP[String(surface || '').trim()];
  return title ? GRAMMAR_POINTS.find(point => point.title === title) || null : null;
}

function isGrammarReadingUnit(info = {}){
  return Boolean(info.lexicalAnalysis?.isFunctionWord)
    || info.level === 'particle'
    || /助词|助詞|助动词|助動詞/.test(String(info.pos || ''));
}

function readingDetailAction(surface, info = {}){
  const point = grammarPointForReadingUnit(surface);
  if(point){
    return {
      type:'grammar',
      action:`saveGrammarPoint('${encodeURIComponent(point.title)}', event)`,
      point
    };
  }
  if(isGrammarReadingUnit(info)) return {type:'none', action:'', point:null};
  return {type:'vocab', action:null, point:null};
}

function detailBadgesHtml(level, part){
  const badges = [];
  badges.push(`<span class="detail-badge detail-badge-level">JLPT 参考等级：${escapeHtml(formatVisibleVocabLevel(level))}</span>`);
  if(part) badges.push(`<span class="detail-badge">${escapeHtml(part)}</span>`);
  return badges.length ? `<div class="detail-badges">${badges.join('')}</div>` : '';
}

function detailDefinitionHtml(meaning, id = ''){
  const idAttr = id ? ` id="${escapeHtml(id)}"` : '';
  return `<div class="detail-definition"><span>释义</span><div class="detail-meaning"${idAttr}>${meaning}</div></div>`;
}

function defaultDetailExampleHtml(){
  const word = '食べる';
  const reading = 'たべる';
  const meaning = '吃';
  return `
    <div class="detail-box detail-example-box">
      <div class="detail-example-kicker">示例详解</div>
      <p class="detail-example-note">点击正文中的词语后，这里会显示真实详解。</p>
      ${detailWordHeaderHtml(word, `addCustomToVocab('${word}', '${reading}', '${meaning}', 'N5', '动词')`, `speakEncodedJapanese('${encodeURIComponent(word)}', this, false)`)}
      ${detailMetaHtml(word, reading, 'N5', '动词')}
      ${detailDefinitionHtml(escapeHtml(meaning))}
    </div>
  `;
}

function setDetailHeadActions(html = ''){
  const target = document.getElementById('detailHeadActions');
  if(target) target.innerHTML = html;
}

let DETAIL_REQUEST_GENERATION = 0;

async function showDetail(word, el){
  if(IS_ANNOTATION_EDITING) return;
  const generation = ++DETAIL_REQUEST_GENERATION;
  selectReadingWord(el);

  const info = DICT[word];
  if(!info) return;
  await enrichInfoWithJlpt(buildCuratedLexicalLookupPlan(word, info), info);
  if(generation !== DETAIL_REQUEST_GENERATION) return;
  const detailAction = readingDetailAction(word, info);
  const addAction = detailAction.action || (detailAction.type === 'vocab' ? `addToVocab('${word}')` : '');
  const area = document.getElementById('detailArea');
  setReadingDetailVisible(true);
  setDetailHeadActions();
  area.innerHTML = `
    <div class="detail-box detail-selected-box">
      ${detailWordHeaderHtml(word, addAction, `speakEncodedJapanese('${encodeURIComponent(word)}', this, false)`, detailAction.type)}
      ${detailMetaHtml(word, info.reading, info.level, info.pos)}
      ${detailDefinitionHtml(detailAction.point ? escapeHtml(detailAction.point.explain) : storedMeaningHtml(info))}
    </div>
  `;
  renderSampleFlow();
}

function showTokenDetail(tokenId, el){
  if(IS_ANNOTATION_EDITING) return;
  DETAIL_REQUEST_GENERATION += 1;
  selectReadingWord(el);

  const token = window.KUROMOJI_TOKEN_CACHE[tokenId];
  if(!token) return;
  const { surface, info } = token;
  const detailAction = readingDetailAction(surface, info);
  const needsLookup = info.source === 'kuromoji' || info.source === 'fallback';
  if(needsLookup) info.lookupState = 'loading';
  const addAction = detailAction.action || (detailAction.type === 'vocab' ? `requestTokenVocabSave(${tokenId})` : '');
  const area = document.getElementById('detailArea');
  setReadingDetailVisible(true);
  setDetailHeadActions();
  area.innerHTML = `
    <div class="detail-box detail-selected-box">
      ${detailWordHeaderHtml(surface, addAction, `speakEncodedJapanese('${encodeURIComponent(surface)}', this, false)`, detailAction.type)}
      ${detailMetaHtml(surface, info.reading, info.level, info.pos, token)}
      ${detailDefinitionHtml(
        detailAction.point
          ? escapeHtml(detailAction.point.explain)
          : needsLookup
            ? '正在查询词典……'
            : storedMeaningHtml(info),
        `tokenMeaning-${tokenId}`
      )}
    </div>
  `;
  syncTokenSaveButton(area.querySelector('.detail-box'), tokenId, info);
  renderSampleFlow();
  if(needsLookup && !detailAction.point) autoLookupTokenMeaning(surface, tokenId, token);
}

function showFootnoteDetail(id){
  const note = footnoteForId(id);
  if(!note) return;
  const area = document.getElementById('detailArea');
  setReadingDetailVisible(true);
  setDetailHeadActions(detailIconActions(`addEncodedTextToVocab('${encodeURIComponent(note.text || '')}', '文本脚注')`, `speakEncodedJapanese('${encodeURIComponent(note.text || '')}', this, false)`));
  area.innerHTML = `
    <div class="detail-box">
      <div class="detail-word">注 ${escapeHtml(String(note.id))}</div>
      <div class="detail-reading">第 ${escapeHtml(String(note.page || ''))} 页脚注</div>
      <div class="detail-meaning">${escapeHtml(note.text || '')}</div>
    </div>
  `;
}

let currentSelectionText = '';
let readingSelectionTimer = 0;

function handleReadingSelection(event){
  if(IS_ANNOTATION_EDITING) return;
  const output = document.getElementById('output');
  const tools = document.getElementById('selectionTools');
  if(!output || !tools) return;
  clearTimeout(readingSelectionTimer);
  const wait = event?.type === 'touchend' || event?.type === 'selectionchange' ? 180 : 0;
  readingSelectionTimer = setTimeout(()=>{
    const selection = window.getSelection();
    const text = plainSelectedText();
    if(!text || text.length > 220 || !selection.rangeCount || !output.contains(selection.anchorNode)){
      if(event?.type !== 'selectionchange') hideSelectionTools();
      return;
    }
    currentSelectionText = text;
    showSelectedTextDetail(text);
    if(window.matchMedia('(max-width: 720px)').matches){
      const selectedLabel = document.getElementById('selectionText');
      const result = document.getElementById('selectionResult');
      if(selectedLabel) selectedLabel.textContent = text;
      if(result) result.textContent = '可以查询、收藏、保存为语法或朗读这段文字。';
      tools.classList.add('active');
    }else{
      hideSelectionTools();
    }
  }, wait);
}

function hideSelectionTools(){
  document.getElementById('selectionTools')?.classList.remove('active');
}

async function lookupSelectedText(){
  const text = currentSelectionText || plainSelectedText();
  const target = document.getElementById('selectionResult');
  if(!text || !target) return;
  target.textContent = '正在查询……';
  const local = DICT[text];
  if(local){
    target.innerHTML = `<b>${escapeHtml(local.reading)}</b> · ${escapeHtml(local.pos)}<br>${escapeHtml(local.meaning)}`;
    return;
  }
  const summary = summarizeSelectedJapanese(text);
  target.innerHTML = buildChineseSentenceAnalysis(text, summary);
}

function showSelectedTextDetail(text){
  const area = document.getElementById('detailArea');
  if(!area) return;
  setReadingDetailVisible(true);
  const local = DICT[text];
  const analysis = local
    ? `<b>${escapeHtml(local.reading)}</b> · ${escapeHtml(local.pos)}<br>${escapeHtml(local.meaning)}`
    : buildChineseSentenceAnalysis(text, summarizeSelectedJapanese(text));
  setDetailHeadActions(detailIconActions('saveSelectedTextToVocab()', 'speakSelectedText(this, false)'));
  area.innerHTML = `
    <div class="detail-box">
      <div class="detail-meaning selected-detail-text">${escapeHtml(text)}</div>
      <div class="detail-meaning">${analysis}</div>
      <button class="btn-secondary btn--small" type="button" onclick="saveSelectedTextAsGrammar()">保存为语法</button>
    </div>
  `;
}

function summarizeSelectedJapanese(text){
  const hits = Object.entries(DICT)
    .filter(([word])=>text.includes(word))
    .slice(0, 5)
    .map(([word, info])=>`${word}: ${info.meaning}`);
  return hits.length ? hits.join('；') : '';
}

function buildChineseSentenceAnalysis(text, summary){
  const parts = [];
  if(summary){
    parts.push(`<b>关键词释义</b><br>${escapeHtml(summary)}`);
  }
  parts.push('当前显示本地词库中的关键词释义。可以继续点击正文中的词语查看详细释义。');
  return parts.join('<br><br>');
}

function saveSelectedTextToVocab(){
  const text = currentSelectionText || plainSelectedText();
  if(!text) return;
  const local = DICT[text];
  addCustomToVocab(text, local?.reading || '', local?.meaning || '用户选中的词语或句子');
  document.getElementById('selectionResult').textContent = '已加入生词本。';
}

function saveSelectedTextAsGrammar(){
  const text = (currentSelectionText || plainSelectedText() || '').trim();
  if(!text){
    showToast('先在阅读正文里选中一个句子或语法片段。', 'warning');
    return;
  }
  upsertGrammarBookItem({
    title:text.length > 28 ? `${text.slice(0, 28)}...` : text,
    level:'待整理',
    sub:'阅读中保存',
    note:text,
    examples:[{ jp:text, cn:'' }],
    source:'阅读选中',
    savedAt:Date.now()
  });
  const result = document.getElementById('selectionResult');
  if(result) result.textContent = '已保存到语法本。';
  showToast('已保存到语法本。', 'success');
}

function addEncodedTextToVocab(encoded, meaning = '用户添加'){
  addCustomToVocab(decodeURIComponent(encoded || ''), '', meaning);
}

function speakSelectedText(trigger, showControls = true){
  const text = currentSelectionText || plainSelectedText();
  speakJapanese(text, trigger, showControls);
}

let CURRENT_TTS_TRIGGER = null;
let CURRENT_TTS_UTTERANCE = null;
let CURRENT_TTS_QUEUE = [];
let CURRENT_TTS_INDEX = 0;
let CURRENT_TTS_SESSION = 0;
let CURRENT_TTS_STARTED = false;
let CURRENT_TTS_DEFAULT_RETRY = false;
let CURRENT_TTS_START_TIMER = 0;
const DEFAULT_TTS_RATE = 0.94;

function isIOSWebKit(){
  const userAgent = String(navigator.userAgent || '');
  return /iPad|iPhone|iPod/i.test(userAgent)
    || (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
}

function normalizeJapaneseSpeechText(text){
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/([。！？!?])\s*\n+/g, '$1 ')
    .replace(/\n+/g, '。')
    .replace(/([。！？!?])(?=[^\s])/g, '$1 ')
    .replace(/丁寧/g, 'ていねい')
    .trim();
}

function splitJapaneseSpeechChunks(text, maxChars = isIOSWebKit() ? 90 : 180){
  const normalized = normalizeJapaneseSpeechText(text);
  if(!normalized) return [];
  const sentences = normalized.match(/[^。！？!?]+[。！？!?]?/g) || [normalized];
  const chunks = [];
  let current = '';
  const pushLong = value => {
    let remaining = value.trim();
    while(remaining.length > maxChars){
      let cut = remaining.lastIndexOf('、', maxChars);
      if(cut < Math.floor(maxChars * 0.45)) cut = maxChars;
      chunks.push(remaining.slice(0, cut + (remaining[cut] === '、' ? 1 : 0)).trim());
      remaining = remaining.slice(cut + (remaining[cut] === '、' ? 1 : 0)).trim();
    }
    if(remaining) current = remaining;
  };
  sentences.forEach(sentence=>{
    const value = sentence.trim();
    if(!value) return;
    if(value.length > maxChars){
      if(current){ chunks.push(current); current = ''; }
      pushLong(value);
      return;
    }
    if(current && current.length + value.length > maxChars){
      chunks.push(current);
      current = value;
      return;
    }
    current += value;
  });
  if(current) chunks.push(current);
  return chunks.filter(Boolean);
}

function getPreferredTtsRate(){
  const saved = Number(safeStorage.getItem('reading_tts_rate'));
  return Number.isFinite(saved) && saved >= 0.6 && saved <= 1 ? saved : DEFAULT_TTS_RATE;
}

function setPreferredTtsRate(value){
  const rate = Number(value);
  const normalized = Number.isFinite(rate) && rate >= 0.6 && rate <= 1 ? rate : DEFAULT_TTS_RATE;
  safeStorage.setItem('reading_tts_rate', String(normalized));
  const select = document.getElementById('ttsRateSelect');
  if(select) select.value = String(normalized);
  window.syncTtsRateMenu?.();
  stopTts();
  showToast('日语朗读速度已更新。', 'success');
}

function initTtsSettings(){
  const select = document.getElementById('ttsRateSelect');
  if(select){
    const saved = Number(safeStorage.getItem('reading_tts_rate'));
    select.value = String(Number.isFinite(saved) && saved >= 0.6 && saved <= 1 ? saved : DEFAULT_TTS_RATE);
    window.syncTtsRateMenu?.();
  }
}

function clearTtsStartTimer(){
  clearTimeout(CURRENT_TTS_START_TIMER);
  CURRENT_TTS_START_TIMER = 0;
}

function updateTtsControlStatus(message){
  const status = document.getElementById('ttsControlStatus');
  if(status) status.textContent = message;
}

function speakCurrentTtsChunk(session, useDefaultVoice = false){
  if(session !== CURRENT_TTS_SESSION) return;
  if(CURRENT_TTS_INDEX >= CURRENT_TTS_QUEUE.length){
    finishTts();
    return;
  }
  const value = CURRENT_TTS_QUEUE[CURRENT_TTS_INDEX];
  const utterance = new SpeechSynthesisUtterance(value);
  CURRENT_TTS_UTTERANCE = utterance;
  CURRENT_TTS_STARTED = false;
  utterance.lang = 'ja-JP';
  utterance.rate = getPreferredTtsRate();
  utterance.pitch = 0.98;
  const jaVoice = useDefaultVoice ? null : chooseJapaneseVoice();
  if(jaVoice) utterance.voice = jaVoice;
  utterance.onstart = ()=>{
    if(session !== CURRENT_TTS_SESSION) return;
    CURRENT_TTS_STARTED = true;
    clearTtsStartTimer();
    setTtsActive(CURRENT_TTS_TRIGGER);
    updateTtsControlStatus(CURRENT_TTS_QUEUE.length > 1
      ? `正在朗读 ${CURRENT_TTS_INDEX + 1} / ${CURRENT_TTS_QUEUE.length}`
      : '正在朗读');
  };
  utterance.onend = ()=>{
    if(session !== CURRENT_TTS_SESSION) return;
    clearTtsStartTimer();
    CURRENT_TTS_INDEX += 1;
    CURRENT_TTS_DEFAULT_RETRY = false;
    CURRENT_TTS_UTTERANCE = null;
    setTimeout(()=>speakCurrentTtsChunk(session, false), isIOSWebKit() ? 50 : 0);
  };
  utterance.onerror = event=>{
    if(session !== CURRENT_TTS_SESSION) return;
    clearTtsStartTimer();
    const reason = String(event?.error || 'unknown');
    if(!CURRENT_TTS_DEFAULT_RETRY && utterance.voice && !/canceled|interrupted/i.test(reason)){
      CURRENT_TTS_DEFAULT_RETRY = true;
      utterance.onerror = null;
      utterance.onend = null;
      window.speechSynthesis.cancel();
      CURRENT_TTS_UTTERANCE = null;
      setTimeout(()=>speakCurrentTtsChunk(session, true), 80);
      return;
    }
    console.warn('日语朗读失败', reason);
    showToast('朗读没有成功，请检查手机音量后再试。', 'warning');
    finishTts();
  };
  updateTtsControlStatus('正在准备朗读…');
  window.speechSynthesis.speak(utterance);
  clearTtsStartTimer();
  CURRENT_TTS_START_TIMER = setTimeout(()=>{
    if(session !== CURRENT_TTS_SESSION || CURRENT_TTS_STARTED) return;
    if(!CURRENT_TTS_DEFAULT_RETRY && utterance.voice){
      CURRENT_TTS_DEFAULT_RETRY = true;
      utterance.onerror = null;
      utterance.onend = null;
      window.speechSynthesis.cancel();
      CURRENT_TTS_UTTERANCE = null;
      setTimeout(()=>speakCurrentTtsChunk(session, true), 80);
      return;
    }
    showToast('朗读启动较慢，请再点一次朗读按钮。', 'warning');
    finishTts();
  }, 3000);
}

function speakJapanese(text, trigger = null, showControls = true){
  const value = normalizeJapaneseSpeechText(text);
  if(!value) return;
  if(!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance !== 'function'){
    showToast('当前浏览器不支持发音功能。', 'warning');
    return;
  }
  if(CURRENT_TTS_UTTERANCE || window.speechSynthesis.speaking || window.speechSynthesis.paused){
    if(showControls){
      showTtsControlMenu(CURRENT_TTS_TRIGGER || trigger);
      return;
    }
    stopTts();
  }
  CURRENT_TTS_SESSION += 1;
  CURRENT_TTS_TRIGGER = trigger || null;
  CURRENT_TTS_QUEUE = splitJapaneseSpeechChunks(value);
  CURRENT_TTS_INDEX = 0;
  CURRENT_TTS_DEFAULT_RETRY = false;
  if(!CURRENT_TTS_QUEUE.length) return;
  if(CURRENT_TTS_TRIGGER){
    CURRENT_TTS_TRIGGER.classList.add('is-speaking');
    CURRENT_TTS_TRIGGER.setAttribute('aria-busy', 'true');
    CURRENT_TTS_TRIGGER.setAttribute('aria-pressed', 'true');
  }
  if(isIOSWebKit()) showToast('正在准备日语朗读…', 'info');
  speakCurrentTtsChunk(CURRENT_TTS_SESSION, false);
}

function speakEncodedJapanese(encoded, trigger, showControls = true){
  speakJapanese(decodeURIComponent(encoded || ''), trigger, showControls);
}

function setTtsActive(trigger){
  document.querySelectorAll('.reader-speech-tool.is-speaking, .reader-speech-tool.is-paused').forEach(button=>{
    if(button !== trigger) button.classList.remove('is-speaking', 'is-paused');
  });
  CURRENT_TTS_TRIGGER = trigger || CURRENT_TTS_TRIGGER || null;
  CURRENT_TTS_TRIGGER?.classList.add('is-speaking');
  CURRENT_TTS_TRIGGER?.classList.remove('is-paused');
  CURRENT_TTS_TRIGGER?.removeAttribute('aria-busy');
  CURRENT_TTS_TRIGGER?.setAttribute('aria-pressed', 'true');
  const pauseBtn = document.getElementById('ttsPauseBtn');
  if(pauseBtn) pauseBtn.textContent = '暂停';
}

function showTtsControlMenu(trigger){
  const menu = document.getElementById('ttsControlMenu');
  if(!menu) return;
  menu.classList.add('active');
  const status = document.getElementById('ttsControlStatus');
  if(status) status.textContent = window.speechSynthesis?.paused ? '朗读已暂停' : '正在朗读';
  if(!trigger) return;
  requestAnimationFrame(()=>{
    const rect = trigger.getBoundingClientRect();
    const menuWidth = menu.offsetWidth || 190;
    const left = Math.min(window.innerWidth - menuWidth - 12, Math.max(12, rect.left + rect.width / 2 - menuWidth / 2));
    const top = Math.min(window.innerHeight - (menu.offsetHeight || 52) - 12, rect.bottom + 10);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  });
}

function hideTtsControlMenu(){
  document.getElementById('ttsControlMenu')?.classList.remove('active');
}

function finishTts(){
  clearTtsStartTimer();
  document.querySelectorAll('.reader-speech-tool.is-speaking, .reader-speech-tool.is-paused').forEach(button=>{
    button.classList.remove('is-speaking', 'is-paused');
    button.removeAttribute('aria-pressed');
    button.removeAttribute('aria-busy');
  });
  CURRENT_TTS_TRIGGER = null;
  CURRENT_TTS_UTTERANCE = null;
  CURRENT_TTS_QUEUE = [];
  CURRENT_TTS_INDEX = 0;
  CURRENT_TTS_STARTED = false;
  CURRENT_TTS_DEFAULT_RETRY = false;
  hideTtsControlMenu();
}

function toggleTtsPause(){
  if(!('speechSynthesis' in window)) return;
  const pauseBtn = document.getElementById('ttsPauseBtn');
  if(window.speechSynthesis.speaking && !window.speechSynthesis.paused){
    window.speechSynthesis.pause();
    if(pauseBtn) pauseBtn.textContent = '继续';
    CURRENT_TTS_TRIGGER?.classList.remove('is-speaking');
    CURRENT_TTS_TRIGGER?.classList.add('is-paused');
    const status = document.getElementById('ttsControlStatus');
    if(status) status.textContent = '朗读已暂停';
  } else if(window.speechSynthesis.paused){
    window.speechSynthesis.resume();
    if(pauseBtn) pauseBtn.textContent = '暂停';
    CURRENT_TTS_TRIGGER?.classList.remove('is-paused');
    CURRENT_TTS_TRIGGER?.classList.add('is-speaking');
    const status = document.getElementById('ttsControlStatus');
    if(status) status.textContent = '正在朗读';
  }
}

function stopTts(){
  CURRENT_TTS_SESSION += 1;
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  finishTts();
}

const RECOMMENDED_VOICE_PATTERN = /(AndrewMultilingual|Premium|Enhanced|Siri|Natural|Neural|Hattori|Kyoko|O-?ren|Otoya|Nanami|Nozomi|Haruka|Ichiro)/i;
const EXCLUDED_VOICE_PATTERN = /(Compact|Novelty|Shelley|Sandy|Rocko|Reed|Grandpa|Grandma|Flo|Eddy|Bad News|Bells|Boing|Bubbles|Cellos|Good News|Organ|Trinoids|Whisper|Zarvox)/i;

function japaneseVoiceScore(voice){
  let score = 0;
  if(/^ja[-_]/i.test(voice.lang)) score += 260;
  if(/AndrewMultilingual/i.test(voice.name)) score += 60;
  if(voice.localService) score += 40;
  if(/Kyoko/i.test(voice.name)) score += 140;
  if(/(Otoya|Siri|Nanami|Nozomi|Haruka|Ichiro)/i.test(voice.name)) score += 125;
  if(/(Premium|Enhanced|Natural|Neural)/i.test(voice.name)) score += 110;
  if(/Hattori/i.test(voice.name)) score += 35;
  if(/O-?ren/i.test(voice.name)) score += 20;
  if(/(Google|Microsoft|Apple)/i.test(voice.name)) score += 8;
  if(EXCLUDED_VOICE_PATTERN.test(voice.name)) score -= 200;
  return score;
}

function uniqueSpeechVoices(voices = []){
  const unique = new Map();
  for(const voice of voices){
    const name = String(voice?.name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const lang = String(voice?.lang || '').trim().replace(/_/g, '-').toLocaleLowerCase();
    const uri = String(voice?.voiceURI || '').trim().toLocaleLowerCase();
    const key = name ? `name:${name}|lang:${lang}` : `uri:${uri}|lang:${lang}`;
    if(!unique.has(key) || japaneseVoiceScore(voice) > japaneseVoiceScore(unique.get(key))){
      unique.set(key, voice);
    }
  }
  return [...unique.values()];
}

function sortedJapaneseVoices(strictJapanese = isIOSWebKit()){
  if(!('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  const japanese = voices.filter(voice=>/^ja[-_]/i.test(voice.lang));
  const multilingual = strictJapanese ? [] : voices.filter(voice=>/AndrewMultilingual/i.test(voice.name) && !japanese.includes(voice));
  const candidates = uniqueSpeechVoices([...japanese, ...multilingual]);
  const natural = candidates.filter(voice=>!EXCLUDED_VOICE_PATTERN.test(voice.name));
  return (natural.length ? natural : candidates).sort((a, b)=>japaneseVoiceScore(b) - japaneseVoiceScore(a) || a.name.localeCompare(b.name));
}

function populateVoiceOptions(){
  if(!('speechSynthesis' in window)) return;
  const allVoices = sortedJapaneseVoices(isIOSWebKit());
  const field = document.getElementById('ttsVoiceField');
  const select = document.getElementById('ttsVoiceSelect');
  if(!select || !allVoices.length){ if(field) field.style.display = 'none'; return; }
  const recommended = allVoices.slice(0, Math.min(3, allVoices.length));
  const recommendedNames = new Set(recommended.map(voice=>voice.name));
  const others = allVoices.slice(recommended.length);
  const andrew = allVoices.find(voice=>/AndrewMultilingual/i.test(voice.name));
  const hattori = allVoices.find(voice=>/Hattori/i.test(voice.name));
  let preferred = safeStorage.getItem('reading_tts_voice') || '';
  if(safeStorage.getItem('reading_tts_voice_quality_version') !== '5'){
    const japanesePreferred = allVoices.find(voice=>/^ja[-_]/i.test(voice.lang));
    if(!preferred && (japanesePreferred || hattori || andrew)) preferred = (japanesePreferred || hattori || andrew).name;
    safeStorage.setItem('reading_tts_voice_quality_version', '5');
  }
  const optionHtml = v => `<option value="${escapeHtml(v.name)}" ${v.name===preferred?'selected':''}>${escapeHtml(v.name)}${recommendedNames.has(v.name)?' · 推荐':''}</option>`;
  select.innerHTML = (recommended.length ? recommended.map(optionHtml).join('') : '')
    + (recommended.length && others.length ? '<option disabled>──────</option>' : '')
    + others.map(optionHtml).join('');
  if(field) field.style.display = 'flex';
  if(!allVoices.some(voice=>voice.name === preferred)){
    const best = andrew || hattori || recommended[0] || allVoices[0];
    if(best){ select.value = best.name; safeStorage.setItem('reading_tts_voice', best.name); }
  }
  window.syncTtsVoiceMenu?.();
}

function setPreferredVoice(name, notify = true){
  safeStorage.setItem('reading_tts_voice', name || '');
  stopTts();
  if(notify) showToast('日语朗读音色已更新。', 'success');
}

function previewJapaneseVoice(){
  stopTts();
  const rate = getPreferredTtsRate();
  const rateCategory = rate <= 0.7 ? 'slow' : rate <= 0.82 ? 'learning' : rate <= 0.92 ? 'original' : 'natural';
  trackAnalyticsEvent('tts_preview', {
    rate_category:rateCategory,
    voice_source:safeStorage.getItem('reading_tts_voice') ? 'selected' : 'system'
  });
  speakJapanese('今日は天気がいいですね。ゆっくり日本語を練習しましょう。', null, false);
}

function chooseJapaneseVoice(){
  const japanese = sortedJapaneseVoices(isIOSWebKit());
  if(!japanese.length) return null;
  const preferred = safeStorage.getItem('reading_tts_voice');
  if(preferred){
    const match = japanese.find(voice=>voice.name === preferred);
    if(match) return match;
  }
  return japanese.find(voice=>/^ja[-_]/i.test(voice.lang) && /(?:Kyoko|Otoya|Siri|Nanami|Nozomi|Haruka|Ichiro|Hattori)/i.test(voice.name))
    || japanese.find(voice=>/^ja[-_]/i.test(voice.lang))
    || japanese[0];
}

function renderTypingPractice(){
  if(!TYPING_PROMPTS.length){
    const meta = document.getElementById('typingMeta');
    if(meta) meta.innerHTML = '<span class="typing-chip">题库暂不可用</span>';
    const promptCn = document.getElementById('typingPromptCn');
    if(promptCn) promptCn.textContent = '暂时没有可练习的打字题，请刷新页面后再试。';
    return;
  }
  const prompt = TYPING_PROMPTS[currentTypingIndex] || TYPING_PROMPTS[0];
  const meta = document.getElementById('typingMeta');
  if(!meta) return;
  meta.innerHTML = `<span class="typing-chip">${prompt.level}</span><span class="typing-chip">${escapeHtml(prompt.grammar)}</span><span class="typing-chip">${currentTypingIndex + 1} / ${TYPING_PROMPTS.length}</span>`;
  document.getElementById('typingPromptCn').textContent = prompt.cn;
  document.getElementById('typingAnswerPreview').textContent = `提示: ${prompt.hint}`;
  document.getElementById('typingInput').value = '';
  document.getElementById('typingResult').innerHTML = '';
  renderTypingList();
}

function renderTypingList(){
  const list = document.getElementById('typingList');
  if(!list) return;
  list.innerHTML = TYPING_PROMPTS.map((prompt, index)=>`
    <button class="typing-item ${index === currentTypingIndex ? 'active' : ''}" onclick="selectTypingPrompt(${index})">
      <b>${escapeHtml(prompt.cn)}</b>
      <span>${escapeHtml(prompt.level)} · ${escapeHtml(prompt.grammar)}</span>
    </button>
  `).join('');
}

function selectTypingPrompt(index){
  if(!TYPING_PROMPTS.length) return;
  currentTypingIndex = Math.max(0, Math.min(TYPING_PROMPTS.length - 1, Number(index) || 0));
  renderTypingPractice();
}

function prevTypingPrompt(){
  if(!TYPING_PROMPTS.length){
    showToast('打字题库暂时不可用，请刷新页面后再试。', 'warning');
    return;
  }
  currentTypingIndex = (currentTypingIndex - 1 + TYPING_PROMPTS.length) % TYPING_PROMPTS.length;
  renderTypingPractice();
}

function nextTypingPrompt(){
  if(!TYPING_PROMPTS.length){
    showToast('打字题库暂时不可用，请刷新页面后再试。', 'warning');
    return;
  }
  currentTypingIndex = (currentTypingIndex + 1) % TYPING_PROMPTS.length;
  renderTypingPractice();
}

function normalizeTypingText(text){
  return String(text || '').replace(/\s+/g, '').replace(/[，、]/g, '、').replace(/[。．.]+$/g, '。').trim();
}

function checkTypingAnswer(){
  const prompt = TYPING_PROMPTS[currentTypingIndex];
  if(!prompt){
    showToast('打字题库暂时不可用，请刷新页面后再试。', 'warning');
    return;
  }
  const input = document.getElementById('typingInput').value;
  const expected = normalizeTypingText(prompt.ja);
  const actual = normalizeTypingText(input);
  const result = compareTypingText(actual, expected);
  const score = expected.length ? Math.round((result.correct / expected.length) * 100) : 0;
  document.getElementById('typingResult').innerHTML = `
    <div class="typing-score">正确率 ${score}%</div>
    <div class="typing-diff">${result.html}</div>
    <div class="typing-answer">参考答案: ${escapeHtml(prompt.ja)}</div>
  `;
  recordPracticeResult('typing', { score });
  const reviewKey = `typing:${prompt.ja}`;
  if(score < 100){
    addPracticeReviewItem({
      key:reviewKey,
      type:'typing',
      title:prompt.grammar || '句型打字',
      prompt:prompt.cn || '',
      answer:prompt.ja || '',
      note:`最近正确率 ${score}%`,
      target:currentTypingIndex
    });
  } else {
    resolvePracticeReview(reviewKey);
  }
}

function compareTypingText(actual, expected){
  let correct = 0;
  let html = '';
  const max = Math.max(actual.length, expected.length);
  for(let i = 0; i < max; i += 1){
    const a = actual[i] || '';
    const e = expected[i] || '';
    if(a && e && a === e){
      correct += 1;
      html += `<span class="diff-ok">${escapeHtml(a)}</span>`;
    } else if(a && e){
      html += `<span class="diff-miss">${escapeHtml(e)}</span><span class="diff-extra">${escapeHtml(a)}</span>`;
    } else if(e){
      html += `<span class="diff-miss">${escapeHtml(e)}</span>`;
    } else if(a){
      html += `<span class="diff-extra">${escapeHtml(a)}</span>`;
    }
  }
  return { correct, html };
}

function showTypingAnswer(){
  const prompt = TYPING_PROMPTS[currentTypingIndex];
  if(!prompt){
    showToast('打字题库暂时不可用，请刷新页面后再试。', 'warning');
    return;
  }
  document.getElementById('typingInput').value = prompt.ja;
  checkTypingAnswer();
}

function clearTypingResult(){
  const result = document.getElementById('typingResult');
  if(result) result.innerHTML = '';
}

function speakCurrentTypingAnswer(){
  const prompt = TYPING_PROMPTS[currentTypingIndex];
  if(!prompt){
    showToast('打字题库暂时不可用，请刷新页面后再试。', 'warning');
    return;
  }
  speakJapanese(prompt?.ja || '');
}

// ---------------- 理解：选择题自测 ----------------
function articlePracticeKey(text){
  return String(text || '').replace(/\s+/g, '').slice(0, 220);
}

function resetArticlePracticeState(nextKey = articlePracticeKey(CURRENT_ARTICLE_TEXT)){
  CURRENT_ARTICLE_PRACTICE_KEY = nextKey;
  READING_QUIZ_ITEMS = [];
  READING_QUIZ_CURRENT_INDEX = 0;
  READING_QUIZ_ATTEMPT_RECORDED = false;
  READING_QUIZ_HAS_RESULT = false;
  const output = document.getElementById('clozeOutput');
  if(output) output.innerHTML = '';
  const score = document.getElementById('clozeScore');
  if(score) score.textContent = '';
  const retellResult = document.getElementById('retellResult');
  if(retellResult) retellResult.innerHTML = '';
  setRetellActivityState('idle');
  setRetellSourceDisplay(false);
}

function refreshRetellAdvice(){
  const hasText = !!CURRENT_ARTICLE_TEXT.trim();
  const retellLock = document.getElementById('articleModuleLock');
  const retellSource = document.getElementById('retellSourceText');
  if(retellLock){
    retellLock.textContent = hasText ? '已解锁' : '需要先完成阅读';
    retellLock.classList.toggle('unlocked', hasText);
  }
  if(retellSource){
    setRetellSourceDisplay(false);
  }
  refreshPracticeStatus();
}

function setRetellActivityState(state = 'idle'){
  const card = document.querySelector('.retell-practice-card');
  if(!card) return;
  card.dataset.retellState = state;
}

function setRetellSourceDisplay(full = false){
  const retellSource = document.getElementById('retellSourceText');
  if(!retellSource) return;
  const text = CURRENT_ARTICLE_TEXT.trim();
  if(!text){
    retellSource.textContent = '私は毎朝七時に起きます……';
    return;
  }
  retellSource.textContent = full ? text : shortenPracticeText(text, 52);
}

function refreshPracticeStatus(){
  const hasText = !!CURRENT_ARTICLE_TEXT.trim();
  const startArticle = document.getElementById('startQuizPracticeBtn');
  const source = document.getElementById('readingQuizSource');
  const articleLock = document.getElementById('articleModuleLock');

  if(startArticle){
    startArticle.textContent = '选择题';
  }
  if(articleLock){
    articleLock.textContent = hasText ? '已解锁' : '需要先完成阅读';
    articleLock.classList.toggle('unlocked', hasText);
  }
  if(source){
    source.innerHTML = hasText
      ? `<span>当前关联文章：${escapeHtml(currentArticlePracticeTitle())}</span><small>共 ${CURRENT_ARTICLE_TEXT.trim().length} 字</small><button type="button" onclick="switchWorkspace('reading')">更换文章</button>`
      : '';
  }
  updateReadingQuizFlowState();
  renderPracticeModuleVisibility();
}

function focusPracticeModule(type){
  if(type === 'article') type = 'quiz';
  if(type === 'vocab'){
    switchWorkspace('vocab');
    return;
  }
  ACTIVE_PRACTICE_MODULE = ['quiz', 'retell', 'typing'].includes(type) ? type : 'quiz';
  if(ACTIVE_PRACTICE_MODULE === 'quiz') articlePracticeMode = 'cloze';
  if(ACTIVE_PRACTICE_MODULE === 'retell') articlePracticeMode = 'retell';
  switchWorkspace('retell');
  renderPracticeModuleVisibility();
  document.querySelector('.retell-section')?.scrollIntoView({ behavior:'smooth', block:'start' });
}

function currentArticlePracticeTitle(){
  const title = currentVocabSourceTitle();
  if(title) return title;
  const text = CURRENT_ARTICLE_TEXT.trim().replace(/\s+/g, '');
  return text ? `${text.slice(0, 18)}${text.length > 18 ? '…' : ''}` : '未选择文章';
}

function updateReadingQuizFlowState(){
  const hasText = !!CURRENT_ARTICLE_TEXT.trim();
  const start = document.getElementById('readingQuizStart');
  const output = document.getElementById('clozeOutput');
  const score = document.getElementById('clozeScore');
  const hasQuiz = READING_QUIZ_ITEMS.length > 0;
  document.querySelector('.reading-quiz-panel')?.classList.toggle('has-quiz', hasQuiz);
  if(start){
    const icon = `
      <svg class="empty-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 6h11"></path>
        <path d="M9 12h11"></path>
        <path d="M9 18h11"></path>
        <path d="M4 6l1 1 2-2"></path>
        <path d="M4 12l1 1 2-2"></path>
        <path d="M4 18l1 1 2-2"></path>
      </svg>`;
    start.innerHTML = hasText
      ? `
        ${icon}
        <button class="btn-primary" type="button" onclick="generateReadingQuiz()">生成选择题</button>
      `
      : `
        ${icon}
        <button class="btn-secondary btn-disabled" type="button" onclick="switchWorkspace('reading')">需要先完成阅读</button>
      `;
  }
  start?.classList.toggle('is-hidden', hasQuiz);
  output?.classList.toggle('is-hidden', !hasQuiz);
  if(!hasText){
    if(output) output.innerHTML = '<span class="quiz-empty-message">先读一篇文章。这里会根据刚读过的内容生成选择题。</span>';
    if(score) score.textContent = '';
    return;
  }
  if(!hasQuiz){
    if(output) output.innerHTML = '';
    if(score) score.textContent = '';
  }
}

function renderPracticeModuleVisibility(){
  const articleModule = document.getElementById('articlePracticeModule');
  const typingModule = document.getElementById('typingPracticeModule');
  if(articleModule) articleModule.classList.toggle('is-active', ['quiz', 'retell'].includes(ACTIVE_PRACTICE_MODULE));
  if(typingModule) typingModule.classList.toggle('is-active', ACTIVE_PRACTICE_MODULE === 'typing');
  updatePracticeHeaderForActiveModule();
  document.querySelectorAll('.practice-mode-tab').forEach(button=>{
    const isSelected = button.id === `${articlePracticeMode}ModeTab`;
    button.classList.toggle('active', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
  document.querySelectorAll('.article-practice-panel').forEach(panel=>{
    panel.classList.toggle('active', panel.dataset.articlePractice === articlePracticeMode);
  });
  [
    ['quiz', 'startQuizPracticeBtn'],
    ['retell', 'startRetellPracticeBtn'],
    ['typing', 'startTypingPracticeBtn']
  ].forEach(([type, buttonId])=>{
    if(buttonId){
      const button = document.getElementById(buttonId);
      if(button){
        const isSelected = type === ACTIVE_PRACTICE_MODULE;
        button.classList.toggle('is-selected', isSelected);
        button.setAttribute('aria-pressed', String(isSelected));
      }
    }
  });
}

function updatePracticeHeaderForActiveModule(){
  const hasText = !!CURRENT_ARTICLE_TEXT.trim();
  const articleTitle = document.getElementById('articlePracticeTitle');
  const articleDesc = document.getElementById('articlePracticeDesc');
  const articleKicker = document.getElementById('articlePracticeKicker');
  const articleLock = document.getElementById('articleModuleLock');
  const retellSource = document.getElementById('retellSourceText');

  if(articleKicker) articleKicker.textContent = '文章理解';
  if(articleTitle) articleTitle.textContent = ACTIVE_PRACTICE_MODULE === 'retell' ? '复述练习' : '选择题练习';
  if(articleDesc){
    articleDesc.textContent = '';
  }
  if(articleLock){
    articleLock.textContent = hasText ? '已解锁' : '需要先完成阅读';
    articleLock.classList.toggle('unlocked', hasText);
  }
  if(retellSource) setRetellSourceDisplay(false);
}

function setArticlePracticeMode(mode){
  articlePracticeMode = mode === 'retell' ? 'retell' : 'cloze';
  focusPracticeModule(articlePracticeMode === 'retell' ? 'retell' : 'quiz');
}

function getArticlePracticeSentences(text){
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if(!normalized) return [];
  const matches = normalized.match(/[^。！？!?]+[。！？!?]?/g) || [normalized];
  const sentences = matches
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 6);
  return sentences.length ? sentences : [normalized.slice(0, 80)];
}

function shortenPracticeText(text, max = 46){
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function shufflePracticeOptions(options){
  return options
    .map(option => ({...option, sort:Math.random()}))
    .sort((a, b) => a.sort - b.sort)
    .map(({sort, ...option}) => option);
}

function makeSentenceDistractor(sentence, index = 0){
  const replacements = [
    ['毎朝', '毎晩'],
    ['今日', '昨日'],
    ['学校', '会社'],
    ['図書館', '公園'],
    ['先生', '友達'],
    ['本', '映画'],
    ['行きます', '行きません'],
    ['します', 'しません'],
    ['です', 'ではありません'],
    ['ます', 'ません']
  ];
  for(const [from, to] of replacements.slice(index).concat(replacements.slice(0, index))){
    if(sentence.includes(from)){
      const changed = sentence.replace(from, to);
      if(changed !== sentence) return changed;
    }
  }
  return index % 2 === 0
    ? `本文には「${shortenPracticeText(sentence, 32)}」と書かれていません。`
    : `${shortenPracticeText(sentence, 30)}という内容ではありません。`;
}

function findQuizWordForArticle(text){
  return Object.entries(DICT)
    .filter(([word, info]) => word && text.includes(word) && info?.level !== 'particle' && info?.reading)
    .sort((a, b) => b[0].length - a[0].length)[0] || null;
}

function dictionaryReadingOptions(correctWord, correctReading){
  const distractors = Object.entries(DICT)
    .filter(([word, info]) => word !== correctWord && info?.reading && info?.level !== 'particle')
    .map(([, info]) => info.reading)
    .filter((reading, index, arr) => reading && reading !== correctReading && arr.indexOf(reading) === index)
    .slice(0, 12);
  const fallback = ['あした', 'せんせい', 'じかん', 'ともだち'].filter(item => item !== correctReading);
  const picked = [...distractors, ...fallback].slice(0, 3);
  return shufflePracticeOptions([
    { text:correctReading, correct:true },
    ...picked.map(text => ({ text, correct:false }))
  ]);
}

function clampReadingQuizIndex(index = READING_QUIZ_CURRENT_INDEX){
  if(!READING_QUIZ_ITEMS.length) return 0;
  return Math.max(0, Math.min(index, READING_QUIZ_ITEMS.length - 1));
}

function readingQuizScoreText(){
  if(!READING_QUIZ_ITEMS.length) return '';
  if(READING_QUIZ_HAS_RESULT){
    const correct = READING_QUIZ_ITEMS.filter(item => item.options[item.selectedIndex]?.correct).length;
    return `共 ${READING_QUIZ_ITEMS.length} 题 · 答对 ${correct} 题`;
  }
  const answered = READING_QUIZ_ITEMS.filter(item => Number.isInteger(item.selectedIndex) && item.selectedIndex >= 0).length;
  return answered ? `已作答 ${answered} / ${READING_QUIZ_ITEMS.length}` : '';
}

function readingQuizReviewHtml(item){
  return `
    <div class="reading-quiz-result-options">
      ${item.options.map((option, optionIndex) => {
        const isSelected = optionIndex === item.selectedIndex;
        const isCorrect = !!option.correct;
        const label = isSelected && isCorrect
          ? '你的选择 · 正确'
          : isSelected
            ? '你的选择'
            : isCorrect
              ? '正确答案'
              : '';
        return `
          <div class="reading-quiz-result-option${isSelected ? ' is-user-choice' : ''}${isCorrect ? ' is-answer' : ''}${isSelected && !isCorrect ? ' is-wrong-choice' : ''}">
            <span>${escapeHtml(option.text)}</span>
            ${label ? `<strong>${label}</strong>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function readingQuizResultsHtml(){
  const correctCount = READING_QUIZ_ITEMS.filter(item => item.options[item.selectedIndex]?.correct).length;
  return `
    <div class="reading-quiz-results">
      <div class="reading-quiz-results-head">
        <span>结果</span>
        <strong>${correctCount} / ${READING_QUIZ_ITEMS.length}</strong>
      </div>
      <div class="reading-quiz-result-list">
        ${READING_QUIZ_ITEMS.map((item, index) => `
          <article class="reading-quiz-result-card ${item.options[item.selectedIndex]?.correct ? 'is-correct' : 'is-wrong'}">
            <p class="reading-quiz-result-prompt">${index + 1}. ${escapeHtml(item.prompt)}</p>
            ${readingQuizReviewHtml(item)}
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function readingQuizHtml(){
  if(!READING_QUIZ_ITEMS.length) return '';
  if(READING_QUIZ_HAS_RESULT) return readingQuizResultsHtml();
  READING_QUIZ_CURRENT_INDEX = clampReadingQuizIndex();
  const item = READING_QUIZ_ITEMS[READING_QUIZ_CURRENT_INDEX];
  const itemIndex = READING_QUIZ_CURRENT_INDEX;
  const hasSelection = Number.isInteger(item.selectedIndex) && item.selectedIndex >= 0;
  const progress = Math.round(((itemIndex + 1) / READING_QUIZ_ITEMS.length) * 100);
  return `
    <div class="reading-quiz-shell">
      <div class="reading-quiz-progress" aria-label="选择题进度">
        <span>${itemIndex + 1} / ${READING_QUIZ_ITEMS.length}</span>
        <div><i style="width:${progress}%"></i></div>
      </div>
      <div class="reading-quiz-list">
        <article class="reading-quiz-question" data-reading-quiz-id="${item.id}">
          <p class="reading-quiz-prompt">${escapeHtml(item.prompt)}</p>
          <div class="reading-quiz-options">
            ${item.options.map((option, optionIndex) => `
              <label class="reading-quiz-option${optionIndex === item.selectedIndex ? ' is-selected' : ''}">
                <input type="radio" name="readingQuiz-${item.id}" value="${optionIndex}" ${optionIndex === item.selectedIndex ? 'checked' : ''} onchange="selectReadingQuizOption('${escapeHtml(item.id)}', ${optionIndex})">
                <span>${escapeHtml(option.text)}</span>
              </label>
            `).join('')}
          </div>
        </article>
      </div>
      <div class="reading-quiz-card-actions">
        <button class="btn-secondary" type="button" onclick="prevReadingQuizQuestion()" ${itemIndex === 0 ? 'disabled' : ''}>上一题</button>
        <button class="btn-primary" type="button" onclick="checkReadingQuiz()">提交答案</button>
        <button class="btn-secondary" type="button" onclick="nextReadingQuizQuestion()" ${itemIndex >= READING_QUIZ_ITEMS.length - 1 ? 'disabled' : ''}>下一题</button>
      </div>
    </div>
  `;
}

function renderReadingQuiz(){
  const out = document.getElementById('clozeOutput');
  if(out) out.innerHTML = readingQuizHtml();
  const score = document.getElementById('clozeScore');
  if(score) score.textContent = readingQuizScoreText();
  updateReadingQuizFlowState();
}

function selectReadingQuizOption(itemId, optionIndex){
  const item = READING_QUIZ_ITEMS.find(quizItem => quizItem.id === itemId);
  if(!item) return;
  item.selectedIndex = optionIndex;
  renderReadingQuiz();
}

function setReadingQuizQuestion(index){
  if(!READING_QUIZ_ITEMS.length) return;
  READING_QUIZ_CURRENT_INDEX = clampReadingQuizIndex(index);
  renderReadingQuiz();
}

function prevReadingQuizQuestion(){
  setReadingQuizQuestion(READING_QUIZ_CURRENT_INDEX - 1);
}

function nextReadingQuizQuestion(){
  setReadingQuizQuestion(READING_QUIZ_CURRENT_INDEX + 1);
}

function generateReadingQuiz(){
  const out = document.getElementById('clozeOutput');
  const text = CURRENT_ARTICLE_TEXT;
  if(!text.trim()){
    out.innerHTML = '<span class="quiz-empty-message">还没有文章。请先到「阅读」页导入并分析一篇日语文章。</span>';
    updateReadingQuizFlowState();
    return;
  }

  const sentences = getArticlePracticeSentences(text);
  const firstSentence = sentences[0] || text;
  const midSentence = sentences[Math.min(1, sentences.length - 1)] || firstSentence;
  const wordEntry = findQuizWordForArticle(text);
  READING_QUIZ_ATTEMPT_RECORDED = false;
  READING_QUIZ_HAS_RESULT = false;
  READING_QUIZ_ITEMS = [
    {
      id:'main',
      type:'main',
      prompt:'この文章の主な内容は何ですか。',
      answerText:`「${shortenPracticeText(firstSentence)}」について書かれています。`,
      options:shufflePracticeOptions([
        { text:`「${shortenPracticeText(firstSentence)}」について書かれています。`, correct:true },
        { text:'単語とその意味だけを紹介しています。', correct:false },
        { text:'ウェブサイトの設定方法を説明しています。', correct:false },
        { text:'本文とは関係のないニュースを紹介しています。', correct:false }
      ])
    },
    {
      id:'sentence',
      type:'sentence',
      prompt:'本文の内容と合っている文はどれですか。',
      answerText:shortenPracticeText(midSentence, 90),
      options:shufflePracticeOptions([
        { text:shortenPracticeText(midSentence, 90), correct:true },
        { text:shortenPracticeText(makeSentenceDistractor(midSentence, 0), 90), correct:false },
        { text:shortenPracticeText(makeSentenceDistractor(midSentence, 2), 90), correct:false },
        { text:shortenPracticeText(makeSentenceDistractor(firstSentence, 4), 90), correct:false }
      ])
    }
  ];

  if(wordEntry){
    const [word, info] = wordEntry;
    READING_QUIZ_ITEMS.push({
      id:'word',
      type:'word',
      prompt:`「${word}」の正しい読み方はどれですか。`,
      answerText:info.reading,
      options:dictionaryReadingOptions(word, info.reading)
    });
  }

  READING_QUIZ_ITEMS = READING_QUIZ_ITEMS.map(item => ({
    ...item,
    selectedIndex:-1,
    checked:false
  }));
  READING_QUIZ_CURRENT_INDEX = 0;
  out.innerHTML = readingQuizHtml();
  CURRENT_ARTICLE_PRACTICE_KEY = articlePracticeKey(text);
  document.getElementById('clozeScore').textContent = '';
  updateReadingQuizFlowState();
}

function checkReadingQuiz(){
  if(!READING_QUIZ_ITEMS.length) return;
  const unansweredIndex = READING_QUIZ_ITEMS.findIndex(item => !Number.isInteger(item.selectedIndex) || item.selectedIndex < 0);
  if(unansweredIndex >= 0){
    READING_QUIZ_CURRENT_INDEX = unansweredIndex;
    renderReadingQuiz();
    showToast('还有题目没有作答。', 'warning');
    return;
  }
  READING_QUIZ_ITEMS.forEach(item=>{
    item.checked = true;
    const ok = !!item.options[item.selectedIndex]?.correct;
    if(ok){
      resolvePracticeReview(`quiz:${item.id}:${item.prompt}`);
    } else {
      addPracticeReviewItem({
        key:`quiz:${item.id}:${item.prompt}`,
        type:'quiz',
        title:'読解問題',
        prompt:item.prompt,
        answer:item.answerText,
        note:'もう一度この問題を練習しましょう'
      });
    }
  });
  READING_QUIZ_HAS_RESULT = true;
  if(!READING_QUIZ_ATTEMPT_RECORDED){
    const correct = READING_QUIZ_ITEMS.filter(item => item.options[item.selectedIndex]?.correct).length;
    recordPracticeResult('quiz', { correct, total: READING_QUIZ_ITEMS.length });
    recordReadingQuizAttempt(correct, READING_QUIZ_ITEMS.length);
    READING_QUIZ_ATTEMPT_RECORDED = true;
  }
  renderReadingQuiz();
}

function revealReadingQuiz(){
  if(!READING_QUIZ_ITEMS.length) return;
  READING_QUIZ_ITEMS.forEach(item=>{
    const correctIndex = item.options.findIndex(option => option.correct);
    item.selectedIndex = correctIndex;
    item.checked = true;
  });
  document.getElementById('clozeScore').textContent = `共 ${READING_QUIZ_ITEMS.length} 题 · 已显示正确答案`;
  READING_QUIZ_HAS_RESULT = true;
  renderReadingQuiz();
}

function generateCloze(){ generateReadingQuiz(); }
function checkCloze(){ checkReadingQuiz(); }
function revealCloze(){ revealReadingQuiz(); }

// ---------------- 输出：口语复述（对照原文自查，不做自动判分） ----------------
function speakOriginalForRetell(){
  const text = CURRENT_ARTICLE_TEXT.trim();
  if(!text){
    showToast('请先在「阅读」标签里分析一段文本。', 'warning');
    return;
  }
  if(!('speechSynthesis' in window)){
    showToast('当前浏览器不支持发音功能。', 'warning');
    return;
  }
  if(RETELL_SPEAKING && window.speechSynthesis.speaking && !window.speechSynthesis.paused){
    pauseRetellReading();
    return;
  }
  if(RETELL_SPEAKING && window.speechSynthesis.paused){
    resumeRetellReading();
    return;
  }

  stopTts();
  setRetellActivityState('reading');
  setRetellSourceDisplay(true);
  renderRetellReadingControls();

  const button = document.getElementById('retellReadBtn');
  const utterance = new SpeechSynthesisUtterance(normalizeJapaneseSpeechText(text));
  utterance.lang = 'ja-JP';
  utterance.rate = getPreferredTtsRate(text);
  utterance.pitch = 1;
  const jaVoice = chooseJapaneseVoice();
  if(jaVoice) utterance.voice = jaVoice;
  utterance.onstart = ()=>{
    RETELL_SPEAKING = true;
    button?.classList.add('is-speaking');
    if(button) button.textContent = '暂停朗读';
    updateRetellPauseButton('暂停朗读');
  };
  utterance.onend = finishRetellReading;
  utterance.onerror = finishRetellReading;
  window.speechSynthesis.speak(utterance);
}

function renderRetellReadingControls(){
  const resultBox = document.getElementById('retellResult');
  if(!resultBox) return;
  resultBox.innerHTML = `
    <div class="retell-reading-panel">
      <div class="retell-reading-head">
        <span>朗读中</span>
        <div class="retell-reading-actions">
          <button class="btn-secondary" id="retellTtsPauseBtn" type="button" onclick="toggleRetellReadingPause()">暂停朗读</button>
          <button class="btn-secondary" type="button" onclick="stopRetellReading()">停止</button>
        </div>
      </div>
    </div>
  `;
}

function updateRetellPauseButton(label){
  const button = document.getElementById('retellTtsPauseBtn');
  if(button) button.textContent = label;
}

function pauseRetellReading(){
  if(!('speechSynthesis' in window)) return;
  window.speechSynthesis.pause();
  const button = document.getElementById('retellReadBtn');
  if(button) button.textContent = '继续朗读';
  updateRetellPauseButton('继续朗读');
}

function resumeRetellReading(){
  if(!('speechSynthesis' in window)) return;
  window.speechSynthesis.resume();
  const button = document.getElementById('retellReadBtn');
  if(button) button.textContent = '暂停朗读';
  updateRetellPauseButton('暂停朗读');
}

function toggleRetellReadingPause(){
  if(!('speechSynthesis' in window)) return;
  if(window.speechSynthesis.paused) resumeRetellReading();
  else pauseRetellReading();
}

function stopRetellReading(){
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  finishRetellReading();
}

function finishRetellReading(){
  RETELL_SPEAKING = false;
  const button = document.getElementById('retellReadBtn');
  if(button){
    button.textContent = '朗读原文';
    button.classList.remove('is-speaking');
  }
  setRetellActivityState('idle');
  setRetellSourceDisplay(false);
  const panel = document.querySelector('#retellResult .retell-reading-panel');
  if(panel) panel.remove();
  if(!document.getElementById('retellResult')?.textContent.trim()){
    const resultBox = document.getElementById('retellResult');
    if(resultBox) resultBox.innerHTML = '';
  }
}

function startManualRetell(){
  if(!CURRENT_ARTICLE_TEXT.trim()){
    showToast('请先在「阅读」标签里分析一段文本。', 'warning');
    return;
  }
  const resultBox = document.getElementById('retellResult');
  if(!resultBox) return;
  stopRetellReading();
  setRetellActivityState('manual');
  setRetellSourceDisplay(true);
  resultBox.innerHTML = retellFallbackInputHtml('用自己的话打字复述。', '看完原文后，用自己的话打字复述……');
  document.getElementById('retellManualInput')?.focus();
}

function retellFallbackInputHtml(message, placeholder = '用自己的话打字复述……'){
  return `
    <div class="retell-fallback-panel">
      <div class="retell-fallback-head">
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path><path d="M8 21h8"></path></svg>
        </span>
        <strong>${escapeHtml(message)}</strong>
      </div>
      <textarea id="retellManualInput" class="typing-input retell-manual-input" placeholder="${escapeHtml(placeholder)}" aria-label="打字复述"></textarea>
      <div class="btnrow">
        <button class="btn-primary" onclick="showRetellComparison(document.getElementById('retellManualInput').value)">对照原文</button>
      </div>
    </div>
  `;
}

function toggleRetellRecording(){
  if(RETELL_RECORDING){ stopRetellRecording(); return; }
  prepareRetellRecording();
}

async function retellMicrophonePermissionState(){
  try{
    if(!navigator.permissions?.query) return '';
    const status = await navigator.permissions.query({name:'microphone'});
    return status?.state || '';
  }catch{
    return '';
  }
}

async function prepareRetellRecording(){
  if(!CURRENT_ARTICLE_TEXT.trim()){
    showToast('请先在「阅读」标签里分析一段文本。', 'warning');
    return;
  }
  // Keep getUserMedia in the direct click gesture. iOS Safari can reject a
  // request that starts only after awaiting the Permissions API.
  startRetellRecording();
}

function openRetellPermissionModal(){
  RETELL_PERMISSION_TRIGGER = document.activeElement instanceof HTMLElement ? document.activeElement : document.getElementById('retellRecordBtn');
  setDialogVisibility(document.getElementById('retellPermissionModal'), true);
}

function closeRetellPermissionModal(restoreFocus = true){
  setDialogVisibility(document.getElementById('retellPermissionModal'), false);
  if(restoreFocus && RETELL_PERMISSION_TRIGGER?.isConnected) RETELL_PERMISSION_TRIGGER.focus();
  RETELL_PERMISSION_TRIGGER = null;
}

function confirmRetellRecording(){
  safeStorage.setItem('retell_microphone_intro_seen', '1');
  closeRetellPermissionModal(false);
  startRetellRecording();
}

async function startRetellRecording(){
  if(!CURRENT_ARTICLE_TEXT.trim()){
    showToast('请先在「阅读」标签里分析一段文本。', 'warning');
    return;
  }
  stopRetellReading();
  setRetellActivityState('recording');
  setRetellSourceDisplay(true);
  const resultBox = document.getElementById('retellResult');
  const btn = document.getElementById('retellRecordBtn');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(btn){ btn.disabled = true; btn.textContent = '正在请求麦克风…'; }

  if(RETELL_AUDIO_URL){ URL.revokeObjectURL(RETELL_AUDIO_URL); RETELL_AUDIO_URL = null; }
  RETELL_AUDIO_CHUNKS = [];
  let audioRecordingStarted = false;

  if(navigator.mediaDevices?.getUserMedia && window.MediaRecorder){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      RETELL_MEDIA_RECORDER = new MediaRecorder(stream);
      RETELL_MEDIA_RECORDER.ondataavailable = (event)=>{ if(event.data.size) RETELL_AUDIO_CHUNKS.push(event.data); };
      RETELL_MEDIA_RECORDER.onstop = ()=>{
        if(RETELL_AUDIO_CHUNKS.length){
          const audioType = RETELL_MEDIA_RECORDER?.mimeType || RETELL_AUDIO_CHUNKS[0]?.type || 'audio/mp4';
          RETELL_AUDIO_URL = URL.createObjectURL(new Blob(RETELL_AUDIO_CHUNKS, { type: audioType }));
        }
        stream.getTracks().forEach(track=>track.stop());
        if(!SR) showRetellAudioOnlyResult();
        else renderRetellAudioSlot();
      };
      RETELL_MEDIA_RECORDER.start();
      audioRecordingStarted = true;
    }catch(error){
      RETELL_MEDIA_RECORDER = null;
      console.warn('无法录制可回放的音频。', error);
      if(!SR){
        setRetellActivityState('manual');
        resultBox.innerHTML = retellFallbackInputHtml('麦克风没有开启。请在 Safari 网站设置中允许麦克风，或先打字复述。');
        if(btn){ btn.disabled = false; btn.textContent = '重新尝试录音'; }
        requestAnimationFrame(()=>resultBox.scrollIntoView({behavior:'smooth', block:'center'}));
        return;
      }
    }
  }

  if(!SR){
    if(!audioRecordingStarted){
      setRetellActivityState('manual');
      resultBox.innerHTML = retellFallbackInputHtml('当前浏览器不能录音，可以打字复述。');
      if(btn){ btn.disabled = false; btn.textContent = '开始录音复述'; }
      return;
    }
    RETELL_RECORDING = true;
    if(btn){ btn.disabled = false; btn.textContent = '⏹ 停止录音'; btn.classList.add('is-recording'); }
    resultBox.innerHTML = '<div class="recording-indicator"><span class="recording-dot"></span>正在录音……点击「停止录音」后可以回放</div>';
    requestAnimationFrame(()=>resultBox.scrollIntoView({behavior:'smooth', block:'center'}));
    return;
  }

  RETELL_RECOGNITION = new SR();
  RETELL_RECOGNITION.lang = 'ja-JP';
  RETELL_RECOGNITION.interimResults = true;
  RETELL_RECOGNITION.continuous = true;
  let finalTranscript = '';
  RETELL_RECOGNITION.onresult = (event)=>{
    let interim = '';
    for(let i = event.resultIndex; i < event.results.length; i++){
      const chunk = event.results[i][0].transcript;
      if(event.results[i].isFinal) finalTranscript += chunk;
      else interim += chunk;
    }
    RETELL_RECOGNITION._final = finalTranscript;
    resultBox.innerHTML = `
      <div class="recording-indicator"><span class="recording-dot"></span>正在录音…… 说完后点「停止录音」</div>
      <div class="typing-diff" style="margin-top:8px;">${escapeHtml(finalTranscript)}<span style="color:var(--ink-soft);">${escapeHtml(interim)}</span></div>
    `;
  };
  RETELL_RECOGNITION.onerror = (event)=>{
    setRetellActivityState('manual');
    resultBox.innerHTML = retellFallbackInputHtml('语音识别没有成功，可以打字复述。');
    RETELL_RECORDING = false;
    if(btn){ btn.textContent = '开始录音复述'; btn.classList.remove('is-recording'); }
    if(RETELL_MEDIA_RECORDER?.state === 'recording') RETELL_MEDIA_RECORDER.stop();
  };
  RETELL_RECOGNITION.onend = ()=>{
    if(RETELL_RECORDING){
      showRetellComparison(RETELL_RECOGNITION._final || '');
      RETELL_RECORDING = false;
      if(btn){ btn.textContent = '开始录音复述'; btn.classList.remove('is-recording'); }
    }
  };
  RETELL_RECOGNITION.start();
  RETELL_RECORDING = true;
  if(btn){ btn.disabled = false; btn.textContent = '⏹ 停止录音'; btn.classList.add('is-recording'); }
  resultBox.innerHTML = '<div class="recording-indicator"><span class="recording-dot"></span>正在录音…… 请开始用日语复述</div>';
}

function stopRetellRecording(){
  if(RETELL_RECOGNITION) RETELL_RECOGNITION.stop();
  if(RETELL_MEDIA_RECORDER?.state === 'recording') RETELL_MEDIA_RECORDER.stop();
  if(!RETELL_RECOGNITION){
    RETELL_RECORDING = false;
    const btn = document.getElementById('retellRecordBtn');
    if(btn){ btn.disabled = false; btn.textContent = '再次录音'; btn.classList.remove('is-recording'); }
  }
}

function showRetellAudioOnlyResult(){
  const resultBox = document.getElementById('retellResult');
  if(!resultBox) return;
  setRetellActivityState('result');
  resultBox.innerHTML = `
    <div class="retell-result-head"><strong>录音完成</strong><div id="retellAudioSlot"></div></div>
    <p class="lookup-status">Safari 暂不提供日语语音转写。你可以回放录音，再打字记录复述内容。</p>
    ${retellFallbackInputHtml('补充复述文字（可选）', '输入刚才复述的日语……')}
  `;
  renderRetellAudioSlot();
}

function showRetellComparison(transcript){
  const clean = String(transcript || '').trim();
  const resultBox = document.getElementById('retellResult');
  setRetellActivityState('result');
  setRetellSourceDisplay(false);
  resultBox.innerHTML = `
    <div class="retell-result-head">
      <span>对照</span>
      <div id="retellAudioSlot"></div>
    </div>
    <div class="retell-compare">
      <div>
        <div class="typing-meta"><span class="typing-chip">原文</span></div>
        <div class="typing-diff">${escapeHtml(CURRENT_ARTICLE_TEXT).replace(/\n/g, '<br>')}</div>
      </div>
      <div>
        <div class="typing-meta"><span class="typing-chip">你的复述（语音识别文字）</span></div>
        <div class="typing-diff">${clean ? escapeHtml(clean) : '<span style="color:var(--ink-soft);">没有识别到内容，再试一次。</span>'}</div>
      </div>
    </div>
  `;
  renderRetellAudioSlot();
}

function renderRetellAudioSlot(){
  const slot = document.getElementById('retellAudioSlot');
  if(!slot) return;
  slot.innerHTML = RETELL_AUDIO_URL
    ? `<audio controls src="${RETELL_AUDIO_URL}"></audio>`
    : (RETELL_MEDIA_RECORDER ? '<span class="lookup-status">处理录音中……</span>' : '');
}

// Vocabulary store implementation moved to vocab-store.js.

function exportLearningBackup(){
  syncPracticeHistory();
  const backup = {
    app:'dokedo-japanese-reader',
    version:2,
    exportedAt:new Date().toISOString(),
    vocab:vocabData,
    history:READING_HISTORY,
    readingQuizHistory:READING_QUIZ_HISTORY,
    grammarBook:GRAMMAR_BOOK,
    practiceStats:normalizePracticeStats(PRACTICE_STATS, PRACTICE_STATS.date || practiceDateKey()),
    practiceHistory:PRACTICE_HISTORY,
    readingQueue:READING_QUEUE,
    learningGoals:LEARNING_GOALS,
    practiceReview:PRACTICE_REVIEW,
    rubyOverrides:RUBY_OVERRIDES,
    preferredVoice:safeStorage.getItem('reading_tts_voice') || '',
    workspace:safeStorage.getItem('reading_workspace') || 'reading',
    levelResult:safeStorage.getItem('reading_level_result') || '',
    interfaceLanguage:safeStorage.getItem('interface_language') || 'zh',
    readingFontSize:safeStorage.getItem('reading_font_size') || '20',
    readingRubyFontSize:safeStorage.getItem('reading_ruby_font_size') || '10',
    readingRubyGap:safeStorage.getItem('reading_ruby_gap') || '0.16',
    readingLineHeight:safeStorage.getItem('reading_line_height') || '1.8'
  };
  downloadTextFile(`dokedo-backup-${todayStamp()}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8;');
  showToast('完整备份已开始下载。', 'success');
}

async function importLearningBackup(file){
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if(!data || data.app !== 'dokedo-japanese-reader') throw new Error('这不是有效的读得懂备份文件。');
    vocabData = normalizeVocabList(data.vocab);
    READING_HISTORY = normalizeReadingHistoryList(data.history);
    READING_QUIZ_HISTORY = Array.isArray(data.readingQuizHistory) ? normalizeReadingQuizHistoryList(data.readingQuizHistory) : READING_QUIZ_HISTORY;
    GRAMMAR_BOOK = Array.isArray(data.grammarBook)
      ? data.grammarBook.map(normalizeGrammarBookItem).filter(Boolean).slice(0, 100)
      : GRAMMAR_BOOK;
    READING_QUEUE = Array.isArray(data.readingQueue) ? normalizeReadingQueueItems(data.readingQueue) : READING_QUEUE;
    LEARNING_GOALS = data.learningGoals ? normalizeLearningGoals(data.learningGoals) : LEARNING_GOALS;
    if(Array.isArray(data.practiceReview)){
      safeStorage.setItem('reading_practice_review', JSON.stringify(data.practiceReview));
      PRACTICE_REVIEW = loadPracticeReview();
    }
    PRACTICE_HISTORY = Array.isArray(data.practiceHistory)
      ? data.practiceHistory.map(item => normalizePracticeStats(item, item.date)).slice(0, 30)
      : PRACTICE_HISTORY;
    if(data.practiceStats?.date && !PRACTICE_HISTORY.some(item => item.date === data.practiceStats.date)){
      PRACTICE_HISTORY = [
        normalizePracticeStats(data.practiceStats, data.practiceStats.date),
        ...PRACTICE_HISTORY
      ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
    }
    const restoredToday = PRACTICE_HISTORY.find(item => item.date === practiceDateKey());
    if(data.practiceStats?.date === practiceDateKey()){
      PRACTICE_STATS = normalizePracticeStats(data.practiceStats, data.practiceStats.date);
    }else if(restoredToday){
      PRACTICE_STATS = normalizePracticeStats(restoredToday, restoredToday.date);
    }else{
      PRACTICE_STATS = defaultPracticeStats();
    }
    RUBY_OVERRIDES = data.rubyOverrides && typeof data.rubyOverrides === 'object' ? data.rubyOverrides : {};
    safeStorage.setItem('reading_ruby_overrides', JSON.stringify(RUBY_OVERRIDES));
    if(data.preferredVoice) safeStorage.setItem('reading_tts_voice', data.preferredVoice);
    if(data.levelResult) safeStorage.setItem('reading_level_result', data.levelResult);
    if(data.workspace) safeStorage.setItem('reading_workspace', data.workspace);
    if(data.interfaceLanguage) setInterfaceLanguage(data.interfaceLanguage, true);
    if(data.readingFontSize) safeStorage.setItem('reading_font_size', data.readingFontSize);
    if(data.readingRubyFontSize) safeStorage.setItem('reading_ruby_font_size', data.readingRubyFontSize);
    if(data.readingRubyGap) safeStorage.setItem('reading_ruby_gap', data.readingRubyGap);
    if(data.readingLineHeight) safeStorage.setItem('reading_line_height', data.readingLineHeight);
    initReadingFontSize();
    await saveVocab();
    saveReadingHistory();
    saveReadingQuizHistory();
    saveGrammarBook();
    saveReadingQueue();
    safeStorage.setItem('reading_learning_goals', JSON.stringify(LEARNING_GOALS));
    savePracticeReview();
    clearActiveReadingQueueItem();
    savePracticeStats();
    syncPracticeHistory();
    renderVocab();
    renderReadingHistory();
    renderReadingQueue();
    renderPracticeSummary();
    renderGrammarBook();
    renderGrammar();
    renderPracticeReview();
    renderDailyPlan();
    showToast('备份已恢复。', 'success');
  }catch(error){
    showToast(error.message || '备份恢复失败。', 'error');
  }finally{
    const input = document.getElementById('backupFileInput');
    if(input) input.value = '';
  }
}

function backupData(){
  exportLearningBackup();
}

function restoreData(){
  confirmDeletion({
    kicker:'恢复确认',
    title:'恢复备份？',
    message:'选择备份文件后，当前设备上的生词本、语法本和阅读记录会被备份内容覆盖。',
    target:'建议先备份当前数据，再继续恢复。',
    confirmLabel:'选择文件'
  }, ()=>{
    document.getElementById('backupFileInput')?.click();
  });
}

function clearHistory(){
  clearReadingHistory();
}

loadVocab();

// ---------------- 阅读历史、推荐来源、水平测试 ----------------
function normalizeReadingHistoryItem(item = {}, index = 0){
  const text = String(item.text || '');
  const date = new Date(item.date);
  const safeDate = Number.isNaN(date.getTime()) ? new Date(Date.now() - index).toISOString() : date.toISOString();
  const compact = String(item.fingerprint || text.replace(/\s+/g, '').slice(0, 180));
  const url = readingQueueUrl(item.url);
  return {
    id:Number(item.id || 0) || Date.now() - index,
    title:String(item.title || articleTitleFromText(text) || '未命名文章'),
    source:String(item.source || (url ? readingQueueFallbackTitle(url) : '手动导入')),
    url,
    date:safeDate,
    chars:Number(item.chars || text.length || 0),
    text,
    annotatedHtml:String(item.annotatedHtml || ''),
    fingerprint:compact.slice(0, 180)
  };
}

function normalizeReadingHistoryList(items){
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map(normalizeReadingHistoryItem)
    .filter(item => item.text || item.title)
    .filter(item => {
      const key = item.fingerprint || `${item.title}:${item.date}`;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 50);
}

function loadReadingHistory(){
  try{ READING_HISTORY = normalizeReadingHistoryList(JSON.parse(safeStorage.getItem('reading_history') || '[]')); }
  catch{ READING_HISTORY = []; }
}

function saveReadingHistory(){
  safeStorage.setItem('reading_history', JSON.stringify(READING_HISTORY.slice(0, 50)));
}

function loadReadingQuizHistory(){
  try{
    const stored = JSON.parse(safeStorage.getItem('reading_quiz_history') || '[]');
    return normalizeReadingQuizHistoryList(stored);
  }catch{
    return [];
  }
}

function normalizeReadingQuizHistoryList(items){
  return (Array.isArray(items) ? items : [])
    .map((attempt, index)=>{
      const date = new Date(attempt?.date);
      return {
        id:Number(attempt?.id || 0) || Date.now() - index,
        date:Number.isNaN(date.getTime()) ? new Date(Date.now() - index).toISOString() : date.toISOString(),
        articleTitle:String(attempt?.articleTitle || '阅读理解'),
        articleUrl:String(attempt?.articleUrl || ''),
        articleFingerprint:String(attempt?.articleFingerprint || '').slice(0, 180),
        correct:Number(attempt?.correct || 0),
        total:Number(attempt?.total || 0),
        items:Array.isArray(attempt?.items) ? attempt.items.map(item => ({
          prompt:String(item?.prompt || ''),
          selected:String(item?.selected || '未作答'),
          answer:String(item?.answer || ''),
          correct:!!item?.correct
        })) : []
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 50);
}

function saveReadingQuizHistory(){
  safeStorage.setItem('reading_quiz_history', JSON.stringify(READING_QUIZ_HISTORY.slice(0, 50)));
}

function recordReadingQuizAttempt(correct, total){
  const items = READING_QUIZ_ITEMS.map(item=>{
    const checked = document.querySelector(`input[name="readingQuiz-${item.id}"]:checked`);
    const selected = checked ? item.options[Number(checked.value)] : null;
    return {
      prompt:item.prompt,
      selected:selected?.text || '未作答',
      answer:item.answerText,
      correct:!!selected?.correct
    };
  });
  READING_QUIZ_HISTORY.unshift({
    id:Date.now(),
    date:new Date().toISOString(),
    articleTitle:articleTitleFromText(CURRENT_ARTICLE_TEXT),
    articleUrl:CURRENT_ARTICLE_URL,
    articleFingerprint:CURRENT_ARTICLE_TEXT.replace(/\s+/g, '').slice(0, 180),
    correct,
    total,
    items
  });
  READING_QUIZ_HISTORY = READING_QUIZ_HISTORY.slice(0, 50);
  saveReadingQuizHistory();
  if(document.body.dataset.view === 'history') renderReadingHistory();
}

function articleTitleFromText(text){
  const firstLine = String(text || '').split('\n').map(v=>v.trim()).find(Boolean) || '未命名文章';
  return firstLine.length > 34 ? firstLine.slice(0, 34) + '…' : firstLine;
}

function saveCurrentArticleToHistory(){
  const text = CURRENT_ARTICLE_TEXT.trim();
  const output = document.getElementById('output');
  if(!text || !output) return;
  const activeQueueItem = READING_QUEUE.find(entry => entry.id === ACTIVE_READING_QUEUE_ID);
  const compact = text.replace(/\s+/g, '');
  const existingIndex = READING_HISTORY.findIndex(item => item.fingerprint === compact.slice(0, 180));
  const item = {
    id: Date.now(),
    title: articleTitleFromText(text),
    source:activeQueueItem?.title || (CURRENT_ARTICLE_URL ? readingQueueFallbackTitle(CURRENT_ARTICLE_URL) : '手动导入'),
    url:activeQueueItem?.url || CURRENT_ARTICLE_URL || '',
    date:new Date().toISOString(),
    chars:text.length,
    text,
    annotatedHtml:output.innerHTML,
    fingerprint:compact.slice(0, 180)
  };
  if(existingIndex >= 0) READING_HISTORY.splice(existingIndex, 1);
  READING_HISTORY.unshift(item);
  READING_HISTORY = READING_HISTORY.slice(0, 50);
  saveReadingHistory();
  markActiveReadingQueueRead();
  renderDailyPlan();
  if(document.body.dataset.view === 'history') renderReadingHistory();
}

function renderReadingHistory(){
  renderLearningProgress();
  renderHistoryDashboard();
  renderHistorySummary();
  renderHistoryCalendar();
  renderHistorySuggestions();
  renderHistoryActivityList();
  renderReadingQuizHistory();
  renderHistoryWeakList();
  renderHistoryLevelEstimate();
  const list = document.getElementById('historyList');
  if(!list) return;
  const keyword = (document.getElementById('historySearch')?.value || '').trim().toLowerCase();
  const filtered = READING_HISTORY.filter(item => {
    const haystack = `${item.title} ${item.source} ${item.text}`.toLowerCase();
    return !keyword || haystack.includes(keyword);
  });
  if(!filtered.length){
    list.innerHTML = '<div class="history-empty"><p>还没有阅读历史。分析一篇文章后，会自动保存在这里。</p><button class="btn-primary" onclick="switchWorkspace(\'reading\')">去读一篇文章</button></div>';
    return;
  }
  list.innerHTML = filtered.map(item => `
    <article class="history-item">
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${new Date(item.date).toLocaleString()} · ${Number(item.chars || 0).toLocaleString()} 字 · ${escapeHtml(item.source || '手动导入')}</p>
        ${item.url ? `<a class="history-source-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">打开文章链接</a>` : ''}
      </div>
      <div class="history-actions">
        <button class="btn-primary" onclick="restoreHistoryArticle(${item.id})">打开</button>
        <button class="history-remove" onclick="removeHistoryArticle(${item.id})" title="删除" aria-label="删除 ${escapeHtml(item.title)}">${removeVocabIcon()}</button>
      </div>
    </article>
  `).join('');
}

function historyWeekArticleCount(){
  return READING_HISTORY.filter(item => {
    const date = new Date(item.date);
    return !Number.isNaN(date.getTime()) && Date.now() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;
}

function historyQuizRate(){
  const answered = READING_QUIZ_HISTORY.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const correct = READING_QUIZ_HISTORY.reduce((sum, item) => sum + Number(item.correct || 0), 0);
  return answered ? Math.round(correct / answered * 100) : null;
}

function historyDueVocabCount(){
  return getAllVocab().filter(item => isDue(item)).length;
}

function historyLevelValue(){
  const level = (safeStorage.getItem('reading_level_result') || '').split('｜')[0] || '';
  return level || (getAllVocab().length >= 120 ? 'N3' : getAllVocab().length >= 50 ? 'N4' : '');
}

function renderHistorySummary(){
  const text = document.getElementById('historySummaryText');
  const stats = document.getElementById('historySummaryStats');
  const title = document.getElementById('historyPageTitle');
  const subtitle = document.getElementById('historyPageSubtitle');
  const cta = document.getElementById('historyPrimaryAction');
  const activeDays = recentActivityDays(7).filter(day => day.total > 0).length;
  const weekArticles = historyWeekArticleCount();
  const vocabTotal = getAllVocab().length;
  const grammarTotal = GRAMMAR_BOOK.length;
  const quizRate = historyQuizRate();
  const rateLabel = quizRate === null ? '暂无正确率' : `正确率 ${quizRate}%`;
  if(title) title.textContent = '学习历史';
  if(subtitle) subtitle.textContent = '记录你的阅读、练习和复习进度。';
  if(text) text.textContent = `${activeDays} 天打卡 · ${weekArticles} 篇阅读 · ${vocabTotal} 个生词 · ${grammarTotal} 条语法 · ${rateLabel}`;
  if(stats){
    stats.innerHTML = `
      <div><b>${learningActivityStreak()}</b><small>连续天数</small></div>
      <div><b>${READING_HISTORY.length}</b><small>已读文章</small></div>
      <div><b>${quizRate === null ? '—' : `${quizRate}%`}</b><small>练习表现</small></div>
    `;
  }
  if(cta) cta.textContent = historyPrimaryActionLabel();
}

function renderHistoryCalendar(){
  const grid = document.getElementById('historyCalendarGrid');
  const foot = document.getElementById('historyCalendarFoot');
  const days = recentActivityDays(30);
  const todayKey = localDateKey(new Date());
  if(grid){
    const firstDate = new Date(`${days[0]?.date || todayKey}T12:00:00`);
    const leadingBlanks = Number.isNaN(firstDate.getTime()) ? 0 : firstDate.getDay();
    const blanks = Array.from({length:leadingBlanks}, () => '<span class="history-calendar-empty" aria-hidden="true"></span>');
    const dayButtons = days.map(day => {
      const readingCount = READING_HISTORY.filter(item => localDateKey(item.date) === day.date).length;
      const practice = PRACTICE_HISTORY.find(item => item.date === day.date);
      const practiceCount = Number(practice?.total || 0);
      const date = new Date(`${day.date}T12:00:00`);
      const label = `${date.getMonth() + 1}月${date.getDate()}日`;
      const details = [];
      if(readingCount) details.push(`阅读 ${readingCount} 篇`);
      if(practiceCount) details.push(`练习 ${practiceCount} 次`);
      const title = `${label}，${details.length ? details.join('，') : '未学习'}`;
      const className = `${heatClassForActivity(day.total)}${day.date === todayKey ? ' is-today' : ''}`.trim();
      return `<button class="${className}" type="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><span>${day.date === todayKey ? '今天' : date.getDate()}</span></button>`;
    });
    grid.innerHTML = blanks.concat(dayButtons).join('');
  }
  if(foot){
    const currentWeek = recentActivityDays(7).filter(day => day.total > 0).length;
    const previousWeek = recentActivityDays(14).slice(0, 7).filter(day => day.total > 0).length;
    const delta = currentWeek - previousWeek;
    const deltaText = delta === 0 ? '和上周持平' : delta > 0 ? `比上周多 ${delta} 天` : `比上周少 ${Math.abs(delta)} 天`;
    foot.innerHTML = `
      <span>本周学习 ${currentWeek} 天</span>
      <span>${deltaText}</span>
      <span class="history-calendar-legend"><i></i>未学习</span>
      <span class="history-calendar-legend active"><i></i>已学习</span>
    `;
  }
}

function historyPrimaryActionLabel(){
  if(!historyLevelValue()) return '水平测试';
  if(!READING_HISTORY.some(item => isDateToday(item.date))) return '开始今日阅读';
  if(historyDueVocabCount() > 0) return '复习到期生词';
  const todayPractice = PRACTICE_HISTORY.find(item => item.date === practiceDateKey());
  if(!todayPractice || Number(todayPractice.total || 0) === 0) return '做一次练习';
  return '找下一篇材料';
}

function openHistoryPrimaryAction(){
  if(!historyLevelValue()){
    switchWorkspace('test');
    return;
  }
  if(!READING_HISTORY.some(item => isDateToday(item.date))){
    switchWorkspace('reading');
    return;
  }
  if(historyDueVocabCount() > 0){
    startReview();
    return;
  }
  const todayPractice = PRACTICE_HISTORY.find(item => item.date === practiceDateKey());
  if(!todayPractice || Number(todayPractice.total || 0) === 0){
    focusPracticeModule('quiz');
    return;
  }
  switchWorkspace('discover');
}

function renderHistorySuggestions(){
  const target = document.getElementById('historySuggestionList');
  if(!target) return;
  const level = historyLevelValue();
  const due = historyDueVocabCount();
  const todayRead = READING_HISTORY.some(item => isDateToday(item.date));
  const todayPractice = PRACTICE_HISTORY.find(item => item.date === practiceDateKey());
  const practicedToday = todayPractice && Number(todayPractice.total || 0) > 0;
  const items = [];
  // The level card on the right already owns the untested-state action.
  // Avoid repeating the same recommendation in the main task list.
  if(!todayRead){
    items.push({priority:!!level, icon:'読', title:`继续读一篇 ${level || '入门'} 文章`, detail:'完成后会更新阅读天数，并生成可复习词汇。', action:"switchWorkspace('reading')", label:'去阅读'});
  }
  if(due > 0){
    items.push({priority:!items.length, icon:'単', title:`复习 ${due} 个到期生词`, detail:'', action:'startReview()', label:'去复习'});
  }
  if(!practicedToday){
    items.push({priority:!items.length, icon:'練', title:'做一次文章理解练习', detail:'完成几次练习后，正确率和薄弱项会自动出现。', action:"focusPracticeModule('quiz')", label:'去练习'});
  }
  if(items.length < 3){
    items.push({priority:false, icon:'材', title:'找一篇新的阅读材料', detail:'', action:"switchWorkspace('discover')", label:'找材料'});
  }
  target.innerHTML = items.slice(0, 2).map(item => `
    <article class="history-task-row ${item.priority ? 'priority' : ''}">
      <div class="history-task-icon">${escapeHtml(item.icon)}</div>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ''}
      </div>
      <button type="button" onclick="${item.action}">${escapeHtml(item.label)}</button>
    </article>
  `).join('');
}

function renderHistoryActivityList(){
  const list = document.getElementById('historyActivityList');
  if(!list) return;
  const items = [];
  const latestReading = READING_HISTORY[0];
  if(latestReading){
    items.push({time:isDateToday(latestReading.date) ? '今天' : new Date(latestReading.date).toLocaleDateString('zh-CN'), text:`阅读了《${latestReading.title || '日语文章'}》`});
  }else{
    items.push({time:'待开始', text:'还没有阅读记录'});
  }
  const weekArticles = historyWeekArticleCount();
  items.push({time:'本周', text:`新增阅读记录 ${weekArticles} 篇`});
  const latestQuiz = READING_QUIZ_HISTORY[0];
  if(latestQuiz){
    items.push({time:'练习', text:`最近阅读理解 ${Number(latestQuiz.correct || 0)} / ${Number(latestQuiz.total || 0)}`});
  }else{
    items.push({time:'待完成', text:'还没有练习正确率'});
  }
  list.innerHTML = items.map(item => `<li><b>${escapeHtml(item.time)}</b><span>${escapeHtml(item.text)}</span></li>`).join('');
}

function renderHistoryDashboard(){
  const grid = document.getElementById('historyStatsGrid') || document.getElementById('historyDashboardGrid');
  if(!grid) return;
  const quizAnswered = READING_QUIZ_HISTORY.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const quizCorrect = READING_QUIZ_HISTORY.reduce((sum, item) => sum + Number(item.correct || 0), 0);
  const typingScore = PRACTICE_STATS.typing.lastScore === null ? '—' : `${PRACTICE_STATS.typing.lastScore}%`;
  const quizRateNumber = quizAnswered ? Math.round(quizCorrect / quizAnswered * 100) : null;
  const quizRate = quizRateNumber === null ? '—' : `${quizRateNumber}%`;
  const dueCount = getAllVocab().filter(item => isDue(item)).length;
  const weekArticles = READING_HISTORY.filter(item => {
    const date = new Date(item.date);
    return !Number.isNaN(date.getTime()) && Date.now() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  grid.innerHTML = `
    <div class="history-stat-card">
      <div class="history-stat-title">🔥 连续打卡</div>
      <div class="history-stat-value">${learningActivityStreak()} 天</div>
      <div class="history-stat-sub">练习连续: ${practiceStreak()} 天</div>
    </div>
    <div class="history-stat-card">
      <div class="history-stat-title">📖 已读文章</div>
      <div class="history-stat-value">${READING_HISTORY.length} 篇</div>
      <div class="history-stat-sub">本周新增: ${weekArticles} 篇</div>
    </div>
    <div class="history-stat-card">
      <div class="history-stat-title">🗂️ 生词本总量</div>
      <div class="history-stat-value">${getAllVocab().length} 词</div>
      <div class="history-stat-sub">到期需复习: ${dueCount} 词</div>
    </div>
    <div class="history-stat-card">
      <div class="history-stat-title">🎯 练习正确率</div>
      <div class="history-stat-value">${quizRate}</div>
      <div class="history-stat-sub">打字: ${typingScore} | 选择题: ${quizRate}</div>
    </div>
  `;
}

function recentActivityDays(count = 30){
  const practiceByDate = new Map(PRACTICE_HISTORY.map(item => [item.date, item]));
  const readingCounts = new Map();
  READING_HISTORY.forEach(item=>{
    const key = localDateKey(item.date);
    if(key) readingCounts.set(key, (readingCounts.get(key) || 0) + 1);
  });
  return Array.from({length:count}, (_, offset) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - offset));
    const key = localDateKey(date);
    const practice = practiceByDate.get(key) || normalizePracticeStats(null, key);
    const reading = readingCounts.get(key) || 0;
    return {date:key, total:Number(practice.total || 0) + reading};
  });
}

function heatClassForActivity(total){
  if(total >= 8) return 'heat-4';
  if(total >= 5) return 'heat-3';
  if(total >= 2) return 'heat-2';
  if(total >= 1) return 'heat-1';
  return '';
}

function renderHistoryWeakList(){
  const list = document.getElementById('historyWeakList');
  if(!list) return;
  const reviewItems = PRACTICE_REVIEW
    .filter(item => item.status !== 'done')
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
    .slice(0, 5);
  const vocabItems = getAllVocab()
    .filter(item => ['again', 'hard'].includes(item.lastPracticeRating || ''))
    .slice(0, 5);
  const items = reviewItems.length
    ? reviewItems.map(item => ({
        title:item.title || item.prompt || '需要回看',
        detail:`错题回看率 ${Number(item.count || 1)} 次`
      }))
    : vocabItems.map(item => ({
        title:`${item.word}${item.reading ? ` (${item.reading})` : ''}`,
        detail:item.lastPracticeRating === 'again' ? '没记住' : '有点犹豫'
      }));
  if(!items.length){
    list.innerHTML = '<li><span>暂无薄弱词汇</span><span>继续练习后自动生成</span></li>';
    return;
  }
  list.innerHTML = items.map((item, index) => `
    <li><span>${index + 1}. ${escapeHtml(item.title)}</span><span>${escapeHtml(item.detail)}</span></li>
  `).join('');
}

function renderHistoryLevelEstimate(){
  const badge = document.getElementById('historyLevelBadge');
  const advice = document.getElementById('historyLevelAdvice');
  if(!badge && !advice) return;
  const level = (safeStorage.getItem('reading_level_result') || '').split('｜')[0] || '';
  const fallbackLevel = level || (getAllVocab().length >= 120 ? 'N3' : getAllVocab().length >= 50 ? 'N4' : '');
  if(badge) badge.textContent = fallbackLevel ? `JLPT ${fallbackLevel}` : '未测试';
  if(advice){
    advice.textContent = fallbackLevel
      ? `建议材料：从 ${fallbackLevel} 难度附近的文章开始，优先精读并整理高频生词。`
      : '完成水平测试后，这里会显示更适合你的阅读建议。';
  }
}

function renderReadingQuizHistory(){
  const list = document.getElementById('historyQuizList');
  if(!list) return;
  if(!READING_QUIZ_HISTORY.length){
    list.innerHTML = '<div class="history-quiz-empty">还没有阅读理解记录。读完文章后完成一次选择题，作答会保存在这里。</div>';
    return;
  }
  list.innerHTML = READING_QUIZ_HISTORY.slice(0, 10).map(attempt => `
    <details class="history-quiz-item">
      <summary>
        <span>
          <b>${escapeHtml(attempt.articleTitle || '阅读理解')}</b>
          <small>${new Date(attempt.date).toLocaleString()}</small>
        </span>
        <strong>${Number(attempt.correct || 0)} / ${Number(attempt.total || 0)}</strong>
      </summary>
      <div class="history-quiz-answers">
        ${(attempt.items || []).map((item, index) => `
          <div class="${item.correct ? 'is-correct' : 'is-wrong'}">
            <b>${index + 1}. ${escapeHtml(item.prompt || '')}</b>
            <span>你的答案：${escapeHtml(item.selected || '未作答')}</span>
            ${item.correct ? '' : `<span>参考答案：${escapeHtml(item.answer || '')}</span>`}
          </div>
        `).join('')}
      </div>
    </details>
  `).join('');
}

async function restoreHistoryArticle(id){
  const item = READING_HISTORY.find(entry => entry.id === id);
  if(!item) return;
  document.getElementById('inputText').value = item.text || '';
  CURRENT_ARTICLE_TEXT = item.text || '';
  CURRENT_ARTICLE_URL = item.url || '';
  resetArticlePracticeState(articlePracticeKey(CURRENT_ARTICLE_TEXT));
  switchWorkspace('reading');
  await renderText();
}

function removeHistoryArticle(id){
  const item = READING_HISTORY.find(entry => entry.id === id);
  if(!item) return;
  confirmDeletion({
    title:'删除这条阅读记录？',
    message:'阅读记录将从学习历史中移除，生词本不会受到影响。',
    target:item.title || '未命名文章'
  }, ()=>{
    READING_HISTORY = READING_HISTORY.filter(entry => entry.id !== id);
    saveReadingHistory();
    renderReadingHistory();
    renderDailyPlan();
  });
}

function clearReadingHistory(){
  if(!READING_HISTORY.length) return;
  confirmDeletion({
    title:'清空全部阅读历史？',
    message:'全部阅读记录都会被删除，生词本不会受到影响。',
    target:`共 ${READING_HISTORY.length} 条记录`,
    confirmLabel:'确认清空'
  }, ()=>{
    READING_HISTORY = [];
    saveReadingHistory();
    renderReadingHistory();
    renderDailyPlan();
  });
}

function sourceLevelTokens(sourceLevel){
  const levels = String(sourceLevel || '').match(/N[1-6]/g) || [];
  if(levels.length < 2 || !String(sourceLevel || '').includes('-')) return levels;
  const order = ['N6', 'N5', 'N4', 'N3', 'N2', 'N1'];
  const start = order.indexOf(levels[0]);
  const end = order.indexOf(levels[1]);
  if(start < 0 || end < 0) return levels;
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  return order.slice(from, to + 1);
}

function sourceLevelMatches(filter, sourceLevel){
  if(!filter || filter === '全部') return true;
  return sourceLevelTokens(sourceLevel).includes(filter);
}

function sourceTypeMatches(filter, source){
  if(!filter || filter === '全部') return true;
  return source?.category === filter || source?.type?.includes(filter) || source?.traits?.some(trait => trait.includes(filter));
}

function internalReadingMaterial(material, sortIndex = 0){
  const [titleJa, ...titleZhParts] = String(material?.title || '').split('——');
  return {
    ...material,
    titleJa:String(titleJa || material?.title || '').trim(),
    titleZh:titleZhParts.join('——').trim(),
    topics:[String(material?.topic || '生活')],
    sourceKind:'internal',
    sourceFilter:'站内短文',
    sourceLabel:'Yumeru 站内短文',
    sourceUrl:'',
    contentItemId:null,
    effectiveAt:null,
    expiresAt:null,
    sortIndex
  };
}

function officialFeedReadingMaterial(item){
  const topics = Array.isArray(item?.topics) && item.topics.length ? item.topics : ['新闻'];
  return {
    id:`official:${item.id}`,
    contentItemId:item.id,
    level:item.learning?.recommendedLevel || 'N3',
    topic:topics[0] || '新闻',
    topics,
    title:`${item.learning?.titleJa || item.titleJa || ''} —— ${item.titleZh || ''}`,
    titleJa:item.learning?.titleJa || item.titleJa || '',
    titleZh:item.titleZh || '',
    excerpt:item.oneLineConclusionZh || item.summaryZh || '',
    minutes:item.learning?.estimatedMinutes || 4,
    words:String(item.learning?.textJa || '').length,
    progress:0,
    text:item.learning?.textJa || '',
    sourceKind:'official',
    sourceFilter:'官方资讯',
    sourceLabel:item.sourceOrganization || '官方机构',
    sourceUrl:item.sourceUrl || '',
    sourceLinks:Array.isArray(item.sourceLinks) ? item.sourceLinks : [],
    sourceLinkPolicy:item.sourceLinkPolicy || 'article_specific',
    contentType:item.contentType || 'news',
    sourcePublishedAt:item.dates?.sourcePublishedAt || null,
    effectiveAt:item.dates?.effectiveAt || null,
    expiresAt:item.dates?.expiresAt || null,
    lastVerifiedAt:item.dates?.lastVerifiedAt || null
  };
}

function readingMaterialTime(value){
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
}

function readingMaterialPriority(material){
  if(material.sourceKind !== 'official') return 3;
  if(material.contentType === 'alert' && material.expiresAt && readingMaterialTime(material.expiresAt) > Date.now()) return 0;
  if(material.contentType === 'news' || material.contentType === 'guide') return 1;
  return 2;
}

function compareReadingMaterials(a, b){
  const priorityDiff = readingMaterialPriority(a) - readingMaterialPriority(b);
  if(priorityDiff) return priorityDiff;
  if(a.sourceKind === 'official' && b.sourceKind === 'official'){
    if(a.contentType === 'alert' && b.contentType === 'alert'){
      return readingMaterialTime(a.expiresAt) - readingMaterialTime(b.expiresAt);
    }
    const aDate = readingMaterialTime(a.sourcePublishedAt || a.effectiveAt || a.lastVerifiedAt);
    const bDate = readingMaterialTime(b.sourcePublishedAt || b.effectiveAt || b.lastVerifiedAt);
    return bDate - aDate;
  }
  return Number(a.sortIndex || 0) - Number(b.sortIndex || 0);
}

function getUnifiedReadingMaterials(){
  const internal = GRADED_READING_MATERIALS.map((material, index)=>internalReadingMaterial(material, index));
  const official = (window.getContentFeedItems?.() || []).map(officialFeedReadingMaterial);
  return [...official, ...internal].sort(compareReadingMaterials);
}

function gradedMaterialMatches(material){
  const levelOk = ACTIVE_GRADED_LEVEL === '全部' || material.level === ACTIVE_GRADED_LEVEL;
  const topics = Array.isArray(material.topics) ? material.topics : [material.topic].filter(Boolean);
  const topicOk = ACTIVE_GRADED_TOPIC === '全部' || topics.includes(ACTIVE_GRADED_TOPIC);
  const sourceOk = ACTIVE_GRADED_SOURCE === '全部' || material.sourceFilter === ACTIVE_GRADED_SOURCE;
  return levelOk && topicOk && sourceOk;
}

function setGradedLevelFilter(level){
  ACTIVE_GRADED_LEVEL = GRADED_LEVEL_FILTERS.includes(level) ? level : '全部';
  renderGradedReadingMaterials();
}

function setGradedTopicFilter(topic){
  ACTIVE_GRADED_TOPIC = GRADED_TOPIC_FILTERS.includes(topic) ? topic : '全部';
  renderGradedReadingMaterials();
}

function setGradedSourceFilter(source){
  ACTIVE_GRADED_SOURCE = GRADED_SOURCE_FILTERS.includes(source) ? source : '全部';
  renderGradedReadingMaterials();
}

function applyGradedQuickFilter(level, topic, source = '全部'){
  ACTIVE_GRADED_LEVEL = GRADED_LEVEL_FILTERS.includes(level) ? level : '全部';
  ACTIVE_GRADED_TOPIC = GRADED_TOPIC_FILTERS.includes(topic) ? topic : '全部';
  ACTIVE_GRADED_SOURCE = GRADED_SOURCE_FILTERS.includes(source) ? source : '全部';
  renderGradedReadingMaterials();
}

function clearDiscoverFilters(){
  ACTIVE_GRADED_LEVEL = '全部';
  ACTIVE_GRADED_TOPIC = '全部';
  ACTIVE_GRADED_SOURCE = '全部';
  renderGradedReadingMaterials();
  requestAnimationFrame(()=>document.getElementById('gradedMaterialGrid')?.scrollIntoView({behavior:'smooth', block:'start'}));
}

function clearSourceFilters(){
  ACTIVE_SOURCE_LEVEL = '全部';
  ACTIVE_SOURCE_TYPE = '全部';
  renderSourceDirectory();
  requestAnimationFrame(()=>document.getElementById('sourceDirectory')?.scrollIntoView({behavior:'smooth', block:'start'}));
}

function gradedMaterialDisplayTitle(title){
  return String(title || '').split('——')[0].trim();
}

function materialLevelClass(level){
  return `level-${String(level || '').toLowerCase()}`;
}

function materialTopicClass(topic){
  const key = {
    新闻:'news',
    科技:'tech',
    生活:'life',
    就业:'career',
    留学:'study',
    考试:'exam',
    日语学习:'language',
    旅行:'travel',
    美食:'food',
    商业:'business'
  }[topic] || 'default';
  return `topic-${key}`;
}

function formatJapanDate(value, includeTime = false){
  if(!value || Number.isNaN(Date.parse(value))) return '';
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone:'Asia/Tokyo',
    month:'numeric',
    day:'numeric',
    ...(includeTime ? {hour:'2-digit', minute:'2-digit', hour12:false} : {})
  });
  return formatter.format(new Date(value)).replace('24:', '00:');
}

function materialTimingLabel(material){
  if(material.contentType === 'alert' && material.expiresAt){
    const label = formatJapanDate(material.expiresAt, true);
    return label ? `截止 ${label}（日本时间）` : '';
  }
  return formatJapanDate(material.sourcePublishedAt || material.effectiveAt || material.lastVerifiedAt, false);
}

function materialSourceLinks(material){
  if(material.sourceKind !== 'official') return [];
  const links = Array.isArray(material.sourceLinks) && material.sourceLinks.length
    ? material.sourceLinks
    : (material.sourceUrl ? [{label:'官方来源', url:material.sourceUrl}] : []);
  return links.filter(link=>readingQueueUrl(link?.url)).map(link=>({
    label:String(link.label || link.title || '官方来源').trim(),
    url:readingQueueUrl(link.url)
  }));
}

function renderGradedReadingMaterials(){
  const levelTarget = document.getElementById('gradedLevelFilters');
  const topicTarget = document.getElementById('gradedTopicFilters');
  const sourceTarget = document.getElementById('gradedSourceFilters');
  const quickTarget = document.getElementById('gradedQuickTags');
  const grid = document.getElementById('gradedMaterialGrid');
  const total = document.getElementById('gradedMaterialTotal');
  const allItems = getUnifiedReadingMaterials();
  if(total) total.textContent = String(allItems.length);
  if(levelTarget){
    levelTarget.innerHTML = `
      <select class="discover-filter-select discover-filter-select--refined" aria-label="JLPT等级" onchange="setGradedLevelFilter(this.value)">
        <option value="全部" ${ACTIVE_GRADED_LEVEL === '全部' ? 'selected' : ''}>JLPT等级</option>
        ${GRADED_LEVEL_FILTERS.map(level => `
          ${level === '全部' ? '' : `<option value="${escapeHtml(level)}" ${ACTIVE_GRADED_LEVEL === level ? 'selected' : ''}>${escapeHtml(level)}</option>`}
        `).join('')}
      </select>
    `;
  }
  if(topicTarget){
    topicTarget.innerHTML = `
      <select class="discover-filter-select discover-filter-select--refined" aria-label="题材" onchange="setGradedTopicFilter(this.value)">
        <option value="全部" ${ACTIVE_GRADED_TOPIC === '全部' ? 'selected' : ''}>题材</option>
        ${GRADED_TOPIC_FILTERS.map(topic => `
          ${topic === '全部' ? '' : `<option value="${escapeHtml(topic)}" ${ACTIVE_GRADED_TOPIC === topic ? 'selected' : ''}>${escapeHtml(topic)}</option>`}
        `).join('')}
      </select>
    `;
  }
  if(sourceTarget){
    sourceTarget.innerHTML = `
      <select class="discover-filter-select discover-filter-select--refined" aria-label="内容来源" onchange="setGradedSourceFilter(this.value)">
        <option value="全部" ${ACTIVE_GRADED_SOURCE === '全部' ? 'selected' : ''}>内容来源</option>
        ${GRADED_SOURCE_FILTERS.map(source => `
          ${source === '全部' ? '' : `<option value="${escapeHtml(source)}" ${ACTIVE_GRADED_SOURCE === source ? 'selected' : ''}>${escapeHtml(source)}</option>`}
        `).join('')}
      </select>
    `;
  }
  if(quickTarget){
    quickTarget.innerHTML = [
      ['全部', '全部', '官方资讯', '最新官方资讯'],
      ['N3', '考试', '官方资讯', 'N3 · 留学考试'],
      ['N3', '生活', '官方资讯', 'N3 · 日本生活'],
      ['N4', '新闻', '站内短文', 'N4 · 新闻速览']
    ].map(([level, topic, source, label]) => `
      <button type="button" class="${ACTIVE_GRADED_LEVEL === level && ACTIVE_GRADED_TOPIC === topic && ACTIVE_GRADED_SOURCE === source ? 'active' : ''}" onclick="applyGradedQuickFilter('${level}', '${topic}', '${source}')" aria-pressed="${ACTIVE_GRADED_LEVEL === level && ACTIVE_GRADED_TOPIC === topic && ACTIVE_GRADED_SOURCE === source ? 'true' : 'false'}"><span></span>${escapeHtml(label)}</button>
    `).join('');
  }
  if(!grid) return;
  const items = allItems.filter(gradedMaterialMatches);
  const hasFilters = ACTIVE_GRADED_LEVEL !== '全部' || ACTIVE_GRADED_TOPIC !== '全部' || ACTIVE_GRADED_SOURCE !== '全部';
  const summary = document.getElementById('gradedMaterialSummary');
  const clearButton = document.getElementById('gradedClearFiltersButton');
  if(summary){
    summary.innerHTML = hasFilters
      ? `显示 ${items.length} / <span id="gradedMaterialTotal">${allItems.length}</span> 篇`
      : `共 <span id="gradedMaterialTotal">${allItems.length}</span> 篇素材`;
  }
  if(clearButton) clearButton.hidden = !hasFilters;
  grid.innerHTML = items.length ? items.map(material => {
    const topics = (material.topics || [material.topic]).filter(Boolean).slice(0, 2);
    const timing = materialTimingLabel(material);
    const links = materialSourceLinks(material);
    const officialTag = material.sourceKind === 'official' ? '<span class="material-source-kind">官方</span>' : '';
    const linkMarkup = links.length ? `<span class="graded-card-links">${links.map(link=>`<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${escapeHtml(link.label)}</a>`).join('')}</span>` : '';
    return `
      <article class="graded-material-card ${material.sourceKind === 'official' ? 'is-official' : 'is-internal'}" onclick="loadGradedReadingMaterial('${escapeHtml(material.id)}')" tabindex="0" role="button" aria-label="阅读 ${escapeHtml(material.titleJa || material.title)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();loadGradedReadingMaterial('${escapeHtml(material.id)}')}">
        <div class="graded-card-top">
          <span class="material-level ${materialLevelClass(material.level)}">${escapeHtml(material.level)}</span>
          ${topics.map(topic => `<span class="material-topic ${materialTopicClass(topic)}">${escapeHtml(topic)}</span>`).join('')}
          ${officialTag}
        </div>
        <h3 lang="ja">${escapeHtml(material.titleJa || gradedMaterialDisplayTitle(material.title))}</h3>
        ${material.titleZh ? `<p class="graded-material-subtitle">${escapeHtml(material.titleZh)}</p>` : ''}
        <div class="graded-card-meta">
          <span>${escapeHtml(material.sourceLabel || 'Yumeru')}</span>
          <span>${escapeHtml(material.minutes)} 分钟</span>
          ${timing ? `<span>${escapeHtml(timing)}</span>` : ''}
          ${linkMarkup}
        </div>
      </article>
    `;
  }).join('') : '<div class="source-empty-state">暂时没有匹配素材。换一个等级、题材或来源试试。</div>';
}

function loadGradedReadingMaterial(id){
  const material = getUnifiedReadingMaterials().find(item => item.id === id);
  if(!material) return;
  if(material.sourceKind === 'official'){
    Promise.resolve(window.startContentFeedItem?.(material.contentItemId)).then(opened=>{
      if(!opened) showToast('这篇官方资讯暂时无法加载，请稍后重试。', 'warning');
    });
    return;
  }
  const input = document.getElementById('inputText');
  if(input) input.value = material.text;
  clearActiveReadingQueueItem();
  CURRENT_ARTICLE_URL = '';
  safeStorage.setItem('current_article_source_title', material.title);
  switchWorkspace('reading');
  analyzeSourceInput();
}

document.addEventListener('content-feed:updated', ()=>{
  renderGradedReadingMaterials();
});

function recommendedSourceForLevel(source, recommended){
  if(!recommended) return false;
  return sourceLevelMatches(recommended, source.level);
}

function sourceIconSvg(){
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17 17 7"></path>
      <path d="M9 7h8v8"></path>
      <path d="M17 17v3H4V7h3"></path>
    </svg>
  `;
}

function sourceCategoryIconSvg(source){
  const text = `${source?.title || ''} ${source?.type || ''}`.toLowerCase();
  if(text.includes('nhk') || text.includes('新闻') || text.includes('news')){
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h12v14H5V5Z"></path>
        <path d="M17 8h2.5v9a2 2 0 0 1-2 2H17"></path>
        <path d="M8 9h6M8 12h6M8 15h4"></path>
      </svg>
    `;
  }
  if(text.includes('生活') || text.includes('くらし') || text.includes('つながる')){
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z"></path>
        <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"></path>
        <path d="M8 7h2M15 7h2"></path>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h9l4 4v14H6V3Z"></path>
      <path d="M15 3v5h4M9 12h7M9 16h7"></path>
    </svg>
  `;
}

function renderSourceLevelTabs(){
  const target = document.getElementById('sourceLevelTabs');
  if(!target) return;
  target.innerHTML = SOURCE_LEVEL_FILTERS.map(level => `
    <option value="${escapeHtml(level)}" ${ACTIVE_SOURCE_LEVEL === level ? 'selected' : ''}>${escapeHtml(level)}</option>
  `).join('');
  target.value = ACTIVE_SOURCE_LEVEL;
}

function renderSourceTypeTabs(){
  const target = document.getElementById('sourceTypeTabs');
  if(!target) return;
  target.innerHTML = SOURCE_TYPE_FILTERS.map(type => `
    <option value="${escapeHtml(type)}" ${ACTIVE_SOURCE_TYPE === type ? 'selected' : ''}>${escapeHtml(type)}</option>
  `).join('');
  target.value = ACTIVE_SOURCE_TYPE;
}

function setSourceLevelFilter(level){
  ACTIVE_SOURCE_LEVEL = SOURCE_LEVEL_FILTERS.includes(level) ? level : '全部';
  renderSourceDirectory();
}

function setSourceTypeFilter(type){
  ACTIVE_SOURCE_TYPE = SOURCE_TYPE_FILTERS.includes(type) ? type : '全部';
  renderSourceDirectory();
}

function renderSourceRecommendations(){
  const list = document.getElementById('sourceRecommendationList');
  const title = document.getElementById('sourceRecommendationTitle');
  if(!list) return;
  const level = ACTIVE_SOURCE_LEVEL || 'N5';
  const items = SOURCE_RECOMMENDATIONS[level] || SOURCE_RECOMMENDATIONS.N5;
  if(title) title.textContent = `今日 ${level} 阅读灵感`;
  list.innerHTML = items.map((item, index) => `
    <article class="source-recommendation-card">
      <span class="source-recommendation-index">${index + 1}</span>
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.detail)}</p>
        <span>${escapeHtml(item.source)}</span>
      </div>
      <button class="icon-btn source-open-btn" onclick="openRecommendedSource('${item.url}')" aria-label="打开 ${escapeHtml(item.title)}">
        ${sourceIconSvg()}
      </button>
    </article>
  `).join('');
}

function sourceDirectoryCard(source, recommended){
  return `
    <article class="source-directory-item ${source.official ? 'is-official' : ''} ${recommendedSourceForLevel(source, recommended) ? 'recommended' : ''}" onclick="openRecommendedSource('${source.url}')" tabindex="0" role="link" aria-label="访问 ${escapeHtml(source.title)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openRecommendedSource('${source.url}')}">
      <div class="source-directory-icon ${source.official ? 'is-purple' : source.category === '新闻' ? 'is-red' : source.category === '生活' ? 'is-purple' : source.category === '旅行' ? 'is-orange' : 'is-green'}" aria-hidden="true">
        ${escapeHtml(source.icon || (source.title.includes('NHK') ? 'N' : source.category === '生活' ? '読' : source.category === '旅行' ? '旅' : '経'))}
      </div>
      <div class="source-directory-copy">
        <h3>${escapeHtml(source.title)}</h3>
        <p>${escapeHtml(source.level)} · ${escapeHtml(source.category)} / ${escapeHtml((source.traits || [source.type]).slice(0, 2).join(' / ') || source.type)}</p>
      </div>
    </article>
  `;
}

function renderSourceDirectory(){
  const target = document.getElementById('sourceDirectory');
  if(!target) return;
  renderGradedReadingMaterials();
  renderSourceLevelTabs();
  renderSourceTypeTabs();
  const visibleSources = READING_SOURCES.filter(source => !source.caution);
  const recommended = (safeStorage.getItem('reading_level_result') || '').split('｜')[0] || '';
  const sources = visibleSources.filter(source => sourceLevelMatches(ACTIVE_SOURCE_LEVEL, source.level) && sourceTypeMatches(ACTIVE_SOURCE_TYPE, source));
  const hasFilters = ACTIVE_SOURCE_LEVEL !== '全部' || ACTIVE_SOURCE_TYPE !== '全部';
  const sourceSummary = document.getElementById('externalSourceSummary');
  const clearButton = document.getElementById('externalSourceClearButton');
  if(sourceSummary){
    sourceSummary.innerHTML = hasFilters
      ? `显示 ${sources.length} / <span id="externalSourceTotal">${visibleSources.length}</span> 个来源`
      : `<span id="externalSourceTotal">${visibleSources.length}</span> 个来源`;
  }
  if(clearButton) clearButton.hidden = !hasFilters;
  const officialSources = sources.filter(source => source.official);
  const mediaSources = sources.filter(source => !source.official);
  const groups = [
    ['官方机构', '用于核对考试、留学、在留和生活制度的原始信息', officialSources],
    ['阅读与媒体来源', '用于寻找新闻、生活、旅行、商业和兴趣类日语文章', mediaSources]
  ].filter(([, , items]) => items.length);
  target.innerHTML = groups.length ? groups.map(([title, description, items]) => `
    <section class="source-directory-group">
      <div class="source-directory-group-head">
        <h3>${escapeHtml(title)}</h3>
        <span>${escapeHtml(description)}</span>
      </div>
      <div class="source-directory-group-grid">
        ${items.map(source=>sourceDirectoryCard(source, recommended)).join('')}
      </div>
    </section>
  `).join('') : '<div class="source-empty-state">这个等级暂时没有对应类型。可以换一个类型，或使用当前等级示例开始阅读。</div>';
  renderSourceRecommendations();
}

function loadSourceQuickRead(){
  const visibleSources = READING_SOURCES.filter(item => !item.caution);
  const source = visibleSources.find(item => sourceLevelMatches(ACTIVE_SOURCE_LEVEL, item.level) && sourceTypeMatches(ACTIVE_SOURCE_TYPE, item))
    || visibleSources.find(item => sourceLevelMatches(ACTIVE_SOURCE_LEVEL, item.level))
    || visibleSources[0];
  const title = source?.title || '推荐资料';
  const level = ACTIVE_SOURCE_LEVEL || 'N5';
  const text = level === 'N5'
    ? '私は毎朝七時に起きます。朝ごはんを食べてから、学校に行きます。今日は友達と一緒に図書館で勉強する予定です。'
    : level === 'N4'
      ? '週末、友達と新しい町へ行きました。駅の近くには小さな店が多く、地元の人に人気の食べ物を楽しむことができました。'
      : '最近、若い人の働き方が少しずつ変わっています。会社に通うだけでなく、自宅やカフェで仕事をする人も増え、生活と仕事のバランスを考える機会が多くなりました。';
  document.getElementById('inputText').value = text;
  clearActiveReadingQueueItem();
  safeStorage.setItem('current_article_source_title', `${title} 示例`);
  switchWorkspace('reading');
  analyzeSourceInput();
}

function openSourceDirectoryPanel(level){
  const storedLevel = (safeStorage.getItem('reading_level_result') || '').split('｜')[0] || '';
  const targetLevel = SOURCE_LEVEL_FILTERS.includes(level) ? level : storedLevel;
  if(SOURCE_LEVEL_FILTERS.includes(targetLevel)){
    ACTIVE_SOURCE_LEVEL = targetLevel;
    renderSourceDirectory();
  }
  switchWorkspace('discover');
  document.querySelector('.source-directory-panel')?.scrollIntoView({behavior:'smooth', block:'start'});
}

function useSourceUrl(encodedUrl){
  clearActiveReadingQueueItem();
  const url = decodeURIComponent(encodedUrl);
  document.getElementById('inputText').value = url;
  switchWorkspace('reading');
  editSourceText();
  setImportStatus('已填入推荐来源链接。确认是具体文章页后，点击「开始阅读」。');
}

function renderLevelTest(){
  const target = document.getElementById('levelTest');
  if(!target) return;
  const index = Math.min(LEVEL_TEST_STATE.index, LEVEL_TEST_QUESTIONS.length - 1);
  const item = LEVEL_TEST_QUESTIONS[index];
  const selected = LEVEL_TEST_STATE.answers[index];
  target.innerHTML = `
    <section class="level-question level-question-single">
      <div class="level-question-progress">
        <span>${index + 1} / ${LEVEL_TEST_QUESTIONS.length}</span>
        <b>${escapeHtml(item.level)}</b>
      </div>
      <h2>${escapeHtml(item.q)}</h2>
      <div class="level-options">
        ${item.options.map((option, optionIndex) => `
          <label class="${selected === optionIndex ? 'selected' : ''}">
            <input type="radio" name="level-current" value="${optionIndex}" ${selected === optionIndex ? 'checked' : ''}>
            <span>${escapeHtml(option)}</span>
          </label>
        `).join('')}
      </div>
      <div class="level-question-actions">
        <button class="btn-secondary" type="button" onclick="prevLevelQuestion()" ${index === 0 ? 'disabled' : ''}>上一题</button>
        <button class="btn-primary" type="button" onclick="nextLevelQuestion()">${index === LEVEL_TEST_QUESTIONS.length - 1 ? '查看结果' : '下一题'}</button>
      </div>
    </section>
  `;
}

function startLevelTest(){
  LEVEL_TEST_STATE.index = 0;
  LEVEL_TEST_STATE.answers = [];
  renderLevelTest();
  const actions = document.getElementById('levelScoreActions');
  if(actions) actions.style.display = 'none';
  const result = document.getElementById('levelResult');
  if(result) result.textContent = '';
  document.getElementById('levelTest')?.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function currentLevelChoice(){
  const checked = document.querySelector('input[name="level-current"]:checked');
  return checked ? Number(checked.value) : null;
}

function nextLevelQuestion(){
  const selected = currentLevelChoice();
  if(selected === null){
    showToast('先选择一个答案', 'error');
    return;
  }
  LEVEL_TEST_STATE.answers[LEVEL_TEST_STATE.index] = selected;
  if(LEVEL_TEST_STATE.index < LEVEL_TEST_QUESTIONS.length - 1){
    LEVEL_TEST_STATE.index += 1;
    renderLevelTest();
    return;
  }
  scoreLevelTest();
}

function prevLevelQuestion(){
  const selected = currentLevelChoice();
  if(selected !== null) LEVEL_TEST_STATE.answers[LEVEL_TEST_STATE.index] = selected;
  LEVEL_TEST_STATE.index = Math.max(0, LEVEL_TEST_STATE.index - 1);
  renderLevelTest();
}

function scoreLevelTest(){
  const answered = LEVEL_TEST_STATE.answers.filter(answer => Number.isInteger(answer)).length;
  if(answered < LEVEL_TEST_QUESTIONS.length){
    document.getElementById('levelResult').textContent = `还有 ${LEVEL_TEST_QUESTIONS.length - answered} 题未完成。`;
    return;
  }
  let score = 0;
  LEVEL_TEST_QUESTIONS.forEach((item, index)=>{
    if(LEVEL_TEST_STATE.answers[index] === item.answer) score += 1;
  });
  const level = score <= 2 ? 'N5' : score <= 4 ? 'N4' : score <= 6 ? 'N3' : score <= 8 ? 'N2' : 'N1';
  const result = `${level}｜答对 ${score}/${answered} 题`;
  safeStorage.setItem('reading_level_result', result);
  ACTIVE_SOURCE_LEVEL = level;
  showLevelResult({level, score, total: answered});
  renderSourceDirectory();
}

function showLevelResult(result){
  const payload = typeof result === 'string'
    ? {
        level: result.split('｜')[0] || result,
        score: Number((result.match(/答对\s*(\d+)/) || [])[1] || 0),
        total: Number((result.match(/\/(\d+)/) || [])[1] || LEVEL_TEST_QUESTIONS.length)
      }
    : result;
  const level = payload.level || 'N5';
  const score = Number(payload.score || 0);
  const total = Number(payload.total || LEVEL_TEST_QUESTIONS.length);
  const wrong = Math.max(0, total - score);
  const badge = document.getElementById('levelResultBadge');
  const box = document.getElementById('levelResult');
  if(badge) badge.textContent = level;
  if(box) box.innerHTML = `
    <section class="level-result-card" aria-label="水平测试结果">
      <span class="module-kicker">测试结果</span>
      <h2>你的阅读水平大约在 ${escapeHtml(level)}</h2>
      <div class="level-result-stats">
        <div><b>${score}</b><span>答对</span></div>
        <div><b>${wrong}</b><span>答错</span></div>
        <div><b>${total}</b><span>总题数</span></div>
      </div>
      <div class="level-result-actions">
        <button class="btn-primary" type="button" onclick="switchWorkspace('reading')">开始阅读</button>
        <button class="btn-secondary" type="button" onclick="openSourceDirectoryPanel('${escapeHtml(level)}')">先看推荐资料</button>
      </div>
    </section>
  `;
}

function resetLevelTest(){
  LEVEL_TEST_STATE.index = 0;
  LEVEL_TEST_STATE.answers = [];
  safeStorage.removeItem('reading_level_result');
  document.getElementById('levelResultBadge').textContent = '未测试';
  document.getElementById('levelResult').textContent = '';
  const test = document.getElementById('levelTest');
  if(test) test.innerHTML = '';
  const actions = document.getElementById('levelScoreActions');
  if(actions) actions.style.display = 'none';
  renderSourceDirectory();
}

// ---------------- 语法本 / 语法收藏 ----------------
let openGrammarTitle = null;

const GRAMMAR_HOT_QUERIES = ['て形', 'ながら', '敬语', 'に違いない', 'ざるを得ない', '次第'];

function grammarBookKey(title){
  return String(title || '').trim().toLowerCase();
}

function normalizeGrammarBookItem(item){
  if(!item || typeof item !== 'object') return null;
  const title = String(item.title || '').trim();
  if(!title) return null;
  const examples = Array.isArray(item.examples)
    ? item.examples.map(ex => ({
      jp:String(ex?.jp || ex || '').trim(),
      cn:String(ex?.cn || '').trim()
    })).filter(ex => ex.jp || ex.cn).slice(0, 5)
    : [];
  return {
    title,
    level:String(item.level || '待整理').trim() || '待整理',
    sub:String(item.sub || item.source || '我的收藏').trim(),
    note:String(item.note || item.explain || '').trim(),
    examples,
    pitfall:String(item.pitfall || '').trim(),
    source:String(item.source || '手动添加').trim(),
    savedAt:Number(item.savedAt || Date.now())
  };
}

function loadGrammarBook(){
  try{
    const items = JSON.parse(safeStorage.getItem('reading_grammar_book') || '[]');
    return Array.isArray(items) ? items.map(normalizeGrammarBookItem).filter(Boolean).slice(0, 100) : [];
  }catch{
    return [];
  }
}

function saveGrammarBook(){
  safeStorage.setItem('reading_grammar_book', JSON.stringify(GRAMMAR_BOOK.slice(0, 100)));
}

function isGrammarSaved(title){
  const key = grammarBookKey(title);
  return GRAMMAR_BOOK.some(item => grammarBookKey(item.title) === key);
}

function upsertGrammarBookItem(rawItem){
  const item = normalizeGrammarBookItem(rawItem);
  if(!item) return false;
  const key = grammarBookKey(item.title);
  GRAMMAR_BOOK = [
    item,
    ...GRAMMAR_BOOK.filter(saved => grammarBookKey(saved.title) !== key)
  ].slice(0, 100);
  saveGrammarBook();
  recordPracticeResult('grammar');
  renderGrammarBook();
  renderGrammar();
  return true;
}

function grammarPointToBookItem(point){
  return {
    title:point.title,
    level:point.level || '待整理',
    sub:point.sub || '语法词典',
    note:point.explain || '',
    examples:point.examples || [],
    pitfall:point.pitfall || '',
    source:'语法词典',
    savedAt:Date.now()
  };
}

function saveGrammarPoint(encodedTitle, event){
  event?.stopPropagation();
  let title = encodedTitle;
  try{ title = decodeURIComponent(encodedTitle); }catch{}
  const point = GRAMMAR_POINTS.find(item => item.title === title);
  if(!point){
    showToast('没有找到这个语法点。', 'warning');
    return;
  }
  if(isGrammarSaved(point.title)){
    showToast('这个语法已经在语法本里。', 'info');
    return;
  }
  upsertGrammarBookItem(grammarPointToBookItem(point));
  showToast('已加入语法本。', 'success');
}

function addCustomGrammarNote(){
  const titleInput = document.getElementById('grammarCustomTitle');
  const levelInput = document.getElementById('grammarCustomLevel');
  const noteInput = document.getElementById('grammarCustomNote');
  const title = titleInput?.value.trim() || '';
  const note = noteInput?.value.trim() || '';
  if(!title){
    showToast('先写一个语法点名称。', 'warning');
    titleInput?.focus();
    return;
  }
  upsertGrammarBookItem({
    title,
    level:levelInput?.value.trim() || '待整理',
    sub:'手动添加',
    note,
    examples:note ? [{ jp:note, cn:'' }] : [],
    source:'手动添加',
    savedAt:Date.now()
  });
  if(titleInput) titleInput.value = '';
  if(levelInput) levelInput.value = '';
  if(noteInput) noteInput.value = '';
  showToast('已加入语法本。', 'success');
}

function removeGrammarNote(encodedTitle){
  let title = encodedTitle;
  try{ title = decodeURIComponent(encodedTitle); }catch{}
  confirmDeletion({
    title:'删除这条语法收藏？',
    message:'这条语法笔记会从语法本中移除，操作无法撤销。',
    target:title,
    confirmLabel:'确认删除'
  }, ()=>{
    GRAMMAR_BOOK = GRAMMAR_BOOK.filter(item => item.title !== title);
    saveGrammarBook();
    renderGrammarBook();
    renderGrammar();
    showToast('语法收藏已删除。', 'success');
  });
}

function renderGrammarBook(){
  const count = document.getElementById('grammarBookCount');
  if(count) count.textContent = GRAMMAR_BOOK.length;
  const list = document.getElementById('grammarBookList');
  if(!list) return;
  if(!GRAMMAR_BOOK.length){
    list.innerHTML = '<div class="grammar-empty">还没有收藏语法。可以搜索语法点后收藏，也可以从阅读页选中句子保存。</div>';
    return;
  }
  list.innerHTML = GRAMMAR_BOOK.map(item => `
    <article class="grammar-book-card">
      <div class="grammar-book-card-head">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <div class="grammar-book-meta">
            <span>${escapeHtml(item.level)}</span>
            <span>${escapeHtml(item.source)}</span>
          </div>
        </div>
        <button class="icon-btn" type="button" onclick="removeGrammarNote('${encodeURIComponent(item.title)}')" data-tooltip="删除语法收藏" aria-label="删除语法收藏">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>
        </button>
      </div>
      ${item.sub ? `<p class="grammar-book-sub">${escapeHtml(item.sub)}</p>` : ''}
      ${item.note ? `<p class="grammar-book-note">${escapeHtml(item.note)}</p>` : ''}
      ${item.examples.length ? `<div class="grammar-book-examples">${item.examples.map(ex => `
        <div class="grammar-book-example">
          ${ex.jp ? `<div class="jp">${escapeHtml(ex.jp)}</div>` : ''}
          ${ex.cn ? `<div class="cn">${escapeHtml(ex.cn)}</div>` : ''}
        </div>
      `).join('')}</div>` : ''}
    </article>
  `).join('');
}

function grammarRecentSearches(){
  try{
    const items = JSON.parse(safeStorage.getItem('grammar_recent_searches') || '[]');
    return Array.isArray(items) ? items.filter(Boolean).slice(0, 6) : [];
  }catch{
    return [];
  }
}

function saveGrammarRecentSearch(keyword){
  const value = String(keyword || '').trim();
  if(!value) return;
  const recent = grammarRecentSearches().filter(item => item !== value);
  recent.unshift(value);
  safeStorage.setItem('grammar_recent_searches', JSON.stringify(recent.slice(0, 6)));
}

function grammarSuggestionButton(label){
  return `<button class="grammar-suggestion" type="button" onclick="searchGrammarSuggestion('${encodeURIComponent(label)}')">${escapeHtml(label)}</button>`;
}

function renderGrammarSuggestions(){
  const grid = document.getElementById('grammarGrid');
  if(!grid) return;
  const recent = grammarRecentSearches();
  grid.innerHTML = `
    <div class="grammar-suggestion-panel">
      <section class="grammar-suggestion-section" aria-label="热门查阅">
        <h2>热门查阅</h2>
        <div class="grammar-suggestion-list">
          ${GRAMMAR_HOT_QUERIES.map(grammarSuggestionButton).join('')}
        </div>
      </section>
      ${recent.length ? `
      <section class="grammar-suggestion-section" aria-label="最近搜索">
        <h2>最近搜索</h2>
        <div class="grammar-suggestion-list">
          ${recent.map(grammarSuggestionButton).join('')}
        </div>
      </section>` : ''}
    </div>
  `;
}

function searchGrammarSuggestion(encodedKeyword){
  let keyword = encodedKeyword;
  try{ keyword = decodeURIComponent(encodedKeyword); }catch{}
  const input = document.getElementById('grammarSearch');
  if(input){
    input.value = keyword;
    input.focus();
  }
  saveGrammarRecentSearch(keyword);
  renderGrammar();
}

function handleGrammarSearchKey(event){
  if(event.key !== 'Enter') return;
  const value = event.currentTarget?.value?.trim();
  if(value) saveGrammarRecentSearch(value);
}

function renderGrammar(){
  renderGrammarBook();
  const keyword = document.getElementById('grammarSearch')?.value.trim().toLowerCase() || '';
  if(!keyword){
    renderGrammarSuggestions();
    return;
  }
  if(!GRAMMAR_POINTS.length){
    const grid = document.getElementById('grammarGrid');
    if(grid) grid.innerHTML = '<div class="grammar-empty">语法数据还在加载。稍等一下，或先点一个热门语法试试。</div>';
    return;
  }
  const grid = document.getElementById('grammarGrid');
  if(!grid) return;
  const filtered = GRAMMAR_POINTS.filter(g =>
    g.title.toLowerCase().includes(keyword) || g.sub.toLowerCase().includes(keyword) || g.explain.toLowerCase().includes(keyword)
  );
  if(filtered.length===0){
    grid.innerHTML = '<div class="grammar-empty">没有找到匹配的语法点。换个关键词，或清空搜索查看热门查阅。</div>';
    return;
  }
  grid.innerHTML = filtered.map(g=>{
    const isOpen = openGrammarTitle === g.title;
    const saved = isGrammarSaved(g.title);
    const levelColor = g.level==='N5' ? 'var(--n5)' : g.level==='N4' ? 'var(--n4)' : 'var(--n3)';
    const levelBg = g.level==='N5' ? 'var(--n5-bg)' : g.level==='N4' ? 'var(--n4-bg)' : 'var(--n3-bg)';
    return `
      <div class="gpoint ${isOpen?'open':''}" role="button" tabindex="0" aria-expanded="${isOpen}" aria-label="${escapeHtml(g.title)}，${isOpen ? '收起' : '展开'}语法说明" onclick="toggleGrammar('${g.title.replace(/'/g,"\\'")}')" onkeydown="activateWordNode(event,this)">
        <div class="gpoint-head">
          <span class="gpoint-title">${g.title}</span>
          <span class="gpoint-actions">
            <span class="gpoint-level" style="color:${levelColor};background:${levelBg};">${g.level}</span>
            <button class="grammar-save-button ${saved ? 'is-saved' : ''}" type="button" onclick="saveGrammarPoint('${encodeURIComponent(g.title)}', event)">${saved ? '已收藏' : '收藏'}</button>
          </span>
        </div>
        <div class="gpoint-sub">${g.sub}</div>
        <div class="gpoint-body">
          <div class="explain">${g.explain}</div>
          ${g.examples.map(ex=>`<div class="gpoint-ex"><div class="jp">${ex.jp}</div><div class="cn">${ex.cn}</div></div>`).join('')}
          <div class="gpoint-pitfall"><b>中文母语者易踩坑:</b>${g.pitfall}</div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleGrammar(title){
  openGrammarTitle = openGrammarTitle === title ? null : title;
  renderGrammar();
}

function openOnboarding(){
  document.body.classList.remove('first-visit');
  switchWorkspace('reading');
  const banner = document.getElementById('onboardingBanner');
  banner?.classList.remove('is-hidden');
  banner?.scrollIntoView({behavior:'smooth', block:'start'});
}
function dismissOnboarding(){
  document.getElementById('onboardingBanner')?.classList.add('is-hidden');
  safeStorage.setItem('reading_onboarding_dismissed', '1');
}
function startOnboardingDemo(){
  switchWorkspace('reading');
  loadSample(true);
  dismissOnboarding();
  document.getElementById('output')?.scrollIntoView({ behavior:'smooth', block:'start' });
}
function startOnboardingTest(){
  dismissOnboarding();
  switchWorkspace('test');
  startLevelTest();
}
if(safeStorage.getItem('reading_onboarding_dismissed')) dismissOnboarding();

async function initializeApp(){
  loadReadingHistory();
  renderGrammar();
  renderSourceDirectory();
  renderPracticeSummary();
  renderPracticeReview();
  renderDailyPlan();
  initReadingFontSize();
  setInterfaceLanguage(safeStorage.getItem('interface_language') || 'zh', true);
  const savedLevelResult = safeStorage.getItem('reading_level_result');
  if(savedLevelResult) showLevelResult(savedLevelResult);
  setTokenizerStatus('', '');
  initTtsSettings();
  document.getElementById('useKuromoji')?.addEventListener('change', renderText);

  if('speechSynthesis' in window){
    populateVoiceOptions();
    window.speechSynthesis.onvoiceschanged = populateVoiceOptions;
  }
  document.getElementById('exportModal')?.addEventListener('click', event=>{
    if(event.target === event.currentTarget) closeExportModal();
  });
  document.getElementById('importPreviewModal')?.addEventListener('click', event=>{
    if(event.target === event.currentTarget) closeImportPreview();
  });
  document.getElementById('retellPermissionModal')?.addEventListener('click', event=>{
    if(event.target === event.currentTarget) closeRetellPermissionModal();
  });
  document.getElementById('readingDisplayModal')?.addEventListener('click', event=>{
    if(event.target === event.currentTarget) closeReadingDisplaySettings();
  });
  document.getElementById('deleteConfirmModal')?.addEventListener('click', event=>{
    if(event.target === event.currentTarget) closeDeleteConfirm();
  });
  document.getElementById('importPreviewText')?.addEventListener('input', updateImportPreviewSummary);
  document.getElementById('output')?.addEventListener('mouseup', handleReadingSelection);
  document.getElementById('output')?.addEventListener('keyup', handleReadingSelection);
  document.getElementById('output')?.addEventListener('touchend', handleReadingSelection, {passive:true});
  document.addEventListener('selectionchange', handleReadingSelection);
  document.addEventListener('mousedown', event=>{
    closeOpenVocabMenus(event.target);
    const tools = document.getElementById('selectionTools');
    const output = document.getElementById('output');
    const search = document.querySelector('.global-search');
    const ttsMenu = document.getElementById('ttsControlMenu');
    const analysisDetails = document.querySelector('.reader-tool-details[open]');
    if(analysisDetails && !analysisDetails.contains(event.target)) analysisDetails.open = false;
    if(ttsMenu?.classList.contains('active') && !ttsMenu.contains(event.target) && !event.target.closest('.reader-speech-tool')) hideTtsControlMenu();
    if(search?.contains(event.target)) return;
    if(tools?.contains(event.target) || output?.contains(event.target)) return;
    hideSelectionTools();
    const panel = document.getElementById('globalSearchResults');
    if(panel) panel.classList.remove('active');
  });
  document.addEventListener('keydown', event=>{
    if(event.key === 'Tab'){
      const root = activeDialogRoot();
      if(root) trapDialogFocus(event, root);
      return;
    }
    if(event.key === 'Escape'){
      if(closeTopLayer()) return;
      closeOpenVocabMenus();
      dismissSampleFlow();
      hideTtsControlMenu();
    }
  });
  window.addEventListener('resize', ()=>{ if(SAMPLE_FLOW_ACTIVE) renderSampleFlow(); });
  const shouldAskGuide = document.body.classList.contains('first-visit') && !safeStorage.getItem('reading_guide_prompt_seen');
  document.getElementById('heroGuidePrompt')?.classList.toggle('is-hidden', !shouldAskGuide);
  switchWorkspace(safeStorage.getItem('reading_workspace') || 'reading');
  renderTypingPractice();
  syncExportOptions();
  scheduleLearningDataHydration();
}

initializeApp();
