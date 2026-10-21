// The books floating in the hero: real 3D books, with the same faces as the
// one that opens (cover, spine, back, page edges). Drag one to turn it over,
// as in the viewer, and it settles front or back. The cursor tilts it a
// little, and a click opens it.
import { bookVars, frontHTML, backHTML, spineHTML, escape } from './render.js'

const REST_X = 4
const REST_Y = 16

// A hero book's width, as in the CSS for .hero-book: clamp(118px, 10.5vw, 162px).
const bookWidth = () => Math.round(Math.min(162, Math.max(118, innerWidth * 0.105)))

export function heroBookcase(container, picks, slots, { onOpen }) {
  container.innerHTML = picks
    .map((b, i) => {
      const s = slots[i]
      return `
      <div class="hero-book" style="--x:${s.x}%;--y:${s.y}%;--r:${s.r}deg;--z:${s.z};--depth:${s.depth};--i:${i}">
        <div class="hero-book__float">
          <div class="book3d__body" style="${bookVars(b)}">
            <div class="face face--front">${frontHTML(b)}<span class="face__hinge"></span><span class="face__sheen"></span></div>
            <div class="face face--back">${backHTML(b)}</div>
            <div class="face face--spine"><div class="spine spine--${b.style} font-${b.font}" style="${bookVars(b)}">${spineHTML(b)}</div></div>
            <div class="face face--edge"></div>
            <div class="face face--top"></div>
            <div class="face face--bottom"></div>
          </div>
        </div>
        <button type="button" class="hero-book__open" aria-label="${escape(`${b.title} by ${b.author}, from ${b.owner}’s shelf`)}"></button>
      </div>`
    })
    .join('')

  const poses = [...container.querySelectorAll('.hero-book')].map((el, i) => ({
    el,
    book: picks[i],
    body: el.querySelector('.book3d__body'),
    spine: el.querySelector('.face--spine .spine'),
    ry: REST_Y,
    vy: 0,
    target: REST_Y,
    tx: 0,
    ty: 0,
    px: 0,
    py: 0,
    drag: null,
    dragged: false,
  }))

  // Each book's size and thickness, from its cover and its spine.
  function size() {
    const W = bookWidth()
    for (const p of poses) {
      const H = Math.round(W / p.book.aspect)
      p.el.style.setProperty('--W', `${W}px`)
      p.el.style.setProperty('--H', `${H}px`)
      p.el.style.setProperty('--D', `${Math.max(8, Math.round((H * p.book.t) / p.book.h))}px`)
      p.spine.style.setProperty('--s', (H / p.book.h).toFixed(4))
    }
  }
  size()
  let resizing
  addEventListener('resize', () => {
    clearTimeout(resizing)
    resizing = setTimeout(size, 150)
  })

  // As in the viewer: a spring pulls a book back to rest, front or back, after
  // a drag, and the cursor adds a gentle tilt. The loop sleeps once all is still.
  let raf = 0
  const still = (p) =>
    !p.drag && Math.abs(p.target - p.ry) < 0.05 && Math.abs(p.vy) < 0.05 && Math.abs(p.py * -10 - p.tx) < 0.05 && Math.abs(p.px * 14 - p.ty) < 0.05
  function tick() {
    for (const p of poses) {
      if (!p.drag) {
        p.vy += (p.target - p.ry) * 0.055
        p.vy *= 0.8
        p.ry += p.vy
      }
      p.tx += (p.py * -10 - p.tx) * 0.08
      p.ty += (p.px * 14 - p.ty) * 0.08
      const ry = p.ry + p.ty
      p.body.style.transform = `rotateX(${(REST_X + p.tx).toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
      p.body.style.setProperty('--sheen', `${(50 - Math.sin((ry * Math.PI) / 180) * 70).toFixed(1)}%`)
    }
    raf = poses.every(still) ? 0 : requestAnimationFrame(tick)
  }
  const wake = () => {
    raf ||= requestAnimationFrame(tick)
  }
  wake()

  for (const p of poses) {
    p.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      p.el.setPointerCapture(e.pointerId)
      p.drag = { id: e.pointerId, x: e.clientX, ry: p.ry, moved: false }
      wake()
    })
    p.el.addEventListener('pointermove', (e) => {
      if (p.drag && e.pointerId === p.drag.id) {
        const ry = p.drag.ry + (e.clientX - p.drag.x) * 0.55
        p.vy = ry - p.ry
        p.ry = ry
        if (!p.drag.moved && Math.abs(e.clientX - p.drag.x) > 4) {
          p.drag.moved = true
          p.el.classList.add('is-dragging')
        }
      } else if (e.pointerType === 'mouse') {
        const r = p.el.getBoundingClientRect()
        p.px = ((e.clientX - r.left) / r.width - 0.5) * 2
        p.py = ((e.clientY - r.top) / r.height - 0.5) * 2
      }
      wake()
    })
    const end = (e) => {
      if (!p.drag || e.pointerId !== p.drag.id) return
      const projected = p.ry + p.vy * 9
      p.target = REST_Y + 180 * Math.round((projected - REST_Y) / 180)
      p.dragged = p.drag.moved
      p.drag = null
      p.el.classList.remove('is-dragging')
      wake()
    }
    p.el.addEventListener('pointerup', end)
    p.el.addEventListener('pointercancel', end)
    p.el.addEventListener('pointerleave', () => {
      p.px = 0
      p.py = 0
      wake()
    })
    // A drag captures the pointer, so its click lands here, not on the button.
    // The click that ends a turn doesn't open the book; Enter on the button does.
    p.el.addEventListener('click', () => {
      if (p.dragged) p.dragged = false
      else onOpen(p.book)
    })
  }
}
