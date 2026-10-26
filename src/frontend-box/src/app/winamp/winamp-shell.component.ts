import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, OnDestroy, untracked, ViewEncapsulation } from '@angular/core'
import { EQ_H, WinampEqView } from './winamp-eq-view'
import { MAIN_H, MAIN_W, WinampMainView } from './winamp-main-view'
import { PL_H, PLAYLIST_CSS, WinampPlaylistView } from './winamp-playlist-view'
import type { Skin } from './winamp-skin'
import { el, formatClock, WINAMP_BASE_CSS } from './winamp-skin'
import { WinampService } from './winamp.service'

// A window is 275 skin pixels wide; the half of the 1920 x 480 display is 960 wide
const HALF = 960
const SCREEN_H = 480
// wide layout: the windows are drawn at a whole-number factor (3 on the half of a 1920 x 480 display: 825 x 348 pixels)
const WIDE_SCALE = Math.max(1, Math.floor(Math.min(HALF / MAIN_W, SCREEN_H / MAIN_H)))
// the compact layout (a display like 800 x 480): the bar below the window that changes between player, equaliser, playlist and library
const NAV_H = 64

/**
 * Mounts the Winamp windows of the skin: the main window on the left half (always), the equaliser or the playlist on the
 * right half over the library (the app's own pages, which sit there while both are closed). The windows are plain DOM
 * (winamp-*-view.ts); this only hands them what the service knows and the service what their buttons do.
 */
@Component({
  selector: 'mupi-winamp-shell',
  template: '',
  styles: [
    `${WINAMP_BASE_CSS}${PLAYLIST_CSS}
    mupi-winamp-shell { position: fixed; left: 0; top: 0; width: 1920px; height: 480px; z-index: 150; pointer-events: none; display: block; }
    mupi-winamp-shell .wa-half { position: absolute; top: 0; width: 960px; height: 480px; overflow: hidden; pointer-events: auto; background: #000; }
    mupi-winamp-shell .wa-half-left { left: 0; }
    mupi-winamp-shell .wa-half-right { left: 960px; }
    mupi-winamp-shell .wa-half.wa-hidden { display: none; }
    mupi-winamp-shell.wa-compact { width: 100vw; height: 100vh; }
    mupi-winamp-shell.wa-compact .wa-half { left: 0; top: 0; width: 100%; height: calc(100% - 64px); }
    mupi-winamp-shell .wa-nav { position: absolute; left: 0; bottom: 0; width: 100%; height: 64px; display: flex; pointer-events: auto; background: var(--wa-nav-bg, #000); border-top: 2px solid var(--wa-nav-line, #3c3c6e); }
    mupi-winamp-shell .wa-nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--wa-nav-fg, #9a9ac8); font: 600 13px Arial, sans-serif; letter-spacing: .04em; text-transform: uppercase; cursor: pointer; -webkit-tap-highlight-color: transparent; user-select: none; border-right: 1px solid var(--wa-nav-line, #3c3c6e); }
    mupi-winamp-shell .wa-nav-btn:last-child { border-right: 0; }
    mupi-winamp-shell .wa-nav-btn svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    mupi-winamp-shell .wa-nav-btn svg .f { fill: currentColor; stroke: none; }
    mupi-winamp-shell .wa-nav-btn.wa-nav-on { background: var(--wa-nav-on-bg, #3c3c6e); color: var(--wa-nav-on-fg, #fff); }
    mupi-winamp-shell .wa-nav-btn:active { filter: brightness(1.4); }
    mupi-winamp-shell.wa-compact .wa-toast { bottom: 76px; max-width: 90vw; }
    mupi-winamp-shell .wa-message { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; text-align: center; color: #c8c8e6; font: 28px/1.3 Arial, sans-serif; }
    mupi-winamp-shell .wa-message small { font-size: 20px; color: #8a8ab0; }
    mupi-winamp-shell .wa-knob-fallback { background: linear-gradient(#d8d8d8, #8a8a8a); border: 1px solid #333; }
    mupi-winamp-shell .wa-eq-note { position: absolute; font: 5px/9px Arial, sans-serif; color: #c0c0c0; text-align: center; background: rgba(0,0,0,.72); display: flex; align-items: center; justify-content: center; }
    mupi-winamp-shell .wa-eq-presets { position: absolute; z-index: 5; display: flex; flex-direction: column; font: 7px/10px Arial, sans-serif; border: 1px solid #888; }
    mupi-winamp-shell .wa-eq-tabs { display: flex; flex: none; border-bottom: 1px solid #888; }
    mupi-winamp-shell .wa-eq-tab { flex: 1; text-align: center; cursor: pointer; line-height: 12px; }
    mupi-winamp-shell .wa-eq-tab.wa-eq-on { background: var(--wa-selected-bg); color: var(--wa-current); }
    mupi-winamp-shell .wa-eq-x { flex: none; width: 16px; }
    mupi-winamp-shell .wa-eq-list { flex: 1; overflow-y: auto; scrollbar-width: none; display: grid; grid-template-columns: 1fr 1fr; align-content: start; touch-action: pan-y; }
    mupi-winamp-shell .wa-eq-list::-webkit-scrollbar { display: none; }
    mupi-winamp-shell .wa-eq-preset { padding: 0 3px; cursor: pointer; white-space: nowrap; overflow: hidden; }
    mupi-winamp-shell .wa-eq-preset:active { background: var(--wa-selected-bg); color: var(--wa-current); }
    mupi-winamp-shell .wa-eq-off { opacity: .45; }
    mupi-winamp-shell .wa-pop { position: absolute; left: 24px; top: 24px; z-index: 10; min-width: 340px; background: #0f0f1b; border: 2px solid #6e6e96; border-radius: 6px; padding: 6px 0; font: 30px Arial, sans-serif; color: #d2d2f0; box-shadow: 0 8px 30px #000a; }
    mupi-winamp-shell .wa-pop div { padding: 12px 24px; }
    mupi-winamp-shell .wa-pop .wa-pop-item:active { background: #3c3c6e; }
    mupi-winamp-shell .wa-pop .wa-pop-note { font-size: 20px; color: #8a8ab0; padding-top: 4px; }
    mupi-winamp-shell .wa-toast { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 11; background: #0f0f1bee; border: 1px solid #6e6e96; border-radius: 6px; padding: 8px 20px; font: 24px Arial, sans-serif; color: #d2d2f0; white-space: nowrap; max-width: 920px; overflow: hidden; text-overflow: ellipsis; }
    `,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WinampShellComponent implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly svc = inject(WinampService)
  private readonly compact = this.svc.layout === 'compact'
  private nav: HTMLElement | undefined
  private readonly navButtons = new Map<string, HTMLElement>()
  private readonly left = el('wa-half wa-half-left')
  private readonly right = el('wa-half wa-half-right wa-hidden')
  private main: WinampMainView | undefined
  private eqView: WinampEqView | undefined
  private plView: WinampPlaylistView | undefined
  private popup: HTMLElement | undefined
  private toastTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    this.host.append(this.left, this.right)
    if (this.compact) {
      this.host.classList.add('wa-compact')
      this.host.appendChild(this.makeNav())
      // the app's pages are drawn at the display's height and scaled to what the bar leaves (themes/winamp.css)
      document.body.style.setProperty('--wa-f', ((window.innerHeight - NAV_H) / window.innerHeight).toFixed(4))
    }
    // (the windows are built again for another skin; nothing else in the page depends on them)
    effect(() => {
      const skin = this.svc.skin()
      const loaded = this.svc.skinLoaded()
      untracked(() => this.build(skin, loaded))
    })
    effect(() => {
      // (read first: with the window not built yet the optional call would never touch the signal)
      const state = this.svc.main()
      this.main?.update(state)
    })
    effect(() => {
      const eq = this.svc.eq()
      this.eqView?.setState(eq)
    })
    effect(() => {
      const view = this.svc.right()
      if (this.compact) {
        // one window at a time: the player, or the equaliser / the playlist; the library is the app's own pages under them
        this.left.classList.toggle('wa-hidden', view !== 'player')
        this.right.classList.toggle('wa-hidden', view !== 'eq' && view !== 'pl')
        for (const [name, button] of this.navButtons) button.classList.toggle('wa-nav-on', name === view)
      } else {
        this.right.classList.toggle('wa-hidden', view === 'lib')
      }
      this.eqView?.node.style.setProperty('display', view === 'eq' ? '' : 'none')
      this.plView?.node.style.setProperty('display', view === 'pl' ? '' : 'none')
      if (view === 'pl') setTimeout(() => this.plView?.scrollToCurrent(), 0)
    })
    effect(() => {
      const status = this.svc.eqStatus()
      this.eqView?.setStatus(status)
    })
    effect(() => {
      const entries = this.svc.entries()
      const current = this.svc.currentPosition()
      untracked(() => this.plView?.setEntries(entries, current))
    })
    effect(() => {
      const m = this.svc.main()
      // (the little display of the playlist: where the clock stands)
      this.plView?.setTime(m.durationSeconds > 0 || m.playState !== 'stop' ? formatClock(m.positionSeconds) : '')
    })
  }

  ngOnDestroy(): void {
    this.main?.destroy()
  }

  private build(skin: Skin | null, loaded: boolean): void {
    this.main?.destroy()
    this.left.replaceChildren()
    this.right.replaceChildren()
    this.main = this.eqView = this.plView = undefined
    if (!skin) {
      if (!loaded) return
      const note = el('wa-message')
      note.innerHTML = 'No Winamp skin installed<small>Upload a .wsz skin in the parents\' app: Settings › Appearance › Winamp skin</small>'
      this.left.appendChild(note)
      return
    }
    // the room for the windows: the half of the display (wide) or the display above the bar (compact)
    const areaW = this.compact ? window.innerWidth : HALF
    const areaH = this.compact ? window.innerHeight - NAV_H : SCREEN_H
    const place = (node: HTMLElement, h: number, host: HTMLElement) => {
      // (a window is 275 skin pixels wide; compact: as large as the room allows; wide: a whole number, so every pixel of the
      // skin is as large as the others - 3 on the half of 1920 x 480)
      const scale = this.compact ? Math.min(areaW / MAIN_W, areaH / h) : WIDE_SCALE
      node.style.transform = `scale(${scale})`
      node.style.left = `${Math.round((areaW - MAIN_W * scale) / 2)}px`
      // (at the bottom edge of the room)
      node.style.top = `${Math.round(areaH - h * scale)}px`
      host.appendChild(node)
    }
    this.styleNav(skin)
    const svc = this.svc
    this.main = new WinampMainView(skin, {
      prev: () => svc.prev(),
      play: () => svc.play(),
      pause: () => svc.pause(),
      stop: () => svc.stop(),
      next: () => svc.next(),
      eject: () => svc.showLibrary(),
      seek: (f) => svc.seek(f),
      setVolume: (p) => svc.setVolume(p),
      setBalance: (b) => svc.setBalance(b),
      toggleShuffle: () => (svc.main().shuffleAvailable ? svc.toggleShuffle() : this.toast('Shuffle works with albums from the library, the NAS and Spotify music')),
      toggleRepeat: () => svc.toggleRepeat(),
      toggleEq: () => svc.setRight('eq'),
      togglePlaylist: () => svc.setRight('pl'),
      menu: () => this.menu(skin),
      minimize: () => svc.showLibrary(),
      shade: () => this.toast('Window shade is not available on this display'),
      close: () => svc.stop(),
      clutter: (letter) => this.clutter(letter),
    })
    place(this.main.node, MAIN_H, this.left)

    this.eqView = new WinampEqView(skin, (s) => svc.setEq(s), () => svc.setRight('eq'), svc.presetHost)
    this.eqView.setState(svc.eq())
    this.eqView.setStatus(svc.eqStatus())
    place(this.eqView.node, EQ_H, this.right)

    // (the playlist is as high as the room: wide - the whole height at the factor of the other windows; compact - its own height)
    const plHeight = this.compact ? PL_H : Math.floor(areaH / WIDE_SCALE)
    this.plView = new WinampPlaylistView(skin, {
      play: (entry) => svc.playEntry(entry),
      add: () => svc.showLibrary(),
      rem: () => svc.stop(),
      sel: () => this.plView?.scrollToCurrent(),
      misc: () => this.toast(`${svc.entries().length} tracks`),
      list: () => svc.showLibrary(),
      prev: () => svc.prev(),
      playPause: () => svc.play(),
      pause: () => svc.pause(),
      stop: () => svc.stop(),
      next: () => svc.next(),
      eject: () => svc.showLibrary(),
      close: () => svc.setRight('pl'),
    }, plHeight)
    place(this.plView.node, plHeight, this.right)
    this.main.update(svc.main())
    this.plView.setEntries(svc.entries(), svc.currentPosition())
    const view = svc.right()
    this.eqView.node.style.display = view === 'eq' ? '' : 'none'
    this.plView.node.style.display = view === 'pl' ? '' : 'none'
  }

  // ---------- the bar of the compact layout ----------

  private makeNav(): HTMLElement {
    const icon = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`
    const items: [string, string, string][] = [
      ['player', 'Player', icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path class="f" d="M10 9l5 3-5 3z"/>')],
      ['eq', 'EQ', icon('<path d="M6 4v16M12 4v16M18 4v16"/><circle class="f" cx="6" cy="14" r="2"/><circle class="f" cx="12" cy="8" r="2"/><circle class="f" cx="18" cy="15" r="2"/>')],
      ['pl', 'Playlist', icon('<path d="M4 6h16M4 12h16M4 18h10"/>')],
      ['lib', 'Library', icon('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>')],
    ]
    const nav = el('wa-nav')
    for (const [view, label, svg] of items) {
      const button = el('wa-nav-btn')
      button.innerHTML = `${svg}<span>${label}</span>`
      button.addEventListener('click', () => this.svc.show(view as 'player' | 'eq' | 'pl' | 'lib'))
      nav.appendChild(button)
      this.navButtons.set(view, button)
    }
    this.nav = nav
    return nav
  }

  /** The bar in the skin's playlist colours. */
  private styleNav(skin: Skin): void {
    const c = skin.meta.pledit
    this.nav?.style.setProperty('--wa-nav-bg', c.normalBg)
    this.nav?.style.setProperty('--wa-nav-fg', c.normal)
    this.nav?.style.setProperty('--wa-nav-line', c.selectedBg)
    this.nav?.style.setProperty('--wa-nav-on-bg', c.selectedBg)
    this.nav?.style.setProperty('--wa-nav-on-fg', c.current)
  }

  // ---------- the menu (the logo), the clutter bar and little messages ----------

  private closePopup(): void {
    this.popup?.remove()
    this.popup = undefined
  }

  private menu(skin: Skin): void {
    if (this.popup) return this.closePopup()
    const svc = this.svc
    const pop = el('wa-pop')
    const item = (text: string, fn: () => void) => {
      const row = el('wa-pop-item', {}, 'div')
      row.textContent = text
      row.addEventListener('click', () => {
        this.closePopup()
        fn()
      })
      pop.appendChild(row)
    }
    item('Library', () => svc.showLibrary())
    item('Playlist', () => svc.setRight('pl'))
    item('Equalizer', () => svc.setRight('eq'))
    item('Track info', () => this.clutter('I'))
    const note = el('wa-pop-note', {}, 'div')
    note.textContent = `Skin: ${skin.meta.name}`
    pop.appendChild(note)
    const away = (e: Event) => {
      if (!pop.contains(e.target as Node)) {
        this.closePopup()
        this.left.removeEventListener('pointerdown', away, true)
      }
    }
    this.left.addEventListener('pointerdown', away, true)
    this.left.appendChild(pop)
    this.popup = pop
  }

  private clutter(letter: 'O' | 'A' | 'I' | 'D' | 'V'): void {
    const svc = this.svc
    if (letter === 'O') {
      const skin = svc.skin()
      if (skin) this.menu(skin)
    } else if (letter === 'I') {
      const m = svc.main()
      const media = svc.media()
      const parts = [m.title || 'Nothing is playing', media?.artist, media?.title && media.title !== m.title ? media.title : '', m.volume ? `Volume ${m.volume} %` : '']
      this.toast(parts.filter(Boolean).join(' · '))
    } else if (letter === 'A') {
      this.toast('The window stays on top - there is only one screen here')
    } else if (letter === 'D') {
      this.toast('The window already fills the half display')
    }
    // V (the analyser's mode) is handled by the window itself
  }

  private toast(text: string): void {
    // (compact: the left window is hidden while the equaliser or the playlist shows - the message goes on the page itself)
    const parent = this.compact ? this.host : this.left
    parent.querySelector('.wa-toast')?.remove()
    const t = el('wa-toast')
    t.textContent = text
    parent.appendChild(t)
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => t.remove(), 2800)
  }
}
