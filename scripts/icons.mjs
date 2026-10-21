// Draws the app icons in public/icons/ from the logo, for the web app manifest:
// the rounded-square favicon at 192 and 512px, and a "maskable" one for
// Android, whose launchers crop icons to their own shapes. That one fills the
// square and keeps the mark inside the middle 80%, the part every shape keeps.
//
// Run it again after changing the logo: node scripts/icons.mjs
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const pub = new URL('../public/', import.meta.url)
const out = new URL('icons/', pub)
await mkdir(out, { recursive: true })
const path = (name) => fileURLToPath(new URL(name, out))

// SVGs render at 72dpi per viewBox unit, so the density sets the drawn size.
const favicon = await readFile(new URL('favicon.svg', pub))
for (const size of [192, 512]) {
  await sharp(favicon, { density: (72 * size) / 64 })
    .resize(size, size)
    .png()
    .toFile(path(`icon-${size}.png`))
}

const MARK = 266
const mark = await sharp(await readFile(new URL('logo.svg', pub)), { density: (72 * MARK) / 56 })
  .resize(MARK, MARK)
  .png()
  .toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#1a120b' } })
  .composite([{ input: mark, gravity: 'center' }])
  .png()
  .toFile(path('icon-maskable-512.png'))

console.log('[icons] written to public/icons/')
