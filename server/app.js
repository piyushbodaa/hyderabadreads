// The JSON API behind the members' pages, plus sign-in links (/join/<token>)
// and uploaded images (/media/<hash>.webp). vercel.json sends /api/<route>
// here as ?route=<route>.
import { currentMember, redeemInvite, endSession, sessionCookies, clearedCookies, sameOrigin } from './auth.js'
import { searchBooks, fetchCover } from './openlibrary.js'
import { mediaResponse } from './media.js'
import { Problem, myShelf, addBook, updateBook, removeBook, shelfAction, adminData, adminAction } from './members.js'

export function json(data, status = 200, cookies = []) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(JSON.stringify(data), { status, headers })
}

export async function appResponse(request, context) {
  const { db } = context
  const fetch = context.fetch ?? globalThis.fetch
  const url = new URL(request.url)
  const route = url.searchParams.get('route')
  const method = request.method

  try {
    if (route === 'join') return await join(db, request, url.searchParams.get('token'))
    if (route === 'media') return await mediaResponse(db, url.searchParams.get('file'))
    if (route === 'olcover') return await olCover(url, fetch)

    const writing = !['GET', 'HEAD'].includes(method)
    if (writing && !sameOrigin(request)) throw new Problem(403, 'That request came from another site.')
    // POST and PATCH carry JSON. DELETE carries nothing, and like every write
    // it still has to come from the site's own pages (the Origin check above).
    const hasBody = method === 'POST' || method === 'PATCH'
    if (hasBody && !(request.headers.get('content-type') ?? '').includes('application/json')) {
      throw new Problem(415, 'Send JSON.')
    }
    const body = hasBody ? await request.json().catch(() => ({})) : {}
    const member = await currentMember(db, request)
    const signedIn = () => {
      if (!member) throw new Problem(401, 'Sign in with your personal link first.')
      return member
    }
    const admin = () => {
      if (!signedIn().isAdmin) throw new Problem(403, 'Only the club’s admins can do that.')
      return member
    }

    switch (`${method} ${route}`) {
      case 'GET me':
        return json(member ? await myShelf(db, member) : { member: null })
      case 'POST signout':
        await endSession(db, request)
        return json({ ok: true }, 200, clearedCookies(request))
      case 'GET search':
        signedIn()
        return json({ results: await searchBooks(url.searchParams.get('q'), { fetch }) })
      case 'POST books':
        return json({ book: await addBook(db, signedIn(), body, { fetch }) }, 201)
      case 'PATCH books':
        return json({ book: await updateBook(db, signedIn(), url.searchParams.get('id'), body) })
      case 'DELETE books':
        await removeBook(db, signedIn(), url.searchParams.get('id'))
        return json({ ok: true })
      case 'POST shelf':
        await shelfAction(db, signedIn(), body.action)
        return json(await myShelf(db, member))
      case 'GET admin':
        admin()
        return json(await adminData(db))
      case 'POST admin':
        return json(await adminAction(db, admin(), body, { origin: url.origin }))
      default:
        throw new Problem(404, 'No such address.')
    }
  } catch (err) {
    if (err instanceof Problem) return json({ error: err.message }, err.status)
    throw err
  }
}

// /join/<token>: sign this browser in and go to the member's shelf.
async function join(db, request, token) {
  const session = await redeemInvite(db, token)
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
  if (!session) {
    headers.set('Location', '/me?invite=invalid')
    return new Response(null, { status: 303, headers })
  }
  for (const cookie of sessionCookies(session, request)) headers.append('Set-Cookie', cookie)
  headers.set('Location', '/me?welcome=1')
  return new Response(null, { status: 303, headers })
}

// Covers in search results, fetched through the site so browsers only ever
// talk to hyderabadreads.fun. Public pictures, so the edge can keep them.
async function olCover(url, fetch) {
  const id = Number(url.searchParams.get('id'))
  if (!Number.isInteger(id) || id < 1) return new Response('Not found', { status: 404 })
  const bytes = await fetchCover({ coverId: id, size: 'M' }, { fetch })
  if (!bytes) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=3600' } })
  return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400, s-maxage=2592000' } })
}
