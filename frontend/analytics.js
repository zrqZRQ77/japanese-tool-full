(function initializeGoogleAnalytics(){
  const measurementId = String(window.NIHONGO_CONFIG?.gaMeasurementId || '').trim();
  const enabled = /^G-[A-Z0-9]+$/i.test(measurementId);

  function track(eventName, parameters = {}){
    if(!enabled || typeof window.gtag !== 'function') return false;
    window.gtag('event', eventName, parameters);
    return true;
  }

  window.yomeruAnalytics = Object.freeze({ enabled, track });
  if(!enabled) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: true
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
})();
