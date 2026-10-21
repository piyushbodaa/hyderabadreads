import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/fraunces/opsz-italic.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/cormorant-garamond'
import '@fontsource/bebas-neue'
import './styles.css'

import { books, readerList, stats, hash, random } from './lib/model.js'
import { Bookcase } from './lib/bookcase.js'
import { Viewer } from './lib/viewer.js'
import { startDust } from './lib/dust.js'
import { escape } from './lib/render.js'
import { meetups, VENUES, TIME, INSTAGRAM } from './data/meetups.js'

const $ = (sel) => document.querySelector(sel)
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
const state = { q: '', reader: null }

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
        : `Showing ${shown} of ${total}${state.q ? ` for “${state.q}”` : ''}${state.reader ? ` from ${state.reader}` : ''}`
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
  const terms = fold(state.q).split(/\s+/).filter(Boolean)
  bookcase.setFilter((b) => (!state.reader || b.owner === state.reader) && terms.every((t) => haystacks.get(b).includes(t)))
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
segmented.addEventListener('click', (e) => {
  const btn = e.target.closest('button')
  if (!btn) return
  segmented.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b === btn)))
  placePill()
  bookcase.setArrange(btn.dataset.value)
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

// Reader chips
const chips = $('[data-chips]')
chips.innerHTML = [
  `<button type="button" class="chip" aria-pressed="true" data-reader="">All <span>${books.length}</span></button>`,
  ...readerList.map(
    (r) =>
      `<button type="button" class="chip" aria-pressed="false" data-reader="${escape(r.name)}" style="--hue:${r.hue}"><i></i>${escape(r.name)} <span>${r.books.length}</span></button>`,
  ),
].join('')
function selectReader(name) {
  state.reader = name || null
  chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.reader === (name || ''))))
  applyFilter()
}
chips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip')
  if (chip) selectReader(chip.dataset.reader === state.reader ? '' : chip.dataset.reader)
})

// Readers section
$('[data-readers]').innerHTML = readerList
  .map((r) => {
    const genres = [...new Set(r.books.map((b) => b.genre))]
    const shelf = r.books
      .map((b) => `<i style="--base:${b.base};--accent:${b.accent};height:${(b.h * 0.3).toFixed(1)}px;width:${(b.t * 0.3).toFixed(1)}px"></i>`)
      .join('')
    return `
      <li>
        <button type="button" class="reader" data-reader="${escape(r.name)}" style="--hue:${r.hue}">
          <span class="avatar">${escape(r.name[0])}</span>
          <span class="reader__name">${escape(r.name)}</span>
          <span class="reader__meta">${r.books.length} books · ${escape(genres.slice(0, 2).join(', '))}${genres.length > 2 ? ` +${genres.length - 2}` : ''}</span>
          <span class="reader__shelf" aria-hidden="true">${shelf}</span>
        </button>
      </li>`
  })
  .join('')
$('[data-readers]').addEventListener('click', (e) => {
  const card = e.target.closest('.reader')
  if (!card) return
  selectReader(card.dataset.reader)
  $('#library').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' })
})

// Meetups: a card for the next one, and a calendar of the month it falls in.
function renderMeetups() {
  const pad = (n) => String(n).padStart(2, '0')
  const now = new Date()
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const dateOf = (iso) => new Date(`${iso}T00:00`)
  const all = meetups
    .map((m) => ({ ...m, area: VENUES[m.venue]?.area ?? '', time: m.time ?? VENUES[m.venue]?.time ?? TIME }))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (!all.length) return ''
  const next = all.find((m) => m.date >= today)
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
          .map((m) => `<a class="cal__venue" href="${maps(m)}" target="_blank" rel="noopener">${escape(m.venue)}</a><span class="cal__area">${escape(m.area)}</span><span class="cal__time">${escape(m.time)}</span>`)
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
else $('#meetups').hidden = true

// Surprise me: scroll a random book into view, then take it off the shelf.
document.querySelectorAll('[data-surprise]').forEach((btn) =>
  btn.addEventListener('click', async () => {
    const pool = bookcase.order.length ? bookcase.order : books
    const book = pool[Math.floor(Math.random() * pool.length)]
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
  const pool = books.filter((b) => b.cover).sort(() => rand() - 0.5)
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
viewer.syncToHash()
