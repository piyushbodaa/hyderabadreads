// Server-rendered pages. The home page, every book (/book/dune-herbert) and
// every member's shelf (/shelf/piyush) come from the same HTML, with their own
// title, link preview and structured data written in, the library's data
// inlined for the scripts, and a plain-HTML catalogue for crawlers and anyone
// without JavaScript.
import { esc, jsonForScript } from './html.js'
import { SITE, NAME, ABOUT, GITHUB, MEETUP_FORMAT, todayInIndia, meetupClock } from './site.js'
import { faq } from '../src/lib/faq.js'
import { heroHTML } from './hero.js'

const DEFAULT = {
  title: `${NAME} · Our shared library`,
  description:
    'The Hyderabad Reads book club’s shared bookshelf and weekend meetup calendar. Find a book you like and ask its owner to bring it to the next meetup.',
  image: '/og-v2.jpg',
  imageType: 'image/jpeg',
  imageAlt: 'The Hyderabad Reads logo, the Charminar rising from an open book, beside a stack of club members’ books',
}

export function routeFor(route, slug) {
  if (route === 'book' && slug) return { kind: 'book', slug }
  if (route === 'shelf' && slug) return { kind: 'shelf', slug }
  return { kind: 'home' }
}

export function renderPage({ template, notFound, data, route, origin = SITE, today = todayInIndia() }) {
  const book = route.kind === 'book' ? data.books.find((b) => b.id === route.slug) : null
  const member = route.kind === 'shelf' ? data.members.find((m) => m.slug === route.slug) : null
  if ((route.kind === 'book' && !book) || (route.kind === 'shelf' && !member)) return { status: 404, html: notFound }

  const page = book ? bookPage(book) : member ? shelfPage(member, data) : homePage()
  const ld = structuredData(data, today, book, origin, route.kind === 'home')
  const html = template
    .replace(/<!--hr:meta-->[\s\S]*?<!--\/hr:meta-->/, metaTags(page, origin))
    .replace('</head>', `<script type="application/ld+json">${jsonForScript(ld)}</script>\n  </head>`)
    .replace('<!--hr:data-->', `<script type="application/json" id="hr-data">${jsonForScript(data)}</script>`)
    .replace('<!--hr:noscript-->', catalogue(data, book, member))
    .replace('<!--hr:hero-->', heroHTML(data, today))
    // In place before the scripts run, so the shelves below don't move.
    .replace('<p class="section-sub" data-result-count></p>', `<p class="section-sub" data-result-count>${data.books.length} books from ${data.members.length} readers</p>`)
  return { status: 200, html }
}

function homePage() {
  return { ...DEFAULT, path: '/' }
}

function bookPage(book) {
  const where = book.sample ? `A sample book on ${book.owner}’s shelf` : `On ${book.owner}’s shelf`
  return {
    path: `/book/${book.id}`,
    title: `${book.title} by ${book.author} · ${where} · ${NAME}`,
    description: book.sample
      ? `${book.title}, by ${book.author}. A placeholder on ${book.owner}’s shelf at ${NAME} until their real list is in.`
      : `${book.title}, by ${book.author}. ${book.blurb ? `${book.blurb} ` : ''}On ${book.owner}’s shelf at ${NAME}: ask to borrow it at the next meetup.`,
    image: `/og/book/${book.id}.jpg`,
    imageType: 'image/jpeg',
    imageAlt: `The cover of ${book.title} by ${book.author}, ${where.toLowerCase()} at ${NAME}`,
  }
}

function shelfPage(member, data) {
  const books = data.books.filter((b) => b.owner === member.name)
  const titles = books.slice(0, 3).map((b) => b.title)
  return {
    path: `/shelf/${member.slug}`,
    title: `${member.name}’s shelf · ${NAME}`,
    description: books.length
      ? `${books.length} ${books.length === 1 ? 'book' : 'books'} on ${member.name}’s shelf at ${NAME}: ${titles.join(', ')}${books.length > 3 ? ' and more' : ''}.`
      : `${member.name}’s shelf at ${NAME} is empty for now. ${member.name}, send a photo of your books to Piyush and they’ll be up here.`,
    image: `/og/shelf/${member.slug}.jpg`,
    imageType: 'image/jpeg',
    imageAlt: `Books on ${member.name}’s shelf at ${NAME}`,
  }
}

function metaTags(page, origin) {
  const url = `${SITE}${page.path}`
  const image = page.image.startsWith('http') ? page.image : `${origin}${page.image}`
  return [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${NAME}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:type" content="${page.imageType}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(page.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ].join('\n    ')
}

// schema.org: the club, the site, upcoming meetups as Events, and the book on a book page.
function structuredData(data, today, book, origin, home) {
  const club = { '@id': `${SITE}/#club` }
  const graph = [
    {
      '@type': 'Organization',
      ...club,
      name: NAME,
      url: `${SITE}/`,
      logo: `${SITE}/logo-512.png`,
      description: ABOUT,
      areaServed: { '@type': 'City', name: 'Hyderabad' },
      sameAs: [data.club.instagram, GITHUB].filter(Boolean),
    },
    { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: NAME, description: ABOUT, inLanguage: 'en', publisher: club },
  ]
  for (const m of data.meetups) {
    const { start, end } = meetupClock(m.date, m.time)
    if (m.date < today || !start) continue
    graph.push({
      '@type': 'Event',
      name: `${NAME} meetup at ${m.venue}`,
      description: `A weekend reading meetup of the ${NAME} book club. ${MEETUP_FORMAT}`,
      startDate: start,
      endDate: end,
      eventStatus: m.cancelled ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: m.venue,
        address: { '@type': 'PostalAddress', addressLocality: `${m.area ? `${m.area}, ` : ''}Hyderabad`, addressRegion: 'Telangana', addressCountry: 'IN' },
      },
      organizer: club,
      url: `${SITE}/#calendar`,
    })
  }
  // The newcomers' questions, as they appear on the home page.
  if (home) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faq({ club: data.club, meetups: data.meetups.filter((m) => m.date >= today) }).map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    })
  }
  if (book) {
    graph.push({
      '@type': 'Book',
      name: book.title,
      author: { '@type': 'Person', name: book.author },
      url: `${SITE}/book/${book.id}`,
      ...(book.isbn && { isbn: book.isbn }),
      ...(book.year && { datePublished: String(book.year) }),
      ...(book.pages && { numberOfPages: book.pages }),
      ...(book.cover && { image: `${origin}${book.cover}` }),
      ...(book.blurb && { abstract: book.blurb }),
      inLanguage: book.language,
      genre: book.genre,
    })
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}

// The library as plain HTML, inside <noscript>.
function catalogue(data, book, member) {
  if (book) {
    return `<div class="library__noscript">
      <h3>${esc(book.title)}</h3>
      <p>by ${esc(book.author)}${book.year ? `, ${book.year}` : ''}. ${esc(book.genre)}. On ${esc(book.owner)}’s shelf${book.sample ? ' (a sample book)' : ''}.</p>
      ${book.blurb ? `<p>${esc(book.blurb)}</p>` : ''}
      <p><a href="/">The whole library</a></p>
    </div>`
  }
  const owners = member ? data.members.filter((m) => m.slug === member.slug) : data.members
  const sections = owners
    .map((m) => {
      const books = data.books.filter((b) => b.owner === m.name)
      if (!books.length) return ''
      const items = books.map((b) => `<li><a href="/book/${esc(b.id)}">${esc(b.title)}</a> by ${esc(b.author)}</li>`).join('')
      return `<h3><a href="/shelf/${esc(m.slug)}">${esc(m.name)}’s shelf</a></h3><ul>${items}</ul>`
    })
    .join('')
  return `<div class="library__noscript">
      <p>The shelves need JavaScript, so here is every book as a plain list.
      The catalogue is also at <a href="/llms-full.txt">llms-full.txt</a> and <a href="/library.json">library.json</a>.</p>
      ${sections}
    </div>`
}
