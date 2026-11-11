import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ordered } from './app-api/photos/albums'
import { applyPhotoSettings, applyPhotoTimeAction, logicalDate, PHOTO_DEFAULTS, photoSettings } from './app-api/photos/settings'
import type { PhotoAsset } from './app-api/photos/store'

test('photo settings: off with its defaults on a box from before, broken values give the default', () => {
  assert.deepEqual(photoSettings(undefined), PHOTO_DEFAULTS)
  assert.deepEqual(photoSettings({ photos: { enabled: 'yes', slideshowSeconds: 4, order: 'x', screensaver: { afterMinutes: 99 } } }), PHOTO_DEFAULTS)
  const s = photoSettings({ photos: { enabled: true, slideshowSeconds: 3, order: 'taken', screensaver: { enabled: true, afterMinutes: 12 } } })
  assert.equal(s.enabled, true)
  assert.equal(s.slideshowSeconds, 3)
  assert.equal(s.order, 'taken')
  assert.deepEqual(s.screensaver, { enabled: true, afterMinutes: 12, duringPlayback: false })
})

test('photo settings: a change takes only known fields in range, a wrong one writes nothing', () => {
  const target: Record<string, unknown> = { enabled: false, screensaver: { enabled: true, afterMinutes: 5 } }
  assert.equal(applyPhotoSettings(target, { enabled: true, slideshowSeconds: 8, screensaver: { afterMinutes: 30 }, other: 1 }), null)
  assert.deepEqual(target, { enabled: true, slideshowSeconds: 8, screensaver: { enabled: true, afterMinutes: 30 } })
  const before = JSON.stringify(target)
  assert.match(String(applyPhotoSettings(target, { enabled: false, slideshowSeconds: 4 })), /slideshowSeconds/)
  assert.match(String(applyPhotoSettings(target, { screensaver: { afterMinutes: 0 } })), /afterMinutes/)
  assert.match(String(applyPhotoSettings(target, { order: 'random' })), /order/)
  assert.equal(JSON.stringify(target), before)
})

test('photo order: newest first, by the day taken (else the day it came), shuffled keeps every picture', () => {
  const a = (id: string, added: string, taken: string | null): PhotoAsset => ({ id, w: 1, h: 1, added, taken, kind: 'photo' })
  const list = [a('a', '2026-01-02', '2020-05-01T10:00:00'), a('b', '2026-01-03', null), a('c', '2026-01-01', '2019-01-01T08:00:00')]
  assert.deepEqual(ordered(list, 'newest').map((x) => x.id), ['b', 'a', 'c'])
  assert.deepEqual(ordered(list, 'taken').map((x) => x.id), ['c', 'a', 'b'])
  assert.deepEqual(ordered(list, 'shuffle').map((x) => x.id).sort(), ['a', 'b', 'c'])
  assert.deepEqual(list.map((x) => x.id), ['a', 'b', 'c'])
})

test('photo time settings: mode, limit, minutes per weekday, warning and idle pause - checked, broken ones the default', () => {
  const s = photoSettings({ photos: { limitMode: 'shared', limitEnabled: false, dailyMinutes: { mon: 0, tue: 45, wed: -1, thu: '30' }, warnMinutes: 3, idlePauseSeconds: 300 } })
  assert.equal(s.limitMode, 'shared')
  assert.equal(s.limitEnabled, false)
  assert.deepEqual(s.dailyMinutes, { mon: 0, tue: 45, wed: 20, thu: 30, fri: 20, sat: 20, sun: 20 })
  assert.equal(s.warnMinutes, 5)
  assert.equal(s.idlePauseSeconds, 300)
  const target: Record<string, unknown> = { dailyMinutes: { mon: 10 } }
  assert.equal(applyPhotoSettings(target, { limitMode: 'separate', dailyMinutes: { sat: 30 }, warnMinutes: 0, idlePauseSeconds: 60, limitEnabled: true }), null)
  assert.deepEqual(target, { dailyMinutes: { mon: 10, sat: 30 }, limitMode: 'separate', warnMinutes: 0, idlePauseSeconds: 60, limitEnabled: true })
  const before = JSON.stringify(target)
  assert.match(String(applyPhotoSettings(target, { dailyMinutes: { sat: 1441 } })), /dailyMinutes/)
  assert.match(String(applyPhotoSettings(target, { dailyMinutes: { someday: 5 } })), /weekday/)
  assert.match(String(applyPhotoSettings(target, { limitMode: 'both' })), /limitMode/)
  assert.match(String(applyPhotoSettings(target, { warnMinutes: 3 })), /warnMinutes/)
  assert.match(String(applyPhotoSettings(target, { idlePauseSeconds: 30 })), /idlePauseSeconds/)
  assert.equal(JSON.stringify(target), before)
})

test('photo time actions: today by the reset hour, minutes add up, free, reset keeps them; another day starts anew', () => {
  const now = new Date(2026, 10, 11, 2, 30)
  assert.equal(logicalDate(now, 4), '2026-11-10')
  assert.equal(logicalDate(now, 0), '2026-11-11')
  const cfg: Record<string, unknown> = { playtimeLimit: { resetHour: 4 }, photos: { enabled: true, today: { date: '2026-11-09', free: true } } }
  assert.equal(applyPhotoTimeAction(cfg, 'extend', 10, now), null)
  assert.equal(applyPhotoTimeAction(cfg, 'extend', 5, now), null)
  assert.deepEqual((cfg.photos as Record<string, unknown>).today, { date: '2026-11-10', bonusMinutes: 15 })
  assert.equal(applyPhotoTimeAction(cfg, 'free', undefined, now), null)
  assert.equal(applyPhotoTimeAction(cfg, 'reset', undefined, now), null)
  assert.deepEqual((cfg.photos as Record<string, unknown>).today, { date: '2026-11-10', bonusMinutes: 15, free: true, reset: now.getTime() })
  assert.equal((cfg.photos as Record<string, unknown>).enabled, true)
  const before = JSON.stringify(cfg)
  assert.match(String(applyPhotoTimeAction(cfg, 'extend', 0, now)), /minutes/)
  assert.match(String(applyPhotoTimeAction(cfg, 'more', 5, now)), /action/)
  assert.equal(JSON.stringify(cfg), before)
})
