// The club's calendar and details, run by admins on the site: meetups, the
// venues they rotate through, and settings like the usual time and the fee.
import { Problem } from './members.js'
import { addPhoto, removePhoto, PHOTOS_QUERY } from './photos.js'

export const CALENDAR_ACTIONS = new Set(['add-meetups', 'update-meetup', 'delete-meetup', 'add-venue', 'update-venue', 'set-settings', 'add-photo', 'remove-photo'])

// What admins can change about the club, with how each is checked.
const SETTINGS = {
  default_time: (v) => text(v, 40, 'The usual time', true),
  fee: (v) => text(v, 60, 'The fee'),
  overdue_weeks: (v) => {
    const n = Number(v)
    if (!Number.isInteger(n) || n < 1 || n > 52) throw new Problem(400, 'Weeks before a loan counts as long should be between 1 and 52.')
    return String(n)
  },
  // Up to five books for the home page, in order: their links or addresses,
  // one per line or comma-separated. Any spots left over fill themselves.
  featured: (v) => {
    const slugs = String(v ?? '')
      .split(/[\s,]+/)
      .map((s) => s.replace(/^.*\/book\//, '').replace(/[/?#].*$/, ''))
      .filter(Boolean)
    if (slugs.length > 5) throw new Problem(400, 'Pick up to five books for the home page.')
    if (slugs.some((s) => !/^[a-z0-9-]{1,120}$/.test(s))) throw new Problem(400, 'Give the home page books as links, like https://hyderabadreads.fun/book/animal-farm-orwell')
    return slugs.join(',')
  },
  instagram: (v) => {
    const s = text(v, 200, 'The Instagram address', true)
    if (!/^https:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/.test(s)) throw new Problem(400, 'The Instagram address should look like https://www.instagram.com/hyderabadreads')
    return s
  },
}

function text(value, max, label, required = false) {
  const s = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (required && !s) throw new Problem(400, `${label} can’t be empty.`)
  if (s.length > max) throw new Problem(400, `${label} is too long.`)
  return s
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

export async function adminCalendar(db) {
  const [meetups, venues, settings, photos] = await db.batch([
    [
      `SELECT mt.id, to_char(mt.date, 'YYYY-MM-DD') AS date, v.name AS venue, mt.time, mt.note, mt.cancelled
       FROM meetups mt JOIN venues v ON v.id = mt.venue_id
       WHERE mt.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - 7
       ORDER BY mt.date, v.name`,
    ],
    [`SELECT id, name, area, time FROM venues ORDER BY lower(name)`],
    [`SELECT key, value FROM settings`],
    [PHOTOS_QUERY],
  ])
  return { meetups, venues, settings: Object.fromEntries(settings.map((s) => [s.key, s.value])), photos }
}

async function venueId(db, name) {
  const v = await db.one('SELECT id FROM venues WHERE name = $1', [name ?? ''])
  if (!v) throw new Problem(400, 'Choose one of the venues, or add the new one first.')
  return v.id
}

export async function calendarAction(db, input) {
  switch (input.action) {
    // One date or several at once ("every Saturday in November at Chilaka").
    case 'add-meetups': {
      const dates = [...new Set([input.dates ?? []].flat())].filter(isDate)
      if (!dates.length) throw new Problem(400, 'Pick at least one date.')
      if (dates.length > 40) throw new Problem(400, 'That’s a lot of meetups at once. Add up to 40.')
      const venue = await venueId(db, input.venue)
      const time = text(input.time, 40, 'The time') || null
      const note = text(input.note, 200, 'The note')
      await db.batch(
        dates.map((d) => [
          `INSERT INTO meetups (date, venue_id, time, note) VALUES ($1, $2, $3, $4) ON CONFLICT (date, venue_id) DO NOTHING`,
          [d, venue, time, note],
        ]),
      )
      return { added: dates.length }
    }
    case 'update-meetup': {
      const id = Number(input.id) || 0
      if (!(await db.one('SELECT 1 FROM meetups WHERE id = $1', [id]))) throw new Problem(404, 'That meetup isn’t on the calendar any more.')
      const changes = []
      if (input.venue !== undefined) changes.push(['venue_id', await venueId(db, input.venue)])
      if (input.time !== undefined) changes.push(['time', text(input.time, 40, 'The time') || null])
      if (input.note !== undefined) changes.push(['note', text(input.note, 200, 'The note')])
      if (input.cancelled !== undefined) changes.push(['cancelled', Boolean(input.cancelled)])
      if (!changes.length) throw new Problem(400, 'Nothing to change.')
      try {
        await db.query(`UPDATE meetups SET ${changes.map(([k], i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...changes.map(([, v]) => v)])
      } catch (err) {
        if (err.code === '23505') throw new Problem(409, 'There’s already a meetup at that venue on that day.')
        throw err
      }
      return {}
    }
    case 'delete-meetup':
      await db.query('DELETE FROM meetups WHERE id = $1', [Number(input.id) || 0])
      return {}
    case 'add-venue': {
      const name = text(input.name, 60, 'The venue’s name', true)
      const row = await db.one(
        'INSERT INTO venues (name, area, time) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING RETURNING id',
        [name, text(input.area, 60, 'The area'), text(input.time, 40, 'The usual time') || null],
      )
      if (!row) throw new Problem(409, `${name} is already a venue.`)
      return {}
    }
    case 'update-venue': {
      const id = Number(input.id) || 0
      await db.query('UPDATE venues SET area = $2, time = $3 WHERE id = $1', [id, text(input.area, 60, 'The area'), text(input.time, 40, 'The usual time') || null])
      return {}
    }
    case 'set-settings': {
      const entries = Object.entries(input.settings ?? {}).filter(([k]) => SETTINGS[k])
      if (!entries.length) throw new Problem(400, 'Nothing to change.')
      await db.batch(
        entries.map(([k, v]) => [
          `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [k, SETTINGS[k](v)],
        ]),
      )
      return {}
    }
    case 'add-photo':
      return addPhoto(db, input)
    case 'remove-photo':
      await removePhoto(db, input.id)
      return {}
    default:
      throw new Problem(400, 'Unknown action.')
  }
}
