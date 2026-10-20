// Fetches a cover, page count and publication year for every book in
// src/data/library.js from Open Library, and picks spine colours from the
// cover art. Results land in public/covers/ and src/data/covers.json.
//
// Runs before every build. Books already in the manifest are skipped, and a
// failed lookup never fails the build: the site falls back to a designed cover.

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readers } from '../src/data/library.js'
import { bookSlug } from '../src/lib/slug.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const COVER_DIR = join(ROOT, 'public', 'covers')
const MANIFEST = join(ROOT, 'src', 'data', 'covers.json')
const TIMEOUT_MS = 20_000
const CONCURRENCY = 4
const UA = 'HyderabadReads/1.0 (https://hyderabadreads.fun)'

let sharp = null
try {
  sharp = (await import('sharp')).default
} catch {
  console.warn('[covers] sharp unavailable; covers will be saved without colour analysis')
}

const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {}
await mkdir(COVER_DIR, { recursive: true })

const books = readers.flatMap((r) => r.books)
const slugs = new Set(books.map(bookSlug))
const todo = books.filter((b) => {
  const entry = manifest[bookSlug(b)]
  if (!entry) return true
  if (entry.isbn !== (b.isbn ?? null)) return true
  return entry.cover ? !existsSync(join(ROOT, 'public', entry.cover)) : false
})

console.log(`[covers] ${books.length} books, ${todo.length} to look up`)

let done = 0
await pool(todo, CONCURRENCY, async (book) => {
  const slug = bookSlug(book)
  try {
    manifest[slug] = await lookup(book, slug)
    const tag = manifest[slug].cover ? 'cover' : 'no cover'
    console.log(`[covers] ${++done}/${todo.length} ${book.title} (${tag})`)
  } catch (err) {
    console.warn(`[covers] ${++done}/${todo.length} ${book.title} failed: ${err.message}`)
  }
})

// Drop entries for books that were removed from the library.
for (const key of Object.keys(manifest)) if (!slugs.has(key)) delete manifest[key]

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
await writeFile(MANIFEST, JSON.stringify(sorted, null, 2) + '\n')
console.log(`[covers] manifest has ${Object.keys(sorted).length} entries`)

async function lookup(book, slug) {
  const fields = [
    'key', 'title', 'author_name', 'cover_i', 'first_publish_year', 'number_of_pages_median', 'edition_count',
    'editions', 'editions.cover_i', 'editions.language',
  ].join(',')
  const surname = book.author.trim().split(/\s+/).pop()
  const q = book.isbn ? `isbn:${book.isbn.replace(/[^0-9X]/gi, '')}` : `${book.title} ${surname}`
  const params = new URLSearchParams({ q, fields, lang: 'en', limit: '10' })
  const res = await get(`https://openlibrary.org/search.json?${params}`)
  const { docs = [] } = await res.json()

  // The real book is the work by this author with the most editions; relevance
  // order often puts a study guide, summary or graphic novel first. Its title may
  // be the original-language one, so the cover comes from its best English edition.
  const byAuthor = docs.filter((d) => (d.author_name ?? []).some((a) => normalise(a).includes(normalise(surname))))
  const doc = (byAuthor.length ? byAuthor : docs).sort((a, b) => (b.edition_count ?? 0) - (a.edition_count ?? 0))[0]
  const edition = doc?.editions?.docs?.[0]
  const coverId = (edition?.language ?? []).includes('eng') && edition.cover_i ? edition.cover_i : doc?.cover_i

  const entry = {
    isbn: book.isbn ?? null,
    olKey: doc?.key ?? null,
    year: doc?.first_publish_year ?? null,
    pages: doc?.number_of_pages_median ?? null,
    cover: null,
  }
  const coverUrl = book.isbn
    ? `https://covers.openlibrary.org/b/isbn/${book.isbn.replace(/[^0-9X]/gi, '')}-L.jpg?default=false`
    : coverId && `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
  if (!coverUrl) return entry

  const img = Buffer.from(await (await get(coverUrl)).arrayBuffer())
  if (img.length < 2000) return entry // Open Library's 1px placeholder

  if (!sharp) {
    await writeFile(join(COVER_DIR, `${slug}.jpg`), img)
    return { ...entry, cover: `covers/${slug}.jpg` }
  }

  const resized = sharp(img).resize({ width: 520, withoutEnlargement: true })
  const { data, info } = await resized.clone().webp({ quality: 82 }).toBuffer({ resolveWithObject: true })
  await writeFile(join(COVER_DIR, `${slug}.webp`), data)
  return {
    ...entry,
    cover: `covers/${slug}.webp`,
    width: info.width,
    height: info.height,
    ...(await palette(img)),
  }
}

// Spine colour = the cover's most common colour (usually its background, which
// is what real spines carry). Accent = the most vivid colour that differs from it.
async function palette(img) {
  const { data } = await sharp(img).resize(40, 60, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const buckets = new Map()
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bucket.n++
    bucket.r += r
    bucket.g += g
    bucket.b += b
    buckets.set(key, bucket)
  }
  const colours = [...buckets.values()].map(({ n, r, g, b }) => ({ n, rgb: [r / n, g / n, b / n] }))
  colours.sort((a, b) => b.n - a.n)
  const primary = colours[0].rgb
  let accent = null
  let best = 0
  for (const c of colours) {
    const score = c.n * (0.25 + saturation(c.rgb)) * Math.min(1, distance(c.rgb, primary) / 120)
    if (score > best) [best, accent] = [score, c.rgb]
  }
  return { color: hex(primary), accent: hex(accent ?? contrastOf(primary)) }
}

function normalise(title) {
  return title.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, '')
}

function saturation([r, g, b]) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function contrastOf([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? [34, 28, 24] : [240, 228, 205]
}

function hex(rgb) {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (err) {
      if (attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
}

async function pool(items, size, fn) {
  const queue = [...items]
  await Promise.all(Array.from({ length: size }, async () => {
    while (queue.length) await fn(queue.shift())
  }))
}
