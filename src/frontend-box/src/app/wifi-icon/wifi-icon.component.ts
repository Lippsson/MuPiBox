import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { catchError, of, switchMap, timer } from 'rxjs'
import { MediaService } from '../media.service'
import { WifiService } from '../wifi.service'

// The WiFi symbol of the status bar as on a phone: a dot and three arcs, as many lit as the reception is good.
//   - not connected to a WiFi: all dimmed, crossed out
//   - connected, but no internet: the arcs as they are, with a "!" badge
// The reception comes from the live link (/api/wifi/status), asked for every 10 seconds.
const POLL_MS = 10_000

// dBm -> 0..4 lit parts (dot, then the arcs from the inside out)
export function wifiLevelOf(signalDbm: number | undefined): number {
  if (signalDbm === undefined) return 3 // connected, the value is not available right now
  if (signalDbm >= -55) return 4
  if (signalDbm >= -65) return 3
  if (signalDbm >= -75) return 2
  if (signalDbm >= -85) return 1
  return 0
}

@Component({
  selector: 'mupi-wifi-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="wifi" viewBox="0 3 24 20" role="img" aria-label="WiFi">
      <path class="arc" [class.on]="level() >= 4" d="M 2.1 9.1 A 14 14 0 0 1 21.9 9.1" />
      <path class="arc" [class.on]="level() >= 3" d="M 5.28 12.28 A 9.5 9.5 0 0 1 18.72 12.28" />
      <path class="arc" [class.on]="level() >= 2" d="M 8.46 15.46 A 5 5 0 0 1 15.54 15.46" />
      <circle class="dot" [class.on]="level() >= 1" cx="12" cy="19" r="1.9" />
      @if (!connected() && !online()) {
        <path class="slash" d="M 3 4 L 21 22" />
      }
      @if (connected() && !online()) {
        <circle class="badge" cx="19.5" cy="18.5" r="4.4" />
        <path class="mark" d="M 19.5 16.2 L 19.5 19" />
        <circle class="mark-dot" cx="19.5" cy="20.9" r="0.7" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .wifi {
      width: 30px;
      height: 25px;
      overflow: visible;
    }
    .arc {
      fill: none;
      stroke: currentColor;
      stroke-width: 2.3;
      stroke-linecap: round;
      opacity: 0.3;
    }
    .dot {
      fill: currentColor;
      opacity: 0.3;
    }
    .on {
      opacity: 1;
    }
    .slash {
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }
    .badge {
      fill: #ff5252;
    }
    .mark {
      stroke: #fff;
      stroke-width: 1.5;
      stroke-linecap: round;
    }
    .mark-dot {
      fill: #fff;
    }
  `,
})
export class WifiIconComponent {
  private readonly wifi = inject(WifiService)
  private readonly media = inject(MediaService)

  private readonly status = toSignal(
    timer(0, POLL_MS).pipe(switchMap(() => this.wifi.getStatus().pipe(catchError(() => of(undefined))))),
    { initialValue: undefined },
  )
  // 'offline' only when the network state file says so (not while it is still starting or not asked yet)
  private readonly network = toSignal(this.media.network$, { initialValue: undefined })
  private readonly onlineState = computed(() => this.network()?.onlinestate !== 'offline')

  protected readonly connected = computed(() => this.status()?.state === 'COMPLETED')
  protected readonly online = computed(() => this.onlineState())
  protected readonly level = computed(() => {
    const status = this.status()
    if (!status) return 4 // not asked yet: no flicker of an empty symbol at start
    if (status.state !== 'COMPLETED') return this.onlineState() ? 4 : 0 // e.g. a cable connection
    return wifiLevelOf(status.signalDbm)
  })
}
