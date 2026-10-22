// The blog (/blog): the posts are in the page already (server/page.js), so
// this only brings the shared styles and offline support, and counts the
// posts people open.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/fraunces/opsz-italic.css'
import '@fontsource-variable/inter'
import './styles.css'
import './lib/pwa.js'
import { trackPostOpens } from './lib/track.js'

trackPostOpens()
