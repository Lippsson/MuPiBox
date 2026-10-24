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
const SCALE = HALF / MAIN_W

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
    mupi-winamp-shell .wa-half-right.wa-hidden { display: none; }
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
  private readonly left = el('wa-half wa-half-left')
  private readonly right = el('wa-half wa-half-right wa-hidden')
  private main: WinampMainView | undefined
  private eqView: WinampEqView | undefined
  private plView: WinampPlaylistView | undefined
  private popup: HTMLElement | undefined
  private toastTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    this.host.append(this.left, this.right)
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
      this.right.classList.toggle('wa-hidden', view === 'lib')
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
    const place = (node: HTMLElement, h: number, host: HTMLElement) => {
      node.style.transform = `scale(${SCALE})`
      node.style.left = '0px'
      // (at the bottom edge of the screen)
      node.style.top = `${Math.round(SCREEN_H - h * SCALE)}px`
      host.appendChild(node)
    }
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
      toggleShuffle: () => (svc.main().shuffleAvailable ? svc.toggleShuffle() : this.toast('Shuffle works with Spotify albums and playlists')),
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
    })
    this.plView.node.style.transform = `scale(${SCALE})`
    this.plView.node.style.left = '0px'
    this.plView.node.style.top = `${Math.round((SCREEN_H - PL_H * SCALE) / 2)}px`
    this.right.appendChild(this.plView.node)
    this.main.update(svc.main())
    this.plView.setEntries(svc.entries(), svc.currentPosition())
    const view = svc.right()
    this.eqView.node.style.display = view === 'eq' ? '' : 'none'
    this.plView.node.style.display = view === 'pl' ? '' : 'none'
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
    this.left.querySelector('.wa-toast')?.remove()
    const t = el('wa-toast')
    t.textContent = text
    this.left.appendChild(t)
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => t.remove(), 2800)
  }
}
