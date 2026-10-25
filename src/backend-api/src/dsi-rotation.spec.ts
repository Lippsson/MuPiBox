import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { dsiConfig, dsiOutput, isDsiRotation } from './eltern/dsi-rotation'

// a touch at (x, y) in 0..1 becomes (a x + b y + c, d x + e y + f)
function apply(matrix: string, x: number, y: number): number[] {
  const [a, b, c, d, e, f] = matrix.split(' ').map(Number)
  return [a * x + b * y + c, d * x + e * y + f]
}
const matrixOf = (rotation: '1' | '2' | '3' | '0x10000' | '0x20000'): string => /CalibrationMatrix" "([-\d ]+)"/.exec(dsiConfig('DSI-1', rotation)?.touch ?? '')?.[1] ?? ''

describe('dsi rotation', () => {
  it('knows the six values of display_hdmi_rotate, nothing else', () => {
    for (const v of ['0', '1', '2', '3', '0x10000', '0x20000']) assert.equal(isDsiRotation(v), true)
    for (const v of ['4', '0x30000', '', 1, null, 'right']) assert.equal(isDsiRotation(v), false)
  })

  it('writes nothing for no rotation (the files are removed)', () => {
    assert.equal(dsiConfig('DSI-1', '0'), null)
  })

  it('90 degrees turns the screen to the right and the touch with it', () => {
    const c = dsiConfig('DSI-1', '1')
    assert.ok(c)
    assert.match(c.screen, /Identifier "DSI-1"/)
    assert.match(c.screen, /Option "Rotate" "right"/)
    assert.doesNotMatch(c.screen, /Reflect/)
    assert.match(c.touch, /CalibrationMatrix" "0 1 0 -1 0 1 0 0 1"/)
  })

  it('180 and 270 degrees', () => {
    assert.match(dsiConfig('DSI-2', '2')?.screen ?? '', /Rotate" "inverted"/)
    assert.match(dsiConfig('DSI-2', '3')?.screen ?? '', /Rotate" "left"/)
    assert.match(dsiConfig('DSI-2', '3')?.touch ?? '', /"0 -1 1 1 0 0 0 0 1"/)
  })

  it('the mirrorings reflect and do not turn', () => {
    const h = dsiConfig('DSI-1', '0x10000')
    assert.match(h?.screen ?? '', /Reflect" "x"/)
    assert.doesNotMatch(h?.screen ?? '', /Rotate/)
    const v = dsiConfig('DSI-1', '0x20000')
    assert.match(v?.screen ?? '', /Reflect" "y"/)
    assert.doesNotMatch(v?.screen ?? '', /Rotate/)
  })

  it('the touch matrices move the corners as the picture moves them', () => {
    // turned right: the picture's top is at the right
    assert.deepEqual(apply(matrixOf('1'), 0, 0), [0, 1])
    assert.deepEqual(apply(matrixOf('1'), 1, 0), [0, 0])
    assert.deepEqual(apply(matrixOf('3'), 0, 0), [1, 0])
    assert.deepEqual(apply(matrixOf('2'), 0, 0), [1, 1])
    // mirrored left-right: x turns round, y stays; mirrored top-bottom: the other way
    assert.deepEqual(apply(matrixOf('0x10000'), 0.25, 0.25), [0.75, 0.25])
    assert.deepEqual(apply(matrixOf('0x20000'), 0.25, 0.25), [0.25, 0.75])
  })

  it('refuses a name that is no DSI connector (it goes into a file for X)', () => {
    assert.throws(() => dsiConfig('HDMI-A-1', '1'))
    assert.throws(() => dsiConfig('DSI-1"\nEndSection', '1'))
  })

  it('finds the DSI connector that has a display', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'drm-'))
    for (const [name, status] of [
      ['card1-HDMI-A-1', 'disconnected'],
      ['card1-DSI-1', 'disconnected'],
      ['card1-DSI-2', 'connected'],
    ]) {
      mkdirSync(path.join(dir, name))
      writeFileSync(path.join(dir, name, 'status'), `${status}\n`)
    }
    assert.equal(await dsiOutput(dir), 'DSI-2')
    assert.equal(await dsiOutput(path.join(dir, 'nothing')), null)
  })
})
