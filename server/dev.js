// Runs the server inside Vite: `npm run dev` and `npm run preview` answer the
// same addresses as the live site, against a local PGlite database in .data/
// that's created and filled with the starting shelves on first use.
//
// Which address goes to which handler is read from vercel.json's rewrites, so
// local development can't drift from production.
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { pageResponse, feedResponse, ogResponse, guard } from './handlers.js'
import { appResponse } from './app.js'
import { createInvite } from './auth.js'

const root = new URL('../', import.meta.url)
const HANDLERS = { '/api/page': pageResponse, '/api/feeds': feedResponse, '/api/og': ogResponse, '/api/app': appResponse }

// `memory: true` gives a fresh database that's gone when the server stops.
export function serverPlugin({ dataDir = fileURLToPath(new URL('.data/pglite', root)), memory = false } = {}) {
  let db
  const database = () => (db ??= import('./pglite.js').then((m) => m.localDatabase(memory ? undefined : dataDir)))
  const rewrites = compileRewrites(JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8')).rewrites ?? [])

  const devTemplates = (server) => async (url) => ({
    template: await server.transformIndexHtml(url, await readFile(new URL('index.html', root), 'utf8')),
    notFound: await server.transformIndexHtml('/404.html', await readFile(new URL('404.html', root), 'utf8')),
    blogTemplate: await server.transformIndexHtml('/blog.html', await readFile(new URL('blog.html', root), 'utf8')),
  })
  const builtTemplates = async () => ({
    template: await readFile(new URL('server/generated/index.html', root), 'utf8'),
    notFound: await readFile(new URL('server/generated/404.html', root), 'utf8'),
    blogTemplate: await readFile(new URL('server/generated/blog.html', root), 'utf8'),
  })

  const middleware = (templates) => async (req, res, next) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)

    // Local only: a sign-in link for any member, e.g. /__dev/invite?name=Piyush.
    if (url.pathname === '/__dev/invite') {
      const db = await database()
      const member = await db.one('SELECT id, name FROM members WHERE lower(name) = lower($1) AND removed_at IS NULL', [url.searchParams.get('name') ?? ''])
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      return res.end(member ? `${url.origin}/join/${await createInvite(db, member.id)}\n` : 'No member by that name.\n')
    }

    const target = rewrite(rewrites, url)
    if (!target) return next()
    // A rewrite to a page (/me → /me.html) is served by Vite itself.
    if (!target.pathname.startsWith('/api/')) {
      req.url = target.pathname + target.search
      return next()
    }
    const handler = HANDLERS[target.pathname]
    if (!handler) return next()
    try {
      const request = toRequest(req, new URL(`${target.pathname}${target.search}`, url.origin))
      const context = { db: await database(), ...(target.pathname === '/api/page' && (await templates(req.url))) }
      await send(res, await guard(handler)(request, context))
    } catch (err) {
      next(err)
    }
  }

  return {
    name: 'hyderabad-reads:server',
    configureServer(server) {
      server.middlewares.use(middleware(devTemplates(server)))
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(builtTemplates))
    },
  }
}

// vercel.json rewrites → matchers. Supports the forms the site uses:
// literal paths and `:name` segments, e.g. "/book/:slug" → "/api/page?route=book&slug=:slug".
export function compileRewrites(list) {
  return list.map(({ source, destination }) => {
    const names = []
    const pattern = source.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:([a-z]+)/gi, (_, name) => {
      names.push(name)
      return '([^/]+)'
    })
    return { regex: new RegExp(`^${pattern}/?$`), names, destination }
  })
}

export function rewrite(rewrites, url) {
  for (const { regex, names, destination } of rewrites) {
    const m = regex.exec(url.pathname)
    if (!m) continue
    const values = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])]))
    const target = new URL(destination.replace(/:([a-z]+)/gi, (_, n) => encodeURIComponent(values[n] ?? '')), url.origin)
    for (const [k, v] of url.searchParams) if (!target.searchParams.has(k)) target.searchParams.set(k, v)
    return target
  }
  return null
}

function toRequest(req, url) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    for (const v of [value].flat()) headers.append(key, v)
  }
  const hasBody = !['GET', 'HEAD'].includes(req.method)
  return new Request(url, { method: req.method, headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: 'half' })
}

async function send(res, response) {
  res.statusCode = response.status
  for (const [key, value] of response.headers) if (key !== 'set-cookie') res.setHeader(key, value)
  const cookies = response.headers.getSetCookie?.() ?? []
  if (cookies.length) res.setHeader('Set-Cookie', cookies)
  res.end(Buffer.from(await response.arrayBuffer()))
}
