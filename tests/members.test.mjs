// Members: sign-in links, sessions, managing a shelf, and the admin page's
// actions, against a throwaway database and a stand-in for Open Library.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import sharp from 'sharp'
import { localDatabase } from '../server/pglite.js'
import { appResponse } from '../server/app.js'
import { createInvite } from '../server/auth.js'
import { loadLibrary } from '../server/library.js'

const db = await localDatabase()
const ORIGIN = 'https://hyderabadreads.fun'

// Open Library and Apple Books, as far as these tests need them.
const coverJpeg = await sharp(randomBytes(240 * 360 * 3), { raw: { width: 240, height: 360, channels: 3 } }).jpeg().toBuffer()
const hdJpeg = await sharp({ create: { width: 926, height: 1400, channels: 3, background: '#2f6f5e' } }).jpeg().toBuffer()
const calls = []
async function fakeFetch(url) {
  calls.push(String(url))
  if (String(url).startsWith('https://itunes.apple.com/search')) {
    const term = new URL(url).searchParams.get('term')
    const art = (isbn) => `https://is1-ssl.mzstatic.com/image/thumb/Publication/v4/aa/bb/cc/${isbn}.jpg/100x100bb.jpg`
    return Response.json({
      results: term.startsWith('The Guide')
        ? [
            { trackName: 'The Guide', artistName: 'R. K. Narayan', artworkUrl100: art('9788845292866') }, // an Italian edition
            { trackName: 'The Guide: A Novel', artistName: 'R.K. Narayan', artworkUrl100: art('9780143039648') },
          ]
        : [],
    })
  }
  if (String(url).startsWith('https://is1-ssl.mzstatic.com/')) return new Response(hdJpeg, { headers: { 'Content-Type': 'image/jpeg' } })
  if (String(url).startsWith('https://openlibrary.org/search.json')) {
    return Response.json({
      docs: [
        { key: '/works/OL1W', title: 'A Study Guide to Malgudi', author_name: ['Someone'], edition_count: 1, cover_i: 9 },
        { key: '/works/OL2W', title: 'Malgudi Days', author_name: ['R. K. Narayan'], first_publish_year: 1943, number_of_pages_median: 256, edition_count: 40, cover_i: 12345 },
        { key: '/works/OL3W', title: 'No author here' },
      ],
    })
  }
  if (String(url).startsWith('https://covers.openlibrary.org/')) return new Response(coverJpeg, { headers: { 'Content-Type': 'image/jpeg' } })
  return new Response('Not found', { status: 404 })
}

async function call(route, { method = 'GET', cookie, body, origin = ORIGIN, query = '', contentType = 'application/json' } = {}) {
  const headers = new Headers()
  if (cookie) headers.set('cookie', cookie)
  if (method !== 'GET' && origin) headers.set('origin', origin)
  if (body !== undefined) headers.set('content-type', contentType)
  const request = new Request(`${ORIGIN}/api/app?route=${route}${query}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  return appResponse(request, { db, fetch: fakeFetch })
}

async function signIn(name) {
  const { id } = await db.one('SELECT id FROM members WHERE name = $1', [name])
  const res = await call('join', { query: `&token=${await createInvite(db, id)}` })
  const cookies = res.headers.getSetCookie()
  return cookies.map((c) => c.split(';')[0]).join('; ')
}

test('a bad or missing link goes back to My shelf with a message, and signs nobody in', async () => {
  for (const token of ['nope', '', 'x'.repeat(43)]) {
    const res = await call('join', { query: `&token=${token}` })
    assert.equal(res.status, 303)
    assert.equal(res.headers.get('location'), '/me?invite=invalid')
    assert.deepEqual(res.headers.getSetCookie(), [])
  }
})

test('a sign-in link sets a private session cookie and a public hint', async () => {
  const { id } = await db.one(`SELECT id FROM members WHERE name = 'Rama'`)
  const token = await createInvite(db, id)
  const res = await call('join', { query: `&token=${token}` })
  assert.equal(res.status, 303)
  assert.equal(res.headers.get('location'), '/me?welcome=1')
  const [session, hint] = res.headers.getSetCookie()
  assert.match(session, /^hr_session=[A-Za-z0-9_-]{43}; HttpOnly; Path=\/; SameSite=Lax; Max-Age=15552000; Secure$/)
  assert.match(hint, /^hr_member=1; Path=\/; SameSite=Lax/)
  assert.doesNotMatch(hint, /HttpOnly/)
  // The same link works again, on another phone.
  assert.equal((await call('join', { query: `&token=${token}` })).headers.get('location'), '/me?welcome=1')
  // The database never holds the token itself.
  assert.equal(await db.one('SELECT 1 FROM invites WHERE token_hash = $1', [token]), null)
})

test('a new link cancels the old one', async () => {
  const { id } = await db.one(`SELECT id FROM members WHERE name = 'Rishi'`)
  const old = await createInvite(db, id)
  await createInvite(db, id)
  assert.equal((await call('join', { query: `&token=${old}` })).headers.get('location'), '/me?invite=invalid')
})

test('signed out, My shelf knows nobody; signed in, it shows the member and their books', async () => {
  assert.deepEqual(await (await call('me')).json(), { member: null })
  const me = await (await call('me', { cookie: await signIn('Rama') })).json()
  assert.deepEqual(me.member, { name: 'Rama', slug: 'rama', isAdmin: false })
  assert.equal(me.books.length, 5)
  assert.ok(me.books.every((b) => b.sample))
})

test('changes need a signed-in member, JSON, and the site’s own origin', async () => {
  const cookie = await signIn('Rama')
  assert.equal((await call('books', { method: 'POST', body: { title: 'X', author: 'Y' } })).status, 401)
  assert.equal((await call('books', { method: 'POST', cookie, body: { title: 'X', author: 'Y' }, origin: 'https://evil.example' })).status, 403)
  assert.equal((await call('books', { method: 'POST', cookie, body: { title: 'X', author: 'Y' }, contentType: 'text/plain' })).status, 415)
  assert.equal((await call('search', { query: '&q=malgudi' })).status, 401)
})

test('search puts the real book above the study guide and drops entries without an author', async () => {
  const { results } = await (await call('search', { cookie: await signIn('Rama'), query: '&q=malgudi' })).json()
  assert.deepEqual(results.map((r) => r.title), ['Malgudi Days', 'A Study Guide to Malgudi'])
  assert.deepEqual(results[0], { olKey: '/works/OL2W', title: 'Malgudi Days', author: 'R. K. Narayan', year: 1943, pages: 256, coverId: 12345, isbn: null })
})

test('adding a book fetches its cover, picks spine colours, and puts it on the shelf', async () => {
  const cookie = await signIn('Rama')
  const res = await call('books', {
    method: 'POST',
    cookie,
    body: { title: 'Malgudi Days', author: 'R. K. Narayan', year: 1943, pages: 256, olKey: '/works/OL2W', coverId: 12345, genre: 'Fiction', note: 'Read it on a train.' },
  })
  assert.equal(res.status, 201)
  const { book } = await res.json()
  assert.equal(book.id, 'malgudi-days-narayan')
  assert.equal(book.sample, false)
  assert.equal(book.note, 'Read it on a train.')
  assert.match(book.cover, /^\/media\/[a-f0-9]{64}\.webp$/)
  assert.match(book.color, /^#[0-9a-f]{6}$/)
  assert.equal(book.w, 240)
  assert.ok(calls.some((u) => u.includes('/b/id/12345-L.jpg')))

  const image = await call('media', { query: `&file=${book.cover.slice('/media/'.length)}` })
  assert.equal(image.status, 200)
  assert.equal(image.headers.get('content-type'), 'image/webp')
  assert.match(image.headers.get('cache-control'), /immutable/)

  const data = await loadLibrary(db)
  assert.ok(data.books.some((b) => b.id === 'malgudi-days-narayan' && b.owner === 'Rama' && !b.sample))

  // A second copy, by someone else, gets its own address.
  const again = await (await call('books', { method: 'POST', cookie: await signIn('Rishi'), body: { title: 'Malgudi Days', author: 'R. K. Narayan' } })).json()
  assert.equal(again.book.id, 'malgudi-days-narayan--rishi')
  assert.equal(again.book.cover, null)
})

test('a cover comes from Apple Books in HD when it has the book, never a translation', async () => {
  const res = await call('books', { method: 'POST', cookie: await signIn('Rama'), body: { title: 'The Guide', author: 'R. K. Narayan', genre: 'Fiction' } })
  assert.equal(res.status, 201)
  const { book } = await res.json()
  assert.equal(book.w, 800)
  assert.match(book.cover, /^\/media\/[a-f0-9]{64}\.webp$/)
  assert.ok(calls.some((u) => u.includes('9780143039648.jpg/1400x1400bb.jpg')))
  assert.ok(!calls.some((u) => u.includes('9788845292866.jpg/1400x1400bb.jpg')))
})

test('a book needs a title and an author', async () => {
  const res = await call('books', { method: 'POST', cookie: await signIn('Rama'), body: { title: '  ', author: 'Someone' } })
  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /title/)
})

test('owners edit and remove their own books; admins can tidy any shelf', async () => {
  const rama = await signIn('Rama')
  const piyush = await signIn('Piyush')
  const edit = (cookie, id, body) => call('books', { method: 'PATCH', cookie, query: `&id=${id}`, body })
  const ok = await edit(rama, 'malgudi-days-narayan', { note: 'Lent it twice already.', genre: 'Classics' })
  assert.equal(ok.status, 200)
  assert.equal((await ok.json()).book.genre, 'Classics')
  assert.equal((await edit(rama, 'dune-herbert', { note: 'Mine now' })).status, 403)
  assert.equal((await edit(piyush, 'malgudi-days-narayan', { note: 'Tidied by an admin.' })).status, 200)
  assert.equal((await edit(rama, 'no-such-book', { note: '' })).status, 404)

  // DELETE has no body, the way the My shelf page sends it.
  assert.equal((await call('books', { method: 'DELETE', cookie: rama, query: '&id=malgudi-days-narayan--rishi' })).status, 403)
  assert.equal((await call('books', { method: 'DELETE', cookie: rama, query: '&id=malgudi-days-narayan', origin: 'https://evil.example' })).status, 403)
  assert.equal((await call('books', { method: 'DELETE', cookie: rama, query: '&id=malgudi-days-narayan' })).status, 200)
  assert.ok(!(await loadLibrary(db)).books.some((b) => b.id === 'malgudi-days-narayan'))
})

test('sample books can be kept as real, or cleared away', async () => {
  const kept = await (await call('shelf', { method: 'POST', cookie: await signIn('Rama'), body: { action: 'confirm' } })).json()
  assert.ok(kept.books.length >= 5 && kept.books.every((b) => !b.sample))
  const cleared = await (await call('shelf', { method: 'POST', cookie: await signIn('Rishi'), body: { action: 'clear-samples' } })).json()
  assert.ok(cleared.books.every((b) => !b.sample))
  assert.equal((await loadLibrary(db)).books.filter((b) => b.owner === 'Rishi' && b.sample).length, 0)
})

test('admins manage members and make sign-in links; others can’t', async () => {
  const rama = await signIn('Rama')
  const piyush = await signIn('Piyush')
  const admin = (cookie, body) => call('admin', { method: 'POST', cookie, body })
  assert.equal((await call('admin', { cookie: rama })).status, 403)

  const { members } = await (await call('admin', { cookie: piyush })).json()
  assert.ok(members.find((m) => m.slug === 'piyush').isAdmin)
  assert.ok(members.find((m) => m.slug === 'rama').lastSeen)

  assert.deepEqual(await (await admin(piyush, { action: 'add-member', name: 'Zoya' })).json(), { slug: 'zoya' })
  assert.equal((await admin(piyush, { action: 'add-member', name: 'zoya' })).status, 409)

  const { link, message } = await (await admin(piyush, { action: 'invite', slug: 'zoya' })).json()
  assert.match(link, /^https:\/\/hyderabadreads\.fun\/join\/[A-Za-z0-9_-]{43}$/)
  assert.ok(message.includes(link) && message.startsWith('Hi Zoya!'))

  assert.equal((await admin(piyush, { action: 'remove-member', slug: 'piyush' })).status, 400)
  assert.equal((await admin(piyush, { action: 'set-admin', slug: 'piyush', isAdmin: false })).status, 400)
  assert.equal((await admin(piyush, { action: 'remove-member', slug: 'zoya' })).status, 200)
  // Zoya's link stops working once she's removed.
  assert.equal((await call('join', { query: `&token=${link.split('/').pop()}` })).headers.get('location'), '/me?invite=invalid')
})

test('signing out ends the session and clears both cookies', async () => {
  const cookie = await signIn('Rama')
  const res = await call('signout', { method: 'POST', cookie, body: {} })
  assert.equal(res.status, 200)
  assert.ok(res.headers.getSetCookie().every((c) => /Max-Age=0/.test(c)))
  assert.deepEqual(await (await call('me', { cookie })).json(), { member: null })
})
