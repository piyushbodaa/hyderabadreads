// Your year at the club: what you lent, borrowed and added, and a card to
// share. The card is made on the server and only ever handed to you, so
// nobody else can look up your numbers.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/inter'
import './styles.css'

import { api, toaster } from './lib/api.js'
import { escape } from './lib/render.js'
import { track } from './lib/track.js'

const desk = document.querySelector('[data-desk]')
const toast = toaster(document.querySelector('[data-toast]'))
const thisYear = new Date().getFullYear()
const n = (v) => Number(v).toLocaleString('en-IN')

show(thisYear)

async function show(year) {
  let y
  try {
    y = await api(`/api/year?y=${year}`)
  } catch (err) {
    const signIn = err.status === 401
    desk.innerHTML = `<div class="desk__head"><p class="kicker">Your year</p><h1 class="desk__title">${signIn ? 'Sign in first' : 'Something went wrong'}</h1>
      <p class="desk__lede">${signIn ? 'Your year is made from your own lending and borrowing. Open your personal sign-in link, then come back.' : escape(err.message)}</p>
      ${signIn ? '<p class="desk__links"><a class="btn btn--primary" href="/me">Go to My shelf</a></p>' : ''}</div>`
    return
  }
  const years = Array.from({ length: thisYear - 2026 + 1 }, (_, i) => thisYear - i)
  const card = `/api/year-card?y=${y.year}`
  desk.innerHTML = `
    <div class="desk__head">
      <p class="kicker">Your year</p>
      <h1 class="desk__title">${escape(y.name)}’s ${y.year}</h1>
      ${years.length > 1 ? `<p class="desk__links">${years.map((v) => `<button type="button" class="chip" aria-pressed="${v === y.year}" data-year="${v}">${v}</button>`).join('')}</p>` : ''}
    </div>
    <div class="year">
      <dl class="tiles tiles--year">
        <div class="tile"><dd>${n(y.lent.n)}</dd><dt>${y.lent.n === 1 ? 'book lent' : 'books lent'}${y.lent.people ? `, to ${y.lent.people} ${y.lent.people === 1 ? 'person' : 'people'}` : ''}</dt></div>
        <div class="tile"><dd>${n(y.borrowed.n)}</dd><dt>${y.borrowed.n === 1 ? 'book borrowed' : 'books borrowed'}</dt></div>
        <div class="tile"><dd>${n(y.lent.pages + y.borrowed.pages)}</dd><dt>pages passed around</dt></div>
        <div class="tile"><dd>${n(y.added.n)}</dd><dt>${y.added.n === 1 ? 'book added' : 'books added'} to the shelves</dt></div>
      </dl>
      <p class="year__notes">
        ${y.mostLent ? `Your book people asked for most: <strong>${escape(y.mostLent.title)}</strong>. ` : ''}
        ${y.topGenre ? `What you borrowed most: <strong>${escape(y.topGenre)}</strong>.` : ''}
        ${!y.lent.n && !y.borrowed.n ? 'No lending or borrowing yet this year. Ask someone for a book at the next meetup!' : ''}
      </p>
      <figure class="year__card">
        <img src="${card}" alt="Your year as a card to share" width="1080" height="1350" />
        <figcaption class="desk__links">
          <button type="button" class="btn btn--primary" data-share>Share</button>
          <a class="btn btn--ghost" href="${card}" download="hyderabad-reads-${y.year}.jpg" data-download>Download</a>
        </figcaption>
      </figure>
    </div>`

  desk.querySelectorAll('[data-year]').forEach((b) => b.addEventListener('click', () => show(Number(b.dataset.year))))
  desk.querySelector('[data-download]').addEventListener('click', () => track('year_card'))
  desk.querySelector('[data-share]').addEventListener('click', async () => {
    track('year_card')
    try {
      const blob = await (await fetch(card, { credentials: 'same-origin' })).blob()
      const file = new File([blob], `hyderabad-reads-${y.year}.jpg`, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text: `My ${y.year} at Hyderabad Reads 📚` })
      desk.querySelector('[data-download]').click()
    } catch (err) {
      if (err.name !== 'AbortError') toast('Couldn’t share it from here. Use Download instead.')
    }
  })
}
