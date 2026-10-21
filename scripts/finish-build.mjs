// After `vite build`: the built index.html becomes the server's page template
// (the home page, books and shelves are rendered by api/page.js), and the
// built 404.html is kept for it too. dist/index.html has to go, or Vercel would
// serve it as a static file instead of calling the function.
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const out = new URL('../server/generated/', import.meta.url)

await mkdir(out, { recursive: true })

// The three fonts the first screen needs are preloaded, so they download with
// the stylesheet instead of after it.
const assets = await readdir(new URL('assets/', dist))
const critical = ['fraunces-latin-opsz-normal-', 'fraunces-latin-opsz-italic-', 'inter-latin-wght-normal-']
  .map((prefix) => assets.find((f) => f.startsWith(prefix) && f.endsWith('.woff2')))
  .filter(Boolean)
const preloads = critical.map((f) => `<link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin />`).join('\n    ')
const html = await readFile(new URL('index.html', dist), 'utf8')
// Before the meta block, which the server swaps out for each page.
if (!html.includes('<!--hr:meta-->')) throw new Error('[build] index.html has no <!--hr:meta--> marker')
await writeFile(new URL('index.html', out), html.replace('<!--hr:meta-->', `${preloads}\n    <!--hr:meta-->`))
await rm(new URL('index.html', dist))
await copyFile(new URL('404.html', dist), new URL('404.html', out))
console.log('[build] page templates written to server/generated/')
