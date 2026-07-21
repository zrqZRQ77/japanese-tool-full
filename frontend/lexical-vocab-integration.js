/* Connect unified lexical records to vocabulary saving and editing. */

function lexicalTokenCache(){
  return window['KUROMOJI_' + 'TOKEN_' + 'CACHE'] || [];
}

function requestTokenVocabSave(tokenId){
  const tokenRecord = lexicalTokenCache()[tokenId];
  if(!tokenRecord) return false;
  const { surface, info } = tokenRecord;
  if(info.lookupState === 'loading'){
    info.pendingVocabSave = true;
    syncTokenSaveButton(document.getElementById(`tokenMeaning-${tokenId}`)?.closest('.detail-box'), tokenId, info);
    showToast('释义加载完成后会自动加入生词本。', 'info');
    return true;
  }
  const lexicalMetadata = lexicalVocabMetadata(surface, info, tokenRecord);
  const saved = addCustomToVocab(
    surface,
    info.reading || '',
    info.meaning || '释义待补充',
    info.level || '',
    lexicalMetadata.partOfSpeech || info.pos || '已识别词',
    {
      ...lexicalMetadata,
      meaningLanguage:info.meaningLanguage || '',
      meaningSource:info.meaningSource || '',
      levelSource:info.levelSource || ''
    }
  );
  if(saved || vocabData.some(item=>vocabIdentityKey(item.word) === vocabIdentityKey(surface))){
    info.lookupState = 'saved';
    info.pendingVocabSave = false;
    syncTokenSaveButton(document.getElementById(`tokenMeaning-${tokenId}`)?.closest('.detail-box'), tokenId, info);
  }
  return saved;
}

async function addToVocab(word){
  const info = DICT[word];
  if(!info) return;
  await enrichInfoWithJlpt(buildCuratedLexicalLookupPlan(word, info), info);
  const lexicalMetadata = lexicalVocabMetadata(word, info);
  addCustomToVocab(word, info.reading, info.meaning, info.level, lexicalMetadata.partOfSpeech || info.pos, {
    ...lexicalMetadata,
    meaningLanguage:info.meaningLanguage,
    meaningSource:info.meaningSource,
    levelSource:info.levelSource
  });
}

function addTokenToVocab(tokenId){
  const tokenRecord = lexicalTokenCache()[tokenId];
  if(!tokenRecord) return;
  const { surface, info } = tokenRecord;
  const lexicalMetadata = lexicalVocabMetadata(surface, info, tokenRecord);
  addCustomToVocab(surface, info.reading, info.meaning, info.level, lexicalMetadata.partOfSpeech || info.pos, lexicalMetadata);
}

function addTokenSnapshotToVocab(encodedSnapshot){
  try{
    const snapshot = JSON.parse(decodeURIComponent(String(encodedSnapshot || '')));
    addCustomToVocab(
      snapshot.surface,
      snapshot.reading,
      snapshot.meaning,
      snapshot.level,
      snapshot.partOfSpeech || snapshot.pos,
      snapshot
    );
  }catch(error){
    console.warn('词语快照无效，未加入生词本', error);
  }
}

function addCustomToVocab(word, reading = '', meaning = '用户添加', level = '', pos = '自选内容', metadata = {}){
  const normalized = String(word || '').trim();
  if(!normalized){
    trackAnalyticsEvent('vocab_save', {jlpt_level:'ungraded', success:false});
    return false;
  }
  if(vocabData.find(item=>vocabIdentityKey(item.word) === vocabIdentityKey(normalized))){
    showToast('这个词已经在生词本里了。', 'info');
    trackAnalyticsEvent('vocab_save', {jlpt_level:normalizeVisibleVocabLevel(level) || 'ungraded', success:false});
    return false;
  }
  const cleanMeaning = displayVocabMeaning(meaning, '用户添加');
  const lexicalFields = normalizeLexicalVocabFields({
    ...metadata,
    word:normalized,
    reading,
    partOfSpeech:metadata.partOfSpeech || pos,
    pos:metadata.partOfSpeech || pos
  });
  vocabData.unshift(normalizeVocabItem({
    word:normalized,
    reading,
    meaning:cleanMeaning,
    meaningLanguage:metadata.meaningLanguage || '',
    meaningSource:metadata.meaningSource || (cleanMeaning ? 'manual' : ''),
    level,
    levelSource:metadata.levelSource || '',
    ...lexicalFields,
    pos:lexicalFields.partOfSpeech,
    sourceTitle:currentVocabSourceTitle(),
    sourceUrl:CURRENT_ARTICLE_URL || '',
    repetition:0,
    interval:0,
    dueAt:Date.now(),
    lastPracticeAt:null,
    lastPracticeRating:''
  }));
  saveVocab();
  trackAnalyticsEvent('vocab_save', {jlpt_level:normalizeVisibleVocabLevel(level) || 'ungraded', success:true});
  renderVocab();
  renderSampleFlow();
  showToast(SAMPLE_FLOW_ACTIVE ? '已加入生词本。下一步可以查看生词本。' : '已加入生词本，可在左侧「生词本」中复习。', 'success');
  return true;
}

function submitVocabEdit(event){
  event.preventDefault();
  if(!VOCAB_EDIT_TARGET) return;
  const word = document.getElementById('vocabEditWord').value.trim();
  const reading = document.getElementById('vocabEditReading').value.trim();
  const meaning = document.getElementById('vocabEditMeaning').value.trim();
  if(!word || !meaning){ showToast('请填写单词和释义。', 'warning'); return; }
  if(vocabData.some(entry=>entry !== VOCAB_EDIT_TARGET && vocabIdentityKey(entry.word) === vocabIdentityKey(word))){
    showToast('生词本中已经有这个词。', 'warning');
    return;
  }
  const previousWord = VOCAB_EDIT_TARGET.word || '';
  const previousReading = VOCAB_EDIT_TARGET.reading || '';
  updateEditedLexicalVocabFields(VOCAB_EDIT_TARGET, previousWord, previousReading, word, reading);
  VOCAB_EDIT_TARGET.meaning = meaning;
  VOCAB_EDIT_TARGET.meaningLanguage = hasCjk(meaning) ? 'zh' : VOCAB_EDIT_TARGET.meaningLanguage || '';
  VOCAB_EDIT_TARGET.meaningSource = 'manual';
  saveVocab();
  closeVocabEditDialog();
  renderVocab();
  showToast('生词已更新。', 'success');
}
