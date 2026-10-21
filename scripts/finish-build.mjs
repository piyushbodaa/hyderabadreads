// After `vite build`: the built index.html becomes the server's page template
// (the home page, books and shelves are rendered by api/page.js), and the
// built 404.html is kept for it too. dist/index.html has to go, or Vercel would
// serve it as a static file instead of calling the function.
import { copyFile, mkdir, rename } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const out = new URL('../server/generated/', import.meta.url)

await mkdir(out, { recursive: true })
await rename(new URL('index.html', dist), new URL('index.html', out))
await copyFile(new URL('404.html', dist), new URL('404.html', out))
console.log('[build] page templates written to server/generated/')
