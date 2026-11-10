import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute } from '@angular/router'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRouterOutlet,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone'
import { addIcons } from 'ionicons'
import { arrowBackOutline, playOutline } from 'ionicons/icons'
import { catchError, of } from 'rxjs'
import { DisplayTextsService } from '../display-texts.service'
import { KmStatusGroupComponent } from '../km-header/km-status-group.component'
import { StatusComponent } from '../status/status.component'
import { KmThemeService } from '../theme/km-theme.service'
import { PhotoViewerComponent } from './photo-viewer.component'
import { type PhotoAlbumDetail, PhotosService } from './photos.service'

/**
 * An album of the photo display (handoff §5): its pictures in a grid of four columns, scrolled up and down; a tap opens
 * the picture over the whole display, "Diashow" starts the slideshow at the first one. With the setting "Album startet
 * als Diashow" there is no grid: the slideshow comes at once, and back goes to the albums.
 */
@Component({
  selector: 'app-photo-album',
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonTitle,
    IonContent,
    KmStatusGroupComponent,
    StatusComponent,
    PhotoViewerComponent,
  ],
  template: `
    <!-- (the classes of the album list: every theme colours this page as that one - its background, its header) -->
    <ion-header class="medialist-header photo-album-header" [class.km-r2]="r2()">
      @if (r2()) {
        <div class="km-bar">
          <button class="km-hbtn" type="button" data-mupi-back [attr.aria-label]="texts.text('photosBackAlbums')" (click)="back()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div class="km-htitle">
            <span class="pa-t1">{{ album()?.title }}</span>
            <span class="pa-t2">{{ countText() }}</span>
          </div>
          @if (album()?.assets?.length) {
            <button class="pa-show" type="button" (click)="slideshow()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
              <span>{{ texts.text('photosSlideshow') }}</span>
            </button>
          }
          <mupi-km-status-group></mupi-km-status-group>
        </div>
      } @else {
        <ion-toolbar color="light">
          <ion-buttons slot="start">
            <ion-button (click)="back()"><ion-icon slot="icon-only" name="arrow-back-outline"></ion-icon></ion-button>
          </ion-buttons>
          <ion-title>{{ album()?.title }}</ion-title>
          <ion-buttons slot="end">
            @if (album()?.assets?.length) {
              <ion-button (click)="slideshow()"><ion-icon slot="start" name="play-outline"></ion-icon>{{ texts.text('photosSlideshow') }}</ion-button>
            }
            <span class="mupihat-icon-container"><mupi-status></mupi-status></span>
          </ion-buttons>
        </ion-toolbar>
      }
    </ion-header>

    <ion-content class="medialist-content photo-album-content" [scrollY]="false">
      <div class="pa-grid-scroll">
        <div class="pa-grid">
          @for (a of album()?.assets ?? []; track a.id; let i = $index) {
            <button class="pa-cell" type="button" [attr.aria-label]="texts.text('photosPicture', { n: i + 1 })" (click)="openAt(i)">
              <img [src]="photos.fileUrl(album()!.id, a.id, 's')" alt="" loading="lazy" draggable="false" />
            </button>
          }
        </div>
      </div>
    </ion-content>

    @if (viewer(); as v) {
      <mupi-photo-viewer [albumId]="album()!.id" [assets]="album()!.assets" [start]="v.start" [autoplay]="v.play" [fromGrid]="!direct()" (closed)="viewerClosed()"></mupi-photo-viewer>
    }
  `,
  styles: `
    .km-htitle {
      .pa-t1 {
        font-size: 22px;
        font-weight: 600;
        color: var(--km-on-band, var(--km-on-bg));
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pa-t2 {
        font-size: 15px;
        font-weight: 600;
        color: var(--km-on-band-2, var(--km-lavender));
        white-space: nowrap;
      }
    }
    .pa-show {
      flex: 0 0 auto;
      height: 64px;
      padding: 0 26px 0 18px;
      border: 0;
      border-radius: 32px;
      background: var(--km-apricot, #f7b267);
      color: var(--km-ink, #2b2240);
      display: flex;
      align-items: center;
      gap: 10px;
      font: inherit;
      font-size: 21px;
      font-weight: 700;
      box-shadow: 0 4px 0 var(--km-shadow, rgba(0, 0, 0, 0.25));
      -webkit-tap-highlight-color: transparent;
      transition: transform 150ms var(--km-spring, ease-out);
    }
    .pa-show:active {
      transform: scale(0.94);
    }
    .pa-show svg {
      width: 26px;
      height: 26px;
      fill: currentColor;
    }
    .pa-grid-scroll {
      position: absolute;
      inset: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: none;
    }
    .pa-grid-scroll::-webkit-scrollbar {
      display: none;
    }
    .pa-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      padding: 8px 14px 22px;
    }
    .pa-cell {
      padding: 0;
      border: 0;
      aspect-ratio: 4 / 3;
      border-radius: 20px;
      overflow: hidden;
      background: var(--km-night-3, #3b3456);
      box-shadow: 0 4px 0 var(--km-shadow, rgba(0, 0, 0, 0.25));
      -webkit-tap-highlight-color: transparent;
      transition: transform 150ms var(--km-spring, ease-out);
    }
    .pa-cell:active {
      transform: scale(0.95);
    }
    .pa-cell img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoAlbumPage {
  protected readonly photos = inject(PhotosService)
  protected readonly texts = inject(DisplayTextsService)
  protected readonly r2 = inject(KmThemeService).roundTwo
  private readonly nav = inject(NavController)
  private readonly outlet = inject(IonRouterOutlet, { optional: true })

  protected readonly album = signal<PhotoAlbumDetail | null>(null)
  /** "Album startet als Diashow": no grid, the slideshow at once - back from it goes to the albums */
  protected readonly direct = signal(false)
  protected readonly viewer = signal<{ start: number; play: boolean } | null>(null)
  protected readonly countText = computed(() => {
    const n = this.album()?.assets.length ?? 0
    return n === 1 ? this.texts.text('photosCountOne') : this.texts.text('photosCount', { n })
  })

  constructor() {
    addIcons({ arrowBackOutline, playOutline })
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const id = params.get('album') ?? ''
        this.direct.set(params.get('show') === '1')
        this.photos
          .album(id)
          .pipe(catchError(() => of(null)))
          .subscribe((a) => {
            // (gone meanwhile - hidden in the app, the display switched off: back to the albums)
            if (!a || a.assets.length === 0) return this.back()
            this.album.set(a)
            if (this.direct()) this.viewer.set({ start: 0, play: true })
          })
      })
  }

  protected openAt(i: number): void {
    this.viewer.set({ start: i, play: false })
  }

  protected slideshow(): void {
    this.viewer.set({ start: 0, play: true })
  }

  protected viewerClosed(): void {
    this.viewer.set(null)
    if (this.direct()) this.back()
  }

  protected back(): void {
    this.photos.backToTab.set(true)
    if (this.outlet?.canGoBack()) this.nav.pop()
    else this.nav.navigateRoot('/home', { animationDirection: 'back' })
  }
}
