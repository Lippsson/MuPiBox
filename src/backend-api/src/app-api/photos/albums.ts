// The photo display's albums (5.1): the app's Bibliothek › Fotos (overview, an album, uploading - the parents' login)
// and what the box's display reads (/api/photos/..., only the albums shown there, never a source or an account).

import { createHash, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream, promises as fsp } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Express, Request, Response, Router } from 'express'
import type { MupiboxConfig } from '../../models/mupibox-config.model'
import { requireCsrf, requireSession } from '../middleware'
import { extOf, NotAPicture, PHOTO_EXTENSIONS, photoFiles, processPhoto } from './process'
import { photoSettings, type PhotoOrder } from './settings'
import { album as findAlbum, albumDir, albums, assetBase, cardSpace, coverOf, INCOMING_DIR, isId, newId, type PhotoAlbum, type PhotoAsset, photoBytes, sweepLeftovers, update } from './store'

export interface PhotoAlbumDeps {
  getMupiboxConfig: () => MupiboxConfig | undefined
}

// what stays free on the card (the box needs room for its own: logs, covers, updates)
const RESERVE_BYTES = 300 * 1024 * 1024
// a photo from a phone: up to 50 MB (a RAW-like PNG); a video comes later with its own limit
const MAX_PHOTO_BYTES = 50 * 1024 * 1024
// what a picture takes on the box in its three sizes, for the check before an upload (see process.ts)
const STORED_BYTES_PER_PHOTO = 450 * 1024
const TITLE_MAX = 40

const cleanTitle = (raw: unknown): string | null => {
  // eslint-disable-next-line no-control-regex
  const t = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length >= 1 && t.length <= TITLE_MAX ? t : null
}

const SIZE_SUFFIX: Record<string, string> = { f: '.jpg', s: '.s.jpg', b: '.b.jpg' }

/** The pictures of an album in the order chosen (Einstellungen › Fotos › Reihenfolge) */
export function ordered(assets: PhotoAsset[], order: PhotoOrder): PhotoAsset[] {
  const list = [...assets]
  if (order === 'newest') return list.sort((a, b) => b.added.localeCompare(a.added))
  if (order === 'taken') return list.sort((a, b) => (a.taken ?? a.added).localeCompare(b.taken ?? b.added))
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

const summary = (a: PhotoAlbum) => ({
  id: a.id,
  title: a.title,
  source: a.source,
  display: a.display,
  position: a.position,
  count: a.assets.length,
  videos: 0,
  cover: coverOf(a) ?? null,
})

/** Sends one size of a picture of an album (s: grid, f: full, b: background) - only one the list knows */
async function sendPicture(req: Request, res: Response, onlyShown: boolean): Promise<void> {
  const { album: albumId, asset: assetId, size } = req.params as Record<string, string>
  const suffix = SIZE_SUFFIX[size]
  if (!isId(albumId) || !isId(assetId) || !suffix) return void res.status(400).end()
  const a = await findAlbum(albumId)
  if (!a || (onlyShown && !a.display) || !a.assets.some((x) => x.id === assetId)) return void res.status(404).end()
  // (an id is never used for another picture: kept by the browser for long)
  // (dotfiles: the data folder is below /home/dietpi/.mupibox - express refuses a path with a dot folder by default)
  res.sendFile(`${assetBase(a, assetId)}${suffix}`, { dotfiles: 'allow', headers: { 'Cache-Control': 'private, max-age=31536000, immutable' } }, (err) => {
    if (err && !res.headersSent) res.status(404).end()
  })
}

async function sumOf(file: string): Promise<string> {
  const hash = createHash('sha1')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

export function registerPhotoAlbumRoutes(router: Router, deps: PhotoAlbumDeps): void {
  // (once at the start: what an upload left when the box went off - an upload waits for it)
  const swept = sweepLeftovers().catch((err) => console.warn(`${new Date().toLocaleString()}: [photos] cleanup: ${(err as Error).message}`))

  /** GET /api/app/photos/overview - the albums (with their state), the numbers and the card's space */
  // (?light=1: without the card's space - the library's line asks only for the numbers, counting the pictures' bytes
  // takes a while with thousands of them)
  router.get('/photos/overview', requireSession, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const list = await albums()
    const [space, used] = req.query.light ? [null, 0] : await Promise.all([cardSpace(), photoBytes()])
    res.json({
      enabled: photoSettings(deps.getMupiboxConfig()).enabled,
      albums: list.map(summary),
      totals: { photos: list.reduce((n, a) => n + a.assets.length, 0), videos: 0, albums: list.length },
      storage: space ? { total: space.total, free: space.free, photos: used } : null,
    })
  })

  /** GET /api/app/photos/albums/:id - an album with its pictures (newest first, as they came) */
  router.get('/photos/albums/:id', requireSession, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const a = isId(req.params.id) ? await findAlbum(req.params.id) : undefined
    if (!a) return void res.status(404).json({ error: 'no such album' })
    res.json({ ...summary(a), assets: ordered(a.assets, 'newest').map(({ id, w, h, taken, added }) => ({ id, w, h, taken, added })) })
  })

  /** POST /api/app/photos/albums {title} - a new album for uploads (shown on the display, last place) */
  router.post('/photos/albums', requireSession, requireCsrf, async (req, res) => {
    const title = cleanTitle((req.body as { title?: unknown } | undefined)?.title)
    if (!title) return void res.status(400).json({ error: 'title' })
    const created = await update((lib) => {
      const a: PhotoAlbum = { id: newId(), title, source: 'upload', display: true, position: lib.albums.length, created: new Date().toISOString(), assets: [] }
      lib.albums.push(a)
      return a
    })
    res.json(summary(created))
  })

  /** POST /api/app/photos/albums/order {ids} - the order on the display (ids not named keep their order behind) */
  router.post('/photos/albums/order', requireSession, requireCsrf, async (req, res) => {
    const ids = (req.body as { ids?: unknown } | undefined)?.ids
    if (!Array.isArray(ids) || !ids.every(isId)) return void res.status(400).json({ error: 'ids' })
    await update((lib) => {
      const place = new Map((ids as string[]).map((id, i) => [id, i]))
      for (const a of lib.albums) a.position = place.get(a.id) ?? ids.length + a.position
    })
    res.json({ ok: true, albums: (await albums()).map(summary) })
  })

  /** POST /api/app/photos/albums/:id {title?, display?, cover?} - rename (uploads only), show/hide, its picture */
  router.post('/photos/albums/:id', requireSession, requireCsrf, async (req, res) => {
    if (!isId(req.params.id)) return void res.status(400).json({ error: 'id' })
    const body = (req.body ?? {}) as { title?: unknown; display?: unknown; cover?: unknown }
    const title = body.title === undefined ? undefined : cleanTitle(body.title)
    if (title === null) return void res.status(400).json({ error: 'title' })
    if (body.display !== undefined && typeof body.display !== 'boolean') return void res.status(400).json({ error: 'display' })
    if (body.cover !== undefined && !isId(body.cover)) return void res.status(400).json({ error: 'cover' })
    const result = await update((lib) => {
      const a = lib.albums.find((x) => x.id === req.params.id)
      if (!a) return 'missing'
      if (title !== undefined) {
        if (a.source !== 'upload') return 'not_upload'
        a.title = title
      }
      if (typeof body.display === 'boolean') a.display = body.display
      if (typeof body.cover === 'string') {
        if (!a.assets.some((x) => x.id === body.cover)) return 'no_asset'
        a.cover = body.cover
      }
      return summary(a)
    })
    if (typeof result === 'string') return void res.status(result === 'missing' ? 404 : 400).json({ error: result })
    res.json(result)
  })

  /** POST /api/app/photos/albums/:id/delete - an uploaded album with its pictures, from the card */
  router.post('/photos/albums/:id/delete', requireSession, requireCsrf, async (req, res) => {
    if (!isId(req.params.id)) return void res.status(400).json({ error: 'id' })
    const gone = await update((lib) => {
      const a = lib.albums.find((x) => x.id === req.params.id)
      if (!a || a.source !== 'upload') return null
      lib.albums = lib.albums.filter((x) => x !== a)
      return a
    })
    if (!gone) return void res.status(404).json({ error: 'no such album' })
    await fsp.rm(albumDir(gone), { recursive: true, force: true })
    res.json({ ok: true })
  })

  /** POST /api/app/photos/albums/:id/assets/delete {ids} - pictures of an uploaded album, from the card */
  router.post('/photos/albums/:id/assets/delete', requireSession, requireCsrf, async (req, res) => {
    const ids = (req.body as { ids?: unknown } | undefined)?.ids
    if (!isId(req.params.id) || !Array.isArray(ids) || ids.length === 0 || !ids.every(isId)) return void res.status(400).json({ error: 'ids' })
    const gone = new Set(ids as string[])
    const a = await update((lib) => {
      const x = lib.albums.find((y) => y.id === req.params.id)
      if (!x || x.source !== 'upload') return null
      x.assets = x.assets.filter((p) => !gone.has(p.id))
      if (x.cover && gone.has(x.cover)) delete x.cover
      return x
    })
    if (!a) return void res.status(404).json({ error: 'no such album' })
    for (const id of gone) for (const f of photoFiles(assetBase(a, id))) await fsp.rm(f, { force: true })
    res.json({ ok: true, count: a.assets.length })
  })

  /** POST /api/app/photos/upload/check {files, bytes} - is there room for this choice (before it starts)? */
  router.post('/photos/upload/check', requireSession, requireCsrf, async (req, res) => {
    const files = Number((req.body as { files?: unknown } | undefined)?.files)
    if (!Number.isInteger(files) || files < 0 || files > 10_000) return void res.status(400).json({ error: 'files' })
    const space = await cardSpace()
    const needed = files * STORED_BYTES_PER_PHOTO
    res.json({ needed, free: space?.free ?? null, enough: space ? space.free - needed > RESERVE_BYTES : true })
  })

  /**
   * PUT /api/app/photos/upload?album=<id>&name=<file name>  Body: the file's bytes.
   * One picture into an uploaded album, made into its sizes at once (no original kept). The answer for the app's list:
   * {ok, asset} or {skipped: 'format' | 'duplicate' | 'broken' | 'space'}.
   */
  router.put('/photos/upload', requireSession, requireCsrf, async (req, res) => {
    const albumId = String(req.query.album ?? '')
    const name = String(req.query.name ?? '')
    const ext = extOf(name)
    if (!isId(albumId)) return void res.status(400).json({ error: 'album' })
    const target = await findAlbum(albumId)
    if (!target || target.source !== 'upload') return void res.status(404).json({ error: 'no such album' })
    if (!PHOTO_EXTENSIONS.includes(ext)) return void res.json({ skipped: 'format' })
    const size = Number.parseInt(String(req.headers['content-length'] ?? ''), 10)
    if (!Number.isFinite(size) || size <= 0) return void res.status(411).json({ error: 'length required' })
    if (size > MAX_PHOTO_BYTES) return void res.json({ skipped: 'format' })
    const space = await cardSpace()
    if (space && space.free - size - STORED_BYTES_PER_PHOTO < RESERVE_BYTES) return void res.json({ skipped: 'space' })

    await swept
    await fsp.mkdir(INCOMING_DIR, { recursive: true })
    const part = path.join(INCOMING_DIR, `${randomBytes(6).toString('hex')}${ext}.part`)
    const id = newId()
    const out = assetBase(target, id)
    try {
      await pipeline(req, createWriteStream(part, { flags: 'wx' }))
      if ((await fsp.stat(part)).size !== size) throw new Error('incomplete')
      const sum = await sumOf(part)
      if (target.assets.some((x) => x.sum === sum)) return void res.json({ skipped: 'duplicate' })
      await fsp.mkdir(albumDir(target), { recursive: true })
      let facts
      try {
        facts = await processPhoto(part, out, ext)
      } catch (err) {
        if (err instanceof NotAPicture) return void res.json({ skipped: 'broken' })
        throw err
      }
      const asset: PhotoAsset = { id, w: facts.w, h: facts.h, taken: facts.taken, added: new Date().toISOString(), kind: 'photo', sum }
      const placed = await update((lib) => {
        const a = lib.albums.find((x) => x.id === albumId)
        if (!a) return false
        // (the same picture twice at once - two uploads of it side by side: once)
        if (a.assets.some((x) => x.sum === sum)) return 'duplicate'
        a.assets.push(asset)
        return true
      })
      if (placed !== true) {
        for (const f of photoFiles(out)) await fsp.rm(f, { force: true })
        return void (placed === 'duplicate' ? res.json({ skipped: 'duplicate' }) : res.status(404).json({ error: 'no such album' }))
      }
      res.json({ ok: true, asset: { id, w: asset.w, h: asset.h } })
    } catch (err) {
      for (const f of photoFiles(out)) await fsp.rm(f, { force: true })
      const message = (err as Error).message
      console.warn(`${new Date().toLocaleString()}: [photos] upload ${name}: ${message}`)
      // (the request is read to its end by now - whether the app still waits shows the answer's side)
      if (!res.headersSent && !res.destroyed) res.status(message === 'heif-convert missing' ? 503 : 500).json({ error: message === 'heif-convert missing' ? 'heif_missing' : 'upload failed' })
    } finally {
      await fsp.rm(part, { force: true })
    }
  })

  /** GET /api/app/photos/file/:album/:asset/:size - a picture for the app (s grid, f full view, b background) */
  router.get('/photos/file/:album/:asset/:size', requireSession, (req, res) => void sendPicture(req, res, false))
}

/**
 * The display's side (port 8200: the box itself, or the app's session - see the server's gate): only when the photo
 * display is on, only albums shown there and with pictures; no source, no account.
 *   GET /api/photos/albums           the albums in their order, with their first two pictures (the stack)
 *   GET /api/photos/album/:id        the pictures of an album in the order chosen
 *   GET /api/photos/file/:album/:asset/:size
 */
export function registerPhotoDisplayRoutes(app: Express, deps: PhotoAlbumDeps): void {
  const on = () => photoSettings(deps.getMupiboxConfig()).enabled
  app.get('/api/photos/albums', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const s = photoSettings(deps.getMupiboxConfig())
    if (!s.enabled) return void res.json({ enabled: false, albums: [] })
    const list = (await albums()).filter((a) => a.display && a.assets.length > 0)
    res.json({
      enabled: true,
      startAsSlideshow: s.startAsSlideshow,
      slideshowSeconds: s.slideshowSeconds,
      albums: list.map((a) => {
        const first = coverOf(a)
        const second = a.assets.find((x) => x.id !== first)?.id ?? null
        return { id: a.id, title: a.title, count: a.assets.length, pictures: [first, second].filter(Boolean) }
      }),
    })
  })
  app.get('/api/photos/album/:id', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const a = on() && isId(req.params.id) ? await findAlbum(req.params.id) : undefined
    if (!a || !a.display) return void res.status(404).json({ error: 'no such album' })
    const order = photoSettings(deps.getMupiboxConfig()).order
    res.json({ id: a.id, title: a.title, assets: ordered(a.assets, order).map(({ id, w, h }) => ({ id, w, h })) })
  })
  app.get('/api/photos/file/:album/:asset/:size', (req, res) => {
    if (!on()) return void res.status(404).end()
    void sendPicture(req, res, true)
  })
}
