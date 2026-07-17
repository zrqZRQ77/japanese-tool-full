/* Unified lexical lookup planning and safe dictionary-entry selection. */

function lookupText(value){
  const text = String(value ?? '').trim();
  return text === '*' ? '' : text;
}

function lookupPosCategory(value){
  const part = String(value || '');
  if(/助動詞|助动词/.test(part)) return 'auxiliary';
  if(/助詞|助词/.test(part)) return 'particle';
  if(/動詞|动词/.test(part)) return 'verb';
  if(/形容動詞|形容动词|形容詞|形容词|連体詞|连体词/.test(part)) return 'adjective';
  if(/副詞|副词/.test(part)) return 'adverb';
  if(/接続詞|接续词|连词/.test(part)) return 'conjunction';
  if(/代名詞|代词/.test(part)) return 'pronoun';
  if(/接頭詞|接头词|接頭|接头/.test(part)) return 'prefix';
  if(/接尾詞|接尾词|接尾/.test(part)) return 'suffix';
  if(/感動詞|感叹词/.test(part)) return 'interjection';
  if(/名詞|名词/.test(part)) return 'noun';
  return '';
}

function lookupEntryPosCategories(entry = {}, source = 'jmdict'){
  const values = source === 'jmdict'
    ? (Array.isArray(entry.p) ? entry.p : [entry.p])
    : String(entry.p || '').split(/[・、,;/／\s]+/u);
  const categories = new Set();
  for(const rawValue of values){
    const value = String(rawValue || '').trim();
    if(!value) continue;
    if(source !== 'jmdict'){
      const category = lookupPosCategory(value);
      if(category) categories.add(category);
      if(/表达|惯用|短语/.test(value)) categories.add('expression');
      continue;
    }
    if(/^v|^vs|^vk|^vz/.test(value)) categories.add('verb');
    if(/^adj/.test(value)) categories.add('adjective');
    if(/^adv/.test(value)) categories.add('adverb');
    if(value === 'prt') categories.add('particle');
    if(/^aux/.test(value)) categories.add('auxiliary');
    if(value === 'conj') categories.add('conjunction');
    if(value === 'pn') categories.add('pronoun');
    if(value === 'pref') categories.add('prefix');
    if(value === 'suf' || value === 'n-suf') categories.add('suffix');
    if(value === 'int') categories.add('interjection');
    if(value === 'exp') categories.add('expression');
    if(value === 'n' || value.startsWith('n-') || value === 'ctr' || value === 'num') categories.add('noun');
  }
  return categories;
}

function lookupEntryMatchesPos(entry, candidate, source){
  const expected = candidate?.posCategory || '';
  if(!expected) return true;
  const categories = lookupEntryPosCategories(entry, source);
  if(!categories.size) return false;
  if(categories.has(expected)) return true;
  if(expected === 'noun' && categories.has('pronoun')) return true;
  if(expected === 'adjective' && categories.has('expression')) return true;
  return false;
}

function sameKanaLookupForm(left, right){
  const first = lookupText(left);
  const second = lookupText(right);
  if(!first || !second) return false;
  return katakanaToHiragana(first) === katakanaToHiragana(second);
}

function compoundLookupParts(value){
  return lookupText(value)
    .split(/[・･/／\s]+/u)
    .map(part=>part.trim())
    .filter(Boolean);
}

function buildCuratedLexicalLookupPlan(word, info = {}){
  return buildLexicalLookupPlan({
    surface:word,
    surfaceReading:info.reading || '',
    lemma:info.baseForm || word,
    lemmaReading:info.baseReading || info.reading || '',
    partOfSpeech:info.pos || '',
    partOfSpeechDetail:''
  });
}

function buildLexicalLookupPlan(inputAnalysis = {}, options = {}){
  const analysis = normalizeLexicalAnalysis(inputAnalysis);
  const posCategory = lookupPosCategory(`${analysis.partOfSpeech}・${analysis.partOfSpeechDetail}`);
  const candidates = new Map();
  const add = (term, kind, priority, permissions = {})=>{
    const normalizedTerm = lookupText(term);
    if(!normalizedTerm || candidates.has(normalizedTerm)) return;
    candidates.set(normalizedTerm, {
      term:normalizedTerm,
      kind,
      priority,
      partOfSpeech:analysis.partOfSpeech,
      posCategory,
      allowChinese:permissions.allowChinese !== false,
      allowJlpt:permissions.allowJlpt !== false,
      allowJmdict:permissions.allowJmdict !== false,
      allowReadingMatch:Boolean(permissions.allowReadingMatch),
      requirePosMatch:Boolean(permissions.requirePosMatch)
    });
  };

  const contextSensitive = analysis.isFunctionWord || analysis.isProperNoun;
  const surfaceIsKana = /^[\u3040-\u30ffー]+$/u.test(analysis.surface);
  add(analysis.surface, 'exactSurface', 10, {
    allowJlpt:!contextSensitive,
    allowReadingMatch:surfaceIsKana && !contextSensitive,
    requirePosMatch:contextSensitive || surfaceIsKana
  });
  if(analysis.lemma && analysis.lemma !== analysis.surface){
    const lemmaIsKana = /^[\u3040-\u30ffー]+$/u.test(analysis.lemma);
    add(analysis.lemma, 'lemma', 20, {
      allowJlpt:!contextSensitive,
      allowReadingMatch:lemmaIsKana && !contextSensitive,
      requirePosMatch:contextSensitive || lemmaIsKana
    });
  }

  if(!analysis.isProperNoun){
    const parts = [...compoundLookupParts(analysis.surface), ...compoundLookupParts(analysis.lemma)];
    if(parts.length > 1){
      [...new Set(parts)].reverse().forEach((part, index)=>add(part, 'compound', 30 + index, {
        allowJlpt:false
      }));
    }
  }

  const canUseReading = Boolean(posCategory && !analysis.isFunctionWord && !analysis.isProperNoun);
  const hasWrittenContext = /[^\u3040-\u30ffー]/u.test(`${analysis.surface}${analysis.lemma}`);
  if(canUseReading && hasWrittenContext){
    add(analysis.surfaceReading, 'reading', 40, {
      allowJlpt:false,
      allowReadingMatch:true,
      requirePosMatch:true
    });
    add(analysis.lemmaReading, 'reading', 41, {
      allowJlpt:false,
      allowReadingMatch:true,
      requirePosMatch:true
    });
  }

  for(const [index, term] of (options.fallbackTerms || []).entries()){
    add(term, 'fallback', 50 + index, {
      allowJlpt:false,
      requirePosMatch:contextSensitive || /^[\u3040-\u30ffー]+$/u.test(lookupText(term))
    });
  }

  return {
    schemaVersion:1,
    analysis,
    candidates:[...candidates.values()].sort((left, right)=>left.priority - right.priority)
  };
}

function isLexicalLookupPlan(value){
  return Boolean(value && value.schemaVersion === 1 && Array.isArray(value.candidates));
}

function legacyLookupCandidates(values){
  return dictionaryLookupForms(values).map((term, index)=>({
    term,
    kind:'fallback',
    priority:100 + index,
    partOfSpeech:'',
    posCategory:'',
    allowChinese:true,
    allowJlpt:true,
    allowJmdict:true,
    allowReadingMatch:true,
    requirePosMatch:false
  }));
}

function lookupCandidatesForSource(input, source){
  const permission = {
    chinese:'allowChinese',
    jlpt:'allowJlpt',
    jmdict:'allowJmdict'
  }[source];
  if(!permission) return [];
  const candidates = isLexicalLookupPlan(input) ? input.candidates : legacyLookupCandidates(input);
  return candidates
    .filter(candidate=>candidate && candidate[permission] && lookupText(candidate.term))
    .sort((left, right)=>left.priority - right.priority);
}

function selectLookupEntry(entries, candidate, source){
  const values = Array.isArray(entries) ? entries : [];
  const term = lookupText(candidate?.term);
  if(!values.length || !term) return null;
  const ranked = [];
  for(const entry of values){
    const written = lookupText(entry?.w);
    const reading = lookupText(entry?.r);
    const writtenExact = written === term
      || (/^[\u3040-\u30ffー]+$/u.test(written) && sameKanaLookupForm(written, term));
    const readingExact = sameKanaLookupForm(reading, term);
    const posMatch = lookupEntryMatchesPos(entry, candidate, source);
    if(candidate.requirePosMatch && !posMatch) continue;
    if(candidate.kind === 'reading'){
      if(candidate.allowReadingMatch && readingExact && posMatch) ranked.push({entry, score:100});
      continue;
    }
    if(writtenExact){
      ranked.push({entry, score:posMatch ? 300 : 250});
    }else if(candidate.allowReadingMatch && readingExact && posMatch){
      ranked.push({entry, score:100});
    }
  }
  ranked.sort((left, right)=>right.score - left.score);
  return ranked[0]?.entry || null;
}
