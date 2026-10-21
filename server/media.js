// Images uploaded through the site (book covers now, meetup photos later),
// stored in the database and served at /media/<sha256>.<ext>. The address is
// the image's own hash, so it never changes and caches forever.
import { createHash } from 'node:crypto'

const TYPES = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' }

export async function storeMedia(db, { bytes, ext = 'webp', width = null, height = null }) {
  const hash = createHash('sha256').update(bytes).digest('hex')
  await db.query(
    `INSERT INTO media (hash, mime, width, height, bytes) VALUES ($1, $2, $3, $4, decode($5, 'base64'))
     ON CONFLICT (hash) DO NOTHING`,
    [hash, TYPES[ext], width, height, bytes.toString('base64')],
  )
  return `/media/${hash}.${ext}`
}

export async function mediaResponse(db, file) {
  const m = /^([a-f0-9]{64})\.(webp|jpg|png)$/.exec(file ?? '')
  if (!m) return new Response('Not found', { status: 404 })
  const row = await db.one(`SELECT mime, encode(bytes, 'base64') AS b64 FROM media WHERE hash = $1`, [m[1]])
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(Buffer.from(row.b64, 'base64'), {
    headers: { 'Content-Type': row.mime, 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
}
