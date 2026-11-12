// The photo display's Immich albums (5.1, Bibliothek › Fotos › Immich): albums of an Immich server in the home network
// (address and an API key with read rights) become albums on the display - kept on the box (Immich's "preview" of each
// picture, made into the display's sizes, in cache/photos/immich) or live (its "thumbnail" for the grid, its "preview"
// for the full view); the sync, the two ways and the live pictures are the same for every service (remote.ts). Albums of
// Immich are only looked at in the app: changes happen in Immich. The key is kept encrypted and never shown again.

import path from 'node:path'
import type { Request, Response, Router } from 'express'
import type { MupiboxConfig } from '../../models/mupibox-config.model'
import { requireCsrf, requireSession } from '../middleware'
import { CACHE_LIMITS_MB, PICTURES_MAX, type RemoteClient, type RemoteItem, RemoteAway, RemotePhotoSync, RemoteRefused, registerRemote, remoteDown, SYNC_MINUTES, typeOf } from './remote'
import { photoSettings } from './settings'
import { albums, IMMICH_LIVE_DIR, IMMICH_PHOTO_DIR, PHOTOS_DIR, photoBytes } from './store'

export interface PhotoImmichDeps {
  getMupiboxConfig: () => MupiboxConfig | undefined
  updateMupiboxConfig: (mutate: (cfg: Record<string, unknown>) => void) => Promise<void>
  /** the box's way to keep a secret in the config (the NAS password's) */
  secret?: { encrypt(plain: string): string; decrypt(stored: string): string | undefined }
}

/** The oldest Immich with the API used here (/api/server/version, /api/albums, /api/assets/:id/thumbnail) */
export const IMMICH_MIN_VERSION = { major: 1, minor: 106, patch: 0 }
export const IMMICH_MIN_TEXT = '1.106'

const ALBUMS_MAX = 100
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

// (what goes wrong is the same for every service - see remote.ts)
export { RemoteAway as ImmichAway, remoteDown as immichDown }
const ImmichAway = RemoteAway
export class ImmichRefused extends RemoteRefused {
  constructor(status: number) {
    super(status, 'Immich')
  }
}

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

export class ImmichClient implements RemoteClient {
  /** Immich makes its clips for browsers: shown live as they come */
  readonly liveClips = true

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

  /** An album with its pictures as the sync takes them */
  async album(id: string, signal: AbortSignal, videos: boolean): Promise<{ name: string; items: RemoteItem[] }> {
    const a = await this.assets(id, signal, videos)
    return { name: a.name, items: a.assets.map(itemOf) }
  }

  /** An album with its pictures (not trashed); newer Immich versions leave the assets out of the album: searched then */
  async assets(id: string, signal?: AbortSignal, videos = false): Promise<{ name: string; assets: ImmichAsset[] }> {
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
  async clip(_album: string, item: { ref: string }, init: { signal?: AbortSignal; range?: string; timeoutMs?: number } = {}): Promise<globalThis.Response> {
    const r = await this.call(`/api/assets/${item.ref}/video/playback`, {
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

  /** A picture for the sync and the live albums: its preview for the full view, its thumbnail for the grid */
  picture(_album: string, item: { ref: string }, size: 'full' | 'grid', signal?: AbortSignal): Promise<globalThis.Response> {
    return this.thumbnail(item.ref, size === 'full' ? 'preview' : 'thumbnail', signal)
  }

  /** Whether Immich is back: it answers the key with its albums */
  async check(signal: AbortSignal): Promise<void> {
    await this.json('/api/albums', { signal })
  }

  /** A picture of Immich's (preview: its display size, JPEG; thumbnail: small, WebP or JPEG) */
  async thumbnail(assetId: string, size: 'preview' | 'thumbnail', signal?: AbortSignal): Promise<globalThis.Response> {
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
    if (await denied(async () => (await client.thumbnail(sample.albumThumbnailAssetId as string, 'thumbnail')).body?.cancel())) return { ok: false, error: 'permissions' }
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


/* ---------- an Immich asset as the sync takes it ---------- */

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
const itemOf = (x: ImmichAsset): RemoteItem => ({ ref: x.id, kind: x.type === 'VIDEO' ? 'video' : 'photo', ver: versionOf(x), ...dims(x), taken: takenOf(x), duration: clipSeconds(x.duration) })

/** Immich for the sync of the albums (remote.ts) */
function immichSpec(deps: PhotoImmichDeps) {
  return {
    source: 'immich' as const,
    label: 'Immich',
    stateFile: STATE_FILE,
    photoDir: IMMICH_PHOTO_DIR,
    liveDir: IMMICH_LIVE_DIR,
    settings: (cfg: MupiboxConfig | undefined) => {
      const s = immichSettings(cfg)
      return { set: !!s.url && !!s.apiKey, albumIds: s.albumIds, keepCopy: s.keepCopy, syncMinutes: s.syncMinutes, cacheLimitMb: s.cacheLimitMb }
    },
    client: (cfg: MupiboxConfig | undefined) => immichClient(deps, cfg),
    unreadable: 'the key cannot be read on this box, the pictures stay - enter it again in the app',
  }
}

/** The client with the key as kept; null: none set up (or the key cannot be read on this box) */
function immichClient(deps: PhotoImmichDeps, cfg: MupiboxConfig | undefined): ImmichClient | null {
  const s = immichSettings(cfg)
  if (!s.url || !s.apiKey) return null
  const key = deps.secret ? deps.secret.decrypt(s.apiKey) : s.apiKey
  return key ? new ImmichClient(s.url, key) : null
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
export function registerPhotoImmichRoutes(router: Router, deps: PhotoImmichDeps): RemotePhotoSync {
  const sync = new RemotePhotoSync(immichSpec(deps), deps.getMupiboxConfig)
  registerRemote(sync)
  sync.start()
  const kept = () => immichClient(deps, deps.getMupiboxConfig())

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
      const client = kept()
      if (!client || client.url !== url) return void res.status(400).json({ error: 'apiKey' })
      key = client.key
    }
    res.json(await testImmich(new ImmichClient(url, key)))
  })

  router.get('/photos/immich/albums', requireSession, async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const client = kept()
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
    const client = kept()
    if (!client || !UUID.test(req.params.id)) return void res.status(404).end()
    try {
      const r = await client.thumbnail(req.params.id, 'thumbnail')
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

