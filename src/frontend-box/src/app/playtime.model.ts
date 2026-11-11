export type PlaytimeDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type PlaytimePlayState = 'normal' | 'grace' | 'blocked'

export type PlaybackBlockSource = 'playtime' | 'quiet' | 'override'

export type PlaytimeStatus = PlaytimeStatusActive | PlaytimeStatusDisabled

export interface PlaytimeStatusDisabled {
  enabled: false
  /** the photo time - also with the listening time and quiet times off */
  photos?: PhotoTimeStatus
}

/** The photo time ("Bildzeit", 5.1) as the player counts it (see spotify-control.js photoTimeStatus) */
export interface PhotoTimeStatus {
  enabled: true
  /** 'separate': an account of its own; 'shared': the photos use the listening time */
  mode: 'separate' | 'shared'
  limitEnabled: boolean
  /** no limit for the rest of today (parents) */
  free: boolean
  /** the own account counts against a limit now (separate, limit on, not free) */
  limited: boolean
  limitMinutes: number
  bonusMinutes: number
  usedSeconds: number
  /** null: no limit */
  remainingSeconds: number | null
  /** 'blocked': the own account is used up - the photos pause */
  state: 'normal' | 'blocked'
  counting: boolean
  warnMinutes: number
  idlePauseSeconds: number
}

export interface PlaytimeSubStatus {
  enabled: boolean
  state: PlaytimePlayState
  date: string
  dayKey: PlaytimeDayKey
  limitMinutes: number
  usedSeconds: number
  remainingSeconds: number
  graceEndsInSeconds: number
  resetHour: number
}

export interface QuietHoursSubStatus {
  enabled: boolean
  state: PlaytimePlayState
  inWindow: boolean
  label?: string
  graceEndsInSeconds: number
}

export interface PlaytimeStatusActive {
  enabled: true
  state: PlaytimePlayState
  blockSource: PlaybackBlockSource | null
  playtime: PlaytimeSubStatus
  quiet: QuietHoursSubStatus
  override?: {
    allowUntil: number
    forceBlockUntil: number
  }
  /** the box has had the time from the network since it was switched on (undefined: not known) */
  clockSynced?: boolean
  photos?: PhotoTimeStatus
}
