// A local Postgres for development and tests, no server to install. Pass a
// folder to keep the data between runs, or nothing for a throwaway database.
import { mkdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { fromPglite } from './db.js'
import { migrate } from './migrate.js'

export async function localDatabase(dir) {
  if (dir) mkdirSync(dir, { recursive: true })
  const pg = new PGlite(dir)
  await pg.waitReady
  const db = fromPglite(pg)
  await migrate(db)
  return db
}
