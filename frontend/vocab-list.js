/*
 * Yomeru vocabulary list, filters, panel, and edit dialog.
 *
 * Keep ordinary-script global names for index.html inline handlers and
 * lexical-vocab-integration.js edit compatibility.
 */

let VOCAB_FILTER = 'all';
let VOCAB_JLPT_FILTER = 'all';
let VOCAB_EDIT_TARGET = null;

function openVocabPanel() {
  document.getElementById('vocabPanelSlide').classList.add('active');
  syncVocabPanelData();
}

function closeVocabPanel() {
  document.getElementById('vocabPanelSlide').classList.remove('active');
}

function removeVocabIcon(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5h15"></path><path d="M9 6.5V4.2h6v2.3"></path><path d="M7 9v10.5h10V9"></path><path d="M10 11.5v5"></path><path d="M14 11.5v5"></path></svg>';
}

function syncVocabPanelData() {
  const vocab = getAllVocab();
  ['vocabCountPanel', 'vocabCountPage'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = vocab.length;
  });
  ['totalVocabCountPanel'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = vocab.length;
  });

  const vocabListPanel = document.getElementById('vocabListPanel');
  const vocabEmptyPanel = document.getElementById('vocabEmptyPanel');
  const listMarkup = vocab.map(v => `
      <li class="vocab-item">
        <div>
          <div class="vocab-word">${escapeHtml(v.word)}${vocabPracticeTag(v)}</div>
          <div class="vocab-meta">${escapeHtml(v.reading || '')}${v.reading && v.meaning ? ' · ' : ''}${escapeHtml(v.meaning || '')}</div>
        </div>
        <button class="vocab-remove" onclick="removeFromVocab('${encodeURIComponent(v.word)}')" title="移除" aria-label="移除 ${escapeHtml(v.word)}">${removeVocabIcon()}</button>
      </li>
    `).join('');

  if(vocab.length === 0) {
    if(vocabListPanel) vocabListPanel.style.display = 'none';
    if(vocabEmptyPanel) vocabEmptyPanel.style.display = 'block';
  } else {
    if(vocabListPanel) {
      vocabListPanel.style.display = 'block';
      vocabListPanel.innerHTML = listMarkup;
    }
    if(vocabEmptyPanel) vocabEmptyPanel.style.display = 'none';
  }

  const dueCount = vocab.filter(v => isDue(v)).length;
  ['dueCountPanel'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = dueCount;
  });
  const primaryAction = document.getElementById('vocabPrimaryAction');
  if(primaryAction){
    const label = !vocab.length ? '去阅读并收藏' : '闪卡复习';
    primaryAction.innerHTML = `
      <span class="vocab-primary-action-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M6 3.5h9.5l2.5 5v12H6v-17Z"></path><path d="M15.5 3.5v5H18"></path><path d="M9.2 13.2h5.6"></path><path d="M12 10.4V16"></path></svg>
      </span>
      <span>${label}</span>
    `;
    primaryAction.setAttribute('aria-label', label);
    primaryAction.dataset.tooltip = label;
    primaryAction.classList.toggle('btn-primary', !vocab.length || dueCount > 0);
    primaryAction.classList.toggle('btn-secondary', vocab.length > 0 && dueCount === 0);
  }
  refreshPracticeStatus();
  renderVocabPractice();
  renderDailyPlan();
}

function runVocabPrimaryAction(){
  const vocab = getAllVocab();
  if(!vocab.length){
    switchWorkspace('reading');
    document.getElementById('inputText')?.focus();
    return;
  }
  reviewAllVocab();
}

function vocabMatchesFilter(vocabItem, filter, now = Date.now()){
  const masteryKey = vocabMasteryKey(vocabItem, Number(vocabItem?.dueAt || 0) <= now);
  if(filter === 'due') return Number(vocabItem?.dueAt || 0) <= now;
  if(filter === 'weak') return masteryKey === 'weak';
  if(filter === 'unsure') return masteryKey === 'unsure';
  if(filter === 'practiced') return !!vocabItem?.lastPracticeAt;
  return true;
}

function vocabMeaningTone(vocabItem){
  const meaning = String(vocabItem?.meaning || '');
  return isSystemGeneratedMeaning(meaning) ? ' vocab-meaning-system' : '';
}

function filteredVocabForPage(){
  const keyword = (document.getElementById('vocabSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = ['all', 'weak', 'unsure', 'practiced'].includes(VOCAB_FILTER) ? VOCAB_FILTER : 'all';
  const jlptFilter = VOCAB_JLPT_FILTER || 'all';
  const sourceFilter = document.getElementById('vocabSourceFilter')?.value || 'all';
  const now = Date.now();
  return vocabData.filter(v=>{
    if(!vocabMatchesFilter(v, VOCAB_FILTER, now)) return false;
    if(statusFilter !== 'all' && vocabMasteryKey(v, Number(v?.dueAt || 0) <= now) !== statusFilter) return false;
    if(jlptFilter === 'ungraded' && normalizeVisibleVocabLevel(v.level)) return false;
    if(jlptFilter !== 'all' && jlptFilter !== 'ungraded' && normalizeVisibleVocabLevel(v.level) !== jlptFilter) return false;
    if(sourceFilter !== 'all' && encodeURIComponent(vocabSourceLabel(v)) !== sourceFilter) return false;
    if(!keyword) return true;
    const haystack = `${v.word || ''} ${v.reading || ''} ${v.meaning || ''} ${v.pos || ''} ${formatVisibleVocabLevel(v.level)} ${vocabSourceLabel(v)}`.toLowerCase();
    return haystack.includes(keyword);
  });
}

function setVocabFilter(filter){
  VOCAB_FILTER = ['all', 'due', 'weak', 'unsure', 'practiced'].includes(filter) ? filter : 'all';
  syncVocabHeaderFilters();
  document.querySelectorAll('.vocab-filter-tab').forEach(button=>{
    button.classList.toggle('active', button.dataset.filter === VOCAB_FILTER);
  });
  renderVocab();
}

function setVocabJlptFilter(level){
  VOCAB_JLPT_FILTER = ['all', 'N5', 'N4', 'N3', 'N2', 'N1', 'ungraded'].includes(level) ? level : 'all';
  syncVocabHeaderFilters();
  document.querySelectorAll('.vocab-level-filter').forEach(button=>{
    button.classList.toggle('active', button.dataset.level === VOCAB_JLPT_FILTER);
  });
  renderVocab();
}

function clearVocabFilters(){
  VOCAB_FILTER = 'all';
  VOCAB_JLPT_FILTER = 'all';
  const search = document.getElementById('vocabSearchInput');
  if(search) search.value = '';
  const source = document.getElementById('vocabSourceFilter');
  if(source) source.value = 'all';
  renderVocab();
}

function closeVocabFilterMenu(control){
  const menu = control instanceof HTMLElement ? control.closest('.vocab-filter-menu') : null;
  if(menu instanceof HTMLDetailsElement) menu.open = false;
}

function closeVocabManagementMenu(control){
  const menu = control instanceof HTMLElement ? control.closest('.vocab-management-menu') : null;
  if(menu instanceof HTMLDetailsElement) menu.open = false;
}

function closeOpenVocabMenus(exceptTarget = null){
  document.querySelectorAll('.vocab-filter-menu[open], .vocab-management-menu[open]').forEach(menu=>{
    if(exceptTarget instanceof Node && menu.contains(exceptTarget)) return;
    if(menu instanceof HTMLDetailsElement) menu.open = false;
  });
}

function syncVocabHeaderFilters(){
  const statusValue = ['all', 'weak', 'unsure', 'practiced'].includes(VOCAB_FILTER) ? VOCAB_FILTER : 'all';
  const jlptValue = VOCAB_JLPT_FILTER || 'all';
  document.querySelectorAll('.vocab-filter-menu-options [data-status]').forEach(button=>{
    const active = button.dataset.status === statusValue;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('.vocab-filter-menu-options [data-level]').forEach(button=>{
    const active = button.dataset.level === jlptValue;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderVocabFilterSummary(filteredCount){
  const active = document.getElementById('vocabActiveFilters');
  const clear = document.getElementById('vocabClearFilters');
  const count = document.getElementById('vocabFilteredCount');
  if(count) count.textContent = String(filteredCount);
  if(!active && !clear) return;
  const searchValue = (document.getElementById('vocabSearchInput')?.value || '').trim();
  const jlptValue = VOCAB_JLPT_FILTER || 'all';
  const statusLabels = {
    due:'到期',
    weak:'没记住',
    unsure:'有点犹豫',
    practiced:'已练过'
  };
  const chips = [];
  if(VOCAB_FILTER !== 'all') chips.push({label: statusLabels[VOCAB_FILTER] || VOCAB_FILTER, tone: VOCAB_FILTER});
  if(jlptValue !== 'all') chips.push({label: jlptValue === 'ungraded' ? '暂无参考等级' : jlptValue, tone: 'level'});
  if(searchValue) chips.push({label: `搜索: ${searchValue}`, tone: 'neutral'});
  if(active){
    active.innerHTML = chips.length
      ? chips.map(chip => `<span class="vocab-filter-chip ${escapeHtml(chip.tone)}">${escapeHtml(chip.label)}</span>`).join('')
      : '<span class="vocab-filter-chip neutral">全部</span>';
  }
  if(clear) clear.hidden = chips.length === 0;
}

function vocabWordMarkup(v){
  const word = String(v?.word || '');
  const reading = String(v?.reading || '').trim();
  const canUseRuby = word && reading && reading !== word && /[\u3400-\u9fff]/.test(word);
  if(!canUseRuby) return `<span class="vocab-word-main">${escapeHtml(word)}</span>`;
  return `<ruby class="vocab-word-main"><rb>${escapeHtml(word)}</rb><rt>${escapeHtml(reading)}</rt></ruby>`;
}

function vocabListMarkup(items){
  const now = Date.now();
  return items.map(v=>{
    const isDueNow = v.dueAt <= now;
    const mastery = vocabMasteryLabel(v, isDueNow);
    const meaning = displayVocabMeaning(v.meaning);
    const meaningTone = vocabMeaningTone(v);
    return `
    <li class="vocab-table-row">
      <div class="vocab-cell vocab-cell-word">
        ${vocabWordMarkup(v)}
        ${/[\u3400-\u9fff]/.test(String(v.word || '')) ? '' : `<span class="vocab-reading">${escapeHtml(v.reading || '读音待补充')}</span>`}
      </div>
      <div class="vocab-cell vocab-cell-meaning" title="${escapeHtml(meaning)}">
        <span class="vocab-meaning${meaningTone}">${escapeHtml(meaning)}</span>
      </div>
      <div class="vocab-cell vocab-cell-level">
        ${normalizeVisibleVocabLevel(v.level)
          ? `<span class="vocab-level-chip level-${escapeHtml(normalizeVisibleVocabLevel(v.level).toLowerCase())}">${escapeHtml(formatVisibleVocabLevel(v.level))}</span>`
          : `<span class="vocab-level-chip muted">${escapeHtml(formatVisibleVocabLevel(v.level))}</span>`}
      </div>
      <div class="vocab-cell vocab-cell-mastery">
        <span class="vocab-mastery ${mastery.tone}">${mastery.label}</span>
      </div>
      <div class="vocab-cell vocab-row-actions">
        <button class="vocab-action-button reader-speech-tool" type="button" onclick="speakEncodedJapanese('${encodeURIComponent(v.word)}', this, false)" data-tooltip="朗读" aria-label="朗读 ${escapeHtml(v.word)}">${speakerIconSvg()}</button>
        <button class="vocab-action-button" type="button" onclick="editVocabItem('${encodeURIComponent(v.word)}')" data-tooltip="编辑" aria-label="编辑 ${escapeHtml(v.word)}">${editIconSvg()}</button>
        <button class="vocab-action-button" type="button" onclick="removeFromVocab('${encodeURIComponent(v.word)}')" data-tooltip="删除" aria-label="删除 ${escapeHtml(v.word)}">${removeVocabIcon()}</button>
      </div>
    </li>
  `;}).join('');
}

function editVocabItem(encodedWord){
  const originalWord = decodeURIComponent(encodedWord);
  const item = vocabData.find(entry=>vocabIdentityKey(entry.word) === vocabIdentityKey(originalWord));
  if(!item) return;
  openVocabEditDialog(item);
}

function ensureVocabEditDialog(){
  let modal = document.getElementById('vocabEditModal');
  if(modal) return modal;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<div class="delete-confirm-modal vocab-edit-modal" id="vocabEditModal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="vocabEditTitle" inert>
    <form class="delete-confirm-dialog vocab-edit-dialog" onsubmit="submitVocabEdit(event)">
      <div class="delete-confirm-head">
        <div><span class="module-kicker">生词本</span><strong id="vocabEditTitle">编辑生词</strong></div>
        <button class="delete-confirm-close" type="button" onclick="closeVocabEditDialog()" aria-label="关闭编辑窗口">×</button>
      </div>
      <div class="vocab-edit-fields">
        <label>单词<input id="vocabEditWord" required autocomplete="off"></label>
        <label>假名<input id="vocabEditReading" autocomplete="off"></label>
        <label>释义<textarea id="vocabEditMeaning" required rows="3"></textarea></label>
      </div>
      <div class="delete-confirm-actions">
        <button class="btn-secondary" type="button" onclick="closeVocabEditDialog()">取消</button>
        <button class="btn-primary" type="submit">保存</button>
      </div>
    </form>
  </div>`;
  modal = wrapper.firstElementChild;
  modal.addEventListener('click', event=>{ if(event.target === modal) closeVocabEditDialog(); });
  document.body.appendChild(modal);
  return modal;
}

function openVocabEditDialog(item){
  const modal = ensureVocabEditDialog();
  VOCAB_EDIT_TARGET = item;
  document.getElementById('vocabEditWord').value = item.word || '';
  document.getElementById('vocabEditReading').value = item.reading || '';
  document.getElementById('vocabEditMeaning').value = displayVocabMeaning(item.meaning);
  setDialogVisibility(modal, true, document.getElementById('vocabEditWord'));
}

function closeVocabEditDialog(){
  setDialogVisibility(document.getElementById('vocabEditModal'), false);
  VOCAB_EDIT_TARGET = null;
}

function vocabMasteryLabel(v, isDueNow){
  const key = vocabMasteryKey(v, isDueNow);
  return {
    mastered:{label:'记住了', tone:'mastered', icon:'✓'},
    unsure:{label:'有点犹豫', tone:'unsure', icon:'~'},
    weak:{label:'没记住', tone:'weak', icon:'!'},
    new:{label:'新收藏', tone:'new', icon:'+'}
  }[key];
}

function syncVocabSourceFilterOptions(){
  const select = document.getElementById('vocabSourceFilter');
  if(!select) return;
  const selected = select.value || 'all';
  const sources = Array.from(new Set(vocabData.map(vocabSourceLabel))).filter(Boolean).sort((a, b)=>a.localeCompare(b, 'zh-CN'));
  select.innerHTML = '<option value="all">所有来源</option>' + sources.map(source => `
    <option value="${encodeURIComponent(source)}">${escapeHtml(source)}</option>
  `).join('');
  select.value = selected === 'all' || sources.some(source => encodeURIComponent(source) === selected) ? selected : 'all';
}

function renderVocab(){
  updatePostReadingMilestone();
  const list = document.getElementById('vocabList');
  const empty = document.getElementById('vocabEmptyMsg');
  const count = document.getElementById('vocabCount');
  if(count) count.textContent = vocabData.length;
  const total = document.getElementById('totalVocabCount');
  if(total) total.textContent = vocabData.length;
  const pageList = document.getElementById('vocabListPage');
  const pageEmpty = document.getElementById('vocabEmptyPage');
  syncVocabSourceFilterOptions();
  const now = Date.now();
  const weakCount = vocabData.filter(v=>vocabMasteryKey(v, Number(v?.dueAt || 0) <= now) === 'weak').length;
  const unsureCount = vocabData.filter(v=>vocabMasteryKey(v, Number(v?.dueAt || 0) <= now) === 'unsure').length;
  const practicedCount = vocabData.filter(v=>!!v?.lastPracticeAt).length;
  const dueTotal = vocabData.filter(v=>Number(v?.dueAt || 0) <= now).length;
  const categoryCounts = {
    vocabCategoryAll: vocabData.length,
    vocabCategoryDue: dueTotal,
    vocabCategoryWeak: weakCount,
    vocabCategoryUnsure: unsureCount,
    vocabCategoryPracticed: practicedCount
  };
  Object.entries(categoryCounts).forEach(([id, value])=>{
    const el = document.getElementById(id);
    if(el) el.textContent = String(value);
  });
  ['vocabLibraryTotal'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = String(vocabData.length);
  });
  const summaryCount = document.getElementById('vocabListSummaryCount');
  if(summaryCount) summaryCount.textContent = `${vocabData.length} 词`;
  const filteredPageVocab = filteredVocabForPage();
  syncVocabHeaderFilters();
  renderVocabFilterSummary(filteredPageVocab.length);
  document.querySelectorAll('.vocab-filter-tab').forEach(button=>{
    button.classList.toggle('active', button.dataset.filter === VOCAB_FILTER);
  });
  document.querySelectorAll('.vocab-level-filter').forEach(button=>{
    button.classList.toggle('active', button.dataset.level === VOCAB_JLPT_FILTER);
  });
  if(vocabData.length===0){
    if(list) list.innerHTML='';
    if(pageList) pageList.innerHTML = '';
    if(empty) empty.style.display='block';
    if(pageEmpty) pageEmpty.innerHTML = `还没有收藏的词。<button class="btn-secondary btn--small" type="button" onclick="switchWorkspace('reading')">去阅读</button>`;
    if(pageEmpty) pageEmpty.style.display = 'block';
    updateDueCount();
    syncVocabPanelData();
    return;
  }
  if(empty) empty.style.display='none';
  if(list) list.innerHTML = vocabListMarkup(vocabData);
  if(pageList){
    pageList.innerHTML = vocabListMarkup(filteredPageVocab);
    pageList.style.display = filteredPageVocab.length ? 'block' : 'none';
  }
  if(pageEmpty){
    pageEmpty.textContent = filteredPageVocab.length ? '' : '没有符合条件的生词。换个搜索词或筛选条件试试。';
    pageEmpty.style.display = filteredPageVocab.length ? 'none' : 'block';
  }
  updateDueCount();
  syncVocabPanelData();
}

function vocabPracticeTag(v){
  if(!v.lastPracticeAt) return '';
  if(v.lastPracticeRating === 'again') return '<span class="vocab-practice-tag needs-work">需加强</span>';
  if(v.lastPracticeRating === 'hard') return '<span class="vocab-practice-tag needs-work">模糊</span>';
  if(v.lastPracticeRating === 'easy') return '<span class="vocab-practice-tag practiced">已练过</span>';
  return '';
}

function formatDue(ts){
  const diffMin = Math.round((ts - Date.now())/60000);
  if(diffMin < 60) return `${diffMin}分钟后`;
  if(diffMin < 1440) return `${Math.round(diffMin/60)}小时后`;
  return `${Math.round(diffMin/1440)}天后`;
}

function updateDueCount(){
  const now = Date.now();
  const due = vocabData.filter(v=>v.dueAt<=now).length;
  const dueEl = document.getElementById('dueCount');
  if(dueEl) dueEl.textContent = due;
  const total = document.getElementById('totalVocabCount');
  if(total) total.textContent = vocabData.length;
  const dueTool = document.getElementById('vocabDueTool');
  if(dueTool){
    const label = `闪卡复习，共 ${vocabData.length} 个词`;
    dueTool.setAttribute('aria-label', label);
    dueTool.dataset.tooltip = label;
  }
}
