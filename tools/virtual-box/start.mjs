// The virtual MuPiBox: the real backend of the box (src/backend-api, with the app and the extensions) on your PC, a pretend player,
// and a virtual OLED display whose picture you can look at (or fetch as a PNG) at any time. See README.md.
//
//   node tools/virtual-box/start.mjs [--ext oled,buttons,nfc,clock] [--reset] [--no-watch]
//
//   backend       http://localhost:8200      the real server in development mode (restarts itself when its code changes)
//   app           http://localhost:8200/app/ the parents' app, served from src/mupi-app (reload the page after a change)
//   player        http://localhost:5005      the pretend player (tools/winamp-sandbox): a small library, a running clock, no sound
//   virtual box   http://localhost:8210      the OLED display as a picture, buttons for the player and the QR code, links
//   OLED picture  http://localhost:8210/oled.png
//
// The extensions in extensions/ are copied into the box's folder (src/backend-api/config/extensions) - the OLED driver as the virtual
// one - and every change you make there is copied over and the backend starts again.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, watch, writeFileSync, copyFileSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const backend = path.join(root, 'src/backend-api')
const work = path.join(here, '.work')
const venv = path.join(work, 'venv')
const oledOut = path.join(work, 'oled')
const configDir = path.join(backend, 'config')
const extDir = path.join(configDir, 'extensions')
const win = process.platform === 'win32'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
const EXTENSIONS = option('ext', 'oled,buttons,nfc,clock').split(',').filter(Boolean)
const say = (text) => console.log(`[virtual box] ${text}`)

// ---------- Python with a python3: the extension starts its driver with "python3" ----------
function pythonEnv() {
  const bin = path.join(venv, win ? 'Scripts' : 'bin')
  if (!existsSync(path.join(bin, win ? 'python3.exe' : 'python3'))) {
    say('setting up Python (once) ...')
    const first = spawnSync(win ? 'python' : 'python3', ['-m', 'venv', '--system-site-packages', venv], { stdio: 'inherit' })
    if (first.status !== 0) throw new Error('python -m venv failed: Python 3 is needed')
    // (Windows: the program the extension starts is "python3", and a program of that name has to be a real .exe)
    if (win) copyFileSync(path.join(bin, 'python.exe'), path.join(bin, 'python3.exe'))
  }
  const check = spawnSync(path.join(bin, win ? 'python3.exe' : 'python3'), ['-c', 'import PIL'], { stdio: 'ignore' })
  if (check.status !== 0) {
    say('installing Pillow ...')
    spawnSync(path.join(bin, win ? 'python3.exe' : 'python3'), ['-m', 'pip', 'install', '--quiet', 'pillow'], { stdio: 'inherit' })
  }
  return bin
}

// ---------- the box's folders: configuration and extensions ----------
function writeIfChanged(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  if (existsSync(file) && readFileSync(file).equals(Buffer.from(data))) return false
  writeFileSync(file, data)
  return true
}

/** What the box would have in its folders of the extensions: the files (no tests), the OLED driver replaced by the virtual one. */
function syncExtensions() {
  let changed = false
  const state = {}
  for (const id of EXTENSIONS) {
    const source = path.join(root, 'extensions', id)
    if (!existsSync(path.join(source, 'manifest.json'))) {
      say(`no extension "${id}" in extensions/`)
      continue
    }
    const manifest = JSON.parse(readFileSync(path.join(source, 'manifest.json'), 'utf8'))
    state[id] = { version: manifest.version, enabled: true }
    const walk = (dir, rel = '') => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (['test', '__pycache__', 'node_modules'].includes(entry.name) && entry.isDirectory()) continue
        const from = path.join(dir, entry.name)
        const to = path.join(rel, entry.name)
        if (entry.isDirectory()) {
          walk(from, to)
          continue
        }
        let target = to
        if (id === 'oled' && to === 'oled.py') target = 'oled_real.py'
        const text = readFileSync(from)
        if (writeIfChanged(path.join(extDir, id, target), text)) changed = true
      }
    }
    walk(source)
    if (id === 'oled' && writeIfChanged(path.join(extDir, 'oled', 'oled.py'), readFileSync(path.join(here, 'oled_virtual.py')))) changed = true
  }
  if (writeIfChanged(path.join(extDir, 'state.json'), JSON.stringify(state, null, 1) + '\n')) changed = true
  return changed
}

function prepare() {
  mkdirSync(work, { recursive: true })
  if (flag('reset')) {
    for (const f of readdirSync(configDir)) if (f !== '.gitkeep') rmSync(path.join(configDir, f), { recursive: true, force: true })
    rmSync(oledOut, { recursive: true, force: true })
  }
  mkdirSync(configDir, { recursive: true })
  const cfg = path.join(configDir, 'mupiboxconfig.json')
  if (!existsSync(cfg)) copyFileSync(path.join(root, 'config/templates/mupiboxconfig.json'), cfg)
  syncExtensions()
}

// ---------- the processes ----------
const children = new Set()
function kill(child) {
  if (!child || child.exitCode !== null) return
  if (win) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGTERM')
}
function run(name, command, argv, options) {
  const child = spawn(command, argv, { stdio: ['ignore', 'pipe', 'pipe'], ...options })
  children.add(child)
  const out = (data) => String(data).split('\n').filter(Boolean).forEach((line) => console.log(`[${name}] ${line}`))
  child.stdout.on('data', out)
  child.stderr.on('data', out)
  child.on('close', (code) => {
    children.delete(child)
    if (!stopping && !restarting.has(child)) say(`${name} ended (${code})`)
  })
  return child
}
let stopping = false
const restarting = new Set()

const bin = pythonEnv()
prepare()
const env = { ...process.env, NODE_ENV: 'development', PATH: `${bin}${path.delimiter}${process.env.PATH}`, MUPIBOX_VIRTUAL_OUT: oledOut }

run('player', process.execPath, [path.join(root, 'tools/winamp-sandbox/server.mjs'), '--player-only'], { cwd: root, env })

const tsx = path.join(backend, 'node_modules/tsx/dist/cli.mjs')
const tsxCli = existsSync(tsx) ? tsx : path.join(root, 'node_modules/tsx/dist/cli.mjs')
let server
const startServer = () => {
  // (--import: the require() of the extensions' loader, see require-shim.mjs)
  const shim = pathToFileURL(path.join(here, 'require-shim.mjs')).href
  server = run('backend', process.execPath, [tsxCli, 'watch', 'src/server.ts'], { cwd: backend, env: { ...env, NODE_OPTIONS: `--import=${shim}` } })
}
startServer()

if (!flag('no-watch')) {
  let timer = null
  const onChange = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      // (a file that is gone for a moment - a switch of the git branch - must not end the virtual box)
      let changed = false
      try {
        changed = syncExtensions()
      } catch (error) {
        say(`the extensions could not be copied now (${error.code ?? error.message}), waiting for the next change`)
        return
      }
      if (!changed) return
      say('an extension changed: the backend starts again')
      const old = server
      restarting.add(old)
      kill(old)
      setTimeout(startServer, 800)
    }, 400)
  }
  watch(path.join(root, 'extensions'), { recursive: true }, (_event, file) => {
    if (file && /(^|[\\/])(test|dist|__pycache__)([\\/]|$)/.test(file)) return
    onChange()
  })
  watch(here, (_event, file) => {
    if (file === 'oled_virtual.py') onChange()
  })
}

// ---------- the virtual box: the OLED picture, the controls, the links ----------
const BOX = 'http://127.0.0.1:8200'
const PLAYER = 'http://127.0.0.1:5005'
const page = () => readFileSync(path.join(here, 'page.html'), 'utf8') // (read at every request: change the page, reload it)
const ALBUMS = [
  ['music', 'Demo Album One'],
  ['music', 'Demo Album Two'],
  ['music', 'Radio Hits'],
  ['audiobook', 'Bedtime Story'],
]
const send = (res, status, type, body) => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(body)
}
const proxy = async (res, url, init) => {
  try {
    const answer = await fetch(url, init)
    send(res, answer.status, answer.headers.get('content-type') ?? 'text/plain', Buffer.from(await answer.arrayBuffer()))
  } catch (error) {
    send(res, 502, 'application/json', JSON.stringify({ ok: false, error: String(error.message ?? error) }))
  }
}
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const p = url.pathname
  if (p === '/' || p === '/index.html') return send(res, 200, 'text/html; charset=utf-8', page())
  if (p === '/oled.png' || p === '/shot') {
    const file = path.join(oledOut, 'oled.png')
    if (!existsSync(file)) return send(res, 404, 'text/plain', 'the OLED display has not drawn anything yet (is the extension "oled" on and the backend up?)')
    return send(res, 200, 'image/png', readFileSync(file))
  }
  if (p === '/oled.json') {
    const file = path.join(oledOut, 'oled.json')
    return send(res, 200, 'application/json', existsSync(file) ? readFileSync(file) : '{}')
  }
  if (p === '/albums') return send(res, 200, 'application/json', JSON.stringify(ALBUMS.map(([category, name]) => ({ category, name }))))
  if (p === '/player') return proxy(res, `${PLAYER}/local`)
  if (p === '/command' && req.method === 'POST') {
    // a command to the pretend player, e.g. "pause", "next", "+5", "musicsearch/library/album/music:Radio Hits"
    const command = url.searchParams.get('c') ?? ''
    return proxy(res, `${PLAYER}/current/${command.split('/').map(encodeURIComponent).join('/')}`)
  }
  if (p === '/address' && req.method === 'POST') return proxy(res, `${BOX}/api/ext/oled/address`, { method: 'POST' })
  if (p === '/status') {
    const file = path.join(oledOut, 'oled.png')
    const answers = {}
    for (const [name, target] of [['backend', `${BOX}/api/ext/active`], ['player', `${PLAYER}/local`]]) {
      answers[name] = await fetch(target).then((r) => r.status).catch(() => 0)
    }
    return send(res, 200, 'application/json', JSON.stringify({ ...answers, oled: existsSync(file) ? statSync(file).mtimeMs : 0 }))
  }
  send(res, 404, 'text/plain', 'not found')
}).listen(8210, '127.0.0.1', () => say('virtual box: http://localhost:8210   (the app: http://localhost:8200/app/)'))

const stop = () => {
  stopping = true
  for (const child of children) kill(child)
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
process.on('exit', () => {
  for (const child of children) kill(child)
})
