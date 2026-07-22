/*
 * Yomeru vocabulary CSV and Anki TSV export.
 *
 * Complete learning-data backup and restore remain cross-domain responsibilities
 * in app.js, while reusing the shared download/date helpers declared here.
 */

function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8;'){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayStamp(){
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function exportDateTime(value){
  const timestamp = Number(value || 0);
  if(!timestamp) return '';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function setInlineStatus(id, message, type = 'ok'){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = message;
  el.className = `export-inline-status ${type}`.trim();
  if(message) setTimeout(()=>{
    if(el.textContent === message) el.textContent = '';
  }, 4500);
}

function setVocabExportStatus(message, type = 'ok'){
  ['vocabExportStatus', 'vocabExportStatusPage', 'vocabExportStatusPanel'].forEach(id=>{
    setInlineStatus(id, message, type);
  });
}

function runVocabExportSelect(select){
  const value = select?.value || '';
  if(value === 'csv') exportVocabCsv();
  if(value === 'anki') exportAnkiTsv();
  if(select) select.value = '';
}

function exportVocabCsv() {
  if (vocabData.length === 0) {
    setVocabExportStatus('生词本是空的，先添加几个词再导出。', 'error');
    showToast('生词本是空的，先添加几个词再导出。', 'warning');
    return;
  }
  confirmDeletion({
    intent:'neutral',
    kicker:'',
    title:'是否导出生词本？',
    message:'把当前生词本导出为 CSV 文件，适合用 Excel 或表格工具打开。',
    target:`下载单词数量：${vocabData.length} 个词`,
    confirmLabel:'导出'
  }, exportVocabCsvFile);
}

function exportVocabCsvFile() {
  // 添加 BOM 头 \uFEFF，防止 Excel 打开时出现中文乱码。
  let csvContent = "\uFEFF";
  csvContent += "单词,假名,释义,释义语言,释义来源,词性,参考等级,等级来源,来源,来源链接,复习状态,下次复习时间（按复习结果自动安排）\n";

  const csvField = value => `"${String(value || '').replace(/"/g, '""')}"`;
  const now = Date.now();
  csvContent += vocabData.map(v => {
    const mastery = vocabMasteryLabel(v, Number(v?.dueAt || 0) <= now);
    return [
      v.word,
      v.reading,
      displayVocabMeaning(v.meaning),
      v.meaningLanguage,
      v.meaningSource,
      v.pos,
      formatVisibleVocabLevel(v.level),
      v.levelSource,
      vocabSourceLabel(v),
      v.sourceUrl,
      mastery.label,
      exportDateTime(v.dueAt)
    ].map(csvField).join(',');
  }).join("\n");

  downloadTextFile("读得懂_生词本导出.csv", csvContent, 'text/csv;charset=utf-8;');
  setVocabExportStatus(`已导出 ${vocabData.length} 个词的 CSV 文件。`);
}

function exportAnkiTsv(){
  if(vocabData.length === 0){
    setVocabExportStatus('生词本是空的，先添加几个词再导出 Anki。', 'error');
    showToast('生词本是空的，先添加几个词再导出。', 'warning');
    return;
  }
  const clean = value => String(value || '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
  const lines = vocabData.map(v => [
    clean(v.word),
    clean(v.reading),
    clean(displayVocabMeaning(v.meaning)),
    clean(v.meaningLanguage),
    clean(v.meaningSource),
    clean(v.pos),
    clean(formatVisibleVocabLevel(v.level)),
    clean(v.levelSource),
    clean(vocabSourceLabel(v)),
    clean(v.sourceUrl || '')
  ].join('\t'));
  const header = '# 正面\t假名\t释义\t释义语言\t释义来源\t词性\t参考等级\t等级来源\t来源\t来源链接\n';
  downloadTextFile(`dokedo-anki-${todayStamp()}.tsv`, header + lines.join('\n'), 'text/tab-separated-values;charset=utf-8;');
  setVocabExportStatus(`已导出 ${vocabData.length} 个词，可在 Anki 中选择「导入文件」。`);
}
