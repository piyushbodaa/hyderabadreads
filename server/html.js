// Escaping for text written into HTML, and for JSON inside a <script> tag.
export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

// "<" can't close the script tag, and the two Unicode line separators that are
// legal in JSON but not in older JavaScript are escaped too.
const SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, 'g')

export function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(SEPARATORS, (c) => `\\u${c.charCodeAt(0).toString(16)}`)
}
