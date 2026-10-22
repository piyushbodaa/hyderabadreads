// The server's responses, written against web-standard Request and Response so
// the same code runs as Vercel Functions (api/) and inside Vite's dev and
// preview servers (server/dev.js).
import { loadLibrary } from './library.js'
import { renderPage, renderBlog, routeFor } from './page.js'
import { feed } from './feeds.js'
import { bookImage, shelfImage } from './og.js'
import { loadBlog, refreshDue } from './blogs.js'

// Pages are cached at Vercel's edge for a minute and then refreshed in the
// background, so a new book shows up within a minute or so of being added.
const PAGE_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=604800'
const FEED_CACHE = 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400'
const IMAGE_CACHE = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800'

export async function pageResponse(request, { db, template, notFound, blogTemplate, fetch }) {
  const url = new URL(request.url)
  const route = routeFor(url.searchParams.get('route'), url.searchParams.get('slug'))
  let page
  if (route.kind === 'blog') {
    const blog = await loadBlog(db)
    if (blog.due) later(refreshDue(db, { fetch }))
    page = renderBlog({ template: blogTemplate, blog, by: url.searchParams.get('by'), origin: url.origin })
  } else {
    const data = await loadLibrary(db)
    if (data.blogsDue) later(refreshDue(db, { fetch }))
    page = renderPage({ template, notFound, data, route, origin: url.origin })
  }
  const { status, html } = page
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': status === 200 ? PAGE_CACHE : 'public, max-age=0, s-maxage=60' },
  })
}

export async function feedResponse(request, { db }) {
  const url = new URL(request.url)
  const kind = url.searchParams.get('feed')
  // ?only=2026-10-24 gives just that day's meetup, for "Add to calendar".
  const only = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('only') ?? '') ? url.searchParams.get('only') : null
  const out = feed(kind, kind === 'blog' ? await loadBlog(db) : await loadLibrary(db), undefined, { only })
  if (!out) return new Response('Not found', { status: 404 })
  const headers = { 'Content-Type': out.type, 'Cache-Control': FEED_CACHE }
  if (kind === 'ics') headers['Content-Disposition'] = `${only ? 'attachment' : 'inline'}; filename="hyderabad-reads-${only ?? 'meetups'}.ics"`
  return new Response(out.body, { headers })
}

export async function ogResponse(request, { db }) {
  const url = new URL(request.url)
  const kind = url.searchParams.get('kind')
  const slug = (url.searchParams.get('file') ?? '').replace(/\.jpg$/, '')
  const data = await loadLibrary(db)
  let image = null
  if (kind === 'book') {
    const book = data.books.find((b) => b.id === slug)
    if (book) image = await bookImage(db, book)
  } else if (kind === 'shelf') {
    const member = data.members.find((m) => m.slug === slug)
    if (member) image = await shelfImage(db, member, data.books.filter((b) => b.owner === member.name))
  }
  if (!image) return new Response('Not found', { status: 404 })
  return new Response(image, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': IMAGE_CACHE } })
}

// Work that carries on after the response has gone: reading blogs' feeds.
// On Vercel it's handed to the request's waitUntil (where @vercel/functions'
// waitUntil finds it too); elsewhere it just runs.
function later(work) {
  const done = work.catch((err) => console.error(err))
  globalThis[Symbol.for('@vercel/request-context')]?.get?.()?.waitUntil?.(done)
}

// A short, uncached "try again" when the database can't be reached, instead of
// a cached error page.
export function guard(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (err) {
      console.error(err)
      return new Response('Hyderabad Reads can’t reach its library right now. Please try again in a minute.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '30' },
      })
    }
  }
}
