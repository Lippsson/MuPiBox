// The photo display's albums of Synology Photos (5.1, Bibliothek › Fotos › Synology Photos): the NAS the box is signed in
// to (Bibliothek › NAS) with the same account - its own albums and the ones shared with it in Synology Photos become albums
// on the display. So a family gives the box an album by sharing it with the box's account ("Betrachter"). The sync, the two
// ways (kept on the box, live) and the live pictures are the same as for Immich (remote.ts); Synology's thumbnails ("xl"
// for the full view, "sm" for the grid) are the pictures. A clip comes as it is on the NAS (4K HEVC from a phone, say) and is
// made on the box (video.ts) - so live albums show no clips. The login stays in the server (server.ts: photoNas.dsm).

import path from 'node:path'
import type { Request, Response, Router } from 'express'
import type { MupiboxConfig } from '../../models/mupibox-config.model'
import { requireCsrf, requireSession } from '../middleware'
import type { PhotoNasAccess } from './nas'
import { CACHE_LIMITS_MB, type RemoteClient, type RemoteItem, RemoteAway, RemotePhotoSync, RemoteRefused, registerRemote, SYNC_MINUTES, typeOf } from './remote'
import { photoSettings } from './settings'
import { albums, PHOTOS_DIR, photoBytes, SYNOLOGY_LIVE_DIR, SYNOLOGY_PHOTO_DIR } from './store'

export interface PhotoSynologyDeps {
  getMupiboxConfig: () => MupiboxConfig | undefined
  updateMupiboxConfig: (mutate: (cfg: Record<string, unknown>) => void) => Promise<void>
  nas?: PhotoNasAccess
}

const ALBUMS_MAX = 100
const STATE_FILE = path.join(PHOTOS_DIR, 'synology-sync.json')
// an album's id in Synology Photos (a number)
const ALBUM_ID = /^\d{1,12}$/
// how many items one question asks for
const PAGE = 500

export interface SynologySettings {
  /** switched on in the app (the NAS's login is the one of Bibliothek › NAS) */
  enabled: boolean
  albumIds: string[]
  keepCopy: boolean
  syncMinutes: (typeof SYNC_MINUTES)[number]
  cacheLimitMb: (typeof CACHE_LIMITS_MB)[number]
  /** DSM's port, when it is not the usual one (5001 with https, 5000 without); 0: the usual one */
  port: number
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export function synologySettings(cfg: unknown): SynologySettings {
  const n = obj(obj(obj(obj(cfg).photos).sources).synology)
  const port = Number(n.port)
  return {
    enabled: n.enabled === true,
    albumIds: Array.isArray(n.albumIds) ? [...new Set(n.albumIds.filter((x): x is string => typeof x === 'string' && ALBUM_ID.test(x)))].slice(0, ALBUMS_MAX) : [],
    keepCopy: n.keepCopy !== false,
    syncMinutes: (SYNC_MINUTES as readonly number[]).includes(Number(n.syncMinutes)) ? (Number(n.syncMinutes) as SynologySettings['syncMinutes']) : 360,
    cacheLimitMb: (CACHE_LIMITS_MB as readonly number[]).includes(Number(n.cacheLimitMb)) ? (Number(n.cacheLimitMb) as SynologySettings['cacheLimitMb']) : 2048,
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 0,
  }
}

/** A change from the app, checked (a wrong field: the reason, nothing written) */
export function applySynologySettings(cfg: Record<string, unknown>, patch: unknown): string | null {
  const p = obj(patch)
  const next: Record<string, unknown> = { ...obj(obj(obj(cfg.photos).sources).synology) }
  if (p.enabled !== undefined) {
    if (typeof p.enabled !== 'boolean') return 'enabled'
    next.enabled = p.enabled
  }
  if (p.albumIds !== undefined) {
    if (!Array.isArray(p.albumIds) || p.albumIds.length > ALBUMS_MAX || !p.albumIds.every((x) => typeof x === 'string' && ALBUM_ID.test(x))) return 'albumIds'
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
  if (p.port !== undefined) {
    if (!Number.isInteger(p.port) || (p.port as number) < 0 || (p.port as number) > 65535) return 'port'
    next.port = p.port
  }
  const photos = { ...obj(cfg.photos) }
  photos.sources = { ...obj(photos.sources), synology: next }
  cfg.photos = photos
  return null
}

/* ---------- talking to Synology Photos ---------- */

/**
 * DSM refused the login of the box's NAS account: 400 the name or the password, 401 the account is off, 402 it may not use
 * Synology Photos, 403/406 it asks for a second factor, 407 the box's address is blocked (too many wrong logins), 408-410
 * the password expired. -1: no NAS set up.
 */
export class DsmLoginRefused extends RemoteRefused {
  constructor(readonly code: number) {
    super(code === 402 ? 403 : 401, 'Synology (login)')
  }
}

/** The NAS's certificate on DSM's port is not the one confirmed for the NAS (Bibliothek › NAS) */
export class DsmCertificate extends RemoteAway {}

interface SynoAlbum {
  id: number
  name?: string
  item_count?: number
  passphrase?: string
  additional?: { thumbnail?: { cache_key?: string; unit_id?: number } }
}
interface SynoItem {
  id: number
  type?: string
  time?: number
  additional?: {
    resolution?: { width?: number; height?: number }
    thumbnail?: { cache_key?: string; unit_id?: number; xl?: string; sm?: string }
    video_meta?: { duration?: number }
  }
}

// the albums the account sees, for a minute: own ones and the ones shared with it (those are read with their passphrase)
let albumCache: { at: number; port: number; list: Map<string, SynoAlbum & { shared: boolean }> } | null = null

export class SynologyClient implements RemoteClient {
  /** a clip comes as it is on the NAS: the display cannot play it as it comes - live albums show no clips */
  readonly liveClips = false

  constructor(
    private readonly nas: PhotoNasAccess,
    private readonly port: number,
  ) {}

  /** A question to Synology Photos: its data; RemoteRefused when it says no, RemoteAway when the NAS does not answer */
  private async call<T>(params: Record<string, string>, signal?: AbortSignal): Promise<T> {
    const r = await this.raw(params, { signal })
    const j = await this.json(r)
    return j as T
  }

  private async raw(params: Record<string, string>, init: { signal?: AbortSignal; timeoutMs?: number; fresh?: boolean } = {}): Promise<globalThis.Response> {
    if (!this.nas.dsm) throw new DsmLoginRefused(-1)
    return this.nas.dsm(params, { ...init, port: this.port })
  }

  private async json(r: globalThis.Response): Promise<unknown> {
    if (!r.ok) {
      await r.body?.cancel().catch(() => undefined)
      throw new RemoteRefused(r.status, 'Synology')
    }
    let j: { success?: boolean; data?: unknown; error?: { code?: number } }
    try {
      j = (await r.json()) as typeof j
    } catch {
      throw new RemoteAway('Synology: no JSON')
    }
    if (j?.success !== true) throw synoError(Number(j?.error?.code) || 0)
    return j.data ?? {}
  }

  /** Every album the account sees: its own and the ones shared with it (each once) */
  async albums(signal?: AbortSignal, fresh = false): Promise<Map<string, SynoAlbum & { shared: boolean }>> {
    if (!fresh && albumCache && albumCache.port === this.port && Date.now() - albumCache.at < 60_000) return albumCache.list
    const list = new Map<string, SynoAlbum & { shared: boolean }>()
    const extra = JSON.stringify(['thumbnail'])
    for (const [api, method, version, shared] of [
      ['SYNO.Foto.Browse.Album', 'list', '2', false],
      ['SYNO.Foto.Sharing.Misc', 'list_shared_with_me_album', '2', true],
    ] as const) {
      for (let offset = 0; offset < 1000; offset += PAGE) {
        const d = await this.call<{ list?: SynoAlbum[] }>({ api, method, version, offset: String(offset), limit: String(PAGE), additional: extra }, signal)
        const page = Array.isArray(d.list) ? d.list : []
        for (const a of page) if (a && Number.isInteger(a.id) && !list.has(String(a.id))) list.set(String(a.id), { ...a, shared })
        if (page.length < PAGE) break
      }
    }
    albumCache = { at: Date.now(), port: this.port, list }
    return list
  }

  /** How an album's pictures are asked for: its own by its id, one shared with the account by its passphrase */
  private async albumParams(ref: string, signal?: AbortSignal): Promise<Record<string, string>> {
    let a = (await this.albums(signal)).get(ref)
    // (not in the list of a minute ago: asked again - an album shared just now)
    if (!a) a = (await this.albums(signal, true)).get(ref)
    if (!a) throw new RemoteRefused(404, 'Synology')
    return a.shared && a.passphrase ? { passphrase: a.passphrase } : { album_id: ref }
  }

  async album(ref: string, signal: AbortSignal, videos: boolean): Promise<{ name: string; items: RemoteItem[] }> {
    if (!ALBUM_ID.test(ref)) throw new RemoteRefused(404, 'Synology')
    const where = await this.albumParams(ref, signal)
    const name = String((await this.albums(signal)).get(ref)?.name ?? '')
    const items: RemoteItem[] = []
    const extra = JSON.stringify(['thumbnail', 'resolution', 'orientation', 'video_meta'])
    for (let offset = 0; offset < 20_000; offset += PAGE) {
      const d = await this.call<{ list?: SynoItem[] }>({ api: 'SYNO.Foto.Browse.Item', method: 'list', version: '1', offset: String(offset), limit: String(PAGE), additional: extra, ...where }, signal)
      const page = Array.isArray(d.list) ? d.list : []
      for (const x of page) {
        const item = itemOf(x, videos)
        if (item) items.push(item)
      }
      if (page.length < PAGE) break
    }
    return { name, items }
  }

  /** A picture: Synology's "xl" (about 1280 px) for the full view and the box, its "sm" for the grid - WebP */
  async picture(albumRef: string, item: { ref: string; ver: string }, size: 'full' | 'grid', signal?: AbortSignal): Promise<globalThis.Response> {
    const where = await this.albumParams(albumRef, signal)
    const r = await this.raw(
      { api: 'SYNO.Foto.Thumbnail', method: 'get', version: '2', mode: 'download', id: item.ref, type: 'unit', size: size === 'full' ? 'xl' : 'sm', cache_key: item.ver, ...(where.passphrase ? { passphrase: where.passphrase } : {}) },
      { signal },
    )
    return this.file(r)
  }

  /** A clip as it is on the NAS (made on the box) */
  async clip(albumRef: string, item: { ref: string }, init: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<globalThis.Response> {
    const where = await this.albumParams(albumRef, init.signal)
    const r = await this.raw(
      { api: 'SYNO.Foto.Download', method: 'download', version: '2', unit_id: JSON.stringify([Number(item.ref)]), ...(where.passphrase ? { passphrase: where.passphrase } : {}) },
      { signal: init.signal, timeoutMs: init.timeoutMs ?? 30 * 60_000 },
    )
    return this.file(r)
  }

  /** Whether the NAS is back: Synology Photos answers the login with the albums */
  async check(signal: AbortSignal): Promise<void> {
    await this.albums(signal, true)
  }

  /** The login, asked anew (the assistant's test) */
  async login(signal?: AbortSignal): Promise<void> {
    const r = await this.raw({ api: 'SYNO.Foto.Browse.Album', method: 'list', version: '2', offset: '0', limit: '1' }, { signal, fresh: true })
    await this.json(r)
  }

  // a file DSM sends - or its answer in JSON when it does not (an error)
  private async file(r: globalThis.Response): Promise<globalThis.Response> {
    if (r.ok && r.body && !/json|html/i.test(r.headers.get('content-type') ?? '')) return r
    await this.json(r)
    throw new RemoteRefused(404, 'Synology')
  }
}

/** What DSM's error code of a question means for the box */
function synoError(code: number): Error {
  // (no right: 105 the session may not, 402 not for this account)
  if (code === 105 || code === 402) return new RemoteRefused(403, `Synology (${code})`)
  // (not there: 608/609/620/641 - an album or a picture gone, unshared)
  if ([608, 609, 620, 641, 642].includes(code)) return new RemoteRefused(404, `Synology (${code})`)
  return new RemoteRefused(502, `Synology (${code})`)
}

// an item of an album as the sync takes it; null: not a picture or a clip for the box (no thumbnail yet, a clip without videos)
function itemOf(x: SynoItem, videos: boolean): RemoteItem | null {
  if (!x || !Number.isInteger(x.id)) return null
  const clip = x.type === 'video'
  if (clip && !videos) return null
  if (x.type !== 'photo' && x.type !== 'live' && !clip) return null
  const t = x.additional?.thumbnail
  // (the thumbnail is the picture - and its key says when it changed; one not made yet comes at the next sync)
  if (!t?.cache_key || (!clip && t.xl !== 'ready')) return null
  const time = Number(x.time)
  return {
    ref: String(x.id),
    kind: clip ? 'video' : 'photo',
    ver: String(t.cache_key),
    // (as shown: Synology gives the size already turned)
    w: Number(x.additional?.resolution?.width) || 0,
    h: Number(x.additional?.resolution?.height) || 0,
    taken: Number.isFinite(time) && time > 0 ? new Date(time * 1000).toISOString().slice(0, 19) : null,
    duration: clip ? Math.round((Number(x.additional?.video_meta?.duration) || 0) / 1000) : 0,
  }
}

export type SynologyTest =
  | { ok: true; account: string | null; albums: number; shared: number; pictures: number }
  | { ok: false; error: 'noNas' | 'unauthorized' | 'noPhotos' | 'twoFactor' | 'blocked' | 'expired' | 'certificate' | 'unreachable' }

/** The test of the page: the login of the NAS's account at DSM, and its albums */
export async function testSynology(client: SynologyClient, account: string | null): Promise<SynologyTest> {
  try {
    await client.login(AbortSignal.timeout(20_000))
    const list = await client.albums(AbortSignal.timeout(20_000), true)
    const all = [...list.values()]
    return { ok: true, account, albums: all.length, shared: all.filter((a) => a.shared).length, pictures: all.reduce((n, a) => n + (Number(a.item_count) || 0), 0) }
  } catch (err) {
    if (err instanceof DsmLoginRefused) {
      const c = err.code
      return { ok: false, error: c === -1 ? 'noNas' : c === 402 ? 'noPhotos' : c === 403 || c === 404 || c === 406 ? 'twoFactor' : c === 407 ? 'blocked' : c >= 408 && c <= 410 ? 'expired' : 'unauthorized' }
    }
    if (err instanceof DsmCertificate) return { ok: false, error: 'certificate' }
    if (err instanceof RemoteRefused && err.status === 403) return { ok: false, error: 'noPhotos' }
    return { ok: false, error: 'unreachable' }
  }
}

/* ---------- the app's side ---------- */

function synologyClient(deps: PhotoSynologyDeps, cfg: MupiboxConfig | undefined): SynologyClient | null {
  const s = synologySettings(cfg)
  if (!s.enabled || !deps.nas?.dsm || !deps.nas.info().connected) return null
  return new SynologyClient(deps.nas, s.port)
}

/**
 *   GET  /api/app/photos/synology            the settings, the NAS (its account), the sync's state, albums, cache
 *   POST /api/app/photos/synology/test       the login of the NAS's account and its albums
 *   GET  /api/app/photos/synology/albums     the albums the account sees (to tick) with their numbers
 *   GET  /api/app/photos/synology/thumb/:id  an album's picture for that list (through the box)
 *   POST /api/app/photos/synology            {enabled?, albumIds?, keepCopy?, syncMinutes?, cacheLimitMb?, port?}
 *   POST /api/app/photos/synology/sync       a sync now
 *   POST /api/app/photos/synology/remove     off: the albums and their pictures off the box
 */
export function registerPhotoSynologyRoutes(router: Router, deps: PhotoSynologyDeps): RemotePhotoSync {
  const sync = new RemotePhotoSync(
    {
      source: 'synology',
      label: 'Synology Photos',
      stateFile: STATE_FILE,
      photoDir: SYNOLOGY_PHOTO_DIR,
      liveDir: SYNOLOGY_LIVE_DIR,
      settings: (cfg) => {
        const s = synologySettings(cfg)
        return { set: s.enabled, albumIds: s.albumIds, keepCopy: s.keepCopy, syncMinutes: s.syncMinutes, cacheLimitMb: s.cacheLimitMb }
      },
      client: (cfg) => synologyClient(deps, cfg),
      unreadable: 'the NAS is not signed in (Bibliothek › NAS), the pictures stay',
    },
    deps.getMupiboxConfig,
  )
  registerRemote(sync)
  sync.start()
  const account = () => {
    const nas = obj(obj(deps.getMupiboxConfig()).nas)
    return typeof nas.account === 'string' && nas.account ? nas.account.slice(0, 100) : null
  }

  const answer = async () => {
    const s = synologySettings(deps.getMupiboxConfig())
    const list = (await albums()).filter((a) => a.source === 'synology')
    return {
      settings: { enabled: s.enabled, albumIds: s.albumIds, keepCopy: s.keepCopy, syncMinutes: s.syncMinutes, cacheLimitMb: s.cacheLimitMb, port: s.port },
      nas: { connected: !!deps.nas?.info().connected, account: account() },
      connected: s.enabled,
      sync: sync.status(),
      albums: list.length,
      pictures: list.reduce((n, a) => n + a.assets.length, 0),
      cacheBytes: (await photoBytes(SYNOLOGY_PHOTO_DIR)) + (await photoBytes(SYNOLOGY_LIVE_DIR)),
    }
  }
  // (the test and the album list before it is switched on: with the port typed in)
  const tryClient = (port?: unknown) => {
    if (!deps.nas?.dsm || !deps.nas.info().connected) return null
    const p = Number(port)
    return new SynologyClient(deps.nas, Number.isInteger(p) && p > 0 && p < 65536 ? p : synologySettings(deps.getMupiboxConfig()).port)
  }

  router.get('/photos/synology', requireSession, async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json(await answer())
  })

  router.post('/photos/synology/test', requireSession, requireCsrf, async (req, res) => {
    const client = tryClient(obj(req.body).port)
    if (!client) return void res.json({ ok: false, error: 'noNas' } satisfies SynologyTest)
    res.json(await testSynology(client, account()))
  })

  router.get('/photos/synology/albums', requireSession, async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const client = tryClient()
    if (!client) return void res.status(409).json({ error: 'not_connected' })
    try {
      const list = await client.albums(AbortSignal.timeout(20_000), true)
      res.json({
        albums: [...list.values()]
          .map((a) => ({ id: String(a.id), name: String(a.name ?? ''), count: Number(a.item_count) || 0, shared: a.shared, thumb: a.additional?.thumbnail?.cache_key ? String(a.id) : null }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
      })
    } catch (err) {
      res.status(err instanceof RemoteRefused && (err.status === 401 || err.status === 403) ? 401 : 502).json({ error: err instanceof RemoteRefused ? 'unauthorized' : 'unreachable' })
    }
  })

  router.get('/photos/synology/thumb/:id', requireSession, async (req: Request, res: Response) => {
    const client = tryClient()
    const id = String(req.params.id)
    if (!client || !ALBUM_ID.test(id)) return void res.status(404).end()
    try {
      const a = (await client.albums()).get(id)
      const t = a?.additional?.thumbnail
      if (!t?.cache_key || !Number.isInteger(t.unit_id)) return void res.status(404).end()
      const r = await client.picture(id, { ref: String(t.unit_id), ver: String(t.cache_key) }, 'grid')
      const buf = Buffer.from(await r.arrayBuffer())
      res.setHeader('Content-Type', typeOf(buf))
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.end(buf)
    } catch {
      res.status(404).end()
    }
  })

  router.post('/photos/synology', requireSession, requireCsrf, async (req, res) => {
    let error: string | null = null
    const before = synologySettings(deps.getMupiboxConfig())
    try {
      await deps.updateMupiboxConfig((cfg) => {
        error = applySynologySettings(cfg, req.body)
      })
    } catch {
      return void res.status(500).json({ error: 'config_not_saved' })
    }
    if (error) return void res.status(400).json({ error })
    const after = synologySettings(deps.getMupiboxConfig())
    // (switched on, albums, the way they are kept or the port changed: a sync takes it over at once)
    if (after.enabled && (!before.enabled || before.keepCopy !== after.keepCopy || before.port !== after.port || before.albumIds.join() !== after.albumIds.join())) void sync.run()
    res.json(await answer())
  })

  router.post('/photos/synology/sync', requireSession, requireCsrf, async (_req, res) => {
    if (!photoSettings(deps.getMupiboxConfig()).enabled) return void res.status(409).json({ error: 'photos_off' })
    void sync.run()
    await new Promise((r) => setTimeout(r, 300))
    res.json(await answer())
  })

  router.post('/photos/synology/remove', requireSession, requireCsrf, async (_req, res) => {
    try {
      await deps.updateMupiboxConfig((cfg) => {
        const photos = { ...obj(cfg.photos) }
        const sources = { ...obj(photos.sources) }
        delete sources.synology
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
