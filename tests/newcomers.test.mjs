// Newcomers: the questions and answers (on the page and as schema.org data),
// and meetup photos uploaded by admins.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import sharp from 'sharp'
import { localDatabase } from '../server/pglite.js'
import { appResponse } from '../server/app.js'
import { pageResponse } from '../server/handlers.js'
import { createInvite } from '../server/auth.js'
import { loadLibrary } from '../server/library.js'
import { faq } from '../src/lib/faq.js'

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

test('the answers only say what the club has confirmed, and include the fee once it’s set', () => {
  const without = faq({ club: {}, meetups: [{ venue: 'Chilaka', area: 'Jubilee Hills' }, { venue: 'Chilaka', area: 'Jubilee Hills' }] })
  assert.equal(without.find((x) => x.q === 'What does it cost?').a, 'There’s a small fee to attend.')
  assert.match(without.find((x) => x.q === 'Where are the meetups?').a, /Chilaka in Jubilee Hills\. The calendar/)
  assert.equal(without.find((x) => x.q === 'Do I need to sign up first?').a, 'No. Just come along to any meetup on the calendar.')
  const withFee = faq({ club: { fee: '₹100' } })
  assert.equal(withFee.find((x) => x.q === 'What does it cost?').a, 'There’s a small fee to attend: ₹100.')
})

test('the home page carries the questions as FAQPage data; book pages don’t', async () => {
  const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const ld = async (route, slug) => {
    const html = await (await pageResponse(new Request(`${ORIGIN}/api/page?route=${route}${slug ? `&slug=${slug}` : ''}`), { db, template, notFound: '' })).text()
    return JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph']
  }
  const home = (await ld('home')).find((n) => n['@type'] === 'FAQPage')
  assert.ok(home.mainEntity.some((q) => q.name === 'What happens at a meetup?' && /reads quietly/.test(q.acceptedAnswer.text)))
  assert.equal((await ld('book', 'dune-herbert')).some((n) => n['@type'] === 'FAQPage'), false)
})

test('admins upload meetup photos; the site keeps a large copy and a thumbnail', async () => {
  const piyush = await signIn('Piyush')
  const jpeg = await sharp(randomBytes(800 * 600 * 3), { raw: { width: 800, height: 600, channels: 3 } }).jpeg().toBuffer()
  const image = `data:image/jpeg;base64,${jpeg.toString('base64')}`
  assert.equal((await call('admin', { method: 'POST', cookie: await signIn('Rama'), body: { action: 'add-photo', image } })).status, 403)

  const res = await call('admin', { method: 'POST', cookie: piyush, body: { action: 'add-photo', image, caption: '  Reading at  Chilaka ' } })
  assert.equal(res.status, 200)
  const added = await res.json()
  assert.match(added.image, /^\/media\/[a-f0-9]{64}\.webp$/)

  const { photos } = await loadLibrary(db)
  assert.equal(photos.length, 1)
  assert.equal(photos[0].caption, 'Reading at Chilaka')
  assert.equal(photos[0].w, 800, 'small photos aren’t enlarged')
  assert.ok(!('id' in photos[0]), 'visitors don’t need database ids')

  const bad = await call('admin', { method: 'POST', cookie: piyush, body: { action: 'add-photo', image: 'data:text/html;base64,PHNjcmlwdD4=' } })
  assert.equal(bad.status, 400)

  const { photos: adminPhotos } = await (await call('admin', { cookie: piyush })).json()
  assert.equal((await call('admin', { method: 'POST', cookie: piyush, body: { action: 'remove-photo', id: adminPhotos[0].id } })).status, 200)
  assert.equal((await loadLibrary(db)).photos.length, 0)
})
