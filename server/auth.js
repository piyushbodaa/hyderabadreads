// Signing in without passwords, emails or phone numbers. An admin makes each
// member a personal link (/join/<token>) and sends it to them on WhatsApp.
// Opening it signs that browser in for 180 days. A link keeps working, so a
// member can use theirs on a phone and a laptop, until an admin makes them a
// new one, which cancels the old link.
//
// Tokens are 256 random bits. The database only ever stores their SHA-256, so
// a copy of the database can't be used to sign in.
import { createHash, randomBytes } from 'node:crypto'

export const SESSION_COOKIE = 'hr_session'
// Not secret: lets the page know someone is signed in, so it asks who.
export const HINT_COOKIE = 'hr_member'
const SESSION_DAYS = 180

export const newToken = () => randomBytes(32).toString('base64url')
export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex')

export async function createInvite(db, memberId) {
  const token = newToken()
  await db.batch([
    ['UPDATE invites SET revoked_at = now() WHERE member_id = $1 AND revoked_at IS NULL', [memberId]],
    ['INSERT INTO invites (token_hash, member_id) VALUES ($1, $2)', [hashToken(token), memberId]],
  ])
  return token
}

// A valid link starts a session and returns its token; anything else, null.
export async function redeemInvite(db, token) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token ?? '')) return null
  const invite = await db.one(
    `UPDATE invites SET used_at = COALESCE(used_at, now()), last_used_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL
       AND member_id IN (SELECT id FROM members WHERE removed_at IS NULL)
     RETURNING member_id`,
    [hashToken(token)],
  )
  if (!invite) return null
  const session = newToken()
  await db.query(
    `INSERT INTO sessions (token_hash, member_id, expires_at, last_seen_at)
     VALUES ($1, $2, now() + make_interval(days => $3), now())`,
    [hashToken(session), invite.member_id, SESSION_DAYS],
  )
  return session
}

export async function currentMember(db, request) {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null
  return db.one(
    `UPDATE sessions s SET last_seen_at = now()
     FROM members m
     WHERE s.token_hash = $1 AND s.expires_at > now() AND m.id = s.member_id AND m.removed_at IS NULL
     RETURNING m.id, m.name, m.slug, m.is_admin AS "isAdmin"`,
    [hashToken(token)],
  )
}

export async function endSession(db, request) {
  const token = readCookie(request, SESSION_COOKIE)
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
}

export function sessionCookies(token, request) {
  const flags = `Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure(request)}`
  return [`${SESSION_COOKIE}=${token}; HttpOnly; ${flags}`, `${HINT_COOKIE}=1; ${flags}`]
}

export function clearedCookies(request) {
  const flags = `Path=/; SameSite=Lax; Max-Age=0${secure(request)}`
  return [`${SESSION_COOKIE}=; HttpOnly; ${flags}`, `${HINT_COOKIE}=; ${flags}`]
}

const secure = (request) => (new URL(request.url).protocol === 'https:' ? '; Secure' : '')

export function readCookie(request, name) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

// Changes only come from the site's own pages: a cross-site form or script
// can't send JSON with our cookies, and the Origin header has to match.
export function sameOrigin(request) {
  const origin = request.headers.get('origin')
  if (origin) return origin === new URL(request.url).origin
  return request.headers.get('sec-fetch-site') === 'same-origin'
}
