import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
} from '@angular/core'
import { environment } from 'src/environments/environment'
import { isPlaying } from '../background-playback.service'
import { DisplayTextsService } from '../display-texts.service'
import { PhotoTimeService } from './photo-time.service'
import { StatusComponent } from '../status/status.component'
import { type PhotoAsset, PhotosService } from './photos.service'

const SPEEDS = [8, 5, 3] as const
// a clip in the slideshow: up to this long it plays (silent) to its end, a longer one shows its picture
const CLIP_IN_SLIDESHOW = 30
type Speed = (typeof SPEEDS)[number]

/**
 * A picture over the whole display, and the slideshow (handoff §6). The background is the same picture in its 32 px
 * size scaled up and darkened - never blurred live on the Pi. Only opacity and transform are animated.
 * Tap: buttons on/off · swipe: next / previous, round and round · double tap: whole ↔ filling.
 */
@Component({
  selector: 'mupi-photo-viewer',
  imports: [StatusComponent],
  template: `
    <div class="pv" (pointerdown)="down($event)" (pointerup)="up($event)" (pointercancel)="tracking = false">
      @for (s of slides(); track s.key) {
        <div class="pv-slide" [class.pv-in]="s.fresh" [class.pv-zoom]="playing()" [class.pv-alt]="s.key % 2 === 1" [style.--pv-hold]="speed() + 1.2 + 's'">
          <img class="pv-bg" [src]="photos.fileUrl(albumId(), s.asset.id, 'b')" alt="" draggable="false" />
          @if (s.key === slideKey() && isClip(s.asset)) {
            <!-- a clip: with sound in the full view (silent while something plays), silent in the slideshow, to its end -->
            <video
              class="pv-fg pv-clip"
              [class.pv-fill]="fill()"
              [src]="photos.fileUrl(albumId(), s.asset.id, 'v')"
              [poster]="photos.fileUrl(albumId(), s.asset.id, 'f')"
              [muted]="playing() || audioPlays()"
              autoplay
              playsinline
              (play)="clipPaused.set(false)"
              (pause)="clipPaused.set(true)"
              (ended)="clipEnded()"
            ></video>
          } @else {
            <img class="pv-fg" [class.pv-fill]="fill()" [src]="photos.fileUrl(albumId(), s.asset.id, 'f')" [attr.alt]="pictureLabel(s.index)" draggable="false" />
          }
        </div>
      }

      @if (playing()) {
        @for (k of [slideKey()]; track k) {
          <div class="pv-progress" [style.animation-duration.s]="speed()"></div>
        }
      }

      <div class="pv-ui" [class.pv-hidden]="!controls()">
        <div class="pv-shade-top"></div>
        <div class="pv-shade-bottom"></div>
        <div class="pv-top">
          <button class="pv-btn pv-64" type="button" data-ui [attr.aria-label]="texts.text(fromGrid() ? 'photosBackAlbum' : 'photosBackAlbums')" (click)="closed.emit()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div class="pv-count">{{ index() + 1 }} / {{ assets().length }}</div>
          <div class="pv-status" data-ui><mupi-status></mupi-status></div>
        </div>
        @if (clipShown() && !playing()) {
          <button class="pv-btn pv-96 pv-acc pv-clipbtn" type="button" data-ui [attr.aria-label]="texts.text(clipPaused() ? 'photosPlay' : 'photosPause')" (click)="clipToggle()">
            @if (clipPaused()) {
              <svg viewBox="0 0 24 24" aria-hidden="true" class="pv-solid"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
            } @else {
              <svg viewBox="0 0 24 24" aria-hidden="true" class="pv-solid"><rect x="6.5" y="5" width="4" height="14" rx="1.5" /><rect x="13.5" y="5" width="4" height="14" rx="1.5" /></svg>
            }
          </button>
        }
        @if (assets().length > 1) {
          <button class="pv-btn pv-arrow pv-left" type="button" data-ui [attr.aria-label]="texts.text('photosPrev')" (click)="step(-1)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button class="pv-btn pv-arrow pv-right" type="button" data-ui [attr.aria-label]="texts.text('photosNext')" (click)="step(1)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        }
        <div class="pv-bottom">
          <button class="pv-btn pv-64" type="button" data-ui [attr.aria-label]="speedLabel()" (click)="nextSpeed()">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 17a8 8 0 1 1 16 0" />
              <path [attr.d]="needle()" />
              <circle cx="12" cy="17" r="1.6" class="pv-dot" />
            </svg>
          </button>
          <button class="pv-btn pv-96 pv-acc" type="button" data-ui [attr.aria-label]="texts.text(playing() ? 'photosPause' : 'photosPlay')" (click)="toggle()">
            @if (playing()) {
              <svg viewBox="0 0 24 24" aria-hidden="true" class="pv-solid"><rect x="6.5" y="5" width="4" height="14" rx="1.5" /><rect x="13.5" y="5" width="4" height="14" rx="1.5" /></svg>
            } @else {
              <svg viewBox="0 0 24 24" aria-hidden="true" class="pv-solid"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
            }
          </button>
          <button class="pv-btn pv-64" type="button" data-ui [attr.aria-label]="texts.text(fill() ? 'photosFit' : 'photosFill')" (click)="fill.set(!fill())">
            @if (fill()) {
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
            } @else {
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: block;
      background: #000;
      /* WiFi and battery in white over the picture */
      --st-on: #fff;
    }
    .pv {
      position: absolute;
      inset: 0;
      overflow: hidden;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .pv-slide {
      position: absolute;
      inset: 0;
      will-change: opacity, transform;
    }
    .pv-slide.pv-in {
      animation: pv-fade 700ms ease-out both;
    }
    .pv-slide.pv-zoom {
      animation: pv-fade 700ms ease-out both, pv-zoom var(--pv-hold, 6.2s) linear both;
    }
    .pv-slide.pv-zoom:not(.pv-in) {
      animation: pv-zoom var(--pv-hold, 6.2s) linear both;
    }
    .pv-slide.pv-zoom.pv-alt {
      animation-name: pv-fade, pv-zoom-alt;
    }
    .pv-slide.pv-zoom.pv-alt:not(.pv-in) {
      animation-name: pv-zoom-alt;
    }
    @keyframes pv-fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes pv-zoom {
      from {
        transform: scale(1) translate(0, 0);
      }
      to {
        transform: scale(1.08) translate(-1.5%, -1%);
      }
    }
    @keyframes pv-zoom-alt {
      from {
        transform: scale(1) translate(0, 0);
      }
      to {
        transform: scale(1.08) translate(1.5%, 1%);
      }
    }
    .pv-bg {
      position: absolute;
      inset: -4%;
      width: 108%;
      height: 108%;
      /* (Ionic caps every picture at 100 %: this one is larger on purpose, its blurry edge stays outside) */
      max-width: none;
      max-height: none;
      object-fit: cover;
      filter: brightness(0.5);
    }
    .pv-fg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .pv-fg.pv-fill {
      object-fit: cover;
    }
    .pv-progress {
      position: absolute;
      left: 0;
      bottom: 0;
      height: 5px;
      width: 100%;
      background: var(--km-apricot, #f7b267);
      transform-origin: left center;
      animation: pv-grow linear both;
      z-index: 2;
    }
    @keyframes pv-grow {
      from {
        transform: scaleX(0);
      }
      to {
        transform: scaleX(1);
      }
    }
    .pv-ui {
      position: absolute;
      inset: 0;
      z-index: 3;
      transition: opacity 300ms;
    }
    .pv-ui.pv-hidden {
      opacity: 0;
      pointer-events: none;
    }
    .pv-shade-top,
    .pv-shade-bottom {
      position: absolute;
      left: 0;
      right: 0;
      pointer-events: none;
    }
    .pv-shade-top {
      top: 0;
      height: 130px;
      background: linear-gradient(rgba(0, 0, 0, 0.55), transparent);
    }
    .pv-shade-bottom {
      bottom: 0;
      height: 170px;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
    }
    .pv-top {
      position: absolute;
      left: 14px;
      right: 14px;
      top: 4px;
      height: 64px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pv-count {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      height: 40px;
      line-height: 40px;
      padding: 0 18px;
      border-radius: 20px;
      background: rgba(0, 0, 0, 0.5);
      color: #fff;
      font-size: 19px;
      font-weight: 600;
      white-space: nowrap;
    }
    .pv-status {
      margin-left: auto;
      height: 64px;
      display: flex;
      align-items: center;
    }
    .pv-btn {
      border: 0;
      padding: 0;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--km-btn, var(--km-night-3, #3b3456));
      color: var(--km-on-btn, var(--km-cream, #fff6e5));
      box-shadow: 0 4px 0 rgba(0, 0, 0, 0.35);
      -webkit-tap-highlight-color: transparent;
      transition: transform 150ms var(--km-spring, ease-out);
    }
    .pv-btn:active {
      transform: scale(0.9);
    }
    .pv-btn svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .pv-btn svg.pv-solid {
      fill: currentColor;
      stroke: none;
    }
    .pv-btn .pv-dot {
      fill: currentColor;
      stroke: none;
    }
    .pv-64 {
      flex: 0 0 64px;
      width: 64px;
      height: 64px;
    }
    .pv-64 svg {
      width: 30px;
      height: 30px;
    }
    .pv-96 {
      width: 96px;
      height: 96px;
    }
    .pv-96 svg {
      width: 40px;
      height: 40px;
    }
    .pv-acc {
      background: var(--km-apricot, #f7b267);
      color: var(--km-ink, #2b2240);
    }
    .pv-clipbtn {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
    }
    .pv-clipbtn:active {
      transform: translate(-50%, -50%) scale(0.9);
    }
    .pv-arrow {
      position: absolute;
      top: 202px;
      width: 76px;
      height: 76px;
      box-shadow: 0 5px 0 rgba(0, 0, 0, 0.35);
    }
    .pv-arrow svg {
      width: 34px;
      height: 34px;
    }
    .pv-left {
      left: 14px;
    }
    .pv-right {
      right: 14px;
    }
    .pv-bottom {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 16px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 24px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoViewerComponent implements OnDestroy {
  protected readonly photos = inject(PhotosService)
  protected readonly texts = inject(DisplayTextsService)
  private readonly time = inject(PhotoTimeService)
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)

  readonly albumId = input.required<string>()
  readonly assets = input.required<PhotoAsset[]>()
  readonly start = input(0)
  /** start as a slideshow (the album's button, or the setting "Album startet als Diashow") */
  readonly autoplay = input(false)
  /** opened from the album's grid: back goes there; else back to the albums */
  readonly fromGrid = input(true)
  readonly closed = output<void>()

  protected readonly index = signal(0)
  protected readonly playing = signal(false)
  protected readonly fill = signal(false)
  protected readonly controls = signal(true)
  protected readonly speed = signal<Speed>(this.photos.slideshowSeconds() as Speed)
  // every change of the picture is a new slide (its fade and zoom start again); the one before stays below it for the
  // fade, then goes
  protected readonly slideKey = signal(0)
  private readonly previous = signal<{ key: number; index: number } | null>(null)
  protected readonly slides = computed(() => {
    const list = this.assets()
    if (list.length === 0) return []
    // (the album got fewer pictures while it is shown - deleted in the app: the last one there is)
    const i = Math.min(this.index(), list.length - 1)
    const cur = { key: this.slideKey(), index: i, asset: list[i], fresh: this.slideKey() > 0 }
    const prev = this.previous()
    return prev && list[prev.index]
      ? [{ key: prev.key, index: prev.index, asset: list[prev.index], fresh: false }, cur]
      : [cur]
  })

  // a clip: paused by its button; whether something plays on the box (then the clip is silent - checked every 5 s)
  protected readonly clipPaused = signal(false)
  protected readonly audioPlays = signal(false)
  private audioTimer = 0
  // (in the slideshow only a short clip plays, to its end - a long one shows its picture there)
  protected isClip(a: PhotoAsset): boolean {
    return a.kind === 'video' && (!this.playing() || (a.duration ?? 0) <= CLIP_IN_SLIDESHOW)
  }
  protected readonly clipShown = computed(() => {
    const list = this.assets()
    const a = list[Math.min(this.index(), list.length - 1)]
    return !!a && this.isClip(a)
  })
  protected clipToggle(): void {
    const v = this.host.nativeElement.querySelector<HTMLVideoElement>('video.pv-clip')
    if (!v) return
    if (v.paused) void v.play().catch((): void => undefined)
    else v.pause()
    this.touched()
  }
  // the slideshow goes on when a clip has come to its end; in the full view it stays on its last picture
  protected clipEnded(): void {
    if (!this.playing()) return
    const n = this.assets().length
    if (n > 1) this.show((this.index() + 1) % n)
  }
  private async checkAudio(): Promise<void> {
    try {
      const r = await fetch(`${environment.backend.playerUrl}/local`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      this.audioPlays.set(r.ok && isPlaying(await r.json()))
    } catch {
      this.audioPlays.set(false)
    }
  }

  private advanceTimer = 0
  private hideTimer = 0
  private dropTimer = 0
  private tapTimer = 0
  private lastTap = 0
  private started = false

  constructor() {
    void this.checkAudio()
    this.audioTimer = window.setInterval((): void => void this.checkAudio(), 5000)
    // the photo time: the full view counts also untouched; its chip only with the buttons shown
    effect(() => {
      const controls = this.controls()
      untracked(() => this.time.viewer.set({ controls }))
    })
    effect(() => {
      // (once, when the inputs are there)
      if (this.started) return
      this.started = true
      const n = this.assets().length
      this.index.set(n ? Math.min(Math.max(0, this.start()), n - 1) : 0)
      this.speed.set(this.photos.slideshowSeconds() as Speed)
      if (this.autoplay()) this.play()
      this.preload()
    })
    // a new list of pictures (added or deleted in the app): the place stays within it, the slideshow goes on with it
    effect(() => {
      const n = this.assets().length
      untracked(() => {
        if (this.index() >= n) this.index.set(Math.max(0, n - 1))
        if (this.playing()) this.schedule()
      })
    })
  }

  ngOnDestroy(): void {
    window.clearInterval(this.audioTimer)
    this.time.viewer.set(null)
    window.clearTimeout(this.advanceTimer)
    window.clearTimeout(this.hideTimer)
    window.clearTimeout(this.dropTimer)
    window.clearTimeout(this.tapTimer)
  }

  protected readonly speedLabel = computed(() =>
    this.texts.text('photosSpeed', {
      s: this.texts.text(this.speed() === 8 ? 'photosSlow' : this.speed() === 5 ? 'photosMedium' : 'photosFast'),
    }),
  )
  // the speedometer's needle: left, middle, right = slow, medium, fast
  protected readonly needle = computed(() => {
    const angle = this.speed() === 8 ? -55 : this.speed() === 5 ? 0 : 55
    const rad = ((angle - 90) * Math.PI) / 180
    return `M12 17L${(12 + 6 * Math.cos(rad)).toFixed(2)} ${(17 + 6 * Math.sin(rad)).toFixed(2)}`
  })

  protected pictureLabel(i: number): string {
    return this.texts.text('photosPicture', { n: i + 1 })
  }

  protected step(dir: 1 | -1): void {
    const n = this.assets().length
    if (n < 2) return
    this.show((this.index() + dir + n) % n)
    this.touched()
  }

  protected toggle(): void {
    if (this.playing()) this.pause()
    else this.play()
    this.touched()
  }

  protected nextSpeed(): void {
    const i = SPEEDS.indexOf(this.speed())
    this.speed.set(SPEEDS[(i + 1) % SPEEDS.length])
    if (this.playing()) this.schedule()
    this.touched()
  }

  private play(): void {
    this.playing.set(true)
    this.schedule()
    this.touched()
  }

  private pause(): void {
    this.playing.set(false)
    window.clearTimeout(this.advanceTimer)
    window.clearTimeout(this.hideTimer)
    this.controls.set(true)
  }

  private schedule(): void {
    window.clearTimeout(this.advanceTimer)
    if (!this.playing() || this.assets().length < 2) return
    if (this.clipShown()) return
    this.advanceTimer = window.setTimeout(() => {
      const n = this.assets().length
      this.show((this.index() + 1) % n)
      this.schedule()
    }, this.speed() * 1000)
  }

  private show(i: number): void {
    this.clipPaused.set(false)
    this.previous.set({ key: this.slideKey(), index: this.index() })
    this.slideKey.update((k) => k + 1)
    this.index.set(i)
    // (the one before goes when the new one has faded in)
    window.clearTimeout(this.dropTimer)
    this.dropTimer = window.setTimeout(() => this.previous.set(null), 750)
    if (this.playing()) this.schedule()
    this.preload()
  }

  private preload(): void {
    const n = this.assets().length
    if (n < 2) return
    const next = this.assets()[(this.index() + 1) % n]
    for (const size of ['f', 'b'] as const) new Image().src = this.photos.fileUrl(this.albumId(), next.id, size)
  }

  // the buttons go 4 s after the last touch while the slideshow plays; on pause they stay
  private touched(): void {
    window.clearTimeout(this.hideTimer)
    if (!this.playing()) return
    this.hideTimer = window.setTimeout(() => this.controls.set(false), 4000)
  }

  // ---------- gestures: tap, double tap, swipe ----------
  protected tracking = false
  private startX = 0
  private startY = 0

  protected down(e: PointerEvent): void {
    this.tracking = true
    this.startX = e.clientX
    this.startY = e.clientY
  }

  protected up(e: PointerEvent): void {
    if (!this.tracking) return
    this.tracking = false
    // (a button's own tap)
    if ((e.target as HTMLElement).closest('[data-ui]')) {
      this.touched()
      return
    }
    const dx = e.clientX - this.startX
    const dy = e.clientY - this.startY
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      this.step(dx < 0 ? 1 : -1)
      return
    }
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) return
    const now = Date.now()
    if (now - this.lastTap < 300) {
      // double tap: whole ↔ filling (the single tap waiting is dropped)
      window.clearTimeout(this.tapTimer)
      this.lastTap = 0
      this.fill.set(!this.fill())
      return
    }
    this.lastTap = now
    window.clearTimeout(this.tapTimer)
    this.tapTimer = window.setTimeout(() => {
      this.controls.set(!this.controls())
      if (this.controls()) this.touched()
    }, 300)
  }
}
