import { HttpClient } from '@angular/common/http'
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core'
import { isPlatformBrowser } from '@angular/common'
import { catchError, of, switchMap, timer } from 'rxjs'
import { environment } from 'src/environments/environment'
import { CD_LIBRARY_PATH, type Media } from './media'

/** What the player says about the CD drive (GET /cd): an audio CD is in it, with so many tracks; `id` counts up per disc. */
export interface CdState {
  present: boolean
  tracks: number
  id: number
  // what the player found on the internet (Discogs, MusicBrainz): artist, album and whether a cover came with it
  artist?: string
  album?: string
  cover?: boolean
}

/**
 * The audio CD in the drive, for the "CD" category of the home page: asked of the player every few seconds. A tap on the
 * category plays the disc from its first track (cdMedia() is what the player page starts, like any local album).
 */
@Injectable({ providedIn: 'root' })
export class CdService {
  readonly state = signal<CdState>({ present: false, tracks: 0, id: 0 })

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return
    const http = inject(HttpClient)
    timer(0, 3000)
      .pipe(switchMap(() => http.get<CdState>(`${environment.backend.playerUrl}/cd`).pipe(catchError(() => of(null)))))
      .subscribe((state) => {
        // (a player that does not answer for a moment, or an old one without /cd: no change, or no CD)
        if (!state) return
        const now = this.state()
        if (state.present !== now.present || state.tracks !== now.tracks || state.id !== now.id || state.album !== now.album || state.cover !== now.cover) this.state.set(state)
      })
  }

  /** The disc as a local album: the player's page plays it from the first track. Its place is never kept for "Fortsetzen". */
  cdMedia(): Media {
    const state = this.state()
    return {
      type: 'library',
      category: 'audiobook',
      artist: state.artist || 'CD',
      title: state.album || 'Audio-CD',
      id: CD_LIBRARY_PATH,
      libraryPath: CD_LIBRARY_PATH,
      // (the disc's own picture when one was found; the disc's id in the address, so another disc is another picture)
      cover: state.cover ? `${environment.backend.apiUrl}/cd-cover?v=${state.id}` : 'assets/cd-cover.svg',
      cdrom: true,
    }
  }
}
