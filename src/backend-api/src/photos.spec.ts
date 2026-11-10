import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ordered } from './app-api/photos/albums'
import { applyPhotoSettings, PHOTO_DEFAULTS, photoSettings } from './app-api/photos/settings'
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
