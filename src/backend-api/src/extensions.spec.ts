// The checks of the extension installer (app-api/extensions.ts): what a package may hold and what it may ask to have set up as root.
// No box needed; the install itself (download, sudo) is tried on a box.
import assert from 'node:assert'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { deflateRawSync } from 'node:zlib'
import { readZip } from './app-api/winamp-skin'
import { HOST_API, verifyPackage, checkManifest, checkSettings, checkUdevRules, checkUnitFile, chosenGpio, gpioSettingError, type Manifest } from './app-api/extensions'

const files = (...names: string[]) => new Set(['manifest.json', ...names])
const base = (extra: Record<string, unknown> = {}) => ({ id: 'cd', name: 'CD', version: '1.0.0', hostApi: 1, resources: {}, ...extra })

describe('udev rules of an extension', () => {
  it('accepts the rule of the CD extension', () => {
    assert.strictEqual(checkUdevRules('# who may read the drive\nSUBSYSTEM=="block", KERNEL=="sr[0-9]*", MODE="0666"\n'), null)
  })
  it('accepts group and symlink assignments', () => {
    assert.strictEqual(checkUdevRules('SUBSYSTEM=="tty", ATTRS{idVendor}=="1234", GROUP="audio", SYMLINK+="mydev"'), null)
  })
  it('refuses anything that runs a program or sets the environment', () => {
    assert.ok(checkUdevRules('SUBSYSTEM=="block", RUN+="/tmp/x.sh"'))
    assert.ok(checkUdevRules('SUBSYSTEM=="block", PROGRAM="/bin/sh -c id"'))
    assert.ok(checkUdevRules('SUBSYSTEM=="block", IMPORT{program}="x"'))
    assert.ok(checkUdevRules('SUBSYSTEM=="block", ENV{X}="1"'))
  })
  it('refuses an empty file and text that is no rule', () => {
    assert.ok(checkUdevRules('# only a comment\n'))
    assert.ok(checkUdevRules('rm -rf /'))
  })
  it('does not split a rule at a comma inside quotes', () => {
    assert.strictEqual(checkUdevRules('KERNEL=="a,b", MODE="0660"'), null)
  })
})

describe('manifest of an extension', () => {
  it('accepts the manifest of the CD extension', () => {
    const m = base({
      player: 'player.js',
      icon: 'icon.svg',
      settings: { cdLookup: { type: 'boolean', default: true }, discogsToken: { type: 'secret', pattern: '^[A-Za-z0-9]*$' } },
      system: { udev: [{ name: '99-mpx-cd.rules', file: '99-mpx-cd.rules' }], groups: ['cdrom'] },
    })
    assert.strictEqual(checkManifest(m, files('player.js', 'icon.svg', '99-mpx-cd.rules')), null)
  })
  it('refuses a bad id, a missing part and a newer host', () => {
    assert.ok(checkManifest(base({ id: '../x' }), files()))
    assert.ok(checkManifest(base({ player: 'player.js' }), files()))
    assert.ok(checkManifest(base({ hostApi: HOST_API + 1 }), files()))
    assert.ok(checkManifest(base({ version: '1.0' }), files()))
  })
  it('counts what really unpacks, not the sizes the archive names', () => {
    // one file that says it has 100 bytes and unpacks to 1.5 MB - over a whole limit of 1 MB
    const raw = deflateRawSync(Buffer.alloc(1_500_000))
    const name = Buffer.from('a.txt')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(raw.length, 18)
    local.writeUInt32LE(100, 22)
    local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(raw.length, 20)
    central.writeUInt32LE(100, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(0, 42)
    const cdStart = local.length + name.length + raw.length
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(1, 8)
    end.writeUInt16LE(1, 10)
    end.writeUInt32LE(central.length + name.length, 12)
    end.writeUInt32LE(cdStart, 16)
    const zip = Buffer.concat([local, name, raw, central, name, end])
    assert.throws(() => readZip(zip, { maxFile: 2_000_000, maxTotal: 1_048_576, strict: true }))
  })
  it('refuses the names of the folders all extensions share (settings, data)', () => {
    assert.ok(checkManifest(base({ id: 'settings' }), files()))
    assert.ok(checkManifest(base({ id: 'data' }), files()))
  })
  it('refuses a package name apt-get would read as "remove"', () => {
    assert.ok(checkManifest(base({ system: { packages: ['lighttpd-'] } }), files()))
    assert.strictEqual(checkManifest(base({ system: { packages: ['libcdio-utils', 'g++'] } }), files()), null)
    assert.strictEqual(checkManifest(base({ system: { packages: ['libcdio-utils', 'cd-discid'] } }), files()), null)
  })
  it('refuses file names that leave the folder', () => {
    assert.ok(checkManifest(base({ player: '../player.js' }), files('../player.js')))
    assert.ok(checkManifest(base({ player: '/etc/passwd' }), files('/etc/passwd')))
  })
  it('refuses system steps it does not know: other groups, rule names of another extension', () => {
    assert.ok(checkManifest(base({ system: { groups: ['sudo'] } }), files()))
    assert.ok(checkManifest(base({ system: { udev: [{ name: '99-other.rules', file: 'r.rules' }] } }), files('r.rules')))
    assert.ok(checkManifest(base({ system: { packages: ['x; rm -rf /'] } }), files()))
    assert.strictEqual(checkManifest(base({ system: { packages: ['libcdio-utils'] } }), files()), null)
  })
})

describe('settings of an extension', () => {
  const manifest = base({
    settings: { cdLookup: { type: 'boolean' }, discogsToken: { type: 'secret', pattern: '^[A-Za-z0-9]{0,80}$' }, volume: { type: 'number' } },
  }) as unknown as Manifest
  it('takes values of the kind the manifest names', () => {
    assert.deepStrictEqual(checkSettings(manifest, { cdLookup: false, discogsToken: ' abc123 ', volume: 5 }), { ok: true, clean: { cdLookup: false, discogsToken: 'abc123', volume: 5 } })
  })
  it('refuses unknown keys, wrong kinds and values that do not fit', () => {
    assert.strictEqual(checkSettings(manifest, { nope: 1 }).ok, false)
    assert.strictEqual(checkSettings(manifest, { cdLookup: 'yes' }).ok, false)
    assert.strictEqual(checkSettings(manifest, { discogsToken: 'a b; c' }).ok, false)
    assert.strictEqual(checkSettings(manifest, { volume: Number.NaN }).ok, false)
  })
})

describe('the CD extension of this repository', () => {
  const dir = path.join(process.cwd(), '..', '..', 'extensions', 'cd')
  it('has a manifest and a rule file the installer accepts', () => {
    const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
    assert.strictEqual(checkManifest(manifest, new Set(readdirSync(dir))), null)
    assert.strictEqual(checkUdevRules(readFileSync(path.join(dir, manifest.system.udev[0].file), 'utf8')), null)
  })
  it('is packed as the catalog says (the file the box downloads)', () => {
    const catalog = JSON.parse(readFileSync(path.join(dir, '..', 'catalog.json'), 'utf8'))
    const entry = catalog.find((e: { id: string }) => e.id === 'cd')
    const bytes = readFileSync(path.join(dir, '..', 'dist', `cd-${entry.version}.mpx`))
    assert.strictEqual(createHash('sha256').update(bytes).digest('hex'), entry.sha256)
    const names = readZip(bytes).map((e) => e.name)
    assert.ok(names.includes('manifest.json') && names.includes('player.js'))
  })
})

describe('settings with a choice', () => {
  const clock = JSON.parse(readFileSync(path.join(process.cwd(), '..', '..', 'extensions', 'clock', 'manifest.json'), 'utf8')) as Manifest
  it('is packed as the catalog says', () => {
    const extDir = path.join(process.cwd(), '..', '..', 'extensions')
    const entry = JSON.parse(readFileSync(path.join(extDir, 'catalog.json'), 'utf8')).find((e: { id: string }) => e.id === 'clock')
    const bytes = readFileSync(path.join(extDir, 'dist', `clock-${entry.version}.mpx`))
    assert.strictEqual(createHash('sha256').update(bytes).digest('hex'), entry.sha256)
    const checked = verifyPackage(bytes)
    assert.strictEqual(checked.ok, true)
  })
  it('accepts the manifest of the clock extension', () => {
    assert.strictEqual(checkManifest(clock, files('display.js', 'icon.svg')), null)
  })
  it('takes only a value from the options', () => {
    assert.strictEqual(checkSettings(clock, { style: 'analog', hours: 12 }).ok, true)
    assert.strictEqual(checkSettings(clock, { style: 'roman' }).ok, false)
    assert.strictEqual(checkSettings(clock, { hours: 7 }).ok, false)
  })
  it('refuses options of the wrong kind and choices that do not name every option', () => {
    const bad = (settings: unknown, ui?: unknown) => checkManifest({ ...base({ settings, ui }) }, files())
    assert.ok(bad({ a: { type: 'boolean', options: [true, false] } }))
    assert.ok(bad({ a: { type: 'string', options: ['x'] } }))
    assert.ok(bad({ a: { type: 'number', options: ['x', 'y'] } }))
    assert.ok(bad({ a: { type: 'string', options: ['x', 'y'] } }, { title: 'T', items: [{ key: 'a', label: 'A', choices: [{ value: 'x', label: 'X' }] }] }))
    assert.ok(bad({ a: { type: 'string', options: ['x', 'y'] } }, { title: 'T', items: [{ key: 'a', label: 'A', choices: [{ value: 'x', label: 'X' }, { value: 'z', label: 'Z' }] }] }))
    assert.strictEqual(bad({ a: { type: 'string', options: ['x', 'y'] } }, { title: 'T', items: [{ key: 'a', label: 'A', choices: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] }] }), null)
  })
})

describe('the weather extension of this repository', () => {
  const extDir = path.join(process.cwd(), '..', '..', 'extensions')
  const weather = JSON.parse(readFileSync(path.join(extDir, 'weather', 'manifest.json'), 'utf8')) as Manifest
  it('has a manifest the installer accepts', () => {
    assert.strictEqual(checkManifest(weather, files('api.js', 'display.js', 'icon.svg')), null)
  })
  it('takes a place only inside the globe and a server from the list', () => {
    assert.strictEqual(checkSettings(weather, { provider: 'metno', placeName: 'Wien', lat: 48.2085, lon: 16.3721 }).ok, true)
    assert.strictEqual(checkSettings(weather, { lat: 91 }).ok, false)
    assert.strictEqual(checkSettings(weather, { lon: -181 }).ok, false)
    assert.strictEqual(checkSettings(weather, { provider: 'wetter.com' }).ok, false)
  })
  it('refuses a search address of another extension, and a lookup on a switch', () => {
    const lookup = (settings: unknown, item: unknown) => checkManifest(base({ id: 'xy', settings, ui: { title: 'T', items: [item] } }), files())
    const str = { a: { type: 'string' } }
    assert.strictEqual(lookup(str, { key: 'a', label: 'A', type: 'lookup', search: '/api/ext/cd/places' }) === null, false)
    assert.ok(lookup(str, { key: 'a', label: 'A', type: 'lookup', search: 'https://example.com/x' }))
    assert.ok(lookup({ a: { type: 'boolean' } }, { key: 'a', label: 'A', type: 'lookup', search: '/api/ext/xy/places' }))
    assert.strictEqual(lookup(str, { key: 'a', label: 'A', type: 'lookup', search: '/api/ext/xy/places' }), null)
  })
  it('a roster: four routes of the extension itself, no setting', () => {
    const roster = { type: 'roster', label: 'R', list: '/api/ext/xy/list', add: '/api/ext/xy/add', remove: '/api/ext/xy/remove', select: '/api/ext/xy/select' }
    const manifest = (item: unknown, hostApi = 4) => base({ id: 'xy', hostApi, ui: { title: 'T', items: [item] } })
    assert.strictEqual(checkManifest(manifest(roster), files()), null)
    assert.ok(checkManifest(manifest(roster, 3), files()), 'needs hostApi 4')
    assert.ok(checkManifest(manifest({ ...roster, add: 'https://example.com/x' }), files()), 'a route of another place')
    assert.ok(checkManifest(manifest({ ...roster, remove: '/api/ext/other/remove' }), files()), 'a route of another extension')
    assert.ok(checkManifest(manifest({ ...roster, select: undefined }), files()), 'a route missing')
    assert.strictEqual(checkManifest(manifest({ ...roster, color: '/api/ext/xy/color' }), files()), null, 'the colour route may be there')
    assert.ok(checkManifest(manifest({ ...roster, color: '/api/ext/other/color' }), files()), 'but only one of its own')
  })
  it('an order field: a text that names every choice once', () => {
    const choices = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]
    const manifest = (settings: unknown, item: unknown = { key: 'o', label: 'O', type: 'order', choices }) => base({ id: 'xy', hostApi: 3, settings, ui: { title: 'T', items: [item] } })
    const str = { o: { type: 'string', default: 'a,b,c' } }
    assert.strictEqual(checkManifest(manifest(str), files()), null)
    assert.ok(checkManifest(manifest({ o: { type: 'string', default: 'a,b' } }), files()), 'a default that misses a choice')
    assert.ok(checkManifest(manifest({ o: { type: 'boolean' } }), files()))
    assert.ok(checkManifest(manifest(str, { key: 'o', label: 'O', type: 'order', choices: [{ value: 'a', label: 'A' }] }), files()), 'one choice is no order')
    assert.ok(checkManifest(manifest(str, { key: 'o', label: 'O', type: 'order', choices: [{ value: 'a', label: 'A' }, { value: 'a', label: 'A2' }] }), files()), 'the same choice twice')
    const m = manifest(str) as unknown as Manifest
    assert.deepStrictEqual(checkSettings(m, { o: 'c,a,b' }), { ok: true, clean: { o: 'c,a,b' } })
    assert.strictEqual(checkSettings(m, { o: 'a,b' }).ok, false)
    assert.strictEqual(checkSettings(m, { o: 'a,a,b' }).ok, false)
    assert.strictEqual(checkSettings(m, { o: 'a,b,x' }).ok, false)
  })
  it('is packed as the catalog says', () => {
    const entry = JSON.parse(readFileSync(path.join(extDir, 'catalog.json'), 'utf8')).find((e: { id: string }) => e.id === 'weather')
    const bytes = readFileSync(path.join(extDir, 'dist', `weather-${entry.version}.mpx`))
    assert.strictEqual(createHash('sha256').update(bytes).digest('hex'), entry.sha256)
    assert.strictEqual(verifyPackage(bytes).ok, true)
  })
})

describe('the users extension of this repository', () => {
  const extDir = path.join(process.cwd(), '..', '..', 'extensions')
  const users = JSON.parse(readFileSync(path.join(extDir, 'users', 'manifest.json'), 'utf8')) as Manifest
  it('has a manifest the installer accepts, with a roster of four routes of its own', () => {
    assert.strictEqual(checkManifest(users, files('api.js', 'display.js', 'icon.svg')), null)
    assert.strictEqual(users.ui?.items[0].type, 'roster')
  })
})

describe('GPIO pins the user chooses, and a page of its own (hostApi 5)', () => {
  const manifest = (settings: unknown, ui: Record<string, unknown> = {}, hostApi = 5) => base({ id: 'xy', hostApi, settings, ui: { title: 'T', items: [], ...ui } })
  const pin = { type: 'gpio', default: 0 }

  it('a gpio setting starts without a pin and has nothing to choose from in the manifest', () => {
    assert.strictEqual(checkManifest(manifest({ p: pin }, { items: [{ key: 'p', label: 'Pin' }] }), files()), null)
    assert.strictEqual(checkManifest(manifest({ p: { type: 'gpio' } }), files()), null)
    assert.ok(checkManifest(manifest({ p: pin }, {}, 4), files()), 'needs hostApi 5')
    assert.ok(checkManifest(manifest({ p: { type: 'gpio', default: 17 } }), files()), 'a pin named in the manifest could be one that is taken')
    assert.ok(checkManifest(manifest({ p: { type: 'gpio', options: [17, 27] } }), files()))
    assert.ok(checkManifest(manifest({ p: { type: 'gpio', min: 2 } }), files()))
    assert.ok(checkManifest(manifest({ p: { type: 'gpio', legacy: 'fan.fan_gpio' } }), files()))
    assert.ok(checkManifest(manifest({ p: pin }, { items: [{ key: 'p', label: 'Pin', choices: [{ value: 17, label: 'x' }] }] }), files()), 'the app draws the choice')
    assert.ok(checkManifest(manifest({ p: pin }, { items: [{ key: 'p', label: 'Pin', type: 'lookup', search: '/api/ext/xy/pins' }] }), files()))
    const many = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`p${i}`, pin]))
    assert.match(String(checkManifest(manifest(many), files())), /too many gpio settings/)
  })

  it('a heading can be named by the user and be one that is added: a text setting and a switch', () => {
    const settings = { p: pin, name: { type: 'string', default: '' }, on: { type: 'boolean', default: false }, kind: { type: 'string', default: 'a', options: ['a', 'b'] } }
    const ui = (heading: Record<string, unknown>, field: Record<string, unknown> = {}) => manifest(settings, { items: [{ type: 'heading', label: 'Taster', ...heading }, { key: 'p', label: 'Pin', ...field }] })
    assert.strictEqual(checkManifest(ui({ rename: 'name', optional: 'on' }), files()), null)
    assert.strictEqual(checkManifest(ui({ rename: 'name' }), files()), null)
    assert.match(String(checkManifest(ui({ rename: 'on' }), files())), /rename must be a text setting/)
    assert.match(String(checkManifest(ui({ rename: 'kind' }), files())), /rename must be a text setting/, 'a text with options is a choice, not a name')
    assert.match(String(checkManifest(ui({ rename: 'nothing' }), files())), /rename must be a text setting/)
    assert.match(String(checkManifest(ui({ rename: '__proto__' }), files())), /rename must be a text setting/)
    assert.match(String(checkManifest(ui({ optional: 'name' }), files())), /optional must be a switch/)
    assert.match(String(checkManifest(ui({ optional: 'p' }), files())), /optional must be a switch/)
    assert.match(String(checkManifest(ui({}, { rename: 'name' }), files())), /only a heading/)
    assert.match(String(checkManifest(ui({}, { optional: 'on' }), files())), /only a heading/)
  })

  it('a pin is a header pin or 0 for none', () => {
    const m = manifest({ p: pin, on: { type: 'boolean' } }) as unknown as Manifest
    for (const ok of [0, 2, 17, 27]) assert.deepStrictEqual(checkSettings(m, { p: ok }), { ok: true, clean: { p: ok } })
    for (const bad of [1, 28, -17, 17.5, '17', null, true, Number.NaN, [17]]) assert.strictEqual(checkSettings(m, { p: bad }).ok, false, String(bad))
    // (names every object has are no settings)
    for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) assert.strictEqual(checkSettings(m, { [key]: 17 }).ok, false, key)
  })

  it('the chosen pins are what the extension holds: each once, in range, none for 0', () => {
    const m = manifest({ a: pin, b: pin, c: pin, d: pin, n: { type: 'number' } }, { items: [{ key: 'a', label: 'Taster 1' }] }) as unknown as Manifest
    assert.deepStrictEqual(chosenGpio(m, { a: 17, b: 0, c: 17, d: 27, n: 22 }), [
      { pin: 17, purpose: 'Taster 1' },
      { pin: 27, purpose: 'd' },
    ])
    assert.deepStrictEqual(chosenGpio(m, { a: '17', b: 99, c: 1, d: 2.5 }), [])
    assert.deepStrictEqual(chosenGpio(base() as unknown as Manifest, { a: 17 }), [])
  })

  it('a pin is refused when another field of the extension has it or something else holds it', () => {
    const m = manifest({ a: pin, b: pin, n: { type: 'number' } }) as unknown as Manifest
    const taken = new Map([[13, ['MuPiBox (power LED)']], [26, ['MuPiBox (rotary encoder)']]])
    assert.strictEqual(gpioSettingError(m, { a: 17, b: 27 }, ['a', 'b'], taken), null)
    assert.deepStrictEqual(gpioSettingError(m, { a: 17, b: 17 }, ['b'], taken), { error: 'gpio_twice', key: 'b', pin: 17 })
    assert.deepStrictEqual(gpioSettingError(m, { a: 13, b: 0 }, ['a'], taken), { error: 'gpio_taken', key: 'a', pin: 13, holders: ['MuPiBox (power LED)'] })
    // (two fields without a pin are not "the same pin"; a number that is no pin setting is not looked at)
    assert.strictEqual(gpioSettingError(m, { a: 0, b: 0, n: 13 }, ['a', 'b', 'n'], taken), null)
    // (only what changes is tested: a pin saved before that something took since does not block the other fields)
    assert.strictEqual(gpioSettingError(m, { a: 26, b: 5 }, ['b'], taken), null)
  })

  it('headings, many fields and a field that depends on a pin', () => {
    const settings = { p: pin, on: { type: 'boolean' }, t: { type: 'string' } }
    const items = [{ type: 'heading', label: 'Taster 1', help: 'x' }, { key: 'p', label: 'Pin' }, { key: 't', label: 'Text', dep: 'p' }, { type: 'heading', label: 'Mehr', dep: 'on' }]
    assert.strictEqual(checkManifest(manifest(settings, { items }), files()), null)
    assert.ok(checkManifest(manifest(settings, { items }, 4), files()))
    assert.ok(checkManifest(manifest(settings, { items: [{ type: 'heading', label: 'H', key: 't' }] }), files()), 'a heading has no setting')
    assert.ok(checkManifest(manifest(settings, { items: [{ key: 't', label: 'T', dep: 't' }] }), files()), 'a text is nothing to depend on')
    assert.ok(checkManifest(manifest(settings, { items: [{ key: 'toString', label: 'T' }] }), files()), 'a name every object has is no setting')
    assert.ok(checkManifest(manifest(settings, { items: [{ key: 't', label: 'T', dep: 'constructor' }] }), files()))
    const field = { key: 't', label: 'T' }
    assert.strictEqual(checkManifest(manifest(settings, { items: Array.from({ length: 80 }, () => field) }), files()), null)
    assert.ok(checkManifest(manifest(settings, { items: Array.from({ length: 81 }, () => field) }), files()))
    assert.ok(checkManifest(base({ id: 'xy', hostApi: 4, settings, ui: { title: 'T', items: Array.from({ length: 21 }, () => field) } }), files()), 'twenty before hostApi 5')
  })

  it('a page of its own under System, and the pages of the core it may take over', () => {
    assert.strictEqual(checkManifest(manifest({}, { place: 'system' }), files()), null)
    assert.strictEqual(checkManifest(manifest({}, { place: 'system', adopt: ['rotary'] }), files()), null)
    assert.ok(checkManifest(manifest({}, { place: 'system' }, 4), files()), 'needs hostApi 5')
    assert.ok(checkManifest(manifest({}, { place: 'audio' }), files()))
    assert.ok(checkManifest(manifest({}, { adopt: ['rotary'] }), files()), 'only on a page of its own')
    assert.ok(checkManifest(manifest({}, { place: 'system', adopt: ['passwort'] }), files()), 'only what the core lets go')
    assert.ok(checkManifest(manifest({}, { place: 'system', adopt: ['rotary', 'rotary'] }), files()))
    assert.ok(checkManifest(manifest({}, { place: 'system', adopt: 'rotary' }), files()))
  })
})

describe('the buttons extension of this repository', () => {
  const extDir = path.join(process.cwd(), '..', '..', 'extensions')
  const buttons = JSON.parse(readFileSync(path.join(extDir, 'buttons', 'manifest.json'), 'utf8')) as Manifest
  it('has a manifest the installer accepts: pins to choose, a page under System, the rotary encoder on it', () => {
    assert.strictEqual(checkManifest(buttons, files('api.js', 'icon.svg')), null)
    assert.strictEqual(buttons.ui?.place, 'system')
    assert.deepStrictEqual(buttons.ui?.adopt, ['rotary'])
    assert.deepStrictEqual(buttons.resources, {}, 'no pin of its own: the user chooses them')
  })
  it('takes the settings the app sends: a pin, an action, a hold time', () => {
    assert.strictEqual(checkSettings(buttons, { b1Pin: 17, b1Short: 'toggle', b1Long: 'replay', b1Hold: 1.5, b1Repeat: true, volumeStep: 3 }).ok, true)
    assert.strictEqual(checkSettings(buttons, { b1Short: 'reboot' }).ok, false)
    assert.strictEqual(checkSettings(buttons, { b1Hold: 0.1 }).ok, false)
    assert.strictEqual(checkSettings(buttons, { b1Pin: 40 }).ok, false)
  })
  it('is packed as the catalog says', () => {
    const entry = JSON.parse(readFileSync(path.join(extDir, 'catalog.json'), 'utf8')).find((e: { id: string }) => e.id === 'buttons')
    const bytes = readFileSync(path.join(extDir, 'dist', `buttons-${entry.version}.mpx`))
    assert.strictEqual(createHash('sha256').update(bytes).digest('hex'), entry.sha256)
    const checked = verifyPackage(bytes)
    assert.strictEqual(checked.ok, true)
    if (checked.ok) assert.deepStrictEqual(checked.pkg.manifest, buttons, 'the package holds the manifest of the repository')
  })
})

describe('an uploaded extension file', () => {
  it('is read and checked without installing anything', () => {
    const extDir = path.join(process.cwd(), '..', '..', 'extensions')
    const entry = JSON.parse(readFileSync(path.join(extDir, 'catalog.json'), 'utf8')).find((e: { id: string }) => e.id === 'cd')
    const bytes = readFileSync(path.join(extDir, 'dist', `cd-${entry.version}.mpx`))
    const checked = verifyPackage(bytes)
    assert.strictEqual(checked.ok, true)
    if (checked.ok) assert.strictEqual(checked.pkg.manifest.id, 'cd')
  })
  it('refuses a file that is no zip, and an empty one', () => {
    assert.strictEqual(verifyPackage(Buffer.from('hello')).ok, false)
    assert.strictEqual(verifyPackage(Buffer.alloc(0)).ok, false)
  })
})

describe('systemd units of an extension', () => {
  const service = '[Unit]\nDescription=Test\nAfter=network.target\n\n[Service]\nType=simple\nExecStart=/usr/bin/node @EXT_DIR@/daemon.js\nRestart=on-failure\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target\n'
  it('accepts a plain service and a plain timer', () => {
    assert.strictEqual(checkUnitFile(service, 'service'), null)
    assert.strictEqual(checkUnitFile('[Timer]\nOnCalendar=*-*-* 03:00:00\nPersistent=yes\n\n[Install]\nWantedBy=timers.target\n', 'timer'), null)
  })
  it('refuses what changes who runs it or lifts a restriction', () => {
    for (const extra of ['User=root', 'Group=root', 'AmbientCapabilities=CAP_NET_ADMIN', 'PermissionsStartOnly=yes', 'ExecStartPre=+/bin/sh /tmp/x', 'ExecStartPost=!/bin/true', 'Environment=A=b\nPrivateDevices=no']) {
      assert.ok(checkUnitFile(service.replace('Restart=on-failure', extra), 'service'), extra)
    }
  })
  it('refuses a program without an absolute path, a continued line, other sections and a service without ExecStart', () => {
    assert.ok(checkUnitFile(service.replace('/usr/bin/node', 'node'), 'service'))
    assert.ok(checkUnitFile(service.replace('Restart=on-failure', 'Restart=on-failure \\nalways'), 'service'))
    assert.ok(checkUnitFile(`${service}[Socket]\nListenStream=1234\n`, 'service'))
    assert.ok(checkUnitFile('[Unit]\nDescription=x\n[Service]\nType=simple\n', 'service'))
    assert.ok(checkUnitFile('[Install]\nWantedBy=graphical.target\n[Service]\nExecStart=/bin/true\n', 'service'))
    assert.ok(checkUnitFile('[Timer]\nPersistent=yes\n', 'timer'))
    assert.ok(checkUnitFile(service, 'timer'))
  })
  it('the manifest names the unit by its extension, has its file, and says it in the resources', () => {
    const base = { id: 'xy', name: 'X', version: '1.0.0', hostApi: 2 }
    const ok = { ...base, system: { units: [{ name: 'mpx-xy.service', file: 'units/mpx-xy.service' }] }, resources: { services: [{ name: 'mpx-xy.service', provides: true }] } }
    const files = new Set(['manifest.json', 'units/mpx-xy.service'])
    assert.strictEqual(checkManifest(ok, files), null)
    assert.match(String(checkManifest({ ...ok, system: { units: [{ name: 'other.service', file: 'units/mpx-xy.service' }] } }, files)), /bad unit name/)
    assert.match(String(checkManifest({ ...ok, system: { units: [{ name: 'mpx-xy.timer', file: 'units/mpx-xy.service' }] } }, files)), /unit file missing/)
    assert.match(String(checkManifest(ok, new Set(['manifest.json']))), /unit file missing/)
    assert.match(String(checkManifest({ ...ok, resources: {} }, files)), /not in resources.services/)
    assert.match(String(checkManifest({ ...ok, resources: { services: [{ name: 'mpx-xy.service' }] } }, files)), /not in resources.services/)
  })
})
