// Synology's own web API (DSM) for the albums of Synology Photos (synology.ts): an address, an account and its password of
// their own (best an account just for the box, that sees only what is shared with it). https with Synology's own,
// self-signed certificate: trusted by the fingerprint the parents confirmed - the connection is made, its certificate
// compared, and only then is anything (the login) sent over it. One login per address, account and password, kept until
// DSM forgets it; a refused login is not tried again for 10 minutes with the same data (DSM blocks an address after a
// few), unless asked anew (the test).

import { createHash } from 'node:crypto'
import https from 'node:https'
import net from 'node:net'
import { Readable } from 'node:stream'
import tls from 'node:tls'
import { RemoteAway, RemoteRefused } from './remote'

export interface DsmTarget {
  /** https://host:port or http://host:port */
  url: string
  account: string
  password: string
  /** the confirmed certificate's SHA-256 fingerprint ("AB:CD:…"); none: a certificate the system trusts, or http */
  fingerprint?: string
}

export interface DsmCertificateInfo {
  fingerprint: string
  subject: string
  issuer: string
  validTo: string
}

/**
 * DSM refused the login: 400 the name or the password, 401 the account is off, 402 it may not use Synology Photos,
 * 403/404/406 it asks for a second factor, 407 the box's address is blocked (too many wrong logins), 408-410 the password
 * expired.
 */
export class DsmLoginRefused extends RemoteRefused {
  constructor(readonly code: number) {
    super(code === 402 ? 403 : 401, 'Synology (login)')
  }
}

/** The certificate is not trusted: self-signed and not confirmed yet, or not the one confirmed (renewed on the NAS) */
export class DsmCertificateError extends RemoteAway {
  constructor(readonly certificate: DsmCertificateInfo | undefined) {
    super('Synology: certificate not trusted')
  }
}

const info = (cert: tls.PeerCertificate | undefined): DsmCertificateInfo | undefined =>
  cert?.fingerprint256
    ? { fingerprint: cert.fingerprint256, subject: String(cert.subject?.CN ?? cert.subject?.O ?? ''), issuer: String(cert.issuer?.CN ?? cert.issuer?.O ?? ''), validTo: String(cert.valid_to ?? '') }
    : undefined

/** What DSM presents on https without trusting it - and whether the system's authorities vouch for it (no confirming then) */
export function peekCertificate(url: string, timeoutMs = 8000): Promise<{ certificate?: DsmCertificateInfo; trusted: boolean } | undefined> {
  const u = new URL(url)
  if (u.protocol !== 'https:') return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const host = u.hostname.replace(/^\[|\]$/g, '')
    const socket = tls.connect({ host, port: Number(u.port || 443), servername: net.isIP(host) ? undefined : host, rejectUnauthorized: false, timeout: timeoutMs })
    const done = (v: { certificate?: DsmCertificateInfo; trusted: boolean } | undefined) => {
      socket.destroy()
      resolve(v)
    }
    socket.once('secureConnect', () => done({ certificate: info(socket.getPeerCertificate()), trusted: socket.authorized }))
    socket.once('timeout', () => done(undefined))
    socket.once('error', () => done(undefined))
  })
}

// a request over a connection whose certificate is the confirmed one (fetch() refuses a self-signed one)
function pinned(url: URL, fingerprint: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }): Promise<Response> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  return new Promise<tls.TLSSocket>((resolve, reject) => {
    const s = tls.connect({ host, port: Number(url.port || 443), servername: net.isIP(host) ? undefined : host, rejectUnauthorized: false })
    const onAbort = () => {
      s.destroy()
      reject(init.signal.reason ?? new Error('aborted'))
    }
    if (init.signal.aborted) return onAbort()
    init.signal.addEventListener('abort', onAbort, { once: true })
    s.once('secureConnect', () => {
      init.signal.removeEventListener('abort', onAbort)
      const cert = s.getPeerCertificate()
      if (!cert?.fingerprint256 || cert.fingerprint256.toUpperCase() !== fingerprint.toUpperCase()) {
        s.destroy()
        reject(new DsmCertificateError(info(cert)))
        return
      }
      resolve(s)
    })
    s.once('error', (error) => {
      init.signal.removeEventListener('abort', onAbort)
      reject(error)
    })
  }).then(
    (socket) =>
      new Promise<Response>((resolve, reject) => {
        const req = https.request(
          { method: init.method, hostname: host, port: Number(url.port || 443), path: `${url.pathname}${url.search}`, headers: init.headers, createConnection: () => socket, signal: init.signal },
          (res) => {
            const headers = new Headers()
            for (const [name, value] of Object.entries(res.headers)) {
              if (Array.isArray(value)) for (const v of value) headers.append(name, v)
              else if (value !== undefined) headers.set(name, String(value))
            }
            const status = res.statusCode ?? 502
            // (no body with 204/205/304; a status outside 200-599 is refused by Response - a failed request instead)
            const noBody = status === 204 || status === 205 || status === 304
            try {
              if (status < 200 || status > 599) throw new Error(`unexpected status ${status}`)
              if (noBody) res.resume()
              resolve(new Response(noBody ? null : (Readable.toWeb(res) as unknown as ReadableStream), { status, statusText: res.statusMessage, headers }))
            } catch (err) {
              res.destroy()
              reject(err)
            }
          },
        )
        req.once('error', (error) => {
          socket.destroy()
          reject(error)
        })
        req.end(init.body)
      }),
  )
}

// (stop: the caller's own abort - passed on as it is; the time limit running out in signal is DSM not answering)
async function post(target: DsmTarget, form: Record<string, string>, signal: AbortSignal, stop?: AbortSignal): Promise<Response> {
  const url = new URL(`${target.url}/webapi/entry.cgi`)
  const init = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(), signal }
  try {
    return url.protocol === 'https:' && target.fingerprint ? await pinned(url, target.fingerprint, init) : await fetch(url, { ...init, redirect: 'error' })
  } catch (err) {
    if (stop?.aborted) throw err
    if (err instanceof DsmCertificateError) throw err
    // (https without a confirmed fingerprint, and the system does not trust the certificate: to be confirmed)
    const code = String((err as { cause?: { code?: unknown } })?.cause?.code ?? '')
    if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/i.test(code)) throw new DsmCertificateError((await peekCertificate(target.url))?.certificate)
    throw new RemoteAway(`Synology: ${(err as Error).message}`)
  }
}

const sessions = new Map<string, string>()
const logins = new Map<string, Promise<string>>()
const refused = new Map<string, { code: number; until: number }>()

async function session(target: DsmTarget, fresh: boolean): Promise<string> {
  const key = createHash('sha256').update(`${target.url}\n${target.account}\n${target.password}`).digest('hex')
  const kept = sessions.get(key)
  if (!fresh && kept) return kept
  const no = refused.get(key)
  if (!fresh && no && Date.now() < no.until) throw new DsmLoginRefused(no.code)
  let running = logins.get(key)
  if (!running) {
    running = (async () => {
      // (session "webui": DSM refuses "SynologyPhotos" to an account that may use the app - 402)
      const r = await post(target, { api: 'SYNO.API.Auth', version: '7', method: 'login', account: target.account, passwd: target.password, session: 'webui', format: 'sid' }, AbortSignal.timeout(20_000))
      const j = (await r.json().catch(() => null)) as { success?: boolean; data?: { sid?: string }; error?: { code?: number } } | null
      if (j?.success === true && typeof j.data?.sid === 'string') {
        sessions.set(key, j.data.sid)
        refused.delete(key)
        return j.data.sid
      }
      if (!j) throw new RemoteAway(`Synology: answered ${r.status}`)
      const code = Number(j.error?.code) || 0
      refused.set(key, { code, until: Date.now() + 10 * 60_000 })
      throw new DsmLoginRefused(code)
    })().finally(() => logins.delete(key))
    logins.set(key, running)
  }
  const sid = await running
  return sid
}

/**
 * A question to DSM's webapi/entry.cgi with these parameters, the login added (and made again once when DSM forgot it).
 * fresh: the login asked anew (the test). The answer as it comes - a file, or DSM's JSON.
 */
export async function dsmCall(target: DsmTarget, params: Record<string, string>, init: { signal?: AbortSignal; timeoutMs?: number; fresh?: boolean } = {}): Promise<Response> {
  const signal = AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(init.timeoutMs ?? 30_000)])
  const key = createHash('sha256').update(`${target.url}\n${target.account}\n${target.password}`).digest('hex')
  for (let attempt = 0; ; attempt++) {
    const sid = await session(target, init.fresh === true && attempt === 0)
    const r = await post(target, { ...params, _sid: sid }, signal, init.signal)
    // (an answer in JSON may say the session is gone - 106 timed out, 107 a login elsewhere, 119 unknown: once more with
    // a new login)
    if (!/json/i.test(r.headers.get('content-type') ?? '')) return r
    const text = await r.text().catch((err: Error) => {
      if (init.signal?.aborted) throw err
      throw new RemoteAway(`Synology: ${err.message}`)
    })
    let code = 0
    try {
      const j = JSON.parse(text) as { success?: boolean; error?: { code?: number } }
      if (j?.success === false) code = Number(j.error?.code) || 0
    } catch {
      // (not JSON after all: passed on as it is)
    }
    if ([106, 107, 119].includes(code) && attempt === 0) {
      if (sessions.get(key) === sid) sessions.delete(key)
      continue
    }
    return new Response(text, { status: r.status, headers: r.headers })
  }
}
