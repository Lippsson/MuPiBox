import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ordered } from './app-api/photos/albums'
import { applyPhotoSettings, applyPhotoTimeAction, logicalDate, PHOTO_DEFAULTS, photoSettings } from './app-api/photos/settings'
import type { PhotoAsset } from './app-api/photos/store'

test('photo settings: off with its defaults on a box from before, broken values give the default', () => {
  assert.deepEqual(photoSettings(undefined), PHOTO_DEFAULTS)
  assert.deepEqual(photoSettings({ photos: { enabled: 'yes', slideshowSeconds: 4, order: 'x', screensaver: { afterMinutes: 99 } } }), PHOTO_DEFAULTS)
  const s = photoSettings({ photos: { enabled: true, slideshowSeconds: 3, order: 'taken', screensaver: { enabled: true, afterMinutes: 12 } } })
  assert.equal(s.enabled, true)
  assert.equal(s.slideshowSeconds, 3)
  assert.equal(s.order, 'taken')
  assert.deepEqual(s.screensaver, { enabled: true, afterMinutes: 12, duringPlayback: false })
})

test('photo settings: a change takes only known fields in range, a wrong one writes nothing', () => {
  const target: Record<string, unknown> = { enabled: false, screensaver: { enabled: true, afterMinutes: 5 } }
  assert.equal(applyPhotoSettings(target, { enabled: true, slideshowSeconds: 8, screensaver: { afterMinutes: 30 }, other: 1 }), null)
  assert.deepEqual(target, { enabled: true, slideshowSeconds: 8, screensaver: { enabled: true, afterMinutes: 30 } })
  const before = JSON.stringify(target)
  assert.match(String(applyPhotoSettings(target, { enabled: false, slideshowSeconds: 4 })), /slideshowSeconds/)
  assert.match(String(applyPhotoSettings(target, { screensaver: { afterMinutes: 0 } })), /afterMinutes/)
  assert.match(String(applyPhotoSettings(target, { order: 'random' })), /order/)
  assert.equal(JSON.stringify(target), before)
})

test('photo order: newest first, by the day taken (else the day it came), shuffled keeps every picture', () => {
  const a = (id: string, added: string, taken: string | null): PhotoAsset => ({ id, w: 1, h: 1, added, taken, kind: 'photo' })
  const list = [a('a', '2026-01-02', '2020-05-01T10:00:00'), a('b', '2026-01-03', null), a('c', '2026-01-01', '2019-01-01T08:00:00')]
  assert.deepEqual(ordered(list, 'newest').map((x) => x.id), ['b', 'a', 'c'])
  assert.deepEqual(ordered(list, 'taken').map((x) => x.id), ['c', 'a', 'b'])
  assert.deepEqual(ordered(list, 'shuffle').map((x) => x.id).sort(), ['a', 'b', 'c'])
  assert.deepEqual(list.map((x) => x.id), ['a', 'b', 'c'])
})

test('photo time settings: mode, limit, minutes per weekday, warning and idle pause - checked, broken ones the default', () => {
  const s = photoSettings({ photos: { limitMode: 'shared', limitEnabled: false, dailyMinutes: { mon: 0, tue: 45, wed: -1, thu: '30' }, warnMinutes: 3, idlePauseSeconds: 300 } })
  assert.equal(s.limitMode, 'shared')
  assert.equal(s.limitEnabled, false)
  assert.deepEqual(s.dailyMinutes, { mon: 0, tue: 45, wed: 20, thu: 30, fri: 20, sat: 20, sun: 20 })
  assert.equal(s.warnMinutes, 5)
  assert.equal(s.idlePauseSeconds, 300)
  const target: Record<string, unknown> = { dailyMinutes: { mon: 10 } }
  assert.equal(applyPhotoSettings(target, { limitMode: 'separate', dailyMinutes: { sat: 30 }, warnMinutes: 0, idlePauseSeconds: 60, limitEnabled: true }), null)
  assert.deepEqual(target, { dailyMinutes: { mon: 10, sat: 30 }, limitMode: 'separate', warnMinutes: 0, idlePauseSeconds: 60, limitEnabled: true })
  const before = JSON.stringify(target)
  assert.match(String(applyPhotoSettings(target, { dailyMinutes: { sat: 1441 } })), /dailyMinutes/)
  assert.match(String(applyPhotoSettings(target, { dailyMinutes: { someday: 5 } })), /weekday/)
  assert.match(String(applyPhotoSettings(target, { limitMode: 'both' })), /limitMode/)
  assert.match(String(applyPhotoSettings(target, { warnMinutes: 3 })), /warnMinutes/)
  assert.match(String(applyPhotoSettings(target, { idlePauseSeconds: 30 })), /idlePauseSeconds/)
  assert.equal(JSON.stringify(target), before)
})

test('photo time actions: today by the reset hour, minutes add up, free, reset keeps them; another day starts anew', () => {
  const now = new Date(2026, 10, 11, 2, 30)
  assert.equal(logicalDate(now, 4), '2026-11-10')
  assert.equal(logicalDate(now, 0), '2026-11-11')
  const cfg: Record<string, unknown> = { playtimeLimit: { resetHour: 4 }, photos: { enabled: true, today: { date: '2026-11-09', free: true } } }
  assert.equal(applyPhotoTimeAction(cfg, 'extend', 10, now), null)
  assert.equal(applyPhotoTimeAction(cfg, 'extend', 5, now), null)
  assert.deepEqual((cfg.photos as Record<string, unknown>).today, { date: '2026-11-10', bonusMinutes: 15 })
  assert.equal(applyPhotoTimeAction(cfg, 'free', undefined, now), null)
  assert.equal(applyPhotoTimeAction(cfg, 'reset', undefined, now), null)
  assert.deepEqual((cfg.photos as Record<string, unknown>).today, { date: '2026-11-10', bonusMinutes: 15, free: true, reset: now.getTime() })
  assert.equal((cfg.photos as Record<string, unknown>).enabled, true)
  const before = JSON.stringify(cfg)
  assert.match(String(applyPhotoTimeAction(cfg, 'extend', 0, now)), /minutes/)
  assert.match(String(applyPhotoTimeAction(cfg, 'more', 5, now)), /action/)
  assert.equal(JSON.stringify(cfg), before)
})

test('photo NAS folders: paths cleaned, settings checked, defaults on a box from before', async () => {
  const { applyNasPhotoSettings, cleanNasPath, nasPhotoSettings } = await import('./app-api/photos/nas')
  assert.equal(cleanNasPath('photo//2024/'), '/photo/2024')
  assert.equal(cleanNasPath('/a/../b'), null)
  assert.equal(cleanNasPath('/'), null)
  assert.deepEqual(nasPhotoSettings(undefined), { folders: [], subfoldersAsAlbums: true, syncMinutes: 360, cacheLimitMb: 2048 })
  const cfg: Record<string, unknown> = { photos: { enabled: true, sources: { immich: { url: 'x' } } } }
  assert.equal(applyNasPhotoSettings(cfg, { folders: ['/Fotos/Urlaub', 'Fotos/Urlaub', '/Fotos/Zelten'], subfoldersAsAlbums: false, syncMinutes: 60, cacheLimitMb: 0 }), null)
  assert.deepEqual(nasPhotoSettings(cfg), { folders: ['/Fotos/Urlaub', '/Fotos/Zelten'], subfoldersAsAlbums: false, syncMinutes: 60, cacheLimitMb: 0 })
  assert.deepEqual((cfg.photos as { sources: Record<string, unknown> }).sources.immich, { url: 'x' })
  const before = JSON.stringify(cfg)
  assert.equal(applyNasPhotoSettings(cfg, { folders: ['/ok', '/../x'] }), 'folders')
  assert.equal(applyNasPhotoSettings(cfg, { syncMinutes: 30 }), 'syncMinutes')
  assert.equal(applyNasPhotoSettings(cfg, { cacheLimitMb: 3000 }), 'cacheLimitMb')
  assert.equal(JSON.stringify(cfg), before)
})

test('photo Immich: address and settings checked, the key kept as given to encrypt', async () => {
  const { applyImmichSettings, cleanImmichUrl, immichSettings } = await import('./app-api/photos/immich')
  assert.equal(cleanImmichUrl('192.168.1.20:2283'), 'http://192.168.1.20:2283')
  assert.equal(cleanImmichUrl('https://photos.example.lan/api/'), 'https://photos.example.lan')
  assert.equal(cleanImmichUrl('ftp://x'), null)
  assert.equal(cleanImmichUrl('http://user:pw@x'), null)
  const cfg: Record<string, unknown> = { photos: { sources: { nas: { folders: ['/a'] } } } }
  const id = '0f2b8c1e-1234-4abc-9def-0123456789ab'
  assert.equal(applyImmichSettings(cfg, { url: 'http://10.0.0.5:2283', apiKey: 'abcdefghijklmnop', albumIds: [id, id], keepCopy: false }, (x) => `enc:${x}`), null)
  const s = immichSettings(cfg)
  assert.equal(s.url, 'http://10.0.0.5:2283')
  assert.equal(s.apiKey, 'enc:abcdefghijklmnop')
  assert.deepEqual(s.albumIds, [id])
  assert.equal(s.keepCopy, false)
  assert.deepEqual((cfg.photos as { sources: Record<string, unknown> }).sources.nas, { folders: ['/a'] })
  const before = JSON.stringify(cfg)
  assert.equal(applyImmichSettings(cfg, { albumIds: ['nope'] }), 'albumIds')
  assert.equal(applyImmichSettings(cfg, { apiKey: 'short' }), 'apiKey')
  assert.equal(applyImmichSettings(cfg, { url: 'ftp://x' }), 'url')
  // (another server: the key kept is not handed on to it)
  assert.equal(applyImmichSettings(cfg, { url: 'http://evil.example:2283' }), 'apiKey')
  assert.equal(JSON.stringify(cfg), before)
  assert.equal(applyImmichSettings(cfg, { url: 'http://10.0.0.5:2283/' }), null)
  assert.equal(applyImmichSettings(cfg, { url: 'http://10.0.0.6:2283', apiKey: 'zyxwvutsrqponmlk' }, (x) => `enc:${x}`), null)
  assert.equal(immichSettings(cfg).apiKey, 'enc:zyxwvutsrqponmlk')
})

test('photo Immich: the test and an album against a server like Immich (old version, wrong key, assets searched)', async () => {
  const { ImmichClient, testImmich } = await import('./app-api/photos/immich')
  const http = await import('node:http')
  const A = '0f2b8c1e-1234-4abc-9def-0123456789ab'
  const P = '11111111-2222-4333-8444-555555555555'
  let version: unknown = { major: 1, minor: 120, patch: 2 }
  const server = http.createServer((req, res) => {
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    const url = req.url ?? ''
    if (url === '/api/server/version') return version ? json(200, version) : json(404, {})
    const key = req.headers['x-api-key']
    if (key === 'no-albums-0123' && url.startsWith('/api/albums')) return json(403, { message: 'Missing required permission: album.read' })
    if (key === 'no-view-01234' && url.startsWith('/api/assets/')) return json(403, { message: 'Missing required permission: asset.view' })
    if (key === 'no-read-01234' && url === '/api/search/metadata') return json(403, { message: 'Missing required permission: asset.read' })
    if (key !== 'good-key-0123' && !String(key).startsWith('no-')) return json(401, { message: 'Invalid API key' })
    if (url === `/api/assets/${P}/thumbnail?size=thumbnail`) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' })
      return res.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
    }
    if (url.startsWith('/api/albums?shared=true')) return json(200, [])
    if (url === '/api/albums') return json(200, [{ id: A, albumName: 'Urlaub', assetCount: 2, albumThumbnailAssetId: P }])
    if (url.startsWith(`/api/albums/${A}`)) return json(200, { id: A, albumName: 'Urlaub', assetCount: 2 })
    if (url === '/api/users/me') return json(200, { name: 'Familie' })
    if (url === '/api/search/metadata' && req.method === 'POST') {
      return json(200, { assets: { items: [{ id: P, type: 'IMAGE', checksum: 'c1' }, { id: A, type: 'VIDEO' }], nextPage: null } })
    }
    json(404, {})
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  const port = (server.address() as { port: number }).port
  try {
    const base = `http://127.0.0.1:${port}`
    assert.deepEqual(await testImmich(new ImmichClient(base, 'good-key-0123')), { ok: true, version: '1.120.2', account: 'Familie', albums: 1, assets: 2 })
    assert.deepEqual(await testImmich(new ImmichClient(base, 'wrong-key-0123')), { ok: false, error: 'unauthorized' })
    // (a key with chosen rights: one missing is told apart from a wrong key)
    for (const key of ['no-albums-0123', 'no-view-01234', 'no-read-01234']) assert.deepEqual(await testImmich(new ImmichClient(base, key)), { ok: false, error: 'permissions' }, key)
    const album = await new ImmichClient(base, 'good-key-0123').album(A)
    assert.equal(album.name, 'Urlaub')
    assert.deepEqual(album.assets.map((x) => x.id), [P])
    version = { major: 1, minor: 105, patch: 0 }
    assert.deepEqual(await testImmich(new ImmichClient(base, 'good-key-0123')), { ok: false, error: 'unsupportedVersion' })
    version = null
    assert.deepEqual(await testImmich(new ImmichClient(base, 'good-key-0123')), { ok: false, error: 'unsupportedVersion' })
  } finally {
    server.close()
  }
  assert.deepEqual(await testImmich(new ImmichClient('http://127.0.0.1:1', 'good-key-0123')), { ok: false, error: 'unreachable' })
})

test('photo Immich: trouble of the server (or a proxy in front of it) counts as away, a missing picture does not', async () => {
  const { immichDown, ImmichAway, ImmichRefused } = await import('./app-api/photos/immich')
  assert.equal(immichDown(new ImmichAway('x')), true)
  for (const status of [500, 502, 503, 504, 429]) assert.equal(immichDown(new ImmichRefused(status)), true, String(status))
  for (const status of [400, 401, 403, 404]) assert.equal(immichDown(new ImmichRefused(status)), false, String(status))
  assert.equal(immichDown(new Error('x')), false)
})

test('photo Immich: a clip length from its duration', async () => {
  const { clipSeconds } = await import('./app-api/photos/immich')
  assert.equal(clipSeconds('0:00:24.533000'), 25)
  assert.equal(clipSeconds('1:02:03.000000'), 3723)
  assert.equal(clipSeconds(null), 0)
  assert.equal(clipSeconds('nonsense'), 0)
})
