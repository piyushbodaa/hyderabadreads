// Who's signed in on the home page, and the club's lending as they see it.
// Pages are cached for everyone, so this comes separately, from /api/me, and
// only when the hint cookie says someone is signed in.
import { api, looksSignedIn } from './api.js'
import { books, meetups } from './model.js'

export const session = { member: null, lending: null }
const listeners = new Set()
export const onSession = (fn) => listeners.add(fn)

export async function loadSession() {
  if (!looksSignedIn()) return session
  try {
    apply(await api('/api/me'))
  } catch {
    // Signed out elsewhere, or offline: the page works as it does for visitors.
  }
  return session
}

// Takes /api/me or a lending action's answer, and tells the page.
export function apply(data) {
  if ('member' in data) session.member = data.member
  if (data.lending) session.lending = data.lending
  if (session.lending) {
    const out = new Map(session.lending.out.map((l) => [l.bookId, l]))
    for (const b of books) {
      const loan = out.get(b.id)
      b.onLoan = Boolean(loan)
      b.onLoanTo = loan?.borrower ?? null
      b.overdue = Boolean(loan?.overdue)
    }
  }
  listeners.forEach((fn) => fn(session))
}

export async function lend(action, fields) {
  const data = await api('/api/loans', { method: 'POST', body: { action, ...fields } })
  apply(data)
  return data
}

export const mine = (book) => session.member && book.owner === session.member.name
export const askedFor = (book) => session.lending?.asked.find((l) => l.bookId === book.id)
export const borrowedByMe = (book) => session.lending?.borrowed.find((l) => l.bookId === book.id)
export const lentOut = (book) => session.lending?.lentOut.find((l) => l.bookId === book.id)

// The next meetup that isn't cancelled, in the browser's own today.
export function nextMeetup(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return [...meetups].sort((a, b) => a.date.localeCompare(b.date)).find((m) => m.date >= today && !m.cancelled) ?? null
}

// "Saturday’s meetup at Chilaka (24 Oct)", or "today’s meetup at Chilaka".
export function meetupPhrase(m, now = new Date()) {
  if (!m) return 'the next Hyderabad Reads meetup'
  const date = new Date(`${m.date}T00:00`)
  const isToday = date.toDateString() === now.toDateString()
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' })
  const short = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return isToday ? `today’s meetup at ${m.venue}` : `${weekday}’s meetup at ${m.venue} (${short})`
}

export const shortDate = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
