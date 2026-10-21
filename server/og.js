// Link-preview images (1200×630), drawn on demand: one per book with its
// cover and "On Piyush's shelf", and one per member with a fan of their covers.
// WhatsApp, Instagram and others show these when a link is pasted.
//
// Satori lays the card out as SVG (text becomes outlines, so no fonts are
// needed to draw it) and sharp turns that into a JPEG small enough for chat apps.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import satori from 'satori'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
const root = new URL('../', import.meta.url)
const font = (pkg, file) => readFile(require.resolve(`@fontsource/${pkg}/files/${file}`))

let assets
async function loadAssets() {
  assets ??= Promise.all([
    font('fraunces', 'fraunces-latin-500-normal.woff'),
    font('inter', 'inter-latin-400-normal.woff'),
    font('inter', 'inter-latin-600-normal.woff'),
    readFile(new URL('public/logo-512.png', root)).then((png) => sharp(png).resize(112).png().toBuffer()),
  ]).then(([fraunces, inter, interBold, logo]) => ({
    fonts: [
      { name: 'Fraunces', data: fraunces, weight: 500, style: 'normal' },
      { name: 'Inter', data: inter, weight: 400, style: 'normal' },
      { name: 'Inter', data: interBold, weight: 600, style: 'normal' },
    ],
    logo: `data:image/png;base64,${logo.toString('base64')}`,
  }))
  return assets
}

async function render(card, fonts) {
  const svg = await satori(card, { width: 1200, height: 630, fonts })
  return sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toBuffer()
}

// Satori takes React-style elements; this builds them without React.
function h(type, props, ...children) {
  const kids = children.flat().filter((c) => c !== null && c !== false && c !== undefined)
  return { type, props: { ...props, children: kids.length === 1 ? kids[0] : kids } }
}

const PAPER = '#f3e9d7'
const AMBER = '#e2a75b'
const BACKGROUND = {
  backgroundColor: '#110c09',
  backgroundImage:
    'radial-gradient(circle at 88% 0%, rgba(255,190,110,0.22), rgba(255,190,110,0) 55%), radial-gradient(circle at 0% 100%, rgba(130,60,25,0.28), rgba(130,60,25,0) 60%)',
}

// A cover as a PNG data URI at the given height, or null if there isn't one.
// Covers that came with the site are files under public/; covers added
// through the site live in the database's media table.
async function coverImage(db, cover, height) {
  if (!cover) return null
  let bytes = null
  const media = /^\/media\/([a-f0-9]+)\.\w+$/.exec(cover)
  if (media) {
    const row = await db.one(`SELECT encode(bytes, 'base64') AS b64 FROM media WHERE hash = $1`, [media[1]])
    bytes = row && Buffer.from(row.b64, 'base64')
  } else if (/^\/covers\/[a-z0-9-]+\.(webp|jpg|png)$/.test(cover)) {
    bytes = await readFile(new URL(`public${cover}`, root)).catch(() => null)
  }
  if (!bytes) return null
  const { data, info } = await sharp(bytes).resize({ height }).png().toBuffer({ resolveWithObject: true })
  return { src: `data:image/png;base64,${data.toString('base64')}`, width: info.width, height: info.height }
}

function footer(logo) {
  return h(
    'div',
    { style: { display: 'flex', alignItems: 'center' } },
    h('img', { src: logo, width: 60, height: 60 }),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', marginLeft: 16 } },
      h('div', { style: { fontFamily: 'Fraunces', fontSize: 30, color: PAPER } }, 'Hyderabad Reads'),
      h('div', { style: { marginTop: 2, fontSize: 20, color: '#9d8f7d' } }, 'hyderabadreads.fun'),
    ),
  )
}

function titleSize(text) {
  return text.length <= 18 ? 80 : text.length <= 32 ? 66 : text.length <= 52 ? 54 : 44
}

// A book without a cover gets a plain cloth-bound front in its spine colours.
function clothCover(book, height) {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: Math.round(height * 0.66),
        height,
        padding: 32,
        borderRadius: 6,
        backgroundColor: book.color ?? '#1d2f52',
        color: PAPER,
        fontFamily: 'Fraunces',
        fontSize: 38,
        lineHeight: 1.1,
        boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
      },
    },
    book.title,
  )
}

export async function bookImage(db, book) {
  const { fonts, logo } = await loadAssets()
  const cover = await coverImage(db, book.cover, 470)
  const where = book.sample ? `Sample shelf · ${book.owner}` : `On ${book.owner}’s shelf`
  const card = h(
    'div',
    { style: { display: 'flex', alignItems: 'center', width: 1200, height: 630, padding: '0 80px', fontFamily: 'Inter', color: PAPER, ...BACKGROUND } },
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'center', width: 360, marginRight: 72 } },
      cover
        ? h('img', { src: cover.src, width: cover.width, height: cover.height, style: { borderRadius: 6, boxShadow: '0 30px 60px rgba(0,0,0,0.6)' } })
        : clothCover(book, 470),
    ),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', width: 1200 - 160 - 360 - 72 } },
      h('div', { style: { fontSize: 22, fontWeight: 600, letterSpacing: 4, color: AMBER, textTransform: 'uppercase' } }, where),
      h('div', { style: { marginTop: 22, fontFamily: 'Fraunces', fontSize: titleSize(book.title), lineHeight: 1.04 } }, book.title),
      h('div', { style: { marginTop: 18, fontSize: 30, color: '#d6c8b2' } }, book.author),
      h('div', { style: { display: 'flex', marginTop: 60 } }, footer(logo)),
    ),
  )
  return render(card, fonts)
}

export async function shelfImage(db, member, books) {
  const { fonts, logo } = await loadAssets()
  const picks = books.filter((b) => b.cover).slice(0, 5)
  const covers = (await Promise.all(picks.map((b) => coverImage(db, b.cover, 290)))).filter(Boolean)
  const genres = [...new Set(books.map((b) => b.genre))].slice(0, 2).join(', ')
  const count = `${books.length} ${books.length === 1 ? 'book' : 'books'}${genres ? ` · ${genres}` : ''}`
  // Up to five covers fanned out like a hand of cards: overlapping, each turned
  // a little more, the outer ones dropped slightly lower.
  const FAN_W = 460
  const fan = covers.map((c, i) => {
    const offset = i - (covers.length - 1) / 2
    return h('img', {
      src: c.src,
      width: c.width,
      height: c.height,
      style: {
        marginLeft: i ? -c.width * 0.62 : 0,
        marginTop: Math.abs(offset) * 24,
        transform: `rotate(${offset * 6}deg)`,
        borderRadius: 5,
        boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
      },
    })
  })
  const card = h(
    'div',
    { style: { display: 'flex', alignItems: 'center', position: 'relative', width: 1200, height: 630, padding: '0 80px', fontFamily: 'Inter', color: PAPER, ...BACKGROUND } },
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', width: 560 } },
      h('div', { style: { fontSize: 22, fontWeight: 600, letterSpacing: 4, color: AMBER, textTransform: 'uppercase' } }, 'A shelf at Hyderabad Reads'),
      h('div', { style: { marginTop: 22, fontFamily: 'Fraunces', fontSize: titleSize(`${member.name}’s shelf`), lineHeight: 1.04 } }, `${member.name}’s shelf`),
      h('div', { style: { marginTop: 18, fontSize: 28, lineHeight: 1.35, color: '#d6c8b2' } }, count),
      h('div', { style: { display: 'flex', marginTop: 56 } }, footer(logo)),
    ),
    h('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', width: FAN_W, marginLeft: 20 } }, fan),
  )
  return render(card, fonts)
}
