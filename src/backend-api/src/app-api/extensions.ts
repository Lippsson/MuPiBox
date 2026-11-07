// Extensions of the box (docs/extensions.md): one file (.mpx, a zip) per extension, installed from a catalog on GitHub, kept in
// ~/.mupibox/data/extensions/<id>/. This file is the API's part of it:
//  - the app's routes (/api/app/extensions...: the catalog, install, switch on and off, remove; /api/app/ext/<id>/settings)
//  - what the display and the app read (/api/ext/active, the files of an extension under /ext/<id>/...)
//  - the extensions' own API parts (api.js, loaded at the start, routes under /api/ext/<id>/...)
// An extension is a program of the user dietpi without any protection: it comes from the catalog only, its file is checked
// against the catalog's checksum, and what it asks to have set up as root is limited to a few checked kinds (udev rules, groups, packages).

import { execFile, spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, promises as fsp, readFileSync, renameSync } from 'node:fs'
import path from 'node:path'
import express, { type NextFunction, type Request, type RequestHandler, type Response, type Router } from 'express'
import type { MupiboxConfig } from '../models/mupibox-config.model'
import { EXTENSIONS_DIR, EXTENSIONS_DIR_BEFORE } from '../paths'
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
export const HOST_API = 2
const DEFAULT_CATALOG = 'https://raw.githubusercontent.com/Lippsson/MuPiBox/dev5.1/extensions/catalog.json'
const MAX_MPX = 4 * 1024 * 1024
const ID = /^[a-z][a-z0-9-]{1,30}$/
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/
const FILE = /^[A-Za-z0-9_][A-Za-z0-9_./-]{0,100}$/
// what a package may hold (a file of another kind is a reason to refuse it)
const ALLOWED_FILES = /\.(js|mjs|json|svg|png|jpg|css|txt|md|rules|html)$/i
const GROUPS = new Set(['cdrom', 'audio', 'video', 'plugdev'])
const PACKAGE = /^[a-z0-9][a-z0-9+.-]{1,60}$/
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
  ui?: { title: string; help?: string; items: { key: string; label: string; help?: string; dep?: string; choices?: { value: string | number; label: string }[]; type?: 'lookup'; search?: string }[] }
  settings?: Record<string, { type: 'boolean' | 'string' | 'number' | 'secret'; default?: unknown; pattern?: string; options?: (string | number)[]; min?: number; max?: number; legacy?: string }>
  system?: { udev?: { name: string; file: string }[]; groups?: string[]; packages?: string[] }
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
  system?: { udev?: number; groups?: string[]; packages?: string[] }
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
  if (!ID.test(id)) return null
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

/** What is wrong with a manifest (null: nothing). `files`: the names in the package. */
export function checkManifest(m: unknown, files: Set<string>): string | null {
  const x = m as Manifest
  if (!x || typeof x !== 'object') return 'no manifest'
  if (!ID.test(String(x.id))) return 'bad id'
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
    for (const item of ui.items) {
      if (!x.settings?.[item?.key]) return `ui: no such setting: ${item?.key}`
      if (typeof item.label !== 'string' || item.label.length > 100 || (item.help !== undefined && (typeof item.help !== 'string' || item.help.length > 800))) return `ui: bad text: ${item.key}`
      if (item.dep !== undefined && x.settings?.[item.dep]?.type !== 'boolean') return `ui: dep must be a switch: ${item.key}`
      if (item.type !== undefined) {
        // a search: a text field with a button; the extension's own API part answers with the places to choose from (see the app)
        if (item.type !== 'lookup' || x.settings[item.key].type !== 'string' || item.choices !== undefined) return `ui: bad type: ${item.key}`
        if (typeof item.search !== 'string' || !new RegExp(`^/api/ext/${x.id}/[a-z]{1,30}$`).test(item.search)) return `ui: bad search address: ${item.key}`
      }
      if (item.choices !== undefined) {
        const options = x.settings[item.key].options
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
  for (const g of system.groups ?? []) if (!GROUPS.has(g)) return `group not allowed: ${g}`
  for (const p of system.packages ?? []) if (!PACKAGE.test(p)) return `bad package name: ${p}`
  return null
}

/** The values of a settings request, checked against the manifest; unknown keys are an error. */
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
    }
    clean[key] = typeof value === 'string' ? value.trim() : value
  }
  return { ok: true, clean }
}

// ---------- the catalog and installing ----------

let catalogCache: { at: number; list: CatalogEntry[] } | null = null

function catalogUrl(deps: ExtensionDeps): string {
  const set = (deps.getMupiboxConfig()?.mupibox as Record<string, unknown> | undefined)?.extensionCatalog
  return typeof set === 'string' && /^https:\/\//.test(set) ? set : DEFAULT_CATALOG
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
    (e): e is CatalogEntry => ID.test(String(e?.id)) && VERSION.test(String(e?.version)) && /^https:\/\//.test(String(e?.url)) && /^[0-9a-f]{64}$/.test(String(e?.sha256)) && Number.isInteger(e?.hostApi) && e.hostApi <= HOST_API && e.size <= MAX_MPX,
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
    if (!ALLOWED_FILES.test(name)) return `not allowed in a package: ${name}`
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
    files = packageFiles(readZip(bytes))
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
      const response = await fetch(entry.url, { signal: AbortSignal.timeout(60000), redirect: 'follow' })
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
      if ((asked.udev ?? []).length !== (said.udev ?? 0) || JSON.stringify(asked.groups ?? []) !== JSON.stringify(said.groups ?? []) || JSON.stringify(asked.packages ?? []) !== JSON.stringify(said.packages ?? [])) return fail('the package asks for more than the catalog says')
    }
    const { files, manifest } = pkg
    if (manifest.id !== id) return fail('the package is not the extension asked for')
    const sys = manifest.system ?? {}

    job.step = 'files'
    const target = path.join(EXT_DIR, id)
    const staging = path.join(EXT_DIR, `.install-${id}`)
    await fsp.rm(staging, { recursive: true, force: true })
    for (const [name, data] of files) {
      await fsp.mkdir(path.dirname(path.join(staging, name)), { recursive: true })
      await fsp.writeFile(path.join(staging, name), data)
    }
    await fsp.rm(target, { recursive: true, force: true })
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

    job.step = 'system'
    for (const rule of sys.udev ?? []) {
      const tmp = `/tmp/mpx-${id}-${process.pid}.rules`
      await fsp.writeFile(tmp, files.get(rule.file) as Buffer)
      const r = await run('sudo', ['install', '-m', '644', '-o', 'root', '-g', 'root', tmp, `/etc/udev/rules.d/${rule.name}`], 20000)
      await fsp.rm(tmp, { force: true })
      if (!r.ok) return fail(`rule ${rule.name}: ${r.out.slice(0, 100)}`)
    }
    if ((sys.udev ?? []).length > 0) {
      await run('sudo', ['udevadm', 'control', '--reload'], 20000)
      await run('sudo', ['udevadm', 'trigger', '--subsystem-match=block', '--action=change'], 20000)
    }
    for (const group of sys.groups ?? []) {
      const r = await run('sudo', ['usermod', '-aG', group, 'dietpi'], 20000)
      if (!r.ok) return fail(`group ${group}: ${r.out.slice(0, 100)}`)
    }
    if ((sys.packages ?? []).length > 0) {
      job.step = 'packages'
      const r = await run('sudo', ['apt-get', 'install', '-y', '--no-install-recommends', ...(sys.packages as string[])], 600000, { DEBIAN_FRONTEND: 'noninteractive' })
      if (!r.ok) return fail(`packages: ${r.out.slice(-200)}`)
    }

    const state = await readState()
    state[id] = { version: manifest.version, enabled: true }
    await writeState(state)
    Object.assign(job, { running: false, ok: true, step: 'done' })
    restartServices()
  } catch (error) {
    fail((error as Error).message)
  }
}

async function removeExtension(id: string): Promise<void> {
  const job = jobs.get(id) as Job
  try {
    const manifest = await readManifest(id)
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
      if (m) installed.push({ id, name: m.name, version: m.version, description: m.description ?? '', icon: m.icon ? `/ext/${id}/${m.icon}` : null, enabled: s.enabled !== false, system: m.system ?? {}, ui: m.ui ?? null, settingTypes: Object.fromEntries(Object.entries(m.settings ?? {}).map(([k, d]) => [k, d.type])), settings: await publicSettings(m), job: jobs.get(id) ?? null })
    }
    let catalog: unknown[] = []
    let catalogError: string | null = null
    try {
      catalog = (await fetchCatalog(deps)).map((e) => ({ ...e, installedVersion: state[e.id]?.version ?? null, job: jobs.get(e.id) ?? null }))
    } catch (error) {
      catalogError = (error as Error).message
    }
    res.json({ installed, catalog, catalogError, catalogPage: catalogPage(deps), hostApi: HOST_API })
  })

  const start = (action: Job['action'], work: (id: string, body?: Record<string, unknown>) => Promise<void>): RequestHandler[] => [
    requireSession,
    requireCsrf,
    async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      // (an uploaded file names itself: its id is the one in its manifest)
      const upload = typeof body.token === 'string' ? uploads.get(body.token) : undefined
      const id = upload ? upload.pkg.manifest.id : String(body.id ?? '')
      if (!ID.test(id)) {
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
    return installExtension(id, deps, upload && upload.until > Date.now() ? upload.pkg : undefined)
  }))

  // An extension file from the user (not from the catalog): read and checked here, nothing installed yet. The answer says what it is
  // and what it would set up, the app asks, and the install then names the token.
  router.post('/extensions/upload', requireSession, requireCsrf, express.raw({ type: () => true, limit: MAX_MPX }), async (req, res) => {
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    const checked = verifyPackage(bytes)
    if (!checked.ok) {
      res.status(400).json({ error: checked.error })
      return
    }
    const m = checked.pkg.manifest
    for (const [token, u] of uploads) if (u.until < Date.now()) uploads.delete(token)
    if (uploads.size >= 3) uploads.delete(uploads.keys().next().value as string)
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
      system: { udev: (m.system?.udev ?? []).length, groups: m.system?.groups ?? [], packages: m.system?.packages ?? [] },
      installedVersion: state[m.id]?.version ?? null,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })
  })
  router.post('/extensions/remove', ...start('remove', removeExtension))

  router.post('/extensions/enable', requireSession, requireCsrf, async (req, res) => {
    const { id, enabled } = (req.body ?? {}) as { id?: unknown; enabled?: unknown }
    const state = await readState()
    if (typeof id !== 'string' || !state[id] || typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'invalid request' })
      return
    }
    state[id].enabled = enabled
    await writeState(state)
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

  // the files of an extension (not its server-side code): the display and the app load their parts and pictures from here
  app.get(/^\/ext\/([a-z][a-z0-9-]{1,30})\/(.+)$/, localNetworkOnly, async (req, res) => {
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
