// Lending: requests, loans, returns, the rules that keep a book with one
// person at a time, what visitors versus members can see, and the digest.
import assert from 'node:assert/strict'
import test from 'node:test'
import { localDatabase } from '../server/pglite.js'
import { appResponse } from '../server/app.js'
import { createInvite } from '../server/auth.js'
import { loadLibrary } from '../server/library.js'
import { compose } from '../src/lib/digest-text.js'

const db = await localDatabase()
const ORIGIN = 'https://hyderabadreads.fun'

async function call(route, { method = 'GET', cookie, body } = {}) {
  const headers = new Headers({ origin: ORIGIN })
  if (cookie) headers.set('cookie', cookie)
  if (body !== undefined) headers.set('content-type', 'application/json')
  return appResponse(new Request(`${ORIGIN}/api/app?route=${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), { db })
}
async function signIn(name) {
  const { id } = await db.one('SELECT id FROM members WHERE name = $1', [name])
  const res = await call(`join&token=${await createInvite(db, id)}`)
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
}
const loans = async (cookie, body) => {
  const res = await call('loans', { method: 'POST', cookie, body })
  return { status: res.status, ...(await res.json()) }
}

const rama = await signIn('Rama')
const rishi = await signIn('Rishi')
const piyush = await signIn('Piyush')
// Rama's shelf is real; everyone else's is still samples.
await call('shelf', { method: 'POST', cookie: rama, body: { action: 'confirm' } })

test('a member asks for a book; it lands on the owner’s bring list for the next meetup', async () => {
  const asked = await loans(rishi, { action: 'request', book: 'the-guide-narayan' })
  assert.equal(asked.status, 200)
  assert.equal(asked.lending.asked.length, 1)
  assert.equal(asked.lending.asked[0].owner, 'Rama')

  const me = await (await call('me', { cookie: rama })).json()
  assert.deepEqual(me.lending.toBring.map((l) => [l.title, l.borrower]), [['The Guide', 'Rishi']])
  const { meetup } = me.lending.toBring[0]
  assert.ok(meetup === null || /^\d{4}-\d{2}-\d{2}$/.test(meetup))
})

test('you can’t ask twice, ask for your own book, or ask for a sample', async () => {
  assert.equal((await loans(rishi, { action: 'request', book: 'the-guide-narayan' })).status, 409)
  assert.equal((await loans(rama, { action: 'request', book: 'the-guide-narayan' })).status, 400)
  assert.equal((await loans(rama, { action: 'request', book: 'dune-herbert' })).status, 400)
})

test('the owner lends it; members see who has it, visitors only that it’s out', async () => {
  const me = await (await call('me', { cookie: rama })).json()
  const lent = await loans(rama, { action: 'lend', loan: me.lending.toBring[0].id })
  assert.equal(lent.status, 200)
  assert.deepEqual(lent.lending.lentOut.map((l) => [l.title, l.borrower, l.overdue]), [['The Guide', 'Rishi', false]])
  assert.deepEqual(lent.lending.out.find((l) => l.bookId === 'the-guide-narayan').borrower, 'Rishi')

  const visitor = (await loadLibrary(db)).books.find((b) => b.id === 'the-guide-narayan')
  assert.equal(visitor.onLoan, true)
  assert.ok(!('borrower' in visitor))
})

test('a book that’s out can’t go out again, but someone can queue for it', async () => {
  const got = await loans(piyush, { action: 'got', book: 'the-guide-narayan' })
  assert.equal(got.status, 409)
  assert.match(got.error, /still with Rishi/)
  assert.equal((await loans(piyush, { action: 'request', book: 'the-guide-narayan' })).status, 200)
  const me = await (await call('me', { cookie: rama })).json()
  assert.equal(me.lending.toBring.find((l) => l.borrower === 'Piyush').stillOut, true)
})

test('the borrower or the owner marks it returned; only they can', async () => {
  const me = await (await call('me', { cookie: rishi })).json()
  const loan = me.lending.borrowed[0]
  assert.equal((await loans(piyush, { action: 'return', loan: loan.id })).status, 400)
  const back = await loans(rishi, { action: 'return', loan: loan.id })
  assert.equal(back.status, 200)
  assert.equal(back.lending.borrowed.length, 0)
  assert.equal((await loadLibrary(db)).books.find((b) => b.id === 'the-guide-narayan').onLoan, false)
})

test('scanning a bookplate: "I’ve got it" turns a request into a loan, or starts one', async () => {
  const got = await loans(piyush, { action: 'got', book: 'the-guide-narayan' })
  assert.equal(got.status, 200)
  assert.equal(got.owner, 'Rama')
  assert.equal(got.lending.asked.length, 0, 'the request became the loan')
  assert.equal(got.lending.borrowed[0].title, 'The Guide')
  // A mistaken scan: the owner undoes it.
  const loan = (await (await call('me', { cookie: rama })).json()).lending.lentOut[0]
  assert.equal((await loans(rama, { action: 'undo', loan: loan.id })).status, 200)
})

test('owners can lend straight to a member, or decline a request; borrowers can cancel', async () => {
  const direct = await loans(rama, { action: 'lend', book: 'gitanjali-tagore', to: 'rishi' })
  assert.equal(direct.status, 200)
  assert.ok(direct.lending.lentOut.some((l) => l.title === 'Gitanjali' && l.borrower === 'Rishi'))
  assert.equal((await loans(rama, { action: 'lend', book: 'gitanjali-tagore', to: 'piyush' })).status, 409)
  assert.equal((await loans(rishi, { action: 'lend', book: 'gitanjali-tagore', to: 'piyush' })).status, 403)

  await loans(rishi, { action: 'request', book: 'jaya-pattanaik' })
  const req = (await (await call('me', { cookie: rama })).json()).lending.toBring.find((l) => l.title === 'Jaya')
  assert.equal((await loans(rama, { action: 'decline', loan: req.id })).status, 200)

  await loans(piyush, { action: 'request', book: 'the-room-on-the-roof-bond' })
  const mine = (await (await call('me', { cookie: piyush })).json()).lending.asked.find((l) => l.title === 'The Room on the Roof')
  assert.equal((await loans(rama, { action: 'cancel', loan: mine.id })).status, 400)
  assert.equal((await loans(piyush, { action: 'cancel', loan: mine.id })).status, 200)
})

test('books out longer than the club allows are flagged, and make the digest', async () => {
  await db.query(`UPDATE loans SET lent_at = now() - interval '50 days' WHERE status = 'lent'`)
  const me = await (await call('me', { cookie: rishi })).json()
  assert.equal(me.lending.borrowed[0].overdue, true)

  const digest = await (await call('digest', { cookie: rishi })).json()
  assert.ok(digest.newBooks.length >= 5, 'Rama’s confirmed books are new this week')
  assert.deepEqual(digest.overdue.map((l) => [l.title, l.owner, l.borrower]), [['Gitanjali', 'Rama', 'Rishi']])
  assert.equal((await call('digest')).status, 401)

  const text = compose({ ...digest, meetups: [{ date: '2026-10-24', venue: 'Chilaka', area: 'Jubilee Hills', time: '1 to 4 PM' }] }, ORIGIN)
  assert.match(text, /^📚 \*Hyderabad Reads this week\*/)
  assert.match(text, /• Sat 24 Oct · Chilaka, Jubilee Hills · 1 to 4 PM/)
  assert.match(text, /• Gitanjali \(Rama’s\), with Rishi since/)
  assert.ok(text.endsWith('Browse the library: https://hyderabadreads.fun'))
})
