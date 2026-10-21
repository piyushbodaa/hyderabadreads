// Brings the database up to date during each Vercel build: runs any new
// migrations, and fills an empty database with the starting shelves. Without a
// DATABASE_URL (a local build, CI) there's nothing to migrate.
import { databaseUrl, database } from '../server/neon.js'
import { migrate } from '../server/migrate.js'

if (!databaseUrl()) {
  console.log('[migrate] no DATABASE_URL, skipping')
} else {
  const { applied, seeded } = await migrate(database())
  console.log(`[migrate] ${applied.length ? `applied ${applied.join(', ')}` : 'schema up to date'}${seeded ? '; filled the starting shelves' : ''}`)
}
