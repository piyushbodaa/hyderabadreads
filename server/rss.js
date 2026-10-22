// Reading blogs' RSS and Atom feeds: finding a blog's feed from any address on
// it (a post, the home page, a Substack or Medium profile), and turning the
// feed into posts: a title, a link, a date, a short excerpt, a picture and a
// length. Feeds are written by machines, so a small reader for the handful of
// tags blogs use is enough, without an XML library.
import { Problem } from './members.js'
import { fetchPublic } from './safe-fetch.js'

const FEED_TYPES = 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8, */*;q=0.5'

// ── Finding the feed ──────────────────────────────────────────────────────

// What a member pastes, as an address: "yourname.substack.com" works, and
// share links lose their tracking.
export function blogAddress(input) {
  let s = String(input ?? '').trim()
  if (!s) throw new Problem(400, 'Paste your blog’s address.')
  if (s.length > 500) throw new Problem(400, 'That address is too long.')
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`
  let url
  try {
    url = new URL(s)
  } catch {
    throw new Problem(400, 'That doesn’t look like a web address.')
  }
  for (const key of [...url.searchParams.keys()]) if (/^(utm_.*|r|ref|source|s|triedRedirect|isFreemail|token|publication_id|post_id)$/i.test(key)) url.searchParams.delete(key)
  url.hash = ''
  return url
}

// Where the big platforms keep a blog's feed, from any address on the blog.
export function knownFeed(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const top = url.pathname.split('/')[1] ?? ''
  if (host.endsWith('.substack.com')) return `https://${host}/feed`
  if (host === 'substack.com' && top.startsWith('@')) return `https://${top.slice(1)}.substack.com/feed`
  if (host === 'medium.com') {
    if (top === 'feed') return url.href
    if (top && !['m', 'p', 'tag', 'tags', 'search', 'me', 'topics', 'plans', 'membership'].includes(top)) return `https://medium.com/feed/${top}`
  }
  if (host.endsWith('.medium.com')) return `https://${host}/feed`
  if (host.endsWith('.wordpress.com')) return `https://${host}/feed/`
  if (host.endsWith('.blogspot.com')) return `https://${host}/feeds/posts/default`
  return null
}

// A blog's feed and what's in it, from any address on the blog: the platform's
// usual feed address, the address itself (a feed, or a page that links to
// one), the site's home page, then the usual places sites keep a feed.
export async function findFeed(input, net = {}) {
  const url = blogAddress(input)
  const tried = new Set()
  let failure = null
  let reached = false
  // A site that never answers mustn't hold the request past the function's limit.
  const deadline = Date.now() + 25000
  const read = async (href, timeout = 10000) => {
    const left = deadline - Date.now()
    if (tried.has(href) || left < 1000) return null
    tried.add(href)
    try {
      const { url: at, type, body } = await fetchPublic(href, { ...net, accept: FEED_TYPES, timeout: Math.min(timeout, left) })
      reached = true
      const text = body.toString('utf8')
      const feed = parseFeed(text, at.href)
      if (feed) return { feedUrl: at.href, feed }
      return { links: /html/.test(type) || /<html[\s>]/i.test(text) ? feedLinks(text, at.href) : [] }
    } catch (err) {
      // An address that isn't allowed stops the search; anything else, try the next.
      if (err instanceof Problem && err.status === 400) throw err
      failure ??= err
      return null
    }
  }
  const follow = async (page) => {
    if (page?.feedUrl) return page
    for (const href of (page?.links ?? []).slice(0, 3)) {
      const found = await read(href)
      if (found?.feedUrl) return found
    }
    return null
  }

  const known = knownFeed(url)
  const found =
    (known && (await follow(await read(known)))) ||
    (await follow(await read(url.href))) ||
    (url.pathname !== '/' && (await follow(await read(`${url.origin}/`))))
  if (found) return found
  for (const path of ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml']) {
    const guess = await read(`${url.origin}${path}`, 6000)
    if (guess?.feedUrl) return guess
  }
  // Nothing answered at all: say why ("Couldn’t find example.cmo"), rather than "no feed".
  if (!reached && failure instanceof Problem) throw new Problem(422, failure.message)
  throw new Problem(422, 'Couldn’t find a feed for that blog. Try the address of its home page, like yourname.substack.com.')
}

// Feeds a page points to with <link rel="alternate">, leaving out comment feeds.
export function feedLinks(html, base) {
  return [...String(html).matchAll(/<link\b[^>]*>/gi)]
    .map((m) => attributes(m[0].slice(5)))
    .filter((a) => /(^|\s)alternate(\s|$)/i.test(a.rel ?? '') && /application\/(rss|atom)\+xml/i.test(a.type ?? '') && a.href && !/comment/i.test(`${a.title ?? ''} ${a.href}`))
    .map((a) => absolute(a.href, base))
    .filter(Boolean)
}

// The platform, for the label on each post. A blog on its own site gets its
// address instead.
export function platformOf(feedUrl, link, generator = '') {
  const hosts = [feedUrl, link].map((u) => absolute(u)?.replace(/^https?:\/\/([^/]+).*$/, '$1') ?? '').join(' ')
  const g = generator.toLowerCase()
  if (/substack\.com/.test(hosts) || g.includes('substack')) return 'Substack'
  if (/(^|\.)medium\.com/.test(hosts) || g === 'medium') return 'Medium'
  if (/wordpress\.(com|org)/.test(hosts) || g.includes('wordpress')) return 'WordPress'
  if (/blogspot\.com|blogger\.com/.test(hosts) || g.includes('blogger')) return 'Blogger'
  if (g.startsWith('ghost')) return 'Ghost'
  return ''
}

// ── Reading the feed ──────────────────────────────────────────────────────

// RSS 2.0, RSS 1.0 or Atom → the blog's title, link and newest posts; null
// for anything that isn't a feed.
export function parseFeed(xml, base) {
  const doc = String(xml ?? '').replace(/^﻿/, '').replace(/<!--[\s\S]*?-->/g, '')
  const rss = /<(rss|rdf:RDF)[\s>]/i.test(doc)
  if (!rss && !/<feed[\s>]/i.test(doc)) return null
  const itemTag = rss ? 'item' : 'entry'
  const start = doc.search(new RegExp(`<${itemTag}[\\s>]`, 'i'))
  const head = (start < 0 ? doc : doc.slice(0, start)).replace(/<(image|author|itunes:owner)(?=[\s>])[\s\S]*?<\/\1\s*>/gi, '')
  const link = rss ? cleanLink(textOf(head, 'link'), base) : atomLink(head, base)
  const posts = elements(doc, itemTag)
    .map((e) => postFrom(e.raw, link ?? base))
    .filter(Boolean)
    .sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''))
  return { title: htmlToText(textOf(head, 'title')).slice(0, 200), link, generator: textOf(head, 'generator'), posts }
}

function postFrom(raw, base) {
  // The post's own tags, without its text, where a stray <title> or <link> could hide.
  const meta = raw.replace(/<(content:encoded|content|description|summary)(?=[\s>])[\s\S]*?<\/\1\s*>/gi, '')
  const html = textOf(raw, 'content:encoded', 'content')
  const summary = textOf(raw, 'description', 'summary')
  const guid = first(meta, 'guid')
  const url =
    cleanLink(textOf(meta, 'feedburner:origLink', 'link'), base) ??
    atomLink(meta, base) ??
    (guid && guid.attrs.ispermalink !== 'false' ? cleanLink(text(guid.raw), base) : null)
  if (!url) return null
  const when = ['pubDate', 'published', 'dc:date', 'updated', 'atom:updated'].map((n) => Date.parse(textOf(meta, n))).find(Number.isFinite)
  const words = html ? htmlToText(html).split(/\s+/).filter(Boolean).length : null
  return {
    guid: (text(guid?.raw ?? '') || textOf(meta, 'id') || url).trim().slice(0, 500),
    url,
    title: htmlToText(textOf(meta, 'title')).slice(0, 300) || 'Untitled',
    excerpt: excerptOf(summary, html),
    words: words || null,
    image: pictureOf(meta, html || summary, base),
    published: when ? new Date(when).toISOString() : null,
  }
}

function atomLink(block, base) {
  const links = elements(block, 'link').map((e) => e.attrs)
  const pick = links.find((a) => (a.rel ?? 'alternate') === 'alternate' && (!a.type || /html/i.test(a.type)))
  return pick ? cleanLink(pick.href, base) : null
}

// A post's address as an absolute http(s) link, without tracking parameters.
function cleanLink(href, base) {
  const href2 = absolute(href, base)
  if (!href2) return null
  const url = new URL(href2)
  for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || (key === 'source' && /^rss/i.test(url.searchParams.get(key)))) url.searchParams.delete(key)
  return url.href
}

function absolute(href, base) {
  if (!href || !String(href).trim()) return null
  try {
    const url = new URL(String(href).trim(), base)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

// ── Excerpts and pictures ─────────────────────────────────────────────────

// About three lines of the post: its own summary when it has a real one, or
// its first paragraphs, without "Continue reading" and "The post … appeared first on …".
export function excerptOf(summaryHtml, contentHtml) {
  const tidy = (t) =>
    t
      .replace(/\s*The post .{1,300}? appeared first on .{1,200}$/i, '')
      .replace(/\s*(Continue reading|Read more|Read the full).*$/i, '')
      .replace(/\s*\[(…|\.\.\.)\]\s*$/, '…')
      .trim()
  let found = tidy(htmlToText(summaryHtml))
  if (found.length < 60 && contentHtml) found = tidy(paragraphs(contentHtml)) || found
  return clip(found, 280)
}

// The text of a post's paragraphs, skipping any that are only a link.
function paragraphs(html) {
  const ps = [...html.matchAll(/<p(?=[\s>])[\s\S]*?<\/p>/gi)].map((m) => m[0]).filter((p) => !/^<p[^>]*>\s*<a\b[^>]*>[\s\S]*?<\/a>\s*<\/p>$/i.test(p))
  return htmlToText(ps.length ? ps.slice(0, 6).join(' ') : html)
}

export function clip(text, max) {
  if (text.length <= max) return text
  const cut = text.slice(0, max + 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut.slice(0, max)).replace(/[\s,;:.…–—-]+$/, '')}…`
}

// Tracking pixels, avatars, emoji and icons aren't a post's picture.
const NOT_A_PICTURE = /gravatar\.com|\/_\/stat|feedburner|stats\.wp\.com|pixel|smilies|\/emoji\/|doubleclick|google-analytics|\.svg(\?|$)/i

function pictureOf(meta, html, base) {
  const candidates = [
    ...elements(meta, 'enclosure').filter(({ attrs: a }) => /^image\//i.test(a.type ?? '') || (!a.type && /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(a.url ?? ''))).map((e) => e.attrs.url),
    ...elements(meta, 'media:content').filter(({ attrs: a }) => a.medium === 'image' || /^image\//i.test(a.type ?? '')).map((e) => e.attrs.url),
    ...elements(meta, 'media:thumbnail').map((e) => e.attrs.url),
    ...[...String(html ?? '').matchAll(/<img\b[^>]*>/gi)]
      .map((m) => attributes(m[0].slice(4)))
      .filter((a) => !(Number(a.width) <= 2 || Number(a.height) <= 2))
      .map((a) => a['data-src'] || a.src),
  ]
  for (const src of candidates) {
    const url = absolute(src, base)
    // Blogger's feeds point at 72px thumbnails; the same address gives any size.
    if (url && !NOT_A_PICTURE.test(url)) return url.replace(/\/s72-c\//, '/s1200/').replace(/=s72-c$/, '=s1200')
  }
  return null
}

// ── XML and HTML ──────────────────────────────────────────────────────────

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', laquo: '«', raquo: '»', middot: '·',
  bull: '•', copy: '©', reg: '®', trade: '™', deg: '°', times: '×', rarr: '→', larr: '←', eacute: 'é', egrave: 'è',
  ecirc: 'ê', aacute: 'á', agrave: 'à', acirc: 'â', iacute: 'í', oacute: 'ó', ocirc: 'ô', uacute: 'ú', ntilde: 'ñ',
  ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß', Eacute: 'É', zwj: '‍', zwnj: '‌', shy: '',
}

export function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, e) => {
    if (e[0] !== '#') return NAMED[e] ?? whole
    const code = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : ''
  })
}

// Plain text from a bit of HTML: no scripts, captions or tags, entities decoded.
export function htmlToText(html) {
  return decodeEntities(
    String(html ?? '')
      .replace(/<(script|style|figcaption|noscript|template|svg|iframe|button|select)(?=[\s>])[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|blockquote|figure|tr|section|article)>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

// An element's text: CDATA as it is, everything else with entities decoded.
function text(raw) {
  let out = ''
  let last = 0
  for (const m of raw.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)) {
    out += decodeEntities(raw.slice(last, m.index)) + m[1]
    last = m.index + m[0].length
  }
  return out + decodeEntities(raw.slice(last))
}

const pattern = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Every <name> in a block of XML: its attributes and the markup inside it.
function elements(block, name, limit = Infinity) {
  const open = new RegExp(`<${pattern(name)}(?=[\\s/>])([^>]*?)(/?)>`, 'gi')
  const out = []
  for (let m; out.length < limit && (m = open.exec(block)); ) {
    if (m[2] === '/') {
      out.push({ attrs: attributes(m[1]), raw: '' })
      continue
    }
    const close = new RegExp(`</${pattern(name)}\\s*>`, 'gi')
    close.lastIndex = open.lastIndex
    const end = close.exec(block)
    out.push({ attrs: attributes(m[1]), raw: end ? block.slice(open.lastIndex, end.index) : '' })
    if (end) open.lastIndex = close.lastIndex
  }
  return out
}

const first = (block, name) => elements(block, name, 1)[0] ?? null

// The text of the first of these elements that has any.
function textOf(block, ...names) {
  for (const name of names) {
    const found = first(block, name)
    const value = found && text(found.raw).trim()
    if (value) return value
  }
  return ''
}

function attributes(source) {
  const out = {}
  for (const m of String(source).matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3])
  return out
}
