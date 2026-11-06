import { isPlatformBrowser } from '@angular/common'
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core'
import { NavController } from '@ionic/angular/standalone'
import { environment } from 'src/environments/environment'
import { CoverFlipService } from './cover-flip.service'
import type { Media } from './media'

/** A tab an extension adds after the categories of the home page: no list, a tap runs `onSelect`. */
export interface ExtensionTab {
  id: string
  // the address of an SVG picture (of the extension's own files)
  src: string
  visible: boolean
  onSelect: () => void
}

interface ActiveExtension {
  id: string
  name: string
  version: string
  display?: string
  settings: Record<string, unknown>
}

/** What an extension's display.js gets (docs/extensions.md, "Display"). */
export interface DisplayExtensionApi {
  id: string
  /** The address of a file of the extension. */
  url(file: string): string
  /** The address of the API (for pictures and the like). */
  apiUrl: string
  /** GET on the player (a route from `/…`); the JSON answer, or null when it does not answer. */
  fetch(path: string): Promise<unknown>
  /** Calls `fn` every `ms` while the page is open; an error in it is logged, never thrown. */
  every(ms: number, fn: () => void | Promise<void>): void
  settings(): Record<string, unknown>
  tabs: { set(tab: ExtensionTab): void; remove(id: string): void }
  winamp: { onEject(fn: () => boolean): void }
  player: {
    open(media: Media): void
    /** Albums of this folder name (`libraryPath`) are never kept for "Fortsetzen" - however they were started. */
    noResumeFolder(folder: string): void
  }
}

/**
 * The extensions of the box on the display (docs/extensions.md): the API says which are on, and the `display.js` of each is loaded
 * as a module and gets an `api` to add tabs, to take over the eject button and to start the player with an album. Whatever an
 * extension does goes through guards here: an error is logged and ends that extension's part, never the display.
 */
@Injectable({ providedIn: 'root' })
export class ExtensionHostService {
  /** The tabs the extensions have added (in the order of the extensions). */
  readonly tabs = signal<ExtensionTab[]>([])
  private readonly ejectHandlers: { id: string; fn: () => boolean }[] = []
  private readonly navController = inject(NavController)
  private readonly coverFlip = inject(CoverFlipService)
  private readonly noResumeFolders = new Set<string>()
  private started = false

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return
    void this.start()
  }

  /** A tab was tapped. */
  select(id: string): void {
    this.guard(id, 'tab', () => this.tabs().find((t) => t.id === id)?.onSelect())
  }

  /** An album an extension provides, that is not kept for "Fortsetzen" (the disc may be gone, or another in the drive, when it is picked). */
  noResume(media: Media | null | undefined): boolean {
    return !!media && (media.noResume === true || (!!media.libraryPath && this.noResumeFolders.has(media.libraryPath)))
  }

  /** The eject button of the Winamp window: true when an extension handled it. */
  eject(): boolean {
    for (const handler of this.ejectHandlers) {
      if (this.guard(handler.id, 'eject', handler.fn) === true) return true
    }
    return false
  }

  private guard<T>(id: string, where: string, fn: () => T): T | undefined {
    try {
      return fn()
    } catch (error) {
      console.warn(`[Extension ${id}] error in ${where}:`, error)
      return undefined
    }
  }

  private async start(): Promise<void> {
    if (this.started) return
    this.started = true
    let active: ActiveExtension[]
    try {
      const response = await fetch(`${environment.backend.apiUrl}/ext/active`)
      active = response.ok ? await response.json() : []
    } catch {
      return
    }
    const origin = new URL(environment.backend.apiUrl).origin
    for (const ext of active) {
      if (!ext.display) continue
      try {
        // (a file read at run time from the box, not part of this bundle)
        const mod = await import(/* @vite-ignore */ `${origin}${ext.display}?v=${encodeURIComponent(ext.version)}`)
        if (typeof mod.activate !== 'function') throw new Error('display.js has no activate()')
        mod.activate(this.apiFor(ext, origin))
      } catch (error) {
        console.warn(`[Extension ${ext.id}] could not start its display part:`, error)
      }
    }
  }

  private apiFor(ext: ActiveExtension, origin: string): DisplayExtensionApi {
    const id = ext.id
    return {
      id,
      url: (file) => `${origin}/ext/${id}/${file}`,
      apiUrl: environment.backend.apiUrl,
      fetch: async (path) => {
        try {
          const response = await fetch(`${environment.backend.playerUrl}${path}`)
          return response.ok ? await response.json() : null
        } catch {
          return null
        }
      },
      every: (ms, fn) => {
        const run = () => {
          try {
            void Promise.resolve(fn()).catch((error) => console.warn(`[Extension ${id}] error:`, error))
          } catch (error) {
            console.warn(`[Extension ${id}] error:`, error)
          }
        }
        run()
        setInterval(run, ms)
      },
      settings: () => ext.settings,
      tabs: {
        set: (tab) => {
          const tabs = this.tabs()
          const full = { ...tab, id: `${id}:${tab.id}` }
          const at = tabs.findIndex((t) => t.id === full.id)
          this.tabs.set(at >= 0 ? tabs.map((t, i) => (i === at ? full : t)) : [...tabs, full])
        },
        remove: (tabId) => this.tabs.set(this.tabs().filter((t) => t.id !== `${id}:${tabId}`)),
      },
      winamp: { onEject: (fn) => void this.ejectHandlers.push({ id, fn }) },
      player: {
        open: (media) => {
          void this.navController.navigateForward(['/player'], { state: { media }, animation: this.coverFlip.animation })
        },
        noResumeFolder: (folder) => void this.noResumeFolders.add(folder),
      },
    }
  }
}
