// Schema changes, in order. Each migration runs once, in one transaction, and
// is recorded in schema_migrations. Only ever add to the end of this list, and
// keep statements safe to re-run (IF NOT EXISTS), so two builds racing each
// other can't break anything.
import { seedIfEmpty } from './seed.js'

export const MIGRATIONS = [
  {
    id: 1,
    name: 'library',
    statements: [
      `CREATE TABLE IF NOT EXISTS members (
        id serial PRIMARY KEY,
        name text NOT NULL,
        slug text NOT NULL UNIQUE,
        is_admin boolean NOT NULL DEFAULT false,
        joined_at timestamptz NOT NULL DEFAULT now(),
        removed_at timestamptz
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS members_name_key ON members (lower(name)) WHERE removed_at IS NULL`,
      // Covers (and later, photos) uploaded through the site. Covers that came
      // with the original shelves are static files under /covers.
      `CREATE TABLE IF NOT EXISTS media (
        id serial PRIMARY KEY,
        hash text NOT NULL UNIQUE,
        mime text NOT NULL,
        width int,
        height int,
        bytes bytea NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS books (
        id serial PRIMARY KEY,
        slug text NOT NULL UNIQUE,
        owner_id int NOT NULL REFERENCES members (id),
        title text NOT NULL,
        author text NOT NULL,
        genre text NOT NULL DEFAULT 'Other',
        language text NOT NULL DEFAULT 'English',
        blurb text NOT NULL DEFAULT '',
        note text NOT NULL DEFAULT '',
        isbn text,
        year int,
        pages int,
        ol_key text,
        cover text,
        cover_w int,
        cover_h int,
        color text,
        accent text,
        sample boolean NOT NULL DEFAULT false,
        added_at timestamptz NOT NULL DEFAULT now(),
        removed_at timestamptz
      )`,
      `CREATE INDEX IF NOT EXISTS books_owner ON books (owner_id) WHERE removed_at IS NULL`,
      `CREATE TABLE IF NOT EXISTS venues (
        id serial PRIMARY KEY,
        name text NOT NULL UNIQUE,
        area text NOT NULL DEFAULT '',
        time text
      )`,
      `CREATE TABLE IF NOT EXISTS meetups (
        id serial PRIMARY KEY,
        date date NOT NULL,
        venue_id int NOT NULL REFERENCES venues (id),
        time text,
        note text NOT NULL DEFAULT '',
        cancelled boolean NOT NULL DEFAULT false
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS meetups_date_venue ON meetups (date, venue_id)`,
      `CREATE TABLE IF NOT EXISTS settings (
        key text PRIMARY KEY,
        value text NOT NULL
      )`,
    ],
  },
]

export async function migrate(db, { seed = true } = {}) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id int PRIMARY KEY,
    name text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)
  const done = new Set((await db.query('SELECT id FROM schema_migrations')).map((r) => r.id))
  const applied = []
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue
    await db.batch([
      ...m.statements.map((s) => [s]),
      ['INSERT INTO schema_migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [m.id, m.name]],
    ])
    applied.push(m.name)
  }
  const seeded = seed ? await seedIfEmpty(db) : false
  return { applied, seeded }
}
