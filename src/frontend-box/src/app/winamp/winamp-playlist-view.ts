// The playlist window of Winamp: the track list of what plays, between the frame of pledit.bmp. Taller than Winamp's
// own smallest playlist (the display has room for it): 275 x 137 skin pixels fill half of the 1920 x 480 display.

import { BitmapLabel, el, formatClock, ref, setSprite, Skin, sprite, WaButton } from './winamp-skin'

export const PL_W = 275
export const PL_H = 137
const TOP = 20
const BOTTOM = 38
const ROW = 10

export interface PlaylistEntry {
  position: number
  name: string
  artist?: string
  /** seconds, 0 / undefined when not known */
  duration?: number
}

export interface PlaylistActions {
  /** a row was tapped */
  play(entry: PlaylistEntry): void
  /** the four round buttons at the left of the bottom bar, and the one at the right */
  add(): void
  rem(): void
  sel(): void
  misc(): void
  list(): void
  /** the little transport buttons */
  prev(): void
  playPause(): void
  pause(): void
  stop(): void
  next(): void
  eject(): void
  close(): void
}

export class WinampPlaylistView {
  readonly node: HTMLElement
  private readonly list: HTMLElement
  private readonly handle: HTMLElement
  private readonly info: BitmapLabel
  private readonly time: BitmapLabel
  private entries: PlaylistEntry[] = []
  private current = -1
  private lastKey = ''

  constructor(
    private readonly skin: Skin,
    private readonly actions: PlaylistActions,
  ) {
    const win = el('wa-win wa-pl', { width: `${PL_W}px`, height: `${PL_H}px` })
    this.node = win
    const colours = skin.meta.pledit
    win.style.background = colours.normalBg
    const f = 'pledit.bmp'
    // top bar: corners, the title in the middle, the rest filled with the tile
    win.appendChild(sprite(skin, f, [0, 0, 25, 20], 0, 0))
    win.appendChild(sprite(skin, f, [153, 0, 25, 20], PL_W - 25, 0))
    const titleX = Math.round((PL_W - 100) / 2)
    for (let x = 25; x < titleX; x += 25) win.appendChild(sprite(skin, f, [127, 0, Math.min(25, titleX - x), 20], x, 0))
    for (let x = titleX + 100; x < PL_W - 25; x += 25) win.appendChild(sprite(skin, f, [127, 0, Math.min(25, PL_W - 25 - x), 20], x, 0))
    win.appendChild(sprite(skin, f, [26, 0, 100, 20], titleX, 0))
    // sides
    for (let y = TOP; y < PL_H - BOTTOM; y += 29) {
      const h = Math.min(29, PL_H - BOTTOM - y)
      win.appendChild(sprite(skin, f, [0, 42, 12, h], 0, y))
      win.appendChild(sprite(skin, f, [31, 42, 20, h], PL_W - 20, y))
    }
    // the bottom bar (the round buttons and the little transport are part of the picture)
    win.appendChild(sprite(skin, f, [0, 72, 125, 38], 0, PL_H - BOTTOM))
    win.appendChild(sprite(skin, f, [126, 72, 150, 38], PL_W - 150, PL_H - BOTTOM))

    // the list: touch scrolls it, the handle at the right shows and moves the place
    this.list = el('wa-pl-list', { left: '12px', top: `${TOP}px`, width: `${PL_W - 12 - 20}px`, height: `${PL_H - TOP - BOTTOM}px` })
    this.list.style.color = colours.normal
    this.list.style.fontFamily = `"${colours.font}", Arial, sans-serif`
    this.list.style.setProperty('--wa-row', `${ROW}px`)
    this.list.style.setProperty('--wa-current', colours.current)
    this.list.style.setProperty('--wa-selected-bg', colours.selectedBg)
    win.appendChild(this.list)
    this.handle = sprite(skin, f, [52, 53, 8, 18], PL_W - 15, TOP + 1, 'wa-sprite wa-pl-handle')
    win.appendChild(this.handle)
    this.list.addEventListener('scroll', () => this.placeHandle())
    this.dragHandle()

    // hit areas over the painted buttons of the bottom bar
    const y0 = PL_H - BOTTOM
    const hit = (x: number, y: number, w: number, h: number, fn: () => void, title = '') => {
      const node = el('wa-btn wa-hit', { left: `${x}px`, top: `${y0 + y}px`, width: `${w}px`, height: `${h}px` })
      if (title) node.title = title
      node.addEventListener('click', fn)
      win.appendChild(node)
    }
    hit(13, 1, 24, 24, () => actions.add(), 'Add')
    hit(42, 1, 24, 24, () => actions.rem(), 'Remove')
    hit(72, 1, 24, 24, () => actions.sel(), 'Select')
    hit(100, 1, 24, 24, () => actions.misc(), 'Misc')
    hit(232 - 1, 1, 24, 24, () => actions.list(), 'List')
    // the six little transport buttons: previous, play, pause, stop, next, open
    const small: [number, () => void][] = [
      [134, () => actions.prev()],
      [144, () => actions.playPause()],
      [154, () => actions.pause()],
      [164, () => actions.stop()],
      [174, () => actions.next()],
      [184, () => actions.eject()],
    ]
    for (const [sx, fn] of small) hit(sx - 5 - 1, 17, 10, 11, fn)
    // close (the X of the title bar)
    const close = new WaButton(skin, { normal: ref(f, 167, 3, 9, 9) }, [PL_W - 11, 3, 9, 9], () => actions.close(), 'Close')
    close.node.style.backgroundImage = 'none'
    win.appendChild(close.node)

    // the little displays of the bottom bar: what the list holds, and the time
    this.info = new BitmapLabel(skin, [131 - 1, 8 + 100 - 38 + 0, 90, 6])
    this.info.node.style.top = `${y0 + 10}px`
    win.appendChild(this.info.node)
    this.time = new BitmapLabel(skin, [191 - 1, 0, 30, 6])
    this.time.node.style.top = `${y0 + 24}px`
    win.appendChild(this.time.node)
  }

  setEntries(entries: PlaylistEntry[], current: number): void {
    const key = JSON.stringify(entries.map((e) => [e.position, e.name, e.artist, e.duration]))
    if (key !== this.lastKey) {
      this.lastKey = key
      this.entries = entries
      this.list.replaceChildren()
      for (const entry of entries) {
        const row = el('wa-pl-row')
        row.dataset.position = String(entry.position)
        const name = el('wa-pl-name', {}, 'span')
        name.textContent = `${entry.position}. ${entry.artist ? `${entry.artist} - ` : ''}${entry.name}`
        row.appendChild(name)
        if (entry.duration) {
          const dur = el('wa-pl-dur', {}, 'span')
          dur.textContent = formatClock(entry.duration)
          row.appendChild(dur)
        }
        row.addEventListener('click', () => this.actions.play(entry))
        this.list.appendChild(row)
      }
      if (entries.length === 0) {
        const hint = el('wa-pl-empty')
        hint.textContent = 'Nothing in the list - press the eject button to choose something'
        this.list.appendChild(hint)
      }
      const total = entries.reduce((s, e) => s + (e.duration ?? 0), 0)
      this.info.set(`${entries.length} TRACKS${total > 0 ? ` ${formatClock(total)}` : ''}`.toUpperCase())
    }
    this.setCurrent(current)
    this.placeHandle()
  }

  /** The row that plays; `follow` scrolls it into view (a new track), not while the finger is on the list. */
  setCurrent(position: number, follow = true): void {
    if (position === this.current) return
    this.current = position
    for (const row of Array.from(this.list.children) as HTMLElement[]) {
      const on = Number(row.dataset.position) === position
      row.classList.toggle('wa-pl-on', on)
      if (on && follow) row.scrollIntoView({ block: 'nearest' })
    }
  }

  scrollToCurrent(): void {
    const row = this.list.querySelector<HTMLElement>('.wa-pl-on')
    row?.scrollIntoView({ block: 'center' })
  }

  setTime(text: string): void {
    this.time.set(text.toUpperCase())
  }

  private placeHandle(): void {
    const max = this.list.scrollHeight - this.list.clientHeight
    const track = PL_H - TOP - BOTTOM - 18 - 2
    this.handle.style.visibility = max > 1 ? 'visible' : 'hidden'
    const f = max > 1 ? this.list.scrollTop / max : 0
    this.handle.style.top = `${TOP + 1 + Math.round(f * track)}px`
  }

  private dragHandle(): void {
    let start: { y: number; top: number } | undefined
    this.handle.style.pointerEvents = 'auto'
    this.handle.addEventListener('pointerdown', (e) => {
      start = { y: e.clientY, top: this.list.scrollTop }
      this.handle.setPointerCapture(e.pointerId)
      setSprite(this.skin, this.handle, 'pledit.bmp', [61, 53, 8, 18])
    })
    this.handle.addEventListener('pointermove', (e) => {
      if (!start) return
      const scale = this.handle.getBoundingClientRect().height / 18 || 1
      const track = PL_H - TOP - BOTTOM - 18 - 2
      const max = this.list.scrollHeight - this.list.clientHeight
      this.list.scrollTop = start.top + ((e.clientY - start.y) / scale / track) * max
    })
    const end = () => {
      start = undefined
      setSprite(this.skin, this.handle, 'pledit.bmp', [52, 53, 8, 18])
    }
    this.handle.addEventListener('pointerup', end)
    this.handle.addEventListener('pointercancel', end)
  }
}

export const PLAYLIST_CSS = `
.wa-pl-list { position: absolute; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; touch-action: pan-y; font-size: 8px; line-height: var(--wa-row); }
.wa-pl-list::-webkit-scrollbar { display: none; }
.wa-pl-row { display: flex; height: var(--wa-row); padding: 0 1px; white-space: nowrap; cursor: pointer; }
.wa-pl-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: clip; }
.wa-pl-dur { flex: 0 0 auto; padding-left: 4px; }
.wa-pl-row.wa-pl-on { color: var(--wa-current); background: var(--wa-selected-bg); }
.wa-pl-handle { cursor: pointer; }
.wa-pl-empty { padding: 20px 8px; opacity: .6; white-space: normal; text-align: center; }
`
