// GA4: production-only, standard page views; no custom member data.
(() => {
  const hosts = new Set(['hyderabadreads.fun', 'www.hyderabadreads.fun']);
  if (!hosts.has(window.location.hostname) || window.__hyderabadReadsAnalytics) return;
  window.__hyderabadReadsAnalytics = true;

  const measurementId = 'G-KQ5C6LHH8R';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  const cleanUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:'
        ? url.origin + url.pathname : '';
    } catch { return ''; }
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    page_location: cleanUrl(window.location.href),
    page_referrer: cleanUrl(document.referrer),
    page_title: 'Hyderabad Reads',
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  document.head.appendChild(script);
})();
