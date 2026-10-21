// The weekly digest as a WhatsApp message (*bold* is WhatsApp's bold).

const day = (iso, opts) => new Date(`${iso}T00:00`).toLocaleDateString('en-GB', opts)

export function compose(data, origin) {
  const lines = ['📚 *Hyderabad Reads this week*']
  if (data.newBooks.length) {
    lines.push('', '*New on the shelves*', ...data.newBooks.map((b) => `• ${b.title} by ${b.author} (${b.owner}’s)`))
  }
  if (data.meetups.length) {
    lines.push(
      '',
      '*Next meetups*',
      ...data.meetups.map((m) => `• ${day(m.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${m.venue}${m.area ? `, ${m.area}` : ''} · ${m.time}`),
    )
  }
  if (data.openRequests) {
    lines.push('', `*Asked for:* ${data.openRequests === 1 ? 'a book is' : `${data.openRequests} books are`} waiting to be brought to a meetup. Owners, your bring list is on My shelf: ${origin}/me`)
  }
  if (data.overdue.length) {
    lines.push(
      '',
      `*Back soon, please* (out ${data.overdueWeeks}+ weeks)`,
      ...data.overdue.map((l) => `• ${l.title} (${l.owner}’s), with ${l.borrower} since ${day(l.since, { day: 'numeric', month: 'short' })}`),
    )
  }
  if (lines.length === 1) lines.push('', 'A quiet week on the shelves.')
  lines.push('', `Browse the library: ${origin}`)
  return lines.join('\n')
}
