import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/fraunces/opsz-italic.css'
import '@fontsource-variable/inter'
import './styles.css'
import './lib/pwa.js'

import { books, readerList, meetups, photos, wishes, club, hash, random, readPageData, loadLibrary } from './lib/model.js'
import { Bookcase } from './lib/bookcase.js'
import { Viewer } from './lib/viewer.js'
import { startDust } from './lib/dust.js'
import { escape } from './lib/render.js'
import { looksSignedIn, copyText } from './lib/api.js'
import { session, loadSession, onSession, nextMeetup, meetupPhrase } from './lib/session.js'
import { mapsLink, googleEventLink, icsLink, subscribeLinks } from './lib/calendar-links.js'
import { track } from './lib/track.js'
import { faq } from './lib/faq.js'

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
// The toggles: `available` hides books that are out on loan (and samples),
// `weekend` keeps books short enough to finish in a weekend, `fresh` the
// books added this week.
const state = { q: '', facet: null, available: false, weekend: false, fresh: false }
// Shelves or covers: which way the books are shown (remembered per device).
const display = { view: 'shelf' }

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
    // A member's own shelf, empty: say so, and how to fill it.
    const emptyMember = !shown && bookcase.arrange === 'reader' && state.facet && !state.q ? readerList.find((r) => r.name === state.facet.key && !r.books.length) : null
    countEl.textContent = emptyMember
      ? `Nothing on ${emptyMember.name}’s shelf yet`
      : shown === total
        ? `${total} books from ${readerList.length} readers`
        : `Showing ${shown} of ${total}${state.available ? ' available now' : ''}${state.weekend ? ', short enough for a weekend' : ''}${state.fresh ? ', new this week' : ''}${state.q ? ` for “${state.q}”` : ''}${state.facet ? ` ${FACETS[bookcase.arrange].phrase(state.facet.key)}` : ''}`
    emptyEl.hidden = shown > 0
    if (!shown) {
      emptyEl.innerHTML = emptyMember
        ? `<span><strong>${escape(emptyMember.name)}’s shelf is empty for now.</strong><br />${escape(emptyMember.name)}, send a photo of your books to Piyush and they’ll be up here.</span>`
        : `Nobody has listed <strong>${escape(state.q || 'that')}</strong> yet. Ask in the group: someone might have it.`
    }
    if (display.view === 'covers') renderCovers()
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
  const counts = Object.fromEntries(Object.entries(TOGGLES).map(([k, t]) => [k, books.filter(t.test).length]))
  chips.innerHTML = [
    ...Object.entries(TOGGLES)
      .filter(([k]) => counts[k] || state[k])
      .map(([k, t]) => `<button type="button" class="chip chip--toggle" aria-pressed="${state[k]}" data-toggle="${k}">${t.label} <span>${counts[k]}</span></button>`),
    `<button type="button" class="chip" aria-pressed="${!state.facet}" data-key="">All <span>${books.length}</span></button>`,
    ...facetGroups.map(
      (g) =>
        `<button type="button" class="chip" aria-pressed="${state.facet?.key === g.key}" data-key="${escape(g.key)}" style="--dot:${g.colour}"><i></i>${escape(g.key)} <span>${g.books.length}</span></button>`,
    ),
  ].join('')
  chips.scrollLeft = 0
}
// Toggle chips, before the shelf chips. A toggle with no books to show is hidden.
const WEEK_AGO = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
const TOGGLES = {
  available: { label: 'Available now', test: (b) => !b.onLoan && !b.sample },
  weekend: { label: 'Finish it this weekend', test: (b) => b.pages && b.pages <= 250 && !b.sample },
  fresh: { label: 'New this week', test: (b) => !b.sample && b.added >= WEEK_AGO },
}
function currentFilter() {
  const terms = fold(state.q).split(/\s+/).filter(Boolean)
  return (b) =>
    Object.entries(TOGGLES).every(([k, t]) => !state[k] || t.test(b)) &&
    (!state.facet || state.facet.ids.has(b.id)) &&
    terms.every((t) => haystacks.get(b).includes(t))
}
function selectFacet(key) {
  const group = key ? facetGroups.find((g) => g.key === key) : null
  state.facet = group ? { key: group.key, ids: new Set(group.books.map((b) => b.id)) } : null
  chips.querySelectorAll('.chip[data-key]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.key === (state.facet?.key ?? ''))))
  applyFilter()
}
chips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip')
  if (!chip) return
  if (chip.matches('[data-toggle]')) {
    const key = chip.dataset.toggle
    state[key] = !state[key]
    chip.setAttribute('aria-pressed', String(state[key]))
    return applyFilter()
  }
  selectFacet(chip.dataset.key === state.facet?.key ? '' : chip.dataset.key)
})
renderChips()

// Covers: the same books, groups and filters as the shelves, as a grid of
// covers. Spines are the signature, but on a phone their titles are tiny, and
// covers are easier to browse.
const viewSwitch = $('[data-view]')
const coversEl = $('[data-covers]')
const frame = $('.bookcase-frame')
function renderCovers() {
  const byMember = bookcase.arrange === 'reader'
  const groups = bookcase.groups()
  // Members with no books yet, together at the end: each name opens their shelf.
  const waiting = groups.filter((g) => g.empty)
  const waitingHTML = waiting.length
    ? `<section class="covers__group covers__waiting"><h3 class="covers__head">Empty shelves, waiting for books</h3>
        <p>${waiting.map((g) => `<a href="/shelf/${escape(g.slug)}" style="--dot:${g.colour}"><i></i>${escape(g.label)}</a>`).join('')}</p></section>`
    : ''
  // With nothing to show, the shelves' message (which sits on the shelves) comes here too.
  if (!groups.length) return void (coversEl.innerHTML = `<p class="covers__none">${emptyEl.innerHTML}</p>`)
  coversEl.innerHTML = groups
    .filter((g) => !g.empty)
    .map(
      (g) => `
      <section class="covers__group">
        <h3 class="covers__head"><i style="--dot:${g.colour}"></i>${escape(g.label)}${g.sample ? '<span>Sample</span>' : ''}</h3>
        <div class="covers__grid">${g.books.map((b) => coverCard(b, byMember, g.sample)).join('')}</div>
      </section>`,
    )
    .join('') + waitingHTML
  emptyEl.hidden = bookcase.order.length > 0
}
// Under each cover: the writer when the heading already names the member,
// otherwise whose shelf it's on. "Sample" goes on the heading when the whole
// shelf is one.
function coverCard(b, byMember, sampleShelf) {
  const art = b.cover
    ? `<img src="${escape(b.cover)}" alt="" loading="lazy" decoding="async" width="180" height="${Math.round(180 / b.aspect)}" />`
    : `<span class="covers__cloth" style="--base:${b.base};--ink:${b.ink}">${escape(b.title)}</span>`
  const label = `${b.title} by ${b.author}, ${b.sample ? `a sample book on ${b.owner}’s shelf` : `from ${b.owner}’s shelf`}${b.onLoan ? ', on loan' : ''}`
  return `<button type="button" class="covers__item${b.sample ? ' is-sample' : ''}" data-id="${escape(b.id)}" aria-label="${escape(label)}">
      <span class="covers__art">${art}${b.onLoan ? '<span class="covers__loan">On loan</span>' : ''}</span>
      <span class="covers__title">${escape(b.title)}</span>
      <span class="covers__meta">${escape(byMember ? b.author : b.owner)}${b.sample && !sampleShelf ? ' · sample' : ''}</span>
    </button>`
}
function setView(next) {
  display.view = next
  try {
    localStorage.setItem('hr-view', next)
  } catch {
    // Private browsing: the choice just isn't remembered.
  }
  viewSwitch.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === next)))
  frame.hidden = next === 'covers'
  coversEl.hidden = next !== 'covers'
  if (next === 'covers') renderCovers()
  else bookcase.enter()
}
viewSwitch.addEventListener('click', (e) => {
  const b = e.target.closest('button')
  if (b && b.dataset.value !== display.view) setView(b.dataset.value)
})
viewSwitch.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return
  const other = viewSwitch.querySelector(`button:not([data-value="${display.view}"])`)
  other.click()
  other.focus()
})
// A cover that can't load (offline, and never seen before) shows the title on
// cloth, like the books without a cover.
coversEl.addEventListener(
  'error',
  (e) => {
    if (e.target.tagName !== 'IMG') return
    const b = books.find((x) => x.id === e.target.closest('[data-id]')?.dataset.id)
    if (!b) return
    const cloth = Object.assign(document.createElement('span'), { className: 'covers__cloth', textContent: b.title })
    cloth.style.cssText = `--base:${b.base};--ink:${b.ink}`
    e.target.replaceWith(cloth)
  },
  true,
)
coversEl.addEventListener('click', (e) => {
  const item = e.target.closest('[data-id]')
  if (item) viewer.open(books.find((b) => b.id === item.dataset.id), null)
})
try {
  if (localStorage.getItem('hr-view') === 'covers') setView('covers')
} catch {
  // As above.
}

// Everything above is what the first screen and the shelves need. The rest of
// the page (readers, calendar, newcomers, wanted) is drawn after a breath, so
// the browser can paint and respond in between instead of one long task.
await new Promise((resolve) => setTimeout(resolve, 0))

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
      : 'Shelf empty for now'
    return `
      <li>
        <button type="button" class="reader${sample ? ' is-sample' : ''}${r.books.length ? '' : ' is-empty'}" data-reader="${escape(r.name)}" style="--hue:${r.hue}">
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

// Meetups: a card for the next one, the month it falls in as a calendar on
// bigger screens, and a list of upcoming dates on phones.
function renderMeetups() {
  const pad = (n) => String(n).padStart(2, '0')
  const now = new Date()
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const dateOf = (iso) => new Date(`${iso}T00:00`)
  const all = [...meetups].sort((a, b) => a.date.localeCompare(b.date))
  if (!all.length) return ''
  const next = all.find((m) => m.date >= today && !m.cancelled)
  const maps = mapsLink
  const subscribe = subscribeLinks()

  const card = next
    ? `<article class="next-meetup">
        <p class="next-meetup__eyebrow">${next.date === today ? 'Today' : 'Next meetup'}</p>
        <h3 class="next-meetup__date">${dateOf(next.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
        <p class="next-meetup__venue">${escape(next.venue)}${next.area ? ` <span>· ${escape(next.area)}</span>` : ''}</p>
        <p class="next-meetup__time">${escape(next.time)}</p>
        ${next.note ? `<p class="next-meetup__note">${escape(next.note)}</p>` : ''}
        <a class="btn btn--primary" href="${maps(next)}" target="_blank" rel="noopener">Open in Maps</a>
        <p class="next-meetup__add">
          Add to <a href="${googleEventLink(next)}" target="_blank" rel="noopener" data-calendar-add>Google Calendar</a>
          or <a href="${icsLink(next)}" data-calendar-add>Apple / Outlook</a>
        </p>
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

  // Phones get the coming dates as a list, across months, without the past.
  const upcoming = all.filter((m) => m.date >= today).slice(0, 8)
  const list = upcoming
    .map(
      (m) => `
      <li class="cal__item${m.cancelled ? ' is-cancelled' : ''}${m.date === next?.date ? ' is-next' : ''}">
        <span class="cal__item-date">${dateOf(m.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        <span class="cal__item-body">
          ${m.cancelled ? `<s>${escape(m.venue)}</s> <span class="cal__time">Cancelled</span>` : `<a class="cal__venue" href="${maps(m)}" target="_blank" rel="noopener">${escape(m.venue)}</a>`}
          <span class="cal__area">${escape([m.area, m.cancelled ? '' : m.time].filter(Boolean).join(' · '))}</span>
        </span>
      </li>`,
    )
    .join('')

  return `${card}
    <div class="cal">
      <h3 class="cal__month">${dateOf(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
      <div class="cal__grid">${weekdays.join('')}${cells.join('')}</div>
      <h3 class="cal__soon">Coming up</h3>
      <ol class="cal__list">${list || '<li class="cal__item">More dates soon, on Instagram first.</li>'}</ol>
      <p class="cal__subscribe">
        Every meetup in your calendar, kept up to date:
        <a href="${subscribe.google}" target="_blank" rel="noopener" data-calendar-add>Google Calendar</a> ·
        <a href="${subscribe.webcal}" data-calendar-add>Apple / Outlook</a>
      </p>
    </div>`
}
const meetupsHTML = renderMeetups()
if (meetupsHTML) $('[data-meetups]').innerHTML = meetupsHTML
else $('#calendar').hidden = true
document.addEventListener('click', (e) => e.target.closest('[data-calendar-add]') && track('calendar_add'))

// The hero's meetup line comes from the server; members don't need "New here?".
if (looksSignedIn()) $('[data-newcomer]')?.remove()

// For newcomers: what a meetup is like, the next one, photos, and questions.
{
  const next = nextMeetup()
  const fee = club.fee?.trim()
  const upcoming = meetups.filter((m) => m.date >= new Date().toISOString().slice(0, 10))
  const step = (n, title, text) => `<li><span class="steps__n">${n}</span><div><strong>${title}</strong> ${text}</div></li>`
  $('[data-first]').innerHTML = `
    <ol class="steps first__steps">
      ${step(1, 'Bring any book.', 'Whatever you’re reading, in any language.')}
      ${step(2, 'Read, then chat.', 'Everyone reads quietly for a while, then the group talks about what they’re reading.')}
      ${step(3, 'Just show up.', `No sign-up needed. There’s a small fee to attend${fee ? `: ${escape(fee)}` : ''}.`)}
    </ol>
    ${
      next
        ? `<p class="first__next">The next one is <strong>${new Date(`${next.date}T00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>,
           ${escape(next.time)} at ${escape(next.venue)}${next.area ? `, ${escape(next.area)}` : ''}.
           <a href="${mapsLink(next)}" target="_blank" rel="noopener">Directions</a> · <a href="#calendar">All dates</a></p>`
        : `<p class="first__next">New dates go up on <a href="${INSTAGRAM}" target="_blank" rel="noopener">Instagram</a> first.</p>`
    }
    ${
      photos.length
        ? `<div class="first__photos" aria-label="Photos from meetups">${photos
            .map(
              (p, i) => `<button type="button" class="first__photo" data-photo-index="${i}" aria-label="${escape(p.caption || 'A photo from a meetup')}">
                <img src="${escape(p.thumb)}" alt="" loading="lazy" decoding="async" width="${Math.round((p.w * 200) / p.h)}" height="200" />
              </button>`,
            )
            .join('')}</div>`
        : ''
    }
    <div class="faq">
      <h3 class="faq__title">Questions people ask</h3>
      ${faq({ club, meetups: upcoming })
        .map(({ q, a }) => `<details class="faq__item"><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`)
        .join('')}
    </div>`

  const dialog = $('[data-photo]')
  $('[data-first]').addEventListener('click', (e) => {
    const button = e.target.closest('[data-photo-index]')
    if (!button) return
    const p = photos[Number(button.dataset.photoIndex)]
    $('[data-photo-img]').src = p.image
    $('[data-photo-img]').alt = p.caption || 'A photo from a meetup'
    $('[data-photo-caption]').textContent = p.caption
    dialog.showModal()
  })
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-photo-close]')) dialog.close()
  })
}

// The Wanted shelf: books members are looking for, as empty outlines. If
// someone already has one, it says so; members can say "I have it".
function renderWanted() {
  const box = $('[data-wanted]')
  if (!wishes.length) return (box.hidden = true)
  const norm = (t) => fold(t).replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, '')
  const shelved = new Map(books.filter((b) => !b.sample).map((b) => [norm(b.title), b]))
  const me = session.member?.name
  box.hidden = false
  box.innerHTML = `
    <div class="wanted__head">
      <h3 class="wanted__title">Wanted</h3>
      <p class="wanted__sub">Books members are looking for. Have one? Say so.</p>
    </div>
    <ul class="wanted__list">${wishes
      .map((w, i) => {
        const match = shelved.get(norm(w.title))
        const mine = me && w.wisher === me
        const action = match
          ? `<a class="wanted__match" href="/book/${escape(match.id)}">${escape(match.owner)} has it</a>`
          : mine
            ? '<a class="wanted__match" href="/me">Yours · on My shelf</a>'
            : `<button type="button" class="linkish" data-have="${i}">I have it</button>`
        return `<li class="wanted__item">
          <span class="wanted__cover">${w.coverId ? `<img src="/api/olcover?id=${w.coverId}" alt="" loading="lazy" decoding="async" />` : `<span>${escape(w.title)}</span>`}</span>
          <span class="wanted__text"><strong>${escape(w.title)}</strong>${w.author ? `<span>${escape(w.author)}</span>` : ''}<em>${escape(w.wisher)} is looking</em>${action}</span>
        </li>`
      })
      .join('')}</ul>`
}
// A cover Open Library doesn't have falls back to the title, like the others.
$('[data-wanted]').addEventListener(
  'error',
  (e) => {
    if (e.target.tagName !== 'IMG') return
    const title = e.target.closest('.wanted__item')?.querySelector('strong')?.textContent ?? ''
    e.target.replaceWith(Object.assign(document.createElement('span'), { textContent: title }))
  },
  true,
)
$('[data-wanted]').addEventListener('click', async (e) => {
  const button = e.target.closest('[data-have]')
  if (!button) return
  const w = wishes[Number(button.dataset.have)]
  const text = `Hi ${w.wisher}! I have “${w.title}”. Want me to bring it to ${meetupPhrase(nextMeetup())}? 📚`
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      return await navigator.share({ text })
    } catch (err) {
      if (err.name === 'AbortError') return
    }
  }
  toast((await copyText(text)) ? `Message to ${w.wisher} copied. Paste it in the club group.` : text)
})
renderWanted()

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
// Only drawn where they're shown (wide screens), so phones don't download them.
const wideHero = matchMedia('(min-width: 1081px)')
function drawHeroBooks() {
  if (!wideHero.matches || heroBooks.childElementCount) return
  const rand = random(hash(new Date().toISOString().slice(0, 10)))
  // Real books first; placeholders only fill in while shelves are still samples.
  const real = books.filter((b) => b.cover && !b.sample)
  const pool = (real.length >= HERO_SLOTS.length ? real : books.filter((b) => b.cover)).sort(() => rand() - 0.5)
  // One book per member first, for variety; then more from the same shelves,
  // so every slot has a book even while only a few members have added theirs.
  const picks = []
  for (const b of pool) if (picks.length < HERO_SLOTS.length && !picks.some((p) => p.owner === b.owner)) picks.push(b)
  for (const b of pool) if (picks.length < HERO_SLOTS.length && !picks.includes(b)) picks.push(b)
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
drawHeroBooks()
wideHero.addEventListener('change', drawHeroBooks)

// The numbers are in the page already; they count up from zero once, in
// space held for the final figure, so nothing around them moves.
if (!reduceMotion.matches) {
  const cells = [...document.querySelectorAll('[data-stats] dd')]
  const start = performance.now() + 250
  const run = (now) => {
    const t = Math.min(1, Math.max(0, (now - start) / 1400))
    const ease = 1 - (1 - t) ** 3
    for (const dd of cells) dd.textContent = Math.round(dd.dataset.to * ease).toLocaleString('en-IN')
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

// The dust is decoration, so it waits until the page has settled, and stays
// off on small or low-powered phones and when data saver is on.
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 1500))
if (matchMedia('(min-width: 700px)').matches && (navigator.hardwareConcurrency ?? 8) > 4 && !navigator.connection?.saveData) {
  idle(() => startDust($('[data-dust]')))
}

// A member's shelf (/shelf/piyush) opens on the library, showing just their books.
const shelfSlug = location.pathname.match(/^\/shelf\/([^/]+)\/?$/)?.[1]
const shelfOwner = shelfSlug && readerList.find((r) => r.slug === shelfSlug)
if (shelfOwner) {
  selectFacet(shelfOwner.name)
  requestAnimationFrame(() => $('#library').scrollIntoView({ behavior: 'auto' }))
}

// The QR code on a bookplate opens /book/<id>?got=1: someone has the book in
// their hands at a meetup, so "I've got it" comes first.
const params = new URLSearchParams(location.search)
if (params.has('got')) {
  viewer.gotMode = true
  params.delete('got')
  history.replaceState(history.state, '', location.pathname + (params.size ? `?${params}` : ''))
}
viewer.syncToUrl()

// Signed-in members see who has which book, and can ask, lend and return.
onSession(() => {
  bookcase.refresh()
  renderChips()
  applyFilter()
  viewer.refresh()
  renderWanted()
})
loadSession()

// Offline, the service worker shows the shelves as they were last seen; say so.
if (!navigator.onLine) toast('You’re offline: these are the shelves as they were the last time you looked.')
