// Facts about the club and the site that the server writes into pages and feeds.
export const SITE = 'https://hyderabadreads.fun'
export const NAME = 'Hyderabad Reads'
export const GITHUB = 'https://github.com/piyushbodaa/hyderabadreads'
export const ABOUT =
  'Hyderabad Reads is a weekend book club in Hyderabad, India. Its website is a shared bookshelf: members list the books ' +
  'they are happy to lend or swap, and anyone in the club can ask a book’s owner to bring it to the next meetup.'
export const MEETUP_FORMAT =
  'Everyone brings a book they’re reading, reads quietly for a while, then the group chats about what they’re reading.'

// "Today" for the club is today in Hyderabad, whatever timezone the server runs in.
export function todayInIndia(now = new Date()) {
  return new Date(now.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10)
}

// "1 to 4 PM" → 13:00 to 16:00 IST, "2:30 to 5:30 PM" → 14:30 to 17:30.
export function meetupClock(date, time) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|–)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(time ?? '')
  if (!m) return {}
  const at = (h, min = '00', half) => `${String((+h % 12) + (half.toLowerCase() === 'pm' ? 12 : 0)).padStart(2, '0')}:${min}`
  const end = at(m[4], m[5], m[6])
  let start = at(m[1], m[2], m[3] ?? m[6])
  if (start > end) start = at(m[1], m[2], 'am')
  return { start: `${date}T${start}:00+05:30`, end: `${date}T${end}:00+05:30` }
}

export function longDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
