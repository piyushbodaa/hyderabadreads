// Everything a visitor can see, in one round trip to the database: members,
// books, this month's calendar onwards and the club's settings. Nothing
// private goes in here: a book shows as on loan, but not who has it.

export async function loadLibrary(db) {
  const [members, books, meetups, settings] = await db.batch([
    [`SELECT name, slug FROM members WHERE removed_at IS NULL ORDER BY lower(name)`],
    [
      `SELECT b.slug AS id, b.title, b.author, b.genre, b.language, b.blurb, b.note, b.isbn, b.year, b.pages,
         b.ol_key AS "olKey", b.cover, b.cover_w AS w, b.cover_h AS h, b.color, b.accent, b.sample,
         to_char(b.added_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS added, m.name AS owner,
         EXISTS (SELECT 1 FROM loans l WHERE l.book_id = b.id AND l.status = 'lent') AS "onLoan"
       FROM books b JOIN members m ON m.id = b.owner_id
       WHERE b.removed_at IS NULL AND m.removed_at IS NULL
       ORDER BY lower(m.name), b.added_at, b.id`,
    ],
    [
      `SELECT to_char(mt.date, 'YYYY-MM-DD') AS date, v.name AS venue, v.area, COALESCE(mt.time, v.time) AS time,
         mt.note, mt.cancelled
       FROM meetups mt JOIN venues v ON v.id = mt.venue_id
       WHERE mt.date >= (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - interval '1 month')::date
       ORDER BY mt.date, v.name`,
    ],
    [`SELECT key, value FROM settings`],
  ])
  const club = Object.fromEntries(settings.map((s) => [s.key, s.value]))
  for (const m of meetups) m.time ??= club.default_time ?? ''
  return { members, books, meetups, club }
}
