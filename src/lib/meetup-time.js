// Meetup timings are written the way people say them ("1 to 4 PM",
// "2:30 to 5:30 PM"). This turns one into start and end times in Hyderabad,
// for calendars and structured data. Used by the server and the browser.
export function meetupClock(date, time) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|–)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(time ?? '')
  if (!m) return {}
  const at = (h, min = '00', half) => `${String((+h % 12) + (half.toLowerCase() === 'pm' ? 12 : 0)).padStart(2, '0')}:${min}`
  const end = at(m[4], m[5], m[6])
  let start = at(m[1], m[2], m[3] ?? m[6])
  if (start > end) start = at(m[1], m[2], 'am')
  return { start: `${date}T${start}:00+05:30`, end: `${date}T${end}:00+05:30` }
}

// 2026-10-24T13:00:00+05:30 → 20261024T073000Z, as calendars want it.
export const calendarStamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
