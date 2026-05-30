// Phase 14c + 15a — Eltern-WebApp client.
// Vanilla ES2020. No framework dependency keeps the bundle small and
// boots fast on flaky LAN.
//
// Phase 15a turned the single-screen Smart-Sync dashboard into a hub
// with 9 sections (sync, library, caps, power, wlan, bluetooth,
// telegram, system, plus the wizard/settings sub-screens of sync).
// Navigation is hash-based so browser-back works and links from the
// Telegram bot can deep-link straight to a section.

const API = '/api/eltern'
const SYNC_API = '/api/spotify-sync'

/* ---------- helpers ---------- */

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

const state = {
  csrf: null,
  passwordConfigured: false,
  wizardStep: Number(sessionStorage.getItem('wizard.step') ?? 1),
  spotifyError: new URLSearchParams(location.search).get('spotify_error'),
  spotifyConnected: new URLSearchParams(location.search).get('spotify_connected') === '1',
  currentSection: null, // set by router; not by ad-hoc showScreen calls
}

/* ---------- routing (Phase 15a) ---------- */

// Map of section -> { title, parent (for back), loader }.
// Parent === null means top-level (back button hidden, "←" goes to hub).
// loader is called whenever the section becomes active so live data
// fetches happen only for the visible section.
const SECTIONS = {
  hub:       { title: '🎵 MuPiBox',          parent: null, loader: () => loadHub() },
  sync:      { title: 'Smart-Sync',          parent: 'hub', loader: () => loadSync() },
  settings:  { title: 'Smart-Sync · Optionen', parent: 'sync', loader: () => loadSettings() },
  wizard:    { title: 'Spotify-Setup',       parent: 'sync', loader: () => loadWizard() },
  library:   { title: 'Library',             parent: 'hub', loader: () => { loadLibrary(); loadSubscriptions(); loadSyncStatus() } },
  search:    { title: 'Spotify-Suche',       parent: 'library', loader: () => resetSearch() },
  caps:      { title: 'Spielzeit & Ruhe',    parent: 'hub', loader: () => loadCaps() },
  power:     { title: 'Akku',                parent: 'hub', loader: () => loadPower() },
  wlan:      { title: 'WLAN',                parent: 'hub', loader: () => loadWlan() },
  bluetooth: { title: 'Bluetooth',           parent: 'hub', loader: () => loadBluetooth() },
  telegram:  { title: 'Telegram',            parent: 'hub', loader: () => loadTelegram() },
  system:    { title: 'System',              parent: 'hub', loader: () => loadSystem() },
}

/** Switch to a screen — hides all .screen sections, shows the requested
 *  one, updates the header (title + back-button visibility), and calls
 *  the section's loader. Top-level screens (loading, no-session) bypass
 *  the title-rewrite to preserve their dedicated headers. */
function showScreen(id) {
  for (const s of $$('.screen')) s.hidden = true
  const target = $(`#screen-${id}`)
  if (!target) return
  target.hidden = false

  // Loading / no-session don't have a logical section parent — keep the
  // header in brand-only mode.
  if (id === 'loading' || id === 'no-session') {
    $('#header-back-btn').hidden = true
    $('#header-title').textContent = '🎵 MuPiBox'
    return
  }

  const meta = SECTIONS[id]
  if (meta) {
    $('#header-title').textContent = meta.title
    $('#header-back-btn').hidden = meta.parent === null
    state.currentSection = id
  }
  // Window scrolls to top whenever section changes — feels more like
  // a native app than a single-page-scroll.
  window.scrollTo(0, 0)
}

/** Read the current hash, default to 'hub' for empty/no-fragment. Returns
 *  the section id (without leading '#'). */
function routeFromHash() {
  const hash = (location.hash || '#hub').replace(/^#/, '')
  // Defence: unknown hash → hub. Prevents typos / stale bookmarks from
  // blanking the page.
  return SECTIONS[hash] ? hash : 'hub'
}

/** Programmatic navigation: pushes a new hash, lets hashchange + onRoute
 *  do the actual screen-swap. */
function navigate(section) {
  if (location.hash.replace(/^#/, '') === section) {
    // Already on it — still trigger the loader so reload works.
    onRoute()
    return
  }
  location.hash = `#${section}`
}

/** hashchange + initial-route handler. */
function onRoute() {
  // Only route after the session bootstrap finished — otherwise hashchange
  // fires before we know whether to show no-session or the hub.
  if (state.csrf === null) return
  const section = routeFromHash()
  showScreen(section)
  const meta = SECTIONS[section]
  if (meta?.loader) {
    try { meta.loader() } catch (err) { console.error('section loader threw:', err) }
  }
}

async function api(path, opts = {}) {
  const init = {
    method: opts.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(state.csrf && opts.method && opts.method !== 'GET' ? { 'x-mupibox-csrf': state.csrf } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }
  const res = await fetch(path, init)
  let payload = null
  try { payload = await res.json() } catch {}
  return { status: res.status, ok: res.ok, body: payload }
}

function setText(sel, text) {
  const el = $(sel)
  if (el) el.textContent = text
}

function feedback(sel, kind, text) {
  const el = $(sel)
  if (!el) return
  el.hidden = false
  el.className = `feedback ${kind}`
  el.textContent = text
}

function formatRelative(isoString) {
  if (!isoString) return '—'
  const then = Date.parse(isoString)
  if (Number.isNaN(then)) return '—'
  const diffMs = Date.now() - then
  if (diffMs < 0) return 'gleich'
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return `vor ${sec} s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `vor ${min} Min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `vor ${hr} Std`
  return `vor ${Math.floor(hr / 24)} Tagen`
}

function formatRelativeFuture(isoString) {
  if (!isoString) return '—'
  const then = Date.parse(isoString)
  if (Number.isNaN(then)) return '—'
  const diffMs = then - Date.now()
  if (diffMs < 0) return 'jetzt fällig'
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return `in ${sec} s`
  const min = Math.floor(sec / 60)
  return `in ${min} Min`
}

/* ---------- screen: library (Phase 15e) ---------- */

const libraryState = {
  items: [],              // raw library (active_data.json)
  categoryFilter: 'all',  // 'all' | 'audiobook' | 'music' | 'other'
  sourceFilter: 'all',    // 'all' | 'manual' | 'spotify-sync'
  search: '',
}

async function loadLibrary() {
  try {
    const res = await fetch('/api/data', { credentials: 'same-origin' })
    if (!res.ok) {
      $('#library-list').innerHTML = `<div class="dim" style="padding:24px;text-align:center;">Laden fehlgeschlagen (${res.status})</div>`
      return
    }
    libraryState.items = await res.json()
    if (!Array.isArray(libraryState.items)) libraryState.items = []
    renderLibrary()
  } catch (err) {
    $('#library-list').innerHTML = `<div class="dim" style="padding:24px;text-align:center;">Fehler: ${escapeHtml(err.message)}</div>`
  }
}

function renderLibrary() {
  const list = $('#library-list')
  // Filter pipeline
  const q = libraryState.search.trim().toLowerCase()
  let filtered = libraryState.items.filter((m) => {
    // Skip resume entries — they're internal, not parent-managed.
    if (m.isResume === true || m.category === 'resume') return false
    if (libraryState.categoryFilter !== 'all' && m.category !== libraryState.categoryFilter) return false
    const source = m.source ?? 'manual'
    if (libraryState.sourceFilter !== 'all' && source !== libraryState.sourceFilter) return false
    if (q) {
      const a = (m.artist_override ?? m.artist ?? '').toLowerCase()
      const t = (m.title_override ?? m.title ?? '').toLowerCase()
      if (!a.includes(q) && !t.includes(q)) return false
    }
    return true
  })

  setText('#library-count', `${filtered.length} Inhalt${filtered.length === 1 ? '' : 'e'}`)

  if (filtered.length === 0) {
    list.innerHTML = '<div class="dim" style="padding:24px;text-align:center;">Keine Inhalte für diese Filter.</div>'
    return
  }

  list.innerHTML = ''
  for (const item of filtered) {
    const el = document.createElement('div')
    el.className = 'library-item'
    el.addEventListener('click', () => openLibraryEditSheet(item))

    const cover = document.createElement('img')
    cover.className = 'library-item-cover'
    cover.loading = 'lazy'
    cover.alt = ''
    const src = item.cover_override ?? item.cover ?? item.artistcover_override ?? item.artistcover ?? ''
    if (src) cover.src = src

    const meta = document.createElement('div')
    meta.className = 'library-item-meta'
    const title = document.createElement('div')
    title.className = 'library-item-title'
    title.textContent = item.title_override ?? item.title ?? item.artist_override ?? item.artist ?? '(unbenannt)'
    const sub = document.createElement('div')
    sub.className = 'library-item-sub'
    sub.textContent = item.artist_override ?? item.artist ?? item.type ?? ''
    meta.append(title, sub)

    const badges = document.createElement('div')
    badges.className = 'library-item-badges'
    const cat = item.category_override ?? item.category
    if (cat) {
      const b = document.createElement('span')
      b.className = `library-item-badge ${cat === 'audiobook' ? 'audiobook' : ''}`
      b.textContent = cat === 'audiobook' ? 'Hörbuch' : cat === 'music' ? 'Musik' : 'Sonst.'
      badges.appendChild(b)
    }
    if ((item.source ?? 'manual') === 'spotify-sync') {
      const b = document.createElement('span')
      b.className = 'library-item-badge sync'
      b.textContent = '🔗 Sync'
      badges.appendChild(b)
    }

    el.append(cover, meta, badges)
    list.appendChild(el)
  }
}

function openLibraryEditSheet(item) {
  const isSync = (item.source ?? 'manual') === 'spotify-sync'
  const body = $('#library-edit-body')
  setText('#library-edit-title', item.title_override ?? item.title ?? item.artist_override ?? item.artist ?? 'Bearbeiten')
  body.innerHTML = ''

  const note = document.createElement('p')
  note.className = 'dim'
  note.textContent = isSync
    ? '🔗 Sync-verwaltet. IDs gelockt — nur Overrides änderbar. Diese Werte bleiben über Sync-Läufe stabil.'
    : '✏️ Manueller Eintrag. Alle Felder editierbar.'
  body.appendChild(note)

  const fields = [
    { key: 'artist_override', fallback: 'artist', label: 'Künstler', isOverride: true },
    { key: 'title_override', fallback: 'title', label: 'Titel', isOverride: true },
    { key: 'cover_override', fallback: 'cover', label: 'Cover-URL', isOverride: true },
    { key: 'artistcover_override', fallback: 'artistcover', label: 'Künstler-Cover-URL', isOverride: true },
  ]
  const inputs = {}
  for (const f of fields) {
    const row = document.createElement('div')
    row.className = 'form-row'
    const lab = document.createElement('label')
    lab.textContent = f.label + (f.isOverride && isSync ? ' (Override)' : '')
    lab.setAttribute('for', `library-edit-${f.key}`)
    const inp = document.createElement('input')
    inp.type = 'text'
    inp.id = `library-edit-${f.key}`
    inp.value = item[f.key] ?? (isSync ? '' : item[f.fallback] ?? '')
    if (isSync && f.isOverride) {
      inp.placeholder = `Sync-Wert: ${item[f.fallback] ?? '—'}`
    }
    row.append(lab, inp)
    body.appendChild(row)
    inputs[f.key] = inp
  }

  // Category override
  const catRow = document.createElement('div')
  catRow.className = 'form-row'
  const catLab = document.createElement('label')
  catLab.textContent = 'Kategorie' + (isSync ? ' (Override)' : '')
  const catSel = document.createElement('select')
  catSel.id = 'library-edit-category'
  for (const opt of [
    { v: '', l: '(Sync-Default)' },
    { v: 'audiobook', l: 'Hörbuch/Hörspiel' },
    { v: 'music', l: 'Musik' },
    { v: 'other', l: 'Sonstiges' },
  ]) {
    const o = document.createElement('option')
    o.value = opt.v
    o.textContent = opt.l
    if ((item.category_override ?? (isSync ? '' : item.category)) === opt.v) o.selected = true
    catSel.appendChild(o)
  }
  catRow.append(catLab, catSel)
  body.appendChild(catRow)

  // Actions
  const actions = document.createElement('div')
  actions.className = 'actions'
  const saveBtn = document.createElement('button')
  saveBtn.className = 'primary'
  saveBtn.textContent = 'Speichern'
  saveBtn.addEventListener('click', async () => {
    // Build full media body so /api/edit receives a complete entry. Only
    // change override fields (and base fields if !isSync).
    const updated = { ...item }
    for (const f of fields) {
      const v = inputs[f.key].value.trim()
      if (isSync) {
        // Override path only.
        if (v) updated[f.key] = v
        else delete updated[f.key]
      } else {
        // Manual: write straight to the base field, ignore overrides.
        if (v) updated[f.fallback] = v
        else delete updated[f.fallback]
      }
    }
    const catVal = catSel.value
    if (isSync) {
      if (catVal) updated.category_override = catVal
      else delete updated.category_override
    } else if (catVal) {
      updated.category = catVal
    }
    const res = await fetch('/api/edit', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: item.index, ...updated }),
    })
    if (res.ok) {
      closeLibraryEditSheet()
      await loadLibrary()
    } else {
      alert(`Speichern fehlgeschlagen (${res.status}).`)
    }
  })
  actions.appendChild(saveBtn)
  if (!isSync) {
    const delBtn = document.createElement('button')
    delBtn.className = 'danger'
    delBtn.textContent = 'Löschen'
    delBtn.addEventListener('click', async () => {
      if (!confirm(`„${updated_or_label(item)}" wirklich löschen?`)) return
      const res = await fetch('/api/delete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: item.index }),
      })
      if (res.ok) {
        closeLibraryEditSheet()
        await loadLibrary()
      } else {
        alert(`Löschen fehlgeschlagen (${res.status}).`)
      }
    })
    actions.appendChild(delBtn)
  } else {
    const hint = document.createElement('p')
    hint.className = 'dim'
    hint.style.marginTop = '12px'
    hint.textContent = 'Löschen geht bei Sync-Items nur über Spotify (Item aus LeniBox-Playlist entfernen). Beim nächsten Sync verschwindet es von der Box.'
    body.appendChild(hint)
  }
  body.appendChild(actions)

  $('#library-edit-backdrop').hidden = false
}

function updated_or_label(item) {
  return item.title_override ?? item.title ?? item.artist_override ?? item.artist ?? 'dieses Item'
}

function closeLibraryEditSheet() {
  $('#library-edit-backdrop').hidden = true
}

function openLibraryAddSheet() {
  // Reset form
  $('#library-add-url').value = ''
  $('#library-add-label').value = ''
  $('#library-add-title').value = ''
  $('#library-add-category').value = 'audiobook'
  $('#library-add-type').value = 'spotifyURL'
  onAddTypeChange()
  $('#library-add-feedback').hidden = true
  $('#library-add-backdrop').hidden = false
}
function closeLibraryAddSheet() { $('#library-add-backdrop').hidden = true }

function onAddTypeChange() {
  const type = $('#library-add-type').value
  $('#library-add-label-row').hidden = (type === 'spotifyURL')
  $('#library-add-title-row').hidden = (type !== 'streamURL')
  // Category defaults nach Type
  if (type === 'streamURL') $('#library-add-category').value = 'other'
  else if (type === 'rssURL') $('#library-add-category').value = 'other'
  else $('#library-add-category').value = 'audiobook'
}

function spotifyIdFromUrl(url, keyword) {
  const ki = url.indexOf(keyword)
  if (ki < 0) return null
  const qi = url.indexOf('?', ki)
  return qi < 0 ? url.slice(ki + keyword.length) : url.substring(ki + keyword.length, qi)
}

async function submitLibraryAdd() {
  const type = $('#library-add-type').value
  const url = $('#library-add-url').value.trim()
  const label = $('#library-add-label').value.trim()
  const title = $('#library-add-title').value.trim()
  const category = $('#library-add-category').value
  if (!url) {
    feedback('#library-add-feedback', 'error', 'URL ist Pflicht.')
    return
  }
  const body = { type: '', category, source: 'manual' }
  if (type === 'spotifyURL') {
    if (!url.startsWith('https://open.spotify.com/')) {
      feedback('#library-add-feedback', 'error', 'Spotify-Link muss mit https://open.spotify.com/ beginnen.')
      return
    }
    body.type = 'spotify'
    body.spotify_url = url
    if (url.includes('playlist/')) body.playlistid = spotifyIdFromUrl(url, 'playlist/')
    else if (url.includes('artist/')) body.artistid = spotifyIdFromUrl(url, 'artist/')
    else if (url.includes('album/')) body.id = spotifyIdFromUrl(url, 'album/')
    else if (url.includes('show/')) body.showid = spotifyIdFromUrl(url, 'show/')
    else if (url.includes('audiobook/')) body.audiobookid = spotifyIdFromUrl(url, 'audiobook/')
    else {
      feedback('#library-add-feedback', 'error', 'Unbekannter Spotify-Link-Typ. Erlaubt: playlist/, artist/, album/, show/, audiobook/.')
      return
    }
    if (label) body.artist = label
  } else if (type === 'streamURL') {
    body.type = 'radio'
    body.id = url.startsWith('https://') ? url.replace('https://', 'http://') : url
    body.artist = label || 'Radio'
    body.title = title || 'Stream'
  } else if (type === 'rssURL') {
    body.type = 'rss'
    body.id = url.startsWith('https://') ? url.replace('https://', 'http://') : url
    body.artist = label || 'Podcast'
  }
  const res = await fetch('/api/add', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.ok) {
    feedback('#library-add-feedback', 'success', 'Hinzugefügt. Box-Library aktualisiert sich.')
    setTimeout(async () => {
      closeLibraryAddSheet()
      await loadLibrary()
    }, 600)
  } else {
    feedback('#library-add-feedback', 'error', `Fehler ${res.status}`)
  }
}

/* ---------- screen: caps (Phase 15h — Spielzeit & Ruhe) ---------- */

const DAYS = [
  { key: 'mon', label: 'Mo' },
  { key: 'tue', label: 'Di' },
  { key: 'wed', label: 'Mi' },
  { key: 'thu', label: 'Do' },
  { key: 'fri', label: 'Fr' },
  { key: 'sat', label: 'Sa' },
  { key: 'sun', label: 'So' },
]

// In-memory caps state — built from /api/eltern/caps-config, mutated by
// the form, sent back on Save. Keeps a clean separation between live
// status (re-fetched each render) and config (only re-fetched on entry).
let capsConfig = null

async function loadCaps() {
  await Promise.all([loadCapsStatus(), loadCapsConfig(), loadSleepTimer()])
}

/** Translate the player's raw state token to friendly German for the badge. */
function capsStateText(state, kind) {
  if (state === 'normal') return 'Normal'
  if (state === 'grace') return kind === 'quiet' ? 'Karenz' : 'Karenz (überzogen)'
  if (state === 'blocked') return kind === 'quiet' ? '🌙 Gesperrt' : '⏸ Gesperrt'
  return '—'
}

async function loadCapsStatus() {
  try {
    const res = await fetch('/api/playtime', { credentials: 'same-origin' })
    if (!res.ok) return
    const body = await res.json().catch(() => ({}))
    // /api/playtime shape (player-side): {enabled, state, playtime:{enabled,state,
    //   usedSeconds, remainingSeconds, limitMinutes, ...}, quiet:{enabled, state,
    //   inWindow, label?, ...}, override:{...}}. WebApp was reading non-existent
    //   keys (usedMinutes, remainingMinutes, body.quietHours.*) — fixed in 17j.
    const pt = body?.playtime ?? {}
    const qh = body?.quiet ?? {}

    setText('#caps-playtime-enabled', pt.enabled ? '✓ Aktiv' : '✗ Aus')
    if (pt.enabled) {
      const usedMin = Number.isFinite(pt.usedSeconds) ? Math.floor(pt.usedSeconds / 60) : null
      const remMin = Number.isFinite(pt.remainingSeconds) ? Math.floor(pt.remainingSeconds / 60) : null
      const limit = Number.isFinite(pt.limitMinutes) ? pt.limitMinutes : null
      setText('#caps-today-used', usedMin != null && limit != null ? `${usedMin} / ${limit} Min` : usedMin != null ? `${usedMin} Min` : '—')
      setText('#caps-today-remaining', remMin != null ? `${remMin} Min` : '—')
      setText('#caps-state', capsStateText(pt.state, 'playtime'))
    } else {
      setText('#caps-today-used', '—')
      setText('#caps-today-remaining', '—')
      setText('#caps-state', '—')
    }

    if (qh.enabled) {
      const label = qh.label ? ` (${qh.label})` : ''
      const inWin = qh.inWindow ? ' · im Fenster' : ''
      setText('#caps-quiet-state', `${capsStateText(qh.state, 'quiet')}${label}${inWin && qh.state === 'normal' ? '' : inWin}`)
    } else {
      setText('#caps-quiet-state', '✗ Aus')
    }
  } catch { /* swallow */ }
}

async function loadCapsConfig() {
  const res = await api(`${API}/caps-config`)
  if (!res.ok) {
    feedback('#caps-config-feedback', 'error', `Konfig laden fehlgeschlagen: ${res.status}`)
    return
  }
  capsConfig = res.body ?? {}
  renderCapsDayGrid()
  renderQuietSchedule()
  $('#caps-playtime-toggle').checked = !!capsConfig.playtimeLimit?.enabled
  $('#caps-quiet-toggle').checked = !!capsConfig.quietHours?.enabled
  setText('#caps-overrun-info', `${capsConfig.playtimeLimit?.maxOverrunMinutes ?? 10}`)
}

function renderCapsDayGrid() {
  const grid = $('#caps-day-grid')
  grid.innerHTML = ''
  const limits = capsConfig?.playtimeLimit?.limitsMinutes ?? {}
  for (const { key, label } of DAYS) {
    const cell = document.createElement('div')
    cell.className = 'day-cell'
    const lab = document.createElement('label')
    lab.textContent = label
    lab.setAttribute('for', `caps-limit-${key}`)
    const inp = document.createElement('input')
    inp.type = 'number'
    inp.id = `caps-limit-${key}`
    inp.dataset.day = key
    inp.min = '0'
    inp.max = '1440'
    inp.step = '5'
    inp.value = limits[key] ?? 60
    inp.addEventListener('input', () => {
      const v = Math.max(0, Math.min(1440, Math.floor(Number(inp.value) || 0)))
      if (!capsConfig.playtimeLimit.limitsMinutes) capsConfig.playtimeLimit.limitsMinutes = {}
      capsConfig.playtimeLimit.limitsMinutes[key] = v
    })
    cell.append(lab, inp)
    grid.appendChild(cell)
  }
}

function renderQuietSchedule() {
  const root = $('#caps-quiet-schedule')
  root.innerHTML = ''
  const schedule = capsConfig?.quietHours?.schedule ?? {}
  for (const { key, label } of DAYS) {
    const windows = schedule[key] ?? []
    const dayEl = document.createElement('div')
    dayEl.className = 'quiet-day'
    const header = document.createElement('div')
    header.className = 'quiet-day-header'
    const labelSpan = document.createElement('span')
    labelSpan.className = 'quiet-day-label'
    labelSpan.textContent = label
    const addBtn = document.createElement('button')
    addBtn.className = 'quiet-add-btn'
    addBtn.textContent = '+ Fenster'
    addBtn.addEventListener('click', () => {
      if (!capsConfig.quietHours.schedule) capsConfig.quietHours.schedule = {}
      const list = capsConfig.quietHours.schedule[key] ?? []
      // {from,to,label?} — matches the player (spotify-control.js) and Admin
      // (mupi.php). The earlier {start,end} was a WebApp-only shape mismatch
      // that the player couldn't read (fixed in 17j).
      list.push({ from: '20:00', to: '07:00', label: 'Schlafenszeit' })
      capsConfig.quietHours.schedule[key] = list
      renderQuietSchedule()
    })
    header.append(labelSpan, addBtn)
    dayEl.appendChild(header)
    windows.forEach((w, idx) => {
      const row = document.createElement('div')
      row.className = 'quiet-window'
      const from = document.createElement('input')
      from.type = 'time'
      from.value = w.from ?? '20:00'
      from.addEventListener('change', () => { capsConfig.quietHours.schedule[key][idx].from = from.value })
      const arrow = document.createElement('span')
      arrow.className = 'arrow'
      arrow.textContent = '→'
      const to = document.createElement('input')
      to.type = 'time'
      to.value = w.to ?? '07:00'
      to.addEventListener('change', () => { capsConfig.quietHours.schedule[key][idx].to = to.value })
      const labelInp = document.createElement('input')
      labelInp.type = 'text'
      labelInp.className = 'quiet-window-label'
      labelInp.placeholder = 'Label (optional)'
      labelInp.value = w.label ?? ''
      labelInp.addEventListener('input', () => {
        const v = labelInp.value.trim()
        if (v) capsConfig.quietHours.schedule[key][idx].label = v
        else delete capsConfig.quietHours.schedule[key][idx].label
      })
      const rm = document.createElement('button')
      rm.className = 'remove'
      rm.textContent = '×'
      rm.addEventListener('click', () => {
        capsConfig.quietHours.schedule[key].splice(idx, 1)
        renderQuietSchedule()
      })
      row.append(from, arrow, to, labelInp, rm)
      dayEl.appendChild(row)
    })
    root.appendChild(dayEl)
  }
}

async function saveCapsConfig() {
  if (!capsConfig) return
  // Pull current toggle values into the in-memory config before send.
  capsConfig.playtimeLimit.enabled = $('#caps-playtime-toggle').checked
  capsConfig.quietHours.enabled = $('#caps-quiet-toggle').checked
  const res = await api(`${API}/caps-config`, {
    method: 'POST',
    body: {
      playtimeLimit: {
        enabled: capsConfig.playtimeLimit.enabled,
        maxOverrunMinutes: capsConfig.playtimeLimit.maxOverrunMinutes,
        limitsMinutes: capsConfig.playtimeLimit.limitsMinutes,
      },
      quietHours: {
        enabled: capsConfig.quietHours.enabled,
        maxOverrunMinutes: capsConfig.quietHours.maxOverrunMinutes,
        schedule: capsConfig.quietHours.schedule,
      },
    },
  })
  if (res.ok) {
    feedback('#caps-config-feedback', 'success', 'Gespeichert. Greift sofort.')
    loadCapsStatus()
  } else {
    feedback('#caps-config-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
  }
}

function getCapsOverrideMinutes() {
  const v = Number($('#caps-override-minutes').value)
  if (!Number.isFinite(v) || v < 1 || v > 1440) {
    feedback('#caps-action-feedback', 'error', 'Minuten muss zwischen 1 und 1440 liegen.')
    return null
  }
  return v
}

async function capsExtend() {
  const mins = getCapsOverrideMinutes()
  if (mins === null) return
  const res = await fetch('/api/playtime/extend', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minutes: mins }),
  })
  if (res.ok) {
    feedback('#caps-action-feedback', 'success', `+${mins} Min Bonus hinzugefügt.`)
    loadCapsStatus()
  } else {
    feedback('#caps-action-feedback', 'error', `Fehler ${res.status}`)
  }
}

async function capsRelease() {
  const mins = getCapsOverrideMinutes()
  if (mins === null) return
  const res = await fetch('/api/playtime/release', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minutes: mins }),
  })
  if (res.ok) {
    feedback('#caps-action-feedback', 'success', `Override für ${mins} Min aktiv.`)
    loadCapsStatus()
  } else {
    feedback('#caps-action-feedback', 'error', `Fehler ${res.status}`)
  }
}

async function capsQuietNow() {
  const mins = getCapsOverrideMinutes()
  if (mins === null) return
  const res = await fetch('/api/quiethours/now', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minutes: mins }),
  })
  if (res.ok) {
    feedback('#caps-action-feedback', 'success', `Sofort-Stopp für ${mins} Min aktiviert.`)
    loadCapsStatus()
  } else {
    feedback('#caps-action-feedback', 'error', `Fehler ${res.status}`)
  }
}

/* ---------- screen: search (Phase 17a) ---------- */

const searchState = { type: 'all' }

function pickSearchImg(images) {
  if (!Array.isArray(images) || !images.length) return ''
  return images[1]?.url || images[0]?.url || ''
}

function searchResultRow(thumb, title, subtitle, actionEl) {
  const row = document.createElement('div')
  row.className = 'search-result-row'
  const img = document.createElement('img')
  img.className = 'search-thumb'
  img.loading = 'lazy'
  img.alt = ''
  if (thumb) img.src = thumb
  const info = document.createElement('div')
  info.className = 'search-result-info'
  const t = document.createElement('span')
  t.className = 'value'
  t.textContent = title
  const s = document.createElement('span')
  s.className = 'dim'
  s.textContent = subtitle
  info.append(t, s)
  row.append(img, info)
  if (actionEl) row.append(actionEl)
  return row
}

/** "+" button that pins an album (Phase 17b). Artist-add comes in 17c. */
function makeAddAlbumBtn(albumId, name) {
  const b = document.createElement('button')
  b.className = 'ghost search-add-btn'
  b.textContent = '+'
  b.title = 'Zur Box hinzufügen'
  b.addEventListener('click', () => addAlbumFromSearch(albumId, name, b))
  return b
}

async function addAlbumFromSearch(albumId, name, btn) {
  const category = $('#search-add-category')?.value || 'audiobook'
  if (btn) {
    btn.disabled = true
    btn.textContent = '…'
  }
  const res = await api(`${API}/library/add-album`, { method: 'POST', body: { albumId, category, name } })
  if (!res.ok) {
    feedback('#search-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
    if (btn) {
      btn.disabled = false
      btn.textContent = '+'
    }
    return
  }
  const sync = await fireSyncTrigger()
  if (btn) {
    btn.textContent = '✓'
    btn.classList.add('added')
  }
  feedback('#search-feedback', sync.kind, `„${name}" hinzugefügt — ${sync.text}`)
}

function renderSearchResults(data) {
  const wrap = $('#search-results')
  if (!wrap) return
  wrap.innerHTML = ''
  const artistNames = (arr) => (arr || []).map((x) => x?.name).filter(Boolean).join(', ')
  const groups = [
    [
      'Künstler',
      (data.artists || []).map((a) =>
        searchResultRow(pickSearchImg(a.images), a.name, 'Künstler', a.id ? makeSubscribeArtistBtn(a.id, a.name) : undefined),
      ),
    ],
    [
      'Alben',
      (data.albums || []).map((a) =>
        searchResultRow(pickSearchImg(a.images), a.name, artistNames(a.artists), a.id ? makeAddAlbumBtn(a.id, a.name) : undefined),
      ),
    ],
    [
      'Titel',
      (data.tracks || []).map((t) =>
        searchResultRow(
          pickSearchImg(t.album?.images),
          t.name,
          `${artistNames(t.artists)} · ${t.album?.name ?? ''}`,
          t.album?.id ? makeAddAlbumBtn(t.album.id, t.album?.name ?? t.name) : undefined,
        ),
      ),
    ],
  ]
  let any = false
  for (const [label, rows] of groups) {
    if (!rows.length) continue
    any = true
    const card = document.createElement('div')
    card.className = 'card'
    const h = document.createElement('h3')
    h.textContent = label
    card.appendChild(h)
    for (const r of rows) card.appendChild(r)
    wrap.appendChild(card)
  }
  if (!any) {
    const c = document.createElement('div')
    c.className = 'card'
    const p = document.createElement('p')
    p.className = 'dim'
    p.textContent = 'Keine Treffer.'
    c.appendChild(p)
    wrap.appendChild(c)
  }
}

async function doSearch() {
  const q = ($('#search-query')?.value ?? '').trim()
  if (q.length < 2) {
    feedback('#search-feedback', 'error', 'Mindestens 2 Zeichen eingeben.')
    return
  }
  const types = searchState.type === 'all' ? 'artist,album,track' : searchState.type
  feedback('#search-feedback', 'success', 'Suche …')
  const res = await api(`/api/spotify/search?q=${encodeURIComponent(q)}&types=${types}&limit=8`)
  if (!res.ok) {
    feedback('#search-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
    return
  }
  const fb = $('#search-feedback')
  if (fb) fb.hidden = true
  renderSearchResults(res.body ?? {})
}

/** "+" button that subscribes to a whole artist (Phase 17c). */
function makeSubscribeArtistBtn(artistId, name) {
  const b = document.createElement('button')
  b.className = 'ghost search-add-btn'
  b.textContent = '+'
  b.title = 'Ganzen Künstler abonnieren'
  b.addEventListener('click', () => subscribeArtistFromSearch(artistId, name, b))
  return b
}

async function subscribeArtistFromSearch(artistId, name, btn) {
  const category = $('#search-add-category')?.value || 'audiobook'
  if (!confirm(`Alle Alben von „${name}" abonnieren? Bereich (Folge von–bis) und einzelne Alben kannst du danach in der Bibliothek unter „Verwaltete Inhalte" anpassen.`)) {
    return
  }
  if (btn) {
    btn.disabled = true
    btn.textContent = '…'
  }
  const res = await api(`${API}/library/subscribe-artist`, { method: 'POST', body: { artistId, name, category } })
  if (!res.ok) {
    feedback('#search-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
    if (btn) {
      btn.disabled = false
      btn.textContent = '+'
    }
    return
  }
  const sync = await fireSyncTrigger()
  if (btn) {
    btn.textContent = '✓'
    btn.classList.add('added')
  }
  feedback('#search-feedback', sync.kind, `„${name}" abonniert — ${sync.text}. Bereich/Ausschließen in der Bibliothek unter „Verwaltete Inhalte".`)
  loadSubscriptions()
}

/** Clear stale search results when (re-)entering the search screen. The
 *  managed-content list now lives in the Library, not here. */
function resetSearch() {
  const wrap = $('#search-results')
  if (wrap) wrap.innerHTML = ''
  const fb = $('#search-feedback')
  if (fb) fb.hidden = true
}

/* ---------- managed content (Phase 17d) ---------- */

async function loadSubscriptions() {
  const res = await api(`${API}/library/subscriptions`)
  if (!res.ok) return
  renderSubscriptions(res.body ?? {})
}

function renderSubscriptions(data) {
  const wrap = $('#managed-list')
  if (!wrap) return
  wrap.innerHTML = ''
  const artists = data.artists ?? []
  const albums = data.explicit_albums ?? []
  if (!artists.length && !albums.length) {
    const p = document.createElement('p')
    p.className = 'dim'
    p.textContent = 'Noch nichts über die Suche hinzugefügt.'
    wrap.appendChild(p)
    return
  }
  for (const a of artists) {
    const row = document.createElement('div')
    row.className = 'managed-row'
    const head = document.createElement('div')
    head.className = 'managed-head'
    const nm = document.createElement('span')
    nm.className = 'value'
    nm.textContent = `🎤 ${a.name || a.id}`
    const manage = document.createElement('button')
    manage.className = 'ghost'
    manage.textContent = 'Alben verwalten'
    manage.addEventListener('click', () => toggleArtistAlbums(a, row, manage))
    const rm = document.createElement('button')
    rm.className = 'ghost'
    rm.textContent = 'Entfernen'
    rm.addEventListener('click', () => unsubscribeArtist(a.id, a.name || a.id))
    const btns = document.createElement('div')
    btns.className = 'managed-btns'
    btns.append(manage, rm)
    head.append(nm, btns)
    const range = document.createElement('div')
    range.className = 'managed-range'
    const lbl = document.createElement('span')
    lbl.className = 'dim'
    lbl.textContent = 'Folgen'
    const from = document.createElement('input')
    from.type = 'number'
    from.min = '1'
    from.placeholder = 'von'
    from.value = a.range_from ?? ''
    const sep = document.createElement('span')
    sep.className = 'dim'
    sep.textContent = '–'
    const to = document.createElement('input')
    to.type = 'number'
    to.min = '1'
    to.placeholder = 'bis'
    to.value = a.range_to ?? ''
    const apply = document.createElement('button')
    apply.className = 'ghost'
    apply.textContent = 'Übernehmen'
    apply.addEventListener('click', () => applyArtistRange(a, from.value, to.value, apply))
    range.append(lbl, from, sep, to, apply)
    row.append(head, range)
    wrap.appendChild(row)
  }
  for (const al of albums) {
    const row = document.createElement('div')
    row.className = 'managed-row'
    const head = document.createElement('div')
    head.className = 'managed-head'
    const nm = document.createElement('span')
    nm.className = 'value'
    nm.textContent = `💿 ${al.name || al.id}`
    const rm = document.createElement('button')
    rm.className = 'ghost'
    rm.textContent = 'Entfernen'
    rm.addEventListener('click', () => removeAlbum(al.id, al.name || al.id))
    head.append(nm, rm)
    row.append(head)
    wrap.appendChild(row)
  }
}

async function unsubscribeArtist(artistId, name) {
  if (!confirm(`„${name}" und alle zugehörigen Alben aus der Box entfernen?`)) return
  const res = await api(`${API}/library/unsubscribe-artist`, { method: 'POST', body: { artistId } })
  if (!res.ok) {
    feedback('#managed-feedback', 'error', `Fehler ${res.status}`)
    return
  }
  const sync = await fireSyncTrigger()
  feedback('#managed-feedback', sync.kind, `„${name}" entfernt — ${sync.text}`)
  loadSubscriptions()
}

async function removeAlbum(albumId, name) {
  if (!confirm(`„${name}" aus der Box entfernen?`)) return
  const res = await api(`${API}/library/remove-album`, { method: 'POST', body: { albumId } })
  if (!res.ok) {
    feedback('#managed-feedback', 'error', `Fehler ${res.status}`)
    return
  }
  const sync = await fireSyncTrigger()
  feedback('#managed-feedback', sync.kind, `„${name}" entfernt — ${sync.text}`)
  loadSubscriptions()
}

async function applyArtistRange(sub, fromStr, toStr, btn) {
  const range_from = fromStr ? Number(fromStr) : undefined
  const range_to = toStr ? Number(toStr) : undefined
  if (btn) {
    btn.disabled = true
    btn.textContent = '…'
  }
  const res = await api(`${API}/library/subscribe-artist`, {
    method: 'POST',
    body: { artistId: sub.id, name: sub.name, category: sub.category, range_from, range_to },
  })
  if (btn) {
    btn.disabled = false
    btn.textContent = 'Übernehmen'
  }
  if (!res.ok) {
    feedback('#managed-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
    return
  }
  const sync = await fireSyncTrigger()
  feedback('#managed-feedback', sync.kind, `Bereich übernommen — ${sync.text}`)
  loadSubscriptions()
}

/* ---------- per-artist album include/exclude (Phase 17e) ---------- */

/** Expand/collapse the album list under an artist subscription row. Lazy-
 *  loads from the sync's own ordering so positions match the range. */
async function toggleArtistAlbums(a, row, btn) {
  const open = row.querySelector('.managed-albums')
  if (open) {
    open.remove()
    btn.textContent = 'Alben verwalten'
    return
  }
  btn.disabled = true
  btn.textContent = 'lädt …'
  const res = await api(`${SYNC_API}/artist-albums?artistId=${encodeURIComponent(a.id)}`)
  btn.disabled = false
  btn.textContent = 'Alben ausblenden'
  const panel = document.createElement('div')
  panel.className = 'managed-albums'
  if (!res.ok) {
    panel.innerHTML = '<p class="dim">Alben konnten nicht geladen werden.</p>'
    btn.textContent = 'Alben verwalten'
  } else {
    renderArtistAlbums(a, res.body?.albums ?? [], panel)
  }
  row.appendChild(panel)
}

function renderArtistAlbums(a, albums, panel) {
  panel.innerHTML = ''
  if (!albums.length) {
    panel.innerHTML = '<p class="dim">Keine Alben gefunden.</p>'
    return
  }
  for (const al of albums) {
    const line = document.createElement('div')
    line.className = 'album-line' + (al.inRange ? '' : ' out') + (al.excluded ? ' excluded' : '')
    const idx = document.createElement('span')
    idx.className = 'album-idx'
    idx.textContent = al.position
    const thumb = document.createElement('img')
    thumb.className = 'album-thumb'
    thumb.alt = ''
    thumb.loading = 'lazy'
    if (al.cover) thumb.src = al.cover
    const nm = document.createElement('span')
    nm.className = 'album-nm'
    nm.textContent = al.name || al.id
    const act = document.createElement('button')
    act.className = 'ghost'
    if (!al.inRange) {
      act.textContent = 'außerhalb'
      act.disabled = true
      act.title = 'Liegt außerhalb des gewählten Folgenbereichs'
    } else if (al.excluded) {
      act.textContent = 'aufnehmen'
      act.addEventListener('click', () => setExclude(a, al, false, panel))
    } else {
      act.textContent = 'ausschließen'
      act.addEventListener('click', () => setExclude(a, al, true, panel))
    }
    line.append(idx, thumb, nm, act)
    panel.appendChild(line)
  }
}

async function setExclude(a, al, excluded, panel) {
  const res = await api(`${API}/library/artist-exclude`, {
    method: 'POST',
    body: { artistId: a.id, albumId: al.id, excluded },
  })
  if (!res.ok) {
    feedback('#managed-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
    return
  }
  const sync = await fireSyncTrigger()
  feedback(
    '#managed-feedback',
    sync.kind,
    excluded ? `„${al.name}" ausgeschlossen — ${sync.text}` : `„${al.name}" wieder aufgenommen — ${sync.text}`,
  )
  const r2 = await api(`${SYNC_API}/artist-albums?artistId=${encodeURIComponent(a.id)}`)
  if (r2.ok) renderArtistAlbums(a, r2.body?.albums ?? [], panel)
}

/* ---------- screen: bluetooth (Phase 15d) ---------- */

async function loadBluetooth() {
  const res = await api(`${API}/bluetooth`)
  if (!res.ok) return
  const b = res.body ?? {}
  const power = $('#bt-power')
  if (power) power.checked = b.powered === true
  const ac = $('#bt-autoconnect')
  if (ac) ac.checked = b.autoconnect === true
  renderBtPaired(b.devices ?? [])
}

function renderBtPaired(devices) {
  const wrap = $('#bt-paired-list')
  if (!wrap) return
  wrap.innerHTML = ''
  if (!devices.length) {
    const p = document.createElement('p')
    p.className = 'dim'
    p.textContent = 'Keine gekoppelten Geräte.'
    wrap.appendChild(p)
    return
  }
  for (const d of devices) {
    const row = document.createElement('div')
    row.className = 'bt-device-row'
    const info = document.createElement('span')
    info.className = 'bt-device-info'
    info.textContent = d.connected ? `🟢 ${d.name || d.mac}` : `${d.name || d.mac} · ${d.mac}`
    const rm = document.createElement('button')
    rm.className = 'ghost'
    rm.textContent = 'Entkoppeln'
    rm.addEventListener('click', () => btRemove(d.mac, d.name || d.mac))
    row.append(info, rm)
    wrap.appendChild(row)
  }
}

async function btSetPower() {
  const on = $('#bt-power').checked
  feedback('#bt-power-feedback', 'success', on ? 'Bluetooth wird aktiviert …' : 'Bluetooth wird deaktiviert …')
  const res = await api(`${API}/bluetooth/power`, { method: 'POST', body: { on } })
  if (res.ok) {
    feedback('#bt-power-feedback', 'success', 'Erledigt.')
    setTimeout(loadBluetooth, 1500)
  } else {
    feedback('#bt-power-feedback', 'error', `Fehler ${res.status}`)
  }
}

async function btSetAutoconnect() {
  const enable = $('#bt-autoconnect').checked
  const res = await api(`${API}/bluetooth/autoconnect`, { method: 'POST', body: { enable } })
  if (!res.ok) feedback('#bt-power-feedback', 'error', `Auto-Verbinden: Fehler ${res.status}`)
}

async function btScan() {
  const btn = $('#bt-scan-btn')
  if (btn) {
    btn.disabled = true
    btn.textContent = '🔍 Scanne … (~10 s)'
  }
  feedback('#bt-feedback', 'success', 'Suche nach Geräten …')
  const res = await api(`${API}/bluetooth/scan`, { method: 'POST' })
  if (btn) {
    btn.disabled = false
    btn.textContent = '🔍 Scannen'
  }
  if (!res.ok) {
    feedback('#bt-feedback', 'error', `Scan fehlgeschlagen (${res.status})`)
    return
  }
  renderBtScan(res.body?.found ?? [])
}

function renderBtScan(found) {
  const wrap = $('#bt-scan-list')
  if (!wrap) return
  wrap.innerHTML = ''
  if (!found.length) {
    const p = document.createElement('p')
    p.className = 'dim'
    p.textContent = 'Keine neuen Geräte gefunden. Gerät im Pairing-Modus? Nochmal scannen.'
    wrap.appendChild(p)
    return
  }
  for (const d of found) {
    const row = document.createElement('div')
    row.className = 'bt-device-row'
    const info = document.createElement('span')
    info.className = 'bt-device-info'
    info.textContent = `${d.name || d.mac} · ${d.mac}`
    const pair = document.createElement('button')
    pair.className = 'primary'
    pair.textContent = 'Koppeln'
    pair.addEventListener('click', () => btPair(d.mac, d.name || d.mac, pair))
    row.append(info, pair)
    wrap.appendChild(row)
  }
  feedback('#bt-feedback', 'success', `${found.length} Gerät(e) gefunden.`)
}

async function btPair(mac, name, btn) {
  if (btn) {
    btn.disabled = true
    btn.textContent = 'Koppele …'
  }
  const res = await api(`${API}/bluetooth/pair`, { method: 'POST', body: { mac } })
  if (res.ok) {
    feedback('#bt-feedback', 'success', `"${name}" gekoppelt.`)
    setTimeout(loadBluetooth, 1500)
  } else {
    feedback('#bt-feedback', 'error', res.body?.error ?? `Koppeln fehlgeschlagen (${res.status})`)
    if (btn) {
      btn.disabled = false
      btn.textContent = 'Koppeln'
    }
  }
}

async function btRemove(mac, name) {
  if (!confirm(`"${name}" entkoppeln?`)) return
  const res = await api(`${API}/bluetooth/remove`, { method: 'POST', body: { mac } })
  if (res.ok) {
    feedback('#bt-feedback', 'success', `"${name}" entkoppelt.`)
    setTimeout(loadBluetooth, 1500)
  } else {
    feedback('#bt-feedback', 'error', `Entkoppeln fehlgeschlagen (${res.status})`)
  }
}

/* ---------- screen: telegram (Phase 15f) ---------- */

const telegramState = { chatIds: [] }

async function loadTelegram() {
  const res = await api(`${API}/telegram-config`)
  if (!res.ok) return
  const t = res.body ?? {}
  const active = $('#tg-active')
  if (active) active.checked = t.active === true
  setText('#tg-token-status', t.token_configured ? '✓ konfiguriert' : '✗ nicht gesetzt')
  const tok = $('#tg-token')
  if (tok) tok.value = ''
  telegramState.chatIds = Array.isArray(t.chatIds) ? t.chatIds.map((c) => ({ id: String(c.id ?? ''), label: String(c.label ?? '') })) : []
  renderTelegramChats()
}

/** Build chat rows with DOM methods (not innerHTML) so user-supplied
 *  ids/labels can't inject markup. */
function renderTelegramChats() {
  const wrap = $('#tg-chat-list')
  if (!wrap) return
  wrap.innerHTML = ''
  telegramState.chatIds.forEach((c, idx) => {
    const row = document.createElement('div')
    row.className = 'tg-chat-row'
    const idInp = document.createElement('input')
    idInp.type = 'text'
    idInp.inputMode = 'numeric'
    idInp.placeholder = 'Chat-ID'
    idInp.value = c.id
    idInp.addEventListener('input', () => { telegramState.chatIds[idx].id = idInp.value.trim() })
    const labelInp = document.createElement('input')
    labelInp.type = 'text'
    labelInp.placeholder = 'Bezeichnung'
    labelInp.value = c.label
    labelInp.addEventListener('input', () => { telegramState.chatIds[idx].label = labelInp.value })
    const rm = document.createElement('button')
    rm.className = 'ghost'
    rm.textContent = '×'
    rm.setAttribute('aria-label', 'Entfernen')
    rm.addEventListener('click', () => { telegramState.chatIds.splice(idx, 1); renderTelegramChats() })
    row.append(idInp, labelInp, rm)
    wrap.appendChild(row)
  })
}

function addTelegramChat() {
  telegramState.chatIds.push({ id: '', label: '' })
  renderTelegramChats()
}

async function saveTelegram() {
  for (const c of telegramState.chatIds) {
    if (!/^-?\d{1,20}$/.test(c.id)) {
      feedback('#tg-feedback', 'error', `Ungültige Chat-ID: "${c.id}" (nur Zahlen, Gruppen mit -)`)
      return
    }
  }
  const body = { active: $('#tg-active').checked, chatIds: telegramState.chatIds }
  const tok = $('#tg-token').value.trim()
  if (tok) body.token = tok
  const res = await api(`${API}/telegram-config`, { method: 'POST', body })
  if (res.ok) {
    feedback('#tg-feedback', 'success', 'Gespeichert. Telegram-Dienst wird neu gestartet.')
    if (tok) {
      $('#tg-token').value = ''
      setText('#tg-token-status', '✓ konfiguriert')
    }
  } else {
    feedback('#tg-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
  }
}

/* ---------- screen: system (Phase 15g) ---------- */

function formatUptime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatBytes(n) {
  if (!Number.isFinite(n)) return '—'
  const gb = n / 1024 ** 3
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(n / 1024 ** 2)} MB`
}

async function loadSystem() {
  const res = await api(`${API}/system`)
  if (res.ok) {
    const s = res.body ?? {}
    setText('#sys-hostname', s.hostname || '—')
    setText('#sys-uptime', formatUptime(s.uptime_seconds))
    setText('#sys-load', Number.isFinite(s.load_1) ? `${s.load_1}${s.cpu_count ? ` · ${s.cpu_count} Kerne` : ''}` : '—')
    setText('#sys-temp', Number.isFinite(s.cpu_temp_c) ? `${s.cpu_temp_c} °C` : '—')
    const memUsed = s.mem_total != null && s.mem_free != null ? s.mem_total - s.mem_free : null
    setText('#sys-mem', memUsed != null ? `${formatBytes(memUsed)} / ${formatBytes(s.mem_total)}` : '—')
    if (s.disk) {
      setText('#sys-disk', `${formatBytes(s.disk.total - s.disk.free)} / ${formatBytes(s.disk.total)} belegt`)
    } else {
      setText('#sys-disk', '—')
    }
  }
  renderPasswordStatus()
  loadAudio()
}

/* ---------- Audio (Phase 18 Item 1) ---------- */

let audioVolumeDebounce = null

async function loadAudio() {
  let res = await api(`${API}/audio`)
  if (res.status === 503) {
    // Config briefly not loaded right after pm2 restart — retry once.
    await new Promise((r) => setTimeout(r, 500))
    res = await api(`${API}/audio`)
  }
  if (!res.ok) return
  const a = res.body ?? {}
  setText('#audio-current', Number.isFinite(a.current) ? `${a.current} %` : '—')

  const live = $('#audio-volume')
  if (live && Number.isFinite(a.current)) {
    live.value = a.current
    setText('#audio-volume-out', a.current)
  }
  const max = $('#audio-max')
  if (max && Number.isFinite(a.maxVolume)) {
    max.value = a.maxVolume
    setText('#audio-max-out', a.maxVolume)
  }
  const en = $('#audio-startup-enable')
  const startup = $('#audio-startup')
  const startupRow = $('#audio-startup-row')
  const startupEnabled = Number.isFinite(a.startupVolume)
  if (en) en.checked = startupEnabled
  if (startup) {
    startup.value = startupEnabled ? a.startupVolume : 30
    setText('#audio-startup-out', startupEnabled ? a.startupVolume : 30)
    startup.disabled = !startupEnabled
  }
  if (startupRow) startupRow.style.opacity = startupEnabled ? '1' : '0.5'
}

/** Debounced live setter: only POST 250 ms after the user stops dragging
 *  so we don't spam amixer with every intermediate value. */
function setLiveVolume(v) {
  if (audioVolumeDebounce) clearTimeout(audioVolumeDebounce)
  audioVolumeDebounce = setTimeout(async () => {
    let res = await api(`${API}/audio/volume`, { method: 'POST', body: { volume: v } })
    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, 500))
      res = await api(`${API}/audio/volume`, { method: 'POST', body: { volume: v } })
    }
    if (!res.ok) {
      feedback('#audio-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
      return
    }
    const applied = res.body?.applied ?? v
    setText('#audio-current', `${applied} %`)
    if (res.body?.capped) {
      feedback('#audio-feedback', 'info', `Vom Hörschutz auf ${applied} % begrenzt.`)
      const sl = $('#audio-volume')
      if (sl) {
        sl.value = applied
        setText('#audio-volume-out', applied)
      }
    } else {
      const fb = $('#audio-feedback')
      if (fb) fb.hidden = true
    }
  }, 250)
}

async function saveAudioConfig() {
  const max = Math.floor(Number($('#audio-max').value))
  const startupEnabled = $('#audio-startup-enable').checked
  const startupVal = startupEnabled ? Math.floor(Number($('#audio-startup').value)) : null
  if (!Number.isFinite(max) || max < 10 || max > 100) {
    feedback('#audio-feedback', 'error', 'Hörschutz muss zwischen 10 und 100 % liegen.')
    return
  }
  if (startupEnabled && (!Number.isFinite(startupVal) || startupVal < 0 || startupVal > 100)) {
    feedback('#audio-feedback', 'error', 'Startup-Wert muss zwischen 0 und 100 % liegen.')
    return
  }
  if (startupEnabled && startupVal > max) {
    feedback('#audio-feedback', 'error', `Startup-Wert ${startupVal} % > Hörschutz ${max} % — bitte senken oder Hörschutz heben.`)
    return
  }
  const res = await api(`${API}/audio/config`, {
    method: 'POST',
    body: { maxVolume: max, startupVolume: startupVal },
  })
  if (!res.ok) {
    feedback('#audio-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
    return
  }
  feedback(
    '#audio-feedback',
    'success',
    startupVal != null
      ? `Gespeichert. Hörschutz ${max} %, Startup ${startupVal} %.`
      : `Gespeichert. Hörschutz ${max} %, Startup deaktiviert.`,
  )
}

/** Reflect state.passwordConfigured in the System Eltern-Passwort card. */
function renderPasswordStatus() {
  setText('#pw-status', state.passwordConfigured ? 'Passwort ist gesetzt' : 'Nicht gesetzt')
  const clearBtn = $('#pw-clear-btn')
  if (clearBtn) clearBtn.hidden = !state.passwordConfigured
}

async function setPassword() {
  const inp = $('#pw-new')
  const pw = (inp?.value ?? '').trim()
  if (!pw) {
    feedback('#pw-feedback', 'error', 'Bitte ein Passwort eingeben (oder „Passwort entfernen" nutzen).')
    return
  }
  if (pw.length < 4) {
    feedback('#pw-feedback', 'error', 'Mindestens 4 Zeichen.')
    return
  }
  const res = await api(`${API}/password`, { method: 'POST', body: { password: pw } })
  if (!res.ok) {
    feedback('#pw-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
    return
  }
  if (inp) inp.value = ''
  state.passwordConfigured = !!res.body?.configured
  renderPasswordStatus()
  feedback('#pw-feedback', 'success', 'Passwort gespeichert.')
}

async function clearPassword() {
  if (!confirm('Eltern-Passwort wirklich entfernen? Danach geht der Zugang nur noch über Magic-Link.')) return
  const res = await api(`${API}/password`, { method: 'POST', body: { password: '' } })
  if (!res.ok) {
    feedback('#pw-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
    return
  }
  state.passwordConfigured = !!res.body?.configured
  renderPasswordStatus()
  feedback('#pw-feedback', 'success', 'Passwort entfernt.')
}

/** Phase 17h: submit the no-session password form. On success, re-run
 *  bootstrap so the session cookie is picked up and the hub appears. */
async function doLogin() {
  const inp = $('#login-password')
  const pw = inp?.value ?? ''
  if (!pw) {
    feedback('#login-feedback', 'error', 'Bitte Passwort eingeben.')
    return
  }
  const btn = $('#login-submit-btn')
  if (btn) btn.disabled = true
  const res = await api(`${API}/login`, { method: 'POST', body: { password: pw } })
  if (btn) btn.disabled = false
  if (!res.ok) {
    if (res.status === 429) {
      feedback('#login-feedback', 'error', 'Zu viele Versuche — bitte kurz warten.')
    } else {
      feedback('#login-feedback', 'error', 'Falsches Passwort.')
    }
    if (inp) {
      inp.value = ''
      inp.focus()
    }
    return
  }
  if (inp) inp.value = ''
  await bootstrap()
}

async function systemReboot() {
  if (!confirm('Box wirklich neu starten? Dauert ~1 Minute, die WebApp verliert kurz die Verbindung.')) return
  feedback('#sys-feedback', 'success', 'Neustart wird ausgelöst …')
  await fetch('/api/reboot', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
}

async function systemShutdown() {
  if (!confirm('Box wirklich ausschalten? Sie muss danach am Gerät wieder eingeschaltet werden.')) return
  feedback('#sys-feedback', 'success', 'Ausschalten wird ausgelöst …')
  await fetch('/api/shutdown', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
}

/* ---------- screen: wlan (Phase 15c) ---------- */

/** Read-only WLAN/network status from /api/network (same endpoint the box
 *  frontend's NetworkService uses). No writes — changing the WLAN remotely
 *  could lock the box off the network, so that stays on the box display. */
async function loadWlan() {
  try {
    const res = await fetch('/api/network', { credentials: 'same-origin' })
    if (!res.ok) return
    const n = await res.json().catch(() => ({}))
    const online = n.onlinestate === 'online'
    setText('#wlan-online', online ? '🟢 Online' : '🔴 Offline')
    setText('#wlan-ssid', n.wifi || '—')
    setText('#wlan-signal', n.wifisignal ? `${n.wifisignal}${n.wifilink ? ` · ${n.wifilink}` : ''}` : '—')
    setText('#wlan-ip', n.ip || '—')
    setText('#wlan-gateway', n.gateway || '—')
    setText('#wlan-dns', n.dns || '—')
    setText('#wlan-subnet', n.subnet || '—')
    setText('#wlan-mac', n.mac || '—')
  } catch { /* swallow — section just shows dashes */ }
}

/* ---------- screen: power (Phase 15i) ---------- */

/** Pulls /api/mupihat (live readings) + /api/eltern/power-config (profile
 *  + idle timeouts) in parallel, renders the power-section. */
async function loadPower() {
  await Promise.all([loadPowerLive(), loadPowerConfig()])
}

async function loadPowerLive() {
  try {
    const res = await fetch('/api/mupihat', { credentials: 'same-origin' })
    if (!res.ok) return
    const body = await res.json().catch(() => ({}))
    // Bat_Percent (Phase 12) is the granular 5%-step value. Fall back to
    // the legacy Bat_SOC string for older mupihat.py outputs.
    const pct = body?.Bat_Percent ?? Number.parseInt(String(body?.Bat_SOC ?? '').replace('%', ''), 10)
    const charging = (body?.IBus ?? 0) > 0
    const pctEl = $('#power-percent')
    if (pctEl) {
      if (Number.isFinite(pct)) {
        pctEl.textContent = `${charging ? '⚡' : ''}${pct}%`
        pctEl.classList.remove('low', 'critical')
        if (pct <= 15) pctEl.classList.add('critical')
        else if (pct <= 30) pctEl.classList.add('low')
      } else {
        pctEl.textContent = '—'
      }
    }
    setText('#power-state', charging ? 'Wird geladen' : (body?.Bat_Stat ?? body?.Charger_Status ?? '—'))
    setText('#power-vbat', body?.Vbat ? `${body.Vbat} mV` : '—')
    setText('#power-vbus', body?.Vbus ? `${body.Vbus} mV` : '—')
    setText('#power-ibat', typeof body?.Ibat === 'number' ? `${body.Ibat} mA` : '—')
    setText('#power-temp', typeof body?.Temp === 'number' ? `${body.Temp} °C` : '—')
    setText('#power-chargerstatus', body?.Charger_Status ?? '—')
  } catch { /* swallow */ }
}

async function loadPowerConfig() {
  const res = await api(`${API}/power-config`)
  if (!res.ok) return
  const body = res.body ?? {}
  setText('#power-profile-name', body.battery?.selected ?? '—')
  const p = body.battery?.profile ?? {}
  setText('#power-profile-v100', p.v_100 ? `${p.v_100} mV` : '—')
  setText('#power-profile-warn', p.th_warning ? `${p.th_warning} mV` : '—')
  setText('#power-profile-shut', p.th_shutdown ? `${p.th_shutdown} mV` : '—')
  // vreg (Phase 13a) — optional field on the profile. Shows "POR-Default"
  // when missing so parents see that the box is using the chip's factory
  // setting rather than a profile-configured limit.
  setText('#power-profile-vreg', p.vreg ? `${p.vreg} mV` : 'Werks-Default')
  const t = body.timeout ?? {}
  $('#power-idle-shutdown').value = t.idlePiShutdown ?? 0
  $('#power-idle-display').value = t.idleDisplayOff ?? 10
}

async function savePowerConfig() {
  const idleShutdown = Number($('#power-idle-shutdown').value)
  const idleDisplay = Number($('#power-idle-display').value)
  if (!Number.isFinite(idleShutdown) || idleShutdown < 0 || idleShutdown > 1440) {
    feedback('#power-feedback', 'error', 'Idle-Shutdown muss zwischen 0 und 1440 Minuten liegen.')
    return
  }
  if (!Number.isFinite(idleDisplay) || idleDisplay < 0 || idleDisplay > 1440) {
    feedback('#power-feedback', 'error', 'Display-Off muss zwischen 0 und 1440 Minuten liegen.')
    return
  }
  const res = await api(`${API}/power-config`, {
    method: 'POST',
    body: { idlePiShutdown: idleShutdown, idleDisplayOff: idleDisplay },
  })
  if (res.ok) {
    feedback('#power-feedback', 'success', 'Gespeichert. Änderungen greifen sofort.')
  } else {
    feedback('#power-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
  }
}

/* ---------- Schlaftimer (Phase 17i) ---------- */

let sleepTimerTickHandle = null

/** Fetch + render the current SleepTimer state. Self-schedules the next
 *  poll: ~5s while a timer is active so the countdown is live; ~30s when
 *  idle so we still pick up a timer started elsewhere (mupi.php, Telegram).
 *  Polling auto-stops when the user leaves the Akku screen. */
async function loadSleepTimer() {
  if (sleepTimerTickHandle) {
    clearTimeout(sleepTimerTickHandle)
    sleepTimerTickHandle = null
  }
  const statusEl = $('#sleeptimer-status')
  const stopBtn = $('#sleeptimer-stop-btn')
  let intervalMs = 30000
  try {
    const res = await api(`${API}/sleeptimer`)
    if (res.ok) {
      const b = res.body ?? {}
      if (b.active) {
        const rem = Number(b.remaining_seconds) || 0
        const mins = Math.floor(rem / 60)
        const secs = rem % 60
        const until = b.until_iso ? new Date(b.until_iso) : null
        const untilText = until
          ? ` (um ${until.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr)`
          : ''
        if (statusEl) {
          statusEl.textContent = `Aktiv — Box schaltet in ${mins}:${String(secs).padStart(2, '0')} aus${untilText}`
        }
        if (stopBtn) stopBtn.hidden = false
        intervalMs = 5000
      } else {
        if (statusEl) statusEl.textContent = 'Aus'
        if (stopBtn) stopBtn.hidden = true
      }
    } else if (statusEl) {
      statusEl.textContent = 'Status nicht verfügbar'
    }
  } catch {
    if (statusEl) statusEl.textContent = 'Status nicht verfügbar'
  }
  // Only keep polling while the Spielzeit & Ruhe screen is the active one.
  if (state.currentSection === 'caps') {
    sleepTimerTickHandle = setTimeout(loadSleepTimer, intervalMs)
  }
}

async function startSleepTimer() {
  const slider = $('#sleeptimer-minutes')
  const minutes = Number(slider?.value)
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
    feedback('#sleeptimer-feedback', 'error', 'Ungültige Dauer.')
    return
  }
  const btn = $('#sleeptimer-start-btn')
  if (btn) btn.disabled = true
  const res = await api(`${API}/sleeptimer/start`, { method: 'POST', body: { minutes } })
  if (btn) btn.disabled = false
  if (!res.ok) {
    feedback('#sleeptimer-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
    return
  }
  feedback('#sleeptimer-feedback', 'success', `Schlaftimer gestartet (${minutes} min).`)
  loadSleepTimer()
}

async function stopSleepTimer() {
  if (!confirm('Schlaftimer wirklich stoppen?')) return
  const res = await api(`${API}/sleeptimer/stop`, { method: 'POST' })
  if (!res.ok) {
    feedback('#sleeptimer-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
    return
  }
  feedback('#sleeptimer-feedback', 'success', 'Schlaftimer gestoppt.')
  loadSleepTimer()
}

/* ---------- screen: hub overview (Phase 15a) ---------- */

/** Hub-overview card subs — live stats so parents see at a glance what
 *  needs attention. Sync card shows last-sync timing + count; power card
 *  shows battery %. Other cards stay descriptive — they'll be wired
 *  with real data in 15c/d/f/g once their backends exist. */
async function loadHub() {
  // Sync-Card sub: last sync + counts. Fail silently — hub overview
  // shouldn't break if the sync endpoint hiccups.
  try {
    const res = await api(`${SYNC_API}/status`)
    if (res.ok) {
      const cfg = res.body ?? {}
      const last = cfg.state?.last_sync_status
      const when = formatRelative(cfg.state?.last_sync_end)
      if (!cfg.token?.configured) {
        setText('#hub-card-sync-sub', 'Noch nicht eingerichtet')
      } else if (!cfg.token?.scopes_ok) {
        setText('#hub-card-sync-sub', '⚠️ Neu autorisieren')
      } else if (!cfg.enabled) {
        setText('#hub-card-sync-sub', 'Deaktiviert')
      } else if (last === 'COMPLETED') {
        const a = cfg.state.additions_count ?? 0
        const r = cfg.state.removals_count ?? 0
        setText('#hub-card-sync-sub', `Aktiv · ${when} · +${a}/−${r}`)
      } else {
        setText('#hub-card-sync-sub', last ?? '—')
      }
    }
  } catch { /* swallow */ }

  // Power-Card sub: pull /api/mupihat for battery %. Best-effort.
  try {
    const res = await fetch('/api/mupihat', { credentials: 'same-origin' })
    if (res.ok) {
      const body = await res.json().catch(() => ({}))
      const pct = body?.Bat_Percent ?? body?.Bat_SOC
      const charging = body?.IBus > 0
      if (typeof pct === 'number') {
        setText('#hub-card-power-sub', `${charging ? '⚡' : ''}${pct}%`)
      } else if (typeof pct === 'string') {
        setText('#hub-card-power-sub', pct)
      }
    }
  } catch { /* swallow */ }
}

/* ---------- screen: sync (Phase 14, formerly 'dashboard') ---------- */

async function loadSync() {
  const res = await api(`${SYNC_API}/status`)
  if (!res.ok) {
    feedback('#sync-feedback', 'error', `Status laden fehlgeschlagen: ${res.status}`)
    return
  }
  const data = res.body
  const cfg = data || {}
  setText('#sync-prefix', cfg.playlist_prefix ?? '—')
  setText('#sync-last', formatRelative(cfg.state?.last_sync_end))
  setText('#sync-state', cfg.state?.last_sync_status ?? '—')
  setText('#sync-next', formatRelativeFuture(cfg.state?.next_scheduled_sync))

  // Last-run summary.
  const counts = $('#sync-counts')
  if (cfg.state?.last_sync_status === 'COMPLETED') {
    counts.hidden = false
    const a = cfg.state.additions_count ?? 0
    const u = cfg.state.updates_count ?? 0
    const r = cfg.state.removals_count ?? 0
    setText('#sync-summary', `+${a} / ↻${u} / −${r}`)
  } else {
    counts.hidden = true
  }

  // Spotify-Card.
  const sActions = $('#spotify-actions')
  const sStatus = $('#spotify-status')
  sActions.innerHTML = ''
  if (!cfg.token?.configured) {
    sStatus.innerHTML = '<span class="dim">Noch nicht eingerichtet</span>'
    addBtn(sActions, 'primary', 'Spotify einrichten', () => goWizard())
  } else if (!cfg.token?.scopes_ok) {
    sStatus.innerHTML = '<span class="dim">⚠️ Berechtigungen reichen nicht für Smart-Sync</span>'
    addBtn(sActions, 'primary', 'Neu autorisieren', () => connectSpotify())
  } else {
    sStatus.innerHTML = '<span class="value">✓ Verbunden</span>'
    addBtn(sActions, 'ghost', 'Trennen', () => disconnectSpotify())
    if (!cfg.enabled) {
      addBtn(sActions, 'primary', 'Smart-Sync aktivieren', () => toggleSync(true))
    } else {
      addBtn(sActions, 'ghost', 'Smart-Sync deaktivieren', () => toggleSync(false))
    }
  }

  // Playlists-Liste
  const pls = $('#sync-playlists')
  pls.innerHTML = ''
  for (const p of cfg.state?.playlists_seen ?? []) {
    const div = document.createElement('div')
    div.className = 'playlist-item'
    div.innerHTML = `<span>📂 ${escapeHtml(p.name)}</span><span class="dim">${p.items} Items</span>`
    pls.appendChild(div)
  }

  // Konflikte (Phase 14e: jetzt mit Aktions-Button "Vom Sync verwalten lassen")
  const confs = cfg.state?.conflicts ?? []
  $('#conflicts-card').hidden = confs.length === 0
  const list = $('#conflicts-list')
  list.innerHTML = ''
  for (const c of confs) {
    const li = document.createElement('li')
    const meta = document.createElement('div')
    meta.textContent = `${c.manualArtist ?? '?'} – ${c.manualTitle ?? '?'}`
    const pl = document.createElement('div')
    pl.className = 'dim'
    pl.textContent = `auch in: ${(c.inPlaylists || []).join(', ')}`
    const actions = document.createElement('div')
    actions.className = 'actions'
    addBtn(actions, 'ghost', '🔗 Vom Sync verwalten lassen', () => promoteConflict(c))
    li.append(meta, pl, actions)
    list.appendChild(li)
  }
}

/** POST /api/spotify-sync/conflicts/promote with the conflict's identifier
 *  pair. On success: reload dashboard so the conflict is gone (item is now
 *  source='spotify-sync' and will be updated by the next sync). */
async function promoteConflict(conflict) {
  const field = conflict.identifierField
  // The group key is `<prefix>:<id>` (or `compilation:<artistId>:<albumId>`).
  // For matching against library we need the bare id — same extraction as
  // the diff module does.
  let value = ''
  const groupKey = conflict.groupKey ?? ''
  if (groupKey.startsWith('compilation:')) {
    const parts = groupKey.split(':')
    value = parts[parts.length - 1] ?? ''
  } else if (groupKey.includes(':')) {
    value = groupKey.slice(groupKey.indexOf(':') + 1)
  } else {
    value = groupKey
  }
  if (!field || !value) {
    feedback('#sync-feedback', 'error', 'Konflikt-Identifier unvollständig.')
    return
  }
  if (!confirm(`„${conflict.manualArtist ?? '?'} – ${conflict.manualTitle ?? '?'}" vom Sync verwalten lassen?\n\nAb sofort werden Titel/Cover/Artist vom Sync aktualisiert. Deine Overrides bleiben erhalten.`)) {
    return
  }
  const res = await api(`${SYNC_API}/conflicts/promote`, {
    method: 'POST',
    body: { identifierField: field, identifierValue: value },
  })
  if (res.ok) {
    feedback('#sync-feedback', 'success', 'Eintrag wird ab dem nächsten Sync verwaltet.')
    await loadSync()
  } else {
    feedback('#sync-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
  }
}

function addBtn(parent, cls, label, onClick) {
  const b = document.createElement('button')
  b.className = cls
  b.textContent = label
  b.addEventListener('click', onClick)
  parent.appendChild(b)
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/* ---------- actions ---------- */

/** Fire a sync trigger and translate the response into an honest, short
 *  status phrase. Thanks to the trailing-edge scheduler, a throttled trigger
 *  comes back as 202 'scheduled' (it WILL run automatically when the cooldown
 *  ends) — so we never claim "läuft" when nothing actually started. */
async function fireSyncTrigger() {
  const res = await api(`${SYNC_API}/trigger?source=webapp`, { method: 'POST' })
  const b = res.body || {}
  if (res.status === 202 && b.status === 'scheduled') {
    return { kind: 'info', text: `Sync läuft automatisch in ${b.scheduledInSeconds ?? 60} s` }
  }
  if (res.status === 202) return { kind: 'success', text: 'Sync läuft …' }
  if (res.status === 409) return { kind: 'info', text: 'ein Sync läuft gerade' }
  if (b.status === 'disabled') return { kind: 'error', text: 'Smart-Sync ist deaktiviert' }
  return { kind: 'info', text: 'Sync folgt beim nächsten Lauf' }
}

/** Short local time for sync-status lines. */
function fmtTimeShort(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

/** Library "Letzter Sync"-Zeile aktualisieren (beim Betreten + nach Läufen). */
async function loadSyncStatus() {
  const el = $('#library-sync-status')
  if (!el) return
  const s = await api(`${SYNC_API}/status`)
  if (!s.ok) {
    el.textContent = ''
    return
  }
  if (!s.body?.enabled) {
    el.textContent = 'Smart-Sync ist deaktiviert.'
    return
  }
  const st = s.body?.state || {}
  el.textContent = st.last_sync_end ? `Letzter Sync: ${fmtTimeShort(st.last_sync_end)}` : 'Noch kein Sync gelaufen.'
}

/** Prominent "Jetzt synchronisieren": triggert + pollt /status bis ein neuer
 *  Lauf fertig ist und zeigt das Ergebnis (+x / −y). */
async function manualSyncNow() {
  const btn = $('#library-sync-btn')
  const el = $('#library-sync-status')
  if (btn) btn.disabled = true
  let before = null
  try {
    const s = await api(`${SYNC_API}/status`)
    before = s.body?.state?.last_sync_start ?? null
  } catch {}
  const sync = await fireSyncTrigger()
  if (el) el.textContent = sync.text
  const deadline = Date.now() + 90000
  const poll = async () => {
    if (Date.now() > deadline) {
      if (btn) btn.disabled = false
      loadSyncStatus()
      return
    }
    const s = await api(`${SYNC_API}/status`)
    const st = s.body?.state
    const done =
      st && st.last_sync_start && st.last_sync_start !== before && (st.current_state === 'IDLE' || st.current_state === 'COMPLETED')
    if (done) {
      const add = st.additions_count ?? 0
      const rem = st.removals_count ?? 0
      const upd = st.updates_count ?? 0
      if (el) el.textContent = `Sync fertig — +${add} / −${rem}${upd ? ` / ~${upd}` : ''} · ${fmtTimeShort(st.last_sync_end)}`
      if (btn) btn.disabled = false
      loadSubscriptions()
      return
    }
    setTimeout(poll, 2000)
  }
  setTimeout(poll, 2000)
}

async function triggerSync() {
  const btn = $('#sync-trigger-btn')
  btn.disabled = true
  feedback('#sync-feedback', 'info', 'Sync gestartet …')
  const res = await api(`${SYNC_API}/trigger?source=webapp`, { method: 'POST' })
  if (res.status === 202 && res.body?.status === 'scheduled') {
    feedback('#sync-feedback', 'info', `Cooldown aktiv — Sync läuft automatisch in ${res.body?.scheduledInSeconds ?? 60} s.`)
    btn.disabled = false
  } else if (res.status === 202) {
    feedback('#sync-feedback', 'info', 'Sync läuft im Hintergrund. Aktualisiere Status in ~5 s …')
    setTimeout(async () => {
      await loadSync()
      feedback('#sync-feedback', 'success', 'Status aktualisiert')
      btn.disabled = false
    }, 5000)
  } else if (res.status === 409) {
    feedback('#sync-feedback', 'info', 'Es läuft bereits ein Sync.')
    btn.disabled = false
  } else {
    feedback('#sync-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
    btn.disabled = false
  }
}

async function toggleSync(enable) {
  const res = await api(`${SYNC_API}/config`, { method: 'POST', body: { enabled: enable } })
  if (res.ok) {
    feedback('#sync-feedback', 'success', enable ? 'Smart-Sync aktiviert.' : 'Smart-Sync deaktiviert.')
    await loadSync()
  } else {
    feedback('#sync-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
  }
}

async function connectSpotify() {
  const res = await api(`${API}/spotify-oauth/init?return=${encodeURIComponent('/eltern')}`)
  if (res.ok && res.body?.authorize_url) {
    location.href = res.body.authorize_url
  } else if (res.status === 400 && res.body?.error === 'no_client_id') {
    goWizard()
  } else {
    feedback('#sync-feedback', 'error', `OAuth-Init fehlgeschlagen: ${res.status}`)
  }
}

async function disconnectSpotify() {
  if (!confirm('Spotify-Verbindung trennen? Smart-Sync wird gestoppt.')) return
  const res = await api(`${API}/spotify-oauth/disconnect`, { method: 'POST' })
  if (res.ok) {
    await loadSync()
    feedback('#sync-feedback', 'success', 'Spotify-Verbindung getrennt.')
  }
}

async function logout() {
  await api(`${API}/logout`, { method: 'POST' })
  location.reload()
}

/* ---------- settings (Phase 14e polish) ---------- */

async function goSettings() {
  navigate('settings')
}

async function loadSettings() {
  const res = await api(`${SYNC_API}/config`)
  if (!res.ok) {
    feedback('#settings-feedback', 'error', `Laden fehlgeschlagen: ${res.status}`)
    return
  }
  const cfg = res.body ?? {}
  $('#settings-prefix').value = cfg.playlist_prefix ?? ''
  // Backend stores seconds; UI shows minutes — Q6=B default 900s = 15min.
  $('#settings-interval').value = Math.max(5, Math.min(60, Math.round((cfg.polling_interval_seconds ?? 900) / 60)))
  $('#settings-enabled').checked = !!cfg.enabled
  updateSettingsExamples()
}

function updateSettingsExamples() {
  const name = $('#settings-prefix').value.trim() || 'LeniBox'
  setText('#settings-prefix-example-1', `${name}-Hörspiele`)
  setText('#settings-prefix-example-2', `${name}-Musik`)
}

async function saveSettings() {
  const prefix = $('#settings-prefix').value.trim()
  const intervalMin = Number($('#settings-interval').value)
  const enabled = $('#settings-enabled').checked

  if (prefix.length < 2 || prefix.length > 30) {
    feedback('#settings-feedback', 'error', 'Box-Name muss 2-30 Zeichen lang sein.')
    return
  }
  if (!Number.isFinite(intervalMin) || intervalMin < 5 || intervalMin > 60) {
    feedback('#settings-feedback', 'error', 'Sync-Intervall muss zwischen 5 und 60 Minuten liegen.')
    return
  }

  // Save: only send the three fields the user can change here. Backend
  // ignores anything else and clamps polling_interval_seconds to [300, 3600].
  const res = await api(`${SYNC_API}/config`, {
    method: 'POST',
    body: {
      enabled,
      playlist_prefix: prefix,
      polling_interval_seconds: intervalMin * 60,
    },
  })
  if (res.ok) {
    feedback('#settings-feedback', 'success', 'Gespeichert. Änderungen greifen ab dem nächsten Sync-Tick.')
  } else {
    feedback('#settings-feedback', 'error', res.body?.error ?? `Fehler ${res.status}`)
  }
}

/* ---------- wizard ---------- */

function goWizard() {
  navigate('wizard')
}

/** Router-bound loader for the wizard section. Restores the step the
 *  user was on (sessionStorage-backed) so a hashchange/back-button
 *  trip doesn't reset progress. */
function loadWizard() {
  setWizardStep(state.wizardStep || 1)
}

function setWizardStep(step) {
  state.wizardStep = step
  sessionStorage.setItem('wizard.step', String(step))
  setText('#wizard-step-label', `Schritt ${step} von 5`)
  for (const el of $$('.wizard-step')) el.hidden = true
  const target = $(`#wizard-step-${step}`)
  if (target) target.hidden = false
  if (step === 2) updateWizardRedirectUri()
}

function updateWizardRedirectUri() {
  const el = $('#wizard-redirect-uri')
  if (el) el.textContent = `${location.protocol}//${location.host}/api/eltern/spotify-oauth/callback`
}

function updateWizardExamples() {
  const name = $('#wizard-box-name').value.trim() || 'LeniBox'
  setText('#wizard-example-1', `${name}-Hörspiele`)
  setText('#wizard-example-2', `${name}-Musik`)
  setText('#wizard-example-3', `${name}-Schlafenszeit`)
  $('#wizard-app-name').textContent = name
}

async function wizardSaveClientId() {
  const clientId = $('#wizard-client-id').value.trim()
  if (!clientId || !/^[a-zA-Z0-9]+$/.test(clientId) || clientId.length < 16) {
    alert('Bitte eine gültige Client ID einfügen (mind. 16 Zeichen, nur Buchstaben + Zahlen).')
    return
  }
  // Optional Client-Secret-Feld (Phase 14e — wizard kann auch klassisch
  // statt PKCE, falls Eltern's Spotify-App sowieso ein Secret hat).
  // Wizard-UI zeigt das nicht als Pflichtfeld; leerer Wert => PKCE.
  const clientSecret = ''
  const res = await api(`${API}/spotify-credentials`, {
    method: 'POST',
    body: { clientId, clientSecret },
  })
  if (!res.ok) {
    alert(`Speichern fehlgeschlagen: ${res.body?.error ?? res.status}`)
    return
  }
  setWizardStep(4)
}

async function wizardConnectSpotify() {
  await connectSpotify()
}

async function wizardFinish() {
  const name = $('#wizard-box-name').value.trim()
  if (name.length < 2) {
    alert('Box-Name muss mindestens 2 Zeichen lang sein.')
    return
  }
  const res = await api(`${SYNC_API}/config`, {
    method: 'POST',
    body: { enabled: true, playlist_prefix: name },
  })
  if (res.ok) {
    sessionStorage.removeItem('wizard.step')
    state.wizardStep = 1
    navigate('sync')
  } else {
    alert(`Konfiguration speichern fehlgeschlagen: ${res.status}`)
  }
}

/* ---------- bootstrap ---------- */

async function bootstrap() {
  showScreen('loading')
  const res = await api(`${API}/session`)
  if (res.status === 401 || !res.ok) {
    // Phase 17h: if a parent password is configured, offer a login form on the
    // no-session screen so the parent can re-enter without a fresh magic-link.
    const info = await api(`${API}/auth-info`)
    state.passwordConfigured = !!info.body?.passwordConfigured
    const pwCard = $('#no-session-password')
    if (pwCard) pwCard.hidden = !state.passwordConfigured
    const fb = $('#login-feedback')
    if (fb) fb.hidden = true
    const inp = $('#login-password')
    if (inp) inp.value = ''
    showScreen('no-session')
    if (state.passwordConfigured && inp) setTimeout(() => inp.focus(), 80)
    return
  }
  state.csrf = res.body.csrf_token
  state.passwordConfigured = !!res.body.passwordConfigured
  $('#logout-btn').hidden = false

  // Returned from Spotify OAuth callback? Land on sync so the user sees
  // the confirmation feedback immediately, and strip the query so a
  // reload doesn't re-trigger it.
  if (state.spotifyConnected) {
    history.replaceState({}, '', '/eltern#sync')
    onRoute()
    // Allow loadSync's render to complete, then push feedback over it.
    setTimeout(() => feedback('#sync-feedback', 'success', 'Spotify verbunden — bereit für Smart-Sync.'), 50)
    return
  }
  if (state.spotifyError) {
    history.replaceState({}, '', '/eltern#sync')
    onRoute()
    setTimeout(() => feedback('#sync-feedback', 'error', `Spotify-Fehler: ${state.spotifyError}`), 50)
    return
  }

  // Standard path: route by hash (defaults to hub).
  onRoute()
}

/* ---------- wiring ---------- */

function wire() {
  $('#logout-btn').addEventListener('click', logout)
  $('#sync-trigger-btn').addEventListener('click', triggerSync)
  // Phase 14e polish: "Einstellungen" -> dedicated short settings screen
  // (Box-Name + interval + enable toggle), NOT the full setup wizard.
  $('#sync-config-btn').addEventListener('click', () => goSettings())

  // Phase 15a — header back-button: navigate to the current section's
  // parent (set in SECTIONS map). Default to hub if parent is missing.
  $('#header-back-btn').addEventListener('click', () => {
    const meta = SECTIONS[state.currentSection ?? 'hub']
    navigate(meta?.parent ?? 'hub')
  })

  // Settings-screen buttons.
  $('#settings-back-btn').addEventListener('click', () => navigate('sync'))
  $('#settings-save-btn').addEventListener('click', saveSettings)
  $('#settings-rerun-wizard-btn').addEventListener('click', () => goWizard())
  $('#settings-prefix').addEventListener('input', updateSettingsExamples)

  // Phase 15i — Power-screen save.
  $('#power-save-btn')?.addEventListener('click', savePowerConfig)
  $('#sleeptimer-start-btn')?.addEventListener('click', startSleepTimer)
  $('#sleeptimer-stop-btn')?.addEventListener('click', stopSleepTimer)
  $('#sleeptimer-minutes')?.addEventListener('input', (e) => {
    const out = $('#sleeptimer-minutes-out')
    if (out) out.textContent = String(e.target.value)
  })

  // WLAN (Phase 15c) — read-only status + manual refresh.
  $('#wlan-refresh-btn')?.addEventListener('click', loadWlan)

  // System (Phase 15g) — status refresh + reboot/shutdown.
  $('#sys-refresh-btn')?.addEventListener('click', loadSystem)
  $('#sys-reboot-btn')?.addEventListener('click', systemReboot)
  $('#sys-shutdown-btn')?.addEventListener('click', systemShutdown)
  $('#pw-set-btn')?.addEventListener('click', setPassword)
  $('#pw-clear-btn')?.addEventListener('click', clearPassword)
  $('#login-submit-btn')?.addEventListener('click', doLogin)
  $('#login-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin()
  })

  // Audio (Phase 18 Item 1)
  $('#audio-volume')?.addEventListener('input', (e) => {
    const v = Number(e.target.value)
    setText('#audio-volume-out', v)
    setLiveVolume(v)
  })
  $('#audio-max')?.addEventListener('input', (e) => {
    setText('#audio-max-out', Number(e.target.value))
  })
  $('#audio-startup')?.addEventListener('input', (e) => {
    setText('#audio-startup-out', Number(e.target.value))
  })
  $('#audio-startup-enable')?.addEventListener('change', (e) => {
    const on = e.target.checked
    const startup = $('#audio-startup')
    const row = $('#audio-startup-row')
    if (startup) startup.disabled = !on
    if (row) row.style.opacity = on ? '1' : '0.5'
  })
  $('#audio-save-btn')?.addEventListener('click', saveAudioConfig)

  // Telegram (Phase 15f) — config editor.
  $('#tg-back-btn')?.addEventListener('click', () => navigate('hub'))
  $('#tg-save-btn')?.addEventListener('click', saveTelegram)
  $('#tg-add-chat-btn')?.addEventListener('click', addTelegramChat)

  // Bluetooth (Phase 15d) — power/autoconnect toggles + scan/pair/remove.
  $('#bt-power')?.addEventListener('change', btSetPower)
  $('#bt-autoconnect')?.addEventListener('change', btSetAutoconnect)
  $('#bt-scan-btn')?.addEventListener('click', btScan)

  // Spotify-Suche (Phase 17a)
  $('#library-search-spotify-btn')?.addEventListener('click', () => navigate('search'))
  $('#library-sync-btn')?.addEventListener('click', manualSyncNow)
  $('#search-go-btn')?.addEventListener('click', doSearch)
  $('#search-query')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch()
  })
  $('#search-type-filter')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-stype]')
    if (!btn) return
    searchState.type = btn.dataset.stype
    for (const p of $('#search-type-filter').querySelectorAll('.pill')) p.classList.toggle('active', p === btn)
    if (($('#search-query')?.value ?? '').trim().length >= 2) doSearch()
  })

  // Phase 15h — Caps-screen actions.
  $('#caps-back-btn')?.addEventListener('click', () => navigate('hub'))
  $('#caps-save-btn')?.addEventListener('click', saveCapsConfig)
  $('#caps-extend-btn')?.addEventListener('click', capsExtend)
  $('#caps-release-btn')?.addEventListener('click', capsRelease)
  $('#caps-quietnow-btn')?.addEventListener('click', capsQuietNow)

  // Phase 15e — Library wiring.
  $('#library-add-btn')?.addEventListener('click', openLibraryAddSheet)
  $('#library-add-close')?.addEventListener('click', closeLibraryAddSheet)
  $('#library-add-cancel')?.addEventListener('click', closeLibraryAddSheet)
  $('#library-add-submit')?.addEventListener('click', submitLibraryAdd)
  $('#library-add-type')?.addEventListener('change', onAddTypeChange)
  $('#library-edit-close')?.addEventListener('click', closeLibraryEditSheet)
  $('#library-search')?.addEventListener('input', (e) => {
    libraryState.search = e.target.value
    renderLibrary()
  })
  // Filter pills — delegate per-group.
  $('#library-category-filter')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill')
    if (!btn) return
    for (const p of $$('#library-category-filter .pill')) p.classList.toggle('active', p === btn)
    libraryState.categoryFilter = btn.dataset.cat
    renderLibrary()
  })
  $('#library-source-filter')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill')
    if (!btn) return
    for (const p of $$('#library-source-filter .pill')) p.classList.toggle('active', p === btn)
    libraryState.sourceFilter = btn.dataset.src
    renderLibrary()
  })
  // Click on backdrop (outside sheet) closes both overlays.
  $('#library-edit-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLibraryEditSheet()
  })
  $('#library-add-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLibraryAddSheet()
  })

  for (const btn of $$('[data-go-step]')) {
    btn.addEventListener('click', () => setWizardStep(Number(btn.dataset.goStep)))
  }
  $('#wizard-save-client-id').addEventListener('click', wizardSaveClientId)
  $('#wizard-connect-btn').addEventListener('click', wizardConnectSpotify)
  $('#wizard-finish-btn').addEventListener('click', wizardFinish)
  $('#wizard-box-name').addEventListener('input', updateWizardExamples)

  // Copy buttons
  for (const btn of $$('.copy-btn')) {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copyText ?? $(`#${btn.dataset.copy}`)?.textContent ?? ''
      try {
        await navigator.clipboard.writeText(text)
        const old = btn.textContent
        btn.textContent = '✓'
        setTimeout(() => { btn.textContent = old }, 1200)
      } catch {
        alert('Bitte manuell kopieren: ' + text)
      }
    })
  }
}

document.addEventListener('DOMContentLoaded', () => {
  wire()
  // Phase 15a: hash-based routing. hashchange re-routes (browser back/
  // forward + Telegram-bot deep-links). onRoute is gated by state.csrf
  // being non-null, so the listener firing before bootstrap finishes
  // is a no-op.
  window.addEventListener('hashchange', onRoute)
  bootstrap()
})
