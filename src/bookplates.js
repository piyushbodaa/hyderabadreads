// Printable bookplates: one sticker per book, with a QR code that opens the
// book's page ready for "I've got it". Stick one inside each cover, and lending
// at a meetup is a scan and a tap. Laid out for A4 sheets of 21 labels
// (63.5 × 38.1 mm, the common 3 × 7 kind), and fine on plain paper too.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/inter'
import './styles.css'

import { renderSVG } from 'uqr'
import { api } from './lib/api.js'
import { escape } from './lib/render.js'

const desk = document.querySelector('[data-desk]')

start()

async function start() {
  let data
  try {
    data = await api('/api/me')
  } catch (err) {
    return (desk.innerHTML = head('Something went wrong', escape(err.message)))
  }
  if (!data.member) {
    return (desk.innerHTML = head('Sign in first', 'Bookplates are made from your own shelf. Open your personal sign-in link, then come back.', '<a class="btn btn--primary" href="/me">Go to My shelf</a>'))
  }
  const books = data.books.filter((b) => !b.sample)
  const intro = books.length
    ? `${books.length === 1 ? 'A sticker for your book.' : `One sticker for each of your ${books.length} books.`} Each QR code opens that book’s page, where a borrower taps <em>I’ve got it</em> and the loan is recorded. Print on A4 sheets of 21 labels (63.5 × 38.1 mm) or on plain paper and cut them out.`
    : 'Add your books on My shelf first. Sample books don’t get bookplates.'
  desk.innerHTML = `
    ${head('Bookplates', intro, books.length ? '<button type="button" class="btn btn--primary" data-print>Print bookplates</button> <button type="button" class="btn btn--ghost" data-print-card>Print a table card</button>' : '<a class="btn btn--primary" href="/me">Go to My shelf</a>')}
    <div class="sheet" data-sheet>${books.map((b) => plate(b, data.member.name)).join('')}</div>
    <div class="table-card" data-card hidden>${tableCard()}</div>`
  desk.querySelector('[data-print]')?.addEventListener('click', () => printOnly('sheet'))
  desk.querySelector('[data-print-card]')?.addEventListener('click', () => printOnly('card'))
}

function head(title, text, actions = '') {
  return `<div class="desk__head plates-head">
    <p class="kicker">My shelf</p>
    <h1 class="desk__title">${title}</h1>
    <p class="desk__lede">${text}</p>
    ${actions ? `<p class="desk__links">${actions}</p>` : ''}
  </div>`
}

function qr(url) {
  return renderSVG(url, { ecc: 'M', border: 1, pixelSize: 4, blackColor: '#1a120b', whiteColor: '#ffffff' })
}

function plate(book, owner) {
  return `
    <article class="bookplate">
      <div class="bookplate__qr">${qr(`${location.origin}/book/${book.id}?got=1`)}</div>
      <div class="bookplate__text">
        <p class="bookplate__from">From the shelf of</p>
        <p class="bookplate__owner">${escape(owner)}</p>
        <p class="bookplate__title">${escape(book.title)}</p>
        <p class="bookplate__site">Hyderabad Reads · scan to borrow</p>
      </div>
    </article>`
}

// A card for the meetup table, pointing at the whole library.
function tableCard() {
  return `
    <div class="table-card__qr">${qr(`${location.origin}/`)}</div>
    <p class="table-card__title">Hyderabad Reads</p>
    <p class="table-card__text">Every book on our shelves. Scan, find one you like, and ask its owner to bring it.</p>
    <p class="table-card__site">hyderabadreads.fun</p>`
}

function printOnly(which) {
  document.body.dataset.printing = which
  desk.querySelector('[data-card]').hidden = which !== 'card'
  print()
  desk.querySelector('[data-card]').hidden = true
  delete document.body.dataset.printing
}
