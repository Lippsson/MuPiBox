import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { ElternMagicLinkService } from '../eltern-magic-link.service'

// Full-screen overlay shown when a parent opens the Eltern-WebApp entry in
// the Settings page. Renders the magic-link QR (client-generated data URL)
// plus the URL as a text fallback. Auto-closes after 60s.
@Component({
  selector: 'mupi-eltern-magic-link-overlay',
  templateUrl: './eltern-magic-link-overlay.component.html',
  styleUrls: ['./eltern-magic-link-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class ElternMagicLinkOverlayComponent {
  protected readonly svc = inject(ElternMagicLinkService)
}
