// After `vite build`: the built index.html becomes the server's page template
// (the home page, books and shelves are rendered by api/page.js), and the
// built 404.html is kept for it too. dist/index.html has to go, or Vercel would
// serve it as a static file instead of calling the function. Then the service
// worker gets its list of files to save.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
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
const template = html.replace('<!--hr:meta-->', `${preloads}\n    <!--hr:meta-->`)
await writeFile(new URL('index.html', out), template)
await rm(new URL('index.html', dist))
await copyFile(new URL('404.html', dist), new URL('404.html', out))
console.log('[build] page templates written to server/generated/')

// The service worker saves the home page's own files (scripts, styles, fonts,
// the logo) when it installs. Its version follows their contents, so a deploy
// that changes any of them replaces what's saved on visitors' devices.
const shell = [...new Set([...template.matchAll(/(?:src|href)="(\/[^"#?]+\.[a-z0-9]+)"/g)].map((m) => m[1]))]
  .filter((path) => !path.endsWith('.html') && existsSync(new URL(`.${path}`, dist)))
  .sort()
const hash = createHash('sha256')
for (const path of shell) hash.update(path).update(await readFile(new URL(`.${path}`, dist)))
const version = hash.digest('hex').slice(0, 12)
const sw = await readFile(new URL('sw.js', dist), 'utf8')
if (!sw.includes("const VERSION = 'dev'") || !sw.includes('const SHELL = []')) throw new Error('[build] sw.js has no VERSION or SHELL to fill in')
await writeFile(
  new URL('sw.js', dist),
  sw.replace("const VERSION = 'dev'", `const VERSION = '${version}'`).replace('const SHELL = []', `const SHELL = ${JSON.stringify(shell)}`),
)
console.log(`[build] service worker ${version}: ${shell.length} files saved on install`)
