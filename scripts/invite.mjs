// Prints a personal sign-in link for a member, for when there's no admin yet
// to make one on the site. Usually only needed once, for the first admin:
//
//   vercel env pull .env.production.local --environment production
//   node --env-file=.env.production.local scripts/invite.mjs Piyush
//
// Making a new link cancels that member's previous one.
import { databaseUrl, database } from '../server/neon.js'
import { createInvite } from '../server/auth.js'

const name = process.argv[2]
const origin = process.argv[3] ?? 'https://hyderabadreads.fun'
if (!name) {
  console.error('Usage: node scripts/invite.mjs <member name> [site origin]')
  process.exit(1)
}
if (!databaseUrl()) {
  console.error('No DATABASE_URL. Pull the production environment first (see the comment at the top of this file).')
  process.exit(1)
}
const db = database()
const member = await db.one('SELECT id, name FROM members WHERE lower(name) = lower($1) AND removed_at IS NULL', [name])
if (!member) {
  console.error(`No member called ${name}.`)
  process.exit(1)
}
console.log(`Sign-in link for ${member.name} (keep it private):\n${origin}/join/${await createInvite(db, member.id)}`)
