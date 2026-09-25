import { ChangeDetectionStrategy, Component, computed, inject, Signal } from '@angular/core'
import { IonIcon } from '@ionic/angular/standalone'
import { addIcons } from 'ionicons'
import { hourglassOutline, moonOutline, musicalNotesOutline } from 'ionicons/icons'
import { DisplayTextsService } from '../display-texts.service'
import { PlaytimeService } from '../playtime.service'

interface OverlayContent {
  iconName: string
  heading: string
  subheading: string
}

@Component({
  selector: 'mupi-playtime-blocked',
  templateUrl: './playtime-blocked-overlay.component.html',
  styleUrls: ['./playtime-blocked-overlay.component.scss'],
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaytimeBlockedOverlayComponent {
  private playtimeService = inject(PlaytimeService)
  private texts = inject(DisplayTextsService)

  protected readonly content: Signal<OverlayContent> = computed(() => {
    const s = this.playtimeService.status()
    if (s.enabled !== true || s.blockSource !== 'quiet') {
      return {
        iconName: 'moon-outline',
        heading: this.texts.text('blockedHeading'),
        subheading: this.texts.text('blockedSubheading'),
      }
    }
    // A quiet window with a label ("Bedtime", "Homework") shows that label as the heading.
    const label = s.quiet.label?.trim()
    return {
      iconName: label ? 'hourglass-outline' : 'moon-outline',
      heading: label || this.texts.text('quietHeading'),
      subheading: this.texts.text('quietSubheading'),
    }
  })

  constructor() {
    addIcons({ moonOutline, musicalNotesOutline, hourglassOutline })
    // created each time playback gets blocked: pick up texts changed in the meantime
    this.texts.refresh()
  }
}
