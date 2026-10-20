// Dust motes drifting through lamplight behind the hero. Pauses off-screen.

export function startDust(canvas) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const ctx = canvas.getContext('2d')
  const motes = []
  let w = 0
  let h = 0
  let raf = 0
  let visible = true

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const count = Math.round(Math.min(70, (w * h) / 16000))
    motes.length = 0
    for (let i = 0; i < count; i++) motes.push(spawn(true))
  }

  const spawn = (anywhere) => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 10,
    r: 0.4 + Math.random() * 1.6,
    vx: (Math.random() - 0.5) * 0.12,
    vy: -(0.05 + Math.random() * 0.18),
    phase: Math.random() * Math.PI * 2,
    a: 0.15 + Math.random() * 0.5,
  })

  const frame = (now) => {
    ctx.clearRect(0, 0, w, h)
    const lampX = w * 0.78
    const lampY = h * 0.1
    for (const m of motes) {
      m.x += m.vx + Math.sin(now / 2400 + m.phase) * 0.08
      m.y += m.vy
      if (m.y < -10 || m.x < -10 || m.x > w + 10) Object.assign(m, spawn(false))
      // Brighter inside the lamp's pool of light.
      const d = Math.hypot(m.x - lampX, (m.y - lampY) * 0.8) / Math.max(w, h)
      const glow = Math.max(0.12, 1 - d * 1.6)
      ctx.globalAlpha = m.a * glow * (0.75 + Math.sin(now / 900 + m.phase) * 0.25)
      ctx.fillStyle = '#ffdca8'
      ctx.beginPath()
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
      ctx.fill()
    }
    raf = visible ? requestAnimationFrame(frame) : 0
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible && !raf) raf = requestAnimationFrame(frame)
  }).observe(canvas)
  new ResizeObserver(resize).observe(canvas)
  resize()
}
