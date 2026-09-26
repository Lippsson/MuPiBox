import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { NavigationExtras, Router } from '@angular/router'
import { catchError, firstValueFrom, interval, of, switchMap, timeout } from 'rxjs'
import { filter, map } from 'rxjs/operators'
import { environment } from 'src/environments/environment'
import type { CurrentMPlayer } from './current.mplayer'
import type { Media } from './media'
import { SpotifyService } from './spotify.service'

@Injectable({
  providedIn: 'root',
})
export class ExternalPlaybackNavigatorService {
  private isNavigatingToPlayer = false
  /** Phase 19 Stufe B: höchster triggerAt-Wert, den wir aus /local schon
   *  gesehen haben. Beim Start initialisiert auf aktuellen Wert (kein
   *  Navigieren auf Baseline), danach hochgezählt sobald ein neuer
   *  externer Trigger (src !== 'box') erkannt wird.
   *
   *  `null` heißt "Baseline noch nicht gesetzt" und ist bewusst NICHT 0:
   *  spotify-control.js initialisiert triggerAt selbst mit 0 und setzt es
   *  erst beim ersten Wiedergabebefehl auf Date.now(). Mit 0 als Sentinel
   *  blieb die Baseline nach jedem Player-Neustart auf 0 stehen, und der
   *  erste echte externe Trigger lief in den Baseline-Zweig statt in die
   *  Navigation — das Display folgte erst beim zweiten Tippen. */
  private lastSeenTriggerAt: number | null = null
  /** An external start not followed yet: until when (ms) to wait for it to play, 0 = none. */
  private pendingExternalUntil = 0
  private pendingExternalSource = ''
  /** Same idea for "show the new theme now" from the parents' web app (see checkThemeReload). */
  private lastSeenThemeReloadAt: number | null = null
  /** Tick-Zähler für die gedrosselte Abfrage auf der Player-Page. */
  private pollTick = 0

  constructor(
    private router: Router,
    private spotifyService: SpotifyService,
    private http: HttpClient,
  ) {
    this.initializeExternalPlaybackDetection()
    this.initializeTriggerSourcePolling()
  }

  private initializeExternalPlaybackDetection(): void {
    // Monitor external playback detection
    this.spotifyService.trackChangeDetected$
      .pipe(
        filter((track) => track !== null),
        filter(() => !this.isCurrentlyOnPlayerPage()),
        filter(() => !this.isNavigatingToPlayer),
        map((track) => this.spotifyService.createMediaFromSpotifyTrack(track)),
      )
      .subscribe({
        next: (media: Media) => {
          console.log('🎵 Auto-navigating to player page for external Spotify playback:', media.title)
          this.navigateToPlayerPage(media)
        },
        error: (error) => console.error('Error in external playback detection:', error),
      })
  }

  /** Polling-basierter Watcher auf den triggerSource-Flag aus /local.
   *  Greift für ALLE Player-Typen (mplayer/Library/Radio/RSS — der
   *  Spotify-Pfad ist eh schon von trackChangeDetected$ abgedeckt) und
   *  reagiert auf Eltern-WebApp- bzw. Telegram-Bot-Trigger.
   *
   *  Bewusst KEIN Subscribe auf mediaService.local$ — das würde via B11-
   *  Anti-Pattern das Spotify-SDK-Polling 24/7 hot halten und Connect-
   *  Device-Aktivierung stören. Eigener HttpClient.get reicht: /local ist
   *  ein billiger statischer State-Dump im spotify-control.js. */
  private initializeTriggerSourcePolling(): void {
    // 2s ist ein guter Kompromiss: spürbar genug für "ich tipp in WebApp,
    // Display switcht in <3s", ohne unnötiges Load auf den Player.
    interval(2000)
      .pipe(
        // Auf der Player-Page wird grundsätzlich nicht navigiert (siehe
        // isCurrentlyOnPlayerPage()-Guard unten) — dort hält der Poll nur
        // noch lastSeenTriggerAt aktuell, und dafür reicht ein Fünftel der
        // Frequenz. Das ist genau der Zustand, in dem die Box am längsten
        // steht (Kind hört etwas) und auf Akku läuft: 43.200 Requests/Tag
        // sinken damit auf rund 9.000, ohne dass die Reaktionszeit ausserhalb
        // der Player-Page leidet.
        filter(() => !this.isCurrentlyOnPlayerPage() || this.pollTick++ % 5 === 0),
        switchMap(() =>
          this.http
            .get<CurrentMPlayer>(`${environment.backend.playerUrl}/local`)
            .pipe(
              timeout(1500),
              catchError(() => of({} as CurrentMPlayer)),
            ),
        ),
      )
      .subscribe((data) => {
        this.checkThemeReload(data.themeReloadAt)
        const at = data.triggerAt ?? 0
        const src = data.triggerSource ?? 'box'
        // Baseline-Tick: erstes Polling-Ergebnis nur lastSeen setzen, nicht
        // auf einen historischen Trigger reagieren.
        if (this.lastSeenTriggerAt === null) {
          this.lastSeenTriggerAt = at
          return
        }
        if (at > this.lastSeenTriggerAt) {
          this.lastSeenTriggerAt = at
          // A start from the parents' web app or Telegram is followed once it really plays. A NAS album (its
          // track list is fetched first) or a stream takes a few seconds: the trigger waits for that instead of
          // being used up by a poll that still saw nothing playing.
          this.pendingExternalUntil = src !== 'box' ? Date.now() + 30_000 : 0
          this.pendingExternalSource = src
        }
        if (this.pendingExternalUntil && data.playing === true) {
          const stillPending = Date.now() < this.pendingExternalUntil
          this.pendingExternalUntil = 0
          if (stillPending && !this.isCurrentlyOnPlayerPage() && !this.isNavigatingToPlayer) {
            console.log(`🎵 External playback trigger from "${this.pendingExternalSource}" — navigating to /player`)
            void this.navigateToPlayerExternal(data)
          }
        }
      })
  }

  /** The parents' web app switched the theme and asked for it to show now. Rides on the /local poll
   *  above (no extra requests). The first value only sets the baseline, like triggerAt; a player
   *  restart resets it to 0, which is then just a new baseline. */
  private checkThemeReload(reloadAt: number | undefined): void {
    if (typeof reloadAt !== 'number') return
    if (this.lastSeenThemeReloadAt === null || reloadAt < this.lastSeenThemeReloadAt) {
      this.lastSeenThemeReloadAt = reloadAt
      return
    }
    if (reloadAt === this.lastSeenThemeReloadAt) return
    this.lastSeenThemeReloadAt = reloadAt
    this.reloadThemeStylesheet(reloadAt)
  }

  /** active_theme.css is a symlink to the chosen theme; loading it again under a new query string
   *  picks up the new target. The old stylesheet goes once the new one has loaded, so the display
   *  doesn't flash unstyled. No page reload: playback and the Spotify player keep running. */
  private reloadThemeStylesheet(version: number): void {
    const old = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).filter((l) =>
      (l.getAttribute('href') ?? '').startsWith('active_theme.css'),
    )
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `active_theme.css?v=${version}`
    link.onload = () => {
      for (const l of old) l.remove()
    }
    if (old.length) old[old.length - 1].after(link)
    else document.head.appendChild(link)
    console.log('🎨 Theme reloaded on request from the parents app')
  }

  /** Navigation aus dem Polling-Pfad: baut bei mplayer-Tracks (Library/RSS/
   *  Radio) ein Media-Objekt aus den /local-Daten und gibt es als
   *  navigationExtras.state mit. Player-Page erkennt am `externalPlayback:
   *  true` Flag dass Track schon läuft und ruft NICHT playMedia() doppelt. */
  private async navigateToPlayerExternal(data: CurrentMPlayer): Promise<void> {
    const media = this.buildMediaFromLocal(data)
    this.isNavigatingToPlayer = true
    // A NAS album: its cover is the one the NAS tab shows, found in the listing of the parent folder.
    if (media?.type === 'nas' && media.nasPath) {
      const parent = media.nasPath.split('/').slice(0, -1).join('/')
      const siblings = await firstValueFrom(
        this.http
          .get<Media[]>(`${environment.backend.apiUrl}/nas/children?path=${encodeURIComponent(parent)}`)
          .pipe(
            timeout(2000),
            catchError(() => of([] as Media[])),
          ),
      )
      const own = siblings.find((entry) => entry.nasPath === media.nasPath)
      if (own?.cover) {
        media.cover = own.cover
        media.artistcover = own.artistcover
      }
    }
    const extras: NavigationExtras = { state: { externalPlayback: true } }
    if (media) (extras.state as Record<string, unknown>).media = media
    this.router
      .navigate(['/player'], extras)
      .then((success) => {
        if (success) {
          console.log('✅ Navigated to /player after external trigger', media ? `(media: ${media.type})` : '(no media)')
        } else {
          console.warn('⚠️ External-trigger navigation to /player returned false')
        }
        setTimeout(() => {
          this.isNavigatingToPlayer = false
        }, 3000)
      })
      .catch((error) => {
        console.error('❌ External-trigger navigation failed:', error)
        this.isNavigatingToPlayer = false
      })
  }

  /** Baut ein Media-Object aus /local-Daten. Spotify-Tracks lassen wir
   *  null und delegieren an handleExternalPlayback (das nutzt schon
   *  spotifyService.currentTrack$ für ein vollständiges Media-Objekt). */
  private buildMediaFromLocal(data: CurrentMPlayer): Media | null {
    if (data.currentPlayer !== 'mplayer') return null
    const path = String((data as { path?: string }).path ?? '')
    // A NAS album (started from the parents' web app): path is the album folder on the NAS. The player page
    // loads its track list by nasPath, and the cover is the folder's picture as the NAS tab shows it.
    if ((data as { currentType?: string }).currentType === 'nas' && path) {
      const folders = path.split('/').filter(Boolean)
      return {
        type: 'nas',
        category: 'nas',
        artist: folders[folders.length - 2] ?? '',
        title: String(data.album ?? folders[folders.length - 1] ?? ''),
        nasPath: path,
      } as Media
    }
    const pathParts = path.split('/').filter(Boolean)
    const category = pathParts[0] || 'music'
    const artist = pathParts[1] || ''
    const title = String(data.album ?? pathParts[2] ?? '')
    // currentType aus /local mappt direkt auf media.type
    const ctype = String((data as { currentType?: string }).currentType ?? 'local')
    const type: Media['type'] =
      ctype === 'rss' ? 'rss' : ctype === 'radio' ? 'radio' : 'library'
    return { type, category, artist, title } as Media
  }

  private isCurrentlyOnPlayerPage(): boolean {
    const isOnPlayerPage = this.router.url === '/player'
    if (isOnPlayerPage) {
      console.log('🏠 Already on player page - skipping auto-navigation')
    }
    return isOnPlayerPage
  }

  private navigateToPlayerPage(media: Media): void {
    // Prevent multiple simultaneous navigations
    this.isNavigatingToPlayer = true

    const navigationExtras: NavigationExtras = {
      state: {
        media: media,
      },
    }

    this.router
      .navigate(['/player'], navigationExtras)
      .then((success) => {
        if (success) {
          console.log('✅ Successfully navigated to player page for external playback')
        } else {
          console.warn('⚠️ Failed to navigate to player page for external playback')
        }

        // Reset navigation flag after a short delay
        setTimeout(() => {
          this.isNavigatingToPlayer = false
        }, 3000)
      })
      .catch((error) => {
        console.error('❌ Error navigating to player page for external playback:', error)
        this.isNavigatingToPlayer = false
      })
  }
}
