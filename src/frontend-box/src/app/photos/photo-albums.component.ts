import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, untracked } from '@angular/core'
import { DisplayTextsService } from '../display-texts.service'
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
    <div class="pa" (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="cancel()">
      <div class="pa-track" [style.transform]="'translateX(' + -page() * PAGE + 'px)'">
        @for (a of albums(); track a.id; let i = $index) {
          <button class="pa-tile" type="button" [style.left.px]="15 + i * STEP" [attr.aria-label]="openLabel(a)" (click)="open(a)">
            <span class="pa-stack">
              <span class="pa-back"></span>
              @if (a.pictures[1]) {
                <img class="pa-mid" [src]="photos.fileUrl(a.id, a.pictures[1], 's')" alt="" draggable="false" />
              } @else {
                <span class="pa-mid pa-empty"></span>
              }
              <img class="pa-front" [src]="photos.fileUrl(a.id, a.pictures[0], 's')" alt="" draggable="false" />
              <span class="pa-badge">{{ a.count }}</span>
            </span>
            <span class="pa-name">{{ a.title }}</span>
          </button>
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
  `,
  styles: `
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
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      -webkit-tap-highlight-color: transparent;
      transition: transform 150ms var(--km-spring, ease-out);
    }
    .pa-tile:active {
      transform: scale(0.96);
    }
    .pa-stack {
      position: relative;
      display: block;
      width: 236px;
      height: 236px;
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
  private readonly texts = inject(DisplayTextsService)
  protected readonly STEP = STEP
  protected readonly PAGE = PAGE

  readonly opened = output<PhotoAlbumSummary>()

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
    this.opened.emit(a)
  }

  protected openLabel(a: PhotoAlbumSummary): string {
    return this.texts.text('photosOpen', { a: a.title, n: a.count })
  }
}
