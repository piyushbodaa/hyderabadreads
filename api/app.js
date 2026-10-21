// The members' API (/api/*), sign-in links (/join/:token) and uploaded images
// (/media/:file). See the rewrites in vercel.json.
import { database } from '../server/neon.js'
import { appResponse } from '../server/app.js'
import { guard } from '../server/handlers.js'

const handle = guard(appResponse)

export default {
  fetch: (request) => handle(request, { get db() { return database() } }),
}
