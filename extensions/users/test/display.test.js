// node --test extensions/users/test/display.test.js
const test = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../display.js')

test('the dot has the colour of the user; whatever is no colour is grey', async () => {
  const { colorOf } = await load()
  assert.equal(colorOf({ color: '#FF0000' }), '#FF0000')
  assert.equal(colorOf({ color: '#00ffff' }), '#00ffff')
  assert.equal(colorOf({ color: 'red' }), '#808080')
  assert.equal(colorOf({ color: 'url(x)' }), '#808080')
  assert.equal(colorOf(undefined), '#808080')
})

test('the way of switching and the time a tile is held, as the API part says them', async () => {
  const { modeOf, holdMs } = await load()
  assert.equal(modeOf({ mode: 'hold' }), 'hold')
  assert.equal(modeOf({ mode: 'app' }), 'app')
  assert.equal(modeOf({ mode: 'nope' }), 'free')
  assert.equal(modeOf(null), 'free')
  assert.equal(holdMs({ holdSeconds: 4 }), 4000)
  assert.equal(holdMs({ holdSeconds: 0 }), 3000)
  assert.equal(holdMs({}), 3000)
})
