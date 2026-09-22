/*
 * Browser-facing protection for the player API (port 5005), same idea as
 * backend-api/src/request-guard.ts: every GET here is a command (play, stop, volume, shutdown ...),
 * and with `Access-Control-Allow-Origin: *` and no other check any web page could send them through
 * a visitor's browser, e.g. with an <img src="http://box:5005/...">.
 *
 *  - Host header allowlist (anti DNS rebinding): localhost, IP literals, the box's hostname.
 *  - Requests the browser marks as cross-site (Sec-Fetch-Site) are refused; for unsafe methods a
 *    foreign Origin is refused as well (browsers without Fetch Metadata).
 *  - CORS answers only for the box's own pages (kiosk, remote control on port 8200).
 *
 * Callers without these headers (backend-api, Telegram bot, scripts) are not affected.
 */
const os = require('node:os')

const LOCAL_SUFFIXES = ['local', 'lan', 'home', 'fritz.box', 'localdomain', 'home.arpa', 'box', 'speedport.ip', 'internal']

function hostnameOf(hostHeader) {
  if (!hostHeader) return ''
  const h = String(hostHeader).trim().toLowerCase()
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1)
  return h.split(':')[0]
}

function isAllowedHost(hostHeader) {
  const host = hostnameOf(hostHeader)
  if (host === '') return true
  if (host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || (host.startsWith('[') && host.endsWith(']'))) {
    return true
  }
  const boxName = os.hostname().toLowerCase()
  return host === boxName || LOCAL_SUFFIXES.some((suffix) => host === `${boxName}.${suffix}`)
}

function isSameHostOrigin(req) {
  const origin = req.headers.origin
  if (!origin || origin === 'null') return false
  try {
    const url = new URL(origin)
    return url.hostname.toLowerCase() === hostnameOf(req.headers.host) && isAllowedHost(url.host)
  } catch {
    return false
  }
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function reject(req, res, reason) {
  console.warn(
    `${new Date().toLocaleString()}: [Spotify Control] Refused ${req.method} ${req.path} (${reason}; host=${req.headers.host || ''} origin=${req.headers.origin || ''})`,
  )
  res.status(403).send('forbidden')
}

function browserGuard(req, res, next) {
  if (!isAllowedHost(req.headers.host)) return reject(req, res, 'host not allowed')
  if (req.headers['sec-fetch-site'] === 'cross-site') return reject(req, res, 'cross-site request')
  if (UNSAFE_METHODS.has(req.method) && req.headers.origin !== undefined && !isSameHostOrigin(req)) {
    return reject(req, res, 'foreign origin')
  }
  if (isSameHostOrigin(req)) {
    res.header('Access-Control-Allow-Origin', req.headers.origin)
    res.header('Vary', 'Origin')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  }
  next()
}

module.exports = { browserGuard }
