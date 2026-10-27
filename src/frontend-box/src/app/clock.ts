// The clock in the header, right of the battery (status.component.ts). The parents choose in the app (Einstellungen >
// Display > Uhrzeit) whether it is shown, as digits or as a dial, and with 12 or 24 hours; they are kept in the box's
// config as mupibox.clockShow, clockStyle and clockHours.

export interface ClockSettings {
  show: boolean
  style: 'digital' | 'analog'
  hours: 12 | 24
}

export const DEFAULT_CLOCK: ClockSettings = { show: true, style: 'digital', hours: 24 }

/** The settings from the mupibox part of the config; whatever is missing or odd is the default. */
export function clockSettingsOf(mupibox: { clockShow?: unknown; clockStyle?: unknown; clockHours?: unknown } | undefined): ClockSettings {
  return {
    show: mupibox?.clockShow !== false,
    style: mupibox?.clockStyle === 'analog' ? 'analog' : 'digital',
    hours: Number(mupibox?.clockHours) === 12 ? 12 : 24,
  }
}

/** 24 hours: "14:35"; 12 hours: "2:35" and "PM" (the suffix is shown smaller next to it). */
export function digitalTime(now: Date, hours: 12 | 24): { time: string; suffix: string } {
  const h = now.getHours()
  const mm = String(now.getMinutes()).padStart(2, '0')
  if (hours === 24) return { time: `${String(h).padStart(2, '0')}:${mm}`, suffix: '' }
  return { time: `${h % 12 === 0 ? 12 : h % 12}:${mm}`, suffix: h < 12 ? 'AM' : 'PM' }
}

/** The hands of a dial in degrees from 12 o'clock; the hour hand moves on with the minutes. */
export function analogAngles(now: Date): { hour: number; minute: number } {
  const minutes = now.getMinutes()
  return { hour: (now.getHours() % 12) * 30 + minutes * 0.5, minute: minutes * 6 }
}
