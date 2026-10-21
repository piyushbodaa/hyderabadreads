// Book lookups and covers from Open Library (openlibrary.org), done on the
// server so visitors' browsers only ever talk to hyderabadreads.fun.
//
// Every function takes the fetch to use, so tests can stand in for Open Library.
import sharp from 'sharp'

const UA = 'HyderabadReads/1.0 (https://hyderabadreads.fun)'
const TIMEOUT_MS = 8000

export const isIsbn = (text) => /^(?:97[89]\d{9}[\dX]|\d{9}[\dX])$/i.test(String(text ?? '').replace(/[-\s]/g, ''))
export const cleanIsbn = (text) => String(text ?? '').replace(/[-\s]/g, '').toUpperCase()

// Study guides, summaries and the like crowd out the real book, so they go to
// the bottom unless that's what someone is looking for.
const COMPANIONS = /\b(study guides?|summary|summaries|sparknotes|cliffs ?notes|workbook|quick ?notes|analysis of|literature guide|book notes)\b/i

// Up to 12 likely books for a title, author or ISBN, in Open Library's order
// of relevance, with companions moved down and repeats of the same book dropped.
export async function searchBooks(query, { fetch = globalThis.fetch } = {}) {
  const q = String(query ?? '').trim().slice(0, 200)
  if (q.length < 2) return []
  const isbn = isIsbn(q) ? cleanIsbn(q) : null
  const params = new URLSearchParams({
    q: isbn ? `isbn:${isbn}` : q,
    fields: 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,edition_count,language',
    limit: '24',
  })
  const res = await get(`https://openlibrary.org/search.json?${params}`, fetch)
  const { docs = [] } = await res.json()
  const wantsCompanions = COMPANIONS.test(q)
  const seen = new Set()
  return docs
    .filter((d) => d.title && d.author_name?.length)
    .map((d, i) => ({ d, i, companion: !wantsCompanions && COMPANIONS.test(d.title) }))
    .sort((a, b) => a.companion - b.companion || a.i - b.i)
    .map(({ d }) => d)
    .filter((d) => {
      const key = `${d.title.toLowerCase().replace(/[^a-z0-9]+/g, '')}|${d.author_name[0].toLowerCase()}`
      return !seen.has(key) && seen.add(key)
    })
    .slice(0, 12)
    .map((d) => ({
      olKey: d.key ?? null,
      title: d.title,
      author: d.author_name.slice(0, 2).join(' & '),
      year: d.first_publish_year ?? null,
      pages: d.number_of_pages_median ?? null,
      coverId: d.cover_i ?? null,
      isbn,
    }))
}

// A cover as an image file, by Open Library cover id or by ISBN, or null.
export async function fetchCover({ coverId, isbn, size = 'L' }, { fetch = globalThis.fetch } = {}) {
  const url = isbn
    ? `https://covers.openlibrary.org/b/isbn/${cleanIsbn(isbn)}-${size}.jpg?default=false`
    : coverId
      ? `https://covers.openlibrary.org/b/id/${Number(coverId)}-${size}.jpg?default=false`
      : null
  if (!url) return null
  try {
    const bytes = Buffer.from(await (await get(url, fetch)).arrayBuffer())
    return bytes.length < 2000 ? null : bytes // Open Library's 1×1 placeholder
  } catch {
    return null
  }
}

// Shrinks a cover to a 520px-wide WebP and picks its spine colours: the
// cover's most common colour (usually its background, which is what real
// spines carry) and, as the accent, the most vivid colour that differs from it.
export async function processCover(bytes) {
  const { data: webp, info } = await sharp(bytes).rotate().resize({ width: 520, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true })
  return { webp, width: info.width, height: info.height, ...(await palette(bytes)) }
}

async function palette(bytes) {
  const { data } = await sharp(bytes).resize(40, 60, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
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

function saturation([r, g, b]) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const contrastOf = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b > 140 ? [34, 28, 24] : [240, 228, 205])
const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

async function get(url, fetch) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok) throw new Error(`Open Library answered ${res.status}`)
      return res
    } catch (err) {
      if (attempt === 2) throw err
      await new Promise((r) => setTimeout(r, 600))
    }
  }
}
