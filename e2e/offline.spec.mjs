// Offline: after one visit, the shelves and books open with the connection
// gone. This file runs its own server and stops it partway, because Chrome's
// offline switch doesn't reach the service worker's own requests.
import { spawn } from 'node:child_process'
import { expect, test } from '@playwright/test'

const PORT = 4183
const base = `http://127.0.0.1:${PORT}`
let server

test.beforeAll(async () => {
  server = spawn(process.execPath, ['scripts/serve-build.mjs', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] })
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (chunk) => String(chunk).includes('ready on') && resolve())
    server.on('exit', (code) => reject(new Error(`the server stopped (${code})`)))
  })
})

test.afterAll(() => server?.kill())

test('after one visit, the shelves and a book open offline, and other pages say so', async ({ page, context }) => {
  await page.goto(`${base}/`)
  const books = await page.evaluate(() => JSON.parse(document.getElementById('hr-data').textContent).books.length)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }))
  })
  // Time to save what the page loaded before the worker took over.
  await page.waitForTimeout(2000)

  server.kill()
  await context.setOffline(true)

  await page.reload()
  await expect(page.locator('[data-bookcase] .book')).toHaveCount(books)
  await expect(page.locator('[data-toast]')).toContainText('You’re offline')

  await page.goto(`${base}/book/dune-herbert`)
  await expect(page.locator('[data-viewer]')).toHaveClass(/is-open/)
  await expect(page.locator('[data-info]')).toContainText('Frank Herbert')

  await page.goto(`${base}/stats`)
  await expect(page.locator('h1')).toHaveText('You’re offline')
})
