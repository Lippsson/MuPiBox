// Turning and mirroring a display on the ribbon cable (DSI) the way the HDMI one can be turned (config.txt
// display_hdmi_rotate): with the KMS driver (vc4-kms-v3d) the firmware's rotation does not reach it, the X server does it.
// The app (Display > Drehung) writes two small files for X from the choice, and the kiosk restarts: the screen's
// rotation / mirroring (Monitor) and the matching turn of the touch (libinput's CalibrationMatrix - without it a touch
// lands where the picture was before).

import { promises as fsp } from 'node:fs'

/** the same values as display_hdmi_rotate: 0 none, 1 = 90 degrees (clockwise), 2 = 180, 3 = 270, a mirroring each */
export const DSI_ROTATIONS = ['0', '1', '2', '3', '0x10000', '0x20000'] as const
export type DsiRotation = (typeof DSI_ROTATIONS)[number]

export const DSI_SCREEN_CONF = '/etc/X11/xorg.conf.d/20-mupibox-rotate.conf'
export const DSI_TOUCH_CONF = '/etc/X11/xorg.conf.d/30-mupibox-touch-rotate.conf'

// X names a turn by where the picture's top points to: "right" = turned clockwise by 90 degrees, "left" = 270, "inverted" = 180
const SCREEN: Record<Exclude<DsiRotation, '0'>, { rotate?: string; reflect?: string }> = {
  '1': { rotate: 'right' },
  '2': { rotate: 'inverted' },
  '3': { rotate: 'left' },
  '0x10000': { reflect: 'x' },
  '0x20000': { reflect: 'y' },
}

// libinput's matrix for the same change (the first two rows of a 3 x 3 matrix, then 0 0 1): turned right, upside down,
// turned left, mirrored
const TOUCH: Record<Exclude<DsiRotation, '0'>, string> = {
  '1': '0 1 0 -1 0 1 0 0 1',
  '2': '-1 0 1 0 -1 1 0 0 1',
  '3': '0 -1 1 1 0 0 0 0 1',
  '0x10000': '-1 0 1 0 1 0 0 0 1',
  '0x20000': '1 0 0 0 -1 1 0 0 1',
}

export function isDsiRotation(value: unknown): value is DsiRotation {
  return typeof value === 'string' && (DSI_ROTATIONS as readonly string[]).includes(value)
}

/** The two files for X ('0' = nothing: the files are removed). `output` is the connector's name, e.g. DSI-1. */
export function dsiConfig(output: string, rotation: DsiRotation): { screen: string; touch: string } | null {
  if (rotation === '0') return null
  if (!/^DSI-\d+$/.test(output)) throw new Error(`not a DSI output: ${output}`)
  const s = SCREEN[rotation]
  const screen = [
    '# made by the app (Display > Drehung) for the display on the ribbon cable - do not edit',
    'Section "Monitor"',
    `\tIdentifier "${output}"`,
    ...(s.rotate ? [`\tOption "Rotate" "${s.rotate}"`] : []),
    ...(s.reflect ? [`\tOption "Reflect" "${s.reflect}"`] : []),
    'EndSection',
    '',
  ].join('\n')
  const touch = [
    '# made by the app (Display > Drehung): the touch follows the picture - do not edit',
    'Section "InputClass"',
    '\tIdentifier "mupibox touch rotation"',
    '\tMatchIsTouchscreen "on"',
    '\tMatchDevicePath "/dev/input/event*"',
    `\tOption "CalibrationMatrix" "${TOUCH[rotation]}"`,
    'EndSection',
    '',
  ].join('\n')
  return { screen, touch }
}

/** The DSI connector that has a display on it (KMS driver), or null - without KMS or without a DSI display there is none. */
export async function dsiOutput(drm = '/sys/class/drm'): Promise<string | null> {
  try {
    for (const name of (await fsp.readdir(drm)).sort()) {
      const m = /^card\d+-(DSI-\d+)$/.exec(name)
      if (!m) continue
      const status = (await fsp.readFile(`${drm}/${name}/status`, 'utf8').catch(() => '')).trim()
      if (status === 'connected') return m[1]
    }
  } catch {
    // not a Raspberry Pi (development)
  }
  return null
}
