// Admin: the club's members, and their personal sign-in links. More of the
// club's housekeeping (the calendar, the newcomer details) lands here too.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/inter'
import './styles.css'

import { api, toaster, copyText, whatsappLink } from './lib/api.js'
import { escape } from './lib/render.js'
import { hash } from './lib/model.js'

const desk = document.querySelector('[data-desk]')
const toast = toaster(document.querySelector('[data-toast]'))
let members = []

start()

async function start() {
  let me
  try {
    me = (await api('/api/me')).member
  } catch (err) {
    return fail(err.message)
  }
  if (!me) return fail('Sign in with your personal link first, then come back here.', true)
  if (!me.isAdmin) return fail('This page is for the club’s admins.')
  desk.innerHTML = `
    <div class="desk__head">
      <p class="kicker">Admin</p>
      <h1 class="desk__title">Members</h1>
      <p class="desk__lede">
        Make each member their own sign-in link and send it to them on WhatsApp. It signs them in on any phone or
        laptop they open it on. Making a new link cancels their old one, so use that if a link gets shared by mistake.
      </p>
    </div>
    <section class="panel" aria-labelledby="new-title">
      <h2 id="new-title" class="panel__title">Add a member</h2>
      <form class="addform addform--row" data-add-member>
        <label class="field"><span>Name, as the club knows them</span><input class="input" name="name" required maxlength="40" autocomplete="off" /></label>
        <button class="btn btn--primary" type="submit">Add member</button>
      </form>
    </section>
    <section class="panel" aria-labelledby="list-title">
      <h2 id="list-title" class="panel__title" data-count>Members</h2>
      <ul class="people" data-people></ul>
    </section>`
  wire()
  await load()
}

function fail(message, signIn = false) {
  desk.innerHTML = `<div class="desk__head"><p class="kicker">Admin</p><h1 class="desk__title">Not here</h1>
    <p class="desk__lede">${escape(message)}</p>${signIn ? '<p class="desk__links"><a class="btn btn--primary" href="/me">Go to My shelf</a></p>' : ''}</div>`
}

async function load() {
  members = (await api('/api/admin')).members
  desk.querySelector('[data-count]').textContent = `Members (${members.length})`
  desk.querySelector('[data-people]').innerHTML = members.map(person).join('')
}

function status(m) {
  if (m.lastSeen) return `Signed in · last seen ${m.lastSeen}`
  if (m.invitedOn) return `Link made ${m.invitedOn}, not opened yet`
  return 'No sign-in link yet'
}

function person(m) {
  const books = m.books
    ? `${m.books} ${m.books === 1 ? 'book' : 'books'}${m.samples ? ` · ${m.samples === m.books ? 'all samples' : `${m.samples} samples`}` : ''}`
    : 'No books yet'
  return `
    <li class="person" data-slug="${escape(m.slug)}">
      <span class="avatar" style="--hue:${hash(m.name) % 360}">${escape(m.name[0])}</span>
      <div class="person__body">
        <p class="person__name">${escape(m.name)}${m.isAdmin ? ' <span class="tag">Admin</span>' : ''}</p>
        <p class="person__meta">${books} · ${status(m)}</p>
        <div class="person__link" data-link></div>
      </div>
      <div class="person__actions">
        <button type="button" class="btn btn--ghost" data-invite>${m.invitedOn ? 'New link' : 'Make link'}</button>
        <details class="menu">
          <summary class="btn btn--ghost btn--icon" aria-label="More for ${escape(m.name)}">⋯</summary>
          <div class="menu__list">
            <button type="button" data-rename>Rename</button>
            <button type="button" data-admin="${m.isAdmin ? 'off' : 'on'}">${m.isAdmin ? 'Remove admin rights' : 'Make admin'}</button>
            <button type="button" class="is-danger" data-remove>Remove from the club</button>
          </div>
        </details>
      </div>
    </li>`
}

function wire() {
  desk.querySelector('[data-add-member]').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const name = new FormData(form).get('name')
    try {
      await api('/api/admin', { method: 'POST', body: { action: 'add-member', name } })
      form.reset()
      toast(`${name} is a member. Make them a sign-in link next.`)
      await load()
    } catch (err) {
      toast(err.message)
    }
  })

  desk.addEventListener('click', async (e) => {
    const t = e.target.closest('button')
    const row = t?.closest('[data-slug]')
    if (!t || !row) return
    const slug = row.dataset.slug
    const m = members.find((x) => x.slug === slug)
    t.closest('details')?.removeAttribute('open')
    try {
      if (t.matches('[data-invite]')) {
        const { link, message } = await api('/api/admin', { method: 'POST', body: { action: 'invite', slug } })
        row.querySelector('[data-link]').innerHTML = `
          <code class="person__url">${escape(link)}</code>
          <div class="person__share">
            <button type="button" class="btn btn--primary" data-copy-message>Copy message</button>
            <a class="btn btn--ghost" href="${whatsappLink(message)}" target="_blank" rel="noopener">Send on WhatsApp</a>
          </div>`
        row.querySelector('[data-copy-message]').addEventListener('click', async () => toast((await copyText(message)) ? 'Message copied, with the link.' : message))
        t.textContent = 'New link'
      } else if (t.matches('[data-rename]')) {
        row.querySelector('[data-link]').innerHTML = `
          <form class="addform addform--row" data-rename-form>
            <label class="field"><span>New name</span><input class="input" name="name" value="${escape(m.name)}" required maxlength="40" /></label>
            <button class="btn btn--primary" type="submit">Rename</button>
          </form>`
        const form = row.querySelector('[data-rename-form]')
        form.querySelector('input').select()
        form.addEventListener('submit', async (ev) => {
          ev.preventDefault()
          try {
            await api('/api/admin', { method: 'POST', body: { action: 'rename', slug, name: new FormData(form).get('name') } })
            await load()
          } catch (err) {
            toast(err.message)
          }
        })
      } else if (t.matches('[data-admin]')) {
        await api('/api/admin', { method: 'POST', body: { action: 'set-admin', slug, isAdmin: t.dataset.admin === 'on' } })
        await load()
      } else if (t.matches('[data-remove]')) {
        row.querySelector('[data-link]').innerHTML = `
          <p class="person__warn">Remove ${escape(m.name)}? Their shelf comes off the site and their sign-in link stops working.</p>
          <div class="person__share">
            <button type="button" class="btn btn--primary" data-confirm-remove>Remove ${escape(m.name)}</button>
            <button type="button" class="btn btn--ghost" data-cancel>Keep</button>
          </div>`
      } else if (t.matches('[data-confirm-remove]')) {
        await api('/api/admin', { method: 'POST', body: { action: 'remove-member', slug } })
        toast(`${m.name} has been removed.`)
        await load()
      } else if (t.matches('[data-cancel]')) {
        row.querySelector('[data-link]').innerHTML = ''
      }
    } catch (err) {
      toast(err.message)
    }
  })
}
