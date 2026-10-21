// GA4: production-only, standard page views; no custom member data.
(() => {
  const hosts = new Set(['hyderabadreads.fun', 'www.hyderabadreads.fun']);
  if (!hosts.has(window.location.hostname) || window.__hyderabadReadsAnalytics) return;
  window.__hyderabadReadsAnalytics = true;

  const measurementId = 'G-KQ5C6LHH8R';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  // Addresses lose their query and #fragment. Member names stay out too: every
  // /shelf/<name> counts as /shelf/, and a second copy of a book
  // (/book/dune-herbert--piyush) counts as the book itself.
  const cleanUrl = (value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
      const path = url.pathname.replace(/^\/shelf\/.*$/, '/shelf/').replace(/^(\/book\/[^/]+?)--[^/]*$/, '$1');
      return url.origin + path;
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
