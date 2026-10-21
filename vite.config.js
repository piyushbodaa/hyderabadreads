import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { serverPlugin } from './server/dev.js'

const page = (file) => fileURLToPath(new URL(file, import.meta.url))

export default defineConfig({
  // The home page, books, shelves, feeds and link previews come from the
  // server (api/ on Vercel); locally the same handlers run inside Vite.
  plugins: [serverPlugin()],
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
      },
    },
  },
})
