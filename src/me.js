// My shelf: where a signed-in member adds their books (search Open Library,
// scan a barcode, or type it in), edits their notes, tidies the shelf, and
// adds their blog to the club's blog.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/inter'
import './styles.css'
import './lib/pwa.js'

import { api, toaster, copyText, ago } from './lib/api.js'
import { escape } from './lib/render.js'
import { GENRES, LANGUAGES } from './lib/genres.js'
import { canScan, scanIsbn } from './lib/scan.js'

const desk = document.querySelector('[data-desk]')
const toast = toaster(document.querySelector('[data-toast]'))
const params = new URLSearchParams(location.search)
const welcome = params.has('welcome')
const badInvite = params.get('invite') === 'invalid'
if (params.size) history.replaceState(null, '', '/me')

let me = null
let books = []
let lending = null
let wishes = []
let writing = { blogs: [], posts: [] }
let results = []
let searchTimer
let searchSeq = 0

start()

async function start() {
  try {
    const data = await api('/api/me')
    me = data.member
    books = data.books ?? []
    lending = data.lending ?? null
    wishes = data.wishes ?? []
    writing = data.writing ?? writing
  } catch (err) {
    desk.innerHTML = `<div class="desk__head"><p class="kicker">My shelf</p><h1 class="desk__title">Something went wrong</h1>
      <p class="desk__lede">${escape(err.message)}</p></div>`
    return
  }
  if (!me) return signedOut()
  document.querySelector('[data-signout]').hidden = false
  document.querySelector('[data-admin-link]').hidden = !me.isAdmin
  desk.innerHTML = `
    <div class="desk__head">
      <p class="kicker">My shelf</p>
      <h1 class="desk__title">${welcome ? 'Welcome' : 'Hi'}, ${escape(me.name)}</h1>
      <p class="desk__lede">
        Add the books you’re happy to lend or swap. They’re on the shelves within a minute, and anyone in the club can
        ask you to bring one to a meetup.
      </p>
      <p class="desk__links">
        <a href="/shelf/${escape(me.slug)}">See your shelf</a>
        <a href="/bookplates">Print bookplates</a>
        <a href="/digest">This week at the club</a>
        <a href="/year">Your year</a>
        <button type="button" class="linkish" data-copy-shelf>Copy a link to it</button>
      </p>
    </div>
    <div data-samples></div>
    <div data-lending></div>
    <section class="panel" aria-labelledby="add-title">
      <h2 id="add-title" class="panel__title">Add a book</h2>
      <form class="finder" data-search-form role="search">
        <label class="search finder__box">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
          <span class="visually-hidden">Title, author or ISBN</span>
          <input type="search" placeholder="Title, author or ISBN" autocomplete="off" enterkeyhint="search" data-search />
        </label>
        ${canScan() ? `<button type="button" class="btn btn--ghost finder__scan" data-scan>${ICONS.scan} Scan barcode</button>` : ''}
      </form>
      <div class="results" data-results></div>
      <details class="manual" data-manual>
        <summary>Can’t find it? Add it by hand</summary>
        <form class="addform" data-manual-form>
          <div class="addform__row">
            <label class="field"><span>Title</span><input class="input" name="title" required maxlength="200" /></label>
            <label class="field"><span>Author</span><input class="input" name="author" required maxlength="120" /></label>
          </div>
          ${shelvingFields()}
          <button class="btn btn--primary" type="submit">Add to my shelf</button>
        </form>
      </details>
    </section>
    <section class="panel" aria-labelledby="mine-title">
      <h2 id="mine-title" class="panel__title" data-count></h2>
      <ul class="mybooks" data-books></ul>
    </section>
    <section class="panel" aria-labelledby="wanted-title">
      <h2 id="wanted-title" class="panel__title">Looking for</h2>
      <p class="panel__lede">Books you’d like to read. They sit on the Wanted shelf, where anyone who has one can say so. Search above and tap <em>Want</em>.</p>
      <ul class="lends" data-wishes></ul>
    </section>
    <section class="panel" id="writing" aria-labelledby="writing-title">
      <h2 id="writing-title" class="panel__title">Your blog</h2>
      <p class="panel__lede">Write on Substack, Medium, WordPress or a site of your own? Add it here and your posts appear on <a href="/blog">the club’s blog</a>, each linking back to you. New ones show up by themselves within a day.</p>
      <form class="addform addform--row" data-blog-form>
        <label class="field"><span>Your blog’s address <small>any page on it will do</small></span><input class="input" name="url" required maxlength="500" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="yourname.substack.com" /></label>
        <button class="btn btn--primary" type="submit">Add my blog</button>
      </form>
      <div class="blog-list" data-writing></div>
    </section>`
  renderSamples()
  renderLending()
  renderBooks()
  renderWishes()
  renderWriting()
  wire()
  if (welcome) toast(`You’re signed in on this ${matchMedia('(pointer: coarse)').matches ? 'phone' : 'browser'}.`)
  // "Add my blog" on /blog comes here; the section exists only now.
  if (location.hash === '#writing') desk.querySelector('#writing').scrollIntoView()
}

function signedOut() {
  desk.innerHTML = `
    <div class="desk__head">
      <p class="kicker">My shelf</p>
      <h1 class="desk__title">Sign in with your link</h1>
      ${badInvite ? '<p class="notice notice--warn">That sign-in link doesn’t work any more. Making a new link for someone cancels their old one, so ask for a fresh one.</p>' : ''}
      <p class="desk__lede">
        Every member has their own sign-in link, with no password to remember. Ask Piyush for yours on the club
        group, open it on this phone or laptop, and you’ll land back here, ready to add your books.
      </p>
      <p class="desk__links"><a class="btn btn--primary" href="/#library">Browse the library</a></p>
    </div>`
}

function shelvingFields(book = {}) {
  const genres = Object.keys(GENRES)
  const genre = book.genre ?? ''
  const language = book.language ?? 'English'
  return `
    <div class="addform__row">
      <label class="field"><span>Genre</span>
        <select class="input" name="genre">
          <option value="">Choose a genre</option>
          ${[...genres, ...(genre && !genres.includes(genre) ? [genre] : []), 'Other']
            .map((g) => `<option${g === genre ? ' selected' : ''}>${escape(g)}</option>`)
            .join('')}
        </select>
      </label>
      <label class="field"><span>Language</span>
        <select class="input" name="language">
          ${[...LANGUAGES, ...(LANGUAGES.includes(language) ? [] : [language])]
            .map((l) => `<option${l === language ? ' selected' : ''}>${escape(l)}</option>`)
            .join('')}
        </select>
      </label>
    </div>
    <label class="field"><span>Your note <small>optional, shown to everyone</small></span>
      <textarea class="input" name="note" rows="2" maxlength="500" placeholder="“Margins full of scribbles”, “Read it twice”…">${escape(book.note ?? '')}</textarea>
    </label>`
}

function renderSamples() {
  const samples = books.filter((b) => b.sample).length
  desk.querySelector('[data-samples]').innerHTML = samples
    ? `<div class="notice notice--sample">
        <p><strong>${samples === 1 ? 'One book on your shelf is a sample.' : `${samples} books on your shelf are samples.`}</strong>
        We put them up as placeholders while we waited for your list. Are they really yours?</p>
        <div class="notice__actions">
          <button type="button" class="btn btn--primary" data-samples-action="confirm">Yes, keep them</button>
          <button type="button" class="btn btn--ghost" data-samples-action="clear-samples">No, clear them</button>
        </div>
      </div>`
    : ''
}

function renderBooks() {
  desk.querySelector('[data-count]').textContent = books.length ? `Your books (${books.length})` : 'Your books'
  desk.querySelector('[data-books]').innerHTML = books.length
    ? books.map(bookItem).join('')
    : '<li class="mybooks__empty">Nothing here yet. Search above for the first book you’re happy to lend.</li>'
}

function bookItem(b) {
  const cover = b.cover
    ? `<img src="${escape(b.cover)}" alt="" loading="lazy" decoding="async" />`
    : `<span class="mybook__cloth" style="--base:${escape(b.color ?? '#1d2f52')}">${escape(b.title)}</span>`
  return `
    <li class="mybook" data-id="${escape(b.id)}">
      <a class="mybook__cover" href="/book/${escape(b.id)}" aria-hidden="true" tabindex="-1">${cover}</a>
      <div class="mybook__body">
        <p class="mybook__title"><a href="/book/${escape(b.id)}">${escape(b.title)}</a>${b.sample ? ' <span class="tag">Sample</span>' : ''}</p>
        <p class="mybook__author">${escape(b.author)}</p>
        <p class="mybook__meta">${escape(b.genre)} · ${escape(b.language)}</p>
        ${b.note ? `<p class="mybook__note">“${escape(b.note)}”</p>` : ''}
        <div class="mybook__actions">
          <button type="button" class="linkish" data-edit>Edit</button>
          ${b.sample || lending?.lentOut.some((l) => l.bookId === b.id) ? '' : '<button type="button" class="linkish" data-lend-open>Lend to…</button>'}
          <button type="button" class="linkish linkish--danger" data-remove>Remove</button>
        </div>
      </div>
    </li>`
}

function renderResults(message) {
  const box = desk.querySelector('[data-results]')
  if (message) {
    box.innerHTML = `<p class="results__note">${message}</p>`
    return
  }
  box.innerHTML = results
    .map(
      (r, i) => `
      <article class="result" data-result="${i}">
        <span class="result__cover">${r.coverId ? `<img src="/api/olcover?id=${r.coverId}" alt="" loading="lazy" decoding="async" />` : ''}</span>
        <div class="result__body">
          <p class="result__title">${escape(r.title)}</p>
          <p class="result__author">${escape(r.author)}${r.year ? ` · ${r.year}` : ''}</p>
        </div>
        <span class="result__buttons">
          <button type="button" class="btn btn--ghost result__add" data-pick="${i}" title="I have this, add it to my shelf">Add</button>
          <button type="button" class="btn btn--ghost result__add" data-want="${i}" title="I’m looking for this">Want</button>
        </span>
      </article>`,
    )
    .join('')
}

function wire() {
  const input = desk.querySelector('[data-search]')
  input.addEventListener('input', () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => search(input.value), 380)
  })
  desk.querySelector('[data-search-form]').addEventListener('submit', (e) => {
    e.preventDefault()
    clearTimeout(searchTimer)
    search(input.value)
  })

  desk.addEventListener('click', async (e) => {
    const t = e.target.closest('button')
    if (!t) return
    if (t.matches('[data-scan]')) return scan(input)
    if (t.matches('[data-copy-shelf]')) {
      const link = `${location.origin}/shelf/${me.slug}`
      return toast((await copyText(link)) ? 'Link to your shelf copied.' : link)
    }
    if (t.matches('[data-pick]')) return openAddForm(t.closest('[data-result]'), results[Number(t.dataset.pick)])
    if (t.matches('[data-want]')) return want(t, results[Number(t.dataset.want)])
    if (t.matches('[data-unwant]')) return unwant(t)
    if (t.matches('[data-cancel-add]')) return t.closest('.addform').remove()
    if (t.matches('[data-samples-action]')) return samplesAction(t)
    if (t.matches('[data-loan-action]')) return loanAction(t, { action: t.dataset.loanAction, loan: Number(t.dataset.loan) })
    if (t.matches('[data-blog-action]')) return blogButton(t)
    const item = t.closest('[data-id]')
    if (!item) return
    const book = books.find((b) => b.id === item.dataset.id)
    if (t.matches('[data-edit]')) return editForm(item, book)
    if (t.matches('[data-remove]')) return confirmRemove(item, book)
    if (t.matches('[data-lend-open]')) return lendForm(item, book)
    if (t.matches('[data-confirm-remove]')) return removeBook(item, book, t)
    if (t.matches('[data-keep]')) return item.replaceWith(htmlToNode(bookItem(book)))
    if (t.matches('[data-cancel-edit]')) return item.replaceWith(htmlToNode(bookItem(book)))
  })

  desk.addEventListener('submit', async (e) => {
    const form = e.target
    if (form.matches('[data-add-form]')) {
      e.preventDefault()
      const pick = results[Number(form.dataset.addForm)]
      await addBook(form, { ...pick, ...fields(form) })
    } else if (form.matches('[data-manual-form]')) {
      e.preventDefault()
      await addBook(form, fields(form))
    } else if (form.matches('[data-lend-form]')) {
      e.preventDefault()
      const to = new FormData(form).get('to')
      if (to) await loanAction(form.querySelector('[type=submit]'), { action: 'lend', book: form.closest('[data-id]').dataset.id, to })
    } else if (form.matches('[data-edit-form]')) {
      e.preventDefault()
      await saveEdit(form)
    } else if (form.matches('[data-blog-form]')) {
      e.preventDefault()
      await addBlog(form)
    }
  })

  document.querySelector('[data-signout]').addEventListener('click', async () => {
    await api('/api/signout', { method: 'POST', body: {} }).catch(() => {})
    location.href = '/'
  })
}

async function search(text) {
  const q = text.trim()
  const seq = ++searchSeq
  if (q.length < 2) {
    results = []
    return renderResults('')
  }
  renderResults('Looking it up…')
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(q)}`)
    if (seq !== searchSeq) return
    results = data.results
    if (!results.length) return renderResults('No matches on Open Library. Try fewer words, or add it by hand below.')
    renderResults()
  } catch (err) {
    if (seq === searchSeq) renderResults(escape(err.message))
  }
}

async function scan(input) {
  try {
    const isbn = await scanIsbn()
    if (!isbn) return
    input.value = isbn
    await search(isbn)
    const first = desk.querySelector('[data-result="0"]')
    if (first) openAddForm(first, results[0])
  } catch {
    toast('Couldn’t open the camera. Check that the site may use it, or type the ISBN instead.')
  }
}

function openAddForm(card, pick) {
  desk.querySelectorAll('[data-add-form]').forEach((f) => f.remove())
  // Open Library's spellings aren't always how the club would write them
  // ("Rasipuram Krishnaswamy Narayan"), so they can be tidied before adding.
  const form = htmlToNode(`
    <form class="addform addform--inline" data-add-form="${results.indexOf(pick)}">
      <div class="addform__row">
        <label class="field"><span>Title</span><input class="input" name="title" required maxlength="200" value="${escape(pick.title)}" /></label>
        <label class="field"><span>Author</span><input class="input" name="author" required maxlength="120" value="${escape(pick.author)}" /></label>
      </div>
      ${shelvingFields()}
      <div class="addform__buttons">
        <button class="btn btn--primary" type="submit">Add to my shelf</button>
        <button class="btn btn--ghost" type="button" data-cancel-add>Cancel</button>
      </div>
    </form>`)
  card.after(form)
  form.querySelector('select').focus()
}

function fields(form) {
  return Object.fromEntries(new FormData(form))
}

async function addBook(form, payload) {
  const button = form.querySelector('[type=submit]')
  button.disabled = true
  button.textContent = 'Adding…'
  try {
    const { book } = await api('/api/books', { method: 'POST', body: payload })
    books.unshift(book)
    renderBooks()
    renderSamples()
    toast(`${book.title} is on your shelf.`)
    results = []
    renderResults('')
    desk.querySelector('[data-search]').value = ''
    form.reset()
    if (form.matches('[data-add-form]')) form.remove()
    desk.querySelector('[data-manual]').open = false
  } catch (err) {
    toast(err.message)
  } finally {
    button.disabled = false
    button.textContent = 'Add to my shelf'
  }
}

function editForm(item, book) {
  item.replaceWith(
    htmlToNode(`
    <li class="mybook mybook--editing" data-id="${escape(book.id)}">
      <form class="addform" data-edit-form>
        <p class="mybook__title">${escape(book.title)}</p>
        ${shelvingFields(book)}
        <div class="addform__buttons">
          <button class="btn btn--primary" type="submit">Save</button>
          <button class="btn btn--ghost" type="button" data-cancel-edit>Cancel</button>
        </div>
      </form>
    </li>`),
  )
  desk.querySelector(`[data-id="${CSS.escape(book.id)}"] textarea`).focus()
}

async function saveEdit(form) {
  const item = form.closest('[data-id]')
  try {
    const { book } = await api(`/api/books?id=${encodeURIComponent(item.dataset.id)}`, { method: 'PATCH', body: fields(form) })
    books = books.map((b) => (b.id === book.id ? book : b))
    item.replaceWith(htmlToNode(bookItem(book)))
    toast('Saved.')
  } catch (err) {
    toast(err.message)
  }
}

function confirmRemove(item, book) {
  item.querySelector('.mybook__actions').innerHTML = `
    <span class="mybook__ask">Take ${escape(book.title)} off your shelf?</span>
    <button type="button" class="linkish linkish--danger" data-confirm-remove>Remove</button>
    <button type="button" class="linkish" data-keep>Keep it</button>`
}

async function removeBook(item, book, button) {
  button.disabled = true
  try {
    await api(`/api/books?id=${encodeURIComponent(book.id)}`, { method: 'DELETE' })
    books = books.filter((b) => b.id !== book.id)
    renderBooks()
    renderSamples()
    toast(`${book.title} is off your shelf.`)
  } catch (err) {
    button.disabled = false
    toast(err.message)
  }
}

async function samplesAction(button) {
  const action = button.dataset.samplesAction
  button.disabled = true
  try {
    const data = await api('/api/shelf', { method: 'POST', body: { action } })
    books = data.books
    renderBooks()
    renderSamples()
    toast(action === 'confirm' ? 'They’re yours: no longer marked as samples.' : 'Sample books cleared.')
  } catch (err) {
    button.disabled = false
    toast(err.message)
  }
}

// Lending at a glance: what to bring to the next meetup, what's out, what
// you've borrowed and what you've asked for.
function renderLending() {
  const box = desk.querySelector('[data-lending]')
  if (!lending) return (box.innerHTML = '')
  const when = (iso) => (iso ? new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'the next meetup')
  const since = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const late = (l) => (l.overdue ? ` <span class="tag tag--late">${lending.overdueWeeks}+ weeks</span>` : '')
  const row = (main, actions) => `<li class="lend"><p class="lend__text">${main}</p><div class="lend__actions">${actions}</div></li>`
  const act = (label, action, loan, kind = 'ghost') =>
    `<button type="button" class="btn btn--${kind}" data-loan-action="${action}" data-loan="${loan}">${label}</button>`

  const groups = []
  if (lending.toBring.length) {
    const byMeetup = Map.groupBy ? Map.groupBy(lending.toBring, (l) => l.meetup ?? '') : group(lending.toBring)
    for (const [meetup, list] of byMeetup) {
      groups.push(`<h3 class="lend__head">Bring to ${escape(when(meetup))}</h3><ul class="lends">${list
        .map((l) =>
          row(
            `<strong>${escape(l.title)}</strong> for ${escape(l.borrower)}${l.stillOut ? ' <span class="tag">Still out</span>' : ''}`,
            `${act('Lent it', 'lend', l.id, 'primary')}${act('Can’t this time', 'decline', l.id)}`,
          ),
        )
        .join('')}</ul>`)
    }
  }
  if (lending.lentOut.length) {
    groups.push(`<h3 class="lend__head">Out with others</h3><ul class="lends">${lending.lentOut
      .map((l) => row(`<strong>${escape(l.title)}</strong> with ${escape(l.borrower)} since ${since(l.since)}${late(l)}`, `${act('It’s back', 'return', l.id, 'primary')}${act('Undo', 'undo', l.id)}`))
      .join('')}</ul>`)
  }
  if (lending.borrowed.length) {
    groups.push(`<h3 class="lend__head">Borrowed</h3><ul class="lends">${lending.borrowed
      .map((l) => row(`<strong>${escape(l.title)}</strong> from ${escape(l.owner)} since ${since(l.since)}${late(l)}`, act('I’ve given it back', 'return', l.id, 'primary')))
      .join('')}</ul>`)
  }
  if (lending.asked.length) {
    groups.push(`<h3 class="lend__head">You asked for</h3><ul class="lends">${lending.asked
      .map((l) => row(`<strong>${escape(l.title)}</strong> from ${escape(l.owner)}, for ${escape(when(l.meetup))}`, act('Cancel', 'cancel', l.id)))
      .join('')}</ul>`)
  }
  box.innerHTML = groups.length ? `<section class="panel panel--lending" aria-label="Lending">${groups.join('')}</section>` : ''
}

function group(list) {
  const map = new Map()
  for (const l of list) map.set(l.meetup ?? '', [...(map.get(l.meetup ?? '') ?? []), l])
  return map
}

async function loanAction(button, body) {
  button.disabled = true
  try {
    const data = await api('/api/loans', { method: 'POST', body })
    lending = data.lending
    renderLending()
    renderBooks()
    toast(
      { lend: 'Lent. Enjoy the meetup!', decline: 'Declined.', return: 'Back on the shelf.', undo: 'Undone.', cancel: 'Request cancelled.' }[body.action] ?? 'Done.',
    )
  } catch (err) {
    button.disabled = false
    toast(err.message)
  }
}

// Lending in person, without a request first.
function lendForm(item, book) {
  item.querySelector('.mybook__actions').innerHTML = `
    <form class="lendform" data-lend-form>
      <label class="visually-hidden" for="lend-${escape(book.id)}">Lend ${escape(book.title)} to</label>
      <select class="input" id="lend-${escape(book.id)}" name="to" required>
        <option value="">Lend to…</option>
        ${(lending?.members ?? []).map((m) => `<option value="${escape(m.slug)}">${escape(m.name)}</option>`).join('')}
      </select>
      <button class="btn btn--primary" type="submit">Lend</button>
      <button class="btn btn--ghost" type="button" data-keep>Cancel</button>
    </form>`
  item.querySelector('select').focus()
}

function renderWishes() {
  desk.querySelector('[data-wishes]').innerHTML = wishes.length
    ? wishes
        .map(
          (w) => `<li class="lend"><p class="lend__text"><strong>${escape(w.title)}</strong>${w.author ? ` by ${escape(w.author)}` : ''}</p>
            <div class="lend__actions"><button type="button" class="btn btn--ghost" data-unwant="${w.id}">Got it, remove</button></div></li>`,
        )
        .join('')
    : '<li class="mybooks__empty">Nothing yet.</li>'
}

async function want(button, pick) {
  button.disabled = true
  try {
    const data = await api('/api/wishes', { method: 'POST', body: { title: pick.title, author: pick.author, olKey: pick.olKey, coverId: pick.coverId } })
    wishes = data.wishes
    renderWishes()
    toast(`${pick.title} is on the Wanted shelf.`)
  } catch (err) {
    toast(err.message)
  } finally {
    button.disabled = false
  }
}

async function unwant(button) {
  button.disabled = true
  try {
    wishes = (await api(`/api/wishes?id=${encodeURIComponent(button.dataset.unwant)}`, { method: 'DELETE' })).wishes
    renderWishes()
    toast('Taken off the Wanted shelf.')
  } catch (err) {
    button.disabled = false
    toast(err.message)
  }
}

// ── Your blog ─────────────────────────────────────────────────────────────

function renderWriting() {
  const { blogs, posts } = writing
  desk.querySelector('[data-writing]').innerHTML = blogs.length
    ? `<h3 class="lend__head">${blogs.length === 1 ? 'On the club’s blog' : 'Your blogs'}</h3>
      <ul class="lends">${blogs.map(blogItem).join('')}</ul>
      ${
        posts.length
          ? `<h3 class="lend__head">Your posts there</h3>
        <p class="panel__lede">Hide any you’d rather not show on the club’s blog. They stay on your own.</p>
        <ul class="lends">${posts
          .map(
            (p) => `
          <li class="lend${p.hidden ? ' is-hidden' : ''}">
            <p class="lend__text"><a href="${escape(p.url)}" target="_blank" rel="noopener">${escape(p.title)}</a><span class="lend__sub">${day(p.date)}${p.hidden ? ' · hidden' : ''}</span></p>
            <div class="lend__actions"><button type="button" class="btn btn--ghost" data-blog-action="${p.hidden ? 'show' : 'hide'}" data-post="${p.id}">${p.hidden ? 'Show it' : 'Hide'}</button></div>
          </li>`,
          )
          .join('')}</ul>`
          : ''
      }`
    : ''
}

function blogItem(b) {
  const name = b.title || new URL(b.home).hostname.replace(/^www\./, '')
  return `
    <li class="lend" data-blog="${b.id}">
      <p class="lend__text"><a href="${escape(b.home)}" target="_blank" rel="noopener"><strong>${escape(name)}</strong></a>${b.platform ? ` · ${escape(b.platform)}` : ''}
        <span class="lend__sub">${b.posts === 1 ? '1 post' : `${b.posts} posts`}${b.hidden ? `, ${b.hidden} hidden` : ''} · checked ${ago(b.checked)}</span>
        ${b.error ? `<span class="lend__error">Last check: ${escape(b.error)}</span>` : ''}</p>
      <div class="lend__actions" data-blog-actions>
        <button type="button" class="btn btn--ghost" data-blog-action="check" data-blog-id="${b.id}">Check now</button>
        <button type="button" class="btn btn--ghost" data-blog-action="ask-remove" data-blog-id="${b.id}">Remove</button>
      </div>
    </li>`
}

async function addBlog(form) {
  const button = form.querySelector('[type=submit]')
  button.disabled = true
  button.textContent = 'Finding your posts…'
  try {
    const { writing: now, added } = await api('/api/blogs', { method: 'POST', body: { action: 'add', url: fields(form).url } })
    writing = now
    renderWriting()
    form.reset()
    toast(added.posts ? `Added, with ${added.posts === 1 ? 'one post' : `${added.posts} posts`}. They’re on the club’s blog now.` : 'Added. New posts will show up on the club’s blog.')
  } catch (err) {
    toast(err.message)
  } finally {
    button.disabled = false
    button.textContent = 'Add my blog'
  }
}

async function blogButton(button) {
  const action = button.dataset.blogAction
  if (action === 'ask-remove') {
    button.closest('[data-blog-actions]').innerHTML = `
      <span class="mybook__ask">Take it off the club’s blog?</span>
      <button type="button" class="linkish linkish--danger" data-blog-action="remove" data-blog-id="${button.dataset.blogId}">Remove</button>
      <button type="button" class="linkish" data-blog-action="keep">Keep it</button>`
    return
  }
  if (action === 'keep') return renderWriting()
  const body = action === 'hide' || action === 'show' ? { action, post: Number(button.dataset.post) } : { action, id: Number(button.dataset.blogId) }
  button.disabled = true
  if (action === 'check') button.textContent = 'Checking…'
  try {
    writing = (await api('/api/blogs', { method: 'POST', body })).writing
    renderWriting()
    toast({ check: 'Checked. Anything new is on the club’s blog.', remove: 'Your blog is off the club’s blog.', hide: 'Hidden from the club’s blog.', show: 'Back on the club’s blog.' }[action])
  } catch (err) {
    toast(err.message)
    renderWriting()
  }
}

const day = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })


function htmlToNode(html) {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild
}

const ICONS = {
  scan: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6V4.5A1.5 1.5 0 014.5 3H6M14 3h1.5A1.5 1.5 0 0117 4.5V6M17 14v1.5a1.5 1.5 0 01-1.5 1.5H14M6 17H4.5A1.5 1.5 0 013 15.5V14M6 7v6M8.5 7v6M11 7v6M13.5 7v6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>',
}
