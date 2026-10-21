// The library and calendar as plain files: llms.txt (a summary for AI
// assistants, see llmstxt.org), llms-full.txt (every book and meetup in
// Markdown), library.json, sitemap.xml, and meetups.ics for calendar apps.
import { SITE, NAME, ABOUT, GITHUB, MEETUP_FORMAT, todayInIndia, meetupClock, longDate } from './site.js'

const TYPES = {
  llms: 'text/plain; charset=utf-8',
  'llms-full': 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
  sitemap: 'application/xml; charset=utf-8',
  ics: 'text/calendar; charset=utf-8',
}

export function feed(kind, data, today = todayInIndia()) {
  const make = { llms, 'llms-full': llmsFull, json, sitemap, ics }[kind]
  return make ? { type: TYPES[kind], body: make(data, today) } : null
}

const bookUrl = (b) => `${SITE}/book/${b.id}`
const upcoming = (data, today) => data.meetups.filter((m) => m.date >= today && !m.cancelled)

function nextLine(data, today) {
  const next = upcoming(data, today)[0]
  return next
    ? `Next meetup (as of ${today}): ${longDate(next.date)}, ${next.venue}${next.area ? ` in ${next.area}` : ''}, ${next.time}.`
    : `No upcoming meetups are listed yet (as of ${today}). New dates are announced on Instagram first.`
}

function shelves(data) {
  return data.members
    .map((m) => ({ ...m, books: data.books.filter((b) => b.owner === m.name) }))
    .filter((m) => m.books.length)
}

function llms(data, today) {
  const example = data.books[0]
  return `# ${NAME}

> ${ABOUT}

- ${data.books.length} books from ${shelves(data).length} members.
- Meetups are on weekend afternoons at cafés around Hyderabad, usually ${data.club.default_time}. ${MEETUP_FORMAT}
- ${nextLine(data, today)}
- To borrow a book, open it on the site and tap “Ask <owner> to bring it”. That copies a message to paste in the club’s group chat, and the owner brings it to the next meetup.

## Data

- [Full catalogue and calendar](${SITE}/llms-full.txt): every member’s books with blurbs and links, and every meetup, in Markdown
- [Catalogue as JSON](${SITE}/library.json): the same data, structured
- [Meetup calendar](${SITE}/meetups.ics): iCalendar feed of upcoming meetups

## Site

- [Library](${SITE}/#library): the shelves, arranged by member, genre, language or writer, with search
- [Calendar](${SITE}/#calendar): upcoming meetups, with venues and timings
- [Readers](${SITE}/#readers): the members and what each one owns
- Every book has its own page at ${SITE}/book/<id>${example ? `, for example [${example.title}](${bookUrl(example)})` : ''}, and every member’s shelf is at ${SITE}/shelf/<name>

## Community

- [Instagram @hyderabadreads](${data.club.instagram}): announcements and the monthly calendar
- [Source code on GitHub](${GITHUB}): open source under the MIT License, and anyone can contribute

## Optional

- [How to contribute](${GITHUB}/blob/main/CONTRIBUTING.md): changing the code
`
}

function llmsFull(data, today) {
  const bookLine = (b) =>
    [
      `- **${b.title}** by ${b.author}. ${[b.genre, b.language !== 'English' && b.language, b.year].filter(Boolean).join(', ')}.`,
      b.sample && ' A sample book, standing in until the owner’s real list is in.',
      b.blurb && ` ${b.blurb}`,
      b.note && ` Owner’s note: “${b.note}”`,
      ` [Open](${bookUrl(b)})`,
    ]
      .filter(Boolean)
      .join('')
  const rows = data.meetups.map((m) => `| ${longDate(m.date)} | ${m.venue} | ${m.area} | ${m.time}${m.cancelled ? ' (cancelled)' : ''} |`)
  return `# ${NAME}

> ${ABOUT}

Website: ${SITE} · Instagram: ${data.club.instagram} · Source (MIT): ${GITHUB}
Generated ${today}. ${data.books.length} books from ${shelves(data).length} members.

## How borrowing works

Open a book on the site and tap “Ask <owner> to bring it”. That copies a message to paste in the club’s group chat. Pick the book up at the next meetup and bring it back when you are done.

## Meetups

Weekend afternoons, usually ${data.club.default_time}. ${MEETUP_FORMAT} ${nextLine(data, today)}

| Date | Venue | Area | Time |
| --- | --- | --- | --- |
${rows.join('\n')}

## Members and their books

${shelves(data)
  .map((m) => `### ${m.name} (${m.books.length} ${m.books.length === 1 ? 'book' : 'books'})\n\n${m.books.map(bookLine).join('\n')}`)
  .join('\n\n')}
`
}

function json(data, today) {
  const members = shelves(data).map((m) => ({
    name: m.name,
    shelf: `${SITE}/shelf/${m.slug}`,
    books: m.books.map((b) => ({
      title: b.title,
      author: b.author,
      genre: b.genre,
      language: b.language,
      year: b.year,
      pages: b.pages,
      blurb: b.blurb || null,
      note: b.note || null,
      sample: b.sample,
      url: bookUrl(b),
      cover: b.cover ? `${SITE}${b.cover}` : null,
    })),
  }))
  const meetups = data.meetups.map((m) => ({ date: m.date, venue: m.venue, area: m.area, time: m.time, cancelled: m.cancelled, ...meetupClock(m.date, m.time) }))
  return `${JSON.stringify({ name: NAME, description: ABOUT, url: `${SITE}/`, generated: today, instagram: data.club.instagram, source: GITHUB, license: 'MIT', meetups, members }, null, 2)}\n`
}

function sitemap(data, today) {
  const urls = [
    { loc: `${SITE}/`, lastmod: today },
    ...shelves(data).map((m) => ({ loc: `${SITE}/shelf/${m.slug}`, lastmod: m.books.map((b) => b.added).sort().at(-1) })),
    ...data.books.map((b) => ({ loc: bookUrl(b), lastmod: b.added })),
    { loc: `${SITE}/llms.txt`, lastmod: today },
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`
}

// iCalendar (RFC 5545): CRLF line ends, long lines folded, commas escaped.
function ics(data, today) {
  const text = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
  const utc = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const stamp = `${today.replace(/-/g, '')}T000000Z`
  const events = data.meetups
    .filter((m) => m.date >= today)
    .map((m) => {
      const { start, end } = meetupClock(m.date, m.time)
      const when = start
        ? [`DTSTART:${utc(start)}`, `DTEND:${utc(end)}`]
        : [`DTSTART;VALUE=DATE:${m.date.replace(/-/g, '')}`]
      return [
        'BEGIN:VEVENT',
        `UID:${m.date}-${m.venue.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@hyderabadreads.fun`,
        `DTSTAMP:${stamp}`,
        ...when,
        `SUMMARY:${text(`${NAME} at ${m.venue}`)}`,
        `LOCATION:${text(`${m.venue}${m.area ? `, ${m.area}` : ''}, Hyderabad`)}`,
        `DESCRIPTION:${text(`${MEETUP_FORMAT}${m.note ? `\n${m.note}` : ''}\n${SITE}/#calendar`)}`,
        `URL:${SITE}/#calendar`,
        `STATUS:${m.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
        'END:VEVENT',
      ]
    })
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hyderabad Reads//Meetups//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${NAME} meetups`,
    'X-WR-TIMEZONE:Asia/Kolkata',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    ...events.flat(),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

// Lines longer than 75 bytes continue on the next line after a space.
function fold(line) {
  const bytes = Buffer.from(line)
  if (bytes.length <= 75) return line
  const parts = []
  let rest = line
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75 - (parts.length ? 1 : 0)
    while (Buffer.byteLength(rest.slice(0, cut)) > 75 - (parts.length ? 1 : 0)) cut--
    parts.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  parts.push(rest)
  return parts.map((p, i) => (i ? ` ${p}` : p)).join('\r\n')
}
