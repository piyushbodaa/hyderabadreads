// Admin: the club's members, and their personal sign-in links. More of the
// club's housekeeping (the calendar, the newcomer details, members' blogs)
// lands here too.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/inter'
import './styles.css'
import './lib/pwa.js'

import { api, toaster, copyText, whatsappLink, ago } from './lib/api.js'
import { escape } from './lib/render.js'
import { hash } from './lib/model.js'

const desk = document.querySelector('[data-desk]')
const toast = toaster(document.querySelector('[data-toast]'))
let members = []
let calendar = { meetups: [], venues: [], settings: {} }
let writing = { blogs: [], posts: [] }
const picked = new Set()

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
      <h1 class="desk__title">Running the club</h1>
      <p class="desk__lede">
        Members and their sign-in links, the meetup calendar, venues, and the club’s details.
        <a href="/digest">This week’s digest</a> is ready to post too.
      </p>
      <nav class="jump" aria-label="Admin sections">
        <a href="#members">Members</a><a href="#blogs">Blogs</a><a href="#calendar">Calendar</a><a href="#venues">Venues</a><a href="#club">Club details</a><a href="#photos">Photos</a>
      </nav>
    </div>
    <section class="panel" id="members" aria-labelledby="new-title">
      <h2 id="new-title" class="panel__title">Add a member</h2>
      <p class="panel__lede">Make each member their own sign-in link and send it on WhatsApp. It signs them in on any phone or laptop they open it on. A new link cancels the old one, so use that if a link gets shared by mistake.</p>
      <form class="addform addform--row" data-add-member>
        <label class="field"><span>Name, as the club knows them</span><input class="input" name="name" required maxlength="40" autocomplete="off" /></label>
        <button class="btn btn--primary" type="submit">Add member</button>
      </form>
    </section>
    <section class="panel" aria-labelledby="list-title">
      <h2 id="list-title" class="panel__title" data-count>Members</h2>
      <ul class="people" data-people></ul>
    </section>
    <section class="panel" id="blogs" aria-labelledby="blogs-title">
      <h2 id="blogs-title" class="panel__title">Blogs</h2>
      <p class="panel__lede">Members’ blogs on <a href="/blog">the club’s blog</a>. Members add their own on My shelf, or add one for them here: any page on their Substack, Medium, WordPress or own site will do.</p>
      <form class="addform addform--blog" data-add-blog>
        <label class="field"><span>Member</span><select class="input" name="member" required data-blog-member></select></label>
        <label class="field"><span>Their blog’s address</span><input class="input" name="url" required maxlength="500" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="yourname.substack.com" /></label>
        <button class="btn btn--primary" type="submit">Add blog</button>
      </form>
      <div class="blog-list" data-admin-blogs></div>
    </section>
    <section class="panel" id="calendar" aria-labelledby="cal-title">
      <h2 id="cal-title" class="panel__title">Calendar</h2>
      <form class="addform" data-add-meetups>
        <div class="field">
          <span>Dates</span>
          <div class="dates" data-dates></div>
          <div class="dates__pick">
            <input class="input" type="date" data-date aria-label="A meetup date" />
            <button type="button" class="btn btn--ghost" data-add-date>Add date</button>
          </div>
          <div class="dates__quick">
            <span>Or every</span>
            <label><input type="checkbox" value="6" data-weekday checked /> Saturday</label>
            <label><input type="checkbox" value="0" data-weekday checked /> Sunday</label>
            <span>in</span>
            <input class="input input--month" type="month" data-month aria-label="Month" />
            <button type="button" class="btn btn--ghost" data-fill-month>Fill in</button>
          </div>
        </div>
        <div class="addform__row">
          <label class="field"><span>Venue</span><select class="input" name="venue" required data-venue-select></select></label>
          <label class="field"><span>Time <small>only if it isn’t the venue’s usual</small></span><input class="input" name="time" maxlength="40" placeholder="2:30 to 5:30 PM" /></label>
        </div>
        <label class="field"><span>Note <small>optional, shown on the calendar</small></span><input class="input" name="note" maxlength="200" placeholder="Upstairs, by the window" /></label>
        <button class="btn btn--primary" type="submit">Add to the calendar</button>
      </form>
      <h3 class="lend__head">Coming up</h3>
      <ul class="lends" data-meetups></ul>
    </section>
    <section class="panel" id="venues" aria-labelledby="venues-title">
      <h2 id="venues-title" class="panel__title">Venues</h2>
      <ul class="lends" data-venues></ul>
      <form class="addform addform--row3" data-add-venue>
        <label class="field"><span>New venue</span><input class="input" name="name" required maxlength="60" /></label>
        <label class="field"><span>Area</span><input class="input" name="area" maxlength="60" placeholder="Jubilee Hills" /></label>
        <label class="field"><span>Usual time <small>if not the club’s</small></span><input class="input" name="time" maxlength="40" /></label>
        <button class="btn btn--primary" type="submit">Add venue</button>
      </form>
    </section>
    <section class="panel" id="club" aria-labelledby="club-title">
      <h2 id="club-title" class="panel__title">Club details</h2>
      <form class="addform" data-settings>
        <div class="addform__row">
          <label class="field"><span>Usual meetup time</span><input class="input" name="default_time" required maxlength="40" /></label>
          <label class="field"><span>Fee to attend <small>shown to newcomers, e.g. ₹100</small></span><input class="input" name="fee" maxlength="60" /></label>
        </div>
        <div class="addform__row">
          <label class="field"><span>Weeks before a loan counts as long</span><input class="input" name="overdue_weeks" type="number" min="1" max="52" required /></label>
          <label class="field"><span>Instagram</span><input class="input" name="instagram" type="url" required /></label>
        </div>
        <label class="field"><span>Books on the home page <small>up to five, by their links, one per line. Any spots left fill themselves.</small></span><textarea class="input" name="featured" rows="5" placeholder="https://hyderabadreads.fun/book/animal-farm-orwell"></textarea></label>
        <button class="btn btn--primary" type="submit">Save</button>
      </form>
    </section>
    <section class="panel" id="photos" aria-labelledby="photos-title">
      <h2 id="photos-title" class="panel__title">Meetup photos</h2>
      <p class="panel__lede">Shown to newcomers in “Your first meetup”, newest first (the latest 12). Only share photos that everyone in them is happy to have online.</p>
      <form class="addform" data-add-photos>
        <div class="addform__row">
          <label class="field"><span>Photos</span><input class="input" type="file" name="files" accept="image/jpeg,image/png,image/webp" multiple required /></label>
          <label class="field"><span>Caption <small>optional</small></span><input class="input" name="caption" maxlength="140" placeholder="Reading at Chilaka, October" /></label>
        </div>
        <button class="btn btn--primary" type="submit">Upload</button>
      </form>
      <div class="photo-grid" data-photos></div>
    </section>`
  wire()
  wireCalendar()
  wireBlogs()
  await load()
}

function fail(message, signIn = false) {
  desk.innerHTML = `<div class="desk__head"><p class="kicker">Admin</p><h1 class="desk__title">Not here</h1>
    <p class="desk__lede">${escape(message)}</p>${signIn ? '<p class="desk__links"><a class="btn btn--primary" href="/me">Go to My shelf</a></p>' : ''}</div>`
}

async function load() {
  const data = await api('/api/admin')
  members = data.members
  calendar = data
  writing = data.writing
  desk.querySelector('[data-count]').textContent = `Members (${members.length})`
  desk.querySelector('[data-people]').innerHTML = members.map(person).join('')
  renderCalendar()
  renderBlogs()
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

// ── Calendar, venues and club details ─────────────────────────────────────

const pretty = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

function renderCalendar() {
  const { meetups, venues, settings } = calendar
  const select = desk.querySelector('[data-venue-select]')
  const chosen = select.value
  select.innerHTML = venues.map((v) => `<option${v.name === chosen ? ' selected' : ''}>${escape(v.name)}</option>`).join('')
  renderPicked()

  const usual = (m) => m.time || venues.find((v) => v.name === m.venue)?.time || settings.default_time
  desk.querySelector('[data-meetups]').innerHTML =
    meetups
      .map(
        (m) => `
      <li class="lend${m.cancelled ? ' is-cancelled' : ''}" data-meetup="${m.id}">
        <p class="lend__text"><strong>${pretty(m.date)}</strong> · ${escape(m.venue)} · ${escape(usual(m))}${m.note ? ` · ${escape(m.note)}` : ''}${m.cancelled ? ' <span class="tag tag--late">Cancelled</span>' : ''}</p>
        <div class="lend__actions">
          <button type="button" class="btn btn--ghost" data-toggle-cancel>${m.cancelled ? 'Restore' : 'Cancel meetup'}</button>
          <button type="button" class="btn btn--ghost" data-delete-meetup>Delete</button>
        </div>
      </li>`,
      )
      .join('') || '<li class="mybooks__empty">No meetups coming up. Add some above.</li>'

  desk.querySelector('[data-venues]').innerHTML = venues
    .map(
      (v) => `
      <li class="lend" data-venue="${v.id}">
        <form class="venueform" data-venue-form>
          <strong class="venueform__name">${escape(v.name)}</strong>
          <label class="visually-hidden" for="area-${v.id}">Area</label>
          <input class="input" id="area-${v.id}" name="area" value="${escape(v.area)}" placeholder="Area" maxlength="60" />
          <label class="visually-hidden" for="time-${v.id}">Usual time</label>
          <input class="input" id="time-${v.id}" name="time" value="${escape(v.time ?? '')}" placeholder="${escape(settings.default_time ?? '')}" maxlength="40" />
          <button class="btn btn--ghost" type="submit">Save</button>
        </form>
      </li>`,
    )
    .join('')

  const form = desk.querySelector('[data-settings]')
  for (const [key, value] of Object.entries(settings)) {
    if (!form.elements[key]) continue
    form.elements[key].value = key === 'featured' ? value.split(',').filter(Boolean).map((slug) => `${location.origin}/book/${slug}`).join('\n') : value
  }

  desk.querySelector('[data-photos]').innerHTML = (calendar.photos ?? [])
    .map(
      (p) => `
      <figure class="photo-grid__item" data-photo-id="${p.id}">
        <img src="${escape(p.thumb)}" alt="" loading="lazy" />
        <figcaption>${escape(p.caption || 'No caption')}</figcaption>
        <button type="button" class="linkish linkish--danger" data-remove-photo>Remove</button>
      </figure>`,
    )
    .join('')
}

// Phone photos are big: each is shrunk to 1600px in the browser before upload.
async function shrink(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) })
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function renderPicked() {
  const dates = [...picked].sort()
  desk.querySelector('[data-dates]').innerHTML = dates.length
    ? dates.map((d) => `<button type="button" class="chip" data-unpick="${d}" aria-label="Remove ${pretty(d)}">${pretty(d)} <span>×</span></button>`).join('')
    : '<p class="results__note">No dates picked yet.</p>'
}

function wireCalendar() {
  const monthInput = desk.querySelector('[data-month]')
  const now = new Date()
  monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2).padStart(2, '0')}`
  if (now.getMonth() === 11) monthInput.value = `${now.getFullYear() + 1}-01`

  desk.addEventListener('click', async (e) => {
    const t = e.target.closest('button')
    if (!t) return
    if (t.matches('[data-add-date]')) {
      const value = desk.querySelector('[data-date]').value
      if (value) picked.add(value)
      return renderPicked()
    }
    if (t.matches('[data-unpick]')) {
      picked.delete(t.dataset.unpick)
      return renderPicked()
    }
    if (t.matches('[data-fill-month]')) {
      const [y, m] = monthInput.value.split('-').map(Number)
      const days = [...desk.querySelectorAll('[data-weekday]:checked')].map((c) => Number(c.value))
      for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
        if (days.includes(new Date(y, m - 1, d).getDay())) picked.add(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
      }
      return renderPicked()
    }
    if (t.matches('[data-remove-photo]')) {
      try {
        await api('/api/admin', { method: 'POST', body: { action: 'remove-photo', id: Number(t.closest('[data-photo-id]').dataset.photoId) } })
        toast('Photo removed.')
        await load()
      } catch (err) {
        toast(err.message)
      }
      return
    }
    const row = t.closest('[data-meetup]')
    if (!row) return
    const meetup = calendar.meetups.find((m) => String(m.id) === row.dataset.meetup)
    try {
      if (t.matches('[data-toggle-cancel]')) {
        await api('/api/admin', { method: 'POST', body: { action: 'update-meetup', id: meetup.id, cancelled: !meetup.cancelled } })
        toast(meetup.cancelled ? 'Meetup restored.' : 'Meetup cancelled. It stays on the calendar, marked as cancelled.')
      } else if (t.matches('[data-delete-meetup]')) {
        await api('/api/admin', { method: 'POST', body: { action: 'delete-meetup', id: meetup.id } })
        toast('Meetup deleted.')
      }
      await load()
    } catch (err) {
      toast(err.message)
    }
  })

  desk.addEventListener('submit', async (e) => {
    const form = e.target
    const fields = Object.fromEntries(new FormData(form))
    try {
      if (form.matches('[data-add-meetups]')) {
        e.preventDefault()
        if (!picked.size) return toast('Pick at least one date first.')
        const { added } = await api('/api/admin', { method: 'POST', body: { action: 'add-meetups', dates: [...picked], ...fields } })
        picked.clear()
        form.reset()
        toast(`${added === 1 ? 'One meetup' : `${added} meetups`} on the calendar.`)
      } else if (form.matches('[data-add-venue]')) {
        e.preventDefault()
        await api('/api/admin', { method: 'POST', body: { action: 'add-venue', ...fields } })
        form.reset()
        toast(`${fields.name} added.`)
      } else if (form.matches('[data-venue-form]')) {
        e.preventDefault()
        await api('/api/admin', { method: 'POST', body: { action: 'update-venue', id: Number(form.closest('[data-venue]').dataset.venue), ...fields } })
        toast('Venue saved.')
      } else if (form.matches('[data-add-photos]')) {
        e.preventDefault()
        const files = [...form.elements.files.files]
        const button = form.querySelector('[type=submit]')
        button.disabled = true
        try {
          for (const [i, file] of files.entries()) {
            button.textContent = `Uploading ${i + 1} of ${files.length}…`
            await api('/api/admin', { method: 'POST', body: { action: 'add-photo', image: await shrink(file), caption: fields.caption } })
          }
          toast(files.length === 1 ? 'Photo added.' : `${files.length} photos added.`)
          form.reset()
        } finally {
          button.disabled = false
          button.textContent = 'Upload'
        }
      } else if (form.matches('[data-settings]')) {
        e.preventDefault()
        await api('/api/admin', { method: 'POST', body: { action: 'set-settings', settings: fields } })
        toast('Club details saved.')
      } else {
        return
      }
      await load()
    } catch (err) {
      toast(err.message)
    }
  })
}

// ── Blogs ─────────────────────────────────────────────────────────────────

function renderBlogs() {
  const select = desk.querySelector('[data-blog-member]')
  const chosen = select.value
  select.innerHTML = `<option value="">Choose…</option>${members.map((m) => `<option value="${escape(m.slug)}"${m.slug === chosen ? ' selected' : ''}>${escape(m.name)}</option>`).join('')}`
  const { blogs, posts } = writing
  desk.querySelector('[data-admin-blogs]').innerHTML = blogs.length
    ? `<h3 class="lend__head">On the blog</h3>
      <ul class="lends">${blogs
        .map(
          (b) => `
        <li class="lend" data-admin-blog="${b.id}">
          <p class="lend__text"><strong>${escape(b.writer)}</strong> · <a href="${escape(b.home)}" target="_blank" rel="noopener">${escape(b.title || new URL(b.home).hostname)}</a>${b.platform ? ` · ${escape(b.platform)}` : ''}
            <span class="lend__sub">${b.posts === 1 ? '1 post' : `${b.posts} posts`}${b.hidden ? `, ${b.hidden} hidden` : ''} · checked ${ago(b.checked)}</span>
            ${b.error ? `<span class="lend__error">Last check: ${escape(b.error)}</span>` : ''}</p>
          <div class="lend__actions" data-blog-actions>
            <button type="button" class="btn btn--ghost" data-blog="check">Check now</button>
            <button type="button" class="btn btn--ghost" data-blog="ask-remove">Remove</button>
          </div>
        </li>`,
        )
        .join('')}</ul>
      ${
        posts.length
          ? `<h3 class="lend__head">Latest posts</h3>
        <ul class="lends">${posts
          .map(
            (p) => `
          <li class="lend${p.hidden ? ' is-hidden' : ''}" data-admin-post="${p.id}">
            <p class="lend__text"><a href="${escape(p.url)}" target="_blank" rel="noopener">${escape(p.title)}</a><span class="lend__sub">${escape(p.writer)} · ${pretty(p.date)}${p.hidden ? ' · hidden' : ''}</span></p>
            <div class="lend__actions"><button type="button" class="btn btn--ghost" data-blog="${p.hidden ? 'show' : 'hide'}">${p.hidden ? 'Show it' : 'Hide'}</button></div>
          </li>`,
          )
          .join('')}</ul>`
          : ''
      }`
    : '<p class="results__note">No blogs yet.</p>'
}

function wireBlogs() {
  desk.querySelector('[data-add-blog]').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const button = form.querySelector('[type=submit]')
    const { member, url } = Object.fromEntries(new FormData(form))
    button.disabled = true
    button.textContent = 'Finding the posts…'
    try {
      const { added } = await api('/api/blogs', { method: 'POST', body: { action: 'add', member, url } })
      form.reset()
      const name = members.find((m) => m.slug === member)?.name
      toast(`${name ? `${name}’s blog` : 'The blog'} is on the club’s blog, with ${added.posts === 1 ? 'one post' : `${added.posts} posts`}.`)
      await load()
    } catch (err) {
      toast(err.message)
    } finally {
      button.disabled = false
      button.textContent = 'Add blog'
    }
  })

  desk.querySelector('[data-admin-blogs]').addEventListener('click', async (e) => {
    const t = e.target.closest('button[data-blog]')
    if (!t) return
    const action = t.dataset.blog
    const blog = Number(t.closest('[data-admin-blog]')?.dataset.adminBlog)
    const post = Number(t.closest('[data-admin-post]')?.dataset.adminPost)
    if (action === 'ask-remove') {
      t.closest('[data-blog-actions]').innerHTML = `
        <span class="mybook__ask">Take it off the club’s blog?</span>
        <button type="button" class="linkish linkish--danger" data-blog="remove">Remove</button>
        <button type="button" class="linkish" data-blog="keep">Keep it</button>`
      return
    }
    if (action === 'keep') return renderBlogs()
    t.disabled = true
    if (action === 'check') t.textContent = 'Checking…'
    try {
      await api('/api/blogs', { method: 'POST', body: action === 'hide' || action === 'show' ? { action, post } : { action, id: blog } })
      toast({ check: 'Checked.', remove: 'Blog removed.', hide: 'Hidden from the club’s blog.', show: 'Back on the club’s blog.' }[action])
      await load()
    } catch (err) {
      toast(err.message)
      renderBlogs()
    }
  })
}
