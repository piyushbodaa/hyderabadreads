// The calendar: admins adding and changing meetups, venues and club details,
// the per-meetup calendar file, and links into people's own calendars.
import assert from 'node:assert/strict'
import test from 'node:test'
import { localDatabase } from '../server/pglite.js'
import { appResponse } from '../server/app.js'
import { feedResponse } from '../server/handlers.js'
import { createInvite } from '../server/auth.js'
import { loadLibrary } from '../server/library.js'
import { meetupClock } from '../src/lib/meetup-time.js'
import { googleEventLink, subscribeLinks, icsLink } from '../src/lib/calendar-links.js'

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
const piyush = await signIn('Piyush')
const admin = async (body, cookie = piyush) => {
  const res = await call('admin', { method: 'POST', cookie, body })
  return { status: res.status, ...(await res.json()) }
}
// Far enough ahead to always be "coming up".
const year = new Date().getFullYear() + 1

test('only admins change the calendar', async () => {
  assert.equal((await admin({ action: 'add-meetups', dates: [`${year}-01-03`], venue: 'Chilaka' }, await signIn('Rama'))).status, 403)
})

test('admins add several meetups at once, and the same day twice is ignored', async () => {
  const res = await admin({ action: 'add-meetups', dates: [`${year}-01-03`, `${year}-01-04`, `${year}-01-03`, 'not-a-date'], venue: 'Chilaka', note: 'Upstairs' })
  assert.deepEqual(res, { status: 200, added: 2 })
  assert.equal((await admin({ action: 'add-meetups', dates: [`${year}-01-03`], venue: 'Chilaka' })).added, 1)
  const { meetups } = await (await call('admin', { cookie: piyush })).json()
  assert.equal(meetups.filter((m) => m.date === `${year}-01-03`).length, 1)
  assert.equal((await admin({ action: 'add-meetups', dates: [], venue: 'Chilaka' })).status, 400)
  assert.equal((await admin({ action: 'add-meetups', dates: [`${year}-01-10`], venue: 'Nowhere' })).status, 400)
})

test('a cancelled meetup stays listed as cancelled, and isn’t the "next" one', async () => {
  const { meetups } = await (await call('admin', { cookie: piyush })).json()
  const jan3 = meetups.find((m) => m.date === `${year}-01-03`)
  assert.equal((await admin({ action: 'update-meetup', id: jan3.id, cancelled: true })).status, 200)
  const data = await loadLibrary(db)
  assert.equal(data.meetups.find((m) => m.date === `${year}-01-03`).cancelled, true)
  assert.equal((await admin({ action: 'update-meetup', id: jan3.id, cancelled: false, time: '2 to 5 PM' })).status, 200)
  assert.equal((await loadLibrary(db)).meetups.find((m) => m.date === `${year}-01-03`).time, '2 to 5 PM')
})

test('venues and club details', async () => {
  assert.equal((await admin({ action: 'add-venue', name: 'Lamakaan', area: 'Banjara Hills' })).status, 200)
  assert.equal((await admin({ action: 'add-venue', name: 'Lamakaan' })).status, 409)
  assert.equal((await admin({ action: 'set-settings', settings: { fee: '₹100', overdue_weeks: '8', nonsense: 'x' } })).status, 200)
  const { settings, venues } = await (await call('admin', { cookie: piyush })).json()
  assert.equal(settings.fee, '₹100')
  assert.equal(settings.overdue_weeks, '8')
  assert.equal(settings.nonsense, undefined)
  assert.ok(venues.some((v) => v.name === 'Lamakaan' && v.area === 'Banjara Hills'))
  assert.equal((await admin({ action: 'set-settings', settings: { overdue_weeks: '0' } })).status, 400)
  assert.equal((await admin({ action: 'set-settings', settings: { instagram: 'https://evil.example' } })).status, 400)
})

test('"Add to calendar" downloads just that day’s meetup', async () => {
  const res = await feedResponse(new Request(`${ORIGIN}/api/feeds?feed=ics&only=${year}-01-04`), { db })
  assert.match(res.headers.get('content-disposition'), new RegExp(`attachment; filename="hyderabad-reads-${year}-01-04.ics"`))
  const body = await res.text()
  assert.equal(body.match(/BEGIN:VEVENT/g).length, 1)
  assert.match(body, /DESCRIPTION:.*Upstairs/s)
  // Anything that isn't a date is ignored, and nothing odd reaches the header.
  const odd = await feedResponse(new Request(`${ORIGIN}/api/feeds?feed=ics&only=x%0d%0aSet-Cookie:a=b`), { db })
  assert.match(odd.headers.get('content-disposition'), /filename="hyderabad-reads-meetups.ics"/)
})

test('meetup times become calendar times in Hyderabad', () => {
  assert.deepEqual(meetupClock('2026-10-24', '1 to 4 PM'), { start: '2026-10-24T13:00:00+05:30', end: '2026-10-24T16:00:00+05:30' })
  assert.deepEqual(meetupClock('2026-10-25', '2:30 to 5:30 PM'), { start: '2026-10-25T14:30:00+05:30', end: '2026-10-25T17:30:00+05:30' })
  assert.deepEqual(meetupClock('2026-10-25', '11 to 1 PM'), { start: '2026-10-25T11:00:00+05:30', end: '2026-10-25T13:00:00+05:30' })
  assert.deepEqual(meetupClock('2026-10-25', 'afternoon'), {})
})

test('links into Google Calendar, Apple and Outlook', () => {
  const m = { date: '2026-10-24', venue: 'Chilaka', area: 'Jubilee Hills', time: '1 to 4 PM' }
  const google = new URL(googleEventLink(m, ORIGIN))
  assert.equal(google.searchParams.get('dates'), '20261024T073000Z/20261024T103000Z')
  assert.equal(google.searchParams.get('location'), 'Chilaka, Jubilee Hills, Hyderabad')
  assert.equal(icsLink(m), '/meetups.ics?only=2026-10-24')
  assert.deepEqual(subscribeLinks(ORIGIN).webcal, 'webcal://hyderabadreads.fun/meetups.ics')
  assert.match(subscribeLinks(ORIGIN).google, /cid=webcal%3A%2F%2Fhyderabadreads\.fun%2Fmeetups\.ics/)
})
