// The server against a throwaway PGlite database: migrations and the starting
// shelves, server-rendered pages, feeds, link-preview images, and that local
// development routes addresses exactly as vercel.json does in production.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { localDatabase } from '../server/pglite.js'
import { migrate } from '../server/migrate.js'
import { loadLibrary } from '../server/library.js'
import { renderPage, routeFor } from '../server/page.js'
import { feed } from '../server/feeds.js'
import { pageResponse, feedResponse, ogResponse } from '../server/handlers.js'
import { compileRewrites, rewrite } from '../server/dev.js'
import { loadLibrary as loadClientLibrary, books as clientBooks, readerList, stats } from '../src/lib/model.js'

const db = await localDatabase()
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const notFound = '<!doctype html><title>Not on our shelves · Hyderabad Reads</title>'
const page = (route, slug) => pageResponse(new Request(`https://hyderabadreads.fun/api/page?route=${route}${slug ? `&slug=${slug}` : ''}`), { db, template, notFound })

test('a fresh database gets the starting shelves, all marked as samples', async () => {
  const data = await loadLibrary(db)
  assert.equal(data.members.length, 19)
  assert.equal(data.books.length, 95)
  assert.ok(data.books.every((b) => b.sample))
  assert.ok(data.members.some((m) => m.name === 'Piyush' && m.slug === 'piyush'))
  const dune = data.books.find((b) => b.id === 'dune-herbert')
  assert.equal(dune.owner, 'Piyush')
  assert.equal(dune.cover, '/covers/dune-herbert.webp')
  assert.equal(dune.pages, 608)
  assert.ok(data.meetups.length > 0)
  assert.ok(data.meetups.every((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date) && m.time))
  assert.equal(data.club.default_time, '1 to 4 PM')
})

test('migrating again changes nothing', async () => {
  assert.deepEqual(await migrate(db), { applied: [], seeded: false })
})

test('the home page carries the library data and the club’s structured data', async () => {
  const res = await page('home')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('cache-control'), /s-maxage=60/)
  const html = await res.text()
  assert.match(html, /<title>Hyderabad Reads · Our shared library<\/title>/)
  const data = JSON.parse(html.match(/<script type="application\/json" id="hr-data">(.*?)<\/script>/s)[1])
  assert.equal(data.books.length, 95)
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
  assert.ok(ld['@graph'].some((n) => n['@type'] === 'Organization'))
  assert.match(html, /<noscript><div class="library__noscript">/)
  assert.match(html, /href="\/book\/dune-herbert"/)
  assert.doesNotMatch(html, /<!--hr:/)
})

test('a book page gets its own title, link preview and Book data', async () => {
  const res = await page('book', 'dune-herbert')
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /<title>Dune by Frank Herbert · A sample book on Piyush’s shelf · Hyderabad Reads<\/title>/)
  assert.match(html, /<meta property="og:image" content="https:\/\/hyderabadreads.fun\/og\/book\/dune-herbert.jpg" \/>/)
  assert.match(html, /<link rel="canonical" href="https:\/\/hyderabadreads.fun\/book\/dune-herbert" \/>/)
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
  const book = ld['@graph'].find((n) => n['@type'] === 'Book')
  assert.equal(book.name, 'Dune')
  assert.equal(book.author.name, 'Frank Herbert')
})

test('a shelf page describes the member’s books', async () => {
  const html = await (await page('shelf', 'piyush')).text()
  assert.match(html, /<title>Piyush’s shelf · Hyderabad Reads<\/title>/)
  assert.match(html, /5 books on Piyush’s shelf at Hyderabad Reads: The God of Small Things/)
})

test('unknown books and shelves are 404s', async () => {
  assert.equal((await page('book', 'no-such-book')).status, 404)
  assert.equal((await page('shelf', 'nobody')).status, 404)
})

test('text from the database can’t break out of the page', () => {
  const data = {
    members: [{ name: 'Eve', slug: 'eve' }],
    books: [{ id: 'x', title: '</script><script>alert(1)</script>', author: '"><img src=x>', owner: 'Eve', genre: 'Other', language: 'English', blurb: '', note: '', added: '2026-10-21' }],
    meetups: [],
    club: {},
  }
  const { html } = renderPage({ template, notFound, data, route: routeFor('book', 'x') })
  assert.doesNotMatch(html, /<script>alert/)
  assert.doesNotMatch(html, /"><img src=x>/)
  assert.match(html, /\\u003c\/script>/)
})

test('feeds: llms.txt, llms-full.txt, library.json, sitemap and calendar', async () => {
  const data = await loadLibrary(db)
  const today = '2026-10-21'
  assert.match(feed('llms', data, today).body, /^# Hyderabad Reads/)
  assert.match(feed('llms-full', data, today).body, /### Piyush \(5 books\)/)
  const json = JSON.parse(feed('json', data, today).body)
  assert.equal(json.members.length, 19)
  assert.match(feed('sitemap', data, today).body, /<loc>https:\/\/hyderabadreads.fun\/book\/dune-herbert<\/loc>/)
  const ics = feed('ics', data, today)
  assert.equal(ics.type, 'text/calendar; charset=utf-8')
  assert.match(ics.body, /^BEGIN:VCALENDAR\r\n/)
  assert.ok(ics.body.split('\r\n').every((line) => Buffer.byteLength(line) <= 75), 'lines are folded at 75 bytes')
  assert.equal(feed('nope', data, today), null)
})

test('the calendar feed answers with the right headers', async () => {
  const res = await feedResponse(new Request('https://hyderabadreads.fun/api/feeds?feed=ics'), { db })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-disposition'), /hyderabad-reads-meetups\.ics/)
})

test('link previews are JPEGs, and unknown ones are 404s', async () => {
  const res = await ogResponse(new Request('https://hyderabadreads.fun/api/og?kind=book&file=dune-herbert.jpg'), { db })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'image/jpeg')
  const jpg = Buffer.from(await res.arrayBuffer())
  assert.deepEqual([...jpg.subarray(0, 2)], [0xff, 0xd8])
  const shelf = await ogResponse(new Request('https://hyderabadreads.fun/api/og?kind=shelf&file=piyush.jpg'), { db })
  assert.equal(shelf.status, 200)
  const missing = await ogResponse(new Request('https://hyderabadreads.fun/api/og?kind=book&file=nope.jpg'), { db })
  assert.equal(missing.status, 404)
})

test('local development routes addresses the same way vercel.json does', () => {
  const rules = compileRewrites(JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')).rewrites)
  const at = (path) => rewrite(rules, new URL(path, 'http://localhost'))?.toString().replace('http://localhost', '')
  assert.equal(at('/'), '/api/page?route=home')
  assert.equal(at('/book/dune-herbert'), '/api/page?route=book&slug=dune-herbert')
  assert.equal(at('/shelf/piyush'), '/api/page?route=shelf&slug=piyush')
  assert.equal(at('/og/book/dune-herbert.jpg'), '/api/og?kind=book&file=dune-herbert.jpg')
  assert.equal(at('/meetups.ics'), '/api/feeds?feed=ics')
  assert.equal(at('/src/main.js'), undefined)
})

test('the browser turns the page data into books with spines', async () => {
  loadClientLibrary(await loadLibrary(db))
  assert.equal(clientBooks.length, 95)
  assert.equal(readerList.length, 19)
  assert.equal(stats.samples, 95)
  const dune = clientBooks.find((b) => b.id === 'dune-herbert')
  assert.equal(dune.owner, 'Piyush')
  assert.ok(dune.h >= 176 && dune.t >= 24 && dune.style)
  assert.ok(Math.abs(dune.aspect - 265 / 475) < 1e-9)
})
