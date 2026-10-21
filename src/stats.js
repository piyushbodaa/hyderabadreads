// The club in numbers: real books only (samples don't count), what's on the
// shelves by genre and language, what gets borrowed and what's wanted.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/inter'
import './styles.css'

import { api } from './lib/api.js'
import { escape } from './lib/render.js'

const desk = document.querySelector('[data-desk]')
const n = (v) => Number(v).toLocaleString('en-IN')

start()

async function start() {
  let s
  try {
    s = await api('/api/stats')
  } catch (err) {
    desk.innerHTML = `<div class="desk__head"><h1 class="desk__title">Something went wrong</h1><p class="desk__lede">${escape(err.message)}</p></div>`
    return
  }
  const t = s.totals
  const tiles = [
    [t.books, t.books === 1 ? 'book on the shelves' : 'books on the shelves'],
    [t.shelves, t.shelves === 1 ? 'member sharing' : 'members sharing'],
    [t.pages, 'pages to share'],
    [t.loans, t.loans === 1 ? 'loan so far' : 'loans so far'],
    [t.out, 'out right now'],
    [t.wanted, 'on the Wanted shelf'],
  ]
  desk.innerHTML = `
    <div class="desk__head">
      <p class="kicker">Hyderabad Reads</p>
      <h1 class="desk__title">The club in numbers</h1>
      <p class="desk__lede">${t.books ? 'Real books only: the sample shelves don’t count.' : 'The numbers start once members add their real books. Every shelf is still a sample.'}</p>
    </div>
    <dl class="tiles">${tiles.map(([v, label]) => `<div class="tile"><dd>${n(v)}</dd><dt>${label}</dt></div>`).join('')}</dl>
    ${
      t.books
        ? `<div class="stats-grid">
            ${bars('On the shelves, by genre', s.genres, t.books)}
            ${bars('By language', s.languages, t.books)}
            ${ranked('Borrowed the most', s.mostBorrowed, (r) => `<a href="/book/${escape(r.id)}">${escape(r.title)}</a> <span>${escape(r.author)}</span>`, (r) => `${r.n} ${r.n === 1 ? 'loan' : 'loans'}`, 'Nothing borrowed yet.')}
            ${ranked('Most wanted', s.mostWanted, (r) => `${escape(r.title)}${r.author ? ` <span>${escape(r.author)}</span>` : ''}`, (r) => `${r.n} ${r.n === 1 ? 'member' : 'members'}`, 'Nobody is looking for anything yet.')}
            ${s.lenders ? ranked('Most generous lenders', s.lenders, (r) => escape(r.name), (r) => `${r.n} ${r.n === 1 ? 'loan' : 'loans'}`, 'No loans yet.') : ''}
          </div>`
        : ''
    }`
  wireHover()
}

// A horizontal bar per category: one colour (it's one series), the value in
// plain text beside it, and the share of the shelves on hover.
function bars(title, rows, total) {
  if (!rows.length) return ''
  const max = Math.max(...rows.map((r) => r.n))
  return `
    <section class="panel chart" aria-labelledby="${slug(title)}">
      <h2 class="panel__title" id="${slug(title)}">${title}</h2>
      <ul class="bars">${rows
        .map(
          (r) => `
        <li class="bars__row" tabindex="0" data-tip="${escape(r.label)}: ${n(r.n)} ${r.n === 1 ? 'book' : 'books'}, ${Math.round((r.n / total) * 100)}% of the shelves">
          <span class="bars__label">${escape(r.label)}</span>
          <span class="bars__track"><span class="bars__bar" style="width:${Math.max(2, (r.n / max) * 100)}%"></span></span>
          <span class="bars__value">${n(r.n)}</span>
        </li>`,
        )
        .join('')}</ul>
      <p class="chart__tip" role="status" aria-live="polite" data-chart-tip></p>
    </section>`
}

function ranked(title, rows, label, value, empty) {
  return `
    <section class="panel" aria-labelledby="${slug(title)}">
      <h2 class="panel__title" id="${slug(title)}">${title}</h2>
      ${
        rows?.length
          ? `<ol class="ranked">${rows.map((r) => `<li><span class="ranked__label">${label(r)}</span><span class="ranked__value">${value(r)}</span></li>`).join('')}</ol>`
          : `<p class="results__note">${empty}</p>`
      }
    </section>`
}

const slug = (t) => t.toLowerCase().replace(/[^a-z]+/g, '-')

function wireHover() {
  for (const chart of desk.querySelectorAll('.chart')) {
    const tip = chart.querySelector('[data-chart-tip]')
    const show = (e) => {
      const row = e.target.closest('[data-tip]')
      tip.textContent = row ? row.dataset.tip : ''
    }
    chart.addEventListener('pointerover', show)
    chart.addEventListener('focusin', show)
    chart.addEventListener('pointerleave', () => (tip.textContent = ''))
  }
}
