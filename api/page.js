// The home page, /book/:slug and /shelf/:slug (see the rewrites in vercel.json).
import { readFileSync } from 'node:fs'
import { database } from '../server/neon.js'
import { pageResponse, guard } from '../server/handlers.js'

// Written by scripts/finish-build.mjs from Vite's build of index.html and 404.html.
const template = readFileSync(new URL('../server/generated/index.html', import.meta.url), 'utf8')
const notFound = readFileSync(new URL('../server/generated/404.html', import.meta.url), 'utf8')
const handle = guard(pageResponse)

export default {
  fetch: (request) => handle(request, { get db() { return database() }, template, notFound }),
}
