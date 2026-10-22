// The club's blog: reading members' feeds (RSS and Atom, as Substack, Medium,
// WordPress and Blogger write them), finding a blog's feed from any address on
// it, keeping private addresses out of reach, what members and admins can do,
// and the pages and the feed that show the posts. Against a throwaway
// database, with a stand-in for the web.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import sharp from 'sharp'
import { localDatabase } from '../server/pglite.js'
import { appResponse } from '../server/app.js'
import { createInvite } from '../server/auth.js'
import { parseFeed, findFeed, knownFeed, blogAddress, feedLinks, excerptOf } from '../server/rss.js'
import { checkUrl, isPublicAddress, fetchPublic } from '../server/safe-fetch.js'
import { loadBlog, refreshDue } from '../server/blogs.js'
import { loadLibrary } from '../server/library.js'
import { renderBlog, renderPage, routeFor } from '../server/page.js'
import { pageResponse, feedResponse } from '../server/handlers.js'
import { feed } from '../server/feeds.js'
import { compileRewrites, rewrite } from '../server/dev.js'

const ORIGIN = 'https://hyderabadreads.fun'

// ── Feeds, as the platforms write them ────────────────────────────────────

const SUBSTACK = `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0"><channel>
<title><![CDATA[Bookish & Becoming]]></title><link>https://reader.substack.com</link><generator>Substack</generator>
<image><url>https://substackcdn.com/logo.png</url><title>Not the blog's title</title><link>https://elsewhere.example</link></image>
<item><title><![CDATA[Hello, Me]]></title><description><![CDATA[Hi, I’m new here.]]></description><link>https://reader.substack.com/p/hello?utm_source=rss&amp;utm_medium=feed</link><guid isPermaLink="false">hello</guid><pubDate>Thu, 20 Aug 2026 05:54:38 GMT</pubDate>
<content:encoded><![CDATA[<p>Hi, I’m new here, and this is the very first post on my little blog about the books I read.</p>]]></content:encoded></item>
<item><title><![CDATA[Uncertainty can be Beautiful.]]></title><description><![CDATA[My head is always a mess, complicating the simplest questions into big scary monsters.]]></description><link>https://reader.substack.com/p/uncertainty</link><guid isPermaLink="false">https://reader.substack.com/p/uncertainty</guid><dc:creator><![CDATA[Bookish & Becoming]]></dc:creator><pubDate>Tue, 20 Oct 2026 12:44:48 GMT</pubDate>
<enclosure url="https://substackcdn.com/image/fetch/uncertainty.jpeg" length="0" type="image/jpeg"/>
<content:encoded><![CDATA[<p>My head is always a mess.</p><p>${'word '.repeat(700)}</p>]]></content:encoded></item>
</channel></rss>`

const MEDIUM = `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0"><channel>
<title><![CDATA[Stories by Ev on Medium]]></title><link>https://medium.com/@ev?source=rss-268314bb7e7e------2</link><generator>Medium</generator>
<item><title><![CDATA[Making “Social” Social Again]]></title><link>https://ev.medium.com/making-social-0126?source=rss-268314bb7e7e------2</link><guid isPermaLink="false">https://medium.com/p/0126</guid><pubDate>Thu, 12 Dec 2024 17:11:33 GMT</pubDate>
<content:encoded><![CDATA[<figure><img alt="" src="https://cdn-images-1.medium.com/max/1024/1*abc.jpeg" /><figcaption>Mozi, our new app</figcaption></figure><h4>Announcing Mozi</h4><p><a href="https://nytimes.example/x">Unveils New Social App</a></p><p>I think it’s tough to appreciate how much relationships determine the course of our lives &mdash; and how randomly many of them come to be.</p><img src="https://medium.com/_/stat?event=post.clientViewed" width="1" height="1" alt="">]]></content:encoded></item>
</channel></rss>`

const wordpress = (extra = '') => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/"><channel>
<title>Chai &amp; Chapters</title><link>https://chai.wordpress.com</link><generator>http://wordpress.com/</generator>
${extra}<item><title>Reading &#8220;The Guide&#8221; again</title><link>https://chai.wordpress.com/2026/10/01/the-guide/</link><guid isPermaLink="false">https://chai.wordpress.com/?p=12</guid><pubDate>Thu, 01 Oct 2026 08:00:00 +0000</pubDate>
<description><![CDATA[Narayan’s Raju is a guide, a lover, a convict and a saint, and I keep coming back to him every few years. [&#8230;]<p>The post <a href="https://chai.wordpress.com/x">Reading The Guide again</a> appeared first on <a href="https://chai.wordpress.com">Chai &amp; Chapters</a>.</p>]]></description>
<media:content url="https://chai.files.wordpress.com/2026/10/guide.jpg" medium="image"><media:title type="html">The Guide</media:title></media:content>
<media:content url="https://0.gravatar.com/avatar/abc?s=96" medium="image" /></item>
</channel></rss>`

const BLOGGER = `<?xml version='1.0' encoding='UTF-8'?><feed xmlns='http://www.w3.org/2005/Atom' xmlns:media="http://search.yahoo.com/mrss/">
<title type='text'>Deccan Notes</title><link rel='self' href='https://deccan.blogspot.com/feeds/posts/default'/><link rel='alternate' type='text/html' href='https://deccan.blogspot.com/'/>
<generator version='7.00' uri='https://www.blogger.com'>Blogger</generator><author><name>Not the title</name></author>
<entry><id>tag:blogger.com,1999:blog-1.post-2</id><published>2026-03-31T11:25:00.000-07:00</published><title type='text'>Monsoon books &amp; more</title>
<content type='html'>&lt;div&gt;Rain, chai and a stack of books.&lt;br /&gt;The best kind of weekend, honestly, for a long read by the window.&lt;/div&gt;</content>
<link rel='edit' href='https://www.blogger.com/feeds/1/posts/default/2'/><link rel='alternate' type='text/html' href='https://deccan.blogspot.com/2026/03/monsoon.html' title='Monsoon books'/>
<media:thumbnail url="https://blogger.googleusercontent.com/img/b/abc/s72-c/rain.jpg" height="72" width="72"/></entry>
</feed>`

test('a Substack feed: newest first, with the picture, length and a clean link', () => {
  const blog = parseFeed(SUBSTACK, 'https://reader.substack.com/feed')
  assert.equal(blog.title, 'Bookish & Becoming')
  assert.equal(blog.link, 'https://reader.substack.com/')
  assert.deepEqual(blog.posts.map((p) => p.title), ['Uncertainty can be Beautiful.', 'Hello, Me'])
  const [first, second] = blog.posts
  assert.equal(first.image, 'https://substackcdn.com/image/fetch/uncertainty.jpeg')
  assert.equal(first.published, '2026-10-20T12:44:48.000Z')
  assert.ok(first.words > 700)
  assert.equal(first.excerpt, 'My head is always a mess, complicating the simplest questions into big scary monsters.')
  assert.equal(second.url, 'https://reader.substack.com/p/hello', 'tracking is dropped')
  assert.equal(second.guid, 'hello')
  assert.equal(second.image, null)
  // A summary too short to say anything gives way to the post's first lines.
  assert.match(second.excerpt, /^Hi, I’m new here, and this is the very first post/)
})

test('a Medium feed: the picture, not the tracking pixel; paragraphs, not captions', () => {
  const [post] = parseFeed(MEDIUM, 'https://medium.com/feed/@ev').posts
  assert.equal(post.url, 'https://ev.medium.com/making-social-0126')
  assert.equal(post.image, 'https://cdn-images-1.medium.com/max/1024/1*abc.jpeg')
  assert.equal(post.excerpt, 'I think it’s tough to appreciate how much relationships determine the course of our lives — and how randomly many of them come to be.')
})

test('a WordPress feed: entities decoded, "appeared first on" dropped, no avatars', () => {
  const blog = parseFeed(wordpress(), 'https://chai.wordpress.com/feed/')
  assert.equal(blog.title, 'Chai & Chapters')
  const [post] = blog.posts
  assert.equal(post.title, 'Reading “The Guide” again')
  assert.equal(post.excerpt, 'Narayan’s Raju is a guide, a lover, a convict and a saint, and I keep coming back to him every few years.…')
  assert.equal(post.image, 'https://chai.files.wordpress.com/2026/10/guide.jpg')
  assert.equal(post.words, null, 'no full text in the feed, so no length')
})

test('an Atom feed (Blogger): the page link, the date, and the picture at full size', () => {
  const blog = parseFeed(BLOGGER, 'https://deccan.blogspot.com/feeds/posts/default')
  assert.equal(blog.title, 'Deccan Notes')
  assert.equal(blog.link, 'https://deccan.blogspot.com/')
  const [post] = blog.posts
  assert.equal(post.url, 'https://deccan.blogspot.com/2026/03/monsoon.html')
  assert.equal(post.title, 'Monsoon books & more')
  assert.equal(post.published, '2026-03-31T18:25:00.000Z')
  assert.equal(post.image, 'https://blogger.googleusercontent.com/img/b/abc/s1200/rain.jpg')
  assert.match(post.excerpt, /^Rain, chai and a stack of books\. The best kind of weekend/)
})

test('a page that isn’t a feed is nothing, and posts that can’t be linked to are skipped', () => {
  assert.equal(parseFeed('<!doctype html><html><body>Hello</body></html>'), null)
  const sneaky = `<rss version="2.0"><channel><title>x</title>
    <item><title>&lt;script&gt;alert(1)&lt;/script&gt;Hi</title><link>javascript:alert(1)</link></item>
    <item><title>&lt;b&gt;Bold&lt;/b&gt; move</title><link>https://ok.example/post</link></item></channel></rss>`
  const { posts } = parseFeed(sneaky, 'https://ok.example/feed')
  assert.deepEqual(posts.map((p) => [p.title, p.url]), [['Bold move', 'https://ok.example/post']])
  assert.equal(excerptOf('A long enough summary of the post, with more words than sixty characters. Continue reading →', ''), 'A long enough summary of the post, with more words than sixty characters.')
})

// ── Finding a blog's feed ─────────────────────────────────────────────────

test('any address on a blog leads to its feed', () => {
  const at = (href) => knownFeed(blogAddress(href))
  assert.equal(
    blogAddress('literaryserene23.substack.com/p/uncertainty-can-be-beautiful?utm_source=share&utm_medium=android&r=79zs3n').href,
    'https://literaryserene23.substack.com/p/uncertainty-can-be-beautiful',
  )
  assert.equal(at('https://literaryserene23.substack.com/p/uncertainty-can-be-beautiful'), 'https://literaryserene23.substack.com/feed')
  assert.equal(at('https://substack.com/@literaryserene23'), 'https://literaryserene23.substack.com/feed')
  assert.equal(at('medium.com/@ev/making-social-0126'), 'https://medium.com/feed/@ev')
  assert.equal(at('https://medium.com/the-story/some-post'), 'https://medium.com/feed/the-story')
  assert.equal(at('https://ev.medium.com/making-social-0126'), 'https://ev.medium.com/feed')
  assert.equal(at('https://chai.wordpress.com/2026/10/01/the-guide/'), 'https://chai.wordpress.com/feed/')
  assert.equal(at('deccan.blogspot.com/2026/03/monsoon.html'), 'https://deccan.blogspot.com/feeds/posts/default')
  assert.equal(at('https://own.example/blog'), null)
  assert.throws(() => blogAddress('  '), { status: 400 })
  const page = `<link rel="alternate" type="application/rss+xml" title="Comments Feed" href="/comments/feed/">
    <link rel="alternate stylesheet" href="/x.css"><link rel="alternate" type="application/rss+xml" title="Posts" href="/feed/">`
  assert.deepEqual(feedLinks(page, 'https://own.example/2026/post'), ['https://own.example/feed/'])
})

// ── Only the public web ───────────────────────────────────────────────────

test('only public internet addresses can be reached', async () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700::6810:84e5', '::ffff:8.8.8.8']) assert.ok(isPublicAddress(ip), ip)
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fd00::1', 'fe80::1', '64:ff9b::a00:1', '2001:db8::1', 'not an ip']) {
    assert.ok(!isPublicAddress(ip), ip)
  }
  for (const href of ['http://localhost/', 'http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data/', 'http://intranet/', 'https://printer.local/', 'ftp://example.com/', 'file:///etc/passwd', 'https://example.com:8443/', 'https://me:secret@example.com/']) {
    assert.throws(() => checkUrl(href), { status: 400 }, href)
  }
  assert.equal(checkUrl('https://reader.substack.com/feed').hostname, 'reader.substack.com')

  // A redirect is checked like the address itself.
  const redirect = async () => new Response(null, { status: 302, headers: { Location: 'http://10.0.0.5/feed' } })
  await assert.rejects(fetchPublic('https://sneaky.example/feed', { fetch: redirect }), { status: 400 })
  const loop = async (url) => new Response(null, { status: 301, headers: { Location: `${url}x` } })
  await assert.rejects(fetchPublic('https://loop.example/', { fetch: loop }), { status: 502 })
  const huge = async () => new Response('x'.repeat(5000))
  await assert.rejects(fetchPublic('https://huge.example/', { fetch: huge, maxBytes: 1000 }), { status: 413 })
})

// ── Members, admins and the pages ─────────────────────────────────────────

const db = await localDatabase()
const picture = await sharp({ create: { width: 1200, height: 750, channels: 3, background: '#7a1f2b' } }).jpeg().toBuffer()
const web = new Map([
  ['https://reader.substack.com/feed', ['application/xml', SUBSTACK]],
  ['https://substackcdn.com/image/fetch/uncertainty.jpeg', ['image/jpeg', picture]],
  ['https://chai.wordpress.com/feed/', ['application/rss+xml', wordpress()]],
  ['https://chai.files.wordpress.com/2026/10/guide.jpg', ['image/jpeg', picture]],
  ['https://own.example/', ['text/html', '<html><head><link rel="alternate" type="application/atom+xml" href="/atom.xml"></head></html>']],
  ['https://own.example/atom.xml', ['application/atom+xml', BLOGGER]],
])
const down = new Set()
const calls = []
async function fakeFetch(url) {
  calls.push(url)
  if (down.has(url)) throw new TypeError('fetch failed')
  const page = web.get(url)
  return page ? new Response(page[1], { headers: { 'Content-Type': page[0] } }) : new Response('Not found', { status: 404 })
}

async function call(route, { method = 'GET', cookie, body, query = '', headers = {} } = {}) {
  const h = new Headers(headers)
  if (cookie) h.set('cookie', cookie)
  if (method !== 'GET') h.set('origin', ORIGIN)
  if (body !== undefined) h.set('content-type', 'application/json')
  const request = new Request(`${ORIGIN}/api/app?route=${route}${query}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  return appResponse(request, { db, fetch: fakeFetch })
}

async function signIn(name) {
  const { id } = await db.one('SELECT id FROM members WHERE name = $1', [name])
  const res = await call('join', { query: `&token=${await createInvite(db, id)}` })
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
}

const blogs = (cookie, body) => call('blogs', { method: 'POST', cookie, body })

test('a member adds their blog from a shared link, and its posts come in with pictures', async () => {
  assert.equal((await blogs('', { action: 'add', url: 'reader.substack.com' })).status, 401)
  const swapnil = await signIn('Swapnil')
  const res = await blogs(swapnil, { action: 'add', url: 'https://reader.substack.com/p/uncertainty?utm_source=share&utm_medium=android&r=79zs3n' })
  assert.equal(res.status, 200)
  const { writing, added } = await res.json()
  assert.equal(added.posts, 2)
  assert.equal(writing.blogs.length, 1)
  assert.equal(writing.blogs[0].title, 'Bookish & Becoming')
  assert.equal(writing.blogs[0].platform, 'Substack')
  assert.equal(writing.blogs[0].posts, 2)
  assert.deepEqual(writing.posts.map((p) => p.title), ['Uncertainty can be Beautiful.', 'Hello, Me'])

  const { posts } = await loadBlog(db)
  const [lead, second] = posts
  assert.match(lead.image, /^\/media\/[a-f0-9]{64}\.webp$/)
  assert.deepEqual([lead.w, lead.h], [1000, 625])
  assert.equal(lead.writer, 'Swapnil')
  assert.equal(lead.writerSlug, 'swapnil')
  assert.equal(second.image, null)
  // My shelf lists the blog too.
  const me = await (await call('me', { cookie: swapnil })).json()
  assert.equal(me.writing.blogs[0].feed, 'https://reader.substack.com/feed')
})

test('a blog is on the site once, and members can only change their own', async () => {
  const swapnil = await signIn('Swapnil')
  const rama = await signIn('Rama')
  assert.equal((await blogs(swapnil, { action: 'add', url: 'reader.substack.com' })).status, 409)
  const taken = await blogs(rama, { action: 'add', url: 'https://reader.substack.com/' })
  assert.equal(taken.status, 409)
  assert.match((await taken.json()).error, /as Swapnil’s/)
  assert.equal((await blogs(rama, { action: 'add', member: 'swapnil', url: 'own.example' })).status, 403)
  const id = (await db.one(`SELECT id FROM blogs WHERE feed_url = 'https://reader.substack.com/feed'`)).id
  assert.equal((await blogs(rama, { action: 'remove', id })).status, 403)
  const post = (await db.one(`SELECT id FROM posts WHERE url = 'https://reader.substack.com/p/hello'`)).id
  assert.equal((await blogs(rama, { action: 'hide', post })).status, 403)
  // Checked a moment ago: "Check now" waits a little.
  assert.equal((await blogs(swapnil, { action: 'check', id })).status, 429)
})

test('addresses that aren’t blogs get a plain answer', async () => {
  const rama = await signIn('Rama')
  const local = await blogs(rama, { action: 'add', url: 'http://192.168.1.10/blog' })
  assert.equal(local.status, 400)
  assert.match((await local.json()).error, /public internet/)
  const none = await blogs(rama, { action: 'add', url: 'https://nothing-here.example/' })
  assert.equal(none.status, 422)
  // Found through the page's <link rel="alternate">, on the blog's own site.
  const own = await blogs(rama, { action: 'add', url: 'own.example' })
  assert.equal(own.status, 200)
  assert.equal((await own.json()).writing.blogs[0].platform, 'Blogger')
  await blogs(rama, { action: 'remove', id: (await db.one(`SELECT id FROM blogs WHERE feed_url = 'https://own.example/atom.xml'`)).id })
})

test('admins add a blog for any member, see every blog, and can hide a post', async () => {
  const piyush = await signIn('Piyush')
  const res = await blogs(piyush, { action: 'add', member: 'rama', url: 'chai.wordpress.com' })
  assert.equal(res.status, 200)
  const admin = await (await call('admin', { cookie: piyush })).json()
  assert.deepEqual(admin.writing.blogs.map((b) => [b.writer, b.platform]), [['Rama', 'WordPress'], ['Swapnil', 'Substack']])
  const guide = admin.writing.posts.find((p) => p.title === 'Reading “The Guide” again')
  assert.equal((await blogs(piyush, { action: 'hide', post: guide.id })).status, 200)
  assert.ok(!(await loadBlog(db)).posts.some((p) => p.title === guide.title))
  assert.equal((await blogs(piyush, { action: 'show', post: guide.id })).status, 200)
  assert.ok((await loadBlog(db)).posts.some((p) => p.title === guide.title))
})

test('feeds an hour old are read again; a blog that’s down keeps its posts and says why', async () => {
  assert.deepEqual(await refreshDue(db, { fetch: fakeFetch }), { read: 0 })
  web.set('https://chai.wordpress.com/feed/', ['application/rss+xml', wordpress(`<item><title>Malgudi, again</title><link>https://chai.wordpress.com/2026/10/20/malgudi/</link><guid>https://chai.wordpress.com/?p=20</guid><pubDate>Tue, 20 Oct 2026 09:00:00 +0000</pubDate><description>Back to Malgudi for a weekend, with a cup of filter coffee and nowhere else to be.</description></item>`)])
  down.add('https://reader.substack.com/feed')
  await db.query(`UPDATE blogs SET checked_at = now() - interval '2 hours'`)
  assert.deepEqual(await refreshDue(db, { fetch: fakeFetch }), { read: 2 })
  const { posts } = await loadBlog(db)
  assert.ok(posts.some((p) => p.title === 'Malgudi, again'))
  assert.ok(posts.some((p) => p.title === 'Uncertainty can be Beautiful.'), 'the Substack posts stay')
  const substack = await db.one(`SELECT error FROM blogs WHERE feed_url = 'https://reader.substack.com/feed'`)
  assert.equal(substack.error, 'Couldn’t reach reader.substack.com.')
  down.clear()
})

test('reading stops in time, and pictures that didn’t come are tried again later', async () => {
  const guide = `SELECT image FROM posts WHERE url = 'https://chai.wordpress.com/2026/10/01/the-guide/'`
  const stale = () => db.query(`UPDATE blogs SET checked_at = now() - interval '2 hours'`)
  await db.query(`UPDATE posts SET image = NULL WHERE url = 'https://chai.wordpress.com/2026/10/01/the-guide/'`)
  // Out of time before the pictures: still to do, not "no picture".
  await stale()
  assert.deepEqual(await refreshDue(db, { fetch: fakeFetch }, { budgetMs: 1 }), { read: 2 })
  assert.equal((await db.one(guide)).image, null)
  // The picture's site doesn't answer, or drops the connection half way: the same.
  down.add('https://chai.files.wordpress.com/2026/10/guide.jpg')
  await stale()
  await refreshDue(db, { fetch: fakeFetch })
  assert.equal((await db.one(guide)).image, null)
  down.clear()
  const dropped = () => new Response(new ReadableStream({ start: (c) => (c.enqueue(new Uint8Array([0xff, 0xd8])), c.error(new Error('connection reset'))) }))
  const flaky = async (url) => (url.endsWith('guide.jpg') ? dropped() : fakeFetch(url))
  await assert.rejects(fetchPublic('https://chai.files.wordpress.com/2026/10/guide.jpg', { fetch: flaky }), (err) => err.status === 502 && err.transient === true)
  await stale()
  await refreshDue(db, { fetch: flaky })
  assert.equal((await db.one(guide)).image, null)
  // Next time it comes.
  await stale()
  await refreshDue(db, { fetch: fakeFetch })
  assert.match((await db.one(guide)).image, /^\/media\//)
  // A picture that answers with an error is given up on, so it isn't asked for every hour.
  web.set('https://chai.files.wordpress.com/2026/10/guide.jpg', ['text/html', '<html>not a picture</html>'])
  await db.query(`UPDATE posts SET image = NULL WHERE url = 'https://chai.wordpress.com/2026/10/01/the-guide/'`)
  await stale()
  await refreshDue(db, { fetch: fakeFetch })
  assert.equal((await db.one(guide)).image, '')
  web.set('https://chai.files.wordpress.com/2026/10/guide.jpg', ['image/jpeg', picture])
})

test('the daily run needs the cron secret when there is one', async () => {
  process.env.CRON_SECRET = 'shh'
  try {
    assert.equal((await call('blog-refresh')).status, 401)
    const ok = await call('blog-refresh', { headers: { Authorization: 'Bearer shh' } })
    assert.equal(ok.status, 200)
    assert.deepEqual(await ok.json(), { read: 0 })
  } finally {
    delete process.env.CRON_SECRET
  }
})

const blogTemplate = readFileSync(new URL('../blog.html', import.meta.url), 'utf8')
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('the blog page lists every post, linking to where it was published', async () => {
  const res = await pageResponse(new Request(`${ORIGIN}/api/page?route=blog`), { db, blogTemplate, fetch: fakeFetch })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('cache-control'), /s-maxage=60/)
  const html = await res.text()
  assert.match(html, /<title>The blog · Hyderabad Reads<\/title>/)
  assert.match(html, /<link rel="canonical" href="https:\/\/hyderabadreads.fun\/blog" \/>/)
  assert.match(html, /<h1 class="desk__title">What our members are writing<\/h1>/)
  assert.match(html, /href="https:\/\/reader.substack.com\/p\/uncertainty" target="_blank" rel="noopener" data-post-link="Substack">Uncertainty can be Beautiful\./)
  assert.match(html, /class="post post--lead"/)
  assert.match(html, /Swapnil<\/a> · <time datetime="2026-10-20">20 Oct<\/time> · 3 min read/)
  assert.match(html, /<a class="chip" href="\/blog\?by=rama"/)
  assert.match(html, /href="https:\/\/reader.substack.com\/subscribe"/)
  assert.doesNotMatch(html, /<!--hr:/)
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
  assert.equal(ld['@type'], 'Blog')
  assert.deepEqual(ld.blogPost.map((p) => p.headline), ['Uncertainty can be Beautiful.', 'Malgudi, again', 'Reading “The Guide” again', 'Hello, Me'])

  const one = await (await pageResponse(new Request(`${ORIGIN}/api/page?route=blog&by=swapnil`), { db, blogTemplate, fetch: fakeFetch })).text()
  assert.match(one, /<title>Swapnil’s writing · Hyderabad Reads<\/title>/)
  assert.doesNotMatch(one, /Malgudi, again/)
  assert.match(one, /aria-current="page"[^>]*><i><\/i>Swapnil/)
})

test('the blog with nobody writing yet, and text that tries to break out', () => {
  const empty = renderBlog({ template: blogTemplate, blog: { posts: [], writers: [] } }).html
  assert.match(empty, /No posts yet/)
  const blog = {
    posts: [
      {
        title: '<img src=x onerror=alert(1)>',
        url: 'https://evil.example/"onmouseover="alert(1)',
        excerpt: '</p><script>alert(2)</script>',
        words: null,
        image: null,
        date: '2026-10-20',
        published: '2026-10-20T00:00:00Z',
        blog: '',
        platform: '',
        home: 'https://evil.example/',
        feed: 'https://evil.example/feed',
        writer: 'Eve',
        writerSlug: 'eve',
      },
    ],
    writers: [{ name: 'Eve', slug: 'eve', blog: '', platform: '', home: 'https://evil.example/', posts: 1 }],
  }
  const html = renderBlog({ template: blogTemplate, blog }).html
  assert.doesNotMatch(html, /<img src=x/)
  assert.doesNotMatch(html, /<script>alert/)
  assert.doesNotMatch(html, /"onmouseover="/)
  assert.match(html, /<p class="post__source">evil\.example<\/p>/)
  const rss = feed('blog', blog).body
  assert.doesNotMatch(rss, /<img|<script/)
})

test('the home page shows the newest three posts, drawn on the server', async () => {
  const data = await loadLibrary(db)
  assert.equal(data.posts.length, 3)
  const html = renderPage({ template, notFound: '', data, route: routeFor('home'), today: '2026-10-22' }).html
  assert.match(html, /<section id="writing" class="writing"/)
  assert.match(html, /From the club’s writers/)
  assert.equal((html.match(/<article class="post/g) ?? []).length, 3)
  const inlined = JSON.parse(html.match(/<script type="application\/json" id="hr-data">(.*?)<\/script>/s)[1])
  assert.equal(inlined.posts, undefined, 'the scripts don’t need the posts')
  const quiet = renderPage({ template, notFound: '', data: { ...data, posts: [] }, route: routeFor('home') }).html
  assert.doesNotMatch(quiet, /id="writing"/)
})

test('the blog as RSS, and in the sitemap and llms.txt', async () => {
  const res = await feedResponse(new Request(`${ORIGIN}/api/feeds?feed=blog`), { db })
  assert.equal(res.headers.get('content-type'), 'application/rss+xml; charset=utf-8')
  const rss = await res.text()
  assert.match(rss, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/)
  assert.match(rss, /<title>Reading “The Guide” again<\/title>/)
  assert.match(rss, /<dc:creator>Swapnil<\/dc:creator>/)
  assert.match(rss, /<source url="https:\/\/reader.substack.com\/feed">Bookish &amp; Becoming<\/source>/)
  const data = await loadLibrary(db)
  assert.match(feed('sitemap', data, '2026-10-22').body, /<loc>https:\/\/hyderabadreads.fun\/blog<\/loc><lastmod>2026-10-20<\/lastmod>/)
  assert.match(feed('llms', data, '2026-10-22').body, /\[Blog\]\(https:\/\/hyderabadreads.fun\/blog\)/)
  assert.match(feed('llms-full', data, '2026-10-22').body, /## Latest writing by members/)
})

test('/blog and its feed are routed the same way locally as on Vercel, with a daily cron', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const rules = compileRewrites(config.rewrites)
  const at = (path) => rewrite(rules, new URL(path, 'http://localhost'))?.toString().replace('http://localhost', '')
  assert.equal(at('/blog'), '/api/page?route=blog')
  assert.equal(at('/blog?by=swapnil'), '/api/page?route=blog&by=swapnil')
  assert.equal(at('/blog/feed.xml'), '/api/feeds?feed=blog')
  assert.equal(at('/api/blog-refresh'), '/api/app?route=blog-refresh')
  assert.deepEqual(config.crons, [{ path: '/api/blog-refresh', schedule: '30 0 * * *' }])
})

test('a member who removes their blog takes its posts off the site', async () => {
  const swapnil = await signIn('Swapnil')
  const id = (await db.one(`SELECT id FROM blogs WHERE feed_url = 'https://reader.substack.com/feed'`)).id
  const res = await blogs(swapnil, { action: 'remove', id })
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).writing, { blogs: [], posts: [] })
  assert.ok(!(await loadBlog(db)).posts.some((p) => p.writer === 'Swapnil'))
  // Gone, so it can be added again later.
  assert.equal((await blogs(swapnil, { action: 'add', url: 'reader.substack.com' })).status, 200)
})
