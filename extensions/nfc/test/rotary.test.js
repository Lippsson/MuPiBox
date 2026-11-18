// The rotary knob chooses among the albums of an artist cover: the state machine (rotary.js), and the whole way through the API part -
// assign an artist cover, lay the tag on, turn, press - with a made-up host.  node --test extensions/nfc/test/rotary.test.js
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const rotary = require('../rotary.js')
const tags = require('../tags.js')

const album = (title) => ({ type: 'library', category: 'audiobook', artist: 'Astrid Lindgren', title, libraryPath: `audiobook/Astrid Lindgren/${title}`, libraryIsContainer: false, cover: `/api/library/file?path=${title}` })
const children = [album('Ronja'), album('Michel'), album('Pippi'), { type: 'library', category: 'audiobook', artist: 'Astrid Lindgren', title: 'Astrid Lindgren', libraryPath: 'audiobook/Astrid Lindgren', libraryIsContainer: true, ownFiles: true }]
const folder = { browse: 'folder', browseTitle: 'Astrid Lindgren', browsePath: 'audiobook/Astrid Lindgren', browseCover: '/api/library/file?path=a', title: 'Astrid Lindgren', category: 'audiobook' }

// ---- the state machine ------------------------------------------------------------------------------------------------------------
const three = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]

test('the knob starts on the album the tag plays and goes round in both directions', () => {
  const start = rotary.begin({ uid: 'AA', albums: three, currentKey: 'b', seconds: 30, now: 0 })
  assert.strictEqual(start.index, 1)
  const forward = rotary.turn(start, 1, 1000)
  assert.deepStrictEqual([forward.shown.index, forward.shown.count, forward.shown.album.key], [2, 3, 'c'])
  assert.strictEqual(rotary.turn(forward.state, 1, 2000).shown.index, 0, 'after the last one comes the first')
  assert.strictEqual(rotary.turn(rotary.turn(start, -1, 1000).state, -1, 2000).shown.index, 2, 'and before the first the last')
})

test('an album that is not in the list: the knob starts at the first', () => {
  assert.strictEqual(rotary.begin({ uid: 'AA', albums: three, currentKey: 'gone', seconds: 5, now: 0 }).index, 0)
})

test('a press chooses only after the knob was turned; then the knob is free again', () => {
  const start = rotary.begin({ uid: 'AA', albums: three, currentKey: 'a', seconds: 30, now: 0 })
  assert.strictEqual(rotary.press(start, 100), null, 'not turned yet: the press is for what the box does otherwise')
  const turned = rotary.turn(start, 1, 200)
  const pressed = rotary.press(turned.state, 300)
  assert.strictEqual(pressed.album.key, 'b')
  assert.strictEqual(rotary.isActive(pressed.state, 301), false)
  assert.strictEqual(rotary.turn(pressed.state, 1, 400), null)
})

test('the time: every turn starts it anew, when it is over the knob is the box again', () => {
  const start = rotary.begin({ uid: 'AA', albums: three, currentKey: 'a', seconds: 10, now: 0 })
  assert.strictEqual(rotary.isActive(start, 9999), true)
  assert.strictEqual(rotary.isActive(start, 10000), false)
  const turned = rotary.turn(start, 1, 9000)
  assert.strictEqual(rotary.isActive(turned.state, 18999), true)
  assert.strictEqual(rotary.turn(turned.state, 1, 19000), null)
  assert.strictEqual(rotary.press(turned.state, 19000), null)
})

test('0 seconds: no time limit - the knob stays the knob of the albums until one is chosen', () => {
  const start = rotary.begin({ uid: 'AA', albums: three, currentKey: 'a', seconds: 0, now: 0 })
  const day = 24 * 3600 * 1000
  assert.strictEqual(rotary.isActive(start, day), true)
  const turned = rotary.turn(start, 1, day)
  assert.strictEqual(turned.shown.album.key, 'b')
  assert.strictEqual(rotary.isActive(turned.state, 3 * day), true, 'every turn keeps it without a limit')
  const pressed = rotary.press(turned.state, 3 * day)
  assert.strictEqual(pressed.album.key, 'b')
  assert.strictEqual(rotary.isActive(pressed.state, 3 * day + 1), false, 'the choice ends it')
})

test('one album, or none: there is nothing to choose from', () => {
  assert.strictEqual(rotary.isActive(rotary.begin({ uid: 'AA', albums: [{ key: 'a' }], currentKey: 'a', seconds: 30, now: 0 }), 1), false)
  assert.strictEqual(rotary.isActive(rotary.idle(), 1), false)
})

// ---- the collection in the medium -------------------------------------------------------------------------------------------------
test('a collection travels inside the medium of an album; one that points at nothing is dropped', () => {
  const collection = tags.collectionOf(folder)
  const media = tags.inCollection(album('Pippi'), collection)
  assert.deepStrictEqual([media.browse, media.browsePath, media.browseTitle, media.libraryPath], ['folder', 'audiobook/Astrid Lindgren', 'Astrid Lindgren', 'audiobook/Astrid Lindgren/Pippi'])
  assert.strictEqual(tags.mediaLabel(media), 'Astrid Lindgren', 'the tag is named after the artist cover')
  assert.strictEqual(tags.sanitizeMedia({ ...album('Pippi'), browse: 'folder' }).browse, undefined, 'a folder without a path')
  assert.strictEqual(tags.sanitizeMedia({ ...album('Pippi'), browse: 'entries' }).browse, undefined, 'entries without an artist')
  assert.strictEqual(tags.sanitizeMedia({ ...album('Pippi'), browse: 'sideways', browsePath: 'x' }).browse, undefined)
  assert.strictEqual(tags.sanitizeMedia(folder), null, 'the description alone is no medium that can start')
})

test('the tags of one collection are the same medium, whichever album each plays; the albums are told apart', () => {
  const collection = tags.collectionOf(folder)
  const a = tags.inCollection(album('Pippi'), collection)
  const b = tags.inCollection(album('Ronja'), collection)
  assert.strictEqual(tags.mediumKey(a), tags.mediumKey(b))
  assert.strictEqual(tags.mediumKey(folder), tags.mediumKey(a), 'the description of the app finds them')
  assert.notStrictEqual(tags.albumKey(a), tags.albumKey(b))
  assert.notStrictEqual(tags.mediumKey(a), tags.mediumKey(album('Pippi')), 'not the same as the album alone')
})

test('saving the tags and taking them in again keeps the collection', () => {
  const data = tags.emptyData()
  const media = tags.inCollection(album('Pippi'), tags.collectionOf(folder))
  tags.tagLaidOn(data, { target: 'any', media, until: 1e15 }, { uid: '04A1B2C3' }, 1000)
  const parsed = tags.parseImport(JSON.parse(JSON.stringify(tags.exportData(data))))
  assert.strictEqual(parsed.tags[0].media.browsePath, 'audiobook/Astrid Lindgren')
  const again = tags.parseText(tags.exportCsv(data, 1000)).tags[0].media
  assert.strictEqual(again.browse, 'folder')
})

// ---- the API part ---------------------------------------------------------------------------------------------------------------------
function makeHost(settings) {
  const routes = {}
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nfc-rotary-'))
  const host = {
    dir: path.join(__dirname, '..'),
    dataDir,
    log: { info() {}, warn() {}, debug() {} },
    apiUrl: 'http://api.test',
    playerUrl: 'http://player.test',
    rotaryFlagFile: path.join(dataDir, 'rotary-capture'),
    settings: async () => settings,
    onSettings() {},
    route: (method, sub, handler) => (routes[`${method} ${sub}`] = handler),
  }
  return { host, routes, dataDir }
}
const call = async (handler, req = {}) => {
  const out = { status: 200, body: null }
  const res = { status: (code) => ((out.status = code), res), json: (body) => ((out.body = body), res) }
  await handler({ query: {}, body: {}, headers: {}, socket: { remoteAddress: '127.0.0.1' }, ...req }, res)
  return out
}
const later = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms))

test('an artist cover: assigned, laid on, the knob chooses an album, a press plays it, the OLED shows the name', async () => {
  const realFetch = global.fetch
  const oled = []
  global.fetch = async (url, init) => {
    const u = String(url)
    if (u.startsWith('http://api.test/api/library/children')) return { ok: true, json: async () => children }
    if (u.startsWith('http://api.test/api/ext/oled/select')) {
      oled.push(JSON.parse(init.body))
      return { ok: true, json: async () => ({ ok: true }) }
    }
    if (u.startsWith('http://player.test/local')) return { ok: true, json: async () => ({ currentPlayer: 'mplayer', currentType: 'local', playing: false, generation: 1 }) }
    return { ok: true, json: async () => ({}) }
  }
  try {
    const { host, routes, dataDir } = makeHost({ reader: 'none', onRemove: 'nothing', playOnTag: true, rotary: true, rotarySeconds: 20 })
    const nfc = require('../api.js').activate(host)
    await later(0)
    nfc.feed({ event: 'ready', firmware: '4.0', product: '4.0' })

    // the app sends the artist cover; the albums come from the box in the order of their names, the first plays at first
    const armed = (await call(routes['post /arm'], { body: { media: folder } })).body
    assert.strictEqual(armed.ok, true)
    nfc.feed({ event: 'tag', tech: 'ISO14443A', uid: '04A1B2C3' })
    await later()
    const first = (await call(routes['get /pending'])).body
    assert.strictEqual(first.media.libraryPath, 'audiobook/Astrid Lindgren/Michel')
    const flag = Number(fs.readFileSync(path.join(dataDir, 'rotary-capture'), 'utf8'))
    assert.ok(flag > Date.now(), 'the core service is told that the knob is wanted')

    // the row of the tag has the list of albums with the one it plays; another one can be chosen for the laying on
    const row = (await call(routes['get /tags'])).body.items[0]
    assert.strictEqual(row.title, 'Astrid Lindgren')
    assert.deepStrictEqual(row.select.choices.map((c) => c.label), ['Michel', 'Pippi', 'Ronja'])
    assert.strictEqual(row.select.post, '/api/ext/nfc/tagalbum')
    assert.deepStrictEqual((await call(routes['post /tagsfor'], { body: { media: folder } })).body.items.map((t) => t.id), ['04A1B2C3'], 'the sheet of the artist cover finds it')
    assert.strictEqual((await call(routes['post /tagalbum'], { body: { id: '04A1B2C3', value: 'nope' } })).status, 400)

    // a press before turning is not for the knob; a request that came through the web server is refused
    assert.deepStrictEqual((await call(routes['post /rotary'], { body: { button: true } })).body, { handled: false })
    assert.strictEqual((await call(routes['post /rotary'], { body: { turn: 1 }, headers: { 'x-forwarded-for': '10.0.0.7' } })).status, 403)
    assert.strictEqual((await call(routes['post /rotary'], { body: { turn: 1 }, socket: { remoteAddress: '192.168.1.40' } })).status, 403)

    // turn: the display shows the name; again; back; a press plays that album and the display goes back to the player
    assert.deepStrictEqual((await call(routes['post /rotary'], { body: { turn: 1 } })).body, { handled: true })
    assert.deepStrictEqual(oled.at(-1), { title: 'Pippi', artist: 'Astrid Lindgren', index: 2, count: 3, seconds: 20 })
    await call(routes['post /rotary'], { body: { turn: 1 } })
    assert.strictEqual(oled.at(-1).title, 'Ronja')
    await call(routes['post /rotary'], { body: { turn: -1 } })
    assert.strictEqual(oled.at(-1).title, 'Pippi')
    assert.deepStrictEqual((await call(routes['post /rotary'], { body: { button: true } })).body, { handled: true })
    assert.deepStrictEqual(oled.at(-1), { clear: true })
    assert.strictEqual((await call(routes['get /pending'])).body.media.libraryPath, 'audiobook/Astrid Lindgren/Pippi')
    assert.strictEqual(fs.existsSync(path.join(dataDir, 'rotary-capture')), false, 'the knob is the box again')
    assert.deepStrictEqual((await call(routes['post /rotary'], { body: { turn: 1 } })).body, { handled: false })

    // what the knob chose does not change what the tag plays when it is laid on; the list does
    assert.strictEqual((await call(routes['post /tagalbum'], { body: { id: '04A1B2C3', value: row.select.choices[2].value } })).body.ok, true)
    assert.strictEqual((await call(routes['get /tags'])).body.items[0].select.value, row.select.choices[2].value)
    // (more than the two seconds the same tag counts as one report after the start the knob made)
    await later(2100)
    nfc.feed({ event: 'gone' })
    nfc.feed({ event: 'tag', tech: 'ISO14443A', uid: '04A1B2C3' })
    await later(50)
    assert.strictEqual((await call(routes['get /pending'])).body.media.libraryPath, 'audiobook/Astrid Lindgren/Ronja')
  } finally {
    global.fetch = realFetch
  }
})

test('0 seconds in the settings: the knob stays taken over, the display shows the name for the longest time, another tag ends it', async () => {
  const realFetch = global.fetch
  const oled = []
  global.fetch = async (url, init) => {
    const u = String(url)
    if (u.startsWith('http://api.test/api/library/children')) return { ok: true, json: async () => children }
    if (u.startsWith('http://api.test/api/ext/oled/select')) {
      oled.push(JSON.parse(init.body))
      return { ok: true, json: async () => ({ ok: true }) }
    }
    return { ok: true, json: async () => ({ currentPlayer: '', playing: false }) }
  }
  try {
    const { host, routes, dataDir } = makeHost({ reader: 'none', onRemove: 'nothing', playOnTag: true, rotary: true, rotarySeconds: 0 })
    const nfc = require('../api.js').activate(host)
    await later(0)
    nfc.feed({ event: 'ready', firmware: '4.0', product: '4.0' })
    await call(routes['post /arm'], { body: { media: folder } })
    nfc.feed({ event: 'tag', tech: 'ISO14443A', uid: '04A1B2C3' })
    await later()
    assert.ok(Number(fs.readFileSync(path.join(dataDir, 'rotary-capture'), 'utf8')) > Date.now())
    assert.deepStrictEqual((await call(routes['post /rotary'], { body: { turn: 1 } })).body, { handled: true })
    assert.deepStrictEqual(oled.at(-1), { title: 'Pippi', artist: 'Astrid Lindgren', index: 2, count: 3, seconds: 300 })
    // (another tag, no collection: the knob is the box's again and the display shows the player)
    nfc.feed({ event: 'gone' })
    nfc.feed({ event: 'tag', tech: 'ISO14443A', uid: '04FFEEDD' })
    await later(50)
    assert.deepStrictEqual((await call(routes['post /rotary'], { body: { turn: 1 } })).body, { handled: false })
    assert.strictEqual(fs.existsSync(path.join(dataDir, 'rotary-capture')), false)
    assert.deepStrictEqual(oled.at(-1), { clear: true })
  } finally {
    global.fetch = realFetch
  }
})

test('the settings: with "Drehregler wählt das Album" off the knob stays the box', async () => {
  const realFetch = global.fetch
  global.fetch = async (url) => (String(url).startsWith('http://api.test/api/library/children') ? { ok: true, json: async () => children } : { ok: true, json: async () => ({ currentPlayer: '' }) })
  try {
    const { host, routes, dataDir } = makeHost({ reader: 'none', onRemove: 'nothing', playOnTag: true, rotary: false })
    const nfc = require('../api.js').activate(host)
    await later(0)
    nfc.feed({ event: 'ready', firmware: '4.0', product: '4.0' })
    await call(routes['post /arm'], { body: { media: folder } })
    nfc.feed({ event: 'tag', tech: 'ISO14443A', uid: '04A1B2C3' })
    await later()
    assert.strictEqual(fs.existsSync(path.join(dataDir, 'rotary-capture')), false)
    assert.deepStrictEqual((await call(routes['post /rotary'], { body: { turn: 1 } })).body, { handled: false })
  } finally {
    global.fetch = realFetch
  }
})

test('a folder the box cannot read is no collection to assign', async () => {
  const realFetch = global.fetch
  global.fetch = async () => ({ ok: false, json: async () => [] })
  try {
    const { host, routes } = makeHost({ reader: 'none' })
    const nfc = require('../api.js').activate(host)
    await later(0)
    nfc.feed({ event: 'ready', firmware: '4.0', product: '4.0' })
    assert.strictEqual((await call(routes['post /arm'], { body: { media: folder } })).status, 400)
  } finally {
    global.fetch = realFetch
  }
})

test('the entries of an artist cover: the albums of the artist in the category, the names the parents gave count, no radio or resume entry', async () => {
  const realFetch = global.fetch
  const items = [
    { type: 'spotify', category: 'music', artist: 'Die drei ???', title: 'Folge 2', id: 'alb2' },
    { type: 'spotify', category: 'music', artist: 'Die drei ???', title: 'Folge 1', id: 'alb1' },
    { type: 'spotify', category: 'music', artist: 'Die drei Fragezeichen', title: 'Folge 3', artist_override: 'Die drei ???', title_override: 'Folge 3 (neu)', id: 'alb3' },
    { type: 'spotify', category: 'audiobook', artist: 'Die drei ???', title: 'Anderes Fach', id: 'alb9' },
    { type: 'spotify', category: 'music', artist: 'Bibi', title: 'Bibi 1', id: 'alb7' },
    { type: 'spotify', category: 'music', artist: 'Die drei ???', title: 'Weiter', id: 'alb8', isResume: true },
    { type: 'spotify', artistid: 'art1', category: 'music', artist: 'Die drei ???', title: 'Alle' },
  ]
  global.fetch = async (url) => (String(url).startsWith('http://api.test/api/data') ? { ok: true, json: async () => items } : { ok: true, json: async () => ({ currentPlayer: '' }) })
  try {
    const { host, routes } = makeHost({ reader: 'none', playOnTag: true })
    const nfc = require('../api.js').activate(host)
    await later(0)
    nfc.feed({ event: 'ready', firmware: '4.0', product: '4.0' })
    const description = { browse: 'entries', browseTitle: 'Die drei ???', browseArtist: 'Die drei ???', browseCategory: 'music', title: 'Die drei ???' }
    await call(routes['post /arm'], { body: { media: description } })
    nfc.feed({ event: 'tag', tech: 'ISO14443A', uid: '04A1B2C3' })
    await later()
    const row = (await call(routes['get /tags'])).body.items[0]
    assert.deepStrictEqual(row.select.choices.map((c) => c.label), ['Folge 1', 'Folge 2', 'Folge 3 (neu)'])
    assert.strictEqual((await call(routes['get /pending'])).body.media.id, 'alb1', 'the first album plays at first')
  } finally {
    global.fetch = realFetch
  }
})
