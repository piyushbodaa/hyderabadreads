// Link-preview images: /og/book/:slug.jpg and /og/shelf/:slug.jpg.
import { database } from '../server/neon.js'
import { ogResponse, guard } from '../server/handlers.js'

const handle = guard(ogResponse)

export default {
  fetch: (request) => handle(request, { get db() { return database() } }),
}
