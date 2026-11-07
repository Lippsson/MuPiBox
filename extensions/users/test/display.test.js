// node --test extensions/users/test/display.test.js
const test = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../display.js')

test('the badge shows the first letter or digit of the name, in upper case', async () => {
  const { initialOf } = await load()
  assert.equal(initialOf('mia'), 'M')
  assert.equal(initialOf('  émile'), 'É')
  assert.equal(initialOf('2. Kind'), '2')
  assert.equal(initialOf('...'), '?')
  assert.equal(initialOf(undefined), '?')
})
