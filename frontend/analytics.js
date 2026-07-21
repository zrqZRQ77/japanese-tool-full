(function initializeGoogleAnalytics(){
  const measurementId = String(window.NIHONGO_CONFIG?.GA_MEASUREMENT_ID || '').trim();
  const query = new URLSearchParams(window.location.search);
  const debugMode = query.get('analytics_debug') === '1';
  const productionHost = window.location.hostname === 'yomeru.japanese-hub.com';
  const enabled = /^G-[A-Z0-9]+$/i.test(measurementId) && (productionHost || debugMode);
  const eventParameters = Object.freeze({
    app_ready:['duration_ms', 'cold_start', 'cache_status'],
    tokenizer_ready:['duration_ms', 'cache_status', 'tokenizer_mode', 'success'],
    reading_start:['input_source', 'character_count_bucket'],
    reading_generate_success:['duration_ms', 'character_count_bucket', 'tokenizer_mode', 'retry_count'],
    reading_generate_error:['stage', 'error_code', 'retry_count'],
    furigana_edit_start:[],
    furigana_edit_save:['success'],
    vocab_save:['jlpt_level', 'success'],
    export_open:['format', 'layout'],
    export_complete:['format', 'layout', 'duration_ms', 'success'],
    export_error:['format', 'layout', 'error_code'],
    tts_preview:['rate_category', 'voice_source'],
    feedback_open:['entry_location']
  });
  const debugEvents = [];

  function safeParameterValue(value){
    if(typeof value === 'boolean') return value;
    if(typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
    const text = String(value ?? '').trim();
    return /^[a-z0-9_-]{1,48}$/i.test(text) ? text : '';
  }

  function sanitize(eventName, parameters){
    const allowed = eventParameters[eventName];
    if(!allowed) return null;
    return allowed.reduce((result, key)=>{
      const value = safeParameterValue(parameters?.[key]);
      if(value !== '') result[key] = value;
      return result;
    }, {});
  }

  function track(eventName, parameters = {}){
    if(!enabled || typeof window.gtag !== 'function') return false;
    const safeParameters = sanitize(eventName, parameters);
    if(!safeParameters) return false;
    if(debugMode) safeParameters.debug_mode = true;
    window.gtag('event', eventName, safeParameters);
    if(debugMode) debugEvents.push({event:eventName, parameters:{...safeParameters}});
    return true;
  }

  window.yomeruAnalytics = Object.freeze({
    enabled,
    debugMode,
    measurementId:enabled ? measurementId : '',
    debugEvents,
    track
  });
  if(!enabled) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    allow_google_signals:false,
    allow_ad_personalization_signals:false,
    send_page_view:true,
    debug_mode:debugMode
  });

  const script = document.createElement('script');
  script.async = true;
  script.dataset.yomeruAnalytics = 'true';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.onerror = ()=>{};
  document.head.appendChild(script);
})();
