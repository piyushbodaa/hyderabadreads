// The site as an app: registers the service worker (public/sw.js), which keeps
// the shelves working without a connection, and counts installs. Only on the
// built site; in development the worker would get in the way of fresh files.
import { track } from './track.js'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const register = async () => {
    // Without a worker in charge yet, the page loaded its scripts, fonts and
    // covers on its own; once the worker is ready, it's told what to save.
    const fresh = !navigator.serviceWorker.controller
    try {
      await navigator.serviceWorker.register('/sw.js')
      if (!fresh) return
      const { active } = await navigator.serviceWorker.ready
      active?.postMessage({ type: 'loaded', urls: performance.getEntriesByType('resource').map((r) => r.name) })
    } catch {
      // No worker (private browsing, or blocked): the site works as before.
    }
  }
  // Once the page has loaded, so it doesn't compete with what the page needs.
  if (document.readyState === 'complete') register()
  else addEventListener('load', register, { once: true })
}

addEventListener('appinstalled', () => track('app_install'))
