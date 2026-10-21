// llms.txt, llms-full.txt, library.json, sitemap.xml and meetups.ics.
import { database } from '../server/neon.js'
import { feedResponse, guard } from '../server/handlers.js'

const handle = guard(feedResponse)

export default {
  fetch: (request) => handle(request, { get db() { return database() } }),
}
