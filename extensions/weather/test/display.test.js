// node --test extensions/weather/test/display.test.js
const test = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../display.js')

const data = { configured: true, provider: 'openmeteo', temperature: 3.3, humidity: 84, windSpeed: 8.3, windGust: 15.5, windDir: 95, windDirAvg: 69, pressure: 1027.2, rain24: 0, rainKind: 'past', tempMin: 0.1, tempMax: 9.4, humMin: 60, humMax: 90, pressMin: 1025, pressMax: 1028, trend: { temp: 1, hum: 0, press: -1 } }

test('the scales hold the value, wider in steps of ten when needed', async () => {
  const { temperatureScale, pressureScale, pickMax } = await load()
  assert.deepEqual(temperatureScale(3), { min: -20, max: 40 })
  assert.deepEqual(temperatureScale(-31), { min: -40, max: 40 })
  assert.deepEqual(temperatureScale(44), { min: -20, max: 50 })
  assert.deepEqual(pressureScale(1013), { min: 960, max: 1060 })
  assert.deepEqual(pressureScale(940), { min: 930, max: 1060 })
  assert.equal(pickMax(8, [30, 60]), 30)
  assert.equal(pickMax(31, [30, 60]), 60)
  assert.equal(pickMax(99, [30, 60]), 60)
})

test('the temperature scale is coloured in steps of five degrees from blue to red', async () => {
  const { temperatureSections } = await load()
  const sections = temperatureSections(-20, 40)
  assert.equal(sections.length, 12)
  assert.equal(sections[0].start, -20)
  assert.equal(sections.at(-1).stop, 40)
  assert.notEqual(sections[0].color, sections.at(-1).color)
})

test('makes the six dials: no dew point, no rain rate', async () => {
  const { dialsFor } = await load()
  const dials = dialsFor(data)
  assert.deepEqual(dials.map((d) => d.id), ['temp', 'hum', 'wind', 'dir', 'baro', 'rain'])
  const wind = dials.find((d) => d.id === 'wind')
  assert.equal(wind.max, 30)
  // (the red band lies between the wind and the gust)
  assert.deepEqual([wind.areas[0].start, wind.areas[0].stop], [8.3, 15.5])
  assert.match(wind.caption, /15,5/)
  assert.equal(dials.find((d) => d.id === 'temp').trend, 1)
  assert.equal(dials.find((d) => d.id === 'baro').trend, -1)
  assert.equal(dials.find((d) => d.id === 'dir').average, 69)
  assert.match(dials.find((d) => d.id === 'rain').unit, /24 h/)
})

test('says that the rain of MET Norway is a forecast', async () => {
  const { dialsFor } = await load()
  assert.match(dialsFor({ ...data, rainKind: 'forecast' }).find((d) => d.id === 'rain').unit, /nächste 24 h/)
})

test('copes with missing values', async () => {
  const { dialsFor } = await load()
  const dials = dialsFor({ temperature: 5, humidity: null, windSpeed: null, windGust: null, windDir: null, windDirAvg: null, pressure: null, rain24: null })
  assert.equal(dials.length, 6)
  assert.deepEqual(dials.find((d) => d.id === 'wind').areas, [])
})

test('the refresh interval: seconds or minutes as set, 10 seconds at the least, a day at the most, 10 minutes by default', async () => {
  const { intervalMs } = await load()
  assert.equal(intervalMs({}), 600000)
  assert.equal(intervalMs(undefined), 600000)
  assert.equal(intervalMs({ refreshEvery: 30, refreshUnit: 'seconds' }), 30000)
  assert.equal(intervalMs({ refreshEvery: 5, refreshUnit: 'minutes' }), 300000)
  assert.equal(intervalMs({ refreshEvery: 2 }), 120000)
  assert.equal(intervalMs({ refreshEvery: 1, refreshUnit: 'seconds' }), 10000)
  assert.equal(intervalMs({ refreshEvery: 999, refreshUnit: 'minutes' }), 59940000)
  assert.equal(intervalMs({ refreshEvery: 99999, refreshUnit: 'minutes' }), 86400000)
  assert.equal(intervalMs({ refreshEvery: 'x', refreshUnit: 'seconds' }), 600000)
})
