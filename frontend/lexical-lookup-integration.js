/* Connect the unified lookup plan to Chinese, JLPT, and JMdict sources. */

async function lookupOfflineChinese(input, surface = ''){
  const plannedCandidates = lookupCandidatesForSource(input, 'chinese');
  for(const candidate of plannedCandidates){
    const term = candidate.term;
    try{
      const shard = await loadChineseDefinitionShard(offlineShardFor(term, CHINESE_DEFINITIONS_SHARD_COUNT));
      const entries = shard && Array.isArray(shard[term]) ? shard[term] : [];
      const entry = selectLookupEntry(entries, candidate, 'chinese');
      if(entry) return {term, entry, candidate};
    }catch(error){
      console.warn('离线中文词库分片加载失败', error);
      return null;
    }
  }
  if(isLexicalLookupPlan(input)) return null;
  const parts = compoundLookupParts(surface);
  return parts.length > 1 ? lookupOfflineChinese([...parts].reverse()) : null;
}

async function lookupJlptReference(input){
  const index = await loadJlptReferenceIndex();
  if(!index) return '';
  for(const candidate of lookupCandidatesForSource(input, 'jlpt')){
    const level = normalizeVisibleVocabLevel(index[candidate.term]);
    if(level) return level;
  }
  return '';
}

async function enrichInfoWithJlpt(input, info){
  const level = await lookupJlptReference(input);
  info.level = level;
  info.levelSource = 'jlpt-reference';
  return level;
}

async function lookupJmdictCommon(input){
  for(const candidate of lookupCandidatesForSource(input, 'jmdict')){
    const term = candidate.term;
    try{
      const shard = await loadJmdictCommonShard(jmdictCommonShardFor(term));
      const entries = shard && Array.isArray(shard[term]) ? shard[term] : [];
      const entry = selectLookupEntry(entries, candidate, 'jmdict');
      if(entry) return {term, entry, candidate};
    }catch(error){
      console.warn('离线词典分片加载失败', error);
      return null;
    }
  }
  return null;
}

async function lookupJmdictCommonWithCompoundFallback(input, surface){
  const direct = await lookupJmdictCommon(input);
  if(direct?.entry || isLexicalLookupPlan(input)) return direct;
  const parts = compoundLookupParts(surface);
  return parts.length > 1 ? lookupJmdictCommon([...parts].reverse()) : null;
}

async function autoLookupTokenMeaning(word, tokenId, tokenRecord){
  const target = document.getElementById(`tokenMeaning-${tokenId}`);
  if(!target || !tokenRecord) return;
  const { surface, info } = tokenRecord;
  const lexicalAnalysis = tokenRecord.analysis || info.lexicalAnalysis || analyzeLexicalToken(tokenRecord.token || {});
  const lookupPlan = buildLexicalLookupPlan(lexicalAnalysis, {
    fallbackTerms:[word, info.lookupWord, info.baseForm, tokenRecord.token?.basic_form]
  });
  tokenRecord.lookupPlan = lookupPlan;
  let chineseResult = null;
  let result = null;
  try{
    [chineseResult] = await Promise.all([
      lookupOfflineChinese(lookupPlan, surface),
      enrichInfoWithJlpt(lookupPlan, info)
    ]);
  }catch(error){
    console.warn('离线词典查询失败', error);
  }
  if(!target.isConnected) return;
  if(chineseResult?.entry?.m){
    info.reading = info.reading || katakanaToHiragana(chineseResult.entry.r || '');
    info.meaning = chineseResult.entry.m;
    info.meaningLanguage = 'zh';
    info.meaningSource = 'offline-chinese';
    info.lookupWord = chineseResult.term || info.lookupWord || surface;
    info.lookupMatchedKind = chineseResult.candidate?.kind || '';
    info.source = 'offline-chinese';
    info.lookupState = 'ready';
    target.innerHTML = chineseMeaningHtml(info);
    refreshVisibleTokenDetail(target, surface, info, tokenId);
    finishPendingTokenVocabSave(tokenId, tokenRecord);
    return;
  }
  try{
    result = await lookupJmdictCommonWithCompoundFallback(lookupPlan, surface);
  }catch(error){
    console.warn('JMdict 离线词典查询失败', error);
  }
  if(!result?.entry){
    const properNoun = isProperNounInfo(info);
    info.meaning = properNoun ? '专有名词，离线词库暂未收录可靠释义' : '释义待补充';
    info.meaningLanguage = '';
    info.meaningSource = '';
    info.lookupMatchedKind = '';
    info.lookupState = 'failed';
    target.innerHTML = properNoun
      ? '<span style="color:var(--ink-soft);">这是专有名词，离线词库暂未收录可靠释义；不会根据名称猜测含义。</span>'
      : '<span style="color:var(--ink-soft);">暂未查到可靠释义，可以先收藏，之后再补充。</span>';
    refreshVisibleTokenDetail(target, surface, info, tokenId);
    finishPendingTokenVocabSave(tokenId, tokenRecord);
    return;
  }
  const meaning = jmdictEnglishMeaning(result.entry);
  if(!meaning){
    info.reading = info.reading || katakanaToHiragana(result.entry.r || '');
    info.meaning = '释义待补充';
    info.meaningLanguage = '';
    info.meaningSource = '';
    info.lookupMatchedKind = result.candidate?.kind || '';
    info.lookupState = 'failed';
    target.innerHTML = '<span style="color:var(--ink-soft);">已找到词条，但当前没有可显示的释义，可以先收藏。</span>';
    refreshVisibleTokenDetail(target, surface, info, tokenId);
    finishPendingTokenVocabSave(tokenId, tokenRecord);
    return;
  }
  info.reading = info.reading || katakanaToHiragana(result.entry.r || '');
  info.meaning = meaning;
  info.meaningLanguage = 'en';
  info.meaningSource = 'jmdict';
  info.lookupWord = result.term || info.lookupWord || surface;
  info.lookupMatchedKind = result.candidate?.kind || '';
  info.source = 'jmdict';
  info.lookupState = 'ready';
  target.innerHTML = jmdictMeaningHtml(result.entry);
  refreshVisibleTokenDetail(target, surface, info, tokenId);
  finishPendingTokenVocabSave(tokenId, tokenRecord);
}
