// Writes what AI assistants, agents and crawlers read. The shelves are drawn by
// JavaScript that most of them never run, so the same data goes out as plain
// files too: llms.txt (a summary, see llmstxt.org), llms-full.txt (every book
// and meetup in Markdown), library.json, robots.txt and sitemap.xml, plus
// schema.org JSON-LD for the club and its meetups inside index.html.
//
// Runs after `vite build` and writes straight into dist/.

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLUB, readers } from '../src/data/library.js'
import { meetups, VENUES, TIME, INSTAGRAM } from '../src/data/meetups.js'
import { bookSlug, slugify } from '../src/lib/slug.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const SITE = 'https://hyderabadreads.fun'
const GITHUB = 'https://github.com/piyushbodaa/hyderabadreads'
const ABOUT =
  'Hyderabad Reads is a weekend book club in Hyderabad, India. Its website is a shared bookshelf: members list the books ' +
  'they are happy to lend or swap, and anyone in the club can ask a book’s owner to bring it to the next meetup.'

const covers = JSON.parse(await readFile(join(ROOT, 'src', 'data', 'covers.json'), 'utf8'))
const today = new Date().toISOString().slice(0, 10)

// Same ids as the site (src/lib/model.js), so every link opens the right book.
const seen = new Map()
const members = readers
  .map((reader) => ({
    name: reader.name,
    books: reader.books.map((raw) => {
      const slug = bookSlug(raw)
      const dupes = seen.get(slug) ?? 0
      seen.set(slug, dupes + 1)
      const meta = covers[slug] ?? {}
      return {
        title: raw.title,
        author: raw.author,
        genre: raw.genre ?? 'Other',
        language: raw.language ?? 'English',
        year: raw.year ?? meta.year ?? null,
        pages: meta.pages ?? null,
        blurb: raw.blurb ?? null,
        note: raw.note ?? null,
        onLoanTo: raw.onLoanTo ?? null,
        url: `${SITE}/#book/${dupes ? `${slug}--${slugify(reader.name)}` : slug}`,
        cover: meta.cover ? `${SITE}/${meta.cover}` : null,
      }
    }),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
const bookCount = members.reduce((n, m) => n + m.books.length, 0)

const events = meetups
  .map((m) => {
    const venue = VENUES[m.venue] ?? {}
    const time = m.time ?? venue.time ?? TIME
    return { date: m.date, venue: m.venue, area: venue.area ?? '', time, ...clock(m.date, time) }
  })
  .sort((a, b) => a.date.localeCompare(b.date))
const next = events.find((e) => e.date >= today)

const longDate = (iso) =>
  new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const nextLine = next
  ? `Next meetup (as of ${today}): ${longDate(next.date)}, ${next.venue} in ${next.area}, ${next.time}.`
  : `No upcoming meetups are listed yet (as of ${today}). New dates are announced on Instagram first.`

// llms.txt: the short version, with links to everything else.
const llms = `# ${CLUB.name}

> ${ABOUT}

- ${bookCount} books from ${members.length} members.
- Meetups are on weekend afternoons at cafés around Hyderabad, usually ${TIME}.
- ${nextLine}
- To borrow a book, open it on the site and tap “Ask <owner> to bring it”. That copies a message to paste in the club’s group chat, and the owner brings it to the next meetup.

## Data

- [Full catalogue and calendar](${SITE}/llms-full.txt): every member’s books with blurbs and links, and every meetup, in Markdown
- [Catalogue as JSON](${SITE}/library.json): the same data, structured

## Site

- [Library](${SITE}/#library): the shelves, arranged by member, genre, language or writer, with search
- [Calendar](${SITE}/#calendar): this month’s meetups, with venues and timings
- [Readers](${SITE}/#readers): the members and what each one owns
- Any single book opens at ${SITE}/#book/<id>, for example [${members[0].books[0].title}](${members[0].books[0].url})

## Community

- [Instagram @hyderabadreads](${INSTAGRAM}): announcements and the monthly calendar
- [Source code on GitHub](${GITHUB}): open source under the MIT License, and anyone can contribute

## Optional

- [How to contribute](${GITHUB}/blob/main/CONTRIBUTING.md): adding books, updating the calendar, changing the code
`

// llms-full.txt: everything, in one Markdown file.
const bookLine = (b) =>
  [
    `- **${b.title}** by ${b.author}. ${[b.genre, b.language !== 'English' && b.language, b.year].filter(Boolean).join(', ')}.`,
    b.blurb && ` ${b.blurb}`,
    b.note && ` Owner’s note: “${b.note}”`,
    b.onLoanTo && ` Currently on loan to ${b.onLoanTo}.`,
    ` [Open](${b.url})`,
  ]
    .filter(Boolean)
    .join('')
const full = `# ${CLUB.name}

> ${ABOUT}

Website: ${SITE} · Instagram: ${INSTAGRAM} · Source (MIT): ${GITHUB}
Generated ${today}. ${bookCount} books from ${members.length} members.

## How borrowing works

Open a book on the site and tap “Ask <owner> to bring it”. That copies a message to paste in the club’s group chat. Pick the book up at the next meetup and bring it back when you are done. Books marked as on loan are with someone else right now; you can ask to borrow them next.

## Meetups

Weekend afternoons, usually ${TIME}. ${nextLine}

| Date | Venue | Area | Time |
| --- | --- | --- | --- |
${events.map((e) => `| ${longDate(e.date)} | ${e.venue} | ${e.area} | ${e.time} |`).join('\n')}

## Members and their books

${members.map((m) => `### ${m.name} (${m.books.length} books)\n\n${m.books.map(bookLine).join('\n')}`).join('\n\n')}
`

const json = {
  name: CLUB.name,
  description: ABOUT,
  url: `${SITE}/`,
  generated: today,
  instagram: INSTAGRAM,
  source: GITHUB,
  license: 'MIT',
  meetups: events,
  members,
}

const robots = `# ${CLUB.name} welcomes search engines, AI assistants and agents.
# A summary for language models is at ${SITE}/llms.txt and the full
# catalogue and calendar at ${SITE}/llms-full.txt (or ${SITE}/library.json).

User-agent: *
Allow: /

User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: OAI-SearchBot
User-agent: ClaudeBot
User-agent: Claude-User
User-agent: Claude-SearchBot
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Meta-ExternalAgent
User-agent: CCBot
Allow: /

Sitemap: ${SITE}/sitemap.xml
`

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', '/llms.txt', '/llms-full.txt'].map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`

// schema.org JSON-LD: the club, the site, and each meetup as an Event.
const club = { '@id': `${SITE}/#club` }
const graph = [
  {
    '@type': 'Organization',
    ...club,
    name: CLUB.name,
    url: `${SITE}/`,
    logo: `${SITE}/logo-512.png`,
    description: ABOUT,
    areaServed: { '@type': 'City', name: 'Hyderabad' },
    sameAs: [INSTAGRAM, GITHUB],
  },
  { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: CLUB.name, description: ABOUT, inLanguage: 'en', publisher: club },
  ...events
    .filter((e) => e.start)
    .map((e) => ({
      '@type': 'Event',
      name: `${CLUB.name} meetup at ${e.venue}`,
      description: `A weekend afternoon meetup of the ${CLUB.name} book club. Bring a book, borrow a book.`,
      startDate: e.start,
      endDate: e.end,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: e.venue,
        address: { '@type': 'PostalAddress', addressLocality: `${e.area}, Hyderabad`, addressRegion: 'Telangana', addressCountry: 'IN' },
      },
      organizer: club,
      url: `${SITE}/#calendar`,
    })),
]
const ld = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
const html = await readFile(join(DIST, 'index.html'), 'utf8')
if (!html.includes('</head>')) throw new Error('[agents] dist/index.html has no </head>')

await Promise.all([
  writeFile(join(DIST, 'llms.txt'), llms),
  writeFile(join(DIST, 'llms-full.txt'), full),
  writeFile(join(DIST, 'library.json'), JSON.stringify(json, null, 2) + '\n'),
  writeFile(join(DIST, 'robots.txt'), robots),
  writeFile(join(DIST, 'sitemap.xml'), sitemap),
  writeFile(join(DIST, 'index.html'), html.replace('</head>', `  <script type="application/ld+json">${ld}</script>\n  </head>`)),
])
console.log(`[agents] llms.txt, llms-full.txt, library.json, robots.txt, sitemap.xml and ${graph.length} JSON-LD entries written`)

// "1 to 4 PM" → 13:00 to 16:00 IST, "2:30 to 5:30 PM" → 14:30 to 17:30.
function clock(date, time) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|–)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(time)
  if (!m) return {}
  const at = (h, min = '00', half) => `${String((+h % 12) + (half.toLowerCase() === 'pm' ? 12 : 0)).padStart(2, '0')}:${min}`
  const end = at(m[4], m[5], m[6])
  let start = at(m[1], m[2], m[3] ?? m[6])
  if (start > end) start = at(m[1], m[2], 'am')
  return { start: `${date}T${start}:00+05:30`, end: `${date}T${end}:00+05:30` }
}
