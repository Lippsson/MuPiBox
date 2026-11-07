// node --test extensions/weather/test/weather.test.js
const test = require('node:test')
const assert = require('node:assert/strict')
const { _test } = require('../api.js')

test('the mean of directions goes around the north', () => {
  assert.equal(_test.circularMean([350, 10]), 0)
  assert.equal(_test.circularMean([90, 90, 90]), 90)
  assert.equal(_test.circularMean([]), null)
  assert.equal(_test.circularMean([0, 180]), null)
})

test('reads an answer of Open-Meteo', () => {
  const hours = Array.from({ length: 25 }, (_, i) => `2026-11-07T${String(i % 24).padStart(2, '0')}:00`)
  // 24 hours back from 01:00 and the hour ahead: here simply 25 hourly entries, the last two of them after "now"
  const body = {
    current: { time: '2026-11-07T01:45', temperature_2m: -11.6, relative_humidity_2m: 56, pressure_msl: 1012.4, wind_speed_10m: 5.6, wind_direction_10m: 11, wind_gusts_10m: 12.2 },
    hourly: {
      time: ['2026-11-06T23:00', '2026-11-07T00:00', '2026-11-07T01:00', '2026-11-07T02:00'],
      temperature_2m: [-10, -11, -11.5, -12],
      precipitation: [0.5, 0.25, 0, 3],
      wind_direction_10m: [350, 10, 20, 90],
    },
  }
  assert.equal(hours.length, 25)
  const r = _test.parseOpenMeteo(body)
  assert.equal(r.timeText, '01:45')
  assert.equal(r.temperature, -11.6)
  assert.equal(r.humidity, 56)
  assert.equal(r.windSpeed, 5.6)
  assert.equal(r.windGust, 12.2)
  assert.equal(r.pressure, 1012.4)
  // (the hour after 01:xx is not counted)
  assert.equal(r.rain24, 0.8)
  assert.equal(r.rainKind, 'past')
  assert.equal(r.tempMin, -11.6)
  assert.equal(r.tempMax, -10)
  assert.equal(r.windDirAvg, 7)
})

test('reads an answer of MET Norway (m/s become km/h, the rain is the forecast)', () => {
  const entry = (hour, t, rain) => ({
    time: `2026-11-07T${String(hour).padStart(2, '0')}:00:00Z`,
    data: { instant: { details: { air_temperature: t, relative_humidity: 80, wind_speed: 5, wind_speed_of_gust: 10, wind_from_direction: 270, air_pressure_at_sea_level: 1000 } }, next_1_hours: { details: { precipitation_amount: rain } } },
  })
  const r = _test.parseMetNo({ properties: { timeseries: [entry(0, 4, 0.5), entry(1, 3, 0.25), entry(2, 2, 0)] } })
  assert.equal(r.temperature, 4)
  assert.equal(r.windSpeed, 18)
  assert.equal(r.windGust, 36)
  assert.equal(r.windDir, 270)
  assert.equal(r.rain24, 0.8)
  assert.equal(r.rainKind, 'forecast')
  assert.equal(r.tempMin, 2)
  assert.equal(r.tempMax, 4)
})

test('refuses an answer without values', () => {
  assert.throws(() => _test.parseOpenMeteo({}))
  assert.throws(() => _test.parseMetNo({ properties: { timeseries: [] } }))
})

test('lists a place with its name and position', () => {
  const p = _test.placeOf({ name: 'Wien', admin1: 'Wien', country: 'Österreich', latitude: 48.20849, longitude: 16.37208 })
  assert.deepEqual(p.values, { placeName: 'Wien, Österreich', lat: 48.2085, lon: 16.3721 })
  assert.match(p.label, /Wien, Österreich/)
})
