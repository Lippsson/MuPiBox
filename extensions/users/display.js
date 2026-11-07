// The users, display part: a dot in the colour of the current user in the header (right of the battery). A tap on the dot opens a page
// with one tile per user, with colour and name; a tap on a tile switches to that user - the box loads their settings and library and
// restarts, and the display loads itself again. The setting "displaySwitch" off: the dot only shows who is signed in.

/** The colour of a user as the API part gives it (#RRGGBB); anything else is grey. */
export function colorOf(user) {
  return /^#[0-9a-fA-F]{6}$/.test(String(user?.color ?? '')) ? user.color : '#808080'
}

export function activate(api) {
  const canSwitch = api.settings()?.displaySwitch !== false
  let state = null
  const badges = new Set()

  const paint = () => {
    for (const badge of badges) {
      const me = state?.users.find((u) => u.id === state.current)
      badge.firstChild.style.background = colorOf(me)
      badge.setAttribute('aria-label', me ? `Benutzer: ${me.name}` : 'Benutzer')
      // (not `hidden`: the display of the style below would win over it)
      badge.style.display = !state || state.users.length < 2 ? 'none' : 'flex'
    }
  }

  const load = async () => {
    const answer = await api.fetchApi('/state')
    if (answer && Array.isArray(answer.users) && typeof answer.current === 'string') {
      state = answer
      paint()
    }
    return state
  }

  async function switchTo(user, content) {
    content.textContent = ''
    const wait = document.createElement('div')
    wait.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:600 22px/1.3 var(--ion-font-family,inherit);text-align:center;padding:16px'
    wait.textContent = `Wechsle zu ${user.name} …`
    content.append(wait)
    try {
      const response = await fetch(`${api.apiUrl}/ext/users/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ id: user.id }),
      })
      if (!response.ok) throw new Error(String(response.status))
      // (the box restarts and loads this page again; if that does not happen the page tries again after a while)
      setTimeout(() => location.reload(), 60000)
    } catch {
      wait.textContent = 'Das hat nicht geklappt.'
    }
  }

  function open() {
    api.overlay.open({
      title: 'Benutzer',
      mount(content) {
        const grid = document.createElement('div')
        grid.style.cssText = 'position:absolute;inset:0;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:16px;padding:16px;overflow-y:auto'
        content.append(grid)
        const draw = () => {
          grid.textContent = ''
          for (const user of state?.users ?? []) {
            const mine = user.id === state.current
            const tile = document.createElement('button')
            tile.type = 'button'
            tile.disabled = mine || !canSwitch
            tile.setAttribute('aria-pressed', String(mine))
            tile.style.cssText = `width:132px;height:132px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border-radius:20px;border:3px solid ${mine ? 'var(--ion-color-primary, currentColor)' : 'rgba(255,255,255,.25)'};background:rgba(255,255,255,.08);color:inherit;font:600 18px/1.2 var(--ion-font-family,inherit);padding:8px;cursor:${mine || !canSwitch ? 'default' : 'pointer'}`
            const letter = document.createElement('span')
            letter.style.cssText = `width:52px;height:52px;border-radius:50%;background:${colorOf(user)};box-shadow:0 0 0 3px rgba(0,0,0,.35)`
            const name = document.createElement('span')
            name.textContent = user.name
            name.style.cssText = 'max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
            tile.append(letter, name)
            tile.onclick = () => switchTo(user, content)
            grid.append(tile)
          }
        }
        draw()
        // (the list may have changed in the app since the badge was filled)
        load().then(draw)
      },
    })
  }

  api.header.add({
    mount(host) {
      const badge = document.createElement(canSwitch ? 'button' : 'span')
      if (canSwitch) {
        badge.type = 'button'
        // (the status bar ignores the pointer, and a tap on it opens its own page: the badge takes the pointer back and keeps the tap to itself)
        badge.onclick = (ev) => {
          ev.stopPropagation()
          open()
        }
        for (const type of ['pointerdown', 'pointerup', 'touchstart', 'mousedown']) badge.addEventListener(type, (ev) => ev.stopPropagation())
      }
      badge.style.cssText =
        'display:flex;align-items:center;justify-content:center;width:34px;height:34px;flex:none;border:0;background:transparent;padding:0;margin-right:4px;pointer-events:auto;cursor:pointer;display:none'
      // (the dot itself is small; the button around it is a target a finger can hit)
      const dot = document.createElement('span')
      dot.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#808080;box-shadow:0 0 0 2px rgba(0,0,0,.4)'
      badge.append(dot)
      host.append(badge)
      badges.add(badge)
      paint()
      return () => badges.delete(badge)
    },
  })
  load()
  // (a change in the app: the badge learns of it)
  api.every(60 * 1000, load)
}
