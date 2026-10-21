// This week at the club, written as a WhatsApp message: new books, the next
// meetups, open requests, and books that have been out a long time. The site
// can't post to the group itself, so it writes the message for whoever does.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/inter'
import './styles.css'
import './lib/pwa.js'

import { api, toaster, copyText, whatsappLink } from './lib/api.js'
import { escape } from './lib/render.js'
import { compose } from './lib/digest-text.js'

const desk = document.querySelector('[data-desk]')
const toast = toaster(document.querySelector('[data-toast]'))

start()

async function start() {
  let data
  try {
    data = await api('/api/digest')
  } catch (err) {
    const signIn = err.status === 401
    desk.innerHTML = `<div class="desk__head"><p class="kicker">This week</p><h1 class="desk__title">${signIn ? 'Sign in first' : 'Something went wrong'}</h1>
      <p class="desk__lede">${signIn ? 'The weekly digest names who has which book, so it’s for members. Open your personal sign-in link, then come back.' : escape(err.message)}</p>
      ${signIn ? '<p class="desk__links"><a class="btn btn--primary" href="/me">Go to My shelf</a></p>' : ''}</div>`
    return
  }
  const message = compose(data, location.origin)
  desk.innerHTML = `
    <div class="desk__head">
      <p class="kicker">This week</p>
      <h1 class="desk__title">The weekly digest</h1>
      <p class="desk__lede">A ready-made message for the club group: new books, the next meetups, and gentle nudges about books that have been out a while.</p>
      <p class="desk__links">
        <button type="button" class="btn btn--primary" data-copy>Copy message</button>
        <a class="btn btn--ghost" href="${whatsappLink(message)}" target="_blank" rel="noopener">Send on WhatsApp</a>
      </p>
    </div>
    <div class="bubble"><pre class="bubble__text">${format(message)}</pre></div>`
  desk.querySelector('[data-copy]').addEventListener('click', async () => toast((await copyText(message)) ? 'Copied. Paste it in the club group.' : message))
}

// WhatsApp's *bold*, shown in bold here too.
function format(message) {
  return escape(message).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
}
