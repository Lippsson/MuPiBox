import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { NavigationExtras, Router } from '@angular/router'
import { catchError, interval, of, switchMap, timeout } from 'rxjs'
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
   *  externer Trigger (src !== 'box') erkannt wird. */
  private lastSeenTriggerAt = 0

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
        const at = data.triggerAt ?? 0
        const src = data.triggerSource ?? 'box'
        // Baseline-Tick: erstes Polling-Ergebnis nur lastSeen setzen, nicht
        // auf einen historischen Trigger reagieren.
        if (this.lastSeenTriggerAt === 0) {
          this.lastSeenTriggerAt = at
          return
        }
        if (at > this.lastSeenTriggerAt && src !== 'box' && data.playing === true) {
          this.lastSeenTriggerAt = at
          if (!this.isCurrentlyOnPlayerPage() && !this.isNavigatingToPlayer) {
            console.log(`🎵 External playback trigger from "${src}" — navigating to /player`)
            this.navigateToPlayerExternal()
          }
          return
        }
        if (at > this.lastSeenTriggerAt) this.lastSeenTriggerAt = at
      })
  }

  /** Wie navigateToPlayerPage(), aber ohne Media-Snapshot — die Player-
   *  Page rendert den Track aus mediaService.local$ / current$ live. */
  private navigateToPlayerExternal(): void {
    this.isNavigatingToPlayer = true
    this.router
      .navigate(['/player'])
      .then((success) => {
        if (success) {
          console.log('✅ Navigated to /player after external trigger')
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
