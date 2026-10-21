// Meetup photos for the newcomers' section. Admins upload them; the server
// keeps a 1600px copy and a 640px thumbnail, both WebP, in the media table.
import sharp from 'sharp'
import { Problem } from './members.js'
import { storeMedia } from './media.js'

const MAX_BYTES = 3.5 * 1024 * 1024

export async function addPhoto(db, input) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(input.image ?? '')
  if (!m) throw new Problem(400, 'That doesn’t look like a photo. Use a JPEG, PNG or WebP image.')
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length > MAX_BYTES) throw new Problem(413, 'That photo is too big. Try a smaller one.')
  const caption = typeof input.caption === 'string' ? input.caption.trim().replace(/\s+/g, ' ').slice(0, 140) : ''

  let large
  let small
  try {
    const source = sharp(bytes).rotate()
    large = await source.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
    small = await source.clone().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer({ resolveWithObject: true })
  } catch {
    throw new Problem(400, 'Couldn’t read that photo. Try another one.')
  }
  const image = await storeMedia(db, { bytes: large.data, width: large.info.width, height: large.info.height })
  const thumb = await storeMedia(db, { bytes: small.data, width: small.info.width, height: small.info.height })
  const row = await db.one(
    `INSERT INTO photos (image, thumb, width, height, caption) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [image, thumb, large.info.width, large.info.height, caption],
  )
  return { id: row.id, image, thumb }
}

export async function removePhoto(db, id) {
  await db.query('UPDATE photos SET removed_at = now() WHERE id = $1', [Number(id) || 0])
}

export const PHOTOS_QUERY = `SELECT id, image, thumb, width AS w, height AS h, caption FROM photos
  WHERE removed_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 12`
