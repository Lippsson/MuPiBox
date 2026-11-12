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
    const album = await new ImmichClient(base, 'good-key-0123').album(A, AbortSignal.timeout(5000), false)
    assert.equal(album.name, 'Urlaub')
    assert.deepEqual(album.items.map((x) => x.ref), [P])
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
  // (a time limit that ran out - also while the answer was read - is the service not answering)
  assert.equal(immichDown(new DOMException('timed out', 'TimeoutError')), true)
  // (the connection lost while an answer is read - a socket's error, fetch's 'terminated' - is the service away too; an error of the card is not)
  assert.equal(immichDown(Object.assign(new Error('aborted'), { code: 'ECONNRESET' })), true)
  assert.equal(immichDown(new TypeError('terminated', { cause: Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }) })), true)
  assert.equal(immichDown(Object.assign(new Error('no space left'), { code: 'ENOSPC' })), false)
})

test('photo Immich: a clip length from its duration', async () => {
  const { clipSeconds } = await import('./app-api/photos/immich')
  assert.equal(clipSeconds('0:00:24.533000'), 25)
  assert.equal(clipSeconds('1:02:03.000000'), 3723)
  assert.equal(clipSeconds(null), 0)
  assert.equal(clipSeconds('nonsense'), 0)
})

test('photo Synology: the address of DSM, the login bound to it, the certificate', async () => {
  const { applySynologySettings, cleanSynologyUrl, synologySettings } = await import('./app-api/photos/synology')
  assert.equal(cleanSynologyUrl('192.168.1.10'), 'https://192.168.1.10:5001')
  assert.equal(cleanSynologyUrl('http://nas.local'), 'http://nas.local:5000')
  assert.equal(cleanSynologyUrl('https://nas.example.lan:8443/'), 'https://nas.example.lan:8443')
  assert.equal(cleanSynologyUrl('https://nas/photo'), null)
  assert.equal(cleanSynologyUrl('ftp://nas'), null)
  assert.equal(cleanSynologyUrl('http://user:pw@nas'), null)
  const cfg: Record<string, unknown> = {}
  const fp = Array.from({ length: 32 }, () => 'ab').join(':')
  assert.equal(applySynologySettings(cfg, { url: '10.0.0.5', account: 'box', password: 'secret', certFingerprint: fp }, (x) => `enc:${x}`), null)
  let s = synologySettings(cfg)
  assert.equal(s.url, 'https://10.0.0.5:5001')
  assert.equal(s.password, 'enc:secret')
  assert.equal(s.certFingerprint, fp.toUpperCase())
  // (the password kept belongs to its address and account: another one only with the password typed in anew)
  assert.equal(applySynologySettings(cfg, { url: '10.0.0.6' }), 'password')
  assert.equal(applySynologySettings(cfg, { account: 'other' }), 'password')
  assert.equal(applySynologySettings(cfg, { enabled: true, albumIds: ['12', '7'] }), null)
  // (another address: the certificate confirmed for the one before goes)
  assert.equal(applySynologySettings(cfg, { url: '10.0.0.6', password: 'new' }, (x) => `enc:${x}`), null)
  s = synologySettings(cfg)
  assert.equal(s.certFingerprint, '')
  assert.deepEqual(s.albumIds, ['12', '7'])
  assert.equal(applySynologySettings(cfg, { albumIds: ['x'] }), 'albumIds')
  assert.equal(applySynologySettings(cfg, { certFingerprint: 'nope' }), 'certFingerprint')
})

test('photo Nextcloud: the address, the WebDAV answer, the login bound to the address', async () => {
  const { applyNextcloudSettings, cleanNextcloudUrl, nextcloudSettings, parseMultistatus } = await import('./app-api/photos/nextcloud')
  assert.equal(cleanNextcloudUrl('cloud.example.lan'), 'https://cloud.example.lan')
  assert.equal(cleanNextcloudUrl('http://10.0.0.5:8080/nextcloud/index.php/apps/photos/'), 'http://10.0.0.5:8080/nextcloud')
  assert.equal(cleanNextcloudUrl('https://cloud.example.lan/apps/photos/albums'), 'https://cloud.example.lan')
  assert.equal(cleanNextcloudUrl('ftp://x'), null)
  assert.equal(cleanNextcloudUrl('https://u:p@x'), null)
  const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
    <d:response><d:href>/remote.php/dav/photos/box/albums/Urlaub%20%26%20Meer/</d:href><d:propstat><d:prop><nc:nbItems>5</nc:nbItems><nc:last-photo>127</nc:last-photo></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
      <d:propstat><d:prop><nc:location/></d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat></d:response>
    <d:response><d:href>/remote.php/dav/photos/box/albums/Urlaub%20%26%20Meer/128-a.jpg</d:href><d:propstat><d:prop><oc:fileid>128</oc:fileid><d:getetag>&quot;158d&quot;</d:getetag><nc:metadata-photos-size><width>1200</width><height>1800</height></nc:metadata-photos-size></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
  </d:multistatus>`
  const r = parseMultistatus(xml)
  assert.equal(r.length, 2)
  assert.equal(decodeURIComponent(r[0].href), '/remote.php/dav/photos/box/albums/Urlaub & Meer/')
  assert.deepEqual(r[0].props, { nbItems: '5', 'last-photo': '127' })
  assert.equal(r[1].props.fileid, '128')
  assert.equal(r[1].props.getetag, '"158d"')
  assert.match(r[1].props['metadata-photos-size'], /<width>1200<\/width>/)
  const cfg: Record<string, unknown> = {}
  assert.equal(applyNextcloudSettings(cfg, { url: 'cloud.example.lan', account: 'box', userId: 'box', password: 'app-pass' }, (x) => `enc:${x}`), null)
  assert.equal(nextcloudSettings(cfg).password, 'enc:app-pass')
  assert.equal(applyNextcloudSettings(cfg, { url: 'other.example.lan' }), 'password')
  assert.equal(applyNextcloudSettings(cfg, { userId: '../x' }), 'userId')
  assert.equal(applyNextcloudSettings(cfg, { albumIds: ['nope'] }), 'albumIds')
})

test('photo iCloud: the album key of a link, albums added and removed', async () => {
  const { applyIcloudSettings, icloudKeyOf, icloudSettings } = await import('./app-api/photos/icloud')
  assert.equal(icloudKeyOf('https://photos.icloud.com/shared/album/017vLW1qrDNX8sOcTld_CZOBA'), '017vLW1qrDNX8sOcTld_CZOBA')
  assert.equal(icloudKeyOf(' photos.icloud.com/shared/album/017vLW1qrDNX8sOcTld_CZOBA/?x=1 '), '017vLW1qrDNX8sOcTld_CZOBA')
  assert.equal(icloudKeyOf('https://www.icloud.com/sharedalbum/#B0aGWZuqDGxxxx'), 'old')
  assert.equal(icloudKeyOf('https://evil.example/shared/album/017vLW1qrDNX8sOcTld_CZOBA'), null)
  assert.equal(icloudKeyOf('https://photos.icloud.com/shared/album/../x'), null)
  const cfg: Record<string, unknown> = {}
  assert.equal(applyIcloudSettings(cfg, { add: { key: '017vLW1qrDNX8sOcTld_CZOBA', title: 'Ferien' } }), null)
  assert.equal(applyIcloudSettings(cfg, { add: { key: '017vLW1qrDNX8sOcTld_CZOBA', title: 'twice' } }), null)
  assert.deepEqual(icloudSettings(cfg).albums, [{ key: '017vLW1qrDNX8sOcTld_CZOBA', title: 'Ferien' }])
  assert.equal(applyIcloudSettings(cfg, { add: { key: 'bad key!' } }), 'add')
  assert.equal(applyIcloudSettings(cfg, { remove: '017vLW1qrDNX8sOcTld_CZOBA', keepCopy: false }), null)
  assert.deepEqual(icloudSettings(cfg).albums, [])
  assert.equal(icloudSettings(cfg).keepCopy, false)
})

test('photo PhotoPrism: the address, a picture and its clip, the login bound to the address', async () => {
  const { applyPhotoprismSettings, cleanPhotoprismUrl, photoprismSettings, photoprismVer } = await import('./app-api/photos/photoprism')
  assert.equal(cleanPhotoprismUrl('192.168.1.20:2342'), 'http://192.168.1.20:2342')
  assert.equal(cleanPhotoprismUrl('photos.example.lan'), 'https://photos.example.lan')
  assert.equal(cleanPhotoprismUrl('https://photos.example.lan/pp/library/albums/atoe48cgmajrq1j5/view'), 'https://photos.example.lan/pp')
  assert.equal(cleanPhotoprismUrl('ftp://x'), null)
  assert.equal(cleanPhotoprismUrl('https://u:p@x'), null)
  const h1 = 'a'.repeat(40)
  const h2 = 'b'.repeat(40)
  assert.deepEqual(photoprismVer({ Type: 'image', Hash: h1 }), { kind: 'photo', ver: h1 })
  assert.deepEqual(photoprismVer({ Type: 'live', Hash: h1 }), { kind: 'photo', ver: h1 })
  assert.deepEqual(photoprismVer({ Type: 'video', Hash: h1, Files: [{ Hash: h1, Primary: true }, { Hash: h2, Video: true, Codec: 'avc1' }] }), { kind: 'video', ver: `${h1}.${h2}` })
  assert.equal(photoprismVer({ Type: 'video', Hash: h1, Files: [{ Hash: h1, Primary: true }] }), null)
  assert.equal(photoprismVer({ Type: 'image', Hash: '../x' }), null)
  const cfg: Record<string, unknown> = {}
  assert.equal(applyPhotoprismSettings(cfg, { url: '10.0.0.9:2342', password: 'app-pass', account: 'Box' }, (x) => `enc:${x}`), null)
  assert.equal(photoprismSettings(cfg).password, 'enc:app-pass')
  assert.equal(photoprismSettings(cfg).url, 'http://10.0.0.9:2342')
  assert.equal(applyPhotoprismSettings(cfg, { url: 'other.example.lan' }), 'password')
  assert.equal(applyPhotoprismSettings(cfg, { albumIds: ['nope'] }), 'albumIds')
  assert.equal(applyPhotoprismSettings(cfg, { albumIds: ['atoe48cgmajrq1j5'] }), null)
  assert.deepEqual(photoprismSettings(cfg).albumIds, ['atoe48cgmajrq1j5'])
})
