import { HttpClient } from '@angular/common/http'
import { Injectable, inject, signal } from '@angular/core'
import { environment } from '../environments/environment'

// Texts of the overlays on the box display. Parents can replace every one of them in the parents'
// web app (Settings > "Texts on the display"), e.g. in their own language; a missing or empty
// entry falls back to these English defaults (the rest of the box UI is English too).
export const DEFAULT_DISPLAY_TEXTS = {
  blockedHeading: "That's enough music for today",
  blockedSubheading: 'More music tomorrow',
  quietHeading: 'Quiet time',
  quietSubheading: 'Music will be back soon',
  parentsTitle: 'Parent setup',
  parentsHint: 'Scan with your phone or open in a browser:',
  parentsCountdown: 'Disappears in {s} s',
  parentsClose: 'Close',
}
export type DisplayTextKey = keyof typeof DEFAULT_DISPLAY_TEXTS

@Injectable({ providedIn: 'root' })
export class DisplayTextsService {
  private http = inject(HttpClient)
  private readonly stored = signal<Partial<Record<DisplayTextKey, string>>>({})

  constructor() {
    this.refresh()
  }

  /** Reads the texts again (called when an overlay appears, so a change shows up without a reload). */
  public refresh(): void {
    this.http.get<{ displayTexts?: Record<string, unknown> }>(`${environment.backend.apiUrl}/config`).subscribe({
      next: (config) => {
        const raw = config?.displayTexts ?? {}
        const texts: Partial<Record<DisplayTextKey, string>> = {}
        for (const key of Object.keys(DEFAULT_DISPLAY_TEXTS) as DisplayTextKey[]) {
          const value = raw[key]
          if (typeof value === 'string' && value.trim()) texts[key] = value.trim()
        }
        this.stored.set(texts)
      },
      // keep what we have (or the defaults) when the backend is not reachable
      error: () => {},
    })
  }

  /** The text for `key`; {name} placeholders are filled from `values`. Reading it inside a computed/template tracks changes. */
  public text(key: DisplayTextKey, values: Record<string, string | number> = {}): string {
    const template = this.stored()[key] ?? DEFAULT_DISPLAY_TEXTS[key]
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole))
  }
}
