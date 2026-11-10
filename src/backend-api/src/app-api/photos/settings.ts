// The photo display (5.1, see docs/fotoanzeige-5.1.md): its settings in mupiboxconfig.json under `photos`. Off by
// default - while off, nothing about photos shows in the app or on the display, the data stay on the box.
// Read with their defaults filled in (a box from before has no `photos` at all); written only through
// applyPhotoSettings, which takes nothing but the known fields in their ranges.

export type PhotoOrder = 'shuffle' | 'newest' | 'taken'
export type SlideshowSeconds = 8 | 5 | 3

export interface PhotoSettings {
  enabled: boolean
  /** an album opens as a slideshow, without the grid ("for the youngest") */
  startAsSlideshow: boolean
  slideshowSeconds: SlideshowSeconds
  order: PhotoOrder
  /** video clips in the albums (in the slideshow without sound); off: only pictures */
  showVideos: boolean
  screensaver: {
    enabled: boolean
    /** minutes without a touch before it starts (1-30) */
    afterMinutes: number
    /** also while something plays (else only in silence) */
    duringPlayback: boolean
  }
}

export const PHOTO_DEFAULTS: PhotoSettings = {
  enabled: false,
  startAsSlideshow: false,
  slideshowSeconds: 5,
  order: 'shuffle',
  showVideos: false,
  screensaver: { enabled: false, afterMinutes: 5, duringPlayback: false },
}

const ORDERS: PhotoOrder[] = ['shuffle', 'newest', 'taken']
const SECONDS: SlideshowSeconds[] = [8, 5, 3]

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** The settings of the configuration, every field filled in (unknown or broken values: the default). */
export function photoSettings(cfg: unknown): PhotoSettings {
  const p = obj(obj(cfg).photos)
  const s = obj(p.screensaver)
  const minutes = Number(s.afterMinutes)
  return {
    enabled: p.enabled === true,
    startAsSlideshow: p.startAsSlideshow === true,
    slideshowSeconds: SECONDS.includes(p.slideshowSeconds as SlideshowSeconds) ? (p.slideshowSeconds as SlideshowSeconds) : PHOTO_DEFAULTS.slideshowSeconds,
    order: ORDERS.includes(p.order as PhotoOrder) ? (p.order as PhotoOrder) : PHOTO_DEFAULTS.order,
    showVideos: p.showVideos === true,
    screensaver: {
      enabled: s.enabled === true,
      afterMinutes: Number.isInteger(minutes) && minutes >= 1 && minutes <= 30 ? minutes : PHOTO_DEFAULTS.screensaver.afterMinutes,
      duringPlayback: s.duringPlayback === true,
    },
  }
}

export type PhotoSettingsPatch = Partial<Omit<PhotoSettings, 'screensaver'>> & { screensaver?: Partial<PhotoSettings['screensaver']> }

/**
 * A change from the app, checked: every field must be one of its own values (a wrong one: the reason, nothing
 * written). Returns the error or null; on null `target` (the configuration's `photos`) holds the change.
 */
export function applyPhotoSettings(target: Record<string, unknown>, patch: unknown): string | null {
  const p = obj(patch)
  const bool = (v: unknown) => typeof v === 'boolean'
  const changes: Record<string, unknown> = {}
  for (const key of ['enabled', 'startAsSlideshow', 'showVideos'] as const) {
    if (p[key] === undefined) continue
    if (!bool(p[key])) return `${key} must be true or false`
    changes[key] = p[key]
  }
  if (p.slideshowSeconds !== undefined) {
    if (!SECONDS.includes(p.slideshowSeconds as SlideshowSeconds)) return 'slideshowSeconds must be 8, 5 or 3'
    changes.slideshowSeconds = p.slideshowSeconds
  }
  if (p.order !== undefined) {
    if (!ORDERS.includes(p.order as PhotoOrder)) return 'order must be shuffle, newest or taken'
    changes.order = p.order
  }
  let screensaver: Record<string, unknown> | undefined
  if (p.screensaver !== undefined) {
    const s = obj(p.screensaver)
    screensaver = { ...obj(target.screensaver) }
    for (const key of ['enabled', 'duringPlayback'] as const) {
      if (s[key] === undefined) continue
      if (!bool(s[key])) return `screensaver.${key} must be true or false`
      screensaver[key] = s[key]
    }
    if (s.afterMinutes !== undefined) {
      const m = Number(s.afterMinutes)
      if (!Number.isInteger(m) || m < 1 || m > 30) return 'screensaver.afterMinutes must be 1-30'
      screensaver.afterMinutes = m
    }
  }
  Object.assign(target, changes)
  if (screensaver) target.screensaver = screensaver
  return null
}
