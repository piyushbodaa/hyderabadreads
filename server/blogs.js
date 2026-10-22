// The club's blog: members' own blogs (Substack, Medium, WordPress, their own
// sites), read from each blog's feed into the database (each post's title,
// link, date, excerpt and picture) and shown at /blog. Every post links back
// to where it was published; nothing else of it is copied.
//
// Feeds are read when a blog is added, once a day (the cron in vercel.json),
// whenever a page is shown with a feed more than an hour old, and when its
// owner taps "Check now".
import sharp from 'sharp'
import { Problem } from './members.js'
import { findFeed, parseFeed, platformOf } from './rss.js'
import { fetchPublic } from './safe-fetch.js'
import { storeMedia } from './media.js'

const MAX_BLOGS = 5 // per member
const KEEP = 30 // newest posts kept from each reading of a feed
const PICTURES = 20 // newest posts per blog that get their picture saved
const FEED_TYPES = 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5'
const STALE = `checked_at IS NULL OR checked_at < now() - interval '1 hour'`
// Reading feeds and their pictures stops starting new work after this long,
// well inside the functions' 60 seconds (vercel.json). What's left waits for
// the next reading.
const BUDGET = 40000

// ── What visitors see ─────────────────────────────────────────────────────

const POST_FIELDS = `p.title, p.url, p.excerpt, p.words, NULLIF(p.image, '') AS image, p.image_w AS w, p.image_h AS h,
  to_char(p.published_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date,
  to_char(p.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published,
  b.title AS blog, b.platform, b.home_url AS home, b.feed_url AS feed, m.name AS writer, m.slug AS "writerSlug"`
const VISIBLE = `FROM posts p JOIN blogs b ON b.id = p.blog_id JOIN members m ON m.id = b.member_id
  WHERE NOT p.hidden AND b.removed_at IS NULL AND m.removed_at IS NULL`

// The newest few, for the home page (see server/library.js).
export const LATEST_POSTS_QUERY = `SELECT ${POST_FIELDS} ${VISIBLE} ORDER BY p.published_at DESC LIMIT 3`
export const BLOGS_DUE_QUERY = `SELECT EXISTS (SELECT 1 FROM blogs WHERE removed_at IS NULL AND (${STALE})) AS due`

// Everything /blog and its feed show: the newest posts, and who writes where.
export async function loadBlog(db) {
  const [posts, writers, due] = await db.batch([
    [`SELECT ${POST_FIELDS} ${VISIBLE} ORDER BY p.published_at DESC LIMIT 120`],
    [
      `SELECT m.name, m.slug, b.title AS blog, b.platform, b.home_url AS home,
         count(p.id) FILTER (WHERE NOT p.hidden)::int AS posts
       FROM blogs b JOIN members m ON m.id = b.member_id LEFT JOIN posts p ON p.blog_id = b.id
       WHERE b.removed_at IS NULL AND m.removed_at IS NULL
       GROUP BY b.id, m.id ORDER BY max(p.published_at) DESC NULLS LAST, lower(m.name)`,
    ],
    [BLOGS_DUE_QUERY],
  ])
  return { posts, writers, due: due[0].due }
}

// ── Members and admins ────────────────────────────────────────────────────

export async function blogAction(db, member, input, net = {}) {
  let added
  switch (input.action) {
    case 'add':
      added = await addBlog(db, member, input, net)
      break
    case 'check': {
      const blog = await ownBlog(db, member, input.id)
      if (blog.recent) throw new Problem(429, 'It was checked a moment ago. Give it a minute.')
      // Pictures that couldn't be saved last time get another go.
      await db.batch([
        [`UPDATE posts SET image = NULL WHERE blog_id = $1 AND image = ''`, [blog.id]],
        ['UPDATE blogs SET checked_at = now() WHERE id = $1', [blog.id]],
      ])
      await readBlog(db, blog, net, Date.now() + BUDGET)
      break
    }
    case 'remove': {
      const blog = await ownBlog(db, member, input.id)
      await db.query('UPDATE blogs SET removed_at = now() WHERE id = $1', [blog.id])
      break
    }
    case 'hide':
    case 'show': {
      const post = await db.one(
        `SELECT p.id, b.member_id FROM posts p JOIN blogs b ON b.id = p.blog_id WHERE p.id = $1 AND b.removed_at IS NULL`,
        [Number(input.post) || 0],
      )
      if (!post) throw new Problem(404, 'That post isn’t on the site any more.')
      if (post.member_id !== member.id && !member.isAdmin) throw new Problem(403, 'Only the writer can hide their posts.')
      await db.query('UPDATE posts SET hidden = $2 WHERE id = $1', [post.id, input.action === 'hide'])
      break
    }
    default:
      throw new Problem(400, 'Unknown blog action.')
  }
  return { writing: await writingFor(db, member), ...(added && { added }) }
}

// A member's blogs and posts, for My shelf.
export async function writingFor(db, member) {
  const [blogs, posts] = await db.batch([
    [`SELECT ${BLOG_FIELDS} FROM blogs b WHERE b.member_id = $1 AND b.removed_at IS NULL ORDER BY b.added_at`, [member.id]],
    [
      `SELECT p.id, p.title, p.url, p.hidden, to_char(p.published_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date
       FROM posts p JOIN blogs b ON b.id = p.blog_id
       WHERE b.member_id = $1 AND b.removed_at IS NULL ORDER BY p.published_at DESC LIMIT 60`,
      [member.id],
    ],
  ])
  return { blogs, posts }
}

// Every blog, for the admin page.
export async function adminWriting(db) {
  const [blogs, posts] = await db.batch([
    [
      `SELECT ${BLOG_FIELDS}, m.name AS writer, m.slug AS "writerSlug"
       FROM blogs b JOIN members m ON m.id = b.member_id
       WHERE b.removed_at IS NULL AND m.removed_at IS NULL ORDER BY lower(m.name), b.added_at`,
    ],
    [
      `SELECT p.id, p.title, p.url, p.hidden, m.name AS writer, to_char(p.published_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date
       FROM posts p JOIN blogs b ON b.id = p.blog_id JOIN members m ON m.id = b.member_id
       WHERE b.removed_at IS NULL AND m.removed_at IS NULL ORDER BY p.published_at DESC LIMIT 40`,
    ],
  ])
  return { blogs, posts }
}

const BLOG_FIELDS = `b.id, b.title, b.platform, b.home_url AS home, b.feed_url AS feed, b.error,
  to_char(b.checked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS checked,
  (SELECT count(*)::int FROM posts p WHERE p.blog_id = b.id) AS posts,
  (SELECT count(*)::int FROM posts p WHERE p.blog_id = b.id AND p.hidden) AS hidden`

// A member adds their own blog; an admin can add one for anyone.
export async function addBlog(db, actor, input, net = {}) {
  const deadline = Date.now() + BUDGET
  let member = actor
  if (input.member && input.member !== actor.slug) {
    if (!actor.isAdmin) throw new Problem(403, 'You can only add your own blog.')
    member = await db.one('SELECT id, name, slug FROM members WHERE slug = $1 AND removed_at IS NULL', [String(input.member)])
    if (!member) throw new Problem(404, 'There’s no member by that name.')
  }
  const { n } = await db.one('SELECT count(*)::int AS n FROM blogs WHERE member_id = $1 AND removed_at IS NULL', [member.id])
  if (n >= MAX_BLOGS) throw new Problem(400, `That’s ${MAX_BLOGS} blogs already. Remove one first.`)

  const { feedUrl, feed } = await findFeed(input.url, net)
  const taken = await db.one(
    `SELECT m.name FROM blogs b JOIN members m ON m.id = b.member_id WHERE lower(b.feed_url) = lower($1) AND b.removed_at IS NULL`,
    [feedUrl],
  )
  if (taken) throw new Problem(409, taken.name === member.name ? 'That blog is on the site already.' : `That blog is on the site already, as ${taken.name}’s.`)
  const blog = await db.one(
    `INSERT INTO blogs (member_id, feed_url, home_url, title, platform, checked_at, ok_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())
     ON CONFLICT DO NOTHING RETURNING id`,
    [member.id, feedUrl, feed.link ?? new URL(feedUrl).origin, blogTitle(feed.title), platformOf(feedUrl, feed.link, feed.generator)],
  )
  if (!blog) throw new Problem(409, 'That blog is on the site already.')
  // The newest pictures now; the rest arrive with the next reading.
  await savePosts(db, blog.id, feed.posts, net, deadline)
  return { id: blog.id, posts: Math.min(feed.posts.length, KEEP) }
}

async function ownBlog(db, member, id) {
  const blog = await db.one(
    `SELECT id, member_id, feed_url, checked_at > now() - interval '30 seconds' AS recent FROM blogs WHERE id = $1 AND removed_at IS NULL`,
    [Number(id) || 0],
  )
  if (!blog) throw new Problem(404, 'That blog isn’t on the site any more.')
  if (blog.member_id !== member.id && !member.isAdmin) throw new Problem(403, 'Only the blog’s writer can change it.')
  return blog
}

// "Stories by Ev Williams on Medium" says nothing the post doesn't.
function blogTitle(title) {
  return String(title ?? '')
    .replace(/^Stories by .+ on Medium$/i, '')
    .replace(/\s+[-–|]\s+Medium$/i, '')
    .trim()
    .slice(0, 120)
}

// ── Reading feeds ─────────────────────────────────────────────────────────

// Blogs whose feed hasn't been read for an hour, a few at a time. Each one is
// claimed first, so two pages showing at once don't both read it. With `all`
// (the daily run), more rounds follow while there's time for one.
export async function refreshDue(db, net = {}, { all = false, budgetMs = BUDGET } = {}) {
  const deadline = Date.now() + budgetMs
  let read = 0
  do {
    const claimed = await db.query(
      `UPDATE blogs SET checked_at = now() WHERE id IN (
         SELECT id FROM blogs WHERE removed_at IS NULL AND (${STALE})
         ORDER BY checked_at NULLS FIRST LIMIT 4 FOR UPDATE SKIP LOCKED)
       RETURNING id, feed_url`,
    )
    if (!claimed.length) break
    await Promise.all(claimed.map((blog) => readBlog(db, blog, net, deadline)))
    read += claimed.length
  } while (all && deadline - Date.now() > 15000)
  return { read }
}

// The daily run (vercel.json "crons"). Vercel sends CRON_SECRET when the
// project has one; without one, the hourly limit is the only protection needed.
export async function cronRefresh(db, request, net = {}) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) throw new Problem(401, 'Not for you.')
  return refreshDue(db, net, { all: true })
}

async function readBlog(db, blog, net, deadline) {
  try {
    const { url, body } = await fetchPublic(blog.feed_url, { ...net, accept: FEED_TYPES, timeout: Math.max(1000, Math.min(10000, deadline - Date.now())) })
    const feed = parseFeed(body.toString('utf8'), url.href)
    if (!feed) throw new Problem(502, 'The blog’s address answered, but not with its posts.')
    await db.query(
      `UPDATE blogs SET title = COALESCE(NULLIF($2, ''), title), home_url = COALESCE($3, home_url), ok_at = now(), error = NULL WHERE id = $1`,
      [blog.id, blogTitle(feed.title), feed.link],
    )
    await savePosts(db, blog.id, feed.posts, net, deadline)
  } catch (err) {
    if (!(err instanceof Problem)) console.error(err)
    await db.query('UPDATE blogs SET error = $2 WHERE id = $1', [blog.id, err instanceof Problem ? err.message : 'Couldn’t read the blog just now.'])
  }
}

async function savePosts(db, blogId, posts, net, deadline) {
  const fresh = posts.slice(0, KEEP)
  if (fresh.length) {
    // A post whose picture changed gets the new one.
    await db.batch(
      fresh.map((p) => [
        `INSERT INTO posts (blog_id, guid, url, title, excerpt, words, image_src, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()))
         ON CONFLICT (blog_id, guid) DO UPDATE SET
           url = EXCLUDED.url, title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, words = EXCLUDED.words,
           published_at = COALESCE($8::timestamptz, posts.published_at), image_src = EXCLUDED.image_src,
           image = CASE WHEN posts.image_src IS DISTINCT FROM EXCLUDED.image_src THEN NULL ELSE posts.image END`,
        [blogId, p.guid, p.url, p.title, p.excerpt, p.words, p.image, p.published],
      ]),
    )
  }
  await savePictures(db, blogId, net, deadline)
}

// Each post's picture, made into a 1000px WebP in the media table, so pages
// never load anything from other sites: up to six at a reading, three at a
// time, while there's time. One that can't be had is marked '', and the post
// gets a quote instead; one whose site didn't answer is tried again next time.
async function savePictures(db, blogId, net, deadline) {
  const due = await db.query(
    `SELECT id, image_src AS src FROM (
       SELECT id, image, image_src, published_at FROM posts WHERE blog_id = $1 ORDER BY published_at DESC LIMIT ${PICTURES}
     ) p WHERE image IS NULL AND image_src IS NOT NULL ORDER BY published_at DESC LIMIT 6`,
    [blogId],
  )
  for (let i = 0; i < due.length && deadline - Date.now() > 3000; i += 3) {
    await Promise.all(
      due.slice(i, i + 3).map(async (post) => {
        const saved = await picture(db, post.src, net, Math.min(12000, deadline - Date.now()))
        if (saved) await db.query('UPDATE posts SET image = $2, image_w = $3, image_h = $4 WHERE id = $1', [post.id, saved.path, saved.width, saved.height])
      }),
    )
  }
}

async function picture(db, src, net, timeout) {
  try {
    const { body } = await fetchPublic(src, { ...net, accept: 'image/webp,image/jpeg,image/png,image/*;q=0.8', maxBytes: 8e6, timeout })
    const { data, info } = await sharp(body, { limitInputPixels: 50e6 })
      .rotate()
      .resize({ width: 1000, withoutEnlargement: true })
      .webp({ quality: 74 })
      .toBuffer({ resolveWithObject: true })
    // Icons and logos aren't a post's picture.
    if (info.width < 200 || info.height < 120) return { path: '', width: null, height: null }
    return { path: await storeMedia(db, { bytes: data, width: info.width, height: info.height }), width: info.width, height: info.height }
  } catch (err) {
    return err?.transient ? null : { path: '', width: null, height: null }
  }
}
