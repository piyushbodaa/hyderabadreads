// Serves the production build (dist/) as `vite preview` does, but with a
// fresh database that's gone when it stops. The browser checks and Lighthouse
// use it, so they always see the starting shelves and never touch the
// database in .data/ that `npm run dev` uses.
//
//   npm run build && node scripts/serve-build.mjs [port]
import { preview } from 'vite'

process.env.HR_LOCAL_DB = 'memory'
const port = Number(process.argv[2] ?? 4173)
// 127.0.0.1 rather than "localhost", which can mean IPv6 to one program and
// IPv4 to the next. Browsers treat both as secure, as service workers need.
const origin = `http://127.0.0.1:${port}`
await preview({ preview: { host: '127.0.0.1', port, strictPort: true } })
// The first page load fills the database; it happens here, so nothing that
// measures the page times it.
await fetch(`${origin}/`)
console.log(`[serve-build] ready on ${origin}`)
