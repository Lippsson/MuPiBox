import { HttpClient } from '@angular/common/http'
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core'
import { isPlatformBrowser } from '@angular/common'
import { retry, timer } from 'rxjs'
import { environment } from 'src/environments/environment'
import { type ClockSettings, DEFAULT_CLOCK, clockSettingsOf } from './clock'
import { MupiboxConfig } from './mupibox-config.model'

/**
 * What the header's clock needs: the parents' settings (read once when the page loads - the app has the display load
 * its page again after a change) and the time, which moves on at every full minute.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  readonly settings = signal<ClockSettings>(DEFAULT_CLOCK)
  readonly now = signal(new Date())

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return
    inject(HttpClient)
      .get<MupiboxConfig>(`${environment.backend.apiUrl}/config`)
      .pipe(retry({ count: 6, delay: (_err, n) => timer(Math.min(15000, 2000 * n)) }))
      .subscribe({ next: (config) => this.settings.set(clockSettingsOf(config?.mupibox)), error: () => undefined })
    this.tick()
  }

  private tick(): void {
    this.now.set(new Date())
    // (a little after the full minute, so the new minute is the one shown)
    setTimeout(() => this.tick(), 60000 - (Date.now() % 60000) + 50)
  }
}
