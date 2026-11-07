// The checks of the extension installer (app-api/extensions.ts): what a package may hold and what it may ask to have set up as root.
// No box needed; the install itself (download, sudo) is tried on a box.
import assert from 'node:assert'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { readZip } from './app-api/winamp-skin'
import { verifyPackage, checkManifest, checkSettings, checkUdevRules, type Manifest } from './app-api/extensions'

const files = (...names: string[]) => new Set(['manifest.json', ...names])
const base = (extra: Record<string, unknown> = {}) => ({ id: 'cd', name: 'CD', version: '1.0.0', hostApi: 1, ...extra })

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
    assert.ok(checkManifest(base({ hostApi: 3 }), files()))
    assert.ok(checkManifest(base({ version: '1.0' }), files()))
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
  it('is packed as the catalog says', () => {
    const entry = JSON.parse(readFileSync(path.join(extDir, 'catalog.json'), 'utf8')).find((e: { id: string }) => e.id === 'weather')
    const bytes = readFileSync(path.join(extDir, 'dist', `weather-${entry.version}.mpx`))
    assert.strictEqual(createHash('sha256').update(bytes).digest('hex'), entry.sha256)
    assert.strictEqual(verifyPackage(bytes).ok, true)
  })
})

describe('an uploaded extension file', () => {
  it('is read and checked without installing anything', () => {
    const bytes = readFileSync(path.join(process.cwd(), '..', '..', 'extensions', 'dist', 'cd-1.0.0.mpx'))
    const checked = verifyPackage(bytes)
    assert.strictEqual(checked.ok, true)
    if (checked.ok) assert.strictEqual(checked.pkg.manifest.id, 'cd')
  })
  it('refuses a file that is no zip, and an empty one', () => {
    assert.strictEqual(verifyPackage(Buffer.from('hello')).ok, false)
    assert.strictEqual(verifyPackage(Buffer.alloc(0)).ok, false)
  })
})
