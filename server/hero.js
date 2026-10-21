// The parts of the hero that depend on the data, rendered on the server so the
// page doesn't shift when the scripts run: the next meetup (or today's), the
// numbers, and the note about sample shelves.
import { esc } from './html.js'
import { mapsLink } from '../src/lib/calendar-links.js'

export function heroHTML(data, today) {
  const next = data.meetups.filter((m) => m.date >= today && !m.cancelled).sort((a, b) => a.date.localeCompare(b.date))[0]
  let line = ''
  if (next) {
    const where = `${esc(next.venue)}${next.area ? `, ${esc(next.area)}` : ''}`
    if (next.date === today) {
      line = `<p class="hero__next is-today" data-hero-next><span class="hero__pulse" aria-hidden="true"></span><strong>Today</strong>, ${esc(next.time)} at <strong>${esc(next.venue)}</strong>${next.area ? `, ${esc(next.area)}` : ''} · <a href="${esc(mapsLink(next))}" target="_blank" rel="noopener">Directions</a></p>`
    } else {
      const when = new Date(`${next.date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
      line = `<p class="hero__next" data-hero-next>Next meetup · <strong>${when}</strong> · ${where} · ${esc(next.time)} · <a href="#calendar">Calendar</a><span data-newcomer> · <a href="#first-meetup">New here?</a></span></p>`
    }
  }

  const books = data.books.length
  const samples = data.books.filter((b) => b.sample).length
  const genres = new Set(data.books.map((b) => b.genre || 'Other')).size
  const pages = data.books.reduce((sum, b) => sum + (b.pages ?? 0), 0)
  const stats = [
    ['Books', books],
    ['Readers', data.members.length],
    ['Genres', genres],
    ['Pages to share', pages],
  ]
    .map(([label, value]) => {
      const shown = value.toLocaleString('en-IN')
      // The width is held for the final number, so counting up doesn't move anything.
      return `<div><dt>${label}</dt><dd data-to="${value}" style="min-width:${shown.length}ch">${shown}</dd></div>`
    })
    .join('')
  const note = samples
    ? `<p class="stats__note">${
        samples === books
          ? 'Every shelf is a sample for now: placeholder books until members add their own.'
          : samples === 1
            ? 'One of these is a sample book, standing in until its owner adds real ones.'
            : `${samples} of these are sample books, standing in until their owners add real ones.`
      }</p>`
    : ''
  return `${line}<dl class="stats" data-stats>${stats}</dl>${note}`
}
