// Lending: asking for a book, the owner lending it (at a meetup, or by
// scanning the bookplate inside it), and its coming back. Everyone can see
// that a book is out; only signed-in members see who has it.
import { Problem } from './members.js'

const day = (column) => `to_char(${column} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`
const TODAY = `(now() AT TIME ZONE 'Asia/Kolkata')::date`

async function overdueWeeks(db) {
  const row = await db.one(`SELECT value FROM settings WHERE key = 'overdue_weeks'`)
  return Math.max(1, Number(row?.value) || 6)
}

export async function nextMeetupDate(db) {
  const row = await db.one(`SELECT to_char(date, 'YYYY-MM-DD') AS date FROM meetups WHERE date >= ${TODAY} AND NOT cancelled ORDER BY date LIMIT 1`)
  return row?.date ?? null
}

// Everything about lending that a signed-in member's pages need.
export async function lendingFor(db, member) {
  const weeks = await overdueWeeks(db)
  const overdue = `l.lent_at < now() - make_interval(weeks => ${weeks})`
  const [out, toBring, asked, borrowed, lentOut, members] = await db.batch([
    // Every book that's out, across the club.
    [
      `SELECT b.slug AS "bookId", bm.name AS borrower, ${day('l.lent_at')} AS since, ${overdue} AS overdue
       FROM loans l JOIN books b ON b.id = l.book_id JOIN members bm ON bm.id = l.borrower_id
       WHERE l.status = 'lent' AND b.removed_at IS NULL`,
    ],
    // Requests for this member's books: their bring list.
    [
      `SELECT l.id, b.slug AS "bookId", b.title, bm.name AS borrower, to_char(l.meetup_date, 'YYYY-MM-DD') AS meetup,
         EXISTS (SELECT 1 FROM loans o WHERE o.book_id = b.id AND o.status = 'lent') AS "stillOut"
       FROM loans l JOIN books b ON b.id = l.book_id JOIN members bm ON bm.id = l.borrower_id
       WHERE l.status = 'requested' AND b.owner_id = $1 AND b.removed_at IS NULL
       ORDER BY l.meetup_date NULLS LAST, l.requested_at`,
      [member.id],
    ],
    // What this member has asked for.
    [
      `SELECT l.id, b.slug AS "bookId", b.title, om.name AS owner, to_char(l.meetup_date, 'YYYY-MM-DD') AS meetup
       FROM loans l JOIN books b ON b.id = l.book_id JOIN members om ON om.id = b.owner_id
       WHERE l.status = 'requested' AND l.borrower_id = $1 AND b.removed_at IS NULL
       ORDER BY l.requested_at`,
      [member.id],
    ],
    // Books this member has borrowed.
    [
      `SELECT l.id, b.slug AS "bookId", b.title, om.name AS owner, ${day('l.lent_at')} AS since, ${overdue} AS overdue
       FROM loans l JOIN books b ON b.id = l.book_id JOIN members om ON om.id = b.owner_id
       WHERE l.status = 'lent' AND l.borrower_id = $1
       ORDER BY l.lent_at`,
      [member.id],
    ],
    // This member's books that are out.
    [
      `SELECT l.id, b.slug AS "bookId", b.title, bm.name AS borrower, ${day('l.lent_at')} AS since, ${overdue} AS overdue
       FROM loans l JOIN books b ON b.id = l.book_id JOIN members bm ON bm.id = l.borrower_id
       WHERE l.status = 'lent' AND b.owner_id = $1
       ORDER BY l.lent_at`,
      [member.id],
    ],
    // Who a book can be lent to.
    [`SELECT name, slug FROM members WHERE removed_at IS NULL AND id <> $1 ORDER BY lower(name)`, [member.id]],
  ])
  return { out, toBring, asked, borrowed, lentOut, members, overdueWeeks: weeks }
}

async function bookBySlug(db, slug) {
  const book = await db.one(
    `SELECT b.id, b.title, b.owner_id, b.sample, m.name AS owner FROM books b JOIN members m ON m.id = b.owner_id
     WHERE b.slug = $1 AND b.removed_at IS NULL`,
    [slug ?? ''],
  )
  if (!book) throw new Problem(404, 'That book isn’t on the shelves any more.')
  return book
}

async function loanById(db, id) {
  const loan = await db.one(
    `SELECT l.id, l.status, l.borrower_id, b.owner_id, b.title FROM loans l JOIN books b ON b.id = l.book_id WHERE l.id = $1`,
    [Number(id) || 0],
  )
  if (!loan) throw new Problem(404, 'That loan isn’t there any more.')
  return loan
}

async function holder(db, bookId) {
  return db.one(`SELECT m.name FROM loans l JOIN members m ON m.id = l.borrower_id WHERE l.book_id = $1 AND l.status = 'lent'`, [bookId])
}

// The unique indexes are what really stop a book going out twice; this turns
// the database's refusal into words.
async function guardOut(db, bookId, run) {
  try {
    return await run()
  } catch (err) {
    if (err.code !== '23505') throw err
    const who = await holder(db, bookId)
    throw new Problem(409, who ? `That book is still with ${who.name}. It has to be marked as returned first.` : 'That book is already out.')
  }
}

export async function loanAction(db, member, input) {
  switch (input.action) {
    // A member asks for someone else's book, for the next meetup.
    case 'request': {
      const book = await bookBySlug(db, input.book)
      if (book.owner_id === member.id) throw new Problem(400, 'That one’s already yours.')
      if (book.sample) throw new Problem(400, 'That’s a sample book, so there’s nothing to borrow yet.')
      const row = await db.one(
        `INSERT INTO loans (book_id, borrower_id, status, meetup_date, requested_at)
         VALUES ($1, $2, 'requested', $3, now())
         ON CONFLICT (book_id, borrower_id) WHERE status = 'requested' DO NOTHING
         RETURNING id`,
        [book.id, member.id, await nextMeetupDate(db)],
      )
      if (!row) throw new Problem(409, 'You’ve already asked for this one.')
      return { ok: true }
    }
    case 'cancel': {
      const loan = await loanById(db, input.loan)
      if (loan.borrower_id !== member.id || loan.status !== 'requested') throw new Problem(400, 'Only your own open requests can be cancelled.')
      await db.query(`UPDATE loans SET status = 'cancelled', closed_at = now() WHERE id = $1`, [loan.id])
      return { ok: true }
    }
    case 'decline': {
      const loan = await loanById(db, input.loan)
      if (loan.owner_id !== member.id || loan.status !== 'requested') throw new Problem(400, 'Only requests for your own books can be declined.')
      await db.query(`UPDATE loans SET status = 'declined', closed_at = now() WHERE id = $1`, [loan.id])
      return { ok: true }
    }
    // The owner hands a book over: to whoever asked, or straight to a member.
    case 'lend': {
      if (input.loan) {
        const loan = await loanById(db, input.loan)
        if (loan.owner_id !== member.id || loan.status !== 'requested') throw new Problem(400, 'Only requests for your own books can be lent.')
        const book = await db.one('SELECT book_id FROM loans WHERE id = $1', [loan.id])
        await guardOut(db, book.book_id, () => db.query(`UPDATE loans SET status = 'lent', lent_at = now() WHERE id = $1`, [loan.id]))
        return { ok: true }
      }
      const book = await bookBySlug(db, input.book)
      if (book.owner_id !== member.id) throw new Problem(403, 'Only the book’s owner can lend it.')
      const to = await db.one('SELECT id FROM members WHERE slug = $1 AND removed_at IS NULL AND id <> $2', [input.to ?? '', member.id])
      if (!to) throw new Problem(400, 'Choose who you’re lending it to.')
      await guardOut(db, book.id, () =>
        db.batch([
          [`UPDATE loans SET status = 'cancelled', closed_at = now() WHERE book_id = $1 AND borrower_id = $2 AND status = 'requested'`, [book.id, to.id]],
          [`INSERT INTO loans (book_id, borrower_id, status, lent_at) VALUES ($1, $2, 'lent', now())`, [book.id, to.id]],
        ]),
      )
      return { ok: true }
    }
    // The borrower, book in hand: from the bookplate's QR code, or the book's page.
    case 'got': {
      const book = await bookBySlug(db, input.book)
      if (book.owner_id === member.id) throw new Problem(400, 'That one’s yours already.')
      if (book.sample) throw new Problem(400, 'That’s a sample book, so it can’t be borrowed.')
      await guardOut(db, book.id, async () => {
        const request = await db.one(`SELECT id FROM loans WHERE book_id = $1 AND borrower_id = $2 AND status = 'requested'`, [book.id, member.id])
        if (request) await db.query(`UPDATE loans SET status = 'lent', lent_at = now() WHERE id = $1`, [request.id])
        else await db.query(`INSERT INTO loans (book_id, borrower_id, status, lent_at) VALUES ($1, $2, 'lent', now())`, [book.id, member.id])
      })
      return { ok: true, owner: book.owner }
    }
    // Back on the owner's shelf. Either of them can say so.
    case 'return': {
      const loan = await loanById(db, input.loan)
      if (loan.status !== 'lent' || (loan.owner_id !== member.id && loan.borrower_id !== member.id)) {
        throw new Problem(400, 'Only the owner or the borrower can mark a book as returned.')
      }
      await db.query(`UPDATE loans SET status = 'returned', returned_at = now() WHERE id = $1`, [loan.id])
      return { ok: true }
    }
    // The owner undoes a loan that was marked by mistake.
    case 'undo': {
      const loan = await loanById(db, input.loan)
      if (loan.owner_id !== member.id || loan.status !== 'lent') throw new Problem(400, 'Only the owner can undo a loan.')
      await db.query(`UPDATE loans SET status = 'cancelled', closed_at = now() WHERE id = $1`, [loan.id])
      return { ok: true }
    }
    default:
      throw new Problem(400, 'Unknown lending action.')
  }
}

// The week at the club, for the WhatsApp digest.
export async function digest(db) {
  const weeks = await overdueWeeks(db)
  const [newBooks, meetups, requests, overdue] = await db.batch([
    [
      `SELECT b.title, b.author, m.name AS owner FROM books b JOIN members m ON m.id = b.owner_id
       WHERE b.removed_at IS NULL AND NOT b.sample AND b.added_at > now() - interval '7 days'
       ORDER BY b.added_at DESC LIMIT 15`,
    ],
    [
      `SELECT to_char(mt.date, 'YYYY-MM-DD') AS date, v.name AS venue, v.area,
         COALESCE(mt.time, v.time, (SELECT value FROM settings WHERE key = 'default_time')) AS time
       FROM meetups mt JOIN venues v ON v.id = mt.venue_id
       WHERE mt.date >= ${TODAY} AND NOT mt.cancelled ORDER BY mt.date LIMIT 3`,
    ],
    [`SELECT count(*)::int AS n FROM loans WHERE status = 'requested'`],
    [
      `SELECT b.title, om.name AS owner, bm.name AS borrower, ${day('l.lent_at')} AS since
       FROM loans l JOIN books b ON b.id = l.book_id JOIN members om ON om.id = b.owner_id JOIN members bm ON bm.id = l.borrower_id
       WHERE l.status = 'lent' AND l.lent_at < now() - make_interval(weeks => $1)
       ORDER BY l.lent_at`,
      [weeks],
    ],
  ])
  return { newBooks, meetups, openRequests: requests[0].n, overdue, overdueWeeks: weeks }
}
