// The service worker: the site keeps working without a connection.
//
// - Pages come from the network whenever it answers within four seconds, and
//   the last copy of each is kept. Offline, a page opened before opens again.
//   A book or a shelf that wasn't opened opens on the saved home page, which
//   can show any of them; anything else says it's offline.
// - Scripts, styles and fonts have content hashes in their names, so a saved
//   copy is never stale. The home page's own files (those, and the logo) are
//   saved on install.
// - Covers (the club's, members' uploads and Open Library's) are kept as
//   they're seen, up to 400.
// - What a page loaded before the worker was running, the page sends over to
//   be saved as well (see src/lib/pwa.js).
// - Everything else (the API, sign-in links, feeds, link previews, analytics)
//   is left to the browser.
//
// scripts/finish-build.mjs fills in SHELL, the home page's files, and VERSION,
// from their contents. A deploy that changes any of them is a new version,
// which clears the pages and files saved by the one before.
//
// To switch it off for everyone, deploy this file with just:
//   self.addEventListener('install', () => self.skipWaiting())
//   self.addEventListener('activate', () => self.registration.unregister())

const VERSION = 'dev'
const SHELL = []

const PAGES = `pages-${VERSION}`
const FILES = `files-${VERSION}`
const COVERS = 'covers'
const MAX_COVERS = 400
const NETWORK_WAIT = 4000
// A saved copy answers any request for its address. Servers can say their
// responses vary by the request's Origin (for CORS) or encoding, and pages ask
// for scripts with an Origin while the worker saves them without one, so a
// strict match would never find them.
const ANY = { ignoreVary: true }

// The home page shows the shelves, any book (/book/x) and any member's shelf
// (/shelf/x) by itself, from the address.
const homeShows = (path) => path === '/' || /^\/(book|shelf)\/[^/]+\/?$/.test(path)
const isCover = (path) => path.startsWith('/covers/') || path.startsWith('/media/') || path === '/api/olcover'
const pageKey = (url) => new URL(url.pathname, url.origin).href
const isHTML = (response) => response.ok && (response.headers.get('content-type') ?? '').includes('text/html')

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await (await caches.open(FILES)).addAll(SHELL)
      const home = await fetch('/')
      // A redirected response can't answer a page load, so it isn't kept.
      if (isHTML(home) && !home.redirected) await (await caches.open(PAGES)).put('/', home)
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, FILES, COVERS]
      for (const name of await caches.keys()) if (!keep.includes(name)) await caches.delete(name)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  const path = url.pathname

  if (request.mode === 'navigate') {
    if (!path.startsWith('/api/') && !path.startsWith('/join/')) event.respondWith(page(event, url))
  } else if (path.startsWith('/assets/') || SHELL.includes(path)) {
    event.respondWith(file(event))
  } else if (isCover(path)) {
    event.respondWith(cover(event, path))
  }
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'loaded' && Array.isArray(event.data.urls)) event.waitUntil(saveLoaded(event.data.urls))
})

// Files and covers the page fetched before the worker took over. They're
// still in the browser's own cache, so saving them costs next to nothing.
async function saveLoaded(urls) {
  const files = await caches.open(FILES)
  const covers = await caches.open(COVERS)
  for (const href of urls) {
    const url = new URL(href, self.location.origin)
    if (url.origin !== self.location.origin) continue
    const cache = url.pathname.startsWith('/assets/') ? files : isCover(url.pathname) ? covers : null
    if (!cache || (await cache.match(url.href, ANY))) continue
    try {
      const response = await fetch(url.href)
      if (response.ok) await cache.put(url.href, response)
    } catch {
      // Gone, or the connection dropped: it'll be saved when it's next shown.
    }
  }
}

function page(event, url) {
  const network = fetch(event.request)
  // The copy is taken as soon as the response arrives, before the page reads it.
  const saving = network.then((response) => {
    if (!isHTML(response) || response.redirected) return
    const copy = response.clone()
    return caches.open(PAGES).then((cache) => cache.put(pageKey(url), copy))
  })
  event.waitUntil(saving.catch(() => {}))

  return (async () => {
    try {
      // The network, unless it's slow or the site is down and there's a saved
      // copy to show instead.
      const quick = await Promise.race([network, new Promise((resolve) => setTimeout(resolve, NETWORK_WAIT, null))])
      if (quick && quick.status < 500) return quick
      return (await savedPage(url)) ?? quick ?? (await network)
    } catch {
      return (await savedPage(url)) ?? offline()
    }
  })()
}

async function savedPage(url) {
  const cache = await caches.open(PAGES)
  return (await cache.match(pageKey(url), ANY)) ?? (homeShows(url.pathname) ? await cache.match('/', ANY) : undefined)
}

async function file(event) {
  const cache = await caches.open(FILES)
  const saved = await cache.match(event.request, ANY)
  if (saved) return saved
  const response = await fetch(event.request)
  if (response.ok) event.waitUntil(cache.put(event.request, response.clone()))
  return response
}

async function cover(event, path) {
  const cache = await caches.open(COVERS)
  const saved = await cache.match(event.request, ANY)
  // Uploaded covers (/media/) are named by their contents, so they never change.
  if (saved && path.startsWith('/media/')) return saved
  // Otherwise the saved one shows at once and is refreshed for next time.
  const network = fetch(event.request).then(async (response) => {
    if (response.ok) {
      await cache.put(event.request, response.clone())
      const keys = await cache.keys()
      for (const key of keys.slice(0, Math.max(0, keys.length - MAX_COVERS))) await cache.delete(key)
    }
    return response
  })
  event.waitUntil(network.catch(() => {}))
  return saved ?? network
}

function offline() {
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0f0c0a" />
<title>Offline · Hyderabad Reads</title>
<style>
  body { display: grid; min-height: 100vh; margin: 0; place-items: center; padding: 24px; box-sizing: border-box; background: #0f0c0a; color: #f3eadb; font: 16px/1.55 system-ui, sans-serif; }
  main { max-width: 420px; }
  h1 { margin: 0 0 10px; font: 500 30px/1.15 Georgia, serif; }
  p { margin: 0 0 22px; color: #c9bba5; }
  a { display: inline-block; padding: 11px 20px; border-radius: 999px; background: #e2a75b; color: #1a120b; font-weight: 600; text-decoration: none; }
</style>
<main>
  <h1>You’re offline</h1>
  <p>This page isn’t saved on this device yet. The shelves are: they open without a connection, as they were the last time you looked.</p>
  <a href="/">Open the shelves</a>
</main>
</html>`
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}
