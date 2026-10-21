// The Wanted shelf (books members are looking for), the club's stats, and
// each member's year in review.
import { Problem } from './members.js'

function text(value, max, label, required = false) {
  const s = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (required && !s) throw new Problem(400, `${label} can’t be empty.`)
  if (s.length > max) throw new Problem(400, `${label} is too long.`)
  return s
}

// ── Wanted ────────────────────────────────────────────────────────────────

export const WISHES_QUERY = `SELECT w.id, w.title, w.author, w.cover_id AS "coverId", m.name AS wisher,
    to_char(w.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS added
  FROM wishes w JOIN members m ON m.id = w.member_id
  WHERE w.removed_at IS NULL AND m.removed_at IS NULL
  ORDER BY w.created_at DESC LIMIT 40`

export async function addWish(db, member, input) {
  const title = text(input.title, 200, 'The title', true)
  const author = text(input.author, 120, 'The author')
  const coverId = Number.isInteger(Number(input.coverId)) && Number(input.coverId) > 0 && Number(input.coverId) < 2 ** 31 ? Number(input.coverId) : null
  const olKey = /^\/works\/OL\d+W$/.test(input.olKey ?? '') ? input.olKey : null
  const open = await db.one(
    `SELECT count(*)::int AS n FROM wishes WHERE member_id = $1 AND removed_at IS NULL`,
    [member.id],
  )
  if (open.n >= 20) throw new Problem(400, 'That’s 20 books you’re looking for already. Clear a few first.')
  if (await db.one(`SELECT 1 FROM wishes WHERE member_id = $1 AND removed_at IS NULL AND lower(title) = lower($2)`, [member.id, title])) {
    throw new Problem(409, 'It’s already on your Wanted list.')
  }
  return db.one(
    `INSERT INTO wishes (member_id, title, author, ol_key, cover_id, note) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, author, cover_id AS "coverId"`,
    [member.id, title, author, olKey, coverId, text(input.note, 200, 'The note')],
  )
}

export async function removeWish(db, member, id) {
  const wish = await db.one('SELECT member_id FROM wishes WHERE id = $1 AND removed_at IS NULL', [Number(id) || 0])
  if (!wish) throw new Problem(404, 'That isn’t on the Wanted list any more.')
  if (wish.member_id !== member.id && !member.isAdmin) throw new Problem(403, 'Only the member who asked can take it off the list.')
  await db.query('UPDATE wishes SET removed_at = now() WHERE id = $1', [Number(id)])
}

export async function myWishes(db, member) {
  return db.query(
    `SELECT id, title, author, cover_id AS "coverId" FROM wishes WHERE member_id = $1 AND removed_at IS NULL ORDER BY created_at DESC`,
    [member.id],
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────

// The club in numbers. Real books only, not samples. Who lends the most is
// only shown to signed-in members.
export async function clubStats(db, member) {
  const [totals, genres, languages, borrowed, wanted, lenders] = await db.batch([
    [
      `SELECT
         (SELECT count(*)::int FROM books b JOIN members m ON m.id = b.owner_id WHERE b.removed_at IS NULL AND NOT b.sample AND m.removed_at IS NULL) AS books,
         (SELECT count(DISTINCT b.owner_id)::int FROM books b WHERE b.removed_at IS NULL AND NOT b.sample) AS shelves,
         (SELECT COALESCE(sum(b.pages), 0)::int FROM books b WHERE b.removed_at IS NULL AND NOT b.sample) AS pages,
         (SELECT count(*)::int FROM loans WHERE lent_at IS NOT NULL) AS loans,
         (SELECT count(*)::int FROM loans WHERE status = 'lent') AS out,
         (SELECT count(*)::int FROM wishes WHERE removed_at IS NULL) AS wanted`,
    ],
    [
      `SELECT genre AS label, count(*)::int AS n FROM books WHERE removed_at IS NULL AND NOT sample
       GROUP BY genre ORDER BY n DESC, genre LIMIT 12`,
    ],
    [
      `SELECT language AS label, count(*)::int AS n FROM books WHERE removed_at IS NULL AND NOT sample
       GROUP BY language ORDER BY n DESC, language LIMIT 8`,
    ],
    [
      `SELECT b.slug AS id, b.title, b.author, count(*)::int AS n
       FROM loans l JOIN books b ON b.id = l.book_id
       WHERE l.lent_at IS NOT NULL AND b.removed_at IS NULL
       GROUP BY b.id ORDER BY n DESC, b.title LIMIT 5`,
    ],
    [
      `SELECT min(title) AS title, min(author) AS author, count(*)::int AS n FROM wishes WHERE removed_at IS NULL
       GROUP BY lower(title) ORDER BY n DESC, min(title) LIMIT 5`,
    ],
    [
      `SELECT m.name, count(*)::int AS n FROM loans l JOIN books b ON b.id = l.book_id JOIN members m ON m.id = b.owner_id
       WHERE l.lent_at IS NOT NULL AND m.removed_at IS NULL
       GROUP BY m.id ORDER BY n DESC, m.name LIMIT 5`,
    ],
  ])
  return { totals: totals[0], genres, languages, mostBorrowed: borrowed, mostWanted: wanted, ...(member && { lenders }) }
}

// ── A member's year ───────────────────────────────────────────────────────

export async function yearFor(db, member, year) {
  const y = Number(year)
  if (!Number.isInteger(y) || y < 2026 || y > 2100) throw new Problem(400, 'Pick a year.')
  const range = [`${y}-01-01`, `${y + 1}-01-01`]
  const [added, lent, borrowed, genres, favourite] = await db.batch([
    [
      `SELECT count(*)::int AS n, COALESCE(sum(pages), 0)::int AS pages FROM books
       WHERE owner_id = $1 AND NOT sample AND added_at >= $2::date AND added_at < $3::date`,
      [member.id, ...range],
    ],
    [
      `SELECT count(*)::int AS n, count(DISTINCT l.borrower_id)::int AS people, COALESCE(sum(b.pages), 0)::int AS pages
       FROM loans l JOIN books b ON b.id = l.book_id
       WHERE b.owner_id = $1 AND l.lent_at >= $2::date AND l.lent_at < $3::date`,
      [member.id, ...range],
    ],
    [
      `SELECT count(*)::int AS n, COALESCE(sum(b.pages), 0)::int AS pages
       FROM loans l JOIN books b ON b.id = l.book_id
       WHERE l.borrower_id = $1 AND l.lent_at >= $2::date AND l.lent_at < $3::date`,
      [member.id, ...range],
    ],
    [
      `SELECT b.genre AS label, count(*)::int AS n FROM loans l JOIN books b ON b.id = l.book_id
       WHERE l.borrower_id = $1 AND l.lent_at >= $2::date AND l.lent_at < $3::date
       GROUP BY b.genre ORDER BY n DESC, b.genre LIMIT 1`,
      [member.id, ...range],
    ],
    // Their book that went out the most.
    [
      `SELECT b.title, count(*)::int AS n FROM loans l JOIN books b ON b.id = l.book_id
       WHERE b.owner_id = $1 AND l.lent_at >= $2::date AND l.lent_at < $3::date
       GROUP BY b.id ORDER BY n DESC, b.title LIMIT 1`,
      [member.id, ...range],
    ],
  ])
  return {
    year: y,
    name: member.name,
    added: added[0],
    lent: lent[0],
    borrowed: borrowed[0],
    topGenre: genres[0]?.label ?? null,
    mostLent: favourite[0] ?? null,
  }
}
