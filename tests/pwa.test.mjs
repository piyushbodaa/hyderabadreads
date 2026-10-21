// The site as an app: the manifest and its icons, and the service worker,
// run in a stand-in worker scope with a network that can be fast, slow, down
// or offline.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import sharp from 'sharp'

const root = new URL('../', import.meta.url)
const ORIGIN = 'https://hyderabadreads.fun'

test('the manifest names the app and its icons are the sizes it says', async () => {
  const manifest = JSON.parse(readFileSync(new URL('public/manifest.webmanifest', root), 'utf8'))
  assert.equal(manifest.name, 'Hyderabad Reads')
  assert.ok(manifest.short_name.length <= 12, 'short enough for a home screen')
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.display, 'standalone')
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'))
  for (const icon of manifest.icons) {
    const { width, height, format } = await sharp(new URL(`public${icon.src}`, root).pathname).metadata()
    assert.equal(`${width}x${height}`, icon.sizes, icon.src)
    assert.equal(format, 'png')
  }
})

test('every page links the manifest', () => {
  for (const page of ['index', 'me', 'admin', 'bookplates', 'digest', 'stats', 'year', '404']) {
    assert.match(readFileSync(new URL(`${page}.html`, root), 'utf8'), /<link rel="manifest" href="\/manifest.webmanifest" \/>/, page)
  }
})

// A worker scope: caches kept in Maps, and a fetch the test controls.
function worker() {
  const net = { mode: 'online', version: 'v1', status: 200 }
  const respond = (url) => {
    const { pathname } = new URL(url)
    if (net.mode === 'offline') return Promise.reject(new TypeError('Failed to fetch'))
    if (net.mode === 'slow') return new Promise(() => {})
    const type = pathname.startsWith('/assets/') ? 'text/javascript' : 'text/html; charset=utf-8'
    return Promise.resolve(new Response(`${pathname} ${net.version}`, { status: net.status, headers: { 'Content-Type': type } }))
  }
  const fetch = (input) => respond(typeof input === 'string' ? new URL(input, ORIGIN).href : input.url)

  const stores = new Map()
  const keyOf = (k) => (typeof k === 'string' ? new URL(k, ORIGIN).href : k.url)
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map())
      const m = stores.get(name)
      return {
        match: async (k, options) => {
          assert.equal(options?.ignoreVary, true, 'saved copies match whatever the request’s Origin')
          return m.get(keyOf(k))?.clone()
        },
        put: async (k, res) => void m.set(keyOf(k), res),
        addAll: async (urls) => {
          for (const u of urls) m.set(keyOf(u), await fetch(u))
        },
        keys: async () => [...m.keys()].map((url) => ({ url })),
        delete: async (k) => m.delete(keyOf(k)),
      }
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  }

  const handlers = {}
  const self = {
    location: new URL('/sw.js', ORIGIN),
    addEventListener: (type, fn) => (handlers[type] = fn),
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  }
  // A slow network "takes" four seconds at once, so the tests don't wait.
  const setTimeout = (fn, ms, ...args) => (net.mode === 'slow' ? fn(...args) : 0)
  const source = readFileSync(new URL('public/sw.js', root), 'utf8').replace('const SHELL = []', 'const SHELL = ["/logo.svg"]')
  vm.runInNewContext(source, { self, caches, fetch, setTimeout, URL, Response, Promise })

  async function lifecycle(type, extra = {}) {
    const pending = []
    handlers[type]({ ...extra, waitUntil: (p) => pending.push(p) })
    await Promise.all(pending)
  }
  // Returns the response, or null when the worker leaves the request alone.
  async function request(path, { mode = 'navigate', method = 'GET' } = {}) {
    let responded = null
    const pending = []
    handlers.fetch({ request: { url: new URL(path, ORIGIN).href, mode, method }, respondWith: (p) => (responded = p), waitUntil: (p) => pending.push(p) })
    const response = responded && (await responded)
    // A slow network never answers, so there's nothing to wait for.
    if (net.mode !== 'slow') await Promise.allSettled(pending)
    return response && { status: response.status, body: await response.text() }
  }
  return { net, lifecycle, request }
}

test('offline, a book or a shelf opens on the saved home page, and other pages say so', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  await sw.lifecycle('activate')
  sw.net.mode = 'offline'
  assert.equal((await sw.request('/')).body, '/ v1')
  assert.equal((await sw.request('/book/dune-herbert')).body, '/ v1')
  assert.equal((await sw.request('/shelf/piyush')).body, '/ v1')
  const stats = await sw.request('/stats')
  assert.equal(stats.status, 503)
  assert.match(stats.body, /You’re offline/)
})

test('pages come from the network, and the saved copy keeps up', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  sw.net.version = 'v2'
  assert.equal((await sw.request('/book/dune-herbert')).body, '/book/dune-herbert v2')
  sw.net.mode = 'offline'
  assert.equal((await sw.request('/book/dune-herbert?got=1')).body, '/book/dune-herbert v2')
})

test('a slow network or a server error shows the saved copy, but a 404 stays a 404', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  sw.net.mode = 'slow'
  assert.equal((await sw.request('/')).body, '/ v1')
  sw.net.mode = 'online'
  sw.net.status = 503
  assert.equal((await sw.request('/')).body, '/ v1')
  sw.net.status = 404
  assert.equal((await sw.request('/book/no-such-book')).status, 404)
})

test('the API, sign-in links, posts and other sites are left to the browser', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  assert.equal(await sw.request('/api/me', { mode: 'cors' }), null)
  assert.equal(await sw.request('/join/abc'), null)
  assert.equal(await sw.request('/api/loans', { mode: 'cors', method: 'POST' }), null)
  assert.equal(await sw.request('https://www.google-analytics.com/g/collect', { mode: 'no-cors' }), null)
  assert.equal(await sw.request('/meetups.ics', { mode: 'cors' }), null)
})

test('scripts, styles and the logo are kept, and served from the device', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  assert.equal((await sw.request('/assets/main-abc.js', { mode: 'cors' })).body, '/assets/main-abc.js v1')
  sw.net.mode = 'offline'
  assert.equal((await sw.request('/assets/main-abc.js', { mode: 'cors' })).body, '/assets/main-abc.js v1')
  assert.equal((await sw.request('/logo.svg', { mode: 'no-cors' })).body, '/logo.svg v1')
})

test('what a page loaded before the worker took over is saved when the page says so', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  const loaded = ['/assets/cormorant-abc.css', '/covers/dune-herbert.webp', '/api/olcover?id=8250295', '/api/me', 'https://www.googletagmanager.com/gtag/js']
  await sw.lifecycle('message', { data: { type: 'loaded', urls: loaded.map((u) => new URL(u, ORIGIN).href) } })
  sw.net.mode = 'offline'
  assert.equal((await sw.request('/assets/cormorant-abc.css', { mode: 'cors' })).body, '/assets/cormorant-abc.css v1')
  assert.equal((await sw.request('/covers/dune-herbert.webp', { mode: 'no-cors' })).body, '/covers/dune-herbert.webp v1')
  assert.equal((await sw.request('/api/olcover?id=8250295', { mode: 'no-cors' })).body, '/api/olcover v1')
  assert.equal(await sw.request('/api/me', { mode: 'cors' }), null)
})
