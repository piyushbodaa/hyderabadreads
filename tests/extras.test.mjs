// The Wanted shelf, the club in numbers, and a member's year.
import assert from 'node:assert/strict'
import test from 'node:test'
import { localDatabase } from '../server/pglite.js'
import { appResponse } from '../server/app.js'
import { createInvite } from '../server/auth.js'
import { loadLibrary } from '../server/library.js'

const db = await localDatabase()
const ORIGIN = 'https://hyderabadreads.fun'

async function call(route, { method = 'GET', cookie, body, query = '' } = {}) {
  const headers = new Headers({ origin: ORIGIN })
  if (cookie) headers.set('cookie', cookie)
  if (body !== undefined) headers.set('content-type', 'application/json')
  return appResponse(new Request(`${ORIGIN}/api/app?route=${route}${query}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), { db })
}
async function signIn(name) {
  const { id } = await db.one('SELECT id FROM members WHERE name = $1', [name])
  const res = await call(`join&token=${await createInvite(db, id)}`)
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
}
const rama = await signIn('Rama')
const rishi = await signIn('Rishi')

test('members put books on the Wanted shelf; everyone sees who’s looking', async () => {
  const res = await call('wishes', { method: 'POST', cookie: rama, body: { title: 'The Overstory', author: 'Richard Powers', coverId: 8231856, olKey: '/works/OL19729285W' } })
  assert.equal(res.status, 201)
  assert.equal((await res.json()).wishes.length, 1)
  assert.equal((await call('wishes', { method: 'POST', cookie: rama, body: { title: 'the overstory' } })).status, 409)
  assert.equal((await call('wishes', { method: 'POST', body: { title: 'Anything' } })).status, 401)
  const { wishes } = await loadLibrary(db)
  assert.deepEqual(
    wishes.map((w) => [w.title, w.wisher, w.coverId]),
    [['The Overstory', 'Rama', 8231856]],
  )
  assert.ok(!('id' in wishes[0]))
})

test('only the member who asked (or an admin) takes a wish off the shelf', async () => {
  const [mine] = (await (await call('me', { cookie: rama })).json()).wishes
  assert.equal((await call('wishes', { method: 'DELETE', cookie: rishi, query: `&id=${mine.id}` })).status, 403)
  assert.equal((await call('wishes', { method: 'DELETE', cookie: rama, query: `&id=${mine.id}` })).status, 200)
  assert.equal((await loadLibrary(db)).wishes.length, 0)
})

test('the club in numbers counts real books only, and names lenders to members only', async () => {
  const empty = await (await call('stats')).json()
  assert.equal(empty.totals.books, 0, 'samples don’t count')
  await call('shelf', { method: 'POST', cookie: rama, body: { action: 'confirm' } })
  await call('loans', { method: 'POST', cookie: rama, body: { action: 'lend', book: 'the-guide-narayan', to: 'rishi' } })

  const visitor = await (await call('stats')).json()
  assert.equal(visitor.totals.books, 5)
  assert.equal(visitor.totals.loans, 1)
  assert.equal(visitor.totals.out, 1)
  assert.deepEqual(visitor.mostBorrowed.map((b) => b.title), ['The Guide'])
  assert.ok(visitor.genres.every((g) => g.n > 0))
  assert.equal(visitor.lenders, undefined)

  const member = await (await call('stats', { cookie: rishi })).json()
  assert.deepEqual(member.lenders, [{ name: 'Rama', n: 1 }])
})

test('a member’s year, and the card to share it, are for that member only', async () => {
  const year = new Date().getFullYear()
  const mine = await (await call('year', { cookie: rama, query: `&y=${year}` })).json()
  assert.equal(mine.name, 'Rama')
  assert.equal(mine.lent.n, 1)
  assert.equal(mine.lent.people, 1)
  assert.equal(mine.added.n, 5)
  assert.equal(mine.mostLent.title, 'The Guide')
  const theirs = await (await call('year', { cookie: rishi, query: `&y=${year}` })).json()
  assert.equal(theirs.borrowed.n, 1)
  assert.equal(theirs.topGenre, 'Fiction')

  assert.equal((await call('year', { query: `&y=${year}` })).status, 401)
  assert.equal((await call('year', { cookie: rama, query: '&y=1999' })).status, 400)

  const card = await call('year-card', { cookie: rama, query: `&y=${year}` })
  assert.equal(card.status, 200)
  assert.equal(card.headers.get('content-type'), 'image/jpeg')
  assert.match(card.headers.get('cache-control'), /private/)
  const jpg = Buffer.from(await card.arrayBuffer())
  assert.deepEqual([...jpg.subarray(0, 2)], [0xff, 0xd8])
  assert.equal((await call('year-card', { query: `&y=${year}` })).status, 401)
})
