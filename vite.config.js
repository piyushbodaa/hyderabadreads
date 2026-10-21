import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const page = (file) => fileURLToPath(new URL(file, import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      // Vercel serves dist/404.html for any address that doesn't exist.
      input: { main: page('index.html'), notFound: page('404.html') },
    },
  },
})
