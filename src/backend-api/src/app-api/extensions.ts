// Extensions of the box (docs/extensions.md): one file (.mpx, a zip) per extension, installed from a catalog on GitHub, kept in
// ~/.mupibox/data/extensions/<id>/. This file is the API's part of it:
//  - the app's routes (/api/app/extensions...: the catalog, install, switch on and off, remove; /api/app/ext/<id>/settings)
//  - what the display and the app read (/api/ext/active, the files of an extension under /ext/<id>/...)
//  - the extensions' own API parts (api.js, loaded at the start, routes under /api/ext/<id>/...)
// An extension is a program of the user dietpi without any protection: it comes from the catalog only, its file is checked
// against the catalog's checksum, and what it asks to have set up as root is limited to a few checked kinds (udev rules, systemd units,
// groups, packages).

import { execFile, spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, promises as fsp, readFileSync, renameSync } from 'node:fs'
import path from 'node:path'
import express, { type NextFunction, type Request, type RequestHandler, type Response, type Router } from 'express'
import type { MupiboxConfig } from '../models/mupibox-config.model'
import { DATA_DIR, EXTENSIONS_DIR, EXTENSIONS_DIR_BEFORE, LIBRARY_DIR } from '../paths'
import { checkResources, type Conflict, describeResources, findConflicts, gatherTaken, realProbe, type Resources, sameResources } from './extension-resources'
import { localNetworkOnly, requireCsrf, requireSession } from './middleware'
import { readZip } from './winamp-skin'

export const EXT_DIR = process.env.MUPIBOX_EXT_DIR ?? EXTENSIONS_DIR

// A box that came over from before 5.1 has them in ~/.mupibox/extensions: moved to data/extensions once (a rename: one
// filesystem; the player does the same at its start, whoever is first wins and the other finds it done).
if (!process.env.MUPIBOX_EXT_DIR && process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
  try {
    if (existsSync(EXTENSIONS_DIR_BEFORE) && !existsSync(EXTENSIONS_DIR)) {
      mkdirSync(path.dirname(EXTENSIONS_DIR), { recursive: true })
      renameSync(EXTENSIONS_DIR_BEFORE, EXTENSIONS_DIR)
    }
  } catch {
    // (the other process was faster, or it is not possible: then they stay where they are and are not found - logged by the load)
  }
}
export const HOST_API = 4
// (the catalog of the MuPiBox, in its repository: what is in it is trusted - an extension can do everything on the box; while 5.1
// is not with splitti yet, the 5.1 branch of the fork that builds it)
const DEFAULT_CATALOG = 'https://raw.githubusercontent.com/wowa1990/MuPiBox/upstream-v5.1-pr/extensions/catalog.json'
// the largest package (the file as it is sent and downloaded; what is in it may be three times that, unpacked)
const MAX_MPX = 16 * 1024 * 1024
const ID = /^[a-z][a-z0-9-]{1,30}$/
// (folders of EXT_DIR that are not an extension: an extension of that name replaced the settings or the data of all of them)
const RESERVED_IDS = new Set(['settings', 'data', 'state', 'backup', 'cache', 'tmp'])
const validId = (id: string) => ID.test(id) && !RESERVED_IDS.has(id)
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/
const FILE = /^[A-Za-z0-9_][A-Za-z0-9_./-]{0,100}$/
// what a package may hold (a file of another kind is a reason to refuse it)
const ALLOWED_FILES = /\.(js|mjs|json|svg|png|jpg|css|txt|md|rules|html)$/i
// ... and what a package may hold beyond that: the unit files of its systemd services (never served to a browser)
const PACKAGE_FILES = /\.(js|mjs|json|svg|png|jpg|css|txt|md|rules|html|service|timer)$/i
const GROUPS = new Set(['cdrom', 'audio', 'video', 'plugdev'])
// (a Debian package name; never one that ends in - : apt-get reads "name-" as "remove name" - "g++" is a real one)
const PACKAGE = /^[a-z0-9][a-z0-9+.-]{0,59}[a-z0-9+]$/
const SECRET_SETTING = 'secret'

export interface Manifest {
  id: string
  name: string
  version: string
  description?: string
  hostApi: number
  player?: string
  api?: string
  display?: string
  icon?: string
  // the settings page of the extension in the app, declared (no code of the extension runs in the app): a card with these fields
  ui?: { title: string; help?: string; items: { key: string; label: string; help?: string; dep?: string; choices?: { value: string | number; label: string }[]; type?: 'lookup' | 'order' | 'roster'; search?: string; list?: string; add?: string; remove?: string; select?: string; color?: string }[] }
  settings?: Record<string, { type: 'boolean' | 'string' | 'number' | 'secret'; default?: unknown; pattern?: string; options?: (string | number)[]; min?: number; max?: number; legacy?: string }>
  system?: { udev?: { name: string; file: string }[]; units?: { name: string; file: string }[]; groups?: string[]; packages?: string[] }
  /** what it needs from the box: ports, GPIO pins, services (required; {} for nothing) - tested against the box before it is installed */
  resources?: Resources
}

export interface CatalogEntry {
  id: string
  name: string
  version: string
  description: string
  /** A small SVG as a data address: the page shows it before the extension is installed. */
  icon?: string
  hostApi: number
  url: string
  sha256: string
  size: number
  system?: { udev?: number; units?: string[]; groups?: string[]; packages?: string[] }
  resources?: Resources
}

export interface ExtensionDeps {
  getMupiboxConfig: () => MupiboxConfig | undefined
  updateMupiboxConfig?: (mutate: (cfg: Record<string, unknown>) => void) => Promise<void>
}

// ---------- reading what is installed ----------

type State = Record<string, { version: string; enabled: boolean }>

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

const readState = () => readJson<State>(path.join(EXT_DIR, 'state.json'), {})

async function writeState(state: State): Promise<void> {
  await fsp.mkdir(EXT_DIR, { recursive: true })
  const tmp = path.join(EXT_DIR, 'state.json.new')
  await fsp.writeFile(tmp, JSON.stringify(state, null, 1))
  await fsp.rename(tmp, path.join(EXT_DIR, 'state.json'))
}

/** The manifest of an installed extension, or null when it is missing or not for this host. */
export async function readManifest(id: string): Promise<Manifest | null> {
  if (!validId(id)) return null
  const manifest = await readJson<Manifest | null>(path.join(EXT_DIR, id, 'manifest.json'), null)
  return manifest && manifest.id === id && Number.isInteger(manifest.hostApi) && manifest.hostApi >= 1 && manifest.hostApi <= HOST_API ? manifest : null
}

async function enabledManifests(): Promise<Manifest[]> {
  const state = await readState()
  const out: Manifest[] = []
  for (const [id, s] of Object.entries(state)) {
    if (s.enabled === false) continue
    const manifest = await readManifest(id)
    if (manifest) out.push(manifest)
  }
  return out
}

async function installedManifests(): Promise<Manifest[]> {
  const out: Manifest[] = []
  for (const id of Object.keys(await readState())) {
    const manifest = await readManifest(id)
    if (manifest) out.push(manifest)
  }
  return out
}

/**
 * The test before an install (or before an extension is switched on): what the extension declares it needs, compared with what is
 * taken on the box - the core, the boot configuration, the other extensions, what runs now. Nothing is changed.
 */
async function testResources(manifest: Manifest, deps: ExtensionDeps): Promise<Conflict[]> {
  const installed = await installedManifests()
  const self = installed.find((m) => m.id === manifest.id)
  const taken = await gatherTaken({
    self: manifest.id,
    selfDeclared: self?.resources,
    config: deps.getMupiboxConfig() as unknown as Record<string, unknown> | undefined,
    others: installed.map((m) => ({ id: m.id, resources: m.resources })),
    probe: realProbe((cmd, args) => run(cmd, args, 15000)),
  })
  return findConflicts(manifest.resources, taken)
}

const settingsFile = (id: string) => path.join(EXT_DIR, 'settings', `${id}.json`)

/** An extension's settings with the defaults of its manifest behind them. */
export async function readSettings(manifest: Manifest): Promise<Record<string, unknown>> {
  const defaults = Object.fromEntries(Object.entries(manifest.settings ?? {}).filter(([, d]) => d.default !== undefined).map(([k, d]) => [k, d.default]))
  return { ...defaults, ...(await readJson<Record<string, unknown>>(settingsFile(manifest.id), {})) }
}

/** The settings as the display and the app may see them: a secret only as "<key>Set". */
export async function publicSettings(manifest: Manifest): Promise<Record<string, unknown>> {
  const all = await readSettings(manifest)
  const out: Record<string, unknown> = {}
  for (const [key, spec] of Object.entries(manifest.settings ?? {})) {
    if (spec.type === SECRET_SETTING) out[`${key}Set`] = typeof all[key] === 'string' && all[key] !== ''
    else if (key in all) out[key] = all[key]
  }
  return out
}

// ---------- checking a manifest and what it asks for ----------

const SAFE_RULE_KEY = /^(KERNEL|SUBSYSTEM|SUBSYSTEMS|DRIVER|ACTION|ATTR\{[A-Za-z0-9_]+\}|ATTRS\{[A-Za-z0-9_]+\}|TAG|SYMLINK|MODE|GROUP|OWNER)$/
const RULE_TOKEN = /^\s*([A-Za-z]+(?:\{[A-Za-z0-9_]+\})?)\s*(==|!=|=|\+=)\s*"([^"\n]*)"\s*$/

/** A udev rule file that holds only matches and the assignments of mode, group, owner, tag and symlink - nothing that runs a program. */
export function checkUdevRules(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  if (lines.length === 0) return 'the rule file is empty'
  for (const line of lines) {
    // (the tokens are separated by commas outside the quotes)
    const tokens = line.match(/(?:[^,"]|"[^"]*")+/g) ?? []
    for (const token of tokens) {
      const m = RULE_TOKEN.exec(token)
      if (!m) return `not a plain rule: ${token.trim().slice(0, 40)}`
      if (!SAFE_RULE_KEY.test(m[1])) return `not allowed in a rule: ${m[1]}`
    }
  }
  return null
}

// What a unit file of an extension may say: a few plain keys of the sections of a service or a timer. Nothing that changes who runs it
// (the box adds User=dietpi itself), what it may do as root, or what else it pulls in. The file is checked line by line.
const UNIT_KEYS: Record<string, Set<string>> = {
  Unit: new Set(['Description', 'After', 'Before', 'Wants', 'Requires']),
  Service: new Set(['Type', 'ExecStart', 'ExecStartPre', 'ExecStartPost', 'ExecStop', 'ExecReload', 'Restart', 'RestartSec', 'WorkingDirectory', 'Environment', 'TimeoutStartSec', 'TimeoutStopSec', 'RemainAfterExit', 'StandardOutput', 'StandardError', 'SyslogIdentifier', 'Nice', 'KillMode']),
  Timer: new Set(['OnCalendar', 'OnBootSec', 'OnStartupSec', 'OnActiveSec', 'OnUnitActiveSec', 'OnUnitInactiveSec', 'Persistent', 'AccuracySec', 'RandomizedDelaySec']),
  Install: new Set(['WantedBy']),
}
const UNIT_ENUMS: Record<string, string[]> = {
  Type: ['simple', 'exec', 'oneshot', 'notify', 'forking'],
  Restart: ['no', 'on-failure', 'on-abnormal', 'on-success', 'always'],
  RemainAfterExit: ['yes', 'no'],
  StandardOutput: ['journal', 'null', 'inherit'],
  StandardError: ['journal', 'null', 'inherit'],
  KillMode: ['control-group', 'mixed', 'process'],
  Persistent: ['yes', 'no'],
  WantedBy: ['multi-user.target', 'timers.target'],
}
const UNIT_REF = /^[A-Za-z0-9@:._-]{1,80}\.(target|service|socket|timer|mount)$/
const UNIT_TIME = /^[0-9A-Za-z:*,./ _-]{1,80}$/
// where a program of the unit may be: an absolute path, or in the folder of the extension (the box puts the folder in for @EXT_DIR@)
const UNIT_PATH = /^(@EXT_DIR@|\/)[A-Za-z0-9@_./:+=-]*$/

/**
 * A unit file (a systemd service or timer) of an extension: only the keys above, no line continuation, programs by absolute path and
 * without the prefixes that lift the restrictions ("+" and "!"), a service has an ExecStart, a timer a time.
 */
export function checkUnitFile(text: string, kind: 'service' | 'timer'): string | null {
  if (text.length > 4000 || text.includes('\0')) return 'the unit file is too large'
  let section = ''
  let hasExec = false
  let hasTime = false
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    if (line.endsWith('\\')) return 'a line may not continue on the next one'
    const head = /^\[([A-Za-z]+)\]$/.exec(line)
    if (head) {
      if (!UNIT_KEYS[head[1]] || (kind === 'service' && head[1] === 'Timer') || (kind === 'timer' && head[1] === 'Service')) return `section not allowed: [${head[1]}]`
      section = head[1]
      continue
    }
    const kv = /^([A-Za-z]+)=(.*)$/.exec(line)
    if (!kv || !section) return `not a plain setting: ${line.slice(0, 40)}`
    const [, key, value] = kv
    if (!UNIT_KEYS[section].has(key)) return `not allowed in a unit: ${section}/${key}`
    if (value.length > 500) return `too long: ${key}`
    if (UNIT_ENUMS[key] && !UNIT_ENUMS[key].includes(value.trim())) return `${key}: not one of ${UNIT_ENUMS[key].join(', ')}`
    if (key.startsWith('Exec')) {
      if (/^[-@:]*[+!]/.test(value)) return `${key}: the prefixes + and ! are not allowed`
      const program = value.replace(/^[-@:]+/, '').split(/\s/)[0]
      if (!UNIT_PATH.test(program)) return `${key}: the program needs an absolute path`
      if (key === 'ExecStart') hasExec = true
    } else if (key === 'WorkingDirectory') {
      if (!UNIT_PATH.test(value.trim())) return 'WorkingDirectory: an absolute path'
    } else if (['After', 'Before', 'Wants', 'Requires'].includes(key)) {
      if (!value.trim().split(/\s+/).every((u) => UNIT_REF.test(u))) return `${key}: unit names only`
    } else if (['OnCalendar', 'OnBootSec', 'OnStartupSec', 'OnActiveSec', 'OnUnitActiveSec', 'OnUnitInactiveSec'].includes(key)) {
      if (!UNIT_TIME.test(value.trim())) return `${key}: not a time`
      hasTime = true
    } else if (['RestartSec', 'TimeoutStartSec', 'TimeoutStopSec', 'AccuracySec', 'RandomizedDelaySec'].includes(key)) {
      if (!/^[0-9a-z]{1,20}$/.test(value.trim())) return `${key}: not a time`
    } else if (key === 'Nice') {
      if (!/^\d{1,2}$/.test(value.trim()) || Number(value) > 19) return 'Nice: 0 to 19'
    } else if (key === 'SyslogIdentifier') {
      if (!/^[A-Za-z0-9._-]{1,40}$/.test(value.trim())) return 'SyslogIdentifier: a plain name'
    }
  }
  if (kind === 'service' && !hasExec) return 'a service needs an ExecStart'
  if (kind === 'timer' && !hasTime) return 'a timer needs a time (OnCalendar, OnBootSec ...)'
  return null
}

/** What is wrong with a manifest (null: nothing). `files`: the names in the package. */
export function checkManifest(m: unknown, files: Set<string>): string | null {
  const x = m as Manifest
  if (!x || typeof x !== 'object') return 'no manifest'
  if (!validId(String(x.id))) return 'bad id'
  if (typeof x.name !== 'string' || x.name.length < 1 || x.name.length > 80) return 'bad name'
  if (!VERSION.test(String(x.version))) return 'bad version'
  if (!Number.isInteger(x.hostApi) || x.hostApi < 1) return 'bad hostApi'
  if (x.hostApi > HOST_API) return `made for a newer box (hostApi ${x.hostApi})`
  for (const part of ['player', 'api', 'display', 'icon'] as const) {
    const file = x[part]
    if (file === undefined) continue
    if (typeof file !== 'string' || !FILE.test(file) || file.includes('..')) return `bad file name: ${part}`
    if (!files.has(file)) return `${part} is named but not in the package`
  }
  for (const [key, spec] of Object.entries(x.settings ?? {})) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(key) || !['boolean', 'string', 'number', 'secret'].includes(spec?.type)) return `bad setting: ${key}`
    if (spec.options !== undefined && (!Array.isArray(spec.options) || spec.options.length < 2 || spec.options.length > 20 || spec.type === 'boolean' || spec.options.some((o) => (spec.type === 'number' ? typeof o !== 'number' : typeof o !== 'string')))) return `bad options: ${key}`
    if ((spec.min !== undefined || spec.max !== undefined) && (spec.type !== 'number' || (spec.min !== undefined && !Number.isFinite(spec.min)) || (spec.max !== undefined && !Number.isFinite(spec.max)))) return `bad range: ${key}`
    if (spec.pattern !== undefined) {
      try {
        new RegExp(spec.pattern)
      } catch {
        return `bad pattern: ${key}`
      }
    }
  }
  if (x.ui !== undefined) {
    const ui = x.ui
    if (typeof ui?.title !== 'string' || ui.title.length > 60 || (ui.help !== undefined && (typeof ui.help !== 'string' || ui.help.length > 800)) || !Array.isArray(ui.items) || ui.items.length > 20) return 'bad ui'
    const settings = x.settings ?? {}
    for (const item of ui.items) {
      // (a roster is a list of things the extension keeps itself - users, say - and needs no setting)
      if (item?.type !== 'roster' && !settings[item?.key]) return `ui: no such setting: ${item?.key}`
      if (typeof item.label !== 'string' || item.label.length > 100 || (item.help !== undefined && (typeof item.help !== 'string' || item.help.length > 800))) return `ui: bad text: ${item.key}`
      if (item.dep !== undefined && settings[item.dep]?.type !== 'boolean') return `ui: dep must be a switch: ${item.key}`
      if (item.type === 'roster') {
        // a list to look at, to add to, to take from and to choose from (hostApi 4): four routes of the extension's own API part
        if (x.hostApi < 4 || item.choices !== undefined) return `ui: a roster needs hostApi 4: ${item.label}`
        for (const part of ['list', 'add', 'remove', 'select', 'color'] as const) {
          // (`color` is the one that may be left out: the entries have a colour the user can change)
          if (part === 'color' && item.color === undefined) continue
          if (typeof item[part] !== 'string' || !new RegExp(`^/api/ext/${x.id}/[a-z]{1,30}$`).test(item[part] as string)) return `ui: bad roster address (${part}): ${item.label}`
        }
      } else if (item.type === 'order') {
        if (x.hostApi < 3) return `ui: an order needs hostApi 3: ${item.key}`
        // a list to put in order by dragging (hostApi 3): the setting is a text with the names of the choices, comma separated
        const names = (item.choices ?? []).map((c) => c?.value)
        if (settings[item.key].type !== 'string' || !Array.isArray(item.choices) || item.choices.length < 2 || item.choices.length > 12) return `ui: bad order: ${item.key}`
        if (item.choices.some((c) => typeof c?.value !== 'string' || !/^[a-z][a-z0-9]{0,11}$/.test(c.value) || typeof c.label !== 'string' || c.label.length > 60) || new Set(names).size !== names.length) return `ui: bad order choices: ${item.key}`
        const def = settings[item.key].default
        if (def !== undefined && !isOrderOf(def, names as string[])) return `ui: the default of an order must name every choice once: ${item.key}`
      } else if (item.type !== undefined) {
        // a search: a text field with a button; the extension's own API part answers with the places to choose from (see the app)
        if (item.type !== 'lookup' || settings[item.key].type !== 'string' || item.choices !== undefined) return `ui: bad type: ${item.key}`
        if (typeof item.search !== 'string' || !new RegExp(`^/api/ext/${x.id}/[a-z]{1,30}$`).test(item.search)) return `ui: bad search address: ${item.key}`
      }
      if (item.choices !== undefined && item.type !== 'order') {
        const options = settings[item.key].options
        if (!options || !Array.isArray(item.choices) || item.choices.length !== options.length) return `ui: choices must name every option: ${item.key}`
        if (item.choices.some((c) => !options.includes(c?.value as never) || typeof c.label !== 'string' || c.label.length > 60)) return `ui: bad choices: ${item.key}`
      }
    }
  }
  const system = x.system ?? {}
  for (const rule of system.udev ?? []) {
    if (!new RegExp(`^99-mpx-${x.id}[a-z0-9-]*\\.rules$`).test(String(rule?.name))) return `bad rule name: ${rule?.name}`
    if (!FILE.test(String(rule.file)) || !files.has(rule.file)) return `rule file missing: ${rule?.file}`
  }
  const badResources = checkResources(x.resources)
  if (badResources) return badResources
  if ((system.units ?? []).length > 4) return 'too many units'
  for (const unit of system.units ?? []) {
    if (!new RegExp(`^mpx-${x.id}[a-z0-9-]*\\.(service|timer)$`).test(String(unit?.name))) return `bad unit name: ${unit?.name}`
    if (!FILE.test(String(unit.file)) || unit.file.includes('..') || !files.has(unit.file) || !unit.file.endsWith(unit.name.slice(unit.name.lastIndexOf('.')))) return `unit file missing: ${unit?.file}`
    // (the box tests what is taken before an install: so every unit has to be said in the resources, too)
    if (!(x.resources?.services ?? []).some((sv) => sv.name === unit.name && sv.provides === true)) return `unit ${unit.name} is not in resources.services with "provides": true`
  }
  for (const g of system.groups ?? []) if (!GROUPS.has(g)) return `group not allowed: ${g}`
  for (const p of system.packages ?? []) if (!PACKAGE.test(p)) return `bad package name: ${p}`
  return null
}

/** The values of a settings request, checked against the manifest; unknown keys are an error. */
/** Is the text a list of exactly these names, each once, comma separated (the value of an "order" field)? */
export function isOrderOf(value: unknown, names: string[]): boolean {
  if (typeof value !== 'string') return false
  const got = value.split(',')
  return got.length === names.length && new Set(got).size === got.length && got.every((n) => names.includes(n))
}

export function checkSettings(manifest: Manifest, values: Record<string, unknown>): { ok: true; clean: Record<string, unknown> } | { ok: false; error: string } {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    const spec = manifest.settings?.[key]
    if (!spec) return { ok: false, error: `unknown setting: ${key}` }
    if (spec.type === 'boolean') {
      if (typeof value !== 'boolean') return { ok: false, error: `${key}: true or false` }
    } else if (spec.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, error: `${key}: a number` }
      if ((spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max)) return { ok: false, error: `${key}: out of range` }
      if (spec.options && !spec.options.includes(value)) return { ok: false, error: `${key}: not one of the options` }
    } else {
      if (typeof value !== 'string' || value.length > 300) return { ok: false, error: `${key}: a text` }
      if (spec.pattern && !new RegExp(spec.pattern).test(value.trim())) return { ok: false, error: `${key}: does not fit` }
      if (spec.options && !spec.options.includes(value.trim())) return { ok: false, error: `${key}: not one of the options` }
      const order = manifest.ui?.items.find((i) => i.key === key && i.type === 'order')
      if (order && !isOrderOf(value.trim(), (order.choices ?? []).map((c) => String(c.value)))) return { ok: false, error: `${key}: not an order of the choices` }
    }
    clean[key] = typeof value === 'string' ? value.trim() : value
  }
  return { ok: true, clean }
}

// ---------- the catalog and installing ----------

let catalogCache: { at: number; list: CatalogEntry[] } | null = null

/** Developer mode (mupibox.extensionDevMode, switched in the app): own extension files and another catalog. Off, only the MuPiBox
 *  catalog installs - an extension runs as the box's user, who may do everything as root. */
function devMode(deps: ExtensionDeps): boolean {
  return (deps.getMupiboxConfig()?.mupibox as Record<string, unknown> | undefined)?.extensionDevMode === true
}

function catalogUrl(deps: ExtensionDeps): string {
  const set = (deps.getMupiboxConfig()?.mupibox as Record<string, unknown> | undefined)?.extensionCatalog
  return devMode(deps) && typeof set === 'string' && /^https:\/\//.test(set) ? set : DEFAULT_CATALOG
}

/** The page of the catalog to read in a browser: the extensions folder on GitHub for the default catalog, else the address that was set. */
function catalogPage(deps: ExtensionDeps): string {
  const url = catalogUrl(deps)
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/([^/]+)\/(.+)\/[^/]+$/.exec(url)
  return m ? `https://github.com/${m[1]}/tree/${m[2]}/${m[3]}` : url
}

async function fetchCatalog(deps: ExtensionDeps): Promise<CatalogEntry[]> {
  if (catalogCache && Date.now() - catalogCache.at < 10 * 60 * 1000) return catalogCache.list
  const response = await fetch(catalogUrl(deps), { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`catalog: HTTP ${response.status}`)
  const body = await response.json()
  const list = (Array.isArray(body) ? body : []).filter(
    (e): e is CatalogEntry => validId(String(e?.id)) && VERSION.test(String(e?.version)) && /^https:\/\//.test(String(e?.url)) && /^[0-9a-f]{64}$/.test(String(e?.sha256)) && Number.isInteger(e?.hostApi) && e.hostApi <= HOST_API && e.size <= MAX_MPX,
  )
  // (an icon is only a small SVG as a data address - the page puts it into a style, so nothing else may get in)
  for (const e of list) if (e.icon !== undefined && !/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]{1,6000}$/.test(String(e.icon))) delete e.icon
  catalogCache = { at: Date.now(), list }
  return list
}

function run(cmd: string, args: string[], timeoutMs = 60000, env?: NodeJS.ProcessEnv): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env: env ? { ...process.env, ...env } : process.env }, (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout ?? ''}${stderr ?? ''}` }))
  })
}

/** After a change the services start again (the API itself too: its answer is sent first) and the display loads its page. */
function restartServices(): void {
  // (pm2 stops the whole process tree of "server" when it restarts it - this script is a child of it. So the work runs in a
  // subshell that is put in the background: when the outer shell ends, init takes it over and it is out of the tree.)
  const work = 'sleep 1; PM2=$(command -v pm2 || echo /usr/local/bin/pm2); "$PM2" restart spotify-control >/dev/null 2>&1; "$PM2" restart server >/dev/null 2>&1; sleep 10; curl -s -m 5 -X POST http://127.0.0.1:5005/display/reload-page >/dev/null 2>&1'
  const script = `( ${work} ) >/dev/null 2>&1 &`
  const child = spawn('sh', ['-c', script], { detached: true, stdio: 'ignore' })
  child.on('error', () => undefined)
  child.unref()
}

/** The display loads its page again (the player does it: POST /display/reload-page). */
function reloadDisplay(): void {
  const child = spawn('curl', ['-s', '-m', '5', '-X', 'POST', 'http://127.0.0.1:5005/display/reload-page'], { detached: true, stdio: 'ignore' })
  child.on('error', () => undefined)
  child.unref()
}

interface Job {
  running: boolean
  action: 'install' | 'remove'
  step: string
  ok?: boolean
  error?: string
}
const jobs = new Map<string, Job>()

/** The file names in a package, checked: plain relative names of the kinds an extension may hold. */
function packageFiles(entries: { name: string; data: Buffer }[]): Map<string, Buffer> | string {
  const files = new Map<string, Buffer>()
  for (const entry of entries) {
    const name = entry.name.replace(/^\.\//, '')
    if (!FILE.test(name) || name.includes('..') || name.startsWith('/')) return `bad file name: ${name.slice(0, 40)}`
    if (!PACKAGE_FILES.test(name)) return `not allowed in a package: ${name}`
    files.set(name, entry.data)
  }
  return files
}

interface Package {
  files: Map<string, Buffer>
  manifest: Manifest
}

/** A package read and checked: file names, manifest, the rules it brings. Never installs anything. */
export function verifyPackage(bytes: Buffer): { ok: true; pkg: Package } | { ok: false; error: string } {
  if (bytes.length > MAX_MPX || bytes.length === 0) return { ok: false, error: 'the file is too large or empty' }
  let files: Map<string, Buffer> | string
  try {
    files = packageFiles(readZip(bytes, { maxFile: MAX_MPX, maxTotal: 3 * MAX_MPX, strict: true }))
  } catch (error) {
    return { ok: false, error: `not an extension file: ${(error as Error).message}` }
  }
  if (typeof files === 'string') return { ok: false, error: files }
  let manifest: Manifest
  try {
    manifest = JSON.parse(files.get('manifest.json')?.toString('utf8') ?? 'null') as Manifest
  } catch {
    return { ok: false, error: 'manifest.json is not valid' }
  }
  const bad = checkManifest(manifest, new Set(files.keys()))
  if (bad) return { ok: false, error: bad }
  for (const rule of manifest.system?.udev ?? []) {
    const problem = checkUdevRules(files.get(rule.file)?.toString('utf8') ?? '')
    if (problem) return { ok: false, error: `${rule.name}: ${problem}` }
  }
  for (const unit of manifest.system?.units ?? []) {
    const problem = checkUnitFile(files.get(unit.file)?.toString('utf8') ?? '', unit.name.endsWith('.timer') ? 'timer' : 'service')
    if (problem) return { ok: false, error: `${unit.name}: ${problem}` }
  }
  return { ok: true, pkg: { files, manifest } }
}

// Files the user uploaded and the app has asked about (what they set up is shown first): kept for ten minutes
const uploads = new Map<string, { pkg: Package; until: number }>()

async function installExtension(id: string, deps: ExtensionDeps, uploaded?: Package): Promise<void> {
  const job = jobs.get(id) as Job
  const fail = (error: string) => {
    Object.assign(job, { running: false, ok: false, error })
    console.warn(`${new Date().toLocaleString()}: [Extensions] install ${id} failed: ${error}`)
  }
  try {
    let pkg: Package
    if (uploaded) {
      pkg = uploaded
    } else {
      job.step = 'catalog'
      const entry = (await fetchCatalog(deps)).find((e) => e.id === id)
      if (!entry) return fail('not in the catalog')
      job.step = 'download'
      const response = await fetch(entry.url, { signal: AbortSignal.timeout(120000), redirect: 'follow' })
      if (!response.ok) return fail(`download: HTTP ${response.status}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length > MAX_MPX || bytes.length === 0) return fail('the file is too large or empty')
      if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) return fail('the checksum does not match the catalog')
      job.step = 'check'
      const checked = verifyPackage(bytes)
      if (!checked.ok) return fail(checked.error)
      pkg = checked.pkg
      const m = pkg.manifest
      if (m.id !== entry.id || m.version !== entry.version) return fail('the package is not the one the catalog names')
      // what it asks to have set up must be what the catalog said (the app showed that before the install)
      const said = entry.system ?? {}
      const asked = m.system ?? {}
      if ((asked.udev ?? []).length !== (said.udev ?? 0) || JSON.stringify((asked.units ?? []).map((u) => u.name)) !== JSON.stringify(said.units ?? []) || JSON.stringify(asked.groups ?? []) !== JSON.stringify(said.groups ?? []) || JSON.stringify(asked.packages ?? []) !== JSON.stringify(said.packages ?? [])) return fail('the package asks for more than the catalog says')
    }
    const { files, manifest } = pkg
    if (manifest.id !== id) return fail('the package is not the extension asked for')
    const sys = manifest.system ?? {}
    // (the units of the version that is installed now: what the new one no longer has is removed)
    const before = await readManifest(id)

    // what the package says it needs must be what was shown before (the catalog's entry), and it must not collide with anything
    if (!uploaded) {
      const entry = (await fetchCatalog(deps)).find((e) => e.id === id)
      if (!sameResources(entry?.resources, manifest.resources)) return fail('the package needs other resources than the catalog says')
    }
    job.step = 'test'
    const conflicts = (await testResources(manifest, deps)).filter((c) => c.severity === 'error')
    if (conflicts.length > 0) return fail(`conflict: ${conflicts.map((c) => c.message).join(' ')}`)

    // In this order: the files ready beside it, the packages, the rules and groups, then the files in place and the services
    // last. The version before stays whole until then - a failure on the way leaves it as it was (it was deleted first,
    // and a package that could not be loaded left the new files without what they need); its services come back too.
    job.step = 'files'
    const target = path.join(EXT_DIR, id)
    const staging = path.join(EXT_DIR, `.install-${id}`)
    const previous = path.join(EXT_DIR, `.previous-${id}`)
    await fsp.rm(staging, { recursive: true, force: true })
    for (const [name, data] of files) {
      await fsp.mkdir(path.dirname(path.join(staging, name)), { recursive: true })
      await fsp.writeFile(path.join(staging, name), data)
    }
    const dropStaging = () => fsp.rm(staging, { recursive: true, force: true }).catch(() => undefined)

    // (before the services: a service that runs a program of one of its packages could not start before it was there)
    if ((sys.packages ?? []).length > 0) {
      job.step = 'packages'
      const r = await run('sudo', ['apt-get', 'install', '-y', '--no-install-recommends', '--no-remove', ...(sys.packages as string[])], 600000, { DEBIAN_FRONTEND: 'noninteractive' })
      if (!r.ok) {
        await dropStaging()
        return fail(`packages: ${r.out.slice(-200)}`)
      }
    }

    job.step = 'system'
    for (const rule of sys.udev ?? []) {
      const tmp = `/tmp/mpx-${id}-${process.pid}.rules`
      await fsp.writeFile(tmp, files.get(rule.file) as Buffer)
      const r = await run('sudo', ['install', '-m', '644', '-o', 'root', '-g', 'root', tmp, `/etc/udev/rules.d/${rule.name}`], 20000)
      await fsp.rm(tmp, { force: true })
      if (!r.ok) {
        await dropStaging()
        return fail(`rule ${rule.name}: ${r.out.slice(0, 100)}`)
      }
    }
    // (the rules of the version before that this one no longer has: else they stayed for good - a removal later only
    // knows the rules of the version then)
    const staleRules = (before?.system?.udev ?? []).filter((old) => !(sys.udev ?? []).some((r) => r.name === old.name))
    for (const rule of staleRules) await run('sudo', ['rm', '-f', `/etc/udev/rules.d/${rule.name}`], 20000)
    if ((sys.udev ?? []).length > 0 || staleRules.length > 0) {
      await run('sudo', ['udevadm', 'control', '--reload'], 20000)
      await run('sudo', ['udevadm', 'trigger', '--subsystem-match=block', '--action=change'], 20000)
    }
    for (const group of sys.groups ?? []) {
      const r = await run('sudo', ['usermod', '-aG', group, 'dietpi'], 20000)
      if (!r.ok) {
        await dropStaging()
        return fail(`group ${group}: ${r.out.slice(0, 100)}`)
      }
    }

    // the files in place, the version before kept aside until its services were replaced
    await fsp.rm(previous, { recursive: true, force: true })
    if (existsSync(target)) await fsp.rename(target, previous)
    await fsp.rename(staging, target)

    // the settings an older version of the box kept in its own configuration come along once
    const config = deps.getMupiboxConfig() as unknown as Record<string, unknown> | undefined
    const have = await readJson<Record<string, unknown>>(settingsFile(id), {})
    let imported = false
    for (const [key, spec] of Object.entries(manifest.settings ?? {})) {
      if (!spec.legacy || key in have) continue
      const value = spec.legacy.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), config)
      if (value !== undefined && value !== null && value !== '' && (!spec.options || spec.options.includes(value as never))) {
        have[key] = value
        imported = true
      }
    }
    if (imported) {
      await fsp.mkdir(path.dirname(settingsFile(id)), { recursive: true })
      await fsp.writeFile(settingsFile(id), JSON.stringify(have))
    }

    if ((sys.units ?? []).length > 0 || (before?.system?.units ?? []).length > 0) {
      job.step = 'services'
      const problem = await setUpUnits(before?.system?.units ?? [], sys.units ?? [], files, target, id)
      if (problem) {
        // back to the version before: its files, and its services as they were (none: the new ones go again)
        await fsp.rm(target, { recursive: true, force: true })
        if (existsSync(previous)) await fsp.rename(previous, target)
        const oldUnits = before?.system?.units ?? []
        if (oldUnits.length > 0) {
          const oldFiles = new Map<string, Buffer>()
          for (const u of oldUnits) oldFiles.set(u.file, await fsp.readFile(path.join(target, u.file)).catch(() => Buffer.alloc(0)))
          await setUpUnits(sys.units ?? [], oldUnits, oldFiles, target, id)
        } else {
          await removeUnits(sys.units ?? [])
        }
        return fail(before ? `${problem} - the version before is back` : problem)
      }
    }
    await fsp.rm(previous, { recursive: true, force: true })

    const state = await readState()
    state[id] = { version: manifest.version, enabled: true }
    await writeState(state)
    Object.assign(job, { running: false, ok: true, step: 'done' })
    restartServices()
  } catch (error) {
    fail((error as Error).message)
  }
}

const UNIT_DIR = '/etc/systemd/system'

/** Put a root-owned file in place (sudo install, from a temporary file). Returns what went wrong, or null. */
async function installRootFile(name: string, data: string, to: string): Promise<string | null> {
  const tmp = `/tmp/mpx-${process.pid}-${randomBytes(4).toString('hex')}`
  await fsp.writeFile(tmp, data)
  const r = await run('sudo', ['install', '-m', '644', '-o', 'root', '-g', 'root', tmp, to], 20000)
  await fsp.rm(tmp, { force: true })
  return r.ok ? null : `${name}: ${r.out.slice(0, 100)}`
}

/** The systemd units an extension brought are taken out again: stopped, switched off, the files removed. */
async function removeUnits(units: { name: string }[]): Promise<void> {
  for (const u of units) {
    await run('sudo', ['systemctl', 'disable', '--now', u.name], 30000)
    await run('sudo', ['rm', '-rf', `${UNIT_DIR}/${u.name}`, `${UNIT_DIR}/${u.name}.d`], 20000)
  }
  if (units.length > 0) await run('sudo', ['systemctl', 'daemon-reload'], 20000)
}

/**
 * The systemd units of an extension: the files go into /etc/systemd/system (a service gets a drop-in that makes it run as the user of
 * the box, without new privileges), then they are switched on and started. Units of the version before that the new one no longer has
 * are removed. Returns what went wrong, or null.
 */
async function setUpUnits(before: { name: string }[], units: { name: string; file: string }[], files: Map<string, Buffer>, dir: string, id: string): Promise<string | null> {
  await removeUnits(before.filter((b) => !units.some((u) => u.name === b.name)))
  for (const u of units) {
    // (@EXT_DIR@ is the folder of the extension)
    const text = (files.get(u.file) as Buffer).toString('utf8').split('@EXT_DIR@').join(dir)
    const bad = await installRootFile(`unit ${u.name}`, text, `${UNIT_DIR}/${u.name}`)
    if (bad) return bad
    if (u.name.endsWith('.service')) {
      const made = await run('sudo', ['install', '-d', '-m', '755', `${UNIT_DIR}/${u.name}.d`], 20000)
      if (!made.ok) return `unit ${u.name}: ${made.out.slice(0, 100)}`
      const dropin = await installRootFile(`unit ${u.name}`, `# made by the extension ${id}: it runs as the user of the box\n[Service]\nUser=dietpi\nNoNewPrivileges=yes\n`, `${UNIT_DIR}/${u.name}.d/10-mupibox.conf`)
      if (dropin) return dropin
    }
  }
  if (units.length > 0) {
    const r = await run('sudo', ['systemctl', 'daemon-reload'], 20000)
    if (!r.ok) return `systemd: ${r.out.slice(0, 100)}`
    for (const u of units) {
      // (restart: a version that was running before has to run the new file)
      await run('sudo', ['systemctl', 'enable', u.name], 20000)
      const started = await run('sudo', ['systemctl', 'restart', u.name], 30000)
      if (!started.ok) return `${u.name} did not start: ${started.out.slice(-150)}`
    }
  }
  return null
}

async function removeExtension(id: string): Promise<void> {
  const job = jobs.get(id) as Job
  try {
    const manifest = await readManifest(id)
    await removeUnits(manifest?.system?.units ?? [])
    for (const rule of manifest?.system?.udev ?? []) await run('sudo', ['rm', '-f', `/etc/udev/rules.d/${rule.name}`], 20000)
    if ((manifest?.system?.udev ?? []).length > 0) await run('sudo', ['udevadm', 'control', '--reload'], 20000)
    await fsp.rm(path.join(EXT_DIR, id), { recursive: true, force: true })
    const state = await readState()
    delete state[id]
    await writeState(state)
    Object.assign(job, { running: false, ok: true, step: 'done' })
    restartServices()
  } catch (error) {
    Object.assign(job, { running: false, ok: false, error: (error as Error).message })
  }
}

// ---------- the routes ----------

/** The app's routes (behind the session): the catalog, install, on and off, remove, the settings of an extension. */
export function registerExtensionRoutes(router: Router, deps: ExtensionDeps): void {
  router.get('/extensions', requireSession, async (_req, res) => {
    const state = await readState()
    const installed = []
    for (const [id, s] of Object.entries(state)) {
      const m = await readManifest(id)
      if (m) installed.push({ id, name: m.name, version: m.version, description: m.description ?? '', icon: m.icon ? `/api/ext-files/${id}/${m.icon}` : null, enabled: s.enabled !== false, system: m.system ?? {}, resources: describeResources(m.resources), ui: m.ui ?? null, settingTypes: Object.fromEntries(Object.entries(m.settings ?? {}).map(([k, d]) => [k, d.type])), settings: await publicSettings(m), job: jobs.get(id) ?? null })
    }
    let catalog: unknown[] = []
    let catalogError: string | null = null
    try {
      catalog = (await fetchCatalog(deps)).map((e) => ({ ...e, resources: describeResources(e.resources), installedVersion: state[e.id]?.version ?? null, job: jobs.get(e.id) ?? null }))
    } catch (error) {
      catalogError = (error as Error).message
    }
    res.json({ installed, catalog, catalogError, catalogPage: catalogPage(deps), hostApi: HOST_API, devMode: devMode(deps) })
  })

  const start = (action: Job['action'], work: (id: string, body?: Record<string, unknown>) => Promise<void>): RequestHandler[] => [
    requireSession,
    requireCsrf,
    async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      // (an uploaded file names itself: its id is the one in its manifest)
      const upload = typeof body.token === 'string' ? uploads.get(body.token) : undefined
      const id = upload ? upload.pkg.manifest.id : String(body.id ?? '')
      if (!validId(id)) {
        res.status(400).json({ error: 'invalid id' })
        return
      }
      if ([...jobs.values()].some((j) => j.running)) {
        res.status(409).json({ error: 'busy' })
        return
      }
      jobs.set(id, { running: true, action, step: 'start' })
      void work(id, body)
      res.json({ ok: true, id })
    },
  ]
  router.post('/extensions/install', ...start('install', (id, body) => {
    const token = typeof body?.token === 'string' ? body.token : ''
    const upload = token ? uploads.get(token) : undefined
    if (token) uploads.delete(token)
    // (an uploaded file only in developer mode - switched off meanwhile: not installed)
    if (token && !devMode(deps)) {
      Object.assign(jobs.get(id) as Job, { running: false, ok: false, error: 'own extension files only in developer mode' })
      return Promise.resolve()
    }
    return installExtension(id, deps, upload && upload.until > Date.now() ? upload.pkg : undefined)
  }))

  // The test before an install: what the extension needs and whether it collides with anything on the box. For one of the catalog
  // ({id}: the catalog says what it needs; the install tests the package itself again) or one that was uploaded ({token}). Changes nothing.
  router.post('/extensions/check', requireSession, requireCsrf, async (req, res) => {
    const body = (req.body ?? {}) as { id?: unknown; token?: unknown }
    let manifest: Manifest | undefined
    if (typeof body.token === 'string') manifest = uploads.get(body.token)?.pkg.manifest
    else if (typeof body.id === 'string' && validId(body.id)) {
      try {
        const entry = (await fetchCatalog(deps)).find((e) => e.id === body.id)
        if (entry) manifest = { id: entry.id, name: entry.name, version: entry.version, hostApi: entry.hostApi, resources: entry.resources }
      } catch (error) {
        res.status(502).json({ error: `catalog: ${(error as Error).message}` })
        return
      }
    }
    if (!manifest) {
      res.status(404).json({ error: 'unknown extension' })
      return
    }
    const conflicts = await testResources(manifest, deps)
    res.json({ ok: true, id: manifest.id, resources: describeResources(manifest.resources), conflicts, canInstall: !conflicts.some((c) => c.severity === 'error') })
  })

  // An extension file from the user (not from the catalog): read and checked here, nothing installed yet. The answer says what it is
  // and what it would set up, the app asks, and the install then names the token.
  router.post('/extensions/upload', requireSession, requireCsrf, express.raw({ type: () => true, limit: MAX_MPX }), async (req, res) => {
    if (!devMode(deps)) {
      res.status(403).json({ error: 'own extension files only in developer mode' })
      return
    }
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    const checked = verifyPackage(bytes)
    if (!checked.ok) {
      res.status(400).json({ error: checked.error })
      return
    }
    const m = checked.pkg.manifest
    for (const [token, u] of uploads) if (u.until < Date.now()) uploads.delete(token)
    if (uploads.size >= 2) uploads.delete(uploads.keys().next().value as string)
    const token = randomBytes(16).toString('hex')
    uploads.set(token, { pkg: checked.pkg, until: Date.now() + 10 * 60 * 1000 })
    const state = await readState()
    res.json({
      ok: true,
      token,
      id: m.id,
      name: m.name,
      version: m.version,
      description: m.description ?? '',
      system: { udev: (m.system?.udev ?? []).length, units: (m.system?.units ?? []).map((u) => u.name), groups: m.system?.groups ?? [], packages: m.system?.packages ?? [] },
      resources: describeResources(m.resources),
      conflicts: await testResources(m, deps),
      installedVersion: state[m.id]?.version ?? null,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })
  })
  // Developer mode on or off ({ on }): off, files uploaded before and not installed yet are forgotten
  router.post('/extensions/devmode', requireSession, requireCsrf, async (req, res) => {
    const on = (req.body as { on?: unknown } | undefined)?.on === true
    if (!deps.updateMupiboxConfig) {
      res.status(500).json({ error: 'settings cannot be written' })
      return
    }
    await deps.updateMupiboxConfig((cfg) => {
      const mb = ((cfg.mupibox as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
      if (on) mb.extensionDevMode = true
      else delete mb.extensionDevMode
      cfg.mupibox = mb
    })
    if (!on) uploads.clear()
    catalogCache = null
    res.json({ ok: true, devMode: on })
  })
  router.post('/extensions/remove', ...start('remove', removeExtension))

  router.post('/extensions/enable', requireSession, requireCsrf, async (req, res) => {
    const { id, enabled } = (req.body ?? {}) as { id?: unknown; enabled?: unknown }
    const state = await readState()
    if (typeof id !== 'string' || !state[id] || typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'invalid request' })
      return
    }
    if (enabled) {
      // (switched on: the same test as before an install - another extension or the box may hold what it needs by now)
      const manifest = await readManifest(id)
      const errors = manifest ? (await testResources(manifest, deps)).filter((c) => c.severity === 'error') : []
      if (errors.length > 0) {
        res.status(409).json({ error: 'conflict', conflicts: errors })
        return
      }
    }
    state[id].enabled = enabled
    await writeState(state)
    // (its systemd services run while it is on)
    for (const u of (await readManifest(id))?.system?.units ?? []) await run('sudo', ['systemctl', enabled ? 'enable' : 'disable', '--now', u.name], 30000)
    res.json({ ok: true })
    restartServices()
  })

  router.get('/ext/:id/settings', requireSession, async (req, res) => {
    const manifest = await readManifest(String(req.params.id))
    if (!manifest) {
      res.status(404).json({ error: 'not installed' })
      return
    }
    res.json(await publicSettings(manifest))
  })

  router.post('/ext/:id/settings', requireSession, requireCsrf, async (req, res) => {
    const manifest = await readManifest(String(req.params.id))
    if (!manifest) {
      res.status(404).json({ error: 'not installed' })
      return
    }
    const checked = checkSettings(manifest, ((req.body as { values?: unknown } | undefined)?.values ?? {}) as Record<string, unknown>)
    if (!checked.ok) {
      res.status(400).json({ error: checked.error })
      return
    }
    await fsp.mkdir(path.dirname(settingsFile(manifest.id)), { recursive: true })
    await fsp.writeFile(settingsFile(manifest.id), JSON.stringify({ ...(await readJson(settingsFile(manifest.id), {})), ...checked.clean }))
    // (the display reads the settings of its part when its page loads)
    if (manifest.display) reloadDisplay()
    res.json({ ok: true, ...(await publicSettings(manifest)) })
  })
}

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
}

/**
 * What the display and the app read, and the extensions' own API parts - on the app itself, not behind the session (the display of the box
 * asks too): GET /api/ext/active, the files under /ext/<id>/..., and what an extension's api.js adds under /api/ext/<id>/.
 */
export function mountExtensions(app: express.Express, deps: ExtensionDeps): void {
  app.get('/api/ext/active', localNetworkOnly, async (_req, res) => {
    const out = []
    for (const m of await enabledManifests()) {
      const url = (file?: string) => (file ? `/ext/${m.id}/${file}` : undefined)
      out.push({ id: m.id, name: m.name, version: m.version, display: url(m.display), icon: url(m.icon), settings: await publicSettings(m) })
    }
    res.json(out)
  })

  // the files of an extension (not its server-side code): the display and the app load their parts and pictures from here. Twice: /ext/
  // for the display (port 8200), /api/ext-files/ for the app (port 80: the web server hands only /api, /app ... on to the box)
  app.get(/^\/(?:ext|api\/ext-files)\/([a-z][a-z0-9-]{1,30})\/(.+)$/, localNetworkOnly, async (req, res) => {
    const id = req.params[0]
    const rel = req.params[1]
    let manifest = (await enabledManifests()).find((m) => m.id === id)
    if (!manifest) {
      // (an extension that is off has no part on the display, but its picture is shown on the page of the extensions)
      const installed = await readManifest(id)
      if (installed?.icon === rel && id in (await readState())) manifest = installed
    }
    if (!manifest || !FILE.test(rel) || rel.includes('..') || !ALLOWED_FILES.test(rel) || rel === manifest.player || rel === manifest.api) {
      res.status(404).end()
      return
    }
    const file = path.join(EXT_DIR, id, rel)
    try {
      const data = await fsp.readFile(file)
      res.setHeader('Content-Type', CONTENT_TYPES[path.extname(rel).toLowerCase()] ?? 'application/octet-stream')
      // (an extension that is updated is loaded again at once)
      res.setHeader('Cache-Control', 'no-cache')
      res.send(data)
    } catch {
      res.status(404).end()
    }
  })

  // The API parts: api.js of each extension that is on, started when the server starts. They are loaded after the routes of the server
  // stand (the manifests are read asynchronously) - a route added to the app then would come after the catch-all that sends the start
  // page. So one handler is mounted here, at once, and finds the router of the extension when a request comes.
  const routers = new Map<string, express.Router>()
  app.use('/api/ext', (req, res, next) => {
    const hit = /^\/([a-z][a-z0-9-]{1,30})(?=\/|$)/.exec(req.url)
    const router = hit ? routers.get(hit[1]) : undefined
    if (!hit || !router) return next()
    const original = req.url
    req.url = req.url.slice(hit[0].length) || '/'
    router(req, res, (error?: unknown) => {
      req.url = original
      next(error)
    })
  })
  void (async () => {
    for (const manifest of await enabledManifests()) {
      if (!manifest.api) continue
      try {
        const dir = path.join(EXT_DIR, manifest.id)
        const target = path.resolve(dir, manifest.api)
        if (!target.startsWith(path.resolve(dir) + path.sep)) throw new Error('api file outside the extension')
        // (a file read at run time, not part of this bundle)
        const mod = eval('require')(target) as { activate?: (host: unknown) => void }
        if (typeof mod.activate !== 'function') throw new Error('api.js has no activate()')
        const router = express.Router()
        router.use(localNetworkOnly)
        // a route that fails answers 500 and is logged, never ends the server
        const guarded = (handler: RequestHandler): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
          try {
            const result = handler(req, res, next) as unknown
            if (result && typeof (result as Promise<unknown>).catch === 'function') {
              ;(result as Promise<unknown>).catch((error) => {
                console.warn(`${new Date().toLocaleString()}: [Extension ${manifest.id}] route error: ${error}`)
                if (!res.headersSent) res.status(500).json({ ok: false })
              })
            }
          } catch (error) {
            console.warn(`${new Date().toLocaleString()}: [Extension ${manifest.id}] route error: ${error}`)
            if (!res.headersSent) res.status(500).json({ ok: false })
          }
        }
        mod.activate({
          id: manifest.id,
          dir,
          dataDir: path.join(EXT_DIR, 'data', manifest.id),
          log: { debug: () => undefined, info: console.log, warn: console.warn },
          settings: () => readSettings(manifest),
          config: () => deps.getMupiboxConfig(),
          playerUrl: 'http://127.0.0.1:5005',
          // (hostApi 4) change the box's configuration (the one file of the core, under its lock); where the box keeps its library
          // and its data; restart the player and the server (and load the display again) - the caller is part of the server, so this
          // is the last thing it does
          updateConfig: (mutate: (cfg: Record<string, unknown>) => void) => {
            if (!deps.updateMupiboxConfig) return Promise.reject(new Error('the box cannot change its configuration here'))
            return deps.updateMupiboxConfig(mutate)
          },
          paths: { library: LIBRARY_DIR, data: DATA_DIR, extensions: EXT_DIR },
          restartServices,
          route: (method: 'get' | 'post', sub: string, handler: RequestHandler, options?: { session?: boolean }) => {
            const chain: RequestHandler[] = options?.session ? [requireSession, ...(method === 'post' ? [requireCsrf] : []), guarded(handler)] : [guarded(handler)]
            router[method](sub, ...chain)
          },
        })
        routers.set(manifest.id, router)
        console.log(`${new Date().toLocaleString()}: [Extension ${manifest.id}] ${manifest.version} API part started`)
      } catch (error) {
        console.warn(`${new Date().toLocaleString()}: [Extension ${manifest.id}] API part not started: ${error}`)
      }
    }
  })()
}

// (kept for the tests: the checks above need no box)
export const _forTests = { packageFiles, readFileSync }
