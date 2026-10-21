// A cover for a book being added: Apple Books' artwork first, which is the
// publisher's own at up to 1400px tall, then Open Library's. Either can be
// down or missing a book; with neither, the book goes on the shelf as a
// cloth-bound spine.
import { fetchCover } from './openlibrary.js'

const UA = 'HyderabadReads/1.0 (https://hyderabadreads.fun)'
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
// "The Guide: A Novel" and "Guide" are the same book.
const bare = (title) => norm(String(title ?? '').split(/:| - /)[0]).replace(/^(the|a|an) /, '')
const surname = (author) => norm(String(author ?? '').split('&')[0]).split(' ').pop()
// Artwork of English-language and Indian editions, going by the ISBN Apple
// names the file with, so a translation's cover never stands in.
const ENGLISH = /^(978[01]|97881|97893|9798)/

export async function bookCover({ title, author, isbn, coverId }, { fetch = globalThis.fetch } = {}) {
  return (await appleCover({ title, author }, { fetch })) ?? (await fetchCover({ isbn, coverId }, { fetch }))
}

// Apple sells no ebooks in India, so its UK store (whose editions India mostly
// shares) comes first, then the US one.
export async function appleCover({ title, author }, { fetch = globalThis.fetch } = {}) {
  const want = bare(title)
  const who = surname(author)
  if (!want || !who) return null
  for (const country of ['gb', 'us']) {
    try {
      const params = new URLSearchParams({ term: `${title} ${who}`, media: 'ebook', entity: 'ebook', country, limit: '15' })
      const res = await fetch(`https://itunes.apple.com/search?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) })
      if (!res.ok) continue
      const { results = [] } = await res.json()
      const hit = results.find((r) => {
        const found = bare(r.trackName)
        const isbn = String(r.artworkUrl100 ?? '').match(/\/(\d{13})\.\w+\//)?.[1]
        return (
          r.artworkUrl100 &&
          (found === want || found.startsWith(`${want} `) || want.startsWith(`${found} `)) &&
          norm(r.artistName).includes(who) &&
          (!isbn || ENGLISH.test(isbn))
        )
      })
      if (!hit) continue
      const art = await fetch(hit.artworkUrl100.replace(/\/\d+x\d+bb\.\w+$/, '/1400x1400bb.jpg'), {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      })
      if (!art.ok) continue
      const bytes = Buffer.from(await art.arrayBuffer())
      if (bytes.length > 2000) return bytes
    } catch {
      // That store didn't answer; try the next, then Open Library.
    }
  }
  return null
}
