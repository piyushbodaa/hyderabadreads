// Turns the library data the server writes into the page (books with their
// cover colours, members, the calendar) into the book objects the site
// renders: owner, cover, and a deterministic spine design.

import { GENRES } from './genres.js'

// Cloth colours for books without a cover to sample from.
const CLOTH = [
  ['#7a1f2b', '#e0b872'], ['#1f4d3a', '#d8c27a'], ['#1d2f52', '#d9b46a'], ['#c9962b', '#2a1d10'],
  ['#1f6b6b', '#f0dcb0'], ['#4b2a4f', '#e3b86d'], ['#b5532f', '#f6e3c4'], ['#e9dfc8', '#7a1f2b'],
  ['#2b2b2e', '#c9a35c'], ['#8a9a75', '#2a2a1e'], ['#c8641c', '#fff1d6'], ['#4a6178', '#f0d79a'],
]

// Spine designs and the face each one is set in. `k` is the average glyph
// advance in ems, used to fit the title along the spine.
const STYLES = {
  classic: { font: 'elegant', k: 0.46 },
  block: { font: 'condensed', k: 0.42 },
  minimal: { font: 'serif', k: 0.52 },
  split: { font: 'sans', k: 0.7 },
  foil: { font: 'serif', k: 0.5 },
}
const STYLE_NAMES = Object.keys(STYLES)

export const MAX_SPINE_HEIGHT = 214

// Filled in place by loadLibrary(), so every module importing these sees the
// same arrays.
export const books = []
export const readerList = []
export const meetups = []
export const photos = []
export const wishes = []
export const club = {}
export const stats = { books: 0, readers: 0, genres: 0, pages: 0, samples: 0 }

// The library data server/page.js writes into every page.
export function readPageData(doc = document) {
  const el = doc.getElementById('hr-data')
  return el ? JSON.parse(el.textContent) : { members: [], books: [], meetups: [], club: {} }
}

export function loadLibrary(data) {
  books.splice(0, books.length, ...data.books.map(bookFrom))
  // Readers are shown alphabetically, however the data lists them.
  readerList.splice(
    0,
    readerList.length,
    ...data.members
      .map((m) => ({ name: m.name, slug: m.slug, hue: hash(m.name) % 360, books: books.filter((b) => b.owner === m.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
  )
  meetups.splice(0, meetups.length, ...data.meetups)
  photos.splice(0, photos.length, ...(data.photos ?? []))
  wishes.splice(0, wishes.length, ...(data.wishes ?? []))
  Object.assign(club, data.club)
  Object.assign(stats, {
    books: books.length,
    readers: readerList.length,
    genres: new Set(books.map((b) => b.genre)).size,
    pages: books.reduce((sum, b) => sum + (b.pages ?? 0), 0),
    samples: books.filter((b) => b.sample).length,
  })
}

function bookFrom(raw, index) {
  // A second copy of a book ("dune-herbert--piyush") gets the same spine as the first.
  const slug = raw.id.split('--')[0]
  const rand = random(hash(slug))

  const fallback = CLOTH[Math.floor(rand() * CLOTH.length)]
  const base = raw.color ?? fallback[0]
  const ink = luminance(base) > 0.42 ? '#1f1813' : '#f4ead6'
  const accent = raw.accent && contrast(raw.accent, base) > 1.8 ? raw.accent : luminance(base) > 0.42 ? '#7a1f2b' : '#d9b46a'

  let style = STYLE_NAMES[Math.floor(rand() * STYLE_NAMES.length)]
  if (style === 'foil' && luminance(base) > 0.16) style = 'classic'
  const titleInk = style === 'foil' ? [accent, '#d9b46a', ink].find((c) => contrast(c, base) >= 3.2) : ink
  const accentInk = luminance(accent) > 0.42 ? '#1f1813' : '#f4ead6'

  const pages = raw.pages ?? null
  const t = Math.round(pages ? clamp(18 + pages / 13, 24, 66) : 26 + rand() * 16)
  const h = Math.round(176 + rand() * (MAX_SPINE_HEIGHT - 176))
  const { fs } = fitTitle(raw.title, style, h, t)

  return {
    id: raw.id,
    index,
    title: raw.title,
    author: raw.author,
    surname: raw.author.trim().split(/\s+/).pop(),
    genre: raw.genre || 'Other',
    language: raw.language || 'English',
    blurb: raw.blurb ?? '',
    note: raw.note ?? '',
    onLoan: Boolean(raw.onLoan),
    onLoanTo: raw.onLoanTo ?? null,
    owner: raw.owner,
    sample: Boolean(raw.sample),
    added: raw.added ?? null,
    year: raw.year ?? null,
    pages,
    isbn: raw.isbn ?? null,
    olKey: raw.olKey ?? null,
    cover: raw.cover ?? null,
    aspect: raw.w && raw.h ? raw.w / raw.h : 0.66,
    base,
    accent,
    ink,
    titleInk,
    accentInk,
    style,
    font: STYLES[style].font,
    h,
    t,
    fs,
    afs: clamp(t * 0.2, 6.5, 9.5),
    seed: hash(slug),
  }
}

export const genreColour = (genre) => GENRES[genre] ?? `hsl(${hash(genre) % 360} 45% 62%)`

// The faces spines are set in, for measuring: weight, family, letter-spacing (em).
const FACES = {
  elegant: ['700', '"Cormorant Garamond Variable"', 0],
  condensed: ['400', '"Bebas Neue"', 0.04],
  serif: ['560', '"Fraunces Variable"', 0],
  sans: ['680', '"Inter Variable"', 0.06],
}

export const SPINE_FONTS = [
  '700 20px "Cormorant Garamond Variable"',
  '400 20px "Bebas Neue"',
  '560 20px "Fraunces Variable"',
  'italic 560 20px "Fraunces Variable"',
  '680 20px "Inter Variable"',
]

// Once the fonts are in, measure every title and author for real and size
// them to run the length of the spine. Long titles on thick books get two
// columns rather than shrinking to nothing.
export function fitSpines() {
  const ctx = document.createElement('canvas').getContext('2d')
  const widthAt1 = (text, font, spacing) => {
    ctx.font = font
    return ctx.measureText(text).width / 100 + spacing * text.length
  }
  for (const b of books) {
    const [weight, family, spacing] = FACES[b.font]
    const font = `${b.style === 'foil' ? 'italic ' : ''}${weight} 100px ${family}`
    const title = spineText(b.font === 'sans' ? b.title.toUpperCase() : b.title)

    let authorLen = 0
    b.afs = 0
    if (b.style !== 'minimal') {
      const aw = widthAt1(b.surname.toUpperCase(), '650 100px "Inter Variable"', 0.12)
      b.afs = Math.round(Math.min(clamp(b.t * 0.2, 6.5, 9.5), (b.h * 0.3) / aw) * 10) / 10
      authorLen = aw * b.afs + 30 + (b.style === 'split' ? 12 : 0)
    }
    const padTop = b.style === 'block' ? b.h * 0.2 : 14
    const padBottom = b.style === 'minimal' ? 40 : 8
    const avail = b.h - padTop - padBottom - authorLen - 6

    let fs = Math.min(b.t * 0.5, avail / widthAt1(title, font, spacing), 22)
    if (fs < 11 && b.t >= 32) {
      const words = title.split(' ')
      let longest = Infinity
      for (let i = 1; i < words.length; i++) {
        const a = widthAt1(words.slice(0, i).join(' '), font, spacing)
        const c = widthAt1(words.slice(i).join(' '), font, spacing)
        longest = Math.min(longest, Math.max(a, c))
      }
      if (longest < Infinity) fs = Math.max(fs, Math.min(b.t * 0.36, avail / longest, 16))
    }
    b.fs = Math.max(7, Math.floor(fs * 10) / 10)
  }
}

// Curly apostrophes leave a gap in vertical text; spines use straight ones.
export function spineText(text) {
  return text.replace(/[’‘]/g, "'")
}

// First-paint estimate, before the fonts have loaded and fitSpines() runs.
function fitTitle(title, style, h, t) {
  const { k } = STYLES[style]
  const avail = h - (style === 'minimal' ? 46 : 74)
  const len = Math.max(title.length, 4)
  let fs = Math.min(t * 0.46, avail / (len * k), 21)
  if (fs < 11 && t >= 36) fs = Math.min(t * 0.29, (2 * avail) / (len * k), 15)
  return { fs: Math.max(8, Math.round(fs * 10) / 10) }
}

export function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function random(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

