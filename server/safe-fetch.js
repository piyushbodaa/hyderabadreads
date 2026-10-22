// Fetching from other websites on a member's say-so: their blog's feed, its
// pages and its pictures. An address typed into the site mustn't reach
// anything private, so:
// - only http and https on their usual ports, with no password in the address;
// - a name is resolved as the connection opens, and refused there unless every
//   address it has is on the public internet (not this machine, a home or
//   office network, or a cloud's metadata service), so it can't pass a check
//   and then point somewhere else;
// - redirects are followed one at a time, each checked the same way;
// - there's a time limit, and a cap on how much is read.
// Tests pass in their own fetch, so they never touch the network.
import { lookup as dnsLookup } from 'node:dns'
import { isIP } from 'node:net'
import { Agent, fetch as undiciFetch } from 'undici'
import { Problem } from './members.js'

export const USER_AGENT = 'HyderabadReads/1.0 (+https://hyderabadreads.fun/blog)'

export async function fetchPublic(href, { fetch = publicFetch, accept = '*/*', maxBytes = 4e6, timeout = 10000 } = {}) {
  let url = checkUrl(href)
  for (let hop = 0; hop < 5; hop++) {
    let res
    try {
      res = await fetch(url.href, { redirect: 'manual', headers: { 'User-Agent': USER_AGENT, Accept: accept }, signal: AbortSignal.timeout(timeout) })
    } catch (err) {
      // Worth trying again later, unlike an address that answers with an error.
      throw Object.assign(new Problem(502, unreachable(url, err)), { transient: true })
    }
    const to = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && to) {
      await res.body?.cancel()
      url = checkUrl(new URL(to, url).href)
      continue
    }
    if (!res.ok) {
      await res.body?.cancel()
      throw new Problem(502, `${url.hostname} answered with an error (${res.status}).`)
    }
    return { url, type: (res.headers.get('content-type') ?? '').toLowerCase(), body: await readCapped(res, maxBytes, url) }
  }
  throw new Problem(502, 'That address sends us round in circles (too many redirects).')
}

// The shape of an address: what can be judged without looking the name up.
export function checkUrl(href) {
  let url
  try {
    url = new URL(href)
  } catch {
    throw new Problem(400, 'That doesn’t look like a web address.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Problem(400, 'Use a web address that starts with https://')
  if (url.username || url.password || url.port) throw new Problem(400, 'Use the site’s ordinary address, without a port or a password in it.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const local = isIP(host) ? !isPublicAddress(host) : !host.includes('.') || /(^|\.)(localhost|local|internal|lan|home\.arpa)\.?$/i.test(host)
  if (local) throw new Problem(400, 'That address isn’t on the public internet.')
  return url
}

// Only global unicast addresses: IPv4 outside the private, shared, loopback,
// link-local, documentation, multicast and reserved ranges, and IPv6 in
// 2000::/3, with IPv4 carried inside IPv6 judged as IPv4.
const PRIVATE_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]
const v4 = (ip) => ip.split('.').reduce((n, part) => n * 256 + Number(part), 0)
const publicV4 = (ip) => !PRIVATE_V4.some(([base, bits]) => Math.floor(v4(ip) / 2 ** (32 - bits)) === Math.floor(v4(base) / 2 ** (32 - bits)))

export function isPublicAddress(ip) {
  const kind = isIP(ip)
  if (kind === 4) return publicV4(ip)
  if (kind !== 6) return false
  const g = groups6(ip)
  const inner = () => publicV4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`)
  const zeros = (n) => g.slice(0, n).every((x) => x === 0)
  if (zeros(5) && g[5] === 0xffff) return inner() // ::ffff:a.b.c.d
  if (zeros(6)) return g[6] === 0 && g[7] <= 1 ? false : inner() // ::, ::1, ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return inner() // NAT64
  if (g[0] === 0x2002) return publicV4(`${g[1] >> 8}.${g[1] & 255}.${g[2] >> 8}.${g[2] & 255}`) // 6to4
  if (g[0] === 0x2001 && (g[1] === 0 || g[1] === 0xdb8)) return false // Teredo, documentation
  return (g[0] & 0xe000) === 0x2000
}

// "2001:db8::1" → eight 16-bit numbers.
function groups6(ip) {
  let s = ip.toLowerCase().split('%')[0]
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    const n = v4(dotted[1])
    s = `${s.slice(0, -dotted[1].length)}${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`
  }
  const [head, tail] = s.includes('::') ? s.split('::') : [s, null]
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  return [...h, ...(tail === null ? [] : Array(8 - h.length - t.length).fill('0')), ...t].map((x) => parseInt(x, 16))
}

// The check made as each connection opens (see the top of this file).
function publicLookup(hostname, options, callback) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err)
    if (!addresses.length || !addresses.every((a) => isPublicAddress(a.address))) {
      return callback(Object.assign(new Error(`${hostname} isn’t on the public internet`), { code: 'ENOTPUBLIC' }))
    }
    if (options?.all) callback(null, addresses)
    else callback(null, addresses[0].address, addresses[0].family)
  })
}

let agent
function publicFetch(url, init) {
  agent ??= new Agent({ connect: { lookup: publicLookup, timeout: 8000 } })
  return undiciFetch(url, { ...init, dispatcher: agent })
}

function unreachable(url, err) {
  const code = err?.cause?.code ?? err?.code
  if (code === 'ENOTPUBLIC') return 'That address isn’t on the public internet.'
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return `Couldn’t find ${url.hostname}. Check the address.`
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return `${url.hostname} took too long to answer.`
  return `Couldn’t reach ${url.hostname}.`
}

async function readCapped(res, max, url) {
  if (Number(res.headers.get('content-length')) > max) {
    await res.body?.cancel()
    throw new Problem(413, `${url.hostname} sent more than we can read.`)
  }
  const chunks = []
  let size = 0
  for await (const chunk of res.body ?? []) {
    size += chunk.length
    if (size > max) throw new Problem(413, `${url.hostname} sent more than we can read.`)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
