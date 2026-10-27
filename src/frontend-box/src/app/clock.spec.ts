import { analogAngles, clockSettingsOf, digitalTime } from './clock'

describe('clock', () => {
  const at = (h: number, m: number) => new Date(2026, 9, 27, h, m)

  it('takes the defaults (shown, digits, 24 hours) for anything missing or odd', () => {
    expect(clockSettingsOf(undefined)).toEqual({ show: true, style: 'digital', hours: 24 })
    expect(clockSettingsOf({ clockShow: false, clockStyle: 'analog', clockHours: 12 })).toEqual({ show: false, style: 'analog', hours: 12 })
    expect(clockSettingsOf({ clockStyle: 'roman', clockHours: 7 })).toEqual({ show: true, style: 'digital', hours: 24 })
  })

  it('writes 24 hours with two digits and 12 hours with AM / PM', () => {
    expect(digitalTime(at(7, 5), 24)).toEqual({ time: '07:05', suffix: '' })
    expect(digitalTime(at(0, 5), 12)).toEqual({ time: '12:05', suffix: 'AM' })
    expect(digitalTime(at(12, 30), 12)).toEqual({ time: '12:30', suffix: 'PM' })
    expect(digitalTime(at(21, 15), 12)).toEqual({ time: '9:15', suffix: 'PM' })
  })

  it('turns the hands of the dial; the hour hand moves on with the minutes', () => {
    expect(analogAngles(at(3, 0))).toEqual({ hour: 90, minute: 0 })
    expect(analogAngles(at(21, 30))).toEqual({ hour: 285, minute: 180 })
    expect(analogAngles(at(12, 0))).toEqual({ hour: 0, minute: 0 })
  })
})
