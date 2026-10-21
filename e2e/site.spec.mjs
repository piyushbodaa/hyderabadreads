// The site as visitors and members use it. Expected numbers come from the
// page's own data, so the checks hold whatever the starting shelves hold.
import { expect, test } from '@playwright/test'

const pageData = (page) => page.evaluate(() => JSON.parse(document.getElementById('hr-data').textContent))

test('the shelves show every book, and search narrows them down', async ({ page }) => {
  await page.goto('/')
  const data = await pageData(page)
  await expect(page.locator('[data-bookcase] .book')).toHaveCount(data.books.length)
  await expect(page.locator('[data-result-count]')).toHaveText(`${data.books.length} books from ${data.members.length} readers`)

  await page.locator('[data-search]').fill('dune')
  await expect(page.locator('[data-result-count]')).toContainText(`Showing 1 of ${data.books.length}`)
  await expect(page.locator('[data-bookcase] .book:not(.is-hidden)')).toHaveCount(1)
})

test('a book has its own address, title and page', async ({ page }) => {
  await page.goto('/book/dune-herbert')
  await expect(page).toHaveTitle(/^Dune by Frank Herbert · /)
  await expect(page.locator('[data-viewer]')).toHaveClass(/is-open/)
  await expect(page.locator('[data-info]')).toContainText('Frank Herbert')
})

test('a member’s shelf shows just their books', async ({ page }) => {
  await page.goto('/shelf/piyush')
  const data = await pageData(page)
  const mine = data.books.filter((b) => b.owner === 'Piyush').length
  await expect(page.locator('[data-result-count]')).toContainText(`Showing ${mine} of ${data.books.length}`)
  await expect(page.locator('[data-bookcase] .book:not(.is-hidden)')).toHaveCount(mine)
})

test('an address that isn’t a book is a 404', async ({ page }) => {
  const response = await page.goto('/book/no-such-book')
  expect(response.status()).toBe(404)
  await expect(page).toHaveTitle(/Not on our shelves/)
})

test('the covers view shows the same books, and is remembered', async ({ page }) => {
  await page.goto('/')
  const data = await pageData(page)
  await page.locator('[data-view] button[data-value="covers"]').click()
  await expect(page.locator('.covers__item')).toHaveCount(data.books.length)
  await page.reload()
  await expect(page.locator('.covers__item')).toHaveCount(data.books.length)
  await expect(page.locator('.bookcase-frame')).toBeHidden()
})

test('nothing makes the page scroll sideways', async ({ page }) => {
  await page.goto('/')
  await page.locator('#library').scrollIntoViewIfNeeded()
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }))
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
})

test('a member signs in with their link and lands on their shelf', async ({ page, request }, testInfo) => {
  // A new link cancels the member's last one, so each size signs in as
  // someone different.
  const name = testInfo.project.name === 'phone' ? 'Piyush' : 'Rama'
  // Local only: the dev server prints a sign-in link for any member.
  const link = (await (await request.get(`/__dev/invite?name=${name}`)).text()).trim()
  expect(link).toMatch(/\/join\/[\w-]+$/)
  await page.goto(new URL(link).pathname)
  await expect(page).toHaveURL(/\/me/)
  await expect(page.locator('h1')).toHaveText(new RegExp(`(Welcome|Hi), ${name}`))
})
