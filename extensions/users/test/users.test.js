// node --test extensions/users/test/users.test.js
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { _test } = require('../api.js')

/** A box in a temporary folder: a configuration, a library with a link, some data, logs and settings of extensions. */
function box() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpx-users-'))
  const dirs = { dataDir: path.join(root, 'ext-data'), libraryDir: path.join(root, 'library'), boxDataDir: path.join(root, 'data'), logsDir: path.join(root, 'data', 'logs'), settingsDir: path.join(root, 'settings') }
  for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(root, 'shared.json'), '{"shared":true}')
  // (a link in the library, such as config.json or active_data.json: it is no one's)
  let linked = true
  try {
    fs.symlinkSync(path.join(root, 'shared.json'), path.join(dirs.libraryDir, 'config.json'))
  } catch {
    linked = false // (no right to make links here)
  }
  const cfg = { mupibox: { theme: 'dark', startVolume: 30, boxName: 'Box', host: 'mupibox' }, spotify: { clientId: 'abc' }, playtimeLimit: { enabled: false } }
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), text)
  }
  const store = _test.createStore({
    ...dirs,
    config: () => cfg,
    updateConfig: async (mutate) => {
      mutate(cfg)
    },
  })
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
  const has = (rel) => fs.existsSync(path.join(root, rel))
  return { root, cfg, store, put, read, has, linked }
}

test('a name is one line of at most 24 characters', () => {
  assert.equal(_test.cleanName('  Mia  '), 'Mia')
  assert.equal(_test.cleanName('a\nb\tc'), 'a b c')
  assert.equal(_test.cleanName(''), null)
  assert.equal(_test.cleanName('   '), null)
  assert.equal(_test.cleanName('x'.repeat(25)), null)
  assert.equal(_test.cleanName(null), null)
})

test('the first start has one user, "Standard"', () => {
  const { store } = box()
  assert.deepEqual(store.state(), { current: 'main', users: [{ id: 'main', name: 'Standard', color: '#FFFFFF' }] })
})

test('a new user gets the settings of the one who creates it and an empty library', () => {
  const { store, put, read } = box()
  put('library/data.json', '[{"name":"Album"}]')
  const added = store.add('Mia')
  assert.match(added.id, /^u[0-9a-f]{6}$/)
  assert.equal(store.state().users.length, 2)
  assert.equal(read(`ext-data/profiles/${added.id}/library/data.json`), '[]\n')
  assert.equal(JSON.parse(read(`ext-data/profiles/${added.id}/config.json`)).mupibox.theme, 'dark')
  // (the live state did not change)
  assert.equal(read('library/data.json'), '[{"name":"Album"}]')
})

test('names are unique and there are as many users as colours (nine)', () => {
  const { store } = box()
  assert.equal(store.add('Mia').error, undefined)
  assert.equal(store.add('mia').error, 'exists')
  assert.equal(store.add('standard').error, 'exists')
  assert.equal(store.add('  ').error, 'name')
  for (let i = 0; i < 7; i++) assert.equal(store.add(`U${i}`).error, undefined)
  assert.equal(store.add('Zu viele').error, 'full')
})

test('a switch keeps the state of the one who goes and loads the one who comes', async () => {
  const { store, cfg, put, read, has } = box()
  put('library/data.json', '[{"name":"Papa"}]')
  put('library/resume.json', '[{"p":1}]')
  put('data/hidden-covers.json', '["x"]')
  put('data/logs/play_log.jsonl', 'papa\n')
  put('settings/weather.json', '{"tempUnit":"f"}')
  const mia = store.add('Mia').id
  assert.deepEqual(await store.select(mia), { ok: true })
  assert.equal(store.state().current, mia)
  // her library is empty, Papa's files are gone from the live state, what is hers is there
  assert.equal(read('library/data.json'), '[]\n')
  assert.equal(has('data/hidden-covers.json'), false)
  assert.equal(has('data/logs/play_log.jsonl'), false)
  assert.equal(read('settings/weather.json'), '{"tempUnit":"f"}')
  // she makes her own choices
  cfg.mupibox.theme = 'pink'
  cfg.mupibox.startVolume = 80
  put('library/data.json', '[{"name":"Mia-Album"}]')
  put('data/logs/play_log.jsonl', 'mia\n')
  put('settings/weather.json', '{"tempUnit":"c"}')
  // back to Papa: everything of his is back, hers is kept
  assert.deepEqual(await store.select('main'), { ok: true })
  assert.equal(read('library/data.json'), '[{"name":"Papa"}]')
  assert.equal(read('library/resume.json'), '[{"p":1}]')
  assert.equal(read('data/hidden-covers.json'), '["x"]')
  assert.equal(read('data/logs/play_log.jsonl'), 'papa\n')
  assert.equal(read('settings/weather.json'), '{"tempUnit":"f"}')
  assert.equal(cfg.mupibox.theme, 'dark')
  assert.equal(cfg.mupibox.startVolume, 30)
  assert.equal(read(`ext-data/profiles/${mia}/library/data.json`), '[{"name":"Mia-Album"}]')
  assert.equal(JSON.parse(read(`ext-data/profiles/${mia}/config.json`)).mupibox.theme, 'pink')
})

test('what is the same for everybody does not move', async () => {
  const { store, cfg, root, linked } = box()
  const mia = store.add('Mia').id
  cfg.spotify.clientId = 'changed-by-papa'
  cfg.mupibox.boxName = 'Kinderzimmer'
  await store.select(mia)
  assert.equal(cfg.spotify.clientId, 'changed-by-papa')
  assert.equal(cfg.mupibox.boxName, 'Kinderzimmer')
  assert.equal(cfg.mupibox.host, 'mupibox')
  // the link of the library is still a link to the same file
  if (linked) assert.ok(fs.lstatSync(path.join(root, 'library', 'config.json')).isSymbolicLink())
  // (and no profile has the shared things)
  const part = JSON.parse(fs.readFileSync(path.join(root, 'ext-data', 'profiles', 'main', 'config.json'), 'utf8'))
  assert.equal(part.spotify, undefined)
  assert.equal(part.mupibox.boxName, undefined)
  assert.equal(fs.existsSync(path.join(root, 'ext-data', 'profiles', 'main', 'library', 'config.json')), false)
})

test('a key the user does not have is removed, so the box falls back to its default', async () => {
  const { store, cfg } = box()
  const mia = store.add('Mia').id
  await store.select(mia)
  assert.equal('startVolume' in cfg.mupibox, true, 'Mia has the volume Papa had when she was created')
  await store.select('main')
  const file = path.join(store._profile(mia), 'config.json')
  const profile = JSON.parse(fs.readFileSync(file, 'utf8'))
  delete profile.mupibox.startVolume
  fs.writeFileSync(file, JSON.stringify(profile))
  await store.select(mia)
  assert.equal('startVolume' in cfg.mupibox, false)
})

test('the current user and the last user cannot be deleted; a deleted one is gone', () => {
  const { store, has } = box()
  assert.equal(store.remove('main').error, 'current')
  const mia = store.add('Mia').id
  assert.equal(store.remove('main').error, 'current')
  assert.equal(store.remove('nope').error, 'id')
  assert.equal(store.remove('../x').error, 'id')
  assert.deepEqual(store.remove(mia), { ok: true })
  assert.equal(store.state().users.length, 1)
  assert.equal(has(`ext-data/profiles/${mia}`), false)
  assert.equal(store.remove('main').error, 'current')
})

test('an unknown user cannot be chosen, and the current one is a no-op', async () => {
  const { store, read, put } = box()
  put('library/data.json', '[1]')
  assert.equal((await store.select('zzzz')).error, 'id')
  assert.equal((await store.select('../etc')).error, 'id')
  assert.equal((await store.select('main')).same, true)
  assert.equal(read('library/data.json'), '[1]')
})

test('every user has their own colour, the first one nobody has; a user from before gets one too', () => {
  const { store, root } = box()
  const a = store.add('A').id
  const b = store.add('B').id
  const colours = store.state().users.map((u) => u.color)
  assert.deepEqual(colours, _test.COLORS.slice(0, 3))
  // (a deleted user gives their colour back)
  store.remove(a)
  const c = store.add('C').id
  assert.equal(store.state().users.find((u) => u.id === c).color, '#FF0000')
  assert.notEqual(b, c)
  // (users.json of version 1.0.0 had no colours)
  fs.writeFileSync(path.join(root, 'ext-data', 'users.json'), JSON.stringify({ current: 'main', users: [{ id: 'main', name: 'Standard' }, { id: 'x1', name: 'X', color: 'red' }] }))
  assert.deepEqual(store.state().users.map((u) => u.color), ['#FFFFFF', '#FF0000'])
})
