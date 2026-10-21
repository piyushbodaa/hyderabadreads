// What signed-in members can do: see and manage their own shelf, and (for
// admins) look after the club's members and send them sign-in links.
import { bookSlug, slugify } from '../src/lib/slug.js'
import { createInvite } from './auth.js'
import { processCover, isIsbn, cleanIsbn } from './openlibrary.js'
import { bookCover } from './covers.js'
import { storeMedia } from './media.js'

// A request the server refuses, with a message the page can show as it is.
export class Problem extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function text(value, max, label, { required = false, lines = false } = {}) {
  let s = typeof value === 'string' ? value.trim() : ''
  s = lines ? s.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ')
  if (required && !s) throw new Problem(400, `${label} can’t be empty.`)
  if (s.length > max) throw new Problem(400, `${label} is too long (${max} characters at most).`)
  return s
}

function whole(value, min, max) {
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

const BOOK_FIELDS = `b.slug AS id, b.title, b.author, b.genre, b.language, b.blurb, b.note, b.isbn, b.year, b.pages,
  b.ol_key AS "olKey", b.cover, b.cover_w AS w, b.cover_h AS h, b.color, b.accent, b.sample,
  to_char(b.added_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS added`

export async function myShelf(db, member) {
  const books = await db.query(
    `SELECT ${BOOK_FIELDS} FROM books b WHERE b.owner_id = $1 AND b.removed_at IS NULL ORDER BY b.added_at DESC, b.id DESC`,
    [member.id],
  )
  return { member: { name: member.name, slug: member.slug, isAdmin: member.isAdmin }, books }
}

export async function addBook(db, member, input, { fetch } = {}) {
  const title = text(input.title, 200, 'The title', { required: true })
  const author = text(input.author, 120, 'The author', { required: true })
  const isbn = isIsbn(input.isbn) ? cleanIsbn(input.isbn) : null
  const coverId = whole(input.coverId, 1, 1e10)
  const olKey = /^\/works\/OL\d+W$/.test(input.olKey ?? '') ? input.olKey : null

  // The cover comes from Apple Books or Open Library (server/covers.js),
  // fetched and resized here. Without one the book still goes on the shelf,
  // as a cloth-bound spine.
  let cover = {}
  const bytes = await bookCover({ title, author, isbn, coverId }, { fetch })
  if (bytes) {
    try {
      const { webp, width, height, color, accent } = await processCover(bytes)
      cover = { path: await storeMedia(db, { bytes: webp, width, height }), width, height, color, accent }
    } catch {
      cover = {}
    }
  }

  const base = bookSlug({ title, author }) || 'book'
  const candidates = [base, `${base}--${member.slug}`, ...Array.from({ length: 8 }, (_, i) => `${base}--${member.slug}-${i + 2}`)]
  for (const slug of candidates) {
    const row = await db.one(
      `INSERT INTO books (slug, owner_id, title, author, genre, language, blurb, note, isbn, year, pages, ol_key,
         cover, cover_w, cover_h, color, accent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (slug) DO NOTHING
       RETURNING slug`,
      [
        slug,
        member.id,
        title,
        author,
        text(input.genre, 40, 'The genre') || 'Other',
        text(input.language, 30, 'The language') || 'English',
        text(input.blurb, 600, 'The description', { lines: true }),
        text(input.note, 500, 'Your note', { lines: true }),
        isbn,
        whole(input.year, -3000, 2100),
        whole(input.pages, 1, 20000),
        olKey,
        cover.path ?? null,
        cover.width ?? null,
        cover.height ?? null,
        cover.color ?? null,
        cover.accent ?? null,
      ],
    )
    if (row) return db.one(`SELECT ${BOOK_FIELDS} FROM books b WHERE b.slug = $1`, [row.slug])
  }
  throw new Problem(409, 'You already have several copies of this book on your shelf.')
}

// Owners can change their notes and how a book is shelved; admins can tidy any shelf.
async function ownBook(db, member, slug) {
  const book = await db.one('SELECT id, owner_id FROM books WHERE slug = $1 AND removed_at IS NULL', [slug ?? ''])
  if (!book) throw new Problem(404, 'That book isn’t on the shelves any more.')
  if (book.owner_id !== member.id && !member.isAdmin) throw new Problem(403, 'Only the book’s owner can change it.')
  return book
}

export async function updateBook(db, member, slug, input) {
  const book = await ownBook(db, member, slug)
  const fields = {
    note: input.note !== undefined && text(input.note, 500, 'Your note', { lines: true }),
    blurb: input.blurb !== undefined && text(input.blurb, 600, 'The description', { lines: true }),
    genre: input.genre !== undefined && (text(input.genre, 40, 'The genre') || 'Other'),
    language: input.language !== undefined && (text(input.language, 30, 'The language') || 'English'),
  }
  const changes = Object.entries(fields).filter(([, v]) => v !== false)
  if (!changes.length) throw new Problem(400, 'Nothing to change.')
  await db.query(
    `UPDATE books SET ${changes.map(([k], i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [book.id, ...changes.map(([, v]) => v)],
  )
  return db.one(`SELECT ${BOOK_FIELDS} FROM books b WHERE b.id = $1`, [book.id])
}

export async function removeBook(db, member, slug) {
  const book = await ownBook(db, member, slug)
  await db.query('UPDATE books SET removed_at = now() WHERE id = $1', [book.id])
}

// The starting shelves were placeholders. A member either keeps them (they
// really do own those books) or clears them away.
export async function shelfAction(db, member, action) {
  if (action === 'confirm') {
    await db.query('UPDATE books SET sample = false WHERE owner_id = $1 AND sample AND removed_at IS NULL', [member.id])
  } else if (action === 'clear-samples') {
    await db.query('UPDATE books SET removed_at = now() WHERE owner_id = $1 AND sample AND removed_at IS NULL', [member.id])
  } else {
    throw new Problem(400, 'Unknown shelf action.')
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────

const day = (column) => `to_char(${column} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`

export async function adminData(db) {
  const members = await db.query(
    `SELECT m.name, m.slug, m.is_admin AS "isAdmin",
       (SELECT count(*)::int FROM books b WHERE b.owner_id = m.id AND b.removed_at IS NULL) AS books,
       (SELECT count(*)::int FROM books b WHERE b.owner_id = m.id AND b.removed_at IS NULL AND b.sample) AS samples,
       (SELECT ${day('max(i.created_at)')} FROM invites i WHERE i.member_id = m.id AND i.revoked_at IS NULL) AS "invitedOn",
       (SELECT ${day('max(i.used_at)')} FROM invites i WHERE i.member_id = m.id) AS "joinedOn",
       (SELECT ${day('max(s.last_seen_at)')} FROM sessions s WHERE s.member_id = m.id) AS "lastSeen"
     FROM members m WHERE m.removed_at IS NULL ORDER BY lower(m.name)`,
  )
  return { members }
}

async function memberBySlug(db, slug) {
  const m = await db.one('SELECT id, name, slug, is_admin AS "isAdmin" FROM members WHERE slug = $1 AND removed_at IS NULL', [slug ?? ''])
  if (!m) throw new Problem(404, 'There’s no member by that name.')
  return m
}

export async function adminAction(db, admin, input, { origin }) {
  switch (input.action) {
    case 'add-member': {
      const name = text(input.name, 40, 'The name', { required: true })
      if (await db.one('SELECT 1 FROM members WHERE lower(name) = lower($1) AND removed_at IS NULL', [name])) {
        throw new Problem(409, `${name} is already a member.`)
      }
      const base = slugify(name) || 'member'
      for (const slug of [base, ...Array.from({ length: 8 }, (_, i) => `${base}-${i + 2}`)]) {
        const row = await db.one('INSERT INTO members (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING RETURNING slug', [name, slug])
        if (row) return { slug: row.slug }
      }
      throw new Problem(409, 'Couldn’t find a free address for that name.')
    }
    case 'invite': {
      const member = await memberBySlug(db, input.slug)
      const token = await createInvite(db, (await db.one('SELECT id FROM members WHERE slug = $1', [member.slug])).id)
      const link = `${origin}/join/${token}`
      return {
        link,
        message: `Hi ${member.name}! Here’s your own sign-in link for Hyderabad Reads, to put your books on the shelf: ${link}\nIt’s just for you, so please don’t share it.`,
      }
    }
    case 'rename': {
      const member = await memberBySlug(db, input.slug)
      const name = text(input.name, 40, 'The name', { required: true })
      await db.query('UPDATE members SET name = $2 WHERE slug = $1', [member.slug, name])
      return {}
    }
    case 'set-admin': {
      const member = await memberBySlug(db, input.slug)
      if (member.slug === admin.slug) throw new Problem(400, 'You can’t change your own admin rights.')
      await db.query('UPDATE members SET is_admin = $2 WHERE slug = $1', [member.slug, Boolean(input.isAdmin)])
      return {}
    }
    case 'remove-member': {
      const member = await memberBySlug(db, input.slug)
      if (member.slug === admin.slug) throw new Problem(400, 'You can’t remove yourself.')
      await db.batch([
        ['UPDATE members SET removed_at = now() WHERE slug = $1', [member.slug]],
        ['UPDATE invites SET revoked_at = now() WHERE member_id = (SELECT id FROM members WHERE slug = $1) AND revoked_at IS NULL', [member.slug]],
        ['DELETE FROM sessions WHERE member_id = (SELECT id FROM members WHERE slug = $1)', [member.slug]],
      ])
      return {}
    }
    default:
      throw new Problem(400, 'Unknown action.')
  }
}
