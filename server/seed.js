// Fills a brand-new database with the club's starting shelves and calendar
// (src/data), so the first deploy looks exactly like the site did before it
// had a database. Every statement is safe to re-run.
import { readFileSync } from 'node:fs'
import { readers } from '../src/data/library.js'
import { meetups, VENUES, TIME, INSTAGRAM } from '../src/data/meetups.js'
import { bookSlug, slugify } from '../src/lib/slug.js'

const covers = JSON.parse(readFileSync(new URL('../src/data/covers.json', import.meta.url), 'utf8'))

// Members who can invite others, run the calendar and tidy any shelf.
const ADMINS = new Set(['Piyush'])

export async function seedIfEmpty(db) {
  const { n } = await db.one('SELECT count(*)::int AS n FROM members')
  if (n > 0) return false
  await db.batch(seedStatements())
  return true
}

export function seedStatements() {
  const statements = []
  for (const reader of readers) {
    statements.push([
      'INSERT INTO members (name, slug, is_admin) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
      [reader.name, slugify(reader.name), ADMINS.has(reader.name)],
    ])
  }

  // Same ids as the site always used, so old links still open the right book.
  const seen = new Map()
  for (const reader of readers) {
    for (const raw of reader.books) {
      const base = bookSlug(raw)
      const dupes = seen.get(base) ?? 0
      seen.set(base, dupes + 1)
      const meta = covers[base] ?? {}
      statements.push([
        `INSERT INTO books (slug, owner_id, title, author, genre, language, blurb, note, isbn, year, pages, ol_key,
           cover, cover_w, cover_h, color, accent, sample)
         VALUES ($1, (SELECT id FROM members WHERE slug = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true)
         ON CONFLICT (slug) DO NOTHING`,
        [
          dupes ? `${base}--${slugify(reader.name)}` : base,
          slugify(reader.name),
          raw.title,
          raw.author,
          raw.genre ?? 'Other',
          raw.language ?? 'English',
          raw.blurb ?? '',
          raw.note ?? '',
          raw.isbn ?? null,
          raw.year ?? meta.year ?? null,
          meta.pages ?? null,
          meta.olKey ?? null,
          meta.cover ? `/${meta.cover}` : null,
          meta.width ?? null,
          meta.height ?? null,
          meta.color ?? null,
          meta.accent ?? null,
        ],
      ])
    }
  }

  for (const [name, venue] of Object.entries(VENUES)) {
    statements.push([
      'INSERT INTO venues (name, area, time) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      [name, venue.area ?? '', venue.time ?? null],
    ])
  }
  for (const m of meetups) {
    statements.push([
      `INSERT INTO meetups (date, venue_id, time) VALUES ($1, (SELECT id FROM venues WHERE name = $2), $3)
       ON CONFLICT (date, venue_id) DO NOTHING`,
      [m.date, m.venue, m.time ?? null],
    ])
  }

  const settings = { default_time: TIME, instagram: INSTAGRAM, fee: '', overdue_weeks: '6' }
  for (const [key, value] of Object.entries(settings)) {
    statements.push(['INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, value]])
  }
  return statements
}
