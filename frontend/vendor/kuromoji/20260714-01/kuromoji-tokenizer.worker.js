/* Isolated Kuromoji Worker PoC. It is not part of the public reading path. */

const KUROMOJI_SCRIPT_URL = './kuromoji.js';
const KUROMOJI_DICTIONARY_URL = './dict/';

let tokenizerPromise = null;

function katakanaToHiragana(value = '') {
  return String(value).replace(/[\u30a1-\u30f6]/g, character =>
    String.fromCharCode(character.charCodeAt(0) - 0x60));
}

function fallbackKanaReading(surface = '') {
  return /^[\u3040-\u30ffー]+$/u.test(surface) ? katakanaToHiragana(surface) : '';
}

function normalizeParagraphs(text = '') {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
}

function initializeTokenizer() {
  if (tokenizerPromise) return tokenizerPromise;
  const startedAt = performance.now();
  tokenizerPromise = new Promise((resolve, reject) => {
    try {
      importScripts(KUROMOJI_SCRIPT_URL);
      if (!self.kuromoji?.builder) throw new Error('Kuromoji runtime did not expose a builder.');
      self.kuromoji.builder({ dicPath: KUROMOJI_DICTIONARY_URL }).build((error, tokenizer) => {
        if (error || !tokenizer) {
          reject(error || new Error('Kuromoji tokenizer was not created.'));
          return;
        }
        resolve({ tokenizer, initMs: performance.now() - startedAt });
      });
    } catch (error) {
      reject(error);
    }
  }).catch(error => {
    tokenizerPromise = null;
    throw error;
  });
  return tokenizerPromise;
}

function serializeToken(token, paragraphIndex, paragraphOffset) {
  const surface = token.surface_form || '';
  const rawReading = token.reading && token.reading !== '*' ? token.reading : '';
  const rawPronunciation = token.pronunciation && token.pronunciation !== '*'
    ? token.pronunciation
    : rawReading;
  const start = Math.max(0, Number(token.word_position || 1) - 1);
  return {
    surface,
    basicForm: token.basic_form && token.basic_form !== '*' ? token.basic_form : surface,
    pos: token.pos && token.pos !== '*' ? token.pos : '',
    posDetail: token.pos_detail_1 && token.pos_detail_1 !== '*' ? token.pos_detail_1 : '',
    conjugatedType: token.conjugated_type && token.conjugated_type !== '*' ? token.conjugated_type : '',
    conjugatedForm: token.conjugated_form && token.conjugated_form !== '*' ? token.conjugated_form : '',
    rawReading,
    rawPronunciation,
    reading: rawReading ? katakanaToHiragana(rawReading) : fallbackKanaReading(surface),
    pronunciation: rawPronunciation ? katakanaToHiragana(rawPronunciation) : fallbackKanaReading(surface),
    wordType: token.word_type || '',
    paragraphIndex,
    start,
    end: start + surface.length,
    documentStart: paragraphOffset + start,
    documentEnd: paragraphOffset + start + surface.length
  };
}

async function tokenizeText(text) {
  const { tokenizer, initMs } = await initializeTokenizer();
  const tokenizeStartedAt = performance.now();
  const paragraphs = normalizeParagraphs(text);
  let documentOffset = 0;
  const analyzedParagraphs = paragraphs.map((paragraph, paragraphIndex) => {
    const tokens = tokenizer.tokenize(paragraph)
      .map(token => serializeToken(token, paragraphIndex, documentOffset));
    const result = { index: paragraphIndex, text: paragraph, tokens };
    documentOffset += paragraph.length + 2;
    return result;
  });
  const tokens = analyzedParagraphs.flatMap(paragraph => paragraph.tokens);
  return {
    paragraphs: analyzedParagraphs,
    tokens,
    metrics: {
      initMs,
      tokenizeMs: performance.now() - tokenizeStartedAt,
      paragraphCount: analyzedParagraphs.length,
      tokenCount: tokens.length,
      readingCount: tokens.filter(token => Boolean(token.reading)).length
    }
  };
}

self.addEventListener('message', async event => {
  const message = event.data || {};
  if (!message.id || !['initialize', 'tokenize'].includes(message.type)) return;
  try {
    if (message.type === 'initialize') {
      const { initMs } = await initializeTokenizer();
      self.postMessage({
        id: message.id,
        type: 'ready',
        metrics: { initMs }
      });
      return;
    }
    const result = await tokenizeText(message.text || '');
    self.postMessage({ id: message.id, type: 'result', ...result });
  } catch (error) {
    self.postMessage({
      id: message.id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
