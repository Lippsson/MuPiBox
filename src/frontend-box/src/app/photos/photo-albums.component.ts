import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, untracked } from '@angular/core'
import { type DisplayTextKey, DisplayTextsService } from '../display-texts.service'
import { PlayerService } from '../player.service'
import { PhotoTimeService } from './photo-time.service'
import { type PhotoAlbumSummary, PhotosService } from './photos.service'

// one page: three albums, 800 wide (handoff §4: left = 15 + i × 266,67 − page × 800 - on a wider display the fourth
// album peeks in on the right, wanted)
const STEP = 800 / 3
const PAGE = 800
const PER_PAGE = 3

/**
 * The tab "Fotos" on the start page (handoff §4): the albums as stacks of pictures, three a page, swiped sideways;
 * a tap on a stack opens the album. Colours only from the theme (--km-*), with plain ones for the old themes.
 */
@Component({
  selector: 'mupi-photo-albums',
  template: `
    @if (time.blocked()) {
      <!-- the photo time is used up (handoff §8, 07_bildzeit-vorbei_eigenes-limit.png): the photos pause -->
      <div class="pp">
        <svg class="pp-fig" viewBox="0 0 220 220" aria-hidden="true">
          <g transform="rotate(-9 110 120)"><rect x="40" y="52" width="140" height="120" rx="18" class="pp-back" /></g>
          <g transform="rotate(4 110 120)">
            <rect x="34" y="62" width="152" height="124" rx="18" class="pp-front" />
            <path d="M74 120q12 10 24 0M122 120q12 10 24 0" class="pp-eye" />
            <path d="M98 146q12 7 24 0" class="pp-eye" />
          </g>
          <text x="168" y="44" class="pp-z">z</text>
          <text x="186" y="26" class="pp-z pp-z2">z</text>
          <text x="200" y="12" class="pp-z pp-z3">z</text>
        </svg>
        <div class="pp-text">
          <h2>{{ texts.text('photosPauseTitle') }}</h2>
          <p>{{ texts.text('photosPauseText') }}</p>
          <div class="pp-btns">
            <button type="button" class="pp-go" (click)="toListening.emit()">{{ texts.text('photosToListening') }}</button>
            <button type="button" class="pp-parents" (click)="parents()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              <span>{{ texts.text('photosParents') }}</span>
            </button>
          </div>
        </div>
      </div>
    } @else if (photos.allAway()) {
      <!-- no album there (handoff 10_nichts-erreichbar.png): all live from an Immich that is away -->
      <div class="pp">
        <svg class="pp-fig" viewBox="0 0 220 220" aria-hidden="true">
          <path d="M62 150h96a34 34 0 0 0 0-68 50 50 0 0 0-96 10 29 29 0 0 0 0 58z" class="pp-cloud" />
          <path d="M60 60l100 100" class="pp-cross" />
        </svg>
        <div class="pp-text">
          <h2>{{ texts.text('photosAllAwayTitle') }}</h2>
          <p>{{ texts.text('photosAllAwayText') }}</p>
          <div class="pp-btns">
            <button type="button" class="pp-go" (click)="retry()">{{ texts.text('photosRetry') }}</button>
          </div>
        </div>
      </div>
    } @else {
    <div class="pa" (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="cancel()">
      <div class="pa-track" [style.transform]="'translateX(' + -page() * PAGE + 'px)'">
        @for (a of albums(); track a.id; let i = $index) {
          <!-- the stack opens the album, the name under it is read out (as the names in the other tabs) -->
          <div class="pa-tile" [class.pa-away]="a.away" [style.left.px]="15 + i * STEP">
            <button class="pa-stack" type="button" [attr.aria-label]="openLabel(a)" (click)="open(a)">
              <span class="pa-back"></span>
              @if (a.pictures[1]) {
                <img class="pa-mid" [src]="photos.fileUrl(a.id, a.pictures[1], 's')" alt="" draggable="false" />
              } @else {
                <span class="pa-mid pa-empty"></span>
              }
              <img class="pa-front" [src]="photos.fileUrl(a.id, a.pictures[0], 's')" alt="" draggable="false" />
              <span class="pa-badge">{{ a.count }}</span>
              @if (a.away) {
                <span class="pa-away-pill">{{ texts.text('photosAway') }}</span>
              }
            </button>
            <button class="pa-name" type="button" [class.pa-speaking]="speaking() === a.id" (click)="read(a)">{{ a.title }}</button>
          </div>
        }
      </div>
      @if (pages() > 1) {
        <div class="pa-dots">
          @for (p of pageList(); track p) {
            <button type="button" class="pa-dot" [class.on]="p === page()" [attr.aria-label]="p + 1" (click)="page.set(p)"><i></i></button>
          }
        </div>
      }
    </div>
    }
    @if (hint(); as h) {
      <div class="pp-hint" role="status">
        <span class="pp-hint-ic">i</span>
        <span>{{ texts.text(h) }}</span>
      </div>
    }
  `,
  styles: `
    .pp {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 52px;
      padding: 0 30px 20px;
    }
    .pp-fig {
      flex: 0 0 220px;
      width: 220px;
      height: 220px;
      overflow: visible;
    }
    /* (an album not there: grey, with its note) */
    .pa-away .pa-back,
    .pa-away .pa-mid,
    .pa-away .pa-front {
      filter: grayscale(1);
      opacity: 0.55;
    }
    .pa-away-pill {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      padding: 8px 16px;
      border-radius: 20px;
      background: var(--km-cream, #fff6e5);
      color: var(--km-ink, #2b2240);
      font-size: 17px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 3px 0 var(--km-shadow, rgba(0, 0, 0, 0.25));
    }
    .pp-cloud {
      fill: var(--km-night-3, #3b3456);
      stroke: var(--km-ring, var(--km-cream, #fff6e5));
      stroke-width: 6;
    }
    .pp-cross {
      stroke: var(--km-apricot, #f7b267);
      stroke-width: 10;
      stroke-linecap: round;
    }
    .pp-back {
      fill: var(--km-cream, #fff6e5);
    }
    .pp-front {
      fill: var(--km-night-3, #3b3456);
      stroke: var(--km-ring, var(--km-cream, #fff6e5));
      stroke-width: 6;
    }
    .pp-eye {
      fill: none;
      stroke: var(--km-cream, #fff6e5);
      stroke-width: 5;
      stroke-linecap: round;
    }
    .pp-z {
      fill: var(--km-apricot, #f7b267);
      font-size: 26px;
      font-weight: 700;
    }
    .pp-z2 {
      font-size: 21px;
    }
    .pp-z3 {
      font-size: 16px;
    }
    .pp-text {
      max-width: 420px;
    }
    .pp-text h2 {
      margin: 0 0 10px;
      font-size: 34px;
      font-weight: 600;
      color: var(--km-on-bg, #fff);
    }
    .pp-text p {
      margin: 0 0 22px;
      font-size: 19px;
      line-height: 1.35;
      color: var(--km-lavender, rgba(255, 255, 255, 0.75));
    }
    .pp-btns {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .pp-go,
    .pp-parents {
      border: 0;
      font: inherit;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 0 var(--km-shadow, rgba(0, 0, 0, 0.25));
      -webkit-tap-highlight-color: transparent;
      transition: transform 150ms var(--km-spring, ease-out);
    }
    .pp-go:active,
    .pp-parents:active {
      transform: scale(0.95);
    }
    .pp-go {
      height: 64px;
      padding: 0 28px;
      border-radius: 32px;
      font-size: 21px;
      background: var(--km-apricot, #f7b267);
      color: var(--km-ink, #2b2240);
    }
    .pp-parents {
      height: 48px;
      padding: 0 20px 0 16px;
      border-radius: 24px;
      font-size: 17px;
      background: var(--km-night-2, rgba(0, 0, 0, 0.4));
      color: var(--km-on-bg, #fff);
    }
    .pp-parents svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
    }
    .pp-hint {
      position: absolute;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      max-width: calc(100% - 60px);
      min-height: 56px;
      padding: 8px 24px 8px 8px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: 28px;
      background: var(--km-cream, #fff6e5);
      color: var(--km-ink, #2b2240);
      font-size: 19px;
      font-weight: 600;
      box-shadow: 0 4px 0 var(--km-shadow, rgba(0, 0, 0, 0.25));
    }
    .pp-hint-ic {
      flex: 0 0 40px;
      height: 40px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--km-apricot, #f7b267);
      font-weight: 700;
    }
    :host {
      display: block;
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    .pa {
      position: absolute;
      inset: 0;
      touch-action: pan-y;
      user-select: none;
      -webkit-user-select: none;
    }
    .pa-track {
      position: absolute;
      inset: 0;
      transition: transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .pa-tile {
      position: absolute;
      /* (the covers' top: y 106 on the screen, the page starts below the 72 px header) */
      top: 34px;
      width: 236px;
    }
    .pa-stack {
      position: relative;
      display: block;
      width: 236px;
      height: 236px;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      -webkit-tap-highlight-color: transparent;
      transition: transform 150ms var(--km-spring, ease-out);
    }
    .pa-stack:active {
      transform: scale(0.96);
    }
    .pa-back,
    .pa-mid,
    .pa-front {
      position: absolute;
      inset: 0;
      width: 236px;
      height: 236px;
      box-sizing: border-box;
      border-radius: 32px;
    }
    .pa-back {
      background: var(--km-cream, #fff6e5);
      transform: rotate(-6deg);
      box-shadow: 0 4px 0 var(--km-shadow, rgba(0, 0, 0, 0.25));
    }
    .pa-mid,
    .pa-front {
      object-fit: cover;
      border: 6px solid var(--km-ring, var(--km-cream, #fff6e5));
      background: var(--km-night-3, #4a4560);
    }
    .pa-mid {
      transform: rotate(4deg);
      box-shadow: 0 4px 0 var(--km-shadow, rgba(0, 0, 0, 0.25));
    }
    .pa-front {
      box-shadow: 0 6px 0 var(--km-shadow, rgba(0, 0, 0, 0.25));
    }
    .pa-badge {
      position: absolute;
      right: -6px;
      bottom: -6px;
      min-width: 46px;
      height: 46px;
      padding: 0 10px;
      box-sizing: border-box;
      border-radius: 23px;
      background: var(--km-apricot, #f7b267);
      color: var(--km-ink, #2b2240);
      font-size: 19px;
      font-weight: 700;
      display: grid;
      place-items: center;
      box-shadow: 0 3px 0 var(--km-shadow, rgba(0, 0, 0, 0.25));
    }
    .pa-name {
      display: block;
      border: 0;
      font: inherit;
      -webkit-tap-highlight-color: transparent;
      transition:
        transform 150ms var(--km-spring, ease-out),
        background 150ms;
      margin: 14px 2px 0;
      width: 232px;
      height: 44px;
      line-height: 44px;
      padding: 0 16px;
      box-sizing: border-box;
      border-radius: 30px;
      background: var(--km-cream, #fff6e5);
      color: var(--km-ink, #2b2240);
      font-size: 20px;
      font-weight: 600;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* (while it is read out: lit as the name bars of the other tabs) */
    .pa-name.pa-speaking {
      background: var(--km-moon, var(--km-apricot, #f7b267));
      transform: scale(1.05);
    }
    .pa-dots {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 18px;
      display: flex;
      justify-content: center;
    }
    .pa-dot {
      height: 36px;
      padding: 0 5px;
      border: 0;
      background: none;
      display: grid;
      place-items: center;
      -webkit-tap-highlight-color: transparent;
    }
    .pa-dot i {
      display: block;
      width: 12px;
      height: 12px;
      border-radius: 6px;
      background: var(--pa-dot, rgba(255, 255, 255, 0.35));
      transition: width 300ms, background-color 300ms;
    }
    .pa-dot.on i {
      width: 32px;
      background: var(--km-apricot, #f7b267);
    }
    :host-context(body.km-light) .pa-dot i {
      --pa-dot: rgba(0, 0, 0, 0.22);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoAlbumsComponent {
  protected readonly photos = inject(PhotosService)
  protected readonly texts = inject(DisplayTextsService)
  protected readonly time = inject(PhotoTimeService)
  private readonly player = inject(PlayerService)
  protected readonly STEP = STEP
  protected readonly PAGE = PAGE

  readonly opened = output<PhotoAlbumSummary>()
  /** the photos pause: "Zu den Hörspielen" */
  readonly toListening = output<void>()

  // a note at the bottom for a few seconds: "Eltern" on the pause page (more photo time comes from the parents' app -
  // nothing to unlock here), an album that is not there
  protected readonly hint = signal<DisplayTextKey | null>(null)
  private hintTimer = 0
  private showHint(key: DisplayTextKey): void {
    this.hint.set(key)
    window.clearTimeout(this.hintTimer)
    this.hintTimer = window.setTimeout(() => this.hint.set(null), 5000)
  }
  protected parents(): void {
    this.showHint('photosParentsHint')
  }
  // "Nochmal": the box is asked again at once
  protected retry(): void {
    this.photos.refresh(true)
  }

  protected readonly albums = this.photos.albums
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.albums().length / PER_PAGE)))
  protected readonly pageList = computed(() => Array.from({ length: this.pages() }, (_, i) => i))
  protected readonly page = signal(0)
  // fewer albums than before (one hidden in the app) and the display stood on a page that is gone: the last one there is
  private readonly pageInRange = effect(() => {
    const last = this.pages() - 1
    if (untracked(() => this.page()) > last) this.page.set(last)
  })

  // a sideways swipe turns the page; it does not open the album the finger started on
  private startX = 0
  private startY = 0
  private tracking = false
  private swiped = false

  protected down(e: PointerEvent): void {
    this.tracking = true
    this.swiped = false
    this.startX = e.clientX
    this.startY = e.clientY
  }

  protected move(e: PointerEvent): void {
    if (!this.tracking || this.swiped) return
    const dx = e.clientX - this.startX
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - this.startY)) {
      this.swiped = true
      const next = Math.min(this.pages() - 1, Math.max(0, this.page() + (dx < 0 ? 1 : -1)))
      this.page.set(next)
    }
  }

  protected up(_e: PointerEvent): void {
    this.tracking = false
  }

  protected cancel(): void {
    this.tracking = false
  }

  protected open(a: PhotoAlbumSummary): void {
    // (the click after a swipe)
    if (this.swiped) {
      this.swiped = false
      return
    }
    if (a.away) return this.showHint('photosAwayHint')
    this.opened.emit(a)
  }

  // the album's name read out (Einstellungen › Audio › Sprachausgabe, as the names in the other tabs) - not the tap
  // that ended a swipe
  protected readonly speaking = signal<string | null>(null)
  private speakingTimer = 0
  protected read(a: PhotoAlbumSummary): void {
    if (this.swiped) {
      this.swiped = false
      return
    }
    this.player.sayText(a.title)
    this.speaking.set(a.id)
    window.clearTimeout(this.speakingTimer)
    this.speakingTimer = window.setTimeout(() => this.speaking.set(null), 1800)
  }

  protected openLabel(a: PhotoAlbumSummary): string {
    return this.texts.text('photosOpen', { a: a.title, n: a.count })
  }
}
