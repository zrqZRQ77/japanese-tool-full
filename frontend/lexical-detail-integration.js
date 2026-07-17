/* Connect unified lexical records to word-detail rendering. */

function detailInflectionHtml(detailRecord){
  const rows = [];
  if(detailRecord?.lemma && detailRecord.lemma !== detailRecord.surface){
    const baseReading = detailRecord.lemmaReading && detailRecord.lemmaReading !== detailRecord.lemma
      ? `（${detailRecord.lemmaReading}）`
      : '';
    rows.push(`<span><b>原形</b>${escapeHtml(detailRecord.lemma)}${escapeHtml(baseReading)}</span>`);
  }
  if(detailRecord?.conjugation){
    rows.push(`<span><b>词形</b>${escapeHtml(detailRecord.conjugation)}</span>`);
  }
  return rows.length ? `<div class="detail-inflection">${rows.join('')}</div>` : '';
}

function detailMetaHtml(surface, reading, level, part, tokenRecord = null){
  const info = {
    ...(tokenRecord?.info || {}),
    reading:reading || tokenRecord?.info?.reading || '',
    level:level || tokenRecord?.info?.level || '',
    pos:part || tokenRecord?.info?.pos || ''
  };
  const detailRecord = buildLexicalDetailRecord(surface, info, tokenRecord);
  if(tokenRecord) tokenRecord.detailRecord = detailRecord;
  const pieces = [
    detailReadingDisplayHtml(detailRecord.surface, detailRecord.surfaceReading),
    detailBadgesHtml(detailRecord.jlptLevel, detailRecord.partOfSpeech),
    detailInflectionHtml(detailRecord)
  ].filter(Boolean);
  return pieces.length ? `<div class="detail-meta">${pieces.join('')}</div>` : '';
}

function refreshVisibleTokenDetail(target, surface, info, tokenId){
  if(!target?.isConnected) return;
  const cache = window['KUROMOJI_' + 'TOKEN_' + 'CACHE'] || [];
  const tokenRecord = cache[tokenId] || null;
  if(tokenRecord) tokenRecord.detailRecord = buildLexicalDetailRecord(surface, info, tokenRecord);
  const detailBox = target.closest('.detail-box');
  const readingNode = detailBox?.querySelector('.detail-reading-text');
  if(readingNode && info.reading && readingNode.textContent.trim() === '暂无读音') readingNode.textContent = info.reading;
  const levelNode = detailBox?.querySelector('.detail-badge-level');
  if(levelNode) levelNode.textContent = `JLPT 参考等级：${formatVisibleVocabLevel(info.level)}`;
  const inflectionNode = detailBox?.querySelector('.detail-inflection');
  const updatedInflection = tokenRecord ? detailInflectionHtml(tokenRecord.detailRecord) : '';
  if(inflectionNode && updatedInflection){
    const wrapper = document.createElement('div');
    wrapper.innerHTML = updatedInflection;
    inflectionNode.replaceWith(wrapper.firstElementChild);
  }
  syncTokenSaveButton(detailBox, tokenId, info);
}
