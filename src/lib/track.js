// Counts what people do on the site, without saying who: events carry no
// names, no owners and no titles. A no-op anywhere Google Analytics doesn't run.
export function track(name, params = {}) {
  window.gtag?.('event', name, params)
}
