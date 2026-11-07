const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { describe, it } = require('node:test')
const { status } = require('../api.js')

describe('unit-demo status', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-demo-'))
  it('is not running without a heartbeat file', () => {
    assert.deepStrictEqual(status(dir), { running: false })
  })
  it('is running when the last beat is recent, and not when it is old', () => {
    const now = Date.parse('2026-01-01T00:01:00Z')
    fs.writeFileSync(path.join(dir, 'heartbeat.json'), JSON.stringify({ pid: 7, startedAt: '2026-01-01T00:00:00Z', lastBeat: '2026-01-01T00:00:50Z', beats: 6 }))
    assert.strictEqual(status(dir, now).running, true)
    assert.strictEqual(status(dir, now).beats, 6)
    assert.strictEqual(status(dir, now + 60 * 1000).running, false)
  })
  it('is not running when the file makes no sense', () => {
    fs.writeFileSync(path.join(dir, 'heartbeat.json'), 'not json')
    assert.deepStrictEqual(status(dir), { running: false })
  })
})
