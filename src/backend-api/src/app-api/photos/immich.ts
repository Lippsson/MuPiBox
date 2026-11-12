// The photo display's Immich albums (5.1, Bibliothek › Fotos › Immich): albums of an Immich server in the home network
// (address and an API key with read rights) become albums on the display. Two ways (Fotos auf der Box speichern):
//   on (default): the box fetches Immich's own display size of each picture ("preview"), makes the display's sizes of
//                 it (process.ts) and keeps them in cache/photos/immich - shown also while Immich is away;
//   off (live):   only the list of the pictures is kept; a picture comes from Immich when it is shown (its "thumbnail"
//                 for the grid, its "preview" for the full view), the ones shown last in a small cache. Immich away:
//                 such an album is "gerade nicht da".
// A sync now and then (and on request) takes new, changed and gone pictures and the albums' names over. Albums of
// Immich are only looked at in the app: changes happen in Immich. The key is kept encrypted and never shown again.

import { randomBytes } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Request, Response, Router } from 'express'
import type { MupiboxConfig } from '../../models/mupibox-config.model'
import { requireCsrf, requireSession } from '../middleware'
import { NotAPicture, PhotoAborted, photoFiles, processPhoto } from './process'
import { photoSettings } from './settings'
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, videoQueue } from './video'
import { albumDir, albums, rejectedClips, assetBase, cardSpace, IMMICH_LIVE_DIR, IMMICH_PHOTO_DIR, INCOMING_DIR, newId, type PhotoAlbum, type PhotoAsset, PHOTOS_DIR, photoBytes, update } from './store'

export interface PhotoImmichDeps {
  getMupiboxConfig: () => MupiboxConfig | undefined
  updateMupiboxConfig: (mutate: (cfg: Record<string, unknown>) => void) => Promise<void>
  /** the box's way to keep a secret in the config (the NAS password's) */
  secret?: { encrypt(plain: string): string; decrypt(stored: string): string | undefined }
}

/** The oldest Immich with the API used here (/api/server/version, /api/albums, /api/assets/:id/thumbnail) */
export const IMMICH_MIN_VERSION = { major: 1, minor: 106, patch: 0 }
export const IMMICH_MIN_TEXT = '1.106'

const SYNC_MINUTES = [0, 15, 60, 360, 1440] as const
const CACHE_LIMITS_MB = [0, 500, 1024, 2048, 4096, 8192] as const
// what the live pictures may take at most
const LIVE_CACHE_BYTES = 200 * 1024 * 1024
const ALBUMS_MAX = 100
const PICTURES_MAX = 20_000
const FILE_MAX_BYTES = 30 * 1024 * 1024
const RESERVE_BYTES = 300 * 1024 * 1024
const STATE_FILE = path.join(PHOTOS_DIR, 'immich-sync.json')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ImmichSettings {
  /** the server, http(s)://host:port, without /api */
  url: string
  /** the key as kept (encrypted); '' none */
  apiKey: string
  /** the account the key belongs to (name or e-mail, from the test) */
  account: string | null
  albumIds: string[]
  keepCopy: boolean
  syncMinutes: (typeof SYNC_MINUTES)[number]
  cacheLimitMb: (typeof CACHE_LIMITS_MB)[number]
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** The server's address as the box keeps it: http(s)://host[:port][/path], no "/api", no slash at the end */
export function cleanImmichUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let s = raw.trim()
  if (!s || s.length > 300) return null
  // (another scheme: not an Immich address; none: http)
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s)) return null
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname || u.username || u.password || u.search || u.hash) return null
  const p = u.pathname.replace(/\/+$/, '').replace(/\/api$/i, '')
  return `${u.protocol}//${u.host}${p}`
}

export function immichSettings(cfg: unknown): ImmichSettings {
  const n = obj(obj(obj(obj(cfg).photos).sources).immich)
  return {
    url: cleanImmichUrl(n.url) ?? '',
    apiKey: typeof n.apiKey === 'string' ? n.apiKey : '',
    account: typeof n.account === 'string' && n.account ? n.account.slice(0, 100) : null,
    albumIds: Array.isArray(n.albumIds) ? [...new Set(n.albumIds.filter((x): x is string => typeof x === 'string' && UUID.test(x)))].slice(0, ALBUMS_MAX) : [],
    keepCopy: n.keepCopy !== false,
    syncMinutes: (SYNC_MINUTES as readonly number[]).includes(Number(n.syncMinutes)) ? (Number(n.syncMinutes) as ImmichSettings['syncMinutes']) : 360,
    cacheLimitMb: (CACHE_LIMITS_MB as readonly number[]).includes(Number(n.cacheLimitMb)) ? (Number(n.cacheLimitMb) as ImmichSettings['cacheLimitMb']) : 2048,
  }
}

/** A change from the app, checked (a wrong field: the reason, nothing written); the key comes in plain, kept encrypted */
export function applyImmichSettings(cfg: Record<string, unknown>, patch: unknown, encrypt: (plain: string) => string = (x) => x): string | null {
  const p = obj(patch)
  const next: Record<string, unknown> = { ...obj(obj(obj(cfg.photos).sources).immich) }
  if (p.url !== undefined) {
    const url = cleanImmichUrl(p.url)
    if (!url) return 'url'
    // (the key kept belongs to the server it was given for: another server gets it only typed in anew)
    if (url !== cleanImmichUrl(next.url) && next.apiKey && p.apiKey === undefined) return 'apiKey'
    next.url = url
  }
  if (p.apiKey !== undefined) {
    if (typeof p.apiKey !== 'string' || p.apiKey.trim().length < 10 || p.apiKey.length > 200) return 'apiKey'
    next.apiKey = encrypt(p.apiKey.trim())
  }
  if (p.account !== undefined) {
    if (p.account !== null && typeof p.account !== 'string') return 'account'
    next.account = typeof p.account === 'string' ? p.account.slice(0, 100) : null
  }
  if (p.albumIds !== undefined) {
    if (!Array.isArray(p.albumIds) || p.albumIds.length > ALBUMS_MAX || !p.albumIds.every((x) => typeof x === 'string' && UUID.test(x))) return 'albumIds'
    next.albumIds = [...new Set(p.albumIds as string[])]
  }
  if (p.keepCopy !== undefined) {
    if (typeof p.keepCopy !== 'boolean') return 'keepCopy'
    next.keepCopy = p.keepCopy
  }
  if (p.syncMinutes !== undefined) {
    if (!(SYNC_MINUTES as readonly unknown[]).includes(p.syncMinutes)) return 'syncMinutes'
    next.syncMinutes = p.syncMinutes
  }
  if (p.cacheLimitMb !== undefined) {
    if (!(CACHE_LIMITS_MB as readonly unknown[]).includes(p.cacheLimitMb)) return 'cacheLimitMb'
    next.cacheLimitMb = p.cacheLimitMb
  }
  const photos = { ...obj(cfg.photos) }
  photos.sources = { ...obj(photos.sources), immich: next }
  cfg.photos = photos
  return null
}

/* ---------- talking to Immich ---------- */

export class ImmichAway extends Error {}
export class ImmichRefused extends Error {
  constructor(readonly status: number) {
    super(`Immich answered ${status}`)
  }
}
/** Immich cannot answer now: not reachable, or it (or a proxy in front of it) says it has trouble or too much to do */
export const immichDown = (err: unknown): boolean => err instanceof ImmichAway || (err instanceof ImmichRefused && (err.status >= 500 || err.status === 429))
/** The key is not (or no longer) accepted, or it lacks a right */
const keyRefused = (err: unknown): boolean => err instanceof ImmichRefused && (err.status === 401 || err.status === 403)

interface ImmichAlbum {
  id: string
  albumName: string
  assetCount: number
  albumThumbnailAssetId: string | null
  assets?: ImmichAsset[]
}
export interface ImmichAsset {
  id: string
  type: string
  /** a clip's length, "0:00:24.000000" */
  duration?: string | null
  isTrashed?: boolean
  fileCreatedAt?: string
  localDateTime?: string
  checksum?: string
  updatedAt?: string
  exifInfo?: { exifImageWidth?: number | null; exifImageHeight?: number | null; orientation?: string | number | null } | null
}

export class ImmichClient {
  constructor(
    readonly url: string,
    readonly key: string,
  ) {}

  private async call(
    p: string,
    init: { method?: string; body?: unknown; signal?: AbortSignal; auth?: boolean; headers?: Record<string, string>; timeoutMs?: number } = {},
  ): Promise<globalThis.Response> {
    const headers: Record<string, string> = { Accept: 'application/json', ...init.headers }
    if (init.auth !== false) headers['x-api-key'] = this.key
    if (init.body !== undefined) headers['Content-Type'] = 'application/json'
    const timeout = AbortSignal.timeout(init.timeoutMs ?? 20_000)
    try {
      return await fetch(`${this.url}${p}`, {
        method: init.method ?? 'GET',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
        redirect: 'error',
      })
    } catch (err) {
      if (init.signal?.aborted) throw err
      throw new ImmichAway((err as Error).message)
    }
  }

  async json<T>(p: string, init: { method?: string; body?: unknown; signal?: AbortSignal; auth?: boolean } = {}): Promise<T> {
    const r = await this.call(p, init)
    if (!r.ok) {
      await r.body?.cancel().catch(() => undefined)
      throw new ImmichRefused(r.status)
    }
    try {
      return (await r.json()) as T
    } catch {
      throw new ImmichAway('no JSON')
    }
  }

  /** The server's version; null: an Immich older than 1.106 (or no Immich at all) */
  async version(): Promise<{ major: number; minor: number; patch: number } | null> {
    try {
      const v = await this.json<{ major: number; minor: number; patch: number }>('/api/server/version', { auth: false })
      return Number.isInteger(v.major) && Number.isInteger(v.minor) ? v : null
    } catch (err) {
      if (err instanceof ImmichRefused && err.status === 404) return null
      throw err
    }
  }

  /** Own and shared albums, each once */
  async albums(signal?: AbortSignal): Promise<ImmichAlbum[]> {
    const [own, shared] = await Promise.all([this.json<ImmichAlbum[]>('/api/albums', { signal }), this.json<ImmichAlbum[]>('/api/albums?shared=true', { signal }).catch(() => [] as ImmichAlbum[])])
    const out = new Map<string, ImmichAlbum>()
    for (const a of [...(Array.isArray(own) ? own : []), ...(Array.isArray(shared) ? shared : [])]) if (a && typeof a.id === 'string') out.set(a.id, a)
    return [...out.values()]
  }

  /** An album with its pictures (not trashed); newer Immich versions leave the assets out of the album: searched then */
  async album(id: string, signal?: AbortSignal, videos = false): Promise<{ name: string; assets: ImmichAsset[] }> {
    const a = await this.json<ImmichAlbum>(`/api/albums/${id}?withoutAssets=false`, { signal })
    let assets = Array.isArray(a.assets) ? a.assets : null
    if (!assets || (assets.length === 0 && a.assetCount > 0)) {
      assets = []
      for (let page = 1; page && assets.length < PICTURES_MAX; ) {
        const r = await this.json<{ assets?: { items?: ImmichAsset[]; nextPage?: string | null } }>('/api/search/metadata', {
          method: 'POST',
          body: { albumIds: [id], page, size: 1000, withExif: true },
          signal,
        })
        assets.push(...(r.assets?.items ?? []))
        page = r.assets?.nextPage ? Number(r.assets.nextPage) : 0
      }
    }
    // (clips only with "Videos anzeigen"; a live photo's movie is no asset of its own in the album - its still is)
    return { name: String(a.albumName ?? ''), assets: assets.filter((x) => x && (x.type === 'IMAGE' || (videos && x.type === 'VIDEO')) && !x.isTrashed && UUID.test(x.id)) }
  }

  /** A clip as Immich plays it (made by Immich for browsers - H.264 most often); range: a part of it (the display seeking) */
  async clip(assetId: string, init: { signal?: AbortSignal; range?: string; timeoutMs?: number } = {}): Promise<globalThis.Response> {
    const r = await this.call(`/api/assets/${assetId}/video/playback`, {
      signal: init.signal,
      headers: { Accept: '*/*', ...(init.range ? { Range: init.range } : {}) },
      timeoutMs: init.timeoutMs ?? 30 * 60_000,
    })
    if (!(r.ok || r.status === 206) || !r.body) {
      await r.body?.cancel().catch(() => undefined)
      throw new ImmichRefused(r.status)
    }
    return r
  }

  /** A picture of Immich's (preview: its display size, JPEG; thumbnail: small, WebP or JPEG) */
  async picture(assetId: string, size: 'preview' | 'thumbnail', signal?: AbortSignal): Promise<globalThis.Response> {
    const r = await this.call(`/api/assets/${assetId}/thumbnail?size=${size}`, { signal })
    if (!r.ok || !r.body) {
      await r.body?.cancel().catch(() => undefined)
      throw new ImmichRefused(r.status)
    }
    return r
  }
}

export type ImmichTest =
  | { ok: true; version: string; account: string | null; albums: number; assets: number }
  | { ok: false; error: 'unreachable' | 'unauthorized' | 'permissions' | 'unsupportedVersion' }

/**
 * The test of the assistant: the server there, new enough, the key accepted, and it has the rights the box needs - a key made
 * with chosen rights answers 403 where one is missing: album.read (the albums), asset.view (the pictures, the clips), asset.read
 * (the pictures of an album, searched in newer versions). user.read only gives the name of the account.
 */
export async function testImmich(client: ImmichClient): Promise<ImmichTest> {
  let v: Awaited<ReturnType<ImmichClient['version']>>
  try {
    v = await client.version()
  } catch {
    return { ok: false, error: 'unreachable' }
  }
  if (!v) return { ok: false, error: 'unsupportedVersion' }
  const m = IMMICH_MIN_VERSION
  if (v.major < m.major || (v.major === m.major && v.minor < m.minor)) return { ok: false, error: 'unsupportedVersion' }
  let list: ImmichAlbum[]
  try {
    list = await client.albums()
  } catch (err) {
    if (err instanceof ImmichRefused && err.status === 401) return { ok: false, error: 'unauthorized' }
    if (err instanceof ImmichRefused && err.status === 403) return { ok: false, error: 'permissions' }
    return { ok: false, error: 'unreachable' }
  }
  // (the other rights, tried on an album with a picture: anything but a refusal - an older Immich without the search, say - is no
  // missing right)
  const sample = list.find((a) => typeof a.albumThumbnailAssetId === 'string' && UUID.test(a.albumThumbnailAssetId))
  if (sample) {
    const denied = async (attempt: () => Promise<unknown>) => {
      try {
        await attempt()
        return false
      } catch (err) {
        return err instanceof ImmichRefused && err.status === 403
      }
    }
    if (await denied(async () => (await client.picture(sample.albumThumbnailAssetId as string, 'thumbnail')).body?.cancel())) return { ok: false, error: 'permissions' }
    if (await denied(() => client.json('/api/search/metadata', { method: 'POST', body: { albumIds: [sample.id], page: 1, size: 1 } }))) return { ok: false, error: 'permissions' }
  }
  // (the account: only when the key may read it - a key with the album rights only has no name to show)
  const me = await client.json<{ name?: string; email?: string }>('/api/users/me').catch(() => null)
  return {
    ok: true,
    version: `${v.major}.${v.minor}.${v.patch}`,
    account: me?.name || me?.email || null,
    albums: list.length,
    assets: list.reduce((n, a) => n + (Number(a.assetCount) || 0), 0),
  }
}

/* ---------- the sync ---------- */

interface SyncState {
  running: boolean
  done: number
  total: number
  lastSync: string | null
  offlineSince: string | null
  cacheFull: boolean
  /** the key is no longer accepted (deleted or changed in Immich) */
  unauthorized: boolean
  /** albums chosen that Immich no longer has */
  missing: number
}

// the size of a picture as Immich knows it, turned as it is shown (EXIF orientation 5-8: on its side)
function dims(x: ImmichAsset): { w: number; h: number } {
  const w = Number(x.exifInfo?.exifImageWidth) || 0
  const h = Number(x.exifInfo?.exifImageHeight) || 0
  const o = Number(x.exifInfo?.orientation)
  return o >= 5 && o <= 8 ? { w: h, h: w } : { w, h }
}
const versionOf = (x: ImmichAsset) => String(x.checksum ?? x.updatedAt ?? '')
// a clip's length in seconds from Immich's "H:MM:SS.ffffff"
export const clipSeconds = (d: string | null | undefined): number => {
  const m = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(String(d ?? ''))
  return m ? Math.round(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) : 0
}
const takenOf = (x: ImmichAsset) => {
  const t = x.localDateTime ?? x.fileCreatedAt
  return typeof t === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(t) ? t.slice(0, 19) : null
}

export class ImmichPhotoSync {
  private state: SyncState = { running: false, done: 0, total: 0, lastSync: null, offlineSince: null, cacheFull: false, unauthorized: false, missing: 0 }
  private lastTry = 0
  private again = false
  private stop: AbortController | null = null
  private loaded: Promise<void>

  constructor(private readonly deps: PhotoImmichDeps) {
    this.loaded = fsp
      .readFile(STATE_FILE, 'utf8')
      .then((raw) => {
        const s = obj(JSON.parse(raw))
        this.state.lastSync = typeof s.lastSync === 'string' ? s.lastSync : null
        this.state.offlineSince = typeof s.offlineSince === 'string' ? s.offlineSince : null
        this.state.cacheFull = s.cacheFull === true
        this.state.unauthorized = s.unauthorized === true
      })
      .catch(() => undefined)
  }

  status(): SyncState {
    return { ...this.state }
  }

  /** Immich answered with the key (a live picture came, or the check): it is back - the albums show again before the next sync */
  reachable(): void {
    if (this.state.offlineSince || this.state.unauthorized) {
      this.state.offlineSince = null
      this.state.unauthorized = false
      void this.save()
    }
  }

  /** The client with the key as kept; null: none set up (or the key cannot be read on this box) */
  client(cfg = this.deps.getMupiboxConfig()): ImmichClient | null {
    const s = immichSettings(cfg)
    if (!s.url || !s.apiKey) return null
    const key = this.deps.secret ? this.deps.secret.decrypt(s.apiKey) : s.apiKey
    return key ? new ImmichClient(s.url, key) : null
  }

  start(): void {
    const tick = () => {
      const cfg = this.deps.getMupiboxConfig()
      const s = immichSettings(cfg)
      if (!photoSettings(cfg).enabled || s.syncMinutes === 0 || this.state.running || !s.url) return
      const every = (this.state.offlineSince ? Math.min(15, s.syncMinutes) : s.syncMinutes) * 60_000
      if (Date.now() - this.lastTry >= every) void this.run()
    }
    setTimeout(() => {
      tick()
      setInterval(tick, 60_000).unref?.()
    }, 120_000).unref?.()
  }

  run(): Promise<void> {
    if (this.state.running) {
      this.again = true
      return Promise.resolve()
    }
    return this.sync().finally(() => {
      if (this.again) {
        this.again = false
        void this.run()
      }
    })
  }

  cancel(): void {
    this.stop?.abort()
    this.again = false
  }

  private async save(): Promise<void> {
    const { lastSync, offlineSince, cacheFull, unauthorized } = this.state
    await fsp.mkdir(PHOTOS_DIR, { recursive: true }).catch(() => undefined)
    const tmp = `${STATE_FILE}.${process.pid}.tmp`
    await fsp.writeFile(tmp, JSON.stringify({ lastSync, offlineSince, cacheFull, unauthorized })).catch(() => undefined)
    await fsp.rename(tmp, STATE_FILE).catch(() => undefined)
  }

  private log(msg: string): void {
    console.log(`${new Date().toLocaleString()}: [photos] Immich: ${msg}`)
  }

  private async sync(): Promise<void> {
    await this.loaded
    this.lastTry = Date.now()
    const cfg = this.deps.getMupiboxConfig()
    const s = immichSettings(cfg)
    if (!photoSettings(cfg).enabled) return
    const client = this.client(cfg)
    // (set up, but no key that can be used - the config of another box: its key cannot be read here): nothing on the
    // box changes, the app asks for the key; taking the albums off is "Verbindung trennen"
    if (!client) {
      if (s.url && s.apiKey) {
        this.state.unauthorized = true
        this.log('the key cannot be read on this box, the pictures stay - enter it again in the app')
        await this.save()
      }
      return
    }
    const stop = new AbortController()
    this.stop = stop
    Object.assign(this.state, { running: true, done: 0, total: 0 })
    try {
      const videos = photoSettings(cfg).showVideos
      // the albums chosen as Immich has them now; Immich away: nothing changes on the box
      const found = new Map<string, { name: string; assets: ImmichAsset[] }>()
      let missing = 0
      {
        for (const id of s.albumIds) {
          if (stop.signal.aborted) return
          try {
            found.set(id, await client.album(id, stop.signal, videos))
          } catch (err) {
            if (stop.signal.aborted) return
            if (err instanceof ImmichRefused && err.status === 404) {
              missing++
              continue
            }
            if (err instanceof ImmichRefused && (err.status === 401 || err.status === 403)) {
              this.state.unauthorized = true
              this.log('the key is not accepted any more, the pictures on the box stay')
            } else {
              if (!this.state.offlineSince) this.state.offlineSince = new Date().toISOString()
              this.log(`not reachable (${(err as Error).message}), the pictures on the box stay`)
            }
            await this.save()
            return
          }
        }
      }
      Object.assign(this.state, { offlineSince: null, unauthorized: false, missing })

      // the albums: new ones go into the list with their first picture (live: at once); gone or no longer chosen out
      const live = !s.keepCopy
      const gone: PhotoAlbum[] = []
      const plan = await update((lib) => {
        const now = new Date().toISOString()
        for (const a of lib.albums.filter((x) => x.source === 'immich')) if (!a.ref || !found.has(a.ref)) gone.push(a)
        lib.albums = lib.albums.filter((a) => !gone.includes(a))
        const out: Array<{ album: PhotoAlbum; assets: ImmichAsset[]; fresh: boolean; was: boolean }> = []
        for (const [ref, f] of found) {
          const a = lib.albums.find((x) => x.source === 'immich' && x.ref === ref)
          const title = (f.name || 'Immich').slice(0, 40)
          if (a) {
            // (its name follows Immich; the way it is kept, the switch)
            const was = a.live === true
            a.title = title
            a.live = live
            out.push({ album: { ...a, assets: [...a.assets] }, assets: f.assets, fresh: false, was })
          } else out.push({ album: { id: newId(), title, source: 'immich', display: true, position: 0, created: now, assets: [], ref, live }, assets: f.assets, fresh: true, was: live })
        }
        return out
      })
      for (const a of gone) await fsp.rm(albumDir(a), { recursive: true, force: true }).catch(() => undefined)

      // live: the list only (the pictures come when shown) - what was kept on the box before goes
      if (live) {
        await update((lib) => {
          for (const { album, assets } of plan) {
            let a = lib.albums.find((x) => x.id === album.id)
            if (!a) {
              if (!assets.length) continue
              a = { ...album, assets: [], position: lib.albums.length }
              lib.albums.push(a)
            }
            const before = new Map(a.assets.map((x) => [x.ref, x]))
            a.assets = assets.slice(0, PICTURES_MAX).map((x) => {
              const old = before.get(x.id)
              // (a clip waiting to be made when the album was kept: live it is ready at once)
              if (old && old.ver === versionOf(x)) return old.kind === 'video' ? { ...old, ready: true } : old
              const base = { id: newId(), ...dims(x), taken: takenOf(x), added: new Date().toISOString(), ref: x.id, ver: versionOf(x) }
              return x.type === 'VIDEO' ? { ...base, kind: 'video' as const, ready: true, duration: clipSeconds(x.duration) } : { ...base, kind: 'photo' as const }
            })
            if (a.cover && !a.assets.some((x) => x.id === a?.cover)) delete a.cover
          }
          lib.albums = lib.albums.filter((a) => a.source !== 'immich' || a.assets.length > 0)
        })
        for (const { album, was } of plan) if (!was) await fsp.rm(albumDir(album), { recursive: true, force: true }).catch(() => undefined)
        this.state.cacheFull = false
        this.state.lastSync = new Date().toISOString()
        await this.save()
        return
      }

      // kept on the box: as the NAS folders - gone out at once, changed ones replaced when the new one is made, new in
      const work: Array<{ album: PhotoAlbum; asset: ImmichAsset; old?: PhotoAsset; fresh: boolean }> = []
      // (clips not taken before - too long, no clip - while unchanged)
      const rejected = await rejectedClips()
      for (const { album, assets, fresh } of plan) {
        const wanted = new Map(assets.map((x) => [x.id, x]))
        const drop: PhotoAsset[] = []
        const replace = new Map<string, PhotoAsset>()
        for (const x of album.assets) {
          const f = x.ref ? wanted.get(x.ref) : undefined
          if (!f) {
            drop.push(x)
            continue
          }
          // (a clip still waiting to be made: its file as it came is there)
          const file = x.kind === 'video' && x.ready === false ? `${assetBase(album, x.id)}.pending` : `${assetBase(album, x.id)}.jpg`
          const there = x.ver === versionOf(f) && (await fsp.access(file).then(() => true, () => false))
          if (there) wanted.delete(f.id)
          else replace.set(f.id, x)
        }
        if (drop.length) {
          const ids = new Set(drop.map((x) => x.id))
          await update((lib) => {
            const a = lib.albums.find((y) => y.id === album.id)
            if (!a) return
            a.assets = a.assets.filter((x) => !ids.has(x.id))
            if (a.cover && ids.has(a.cover)) delete a.cover
          })
          for (const x of drop) for (const f of photoFiles(assetBase(album, x.id))) await fsp.rm(f, { force: true }).catch(() => undefined)
        }
        // (a clip Immich says is too long, or one not taken before while unchanged: not fetched)
        const takes = (x: ImmichAsset) => !rejected.has(`immich:${x.id}|${versionOf(x)}`) && !(x.type === 'VIDEO' && clipSeconds(x.duration) > VIDEO_MAX_SECONDS + 1)
        for (const x of assets) if (wanted.has(x.id) && takes(x)) work.push({ album, asset: x, old: replace.get(x.id), fresh })
      }
      this.state.total = work.length

      const limit = s.cacheLimitMb > 0 ? s.cacheLimitMb * 1024 * 1024 : Number.POSITIVE_INFINITY
      let used = await photoBytes(IMMICH_PHOTO_DIR)
      let full = false
      // (stopped in the middle: Immich away or in trouble, or the key refused - no finished sync)
      let broken = false
      await fsp.mkdir(INCOMING_DIR, { recursive: true })
      for (const { album, asset: x, old, fresh } of work) {
        if (stop.signal.aborted) return
        const space = await cardSpace()
        let oldBytes = 0
        if (old) for (const f of photoFiles(assetBase(album, old.id))) oldBytes += (await fsp.stat(f).catch(() => ({ size: 0 }))).size
        // (a preview of Immich makes about 250 KB on the box)
        if ((!old && used + 250 * 1024 > limit) || (space && space.free < RESERVE_BYTES + FILE_MAX_BYTES)) {
          full = true
          break
        }
        const part = path.join(INCOMING_DIR, `immich-${randomBytes(6).toString('hex')}.jpg.part`)
        const id = newId()
        const out = assetBase(album, id)
        const clip = x.type === 'VIDEO'
        try {
          if (clip) {
            const r = await client.clip(x.id, { signal: stop.signal })
            // (at most what leaves room for the made one and the reserve)
            const room = space ? Math.floor((space.free - RESERVE_BYTES) / 2) : VIDEO_MAX_BYTES
            if (room <= 0 || !(await streamTo(r, part, Math.min(VIDEO_MAX_BYTES, room)))) continue
          } else {
            const r = await client.picture(x.id, 'preview', stop.signal)
            const size = Number(r.headers.get('content-length'))
            if (Number.isFinite(size) && size > FILE_MAX_BYTES) {
              await r.body?.cancel().catch(() => undefined)
              continue
            }
            await fsp.writeFile(part, Buffer.from(await r.arrayBuffer()))
          }
          await fsp.mkdir(albumDir(album), { recursive: true })
          // (a clip: kept as it came, made in the background - video.ts)
          if (clip) await fsp.rename(part, `${out}.pending`)
          const facts = clip ? { w: 0, h: 0, taken: null } : await processPhoto(part, out, '.jpg', stop.signal)
          let newBytes = 0
          for (const f of photoFiles(out)) newBytes += (await fsp.stat(f).catch(() => ({ size: 0 }))).size
          if (used - oldBytes + newBytes > limit) {
            for (const f of photoFiles(out)) await fsp.rm(f, { force: true }).catch(() => undefined)
            full = true
            break
          }
          // (the preview carries no date: the one Immich knows)
          const asset: PhotoAsset = clip
            ? { id, w: 0, h: 0, taken: takenOf(x), added: new Date().toISOString(), kind: 'video', ready: false, duration: clipSeconds(x.duration), ref: x.id, ver: versionOf(x) }
            : { id, w: facts.w, h: facts.h, taken: takenOf(x) ?? facts.taken, added: new Date().toISOString(), kind: 'photo', ref: x.id, ver: versionOf(x) }
          const placed = await update((lib) => {
            let a = lib.albums.find((y) => y.id === album.id)
            if (!a && fresh && !lib.albums.some((y) => y.source === 'immich' && y.ref === album.ref)) {
              a = { ...album, assets: [], position: lib.albums.length }
              lib.albums.push(a)
            }
            if (!a || a.assets.some((y) => y.ref === x.id && y.id !== old?.id)) return false
            const at = old ? a.assets.findIndex((y) => y.id === old.id) : -1
            if (at >= 0) a.assets[at] = asset
            else a.assets.push(asset)
            if (old && a.cover === old.id) a.cover = id
            return true
          })
          if (!placed) for (const f of photoFiles(out)) await fsp.rm(f, { force: true }).catch(() => undefined)
          else {
            used += newBytes
            if (clip) void videoQueue.kick()
            if (old) {
              for (const f of photoFiles(assetBase(album, old.id))) await fsp.rm(f, { force: true }).catch(() => undefined)
              used -= oldBytes
            }
          }
        } catch (err) {
          if (err instanceof PhotoAborted || stop.signal.aborted) return
          for (const f of photoFiles(out)) await fsp.rm(f, { force: true }).catch(() => undefined)
          // (Immich went away in the middle, or it has trouble - a proxy in front of it answering 502, say -, or the key is no
          // longer accepted: not one try per picture, the rest at the next sync)
          if (immichDown(err) || keyRefused(err)) {
            // (a key without the right for the pictures: the app says so, as for one refused; Immich away: "nicht erreichbar",
            // and the next try comes soon - the pictures fetched so far stay)
            if (keyRefused(err)) this.state.unauthorized = true
            else if (!this.state.offlineSince) this.state.offlineSince = new Date().toISOString()
            this.log(`stopped: ${(err as Error).message} - the rest at the next sync`)
            broken = true
            break
          }
          if (!(err instanceof NotAPicture)) this.log(`${x.id}: ${(err as Error).message}`)
        } finally {
          await fsp.rm(part, { force: true }).catch(() => undefined)
          this.state.done++
        }
      }
      await update((lib) => {
        lib.albums = lib.albums.filter((a) => a.source !== 'immich' || a.assets.length > 0)
      })
      this.state.cacheFull = full
      if (!broken) this.state.lastSync = new Date().toISOString()
      await this.save()
    } catch (err) {
      this.log(`sync failed: ${(err as Error).message}`)
    } finally {
      this.state.running = false
      if (this.stop === stop) this.stop = null
    }
  }

  /** "Verbindung trennen": every Immich album and its pictures off the box (in Immich all stays) */
  async removeAll(): Promise<number> {
    this.cancel()
    const gone = await update((lib) => {
      const out = lib.albums.filter((a) => a.source === 'immich')
      lib.albums = lib.albums.filter((a) => a.source !== 'immich')
      return out
    })
    await fsp.rm(IMMICH_PHOTO_DIR, { recursive: true, force: true }).catch(() => undefined)
    await fsp.rm(IMMICH_LIVE_DIR, { recursive: true, force: true }).catch(() => undefined)
    Object.assign(this.state, { lastSync: null, offlineSince: null, cacheFull: false, unauthorized: false, missing: 0 })
    await this.save()
    return gone.length
  }
}

/* ---------- live pictures ---------- */

let liveSync: ImmichPhotoSync | null = null
let pruning = 0
// the last time a live picture could not come from Immich (0: the last one came)
let liveFailedAt = 0

let lastCheck = 0
/**
 * Asked again now (the display's "Nochmal", and its own questions while albums are not there): Immich answers the
 * key with its albums within 5 s - it is back, the albums show again. At most every 10 s.
 */
export async function checkImmichNow(): Promise<void> {
  if (!immichLiveAway() || Date.now() - lastCheck < 10_000) return
  lastCheck = Date.now()
  const client = liveSync?.client()
  if (!client) return
  try {
    await client.json('/api/albums', { signal: AbortSignal.timeout(5000) })
    liveFailedAt = 0
    liveSync?.reachable()
  } catch {
    // still away
  }
}

/**
 * Immich is away for the albums shown live (the display shows them as "Gerade nicht da"): the last sync did not reach
 * it or the key was refused - or a picture asked for just now did not come.
 */
export function immichLiveAway(): boolean {
  const s = liveSync?.status()
  return !!s && (!!s.offlineSince || s.unauthorized || Date.now() - liveFailedAt < 2 * 60_000)
}

// what a picture is by its first bytes (Immich's thumbnails are WebP or JPEG)
const typeOf = (b: Buffer) => (b.subarray(0, 4).toString('latin1') === 'RIFF' ? 'image/webp' : b[0] === 0x89 ? 'image/png' : 'image/jpeg')

/**
 * A picture of an Immich album shown live (albums.ts sendPicture): from the small cache, else from Immich - the grid and
 * the background its thumbnail, the full view its preview. Immich away: 404 (the display shows the album as not there).
 */
export async function sendImmichLive(req: Request, res: Response, assetRef: string, size: string): Promise<void> {
  const client = liveSync?.client()
  if (!UUID.test(assetRef)) return void res.status(404).end()
  // a clip: passed on as it comes, a part of it when the player asks for one (not kept - too big for the live cache)
  if (size === 'v') {
    if (!client) return void res.status(404).end()
    const stop = new AbortController()
    res.on('close', () => stop.abort())
    try {
      const range = typeof req.headers.range === 'string' && /^bytes=\d*-\d*$/.test(req.headers.range) ? req.headers.range : undefined
      const r = await client.clip(assetRef, { signal: stop.signal, range })
      liveFailedAt = 0
      liveSync?.reachable()
      res.status(r.status)
      for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const v = r.headers.get(h)
        if (v) res.setHeader(h, v)
      }
      res.setHeader('Cache-Control', 'private, no-store')
      await pipeline(Readable.fromWeb(r.body as import('node:stream/web').ReadableStream), res)
    } catch (err) {
      if (immichDown(err) || keyRefused(err)) liveFailedAt = Date.now()
      if (!res.headersSent) res.status(404).end()
      else res.destroy()
    }
    return
  }
  const kind = size === 'f' ? 'preview' : 'thumbnail'
  const file = path.join(IMMICH_LIVE_DIR, `${assetRef}.${kind}`)
  const send = (buf: Buffer) => {
    res.setHeader('Content-Type', typeOf(buf))
    res.setHeader('Cache-Control', 'private, max-age=86400')
    res.end(buf)
  }
  try {
    const kept = await fsp.readFile(file)
    // (touched: the ones shown last stay longest)
    await fsp.utimes(file, new Date(), new Date()).catch(() => undefined)
    return send(kept)
  } catch {
    // not kept yet
  }
  if (!client) return void res.status(404).end()
  try {
    const r = await client.picture(assetRef, kind)
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > FILE_MAX_BYTES) return void res.status(404).end()
    liveFailedAt = 0
    liveSync?.reachable()
    send(buf)
    await fsp.mkdir(IMMICH_LIVE_DIR, { recursive: true })
    await fsp.writeFile(`${file}.tmp`, buf)
    await fsp.rename(`${file}.tmp`, file)
    void pruneLive()
  } catch (err) {
    // (Immich away or the key refused - not a single picture it does not have)
    if (immichDown(err) || keyRefused(err)) liveFailedAt = Date.now()
    if (!res.headersSent) res.status(404).end()
  }
}

// a response's body into a file, at most maxBytes (false: too big - nothing kept)
async function streamTo(r: globalThis.Response, file: string, maxBytes: number): Promise<boolean> {
  const announced = Number(r.headers.get('content-length'))
  if (Number.isFinite(announced) && announced > maxBytes) {
    await r.body?.cancel().catch(() => undefined)
    return false
  }
  const out = await fsp.open(file, 'w')
  let n = 0
  try {
    for await (const chunk of Readable.fromWeb(r.body as import('node:stream/web').ReadableStream)) {
      n += (chunk as Buffer).length
      if (n > maxBytes) return false
      await out.write(chunk as Buffer)
    }
    return true
  } finally {
    await out.close()
    if (n > maxBytes) await fsp.rm(file, { force: true })
  }
}

// the live cache within its limit: the ones shown longest ago go (at most every 5 minutes)
async function pruneLive(): Promise<void> {
  if (Date.now() - pruning < 5 * 60_000) return
  pruning = Date.now()
  const names = await fsp.readdir(IMMICH_LIVE_DIR).catch(() => [] as string[])
  const files = await Promise.all(names.map(async (n) => ({ n, st: await fsp.stat(path.join(IMMICH_LIVE_DIR, n)).catch(() => null) })))
  const list = files.filter((f) => f.st?.isFile()).sort((a, b) => (b.st?.mtimeMs ?? 0) - (a.st?.mtimeMs ?? 0))
  let total = 0
  for (const f of list) {
    total += f.st?.size ?? 0
    if (total > LIVE_CACHE_BYTES) await fsp.rm(path.join(IMMICH_LIVE_DIR, f.n), { force: true }).catch(() => undefined)
  }
}

/* ---------- the app's side ---------- */

/**
 *   GET  /api/app/photos/immich             the settings (the key only as "set"), the sync's state, albums, cache
 *   POST /api/app/photos/immich/test        {url, apiKey?} - the assistant's test (without a key: the one kept)
 *   GET  /api/app/photos/immich/albums      the albums in Immich (to tick) with their numbers
 *   GET  /api/app/photos/immich/thumb/:id   an album's picture from Immich for that list (through the box)
 *   POST /api/app/photos/immich             {url?, apiKey?, account?, albumIds?, keepCopy?, syncMinutes?, cacheLimitMb?}
 *   POST /api/app/photos/immich/sync        a sync now
 *   POST /api/app/photos/immich/remove      "Verbindung trennen": address, key, albums and pictures off the box
 */
export function registerPhotoImmichRoutes(router: Router, deps: PhotoImmichDeps): ImmichPhotoSync {
  const sync = new ImmichPhotoSync(deps)
  liveSync = sync
  sync.start()

  const answer = async () => {
    const s = immichSettings(deps.getMupiboxConfig())
    const list = (await albums()).filter((a) => a.source === 'immich')
    return {
      settings: { url: s.url, account: s.account, albumIds: s.albumIds, keepCopy: s.keepCopy, syncMinutes: s.syncMinutes, cacheLimitMb: s.cacheLimitMb, hasKey: !!s.apiKey },
      connected: !!(s.url && s.apiKey),
      minVersion: IMMICH_MIN_TEXT,
      sync: sync.status(),
      albums: list.length,
      pictures: list.reduce((n, a) => n + a.assets.length, 0),
      cacheBytes: (await photoBytes(IMMICH_PHOTO_DIR)) + (await photoBytes(IMMICH_LIVE_DIR)),
    }
  }

  router.get('/photos/immich', requireSession, async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json(await answer())
  })

  router.post('/photos/immich/test', requireSession, requireCsrf, async (req, res) => {
    const b = obj(req.body)
    const url = cleanImmichUrl(b.url)
    if (!url) return void res.status(400).json({ error: 'url' })
    let key = typeof b.apiKey === 'string' ? b.apiKey.trim() : ''
    if (!key) {
      // (the key kept only for the server it was given for - never to another address)
      const kept = sync.client()
      if (!kept || kept.url !== url) return void res.status(400).json({ error: 'apiKey' })
      key = kept.key
    }
    res.json(await testImmich(new ImmichClient(url, key)))
  })

  router.get('/photos/immich/albums', requireSession, async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const client = sync.client()
    if (!client) return void res.status(409).json({ error: 'not_connected' })
    try {
      const list = await client.albums()
      res.json({
        albums: list
          .map((a) => ({ id: a.id, name: String(a.albumName ?? ''), count: Number(a.assetCount) || 0, thumb: a.albumThumbnailAssetId && UUID.test(a.albumThumbnailAssetId) ? a.albumThumbnailAssetId : null }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
      })
    } catch (err) {
      res.status(err instanceof ImmichRefused && (err.status === 401 || err.status === 403) ? 401 : 502).json({ error: err instanceof ImmichRefused ? 'unauthorized' : 'unreachable' })
    }
  })

  router.get('/photos/immich/thumb/:id', requireSession, async (req: Request, res: Response) => {
    const client = sync.client()
    if (!client || !UUID.test(req.params.id)) return void res.status(404).end()
    try {
      const r = await client.picture(req.params.id, 'thumbnail')
      const buf = Buffer.from(await r.arrayBuffer())
      res.setHeader('Content-Type', typeOf(buf))
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.end(buf)
    } catch {
      res.status(404).end()
    }
  })

  router.post('/photos/immich', requireSession, requireCsrf, async (req, res) => {
    let error: string | null = null
    const before = immichSettings(deps.getMupiboxConfig())
    try {
      await deps.updateMupiboxConfig((cfg) => {
        error = applyImmichSettings(cfg, req.body, deps.secret ? (x) => deps.secret!.encrypt(x) : undefined)
      })
    } catch {
      return void res.status(500).json({ error: 'config_not_saved' })
    }
    if (error) return void res.status(400).json({ error })
    const after = immichSettings(deps.getMupiboxConfig())
    // (albums, the way they are kept, the server or its key changed: a sync takes it over at once)
    if (
      after.url &&
      (before.url !== after.url || before.apiKey !== after.apiKey || before.keepCopy !== after.keepCopy || before.albumIds.join() !== after.albumIds.join())
    )
      void sync.run()
    res.json(await answer())
  })

  router.post('/photos/immich/sync', requireSession, requireCsrf, async (_req, res) => {
    if (!photoSettings(deps.getMupiboxConfig()).enabled) return void res.status(409).json({ error: 'photos_off' })
    void sync.run()
    await new Promise((r) => setTimeout(r, 300))
    res.json(await answer())
  })

  router.post('/photos/immich/remove', requireSession, requireCsrf, async (_req, res) => {
    try {
      await deps.updateMupiboxConfig((cfg) => {
        const photos = { ...obj(cfg.photos) }
        const sources = { ...obj(photos.sources) }
        delete sources.immich
        photos.sources = sources
        cfg.photos = photos
      })
    } catch {
      return void res.status(500).json({ error: 'config_not_saved' })
    }
    const removed = await sync.removeAll()
    res.json({ ...(await answer()), removed })
  })

  return sync
}

