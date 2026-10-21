// What newcomers ask, answered once and used twice: on the home page, and as
// schema.org FAQ data for search engines. Only facts the club has confirmed:
// read then chat, a small fee, and no sign-up.
export function faq({ club = {}, meetups = [] } = {}) {
  const fee = club.fee?.trim()
  const venues = [...new Map(meetups.filter((m) => !m.cancelled).map((m) => [m.venue, m.area])).entries()]
  const where = venues.length
    ? `At cafés around Hyderabad: ${venues.map(([v, a]) => (a ? `${v} in ${a}` : v)).join(', ')}. The calendar has the dates and times.`
    : 'At cafés around Hyderabad. The calendar has the dates and venues.'
  return [
    { q: 'Do I need to sign up first?', a: 'No. Just come along to any meetup on the calendar.' },
    { q: 'What happens at a meetup?', a: 'Everyone brings a book they’re reading and reads quietly for a while. Then the group chats about what they’re reading.' },
    { q: 'What should I bring?', a: 'A book you’re reading. Any book, in any language.' },
    { q: 'What does it cost?', a: fee ? `There’s a small fee to attend: ${fee}.` : 'There’s a small fee to attend.' },
    { q: 'Where are the meetups?', a: where },
    {
      q: 'How does borrowing work?',
      a: 'Members put the books they’re happy to lend on these shelves. Open one, ask its owner to bring it to the next meetup, and give it back when you’re done.',
    },
    { q: 'How do I put my own books on the shelf?', a: 'Once you’re coming along, ask Piyush on the club group for your personal sign-in link, then add your books on My shelf.' },
  ]
}
