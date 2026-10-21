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

export { meetupClock } from '../src/lib/meetup-time.js'

export function longDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
