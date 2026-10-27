// The CD watcher (src/cd-drive.js) over a pretend drive: no drive, Python or disc needed (npm test).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createCdWatcher, NO_CD } = require('../src/cd-drive.js')

// a drive whose answers the test sets; counts the questions of each kind
function pretendDrive() {
  const drive = {
    quick: { drive: 'none' },
    full: { drive: 'ok', disc: 'audio', tracks: 12 },
    quickAsked: 0,
    fullAsked: 0,
    probe: async (full) => {
      if (full) {
        drive.fullAsked++
        return drive.full
      }
      drive.quickAsked++
      return drive.quick
    },
  }
  return drive
}

function watch(drive, extra = {}) {
  const changes = []
  const w = createCdWatcher({ probe: drive.probe, onChange: (s) => changes.push(s), ...extra })
  return { w, changes }
}

test('no disc: nothing is reported', async () => {
  const d = pretendDrive()
  const { w, changes } = watch(d)
  await w.tick()
  assert.deepEqual(w.state, NO_CD)
  assert.equal(changes.length, 0)
  assert.equal(d.fullAsked, 0)
})

test('an audio CD comes in: reported once with its tracks, its contents read only once', async () => {
  const d = pretendDrive()
  const { w, changes } = watch(d)
  d.quick = { drive: 'ok' }
  await w.tick()
  await w.tick()
  await w.tick()
  assert.deepEqual(w.state, { present: true, tracks: 12, id: 1 })
  assert.equal(changes.length, 1)
  assert.equal(d.fullAsked, 1)
  assert.equal(d.quickAsked, 3)
})

test('the disc is taken out: the CD is gone; a new disc is a new one (id counts up)', async () => {
  const d = pretendDrive()
  const { w, changes } = watch(d)
  d.quick = { drive: 'ok' }
  await w.tick()
  d.quick = { drive: 'open' }
  await w.tick()
  assert.equal(w.state.present, false)
  d.quick = { drive: 'ok' }
  d.full = { drive: 'ok', disc: 'audio', tracks: 9 }
  await w.tick()
  assert.deepEqual(w.state, { present: true, tracks: 9, id: 2 })
  assert.equal(changes.length, 3)
})

test('a data disc or a blank one is no CD, and is not read again and again', async () => {
  const d = pretendDrive()
  const { w } = watch(d)
  d.quick = { drive: 'ok' }
  d.full = { drive: 'ok', disc: 'data' }
  await w.tick()
  await w.tick()
  assert.equal(w.state.present, false)
  assert.equal(d.fullAsked, 1)
})

test('a drive that is still spinning up keeps what it had, and is asked again', async () => {
  const d = pretendDrive()
  const { w } = watch(d)
  d.quick = { drive: 'ok' }
  await w.tick()
  d.quick = { drive: 'notready' }
  await w.tick()
  assert.equal(w.state.present, true)
  d.quick = { drive: 'ok' }
  await w.tick()
  // it was seen as not ready in between: the contents are read again (the disc may be another one)
  assert.equal(d.fullAsked, 2)
})

test('a drive that cannot be opened: access is fixed (at most every 30 seconds), then it is asked again', async () => {
  const d = pretendDrive()
  let fixes = 0
  const { w } = watch(d, { fixAccess: () => fixes++ })
  d.quick = { drive: 'noaccess' }
  await w.tick()
  await w.tick()
  assert.equal(fixes, 1)
  assert.equal(w.state.present, false)
  d.quick = { drive: 'ok' }
  await w.tick()
  assert.equal(w.state.present, true)
})

test('a failed first question (no python, no drive) is no CD, never a crash', async () => {
  const { w } = watch({ probe: async () => ({ drive: 'error' }) })
  await w.tick()
  assert.deepEqual(w.state, NO_CD)
})

test('a box without a drive is asked only now and then', async () => {
  const d = pretendDrive()
  const { w } = watch(d)
  d.quick = { drive: 'nodrive' }
  for (let i = 0; i < 25; i++) await w.tick()
  // the first question, then every tenth tick
  assert.equal(d.quickAsked, 3)
  d.quick = { drive: 'ok' }
  for (let i = 0; i < 10; i++) await w.tick()
  assert.equal(w.state.present, true)
})
