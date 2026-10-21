// The reading room: a book slides off the shelf, turns to face you as a real
// 3D object you can spin, and sits beside everything you need to borrow it.

import { readerList, genreColour, meetups } from './model.js'
import { bookVars, spineHTML, frontHTML, backHTML, escape } from './render.js'
import { session, lend, mine, askedFor, borrowedByMe, lentOut, nextMeetup, meetupPhrase, shortDate } from './session.js'
import { track } from './track.js'

const ICON_ASK =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4.5h14v9H8l-4 3v-3H3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>'

const PERSPECTIVE = 1800
const REST_X = 5
const REST_Y = 24
const BOOK_PATH = /^\/book\/([^/]+)\/?$/
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')

export class Viewer {
  constructor(el, { bookcase, toast, onChange }) {
    this.el = el
    this.bookcase = bookcase
    this.toast = toast
    this.onChange = onChange
    this.stage = el.querySelector('[data-stage]')
    this.holder = el.querySelector('[data-book3d]')
    this.floor = el.querySelector('[data-floor]')
    this.info = el.querySelector('[data-info]')
    this.book = null
    this.busy = false
    this.pushed = false
    // Opened from the QR code on a bookplate: offer "I've got it" first.
    this.gotMode = false
    this.raf = 0
    this.pose = { ry: REST_Y, vy: 0, target: REST_Y, tx: 0, ty: 0, px: 0, py: 0, drag: null }

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) this.dismiss()
      else if (e.target.closest('[data-prev]')) this.go(-1)
      else if (e.target.closest('[data-next]')) this.go(1)
      else if (e.target.closest('[data-ask]')) this.ask()
      else if (e.target.closest('[data-request]')) this.request()
      else if (e.target.closest('[data-got]')) this.gotIt()
      else if (e.target.closest('[data-loan-action]')) this.loanAction(e.target.closest('[data-loan-action]'))
      else if (e.target.closest('[data-link]')) this.copyLink()
    })
    // On the document, not the dialog: swapping books replaces the focused
    // button, and keys must keep working when focus drops to <body>.
    document.addEventListener('keydown', (e) => this.isOpen && this.key(e))
    this.stage.addEventListener('pointerdown', (e) => this.dragStart(e))
    this.stage.addEventListener('pointermove', (e) => this.pointer(e))
    this.stage.addEventListener('pointerup', (e) => this.dragEnd(e))
    this.stage.addEventListener('pointercancel', (e) => this.dragEnd(e))
    this.stage.addEventListener('pointerleave', () => {
      this.pose.px = 0
      this.pose.py = 0
    })
    this.stage.addEventListener('dblclick', () => this.flip())
    window.addEventListener('popstate', () => this.syncToUrl())
    window.addEventListener('hashchange', () => this.syncToUrl())
    // Where closing a book returns to: the home page, or a member's shelf.
    this.home = BOOK_PATH.test(location.pathname) ? '/' : location.pathname + location.search
  }

  get isOpen() {
    return !this.el.hidden
  }

  // Every book has its own address, /book/<id>. Links from before that used
  // #book/<id>, so those are moved over to the new form first.
  syncToUrl() {
    const legacy = location.hash.match(/^#book\/(.+)$/)?.[1]
    if (legacy) history.replaceState(null, '', `/book/${legacy}`)
    const id = decodeURIComponent(location.pathname.match(BOOK_PATH)?.[1] ?? '')
    const book = this.bookcase.order.find((b) => b.id === id) ?? [...this.bookcase.els.values()].find((e) => e.book.id === id)?.book
    if (book && book !== this.book) this.open(book, null, { fromHistory: true })
    else if (!id && this.isOpen) {
      this.pushed = false
      this.close()
    }
  }

  async open(book, spine, { fromHistory = false } = {}) {
    if (this.busy) return
    if (this.isOpen) return this.swap(book, 0)
    this.busy = true
    this.book = book
    this.returnFocus = document.activeElement
    if (!fromHistory) {
      history.pushState({ book: book.id }, '', `/book/${book.id}`)
      this.pushed = true
    }
    this.onChange?.(book)

    document.documentElement.classList.add('is-locked')
    this.el.hidden = false
    this.el.classList.remove('is-closing')
    this.build(book)
    this.renderInfo(book)
    this.resetPose()
    this.el.classList.add('is-open')

    const flight = spine && !reduceMotion.matches && this.inView(spine) ? this.flightFrom(spine) : null
    if (flight) {
      spine.classList.add('is-out')
      const opts = { duration: 980, easing: 'cubic-bezier(.55,0,.15,1)' }
      const a = this.holder.animate(
        [
          { transform: flight.start },
          { transform: flight.lift, offset: 0.24 },
          { transform: 'none' },
        ],
        opts,
      )
      this.body.animate(
        [
          { transform: 'rotateX(0deg) rotateY(90deg)' },
          { transform: 'rotateX(0deg) rotateY(87deg)', offset: 0.24 },
          { transform: `rotateX(${REST_X}deg) rotateY(${REST_Y}deg)` },
        ],
        opts,
      )
      this.floor.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], opts)
      this.startLoop()
      await a.finished.catch(() => {})
    } else {
      this.startLoop()
      await this.holder.animate([{ opacity: 0, transform: 'translateY(24px) scale(.94)' }, { opacity: 1, transform: 'none' }], {
        duration: reduceMotion.matches ? 1 : 520,
        easing: 'cubic-bezier(.2,.8,.2,1)',
      }).finished.catch(() => {})
    }
    this.el.querySelector('.info__actions .btn')?.focus({ preventScroll: true })
    this.busy = false
  }

  // UI close: step back through history if we added an entry, so the phone's
  // back button and the close button behave the same.
  dismiss() {
    if (this.busy || !this.isOpen) return
    if (this.pushed) {
      this.pushed = false
      history.back()
    } else {
      history.replaceState(null, '', this.home)
      this.close()
    }
  }

  async close() {
    if (!this.isOpen || this.busy) return
    this.busy = true
    const book = this.book
    const spine = this.bookcase.spineOf(book.id)
    const visible = spine && !spine.closest('.is-hidden') && this.inView(spine)
    this.el.classList.add('is-closing')

    if (visible && !reduceMotion.matches) {
      this.stopLoop()
      const flight = this.flightFrom(spine)
      const current = this.body.style.transform
      const home = 90 + 360 * Math.round((this.pose.ry - 90) / 360)
      const opts = { duration: 820, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' }
      const a = this.holder.animate([{ transform: 'none' }, { transform: flight.lift, offset: 0.74 }, { transform: flight.start }], opts)
      this.body.animate(
        [{ transform: current }, { transform: `rotateX(0deg) rotateY(${home - 3}deg)`, offset: 0.74 }, { transform: `rotateX(0deg) rotateY(${home}deg)` }],
        opts,
      )
      this.floor.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })
      await a.finished.catch(() => {})
    } else {
      await this.holder.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(16px) scale(.96)' }], {
        duration: reduceMotion.matches ? 1 : 260,
        fill: 'forwards',
      }).finished.catch(() => {})
      this.stopLoop()
    }

    spine?.classList.remove('is-out')
    this.el.hidden = true
    this.el.classList.remove('is-open', 'is-closing')
    this.holder.getAnimations().forEach((a) => a.cancel())
    this.holder.innerHTML = ''
    this.floor.getAnimations().forEach((a) => a.cancel())
    document.documentElement.classList.remove('is-locked')
    ;(visible ? spine : this.returnFocus)?.focus?.({ preventScroll: true })
    this.book = null
    this.busy = false
  }

  async go(delta) {
    const order = this.bookcase.order
    if (!this.book || order.length < 2) return
    const i = order.indexOf(this.book)
    const next = order[(i + delta + order.length) % order.length]
    await this.swap(next, delta)
  }

  async swap(book, delta) {
    if (this.busy || book === this.book) return
    this.busy = true
    const dir = delta || 1
    const quick = reduceMotion.matches ? 1 : 230
    await Promise.all([
      this.holder.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * 90}px) scale(.92)` }], {
        duration: quick,
        easing: 'cubic-bezier(.5,0,.75,0)',
        fill: 'forwards',
      }).finished,
      this.info.animate([{ opacity: 1 }, { opacity: 0, transform: `translateX(${-dir * 16}px)` }], { duration: quick, fill: 'forwards' }).finished,
    ]).catch(() => {})
    this.book = book
    history.replaceState({ book: book.id }, '', `/book/${book.id}`)
    this.onChange?.(book)
    this.build(book)
    this.renderInfo(book)
    this.resetPose()
    this.el.querySelector('.info__actions .btn')?.focus({ preventScroll: true })
    this.holder.getAnimations().forEach((a) => a.cancel())
    this.info.getAnimations().forEach((a) => a.cancel())
    const slow = reduceMotion.matches ? 1 : 420
    this.holder.animate([{ opacity: 0, transform: `translateX(${dir * 90}px) scale(.92)` }, { opacity: 1, transform: 'none' }], {
      duration: slow,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    })
    await this.info.animate([{ opacity: 0, transform: `translateX(${dir * 16}px)` }, { opacity: 1, transform: 'none' }], {
      duration: slow,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    }).finished.catch(() => {})
    this.busy = false
  }

  // Size the 3D book to the stage and build its six faces.
  build(book) {
    const box = this.stage.getBoundingClientRect()
    const H = Math.round(Math.min(box.height * 0.74, (box.width * 0.62) / book.aspect, 470))
    const W = Math.round(H * book.aspect)
    const D = Math.max(10, Math.round((H * book.t) / book.h))
    this.dims = { W, H, D }
    this.holder.style.cssText = `width:${W}px;height:${H}px;perspective:${PERSPECTIVE}px`
    this.floor.style.width = `${W * 1.5}px`
    this.floor.style.top = `calc(50% + ${H / 2 + 10}px)`
    this.holder.innerHTML = `
      <div class="book3d__body" style="--W:${W}px;--H:${H}px;--D:${D}px;${bookVars(book)}">
        <div class="face face--front">${frontHTML(book)}<span class="face__hinge"></span><span class="face__sheen"></span></div>
        <div class="face face--back">${backHTML(book)}</div>
        <div class="face face--spine">
          <div class="spine spine--${book.style} font-${book.font}" style="${bookVars(book)};--s:${H / book.h}">${spineHTML(book)}</div>
        </div>
        <div class="face face--edge"></div>
        <div class="face face--top"></div>
        <div class="face face--bottom"></div>
      </div>`
    this.body = this.holder.firstElementChild
  }

  // Transforms that put the 3D book exactly over its spine on the shelf.
  flightFrom(spine) {
    this.holder.style.transform = 'none'
    const r = spine.getBoundingClientRect()
    const c = this.holder.getBoundingClientRect()
    const { W, H } = this.dims
    // The spine face sits W/2 nearer the camera, so perspective enlarges it.
    const magnify = PERSPECTIVE / (PERSPECTIVE - W / 2)
    const scale = r.height / H / magnify
    const dx = r.left + r.width / 2 - (c.left + c.width / 2)
    const dy = r.top + r.height / 2 - (c.top + c.height / 2)
    return {
      start: `translate(${dx}px, ${dy}px) scale(${scale})`,
      lift: `translate(${dx}px, ${dy - 26 - r.height * 0.06}px) scale(${scale * 1.14})`,
    }
  }

  renderInfo(book) {
    const reader = readerList.find((r) => r.name === book.owner)
    const meta = [book.year, book.pages && `${book.pages} pages`].filter(Boolean)
    this.info.innerHTML = `
      <p class="info__meta">
        <span class="info__genre" style="--dot:${genreColour(book.genre)}">${escape(book.genre)}</span>
        ${meta.map((m) => `<span>${escape(m)}</span>`).join('')}
      </p>
      <h2 id="viewer-title" class="info__title">${escape(book.title)}</h2>
      <p class="info__author">${escape(book.author)}</p>
      ${book.blurb ? `<p class="info__blurb">${escape(book.blurb)}</p>` : ''}
      ${book.note ? `<blockquote class="info__note">“${escape(book.note)}”<cite>${escape(book.owner)}</cite></blockquote>` : ''}
      <div class="info__owner">
        <span class="avatar" style="--hue:${reader?.hue ?? 30}">${escape(book.owner[0])}</span>
        <div>
          <span class="info__label">${book.sample ? 'Sample on the shelf of' : 'On the shelf of'}</span>
          <a class="info__shelf" href="/shelf/${escape(reader?.slug ?? '')}">${escape(book.owner)}</a>
        </div>
        ${
          book.onLoanTo
            ? `<span class="info__loan${book.overdue ? ' is-overdue' : ''}">With ${escape(book.onLoanTo)} right now</span>`
            : book.onLoan
              ? '<span class="info__loan">Out on loan right now</span>'
              : ''
        }
      </div>
      ${this.actionsHTML(book)}
      ${book.olKey ? `<a class="info__more" href="https://openlibrary.org${escape(book.olKey)}" target="_blank" rel="noopener">More on Open Library <span aria-hidden="true">↗</span></a>` : ''}
      <p class="info__keys" aria-hidden="true"><kbd>←</kbd><kbd>→</kbd> browse <kbd>F</kbd> flip <kbd>Esc</kbd> close</p>`
  }

  // What a reader can do with this book depends on who they are: a visitor,
  // its owner, someone who has it or has asked for it, or any other member.
  actionsHTML(book) {
    const link = `<button class="btn btn--ghost btn--icon" type="button" data-link aria-label="Copy a link to this book" title="Copy link">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 11.5a3.5 3.5 0 005 0l2.5-2.5a3.5 3.5 0 00-5-5l-1 1M11.5 8.5a3.5 3.5 0 00-5 0L4 11a3.5 3.5 0 005 5l1-1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
        </button>`
    const button = (label, attrs, kind = 'primary') => `<button class="btn btn--${kind}" type="button" ${attrs}>${escape(label)}</button>`
    const actions = (...items) => `<div class="info__actions">${items.join('')}${link}</div>`
    const note = (text, extra = '') => `<p class="info__status${extra}">${text}</p>`
    const owner = escape(book.owner)

    if (book.sample) {
      return note(`A placeholder while ${owner} adds their real books, so there’s nothing to borrow here yet.`, ' info__status--sample') + actions()
    }
    if (!session.member) {
      const label = book.onLoan ? `Ask ${book.owner} about it` : `Ask ${book.owner} to bring it`
      return (
        (this.gotMode ? note(`Borrowing this from ${owner}? <a href="/me">Sign in with your link</a> to mark it as borrowed.`, ' info__status--got') : '') +
        actions(`<button class="btn btn--primary" type="button" data-ask>${ICON_ASK}${escape(label)}</button>`)
      )
    }
    if (mine(book)) {
      const out = lentOut(book)
      return out
        ? note(`This one’s yours. It’s with ${escape(out.borrower)} since ${shortDate(out.since)}.`) +
            actions(button('It’s back with me', `data-loan-action="return" data-loan="${out.id}"`))
        : note('This one’s yours.') + actions(`<a class="btn btn--ghost" href="/me">Manage on My shelf</a>`)
    }
    const have = borrowedByMe(book)
    if (have) {
      return note(`You’ve had this since ${shortDate(have.since)}.`) + actions(button('I’ve given it back', `data-loan-action="return" data-loan="${have.id}"`))
    }
    const asked = askedFor(book)
    const got = this.gotMode && !book.onLoan
      ? note(`Borrowing this from ${owner}?`, ' info__status--got') + `<div class="info__actions">${button('Yes, I’ve got it', 'data-got')}</div>`
      : ''
    if (asked) {
      return (
        got +
        note(`You’ve asked ${owner} for it${asked.meetup ? ` for ${escape(meetupPhrase(meetups.find((m) => m.date === asked.meetup) ?? { date: asked.meetup, venue: 'the meetup' }))}` : ''}.`) +
        actions(button(`Message ${book.owner}`, 'data-ask', 'ghost'), button('Cancel request', `data-loan-action="cancel" data-loan="${asked.id}"`, 'ghost'))
      )
    }
    return (
      got +
      actions(
        `<button class="btn btn--primary" type="button" data-request>${ICON_ASK}${escape(book.onLoan ? 'Ask to be next' : `Ask ${book.owner} to bring it`)}</button>`,
        this.gotMode || book.onLoan ? '' : button('I’ve got it', 'data-got', 'ghost'),
      )
    )
  }

  refresh() {
    if (this.isOpen && this.book) this.renderInfo(this.book)
  }

  async request() {
    const b = this.book
    try {
      await lend('request', { book: b.id })
      this.refresh()
      track('borrow_request')
      await this.ask({ sent: true })
    } catch (err) {
      this.toast(err.message)
    }
  }

  async gotIt() {
    try {
      const { owner } = await lend('got', { book: this.book.id })
      this.gotMode = false
      this.refresh()
      track('borrow_got')
      this.toast(`Enjoy it! ${owner} can see it’s with you.`)
    } catch (err) {
      this.toast(err.message)
    }
  }

  async loanAction(button) {
    try {
      await lend(button.dataset.loanAction, { loan: Number(button.dataset.loan) })
      this.refresh()
      this.toast({ return: 'Marked as returned.', cancel: 'Request cancelled.' }[button.dataset.loanAction] ?? 'Done.')
    } catch (err) {
      this.toast(err.message)
    }
  }

  link(book) {
    return `${location.origin}/book/${book.id}`
  }

  // The message to the owner names the actual meetup, and goes through the
  // phone's share sheet (WhatsApp and the rest) or onto the clipboard.
  async ask({ sent = false } = {}) {
    const b = this.book
    const when = meetupPhrase(nextMeetup())
    const text = b.onLoan
      ? `Hi ${b.owner}! I’d love to borrow “${b.title}” when it’s back. Could you bring it to a meetup after that? 📚`
      : `Hi ${b.owner}! Could you bring “${b.title}” by ${b.author} to ${when}? 📚`
    const full = `${text}\n${this.link(b)}`
    if (!sent) track('ask_click')
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ text: full })
        return
      } catch (err) {
        if (err.name === 'AbortError') return
      }
    }
    const copied = await copy(full)
    if (sent) this.toast(copied ? `Asked! ${b.owner} will see it on their shelf. A message is copied too, for the group.` : full)
    else this.toast(copied ? 'Message copied. Paste it in the club group.' : full)
  }

  async copyLink() {
    this.toast((await copy(this.link(this.book))) ? 'Link copied.' : this.link(this.book))
  }

  flip() {
    const p = this.pose
    p.target = REST_Y + 180 * Math.round((p.ry - REST_Y) / 180) + 180
  }

  key(e) {
    if (e.key === 'Escape') this.dismiss()
    else if (e.key === 'ArrowRight') this.go(1)
    else if (e.key === 'ArrowLeft') this.go(-1)
    else if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) this.flip()
    else if (e.key === 'Tab') {
      const items = [...this.el.querySelectorAll('button, a[href]')].filter((n) => n.offsetParent)
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  // Pose: a spring pulls the book back to rest (front or back) after a drag,
  // the pointer adds a gentle tilt, and it floats a little while idle.
  resetPose() {
    Object.assign(this.pose, { ry: REST_Y, vy: 0, target: REST_Y, tx: 0, ty: 0, drag: null })
  }

  startLoop() {
    cancelAnimationFrame(this.raf)
    const p = this.pose
    // The float fades in once the book has landed, so it starts from rest.
    const floatFrom = performance.now() + 900
    const tick = (now) => {
      if (!p.drag) {
        p.vy += (p.target - p.ry) * 0.055
        p.vy *= 0.8
        p.ry += p.vy
      }
      p.tx += (p.py * -9 - p.tx) * 0.07
      p.ty += (p.px * 12 - p.ty) * 0.07
      const amp = reduceMotion.matches ? 0 : Math.min(1, Math.max(0, (now - floatFrom) / 1400))
      const bob = Math.sin((now - floatFrom) / 950) * 5 * amp
      const ry = p.ry + p.ty
      // Written every frame; a running flight animation simply overrides it.
      this.body.style.transform = `translateY(${bob.toFixed(2)}px) rotateX(${(REST_X + p.tx).toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
      this.body.style.setProperty('--sheen', `${50 - Math.sin((ry * Math.PI) / 180) * 70}%`)
      this.floor.style.transform = `translateX(-50%) scale(${(1 - bob / 60).toFixed(3)})`
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stopLoop() {
    cancelAnimationFrame(this.raf)
  }

  pointer(e) {
    const p = this.pose
    if (p.drag && e.pointerId === p.drag.id) {
      const ry = p.drag.ry + (e.clientX - p.drag.x) * 0.55
      p.vy = ry - p.ry
      p.ry = ry
      p.drag.moved = p.drag.moved || Math.abs(e.clientX - p.drag.x) > 4
      return
    }
    if (e.pointerType !== 'mouse') return
    const r = this.stage.getBoundingClientRect()
    p.px = ((e.clientX - r.left) / r.width - 0.5) * 2
    p.py = ((e.clientY - r.top) / r.height - 0.5) * 2
  }

  dragStart(e) {
    if (e.button !== 0 || this.busy || e.target.closest('button')) return
    this.stage.setPointerCapture(e.pointerId)
    this.pose.drag = { id: e.pointerId, x: e.clientX, ry: this.pose.ry, moved: false }
    this.stage.classList.add('is-dragging')
  }

  dragEnd(e) {
    const p = this.pose
    if (!p.drag || e.pointerId !== p.drag.id) return
    const projected = p.ry + p.vy * 9
    p.target = REST_Y + 180 * Math.round((projected - REST_Y) / 180)
    p.drag = null
    this.stage.classList.remove('is-dragging')
  }

  inView(el) {
    const r = el.getBoundingClientRect()
    return r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text })
    area.style.cssText = 'position:fixed;opacity:0'
    document.body.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}
