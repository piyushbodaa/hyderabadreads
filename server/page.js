// Server-rendered pages. The home page, every book (/book/dune-herbert) and
// every member's shelf (/shelf/piyush) come from the same HTML, with their own
// title, link preview and structured data written in, the library's data
// inlined for the scripts, and a plain-HTML catalogue for crawlers and anyone
// without JavaScript. The blog (/blog) has a page of its own, all in HTML.
import { esc, jsonForScript } from './html.js'
import { SITE, NAME, ABOUT, GITHUB, MEETUP_FORMAT, todayInIndia, meetupClock } from './site.js'
import { faq } from '../src/lib/faq.js'
import { hash } from '../src/lib/model.js'
import { heroHTML } from './hero.js'
import { clip } from './rss.js'

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
  if (route === 'blog') return { kind: 'blog' }
  return { kind: 'home' }
}

export function renderPage({ template, notFound, data, route, origin = SITE, today = todayInIndia() }) {
  const book = route.kind === 'book' ? data.books.find((b) => b.id === route.slug) : null
  const member = route.kind === 'shelf' ? data.members.find((m) => m.slug === route.slug) : null
  if ((route.kind === 'book' && !book) || (route.kind === 'shelf' && !member)) return { status: 404, html: notFound }

  const page = book ? bookPage(book) : member ? shelfPage(member, data) : homePage()
  const ld = structuredData(data, today, book, origin, route.kind === 'home')
  // The blog's posts are drawn here, so the scripts don't need them.
  const { posts = [], blogsDue, ...forScripts } = data
  const html = template
    .replace(/<!--hr:meta-->[\s\S]*?<!--\/hr:meta-->/, metaTags(page, origin))
    .replace('</head>', `<script type="application/ld+json">${jsonForScript(ld)}</script>\n  </head>`)
    .replace('<!--hr:data-->', `<script type="application/json" id="hr-data">${jsonForScript(forScripts)}</script>`)
    .replace('<!--hr:noscript-->', catalogue(data, book, member))
    .replace('<!--hr:hero-->', heroHTML(data, today))
    .replace('<!--hr:writing-->', writingSection(posts, today))
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

// ── The blog ──────────────────────────────────────────────────────────────

// The home page's taste of the blog: the newest three posts.
function writingSection(posts, today) {
  if (!posts.length) return ''
  return `<section id="writing" class="writing" aria-labelledby="writing-title">
        <div class="section-head">
          <h2 id="writing-title" class="section-title">From the club’s writers</h2>
          <p class="section-sub">What members are publishing on Substack, Medium and their own blogs. <a href="/blog">All their writing</a></p>
        </div>
        <div class="posts posts--home">${posts.map((p) => postCard(p, { today, level: 3 })).join('')}</div>
      </section>`
}

// /blog, and /blog?by=swapnil for one writer: every post links to where it
// was published.
export function renderBlog({ template, blog, by, origin = SITE, today = todayInIndia() }) {
  // One chip per writer, however many blogs they keep.
  const writers = new Map()
  for (const b of blog.writers) writers.set(b.slug, { name: b.name, slug: b.slug, posts: (writers.get(b.slug)?.posts ?? 0) + b.posts })
  const writer = writers.get(by) ?? null
  const posts = writer ? blog.posts.filter((p) => p.writerSlug === writer.slug) : blog.posts
  const page = {
    ...DEFAULT,
    path: writer ? `/blog?by=${writer.slug}` : '/blog',
    title: writer ? `${writer.name}’s writing · ${NAME}` : `The blog · ${NAME}`,
    description: writer
      ? `Posts by ${writer.name}, a member of the ${NAME} book club, newest first. Each one opens where it was published.`
      : `Essays, reviews and notes by members of the ${NAME} book club, from Substack, Medium, WordPress and their own sites.`,
  }
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${NAME}: writing by members`,
    url: `${SITE}${page.path}`,
    description: page.description,
    inLanguage: 'en',
    publisher: { '@type': 'Organization', name: NAME, url: `${SITE}/`, logo: `${SITE}/logo-512.png` },
    blogPost: posts.slice(0, 30).map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: p.url,
      datePublished: p.published,
      author: { '@type': 'Person', name: p.writer, url: `${SITE}/shelf/${p.writerSlug}` },
      ...(p.excerpt && { description: p.excerpt }),
      ...(p.image && { image: `${origin}${p.image}` }),
    })),
  }
  const html = template
    .replace(/<!--hr:meta-->[\s\S]*?<!--\/hr:meta-->/, metaTags(page, origin))
    .replace('</head>', `<script type="application/ld+json">${jsonForScript(ld)}</script>\n  </head>`)
    .replace('<!--hr:blog-->', blogBody({ posts, writers: [...writers.values()], writer, blogs: blog.writers, total: blog.posts.length, today }))
  return { status: 200, html }
}

function blogBody({ posts, writers, writer, blogs, total, today }) {
  const head = `
      <div class="desk__head blog__head">
        <p class="kicker">The blog</p>
        <h1 class="desk__title">${writer ? `${esc(writer.name)}’s writing` : 'What our members are writing'}</h1>
        <p class="desk__lede">${
          writer
            ? `Everything ${esc(writer.name)} has published lately, newest first. Each post opens where it was written.`
            : 'Essays, reviews and notes by people in the club, from wherever they publish: Substack, Medium, WordPress or a site of their own. Each post opens where it was written.'
        }</p>
      </div>`
  const chips =
    writers.length > 1
      ? `<nav class="chips blog__chips" aria-label="Writers">
        <a class="chip" href="/blog"${writer ? '' : ' aria-current="page"'}>Everyone <span>${total}</span></a>${writers
          .map(
            (w) =>
              `<a class="chip" href="/blog?by=${esc(w.slug)}"${writer?.slug === w.slug ? ' aria-current="page"' : ''} style="--dot:hsl(${hash(w.name) % 360} 62% 72%)"><i></i>${esc(w.name)} <span>${w.posts}</span></a>`,
          )
          .join('')}
      </nav>`
      : ''
  const list = posts.length
    ? `<div class="posts">${posts.map((p, i) => postCard(p, { today, level: 2, lead: i === 0 })).join('')}</div>`
    : `<div class="panel blog__empty"><p class="panel__lede">No posts yet. When members add their blogs, their writing shows up here, newest first.</p></div>`
  const where = (writer ? blogs.filter((b) => b.slug === writer.slug) : blogs)
    .map((b) => {
      const source = b.platform || hostOf(b.home)
      const named = b.blog && !b.blog.toLowerCase().includes(b.name.toLowerCase()) ? `${b.blog} · ` : ''
      const follow = b.platform === 'Substack' ? ['Subscribe', `${new URL(b.home).origin}/subscribe`] : [b.platform === 'Medium' ? 'Follow' : 'Visit', b.home]
      return `
          <li class="writer" style="--hue:${hash(b.name) % 360}">
            <span class="avatar" aria-hidden="true">${esc(b.name[0])}</span>
            <span class="writer__text">
              <a class="writer__name" href="/blog?by=${esc(b.slug)}">${esc(b.name)}</a>
              <span class="writer__blog">${esc(named)}${esc(source)} · ${b.posts} ${b.posts === 1 ? 'post' : 'posts'}</span>
            </span>
            <a class="btn btn--ghost writer__follow" href="${esc(follow[1])}" target="_blank" rel="noopener">${follow[0]}<span class="visually-hidden"> to ${esc(named ? b.blog : `${b.name}’s blog`)} on ${esc(source)}</span></a>
          </li>`
    })
    .join('')
  return `${head}
      ${chips}
      ${list}
      ${
        where
          ? `<section class="writers" aria-labelledby="writers-title">
        <h2 id="writers-title" class="writers__title">Where they write</h2>
        <ul class="writers__list">${where}</ul>
      </section>`
          : ''
      }
      <section class="panel blog__join" aria-labelledby="blog-join-title">
        <h2 id="blog-join-title" class="panel__title">Do you write?</h2>
        <p class="panel__lede">If you’re in the club and you blog anywhere (Substack, Medium, WordPress, Blogger, Ghost or your own site), add it on My shelf. Your new posts show up here by themselves, each linking back to you.</p>
        <p class="desk__links"><a class="btn btn--primary" href="/me#writing">Add my blog</a><a href="/blog/feed.xml">Follow everyone’s posts by RSS</a></p>
      </section>`
}

// A post as a card: its picture (or a line of it, when it has none), where it
// was published, the title linking to it, an excerpt, and who wrote it when.
function postCard(p, { today, level, lead = false }) {
  const source = p.platform || hostOf(p.home)
  const minutes = p.words ? Math.max(1, Math.round(p.words / 230)) : 0
  const art = p.image
    ? `<img src="${esc(p.image)}" alt="" width="${p.w}" height="${p.h}" ${lead ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`
    : `<p class="post__quote" aria-hidden="true">${esc(clip(p.excerpt || p.title, 150))}</p>`
  return `
        <article class="post${lead ? ' post--lead' : ''}${p.image ? '' : ' post--quote'}" style="--hue:${hash(p.writer) % 360}">
          <div class="post__art">${art}</div>
          <div class="post__body">
            <p class="post__source">${esc(source)}</p>
            <h${level} class="post__title"><a href="${esc(p.url)}" target="_blank" rel="noopener" data-post-link="${esc(source)}">${esc(p.title)}<span class="visually-hidden">, on ${esc(source)}</span></a></h${level}>
            ${p.excerpt ? `<p class="post__excerpt">${esc(p.excerpt)}</p>` : ''}
            <p class="post__meta"><span class="avatar" aria-hidden="true">${esc(p.writer[0])}</span><span><a href="/blog?by=${esc(p.writerSlug)}">${esc(p.writer)}</a> · <time datetime="${esc(p.date)}">${shortDate(p.date, today)}</time>${minutes ? ` · ${minutes} min read` : ''}</span></p>
          </div>
        </article>`
}

// "20 Oct" this year, "20 Oct 2025" before.
function shortDate(iso, today) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(iso.slice(0, 4) !== today.slice(0, 4) && { year: 'numeric' }),
    timeZone: 'UTC',
  })
}

function hostOf(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return 'Blog'
  }
}
