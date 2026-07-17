/* Unified lexical detail records, vocabulary metadata, and legacy migration. */

const LEXICAL_RECORD_SCHEMA_VERSION = 1;
const LEXICAL_LOOKUP_MATCH_KINDS = new Set(['exactSurface', 'lemma', 'compound', 'reading', 'fallback']);

function lexicalRecordText(value){
  const text = String(value ?? '').trim();
  return text === '*' ? '' : text;
}

function lexicalRecordLevel(value){
  const level = String(value || '').trim().toUpperCase();
  return /^N[1-5]$/.test(level) ? level : '';
}

function lexicalRecordAnalysis(info = {}, tokenRecord = null){
  return tokenRecord?.analysis || info.lexicalAnalysis || {};
}

function buildLexicalDetailRecord(surface, info = {}, tokenRecord = null){
  const analysis = lexicalRecordAnalysis(info, tokenRecord);
  const normalizedSurface = lexicalRecordText(surface || tokenRecord?.surface || analysis.surface);
  const surfaceReading = lexicalRecordText(analysis.surfaceReading || info.reading);
  const lemma = lexicalRecordText(analysis.lemma || info.baseForm) || normalizedSurface;
  const lemmaReading = lexicalRecordText(
    analysis.lemmaReading
      || info.baseReading
      || (lemma === normalizedSurface ? surfaceReading : '')
  );
  const partOfSpeech = lexicalRecordText(analysis.partOfSpeech || info.partOfSpeech || info.pos) || '已识别词';
  const partOfSpeechDetail = lexicalRecordText(analysis.partOfSpeechDetail || info.partOfSpeechDetail);
  const conjugationType = lexicalRecordText(analysis.conjugationType || info.conjugationType);
  const conjugationForm = lexicalRecordText(
    analysis.conjugationForm || info.conjugationForm || info.inflectionLabel
  );
  const jlptLevel = lexicalRecordLevel(info.level);
  const rawLookupKind = String(info.lookupMatchedKind || '');
  const lookupMatchedKind = LEXICAL_LOOKUP_MATCH_KINDS.has(rawLookupKind) ? rawLookupKind : '';
  return {
    schemaVersion:LEXICAL_RECORD_SCHEMA_VERSION,
    surface:normalizedSurface,
    surfaceReading,
    lemma,
    lemmaReading,
    partOfSpeech,
    partOfSpeechDetail,
    conjugationType,
    conjugationForm,
    conjugation:[conjugationType, conjugationForm].filter(Boolean).join(' · '),
    meaning:lexicalRecordText(info.meaning),
    meaningLanguage:lexicalRecordText(info.meaningLanguage),
    meaningSource:lexicalRecordText(info.meaningSource),
    jlptLevel,
    jlptSource:jlptLevel ? lexicalRecordText(info.levelSource) : '',
    lookupMatchedTerm:lexicalRecordText(info.lookupMatchedTerm || info.lookupWord),
    lookupMatchedKind
  };
}

function lexicalVocabMetadata(surface, info = {}, tokenRecord = null){
  const detail = buildLexicalDetailRecord(surface, info, tokenRecord);
  return {
    lexicalSchemaVersion:detail.schemaVersion,
    baseForm:detail.lemma,
    baseReading:detail.lemmaReading,
    partOfSpeech:detail.partOfSpeech,
    partOfSpeechDetail:detail.partOfSpeechDetail,
    conjugationType:detail.conjugationType,
    conjugationForm:detail.conjugationForm,
    lookupMatchedTerm:detail.lookupMatchedTerm,
    lookupMatchedKind:detail.lookupMatchedKind
  };
}

function normalizeLexicalVocabFields(item = {}){
  const word = lexicalRecordText(item.word || item.surface);
  const reading = lexicalRecordText(item.reading || item.surfaceReading);
  const baseForm = lexicalRecordText(item.baseForm || item.lemma) || word;
  const baseReading = lexicalRecordText(
    item.baseReading
      || item.lemmaReading
      || (baseForm === word ? reading : '')
  );
  const partOfSpeech = lexicalRecordText(item.partOfSpeech || item.pos) || '自选内容';
  const rawLookupKind = String(item.lookupMatchedKind || '');
  return {
    lexicalSchemaVersion:LEXICAL_RECORD_SCHEMA_VERSION,
    word,
    reading,
    baseForm,
    baseReading,
    partOfSpeech,
    partOfSpeechDetail:lexicalRecordText(item.partOfSpeechDetail),
    conjugationType:lexicalRecordText(item.conjugationType),
    conjugationForm:lexicalRecordText(item.conjugationForm || item.inflectionLabel),
    lookupMatchedTerm:lexicalRecordText(item.lookupMatchedTerm || item.lookupWord),
    lookupMatchedKind:LEXICAL_LOOKUP_MATCH_KINDS.has(rawLookupKind) ? rawLookupKind : '',
    pos:partOfSpeech
  };
}

function updateEditedLexicalVocabFields(item, previousWord, previousReading, nextWord, nextReading){
  const baseFollowedSurface = !item.baseForm || item.baseForm === previousWord;
  const baseReadingFollowedSurface = !item.baseReading
    || (item.baseForm === previousWord && item.baseReading === previousReading);
  item.word = nextWord;
  item.reading = nextReading;
  if(baseFollowedSurface) item.baseForm = nextWord;
  if(baseReadingFollowedSurface) item.baseReading = nextReading;
  item.lexicalSchemaVersion = LEXICAL_RECORD_SCHEMA_VERSION;
  item.partOfSpeech = lexicalRecordText(item.partOfSpeech || item.pos) || '自选内容';
  item.pos = item.partOfSpeech;
  return item;
}
