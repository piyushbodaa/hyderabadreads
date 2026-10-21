// The bookcase: lays every book out on shelves, groups them under brass labels,
// and glides them to their new places whenever the arrangement or filter changes.
// Books are absolutely positioned with transforms, so every move is a GPU
// transition rather than a reflow.

import { books, readerList, genreColour, hash, fitSpines, SPINE_FONTS, MAX_SPINE_HEIGHT } from './model.js'
import { GENRES } from '../data/library.js'
import { bookVars, spineHTML, escape } from './render.js'
import { DECOR } from './decor.js'

const HEADROOM = 34
const PLANK = 24
const PAD = 22
const GAP = 2
const GROUP_GAP = 40
const LABEL_FONT = '600 10px "Inter Variable", system-ui, sans-serif'

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')

export class Bookcase {
  constructor(root, { tip, onOpen, onLayout }) {
    this.root = root
    this.tip = tip
    this.onOpen = onOpen
    this.onLayout = onLayout
    this.arrange = 'reader'
    this.filter = () => true
    this.order = []
    this.rows = []
    this.els = new Map()
    this.labels = new Map()
    this.shelves = []
    this.decor = []
    this.measure = document.createElement('canvas').getContext('2d')

    const frag = document.createDocumentFragment()
    for (const book of books) {
      const wrap = document.createElement('div')
      wrap.className = 'book'
      wrap.setAttribute('role', 'listitem')
      const spine = document.createElement('button')
      spine.type = 'button'
      spine.className = `spine spine--${book.style} font-${book.font}`
      spine.style.cssText = bookVars(book)
      spine.dataset.id = book.id
      spine.setAttribute('aria-label', `${book.title} by ${book.author}, from ${book.owner}’s shelf${book.onLoanTo ? `, on loan to ${book.onLoanTo}` : ''}`)
      spine.innerHTML = spineHTML(book)
      wrap.append(spine)
      frag.append(wrap)
      this.els.set(book.id, { book, wrap, spine })
    }
    root.append(frag)
    root.classList.add('is-static', 'is-waiting')

    root.addEventListener('click', (e) => {
      const spine = e.target.closest('.spine')
      if (spine) this.onOpen(this.els.get(spine.dataset.id).book, spine)
    })
    root.addEventListener('pointerover', (e) => this.hover(e))
    root.addEventListener('pointerleave', () => this.hover(null))
    root.addEventListener('focusin', (e) => this.hover(e))
    root.addEventListener('focusout', () => this.hover(null))

    let width = root.clientWidth
    let timer
    new ResizeObserver(() => {
      if (root.clientWidth === width) return
      width = root.clientWidth
      root.classList.add('is-static')
      this.layout()
      clearTimeout(timer)
      timer = setTimeout(() => root.classList.remove('is-static'), 120)
    }).observe(root)

    Promise.all(SPINE_FONTS.map((f) => document.fonts.load(f)))
      .catch(() => {})
      .then(() => {
        fitSpines()
        for (const { book, spine } of this.els.values()) {
          spine.style.setProperty('--fs', book.fs)
          spine.style.setProperty('--afs', book.afs)
        }
        this.layout()
      })
    this.layout()
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-static')))
  }

  setArrange(mode) {
    if (mode === this.arrange) return
    this.arrange = mode
    this.layout({ cascade: true })
  }

  setFilter(fn) {
    this.filter = fn
    this.layout({ cascade: true })
  }

  spineOf(id) {
    return this.els.get(id)?.spine
  }

  // Drop every visible book onto its shelf, left to right, top to bottom.
  enter() {
    this.root.classList.remove('is-waiting')
    if (reduceMotion.matches) return
    this.order.forEach((book, i) => {
      this.els.get(book.id).spine.animate(
        [
          { transform: 'translateY(-46px) rotate(-4deg)', opacity: 0 },
          { transform: 'translateY(3px) rotate(0.4deg)', opacity: 1, offset: 0.72 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 760, delay: Math.min(i * 22, 1100), easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' },
      )
    })
  }

  groups() {
    const visible = books.filter(this.filter)
    const by = (keyOf) => {
      const map = new Map()
      for (const b of visible) {
        const k = keyOf(b)
        if (!map.has(k)) map.set(k, [])
        map.get(k).push(b)
      }
      return map
    }

    // Writers are shelved like a library: A to Z by surname, a letter per section.
    if (this.arrange === 'writer') {
      const sorted = [...visible].sort((a, b) => a.surname.localeCompare(b.surname, 'en', { sensitivity: 'base' }) || a.title.localeCompare(b.title))
      const map = new Map()
      for (const b of sorted) {
        const letter = b.surname.normalize('NFKD')[0].toUpperCase()
        if (!map.has(letter)) map.set(letter, [])
        map.get(letter).push(b)
      }
      return [...map].map(([letter, list]) => ({ key: letter, label: letter, colour: '#d9b46a', books: list }))
    }

    // Biggest language first, so English leads and the rest follow.
    if (this.arrange === 'language') {
      const map = by((b) => b.language)
      return [...map.keys()]
        .sort((a, b) => map.get(b).length - map.get(a).length || a.localeCompare(b))
        .map((l) => ({ key: l, label: l, colour: `hsl(${hash(l) % 360} 45% 62%)`, books: map.get(l) }))
    }

    if (this.arrange === 'genre') {
      const known = Object.keys(GENRES)
      const map = by((b) => b.genre)
      return [...map.keys()]
        .sort((a, b) => (known.indexOf(a) + 1 || 99) - (known.indexOf(b) + 1 || 99) || a.localeCompare(b))
        .map((g) => ({ key: g, label: g, colour: genreColour(g), books: map.get(g) }))
    }

    return readerList
      .map((r) => ({ key: r.name, label: r.name, colour: `hsl(${r.hue} 55% 70%)`, books: r.books.filter(this.filter) }))
      .filter((g) => g.books.length)
  }

  layout({ cascade = false } = {}) {
    const width = this.root.clientWidth
    const phone = width < 520
    const pad = phone ? 12 : PAD
    // A phone shelf holds about 580 units of spine, so two members' shelves of
    // five books sit side by side instead of one per row.
    const s = phone ? Math.min(0.74, (width - pad * 2) / 580) : width < 900 ? 0.86 : 1
    const gap = GROUP_GAP * s
    const rowH = (HEADROOM + MAX_SPINE_HEIGHT + PLANK) * s
    const plankTop = (HEADROOM + MAX_SPINE_HEIGHT) * s
    const right = width - pad
    this.root.style.setProperty('--s', s)
    this.root.style.setProperty('--plank', `${PLANK * s}px`)

    const placed = []
    const labels = []
    const rowEnds = []
    let row = 0
    let x = pad

    for (const group of this.groups()) {
      const widths = group.books.map((b) => b.t * s)
      const booksW = widths.reduce((sum, w) => sum + w + GAP, -GAP)
      const labelW = group.label ? this.labelWidth(group) : 0
      const slotW = Math.max(booksW, labelW)
      if (x > pad && x + Math.min(slotW, right - pad) > right) {
        rowEnds[row++] = x - gap
        x = pad
      }
      const label = group.label && { group, x, row, w: Math.min(slotW, right - x) }
      let bx = x + Math.max(0, (Math.min(slotW, right - x) - booksW) / 2)
      group.books.forEach((book, i) => {
        if (bx + widths[i] > right) {
          rowEnds[row++] = bx
          bx = pad
        }
        placed.push({ book, x: bx, row })
        bx += widths[i] + GAP
      })
      if (label) labels.push(label)
      x = Math.max(bx - GAP, label && label.row === row ? label.x + label.w : 0) + gap
    }
    rowEnds[row] = x - gap
    const rows = placed.length ? row + 1 : 0

    // Books
    const visible = new Set()
    this.order = []
    this.rows = []
    placed.forEach(({ book, x: bx, row: r }, i) => {
      const { wrap } = this.els.get(book.id)
      const y = r * rowH + plankTop - book.h * s
      wrap.style.transform = `translate3d(${bx.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      wrap.style.transitionDelay = cascade && !reduceMotion.matches ? `${Math.min(i * 9, 360)}ms` : '0ms'
      wrap.classList.remove('is-hidden')
      visible.add(book.id)
      this.order.push(book)
      this.rows.push(r)
    })
    for (const [id, { wrap }] of this.els) {
      if (!visible.has(id)) {
        wrap.classList.add('is-hidden')
        wrap.style.transitionDelay = '0ms'
      }
    }

    // Shelves (back-wall light + plank), one per row
    while (this.shelves.length < rows) {
      const shelf = document.createElement('div')
      shelf.className = 'shelf'
      shelf.innerHTML = '<span class="shelf__plank"></span>'
      this.root.prepend(shelf)
      this.shelves.push(shelf)
    }
    this.shelves.forEach((shelf, r) => {
      shelf.style.transform = `translateY(${r * rowH}px)`
      shelf.style.height = `${rowH}px`
      shelf.classList.toggle('is-gone', r >= rows)
    })

    // Brass labels on the plank front
    const seen = new Set()
    for (const { group, x: lx, row: r, w } of labels) {
      const key = `${this.arrange}:${group.key}`
      seen.add(key)
      let el = this.labels.get(key)
      if (!el) {
        el = document.createElement('div')
        el.className = 'plate is-new'
        el.innerHTML = `<span class="plate__dot"></span><span class="plate__text">${escape(group.label.toUpperCase())}</span>`
        this.root.append(el)
        this.labels.set(key, el)
        requestAnimationFrame(() => el.classList.remove('is-new'))
      }
      el.style.setProperty('--dot', group.colour)
      el.style.transform = `translate3d(${lx + w / 2}px, ${r * rowH + plankTop + (PLANK * s - 17) / 2}px, 0) translateX(-50%)`
      el.classList.remove('is-gone')
    }
    for (const [key, el] of this.labels) if (!seen.has(key)) el.classList.add('is-gone')

    // Ornaments in the leftover space at the end of a row
    this.decor.forEach((d) => d.remove())
    this.decor = []
    rowEnds.slice(0, rows).forEach((end, r) => {
      const space = right - end - 18
      const item = DECOR[(r + ['reader', 'genre', 'language', 'writer'].indexOf(this.arrange)) % DECOR.length]
      if (space < (item.w + 28) * s) return
      const el = document.createElement('div')
      el.className = `decor decor--${item.name}`
      el.innerHTML = item.svg
      el.style.width = `${item.w * s}px`
      el.style.height = `${item.h * s}px`
      const dx = end + Math.min(space - item.w * s, 26 + ((r * 37) % Math.max(1, space - item.w * s - 26)))
      el.style.transform = `translate3d(${dx}px, ${r * rowH + plankTop - item.h * s}px, 0)`
      this.root.append(el)
      this.decor.push(el)
    })

    this.root.style.height = `${Math.max(rows, 1) * rowH}px`
    this.onLayout?.(this.order.length)
  }

  labelWidth(group) {
    this.measure.font = LABEL_FONT
    const text = group.label.toUpperCase()
    return Math.ceil(this.measure.measureText(text).width + text.length * 1.4 + 34)
  }

  hover(e) {
    this.root.querySelectorAll('.lean-l, .lean-r').forEach((el) => el.classList.remove('lean-l', 'lean-r'))
    const spine = e?.target?.closest?.('.spine')
    if (!spine || (e.pointerType && e.pointerType !== 'mouse')) {
      this.tip.classList.remove('is-on')
      return
    }
    const { book, wrap } = this.els.get(spine.dataset.id)
    const i = this.order.indexOf(book)
    const prev = this.order[i - 1]
    const next = this.order[i + 1]
    if (prev && this.rows[i - 1] === this.rows[i]) this.els.get(prev.id).wrap.classList.add('lean-l')
    if (next && this.rows[i + 1] === this.rows[i]) this.els.get(next.id).wrap.classList.add('lean-r')

    const s = parseFloat(this.root.style.getPropertyValue('--s')) || 1
    const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(wrap.style.transform)
    if (!m) return
    this.tip.innerHTML = `<strong>${escape(book.title)}</strong><span>${escape(book.author)} · ${escape(book.owner)}’s shelf</span>`
    const tipW = this.tip.offsetWidth
    const cx = parseFloat(m[1]) + (book.t * s) / 2
    const left = Math.min(Math.max(cx - tipW / 2, 8), this.root.clientWidth - tipW - 8)
    this.tip.style.transform = `translate3d(${left}px, ${parseFloat(m[2]) - 18}px, 0) translateY(-100%)`
    this.tip.style.setProperty('--arrow', `${cx - left}px`)
    this.tip.classList.add('is-on')
  }
}
