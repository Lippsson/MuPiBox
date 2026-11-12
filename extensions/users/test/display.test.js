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
