// The users, API part: several people use one box and each has their own settings and their own library. The box keeps what is
// "live" (the configuration file, the library files) as it always did; this extension keeps one folder per user next to it. A switch
// writes the live state back into the folder of the user who goes, loads the folder of the one who comes, and restarts the box.
//
// Per user: the settings that are a matter of taste (theme, volumes, start page, clock, covers, play time limit, quiet hours ...),
// the library (albums, resume positions, offline lists), hidden covers, today's play time, the play log, the settings of the other
// extensions. The same for everybody: the Spotify login, Wi-Fi and network, NAS, hardware, the parents' password, the name of the box.
//
//   GET  /api/ext/users/state    -> { current: id, users: [{ id, name, color }], busy }              (the display; no login)
//   POST /api/ext/users/switch   { id }                                                              (the display; setting "displaySwitch")
//   GET  /api/ext/users/list     -> { current: id, users: [{ id, name, color }], busy }              (the app; parents' login)
//   POST /api/ext/users/add      { name }  /  POST .../remove { id }  /  POST .../select { id }      (the app; parents' login)
//   POST /api/ext/users/color    { id, color }   (one of the colours of the list that nobody else has)

const fs = require('node:fs')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { randomBytes } = require('node:crypto')

// What belongs to a user in the configuration: keys of "mupibox" and whole sections. (A key that is not in the file is not
// written either; the same list reads and writes, so a key of the box that is not listed here never moves.)
const USER_KEYS = [
  'theme',
  'customTheme',
  'themeStage',
  'themeStageDefaultOn',
  'themeStageAutoRead',
  'startVolume',
  'maxVolume',
  'resume',
  'listviewTimer',
  'settingsAccessTimer',
  'hiddenCategories',
  'startCategory',
  'ttsLanguage',
  'onlineCovers',
  'onlineCoversSave',
  'clockStyle',
  'coverflowShowNames',
  'hideScrollbar',
  'scrollbarStyle',
  'episodeResume',
  'newEpisodes',
  'episodeProgress',
  'episodeResumeDays',
  'newEpisodeDays',
  'outputPicker',
  'displayBrightness',
  'nightDim',
]
const USER_SECTIONS = ['playtimeLimit', 'quietHours']
// Files in the data folder of the box (not the library) and the logs
const DATA_FILES = ['hidden-covers.json', 'playtime-checkpoint.json']
const LOG_FILES = ['play_log.jsonl']

const ID = /^[a-z0-9]{2,12}$/
// Every user has a colour; the display shows only that dot in its header (the names are on the page behind it). The first colour
// that nobody has is given to a new user - so there are as many users as colours.
const COLORS = ['#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FF7F00', '#808080']
const MAX_USERS = COLORS.length
const NAME_MAX = 24

const clone = (value) => JSON.parse(JSON.stringify(value))

/** A name as the people see it: one line, trimmed; null when it is not usable. */
function cleanName(raw) {
  const name = String(raw ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return name.length >= 1 && name.length <= NAME_MAX ? name : null
}

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp${process.pid}`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, file)
}

/** The regular .json files in a folder (a link, such as active_data.json or config.json of the library, stays where it is). */
function regularJson(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && !e.isSymbolicLink() && e.name.endsWith('.json'))
      .map((e) => e.name)
  } catch {
    return []
  }
}

/** Copies files of `from` into `to` (the names listed that exist), after removing what `to` has of this kind. */
function copyFiles(from, to, names) {
  fs.mkdirSync(to, { recursive: true })
  for (const name of names) {
    try {
      fs.copyFileSync(path.join(from, name), path.join(to, `${name}.tmp${process.pid}`))
      fs.renameSync(path.join(to, `${name}.tmp${process.pid}`), path.join(to, name))
    } catch {
      // (not there: nothing to copy)
    }
  }
}

/**
 * The store: where the live state lies, where the users' folders lie. `config` reads the live configuration, `updateConfig(mutate)`
 * changes it. Everything here is plain files, so the tests run it in temporary folders.
 */
function createStore({ dataDir, libraryDir, boxDataDir, logsDir, settingsDir, config, updateConfig }) {
  const usersFile = path.join(dataDir, 'users.json')
  const profile = (id) => path.join(dataDir, 'profiles', id)

  /** A user without a (known) colour gets the first one nobody has - also one who was made by the first version of this extension. */
  const coloured = (state) => {
    const used = new Set(state.users.map((u) => u.color).filter((c) => COLORS.includes(c)))
    for (const user of state.users) {
      if (!COLORS.includes(user.color)) {
        user.color = COLORS.find((c) => !used.has(c)) ?? COLORS[0]
        used.add(user.color)
      }
    }
    return state
  }
  const read = () => {
    try {
      const parsed = JSON.parse(fs.readFileSync(usersFile, 'utf8'))
      if (Array.isArray(parsed?.users) && parsed.users.length && parsed.users.some((u) => u.id === parsed.current)) return coloured(parsed)
    } catch {
      // (not there yet, or not readable: the first start)
    }
    return coloured({ current: 'main', users: [{ id: 'main', name: 'Standard' }] })
  }
  const write = (state) => writeAtomic(usersFile, `${JSON.stringify(state, null, 2)}\n`)

  /** The part of the live configuration that belongs to a user. */
  function configPart() {
    const cfg = config() ?? {}
    const part = { mupibox: {} }
    for (const key of USER_KEYS) if (cfg.mupibox && key in cfg.mupibox) part.mupibox[key] = clone(cfg.mupibox[key])
    for (const key of USER_SECTIONS) if (key in cfg) part[key] = clone(cfg[key])
    return part
  }

  const settingFiles = () => {
    try {
      return fs.readdirSync(settingsDir).filter((n) => n.endsWith('.json') && n !== 'users.json')
    } catch {
      return []
    }
  }

  /** Live state -> the folder of a user. */
  function save(id) {
    const dir = profile(id)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    writeAtomic(path.join(dir, 'config.json'), JSON.stringify(configPart()))
    copyFiles(libraryDir, path.join(dir, 'library'), regularJson(libraryDir))
    copyFiles(boxDataDir, path.join(dir, 'data'), DATA_FILES)
    copyFiles(logsDir, path.join(dir, 'logs'), LOG_FILES)
    copyFiles(settingsDir, path.join(dir, 'settings'), settingFiles())
  }

  /** The folder of a user -> live state. What the user does not have is removed from the live state (no leftovers of the one before). */
  async function load(id) {
    const dir = profile(id)
    if (!fs.existsSync(dir)) throw new Error('no such profile')
    const library = path.join(dir, 'library')
    const have = new Set(regularJson(library))
    for (const name of regularJson(libraryDir)) if (!have.has(name)) fs.rmSync(path.join(libraryDir, name), { force: true })
    copyFiles(library, libraryDir, [...have])
    for (const [from, to, names] of [
      [path.join(dir, 'data'), boxDataDir, DATA_FILES],
      [path.join(dir, 'logs'), logsDir, LOG_FILES],
    ]) {
      for (const name of names) {
        if (!fs.existsSync(path.join(from, name))) fs.rmSync(path.join(to, name), { force: true })
      }
      copyFiles(from, to, names)
    }
    const settings = path.join(dir, 'settings')
    const mine = new Set(regularJson(settings))
    for (const name of settingFiles()) if (!mine.has(name)) fs.rmSync(path.join(settingsDir, name), { force: true })
    copyFiles(settings, settingsDir, [...mine])
    let part = { mupibox: {} }
    try {
      part = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'))
    } catch {
      // (a profile without a readable configuration part: everything of it is the box's default)
    }
    await updateConfig((cfg) => {
      cfg.mupibox = cfg.mupibox ?? {}
      for (const key of USER_KEYS) {
        if (part.mupibox && key in part.mupibox) cfg.mupibox[key] = part.mupibox[key]
        else delete cfg.mupibox[key]
      }
      for (const key of USER_SECTIONS) {
        if (key in part) cfg[key] = part[key]
        else delete cfg[key]
      }
    })
  }

  return {
    state: read,
    cleanName,

    /** A new user: the settings of the one who creates it, an empty library. */
    add(rawName) {
      const name = cleanName(rawName)
      if (!name) return { error: 'name' }
      const state = read()
      if (state.users.length >= MAX_USERS) return { error: 'full' }
      if (state.users.some((u) => u.name.toLowerCase() === name.toLowerCase())) return { error: 'exists' }
      let id
      do id = `u${randomBytes(3).toString('hex')}`
      while (state.users.some((u) => u.id === id))
      const dir = profile(id)
      fs.mkdirSync(path.join(dir, 'library'), { recursive: true })
      writeAtomic(path.join(dir, 'config.json'), JSON.stringify(configPart()))
      // (an empty library: lists with nothing in them, the files the box needs to start)
      for (const file of ['data.json', 'offline_data.json', 'resume.json', 'offline_resume.json']) writeAtomic(path.join(dir, 'library', file), '[]\n')
      copyFiles(settingsDir, path.join(dir, 'settings'), settingFiles())
      state.users.push({ id, name, color: COLORS.find((c) => !state.users.some((u) => u.color === c)) })
      write(state)
      return { id }
    },

    /** Gives a user another colour of the palette that nobody else has. */
    setColor(id, color) {
      const state = read()
      const user = state.users.find((u) => u.id === id)
      if (!user) return { error: 'id' }
      if (!COLORS.includes(color)) return { error: 'color' }
      if (state.users.some((u) => u.id !== id && u.color === color)) return { error: 'taken' }
      user.color = color
      write(state)
      return { ok: true }
    },

    /** Deletes a user - not the current one, not the last one. */
    remove(id) {
      const state = read()
      if (!ID.test(String(id))) return { error: 'id' }
      if (!state.users.some((u) => u.id === id)) return { error: 'id' }
      if (id === state.current) return { error: 'current' }
      if (state.users.length < 2) return { error: 'last' }
      state.users = state.users.filter((u) => u.id !== id)
      write(state)
      fs.rmSync(profile(id), { recursive: true, force: true })
      return { ok: true }
    },

    /** Changes to a user: the state of the one who goes is kept, the one who comes is loaded. Does not restart anything. */
    async select(id) {
      const state = read()
      if (!ID.test(String(id)) || !state.users.some((u) => u.id === id)) return { error: 'id' }
      if (id === state.current) return { ok: true, same: true }
      // (the profile of the one who comes is checked before the one who goes is touched)
      if (!fs.existsSync(profile(id))) return { error: 'id' }
      save(state.current)
      await load(id)
      state.current = id
      write(state)
      return { ok: true }
    },

    // for the tests
    _save: save,
    _load: load,
    _profile: profile,
    _configPart: configPart,
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

exports.activate = (host) => {
  const store = createStore({
    dataDir: host.dataDir,
    libraryDir: host.paths.library,
    boxDataDir: host.paths.data,
    logsDir: path.join(host.paths.data, 'logs'),
    settingsDir: path.join(host.paths.extensions, 'settings'),
    config: () => host.config(),
    updateConfig: (mutate) => host.updateConfig(mutate),
  })
  fs.mkdirSync(host.dataDir, { recursive: true })

  // one change at a time; after a change the box restarts, and until then nothing else happens (busy)
  let working = false
  let restarting = false

  const view = () => {
    const s = store.state()
    return { current: s.current, colors: COLORS, users: s.users.map(({ id, name, color }) => ({ id, name, color })), busy: working || restarting }
  }

  const refuse = (res, error) => res.status(error === 'busy' ? 409 : 400).json({ ok: false, error })

  /** The common part of a switch (display and app): the playback stops, the state is exchanged, the box restarts. */
  async function change(id, res) {
    if (working || restarting) return refuse(res, 'busy')
    working = true
    try {
      // (what plays stops first: the player and the app write resume positions while it plays, and they must not land in the new user's library)
      await fetch(`${host.playerUrl}/stop`, { signal: AbortSignal.timeout(3000) }).catch(() => undefined)
      await sleep(1500)
      const result = await store.select(id)
      if (result.error) return refuse(res, result.error)
      if (result.same) return res.json({ ok: true })
      restarting = true
      host.log.info(`[Extension users] switched to ${id}`)
      res.json({ ok: true })
      // (the box applies the settings - theme, volume, devices - and restarts; the restart is the last thing: it ends this process)
      execFile('sudo', ['-n', '/usr/local/bin/mupibox/setting_update.sh'], { timeout: 60000 }, (error) => {
        if (error) host.log.warn(`[Extension users] setting_update.sh: ${error.message}`)
        host.restartServices()
      })
    } catch (error) {
      host.log.warn(`[Extension users] switch failed: ${error}`)
      if (!res.headersSent) res.status(500).json({ ok: false, error: 'failed' })
    } finally {
      working = false
    }
  }

  // the display (no login; only the box's network - and only from the pages of the box, the header below is one a foreign page cannot send)
  host.route('get', '/state', (req, res) => res.json(view()))
  host.route('post', '/switch', async (req, res) => {
    if (!req.get('x-requested-with')) return res.status(403).json({ ok: false })
    if (host.settings().displaySwitch === false) return res.status(403).json({ ok: false, error: 'off' })
    return change(String(req.body?.id ?? ''), res)
  })

  // the app (parents' login)
  host.route('get', '/list', (req, res) => res.json(view()), { session: true })
  host.route(
    'post',
    '/add',
    (req, res) => {
      if (working || restarting) return refuse(res, 'busy')
      const result = store.add(req.body?.name)
      return result.error ? refuse(res, result.error) : res.json({ ok: true, id: result.id })
    },
    { session: true },
  )
  host.route(
    'post',
    '/remove',
    (req, res) => {
      if (working || restarting) return refuse(res, 'busy')
      const result = store.remove(String(req.body?.id ?? ''))
      return result.error ? refuse(res, result.error) : res.json({ ok: true })
    },
    { session: true },
  )
  host.route(
    'post',
    '/color',
    (req, res) => {
      const result = store.setColor(String(req.body?.id ?? ''), String(req.body?.color ?? ''))
      return result.error ? refuse(res, result.error) : res.json({ ok: true })
    },
    { session: true },
  )
  host.route('post', '/select', (req, res) => change(String(req.body?.id ?? ''), res), { session: true })
}

exports._test = { createStore, cleanName, USER_KEYS, USER_SECTIONS, COLORS }
