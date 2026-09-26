import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MediaService } from '../media.service'

// The WiFi symbol of the status bar as on a phone: a dot and three arcs, as many lit as the reception is good.
//   - not connected to a WiFi and no internet: all dimmed, with a red "x" badge
//   - connected, but no internet: the arcs as they are, with a red "!" badge
// The reception comes from the box's network state (network.json: WiFi name and signal in dBm).

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
      @if (!online()) {
        <circle class="badge" cx="19.5" cy="18.5" r="4.4" />
        @if (connected()) {
          <path class="mark" d="M 19.5 16.2 L 19.5 19" />
          <circle class="mark-dot" cx="19.5" cy="20.9" r="0.7" />
        } @else {
          <path class="mark" d="M 17.6 16.6 L 21.4 20.4 M 21.4 16.6 L 17.6 20.4" />
        }
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
    .badge {
      fill: #ff5252;
      /* a ring in the toolbar colour keeps it visible on themes with a red toolbar */
      stroke: currentColor;
      stroke-width: 1;
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
  private readonly media = inject(MediaService)

  // Everything comes from the network state the app polls anyway (one shared request every 5 s; the box
  // refreshes the file every 30 s). A poll of its own per symbol - one on every page Ionic keeps mounted -
  // started `sudo wpa_cli` twice a request, tens of thousands of times a day.
  private readonly network = toSignal(this.media.network$, { initialValue: undefined })

  // 'offline' only when the network state file says so (not while it is still starting or not asked yet)
  protected readonly online = computed(() => this.network()?.onlinestate !== 'offline')
  // connected to a WiFi: the file names its network
  protected readonly connected = computed(() => !!this.network()?.wifi)
  protected readonly level = computed(() => {
    const network = this.network()
    if (!network) return 0 // not known yet: dimmed rather than full bars
    if (!network.wifi) return this.online() ? 4 : 0 // online without a WiFi: a cable connection
    return wifiLevelOf(signalDbmOf(network.wifisignal))
  })
}

// "-61 dBm" -> -61
function signalDbmOf(text: string | undefined): number | undefined {
  const value = Number.parseInt(String(text ?? ''), 10)
  return Number.isFinite(value) && value < 0 ? value : undefined
}
