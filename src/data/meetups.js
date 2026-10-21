// ─────────────────────────────────────────────────────────────────────────────
//  HYDERABAD READS · MEETUPS
//
//  The meetup calendar on the site. Each month, add that month's dates to the
//  `meetups` list: a `date` (YYYY-MM-DD) and a `venue` from VENUES below.
//
//  Add `time` to a single date only if it differs from that venue's usual time.
//  For a new venue, add it to VENUES with its area first.
//
//  The site shows the month with the next meetup in it, and fades out dates
//  that have passed. Old months can stay here or be deleted, either is fine.
// ─────────────────────────────────────────────────────────────────────────────

export const INSTAGRAM = 'https://www.instagram.com/hyderabadreads'

// Usual timings, unless a venue or a date says otherwise.
export const TIME = '1 to 4 PM'

export const VENUES = {
  'Third Wave Coffee': { area: 'Banjara Hills' },
  Socialx: { area: 'Madhapur' },
  Chilaka: { area: 'Jubilee Hills' },
  PUP: { area: 'Jubilee Hills', time: '2:30 to 5:30 PM' },
}

export const meetups = [
  // October 2026
  { date: '2026-10-03', venue: 'Third Wave Coffee' },
  { date: '2026-10-04', venue: 'Socialx' },
  { date: '2026-10-10', venue: 'Chilaka' },
  { date: '2026-10-11', venue: 'PUP' },
  { date: '2026-10-17', venue: 'Socialx' },
  { date: '2026-10-18', venue: 'Third Wave Coffee' },
  { date: '2026-10-24', venue: 'Chilaka' },
  { date: '2026-10-25', venue: 'PUP' },
  { date: '2026-10-31', venue: 'Socialx' },
]
