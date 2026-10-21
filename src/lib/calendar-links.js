// Getting meetups into people's own calendars: one meetup at a time (Google
// Calendar, or an .ics file for Apple and Outlook), or all of them, kept up to
// date, by subscribing to /meetups.ics.
import { meetupClock, calendarStamp } from './meetup-time.js'

export const mapsLink = (m) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.venue}, ${m.area}, Hyderabad`)}`

export function googleEventLink(m, origin = location.origin) {
  const { start, end } = meetupClock(m.date, m.time)
  const day = m.date.replace(/-/g, '')
  const dates = start ? `${calendarStamp(start)}/${calendarStamp(end)}` : `${day}/${day}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Hyderabad Reads at ${m.venue}`,
    dates,
    ctz: 'Asia/Kolkata',
    location: `${m.venue}${m.area ? `, ${m.area}` : ''}, Hyderabad`,
    details: `Bring a book you’re reading. We read quietly for a while, then chat.\n${origin}/#calendar`,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

export const icsLink = (m) => `/meetups.ics?only=${m.date}`

export function subscribeLinks(origin = location.origin) {
  const feed = `${origin.replace(/^https?:/, 'webcal:')}/meetups.ics`
  return { webcal: feed, google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed)}` }
}
