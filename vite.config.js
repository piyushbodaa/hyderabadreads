import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { serverPlugin } from './server/dev.js'

const page = (file) => fileURLToPath(new URL(file, import.meta.url))

export default defineConfig({
  // The home page, books, shelves, feeds and link previews come from the
  // server (api/ on Vercel); locally the same handlers run inside Vite.
  // HR_LOCAL_DB=memory swaps .data/ for a throwaway database (see
  // scripts/serve-build.mjs).
  plugins: [serverPlugin({ memory: process.env.HR_LOCAL_DB === 'memory' })],
  build: {
    rollupOptions: {
      input: {
        main: page('index.html'),
        // Vercel serves dist/404.html for any address that doesn't exist.
        notFound: page('404.html'),
        me: page('me.html'),
        admin: page('admin.html'),
        bookplates: page('bookplates.html'),
        digest: page('digest.html'),
        stats: page('stats.html'),
        year: page('year.html'),
        // Like index.html, a template the server fills in (/blog).
        blog: page('blog.html'),
      },
    },
  },
})
