import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/fraunces/opsz-italic.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/cormorant-garamond'
import '@fontsource/bebas-neue'
import './styles.css'

import { books, readerList, stats, meetups, club, hash, random, readPageData, loadLibrary } from './lib/model.js'
import { Bookcase } from './lib/bookcase.js'
import { Viewer } from './lib/viewer.js'
import { startDust } from './lib/dust.js'
import { escape } from './lib/render.js'
import { looksSignedIn } from './lib/api.js'

// Signed-in members get straight to their own shelf from the header.
if (looksSignedIn()) {
  const mine = document.querySelector('[data-mine]')
  mine.href = '/me'
  mine.textContent = 'My shelf'
}

// The server writes the whole library into the page; everything below draws it.
loadLibrary(readPageData())
const INSTAGRAM = club.instagram || 'https://www.instagram.com/hyderabadreads'

const $ = (sel) => document.querySelector(sel)
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
// `facet` is the chip picked under the search box: one shelf of the current
// arrangement (a member, genre, language or writer letter), or null for all.
const state = { q: '', facet: null }

// Toast
const toastEl = $('[data-toast]')
let toastTimer
function toast(message) {
  toastEl.textContent = message
  toastEl.classList.add('is-on')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3200)
}

// Bookcase and viewer
const countEl = $('[data-result-count]')
const emptyEl = $('[data-empty]')
const bookcase = new Bookcase($('[data-bookcase]'), {
  tip: $('[data-tip]'),
  onOpen: (book, spine) => viewer.open(book, spine),
  onLayout: (shown) => {
    const total = books.length
    countEl.textContent =
      shown === total
        ? `${total} books from ${readerList.length} readers`
        : `Showing ${shown} of ${total}${state.q ? ` for “${state.q}”` : ''}${state.facet ? ` ${FACETS[bookcase.arrange].phrase(state.facet.key)}` : ''}`
    emptyEl.hidden = shown > 0
    if (!shown) emptyEl.innerHTML = `Nobody has listed <strong>${escape(state.q || 'that')}</strong> yet. Ask in the group: someone might have it.`
  },
})
const viewer = new Viewer($('[data-viewer]'), { bookcase, toast })

new IntersectionObserver(
  ([entry], obs) => {
    if (!entry.isIntersecting) return
    bookcase.enter()
    obs.disconnect()
  },
  // As soon as the top shelf is comfortably on screen, however tall the case.
  { rootMargin: '0px 0px -140px 0px' },
).observe($('[data-bookcase]'))

// Search
const fold = (text) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
const haystacks = new Map(books.map((b) => [b, fold([b.title, b.author, b.owner, b.genre, b.language, b.year].join(' '))]))
function applyFilter() {
  bookcase.setFilter(currentFilter())
}

const search = $('[data-search]')
let searchTimer
search.addEventListener('input', () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    state.q = search.value.trim()
    applyFilter()
  }, 110)
})
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !viewer.isOpen && !/input|textarea/i.test(document.activeElement.tagName)) {
    e.preventDefault()
    search.focus()
    search.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' })
  }
  if (e.key === 'Escape' && document.activeElement === search) {
    search.value = ''
    state.q = ''
    applyFilter()
  }
})

// Arrange by
const segmented = $('[data-arrange]')
const pill = segmented.querySelector('.segmented__pill')
function placePill() {
  const active = segmented.querySelector('[aria-checked="true"]')
  pill.style.width = `${active.offsetWidth}px`
  pill.style.transform = `translateX(${active.offsetLeft}px)`
}
function setArrange(mode) {
  segmented.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === mode)))
  placePill()
  // A chip from the old arrangement means nothing in the new one.
  state.facet = null
  bookcase.setFilter(currentFilter())
  bookcase.setArrange(mode)
  renderChips()
}
segmented.addEventListener('click', (e) => {
  const btn = e.target.closest('button')
  if (btn && btn.dataset.value !== bookcase.arrange) setArrange(btn.dataset.value)
})
segmented.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return
  const buttons = [...segmented.querySelectorAll('button')]
  const i = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true')
  const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]
  next.click()
  next.focus()
})
new ResizeObserver(placePill).observe(segmented)
document.fonts.ready.then(placePill)

// Chips: one per shelf of the current arrangement, so they follow the
// Member / Genre / Language / Writer switch.
const FACETS = {
  reader: { noun: 'member', phrase: (k) => `from ${k}’s shelf` },
  genre: { noun: 'genre', phrase: (k) => `in ${k}` },
  language: { noun: 'language', phrase: (k) => `in ${k}` },
  writer: { noun: 'writer', phrase: (k) => `by writers under ${k}` },
}
const chips = $('[data-chips]')
let facetGroups = []
function renderChips() {
  facetGroups = bookcase.groups(bookcase.arrange, books)
  chips.setAttribute('aria-label', `Show books by ${FACETS[bookcase.arrange].noun}`)
  chips.innerHTML = [
    `<button type="button" class="chip" aria-pressed="${!state.facet}" data-key="">All <span>${books.length}</span></button>`,
    ...facetGroups.map(
      (g) =>
        `<button type="button" class="chip" aria-pressed="${state.facet?.key === g.key}" data-key="${escape(g.key)}" style="--dot:${g.colour}"><i></i>${escape(g.key)} <span>${g.books.length}</span></button>`,
    ),
  ].join('')
  chips.scrollLeft = 0
}
function currentFilter() {
  const terms = fold(state.q).split(/\s+/).filter(Boolean)
  return (b) => (!state.facet || state.facet.ids.has(b.id)) && terms.every((t) => haystacks.get(b).includes(t))
}
function selectFacet(key) {
  const group = key ? facetGroups.find((g) => g.key === key) : null
  state.facet = group ? { key: group.key, ids: new Set(group.books.map((b) => b.id)) } : null
  chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.key === (state.facet?.key ?? ''))))
  applyFilter()
}
chips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip')
  if (chip) selectFacet(chip.dataset.key === state.facet?.key ? '' : chip.dataset.key)
})
renderChips()

// Readers section
$('[data-readers]').innerHTML = readerList
  .map((r) => {
    const genres = [...new Set(r.books.map((b) => b.genre))]
    const sample = r.books.length > 0 && r.books.every((b) => b.sample)
    const shelf = r.books
      .map((b) => `<i style="--base:${b.base};--accent:${b.accent};height:${(b.h * 0.3).toFixed(1)}px;width:${(b.t * 0.3).toFixed(1)}px"></i>`)
      .join('')
    const count = r.books.length === 1 ? '1 book' : `${r.books.length} books`
    const meta = r.books.length
      ? `${sample ? `${count}, all samples` : count} · ${escape(genres.slice(0, 2).join(', '))}${genres.length > 2 ? ` +${genres.length - 2}` : ''}`
      : 'No books yet'
    return `
      <li>
        <button type="button" class="reader${sample ? ' is-sample' : ''}" data-reader="${escape(r.name)}" style="--hue:${r.hue}"${r.books.length ? '' : ' disabled'}>
          <span class="avatar">${escape(r.name[0])}</span>
          <span class="reader__name">${escape(r.name)}</span>
          <span class="reader__meta">${meta}</span>
          <span class="reader__shelf" aria-hidden="true">${shelf}</span>
        </button>
      </li>`
  })
  .join('')
$('[data-readers]').addEventListener('click', (e) => {
  const card = e.target.closest('.reader')
  if (!card) return
  if (bookcase.arrange !== 'reader') setArrange('reader')
  selectFacet(card.dataset.reader)
  $('#library').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' })
})

// Meetups: a card for the next one, and a calendar of the month it falls in.
function renderMeetups() {
  const pad = (n) => String(n).padStart(2, '0')
  const now = new Date()
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const dateOf = (iso) => new Date(`${iso}T00:00`)
  const all = [...meetups].sort((a, b) => a.date.localeCompare(b.date))
  if (!all.length) return ''
  const next = all.find((m) => m.date >= today && !m.cancelled)
  const maps = (m) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.venue}, ${m.area}, Hyderabad`)}`

  const card = next
    ? `<article class="next-meetup">
        <p class="next-meetup__eyebrow">${next.date === today ? 'Today' : 'Next meetup'}</p>
        <h3 class="next-meetup__date">${dateOf(next.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
        <p class="next-meetup__venue">${escape(next.venue)}${next.area ? ` <span>· ${escape(next.area)}</span>` : ''}</p>
        <p class="next-meetup__time">${escape(next.time)}</p>
        <a class="btn btn--primary" href="${maps(next)}" target="_blank" rel="noopener">Open in Maps</a>
      </article>`
    : `<article class="next-meetup">
        <p class="next-meetup__eyebrow">Next meetup</p>
        <h3 class="next-meetup__date">Dates coming soon</h3>
        <p class="next-meetup__note">The next calendar goes up on Instagram first.</p>
        <a class="btn btn--primary" href="${INSTAGRAM}" target="_blank" rel="noopener">Follow @hyderabadreads</a>
      </article>`

  const month = (next ?? all.at(-1)).date.slice(0, 7)
  const [year, mon] = month.split('-').map(Number)
  const byDate = new Map()
  for (const m of all) byDate.set(m.date, [...(byDate.get(m.date) ?? []), m])
  const lead = new Date(year, mon - 1, 1).getDay()
  const days = new Date(year, mon, 0).getDate()
  const cells = Array.from({ length: lead }, () => '<div class="cal__day is-blank"></div>')
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${pad(d)}`
    const list = byDate.get(iso) ?? []
    const flags = [list.length && 'has-meetup', iso < today && 'is-past', iso === today && 'is-today', iso === next?.date && 'is-next']
    const when = dateOf(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    cells.push(`
      <div class="cal__day ${flags.filter(Boolean).join(' ')}">
        <span class="cal__n">${d}</span>
        ${list.length ? `<span class="cal__when">${when}</span>` : ''}
        ${list
          .map((m) =>
            m.cancelled
              ? `<s class="cal__venue">${escape(m.venue)}</s><span class="cal__time">Cancelled</span>`
              : `<a class="cal__venue" href="${maps(m)}" target="_blank" rel="noopener">${escape(m.venue)}</a><span class="cal__area">${escape(m.area)}</span><span class="cal__time">${escape(m.time)}</span>`,
          )
          .join('')}
      </div>`)
  }
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => `<span class="cal__dow" aria-hidden="true">${w}</span>`)

  return `${card}
    <div class="cal">
      <h3 class="cal__month">${dateOf(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
      <div class="cal__grid">${weekdays.join('')}${cells.join('')}</div>
    </div>`
}
const meetupsHTML = renderMeetups()
if (meetupsHTML) $('[data-meetups]').innerHTML = meetupsHTML
else $('#calendar').hidden = true

// Surprise me: scroll a random book into view, then take it off the shelf.
document.querySelectorAll('[data-surprise]').forEach((btn) =>
  btn.addEventListener('click', async () => {
    // With nothing on the shelves (a search with no hits), any book will do,
    // opened straight up since its spine is hidden.
    if (!bookcase.order.length) return viewer.open(books[Math.floor(Math.random() * books.length)], null)
    const book = bookcase.order[Math.floor(Math.random() * bookcase.order.length)]
    const spine = bookcase.spineOf(book.id)
    const r = spine.getBoundingClientRect()
    if (r.top < 80 || r.bottom > innerHeight - 20) {
      spine.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' })
      await scrollSettled()
    }
    bookcase.enter()
    spine.animate([{ transform: 'none' }, { transform: 'translateY(-16px)' }, { transform: 'none' }], { duration: 420, easing: 'ease-in-out' })
    setTimeout(() => viewer.open(book, spine), reduceMotion.matches ? 0 : 360)
  }),
)

function scrollSettled() {
  return new Promise((resolve) => {
    let last = scrollY
    let still = 0
    const check = () => {
      still = scrollY === last ? still + 1 : 0
      last = scrollY
      if (still > 5) resolve()
      else requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  })
}

// Hero: five covers from five different shelves, a fresh pick every day.
const HERO_SLOTS = [
  { x: 4, y: 20, r: -8, z: 1, depth: 0.6 },
  { x: 30, y: 2, r: 4, z: 3, depth: 1 },
  { x: 58, y: 16, r: 9, z: 2, depth: 0.8 },
  { x: 14, y: 50, r: 5, z: 4, depth: 1.3 },
  { x: 44, y: 44, r: -5, z: 5, depth: 1.6 },
]
const heroBooks = $('[data-hero-books]')
{
  const rand = random(hash(new Date().toISOString().slice(0, 10)))
  // Real books first; placeholders only fill in while shelves are still samples.
  const real = books.filter((b) => b.cover && !b.sample)
  const pool = (real.length >= HERO_SLOTS.length ? real : books.filter((b) => b.cover)).sort(() => rand() - 0.5)
  const picks = []
  for (const b of pool) if (picks.length < HERO_SLOTS.length && !picks.some((p) => p.owner === b.owner)) picks.push(b)
  heroBooks.innerHTML = picks
    .map((b, i) => {
      const s = HERO_SLOTS[i]
      return `<button type="button" class="hero-book" data-id="${b.id}" style="--x:${s.x}%;--y:${s.y}%;--r:${s.r}deg;--z:${s.z};--depth:${s.depth};--i:${i}" aria-label="${escape(`${b.title} by ${b.author}, from ${b.owner}’s shelf`)}">
        <span class="hero-book__float"><img src="${b.cover}" alt="" /></span>
      </button>`
    })
    .join('')
  heroBooks.addEventListener('click', (e) => {
    const id = e.target.closest('.hero-book')?.dataset.id
    if (id) viewer.open(books.find((b) => b.id === id), null)
  })
  if (!reduceMotion.matches) {
    $('.hero').addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return
      heroBooks.style.setProperty('--px', (e.clientX / innerWidth - 0.5).toFixed(3))
      heroBooks.style.setProperty('--py', (e.clientY / innerHeight - 0.5).toFixed(3))
    })
  }
}

// Stats count up when the hero is on screen
const statsEl = $('[data-stats]')
const statItems = [
  ['Books', stats.books],
  ['Readers', stats.readers],
  ['Genres', stats.genres],
  ['Pages to share', stats.pages],
]
statsEl.innerHTML = statItems
  .map(([label, value]) => `<div><dt>${label}</dt><dd data-to="${value}">${reduceMotion.matches ? value.toLocaleString('en-IN') : 0}</dd></div>`)
  .join('')
if (stats.samples) {
  const note = document.createElement('p')
  note.className = 'stats__note'
  note.textContent =
    stats.samples === stats.books
      ? 'Every shelf is a sample for now: placeholder books until members add their own.'
      : `${stats.samples} of these are sample books, standing in until their owners add real ones.`
  statsEl.after(note)
}
if (!reduceMotion.matches) {
  const start = performance.now() + 250
  const run = (now) => {
    const t = Math.min(1, Math.max(0, (now - start) / 1400))
    const ease = 1 - (1 - t) ** 3
    statsEl.querySelectorAll('dd').forEach((dd) => (dd.textContent = Math.round(dd.dataset.to * ease).toLocaleString('en-IN')))
    if (t < 1) requestAnimationFrame(run)
  }
  requestAnimationFrame(run)
}

// Top bar picks up a backdrop once the page scrolls
const topbar = $('[data-topbar]')
const onScroll = () => topbar.classList.toggle('is-scrolled', scrollY > 8)
addEventListener('scroll', onScroll, { passive: true })
onScroll()

// Warm the cover cache for whatever the pointer is heading towards.
const warmed = new Set()
$('[data-bookcase]').addEventListener('pointerover', (e) => {
  const id = e.target.closest('.spine')?.dataset.id
  const book = id && books.find((b) => b.id === id)
  if (book?.cover && !warmed.has(book.cover)) {
    warmed.add(book.cover)
    new Image().src = book.cover
  }
})

startDust($('[data-dust]'))

// A member's shelf (/shelf/piyush) opens on the library, showing just their books.
const shelfSlug = location.pathname.match(/^\/shelf\/([^/]+)\/?$/)?.[1]
const shelfOwner = shelfSlug && readerList.find((r) => r.slug === shelfSlug)
if (shelfOwner) {
  selectFacet(shelfOwner.name)
  requestAnimationFrame(() => $('#library').scrollIntoView({ behavior: 'auto' }))
}
viewer.syncToUrl()
