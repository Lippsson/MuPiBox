import type { PlaybackOverrideConfig, PlaytimeLimitConfig, QuietHoursConfig } from './playtime.model'

export interface MupiboxConfig {
  spotify?: {
    disableScraperForPlaylists?: boolean
    [key: string]: unknown
  }
  synology?: {
    address?: string
    https?: boolean
    account?: string
    password?: string
    rememberMe?: boolean
    artistFolders?: string[]
    downloadFolders?: string[]
    [key: string]: unknown
  }
  playtimeLimit?: PlaytimeLimitConfig
  quietHours?: QuietHoursConfig
  playbackOverride?: PlaybackOverrideConfig
  [key: string]: unknown
}
