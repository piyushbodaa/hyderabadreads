// Talking to the site's own API, and the bits of page furniture the members'
// pages share.

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Something went wrong (${res.status}). Please try again.`), { status: res.status })
  return data
}

// The non-secret cookie the server sets alongside the sign-in one.
export const looksSignedIn = () => document.cookie.split(';').some((c) => c.trim().startsWith('hr_member=1'))

export function toaster(el) {
  let timer
  return (message) => {
    el.textContent = message
    el.classList.add('is-on')
    clearTimeout(timer)
    timer = setTimeout(() => el.classList.remove('is-on'), 3600)
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text })
    area.style.cssText = 'position:fixed;opacity:0'
    document.body.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

export const whatsappLink = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`
