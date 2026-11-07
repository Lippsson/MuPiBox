// The weather, display part: a "Wetter" tab after the categories (when a place is chosen in the app) that opens a full-screen page with
// measuring dials - temperature, humidity, wind speed, wind direction, pressure and rain. The dials are the SteelSeries gauges
// (steelseries.js, BSD-2, see LICENSE-steelseries.md), which come with the extension, so the display draws them without the internet;
// the values come from the API part (api.js) as often as the app says (every ten minutes unless set otherwise).

const UNIT_MS = { seconds: 1000, minutes: 60 * 1000 }

/** How often the open page asks for new values (every N seconds or minutes, as set): from 10 seconds to a day, 10 minutes when nothing is set. */
export function intervalMs(settings) {
  const every = Number(settings?.refreshEvery)
  const ms = Number.isFinite(every) && every > 0 ? every * (UNIT_MS[settings?.refreshUnit] ?? UNIT_MS.minutes) : 10 * UNIT_MS.minutes
  return Math.min(Math.max(Math.round(ms), 10 * 1000), 24 * 60 * 60 * 1000)
}

/** The first of the steps that holds the value, else the last: a scale that fits what the dial shows. */
export function pickMax(value, steps) {
  return steps.find((s) => value <= s) ?? steps[steps.length - 1]
}

// The units to choose (the API part always answers in °C, mm, hPa and km/h): how to count over from those, the text on the dial, the
// decimals of the display and the steps of the scale that fits.
export const UNITS = {
  temp: {
    c: { label: '°C', from: (v) => v, decimals: 1 },
    f: { label: '°F', from: (v) => (v * 9) / 5 + 32, decimals: 1 },
  },
  rain: {
    mm: { label: 'mm', from: (v) => v, decimals: 1, steps: [10, 25, 50, 100, 200, 400] },
    inch: { label: 'inch', from: (v) => v / 25.4, decimals: 2, steps: [0.5, 1, 2, 4, 8, 16] },
  },
  press: {
    hpa: { label: 'hPa', from: (v) => v, decimals: 1, base: { min: 960, max: 1060, step: 10 } },
    mb: { label: 'mb', from: (v) => v, decimals: 1, base: { min: 960, max: 1060, step: 10 } },
    inhg: { label: 'inHg', from: (v) => v * 0.02953, decimals: 2, base: { min: 28, max: 31.5, step: 0.5 } },
    kpa: { label: 'kPa', from: (v) => v / 10, decimals: 2, base: { min: 96, max: 106, step: 1 } },
  },
  wind: {
    kmh: { label: 'km/h', from: (v) => v, decimals: 1, steps: [30, 60, 120, 200] },
    ms: { label: 'm/s', from: (v) => v / 3.6, decimals: 1, steps: [10, 20, 30, 60] },
    mph: { label: 'mph', from: (v) => v * 0.621371, decimals: 1, steps: [20, 40, 80, 120] },
    kn: { label: 'knots', from: (v) => v * 0.539957, decimals: 1, steps: [20, 40, 60, 100] },
  },
}
const UNIT_DEFAULTS = { temp: 'c', rain: 'mm', press: 'hpa', wind: 'kmh' }
const UNIT_KEYS = { temp: 'tempUnit', rain: 'rainUnit', press: 'pressUnit', wind: 'windUnit' }

/** The chosen units of the settings (an unknown or missing one is the default: °C, mm, hPa, km/h). */
export function unitsOf(settings) {
  const out = {}
  for (const kind of Object.keys(UNIT_KEYS)) {
    const wanted = settings?.[UNIT_KEYS[kind]]
    out[kind] = Object.hasOwn(UNITS[kind], wanted) ? wanted : UNIT_DEFAULTS[kind]
  }
  return out
}

/** The scale of the temperature dial: -20 - 40 °C (-20 - 100 °F), wider (in steps of ten, in °F of twenty) when it is colder or warmer. */
export function temperatureScale(value, unit = 'c') {
  const step = unit === 'f' ? 20 : 10
  const base = unit === 'f' ? { min: -20, max: 100 } : { min: -20, max: 40 }
  if (!Number.isFinite(value)) return base
  const pad = step / 2
  return { min: Math.min(base.min, Math.floor((value - pad) / step) * step), max: Math.max(base.max, Math.ceil((value + pad) / step) * step) }
}

/** The scale of the pressure dial: 960 - 1060 hPa (28 - 31.5 inHg, 96 - 106 kPa), wider when the pressure is outside of it. */
export function pressureScale(value, unit = 'hpa') {
  const { min, max, step } = UNITS.press[unit].base
  if (!Number.isFinite(value)) return { min, max }
  return { min: Math.min(min, Math.floor((value - step) / step) * step), max: Math.max(max, Math.ceil((value + step) / step) * step) }
}

const COLD = 'rgb(0,60,200)'
const COOL = 'rgb(0,140,255)'
const MILD = 'rgb(0,175,120)'
const FRESH = 'rgb(120,200,0)'
const WARM = 'rgb(235,205,0)'
const HOT = 'rgb(255,140,0)'
const RED = 'rgb(225,30,0)'
const RANGE = 'rgba(225,30,0,0.28)'

const tempColor = (t) => (t < -10 ? COLD : t < 0 ? COOL : t < 10 ? MILD : t < 20 ? FRESH : t < 25 ? WARM : t < 30 ? HOT : RED)

/** A coloured scale in steps of five degrees (ten in °F): blue when it is cold, over green and yellow to red when it is hot. */
export function temperatureSections(min, max, unit = 'c') {
  const step = unit === 'f' ? 10 : 5
  const out = []
  for (let from = min; from < max; from += step) {
    const middle = from + step / 2
    out.push({ start: from, stop: Math.min(max, from + step), color: tempColor(unit === 'f' ? ((middle - 32) * 5) / 9 : middle) })
  }
  return out
}

const range = (low, high, min, max) => (Number.isFinite(low) && Number.isFinite(high) && high >= low ? [{ start: clamp(low, min, max), stop: clamp(high, min, max), color: RANGE }] : [])

const fmt = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '–')
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const trendName = (n) => (n > 0 ? 'UP' : n < 0 ? 'DOWN' : 'STEADY')

/** The dials with their scales, coloured sections, areas and texts for an answer of the API part, in the chosen units. */
export function dialsFor(data, units = UNIT_DEFAULTS) {
  const U = {
    temp: UNITS.temp[units.temp] ?? UNITS.temp.c,
    rain: UNITS.rain[units.rain] ?? UNITS.rain.mm,
    press: UNITS.press[units.press] ?? UNITS.press.hpa,
    wind: UNITS.wind[units.wind] ?? UNITS.wind.kmh,
  }
  // (a missing value stays missing)
  const to = (unit) => (v) => (Number.isFinite(v) ? unit.from(v) : v)
  const temp = to(U.temp)
  const press = to(U.press)
  const wind = to(U.wind)
  const rain = to(U.rain)
  const tUnit = U.temp === UNITS.temp.f ? 'f' : 'c'
  const pUnit = Object.keys(UNITS.press).find((k) => UNITS.press[k] === U.press)
  const temperature = temp(data.temperature)
  const t = temperatureScale(temperature, tUnit)
  const pressure = press(data.pressure)
  const p = pressureScale(pressure, pUnit)
  const windSpeed = wind(data.windSpeed)
  const windGust = wind(data.windGust)
  const windMax = pickMax(Math.max(windSpeed || 0, windGust || 0), U.wind.steps)
  const rain24 = rain(data.rain24)
  const rainMax = pickMax(rain24 || 0, U.rain.steps)
  // (a low and a high pressure are the red ends of the scale)
  const warn = 'rgba(225,30,0,0.55)'
  const pLow = press(975)
  const pHigh = press(1045)
  return [
    { id: 'temp', kind: 'radial', title: 'Temperatur', unit: U.temp.label, min: t.min, max: t.max, value: temperature, decimals: U.temp.decimals, sections: temperatureSections(t.min, t.max, tUnit), areas: range(temp(data.tempMin), temp(data.tempMax), t.min, t.max), minMeasured: temp(data.tempMin), maxMeasured: temp(data.tempMax), trend: data.trend?.temp ?? 0, caption: '' },
    {
      id: 'hum', kind: 'radial', title: 'Luftfeuchte', unit: '%', min: 0, max: 100, value: data.humidity, decimals: 1,
      sections: [
        { start: 0, stop: 20, color: WARM },
        { start: 20, stop: 30, color: FRESH },
        { start: 30, stop: 70, color: 'rgb(0,170,60)' },
        { start: 70, stop: 85, color: FRESH },
        { start: 85, stop: 100, color: RED },
      ],
      areas: range(data.humMin, data.humMax, 0, 100), minMeasured: data.humMin, maxMeasured: data.humMax, trend: data.trend?.hum ?? 0, caption: '',
    },
    // (the red band: from the wind to the gust)
    { id: 'wind', kind: 'radial', title: 'Windstärke', unit: U.wind.label, min: 0, max: windMax, value: windSpeed, decimals: U.wind.decimals, sections: [], areas: range(windSpeed, windGust, 0, windMax), trend: null, caption: Number.isFinite(windGust) ? `Böen bis ${fmt(windGust, U.wind.decimals)} ${U.wind.label}` : '' },
    { id: 'dir', kind: 'direction', title: 'Windrichtung', latest: data.windDir, average: data.windDirAvg, caption: 'legend' },
    { id: 'baro', kind: 'radial', title: 'Luftdruck', unit: U.press.label, min: p.min, max: p.max, value: pressure, decimals: U.press.decimals, sections: [], areas: [{ start: p.min, stop: pLow, color: warn }, { start: pHigh, stop: p.max, color: warn }], minMeasured: press(data.pressMin), maxMeasured: press(data.pressMax), trend: data.trend?.press ?? 0, caption: '' },
    {
      id: 'rain', kind: 'radial', title: 'Regenmenge', unit: `${U.rain.label} / ${data.rainKind === 'forecast' ? 'nächste 24 h' : '24 h'}`, min: 0, max: rainMax, value: rain24, decimals: U.rain.decimals,
      sections: [
        { start: 0, stop: rainMax * 0.5, color: 'rgb(0,170,60)' },
        { start: rainMax * 0.5, stop: rainMax * 0.8, color: WARM },
        { start: rainMax * 0.8, stop: rainMax, color: RED },
      ],
      areas: [], trend: null, caption: '',
    },
  ]
}

const PROVIDERS = { openmeteo: 'Open-Meteo', metno: 'MET Norway' }

export function activate(api) {
  const settings = api.settings()
  const configured = Number.isFinite(settings?.lat) && Number.isFinite(settings?.lon)
  let library = null

  // (a classic script: the library puts `steelseries` on the page)
  const loadLibrary = () =>
    (library ??= new Promise((resolve, reject) => {
      if (window.steelseries) return resolve(window.steelseries)
      const script = document.createElement('script')
      script.src = api.url('steelseries.js')
      script.onload = () => (window.steelseries ? resolve(window.steelseries) : reject(new Error('no steelseries')))
      script.onerror = () => reject(new Error('steelseries.js did not load'))
      document.head.append(script)
    }))

  function open() {
    api.overlay.open({
      title: settings?.placeName ? `Wetter – ${settings.placeName}` : 'Wetter',
      mount(content) {
        const box = document.createElement('div')
        box.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column'
        const row = document.createElement('div')
        row.style.cssText = 'flex:1;min-height:0;display:flex;justify-content:space-evenly;align-items:center'
        const foot = document.createElement('div')
        foot.style.cssText = 'flex:none;height:30px;display:flex;align-items:center;justify-content:center;font:500 15px/1 var(--ion-font-family,inherit);opacity:.75;padding:0 16px;text-align:center'
        foot.textContent = 'Lade …'
        box.append(row, foot)
        content.append(box)

        let ss = null
        let data = null
        let closed = false
        // (what each dial showed last: a new answer moves the pointers from there to the new value, as on the club's page)
        const shown = new Map()
        let lastSize = 0

        // (six dials in a row, a line of text under each and the status line at the bottom)
        const dialSize = () => Math.max(120, Math.floor(Math.min(content.clientWidth / 6 - 4, content.clientHeight - 30 - 30)))

        // Every dial is drawn again from the last answer: when the values come (`moving`: the pointers swing to them) and when the
        // page changes its size (a dial has a fixed size; the pointers stand at once).
        const draw = (moving) => {
          if (!ss || !data) return
          const size = dialSize()
          lastSize = size
          row.textContent = ''
          for (const dial of dialsFor(data, unitsOf(settings))) {
            const cell = document.createElement('div')
            cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px'
            const canvas = document.createElement('canvas')
            const caption = document.createElement('div')
            caption.style.cssText = 'height:26px;display:flex;align-items:center;gap:14px;font:500 15px/1 var(--ion-font-family,inherit);opacity:.85;white-space:nowrap'
            cell.append(canvas, caption)
            row.append(cell)
            const look = {
              size,
              frameDesign: ss.FrameDesign.METAL,
              backgroundColor: ss.BackgroundColor.BEIGE,
              lcdColor: ss.LcdColor.STANDARD,
              pointerColor: ss.ColorDef.RED,
              foregroundType: ss.ForegroundType.TYPE1,
              knobType: ss.KnobType.METAL_KNOB,
              knobStyle: ss.KnobStyle.SILVER,
              ledVisible: false,
              // (seconds of a swing over the whole scale: 5 as on the club's page, the library's own 2.5 is too quick)
              fullScaleDeflectionTime: 5,
            }
            if (dial.kind === 'direction') {
              const gauge = new ss.WindDirection(canvas, { ...look, lcdTitleStrings: ['Aktuell', 'Mittelwert'], pointSymbols: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'], pointerColorAverage: ss.ColorDef.BLUE })
              const latest = Number.isFinite(dial.latest) ? dial.latest : 0
              const average = Number.isFinite(dial.average) ? dial.average : 0
              if (moving) {
                const from = shown.get(dial.id)
                if (from) {
                  gauge.setValueLatest(from.latest)
                  gauge.setValueAverage(from.average)
                }
                gauge.setValueAnimatedLatest(latest)
                gauge.setValueAnimatedAverage(average)
              } else {
                gauge.setValueLatest(latest)
                gauge.setValueAverage(average)
              }
              shown.set(dial.id, { latest, average })
              // (the colours of the two pointers)
              for (const [text, color] of [['Aktuell', 'rgb(225,30,40)'], ['Mittelwert', 'rgb(0,150,220)']]) {
                const item = document.createElement('span')
                item.style.cssText = 'display:inline-flex;align-items:center;gap:6px'
                const bar = document.createElement('span')
                bar.style.cssText = `display:inline-block;width:26px;height:8px;background:${color}`
                item.append(bar, text)
                caption.append(item)
              }
              continue
            }
            const gauge = new ss.Radial(canvas, {
              ...look,
              gaugeType: ss.GaugeType.TYPE4,
              minValue: dial.min,
              maxValue: dial.max,
              titleString: dial.title,
              unitString: dial.unit,
              lcdDecimals: dial.decimals,
              section: dial.sections,
              area: dial.areas,
              thresholdVisible: false,
              minMeasuredValueVisible: Number.isFinite(dial.minMeasured),
              maxMeasuredValueVisible: Number.isFinite(dial.maxMeasured),
              // (the arrows are always there, as on the club's page: the one of the trend lights up, steady included)
              trendVisible: Number.isFinite(dial.trend),
            })
            if (Number.isFinite(dial.minMeasured)) gauge.setMinMeasuredValue(clamp(dial.minMeasured, dial.min, dial.max))
            if (Number.isFinite(dial.maxMeasured)) gauge.setMaxMeasuredValue(clamp(dial.maxMeasured, dial.min, dial.max))
            if (Number.isFinite(dial.trend)) gauge.setTrend(ss.TrendState[trendName(dial.trend)])
            const value = Number.isFinite(dial.value) ? clamp(dial.value, dial.min, dial.max) : dial.min
            if (moving) {
              // (the first time from the start of the scale, later from the value shown before)
              if (shown.has(dial.id)) gauge.setValue(shown.get(dial.id))
              gauge.setValueAnimated(value)
            } else gauge.setValue(value)
            shown.set(dial.id, value)
            caption.textContent = dial.caption
          }
        }

        const refresh = async () => {
          const answer = await api.fetchApi('/data')
          if (closed) return
          if (!answer) {
            foot.textContent = data ? 'Keine Verbindung zum Wetterserver – letzte Werte' : 'Keine Verbindung zur Box oder zum Wetterserver.'
            return
          }
          if (answer.configured === false) {
            foot.textContent = 'Kein Ort gewählt. In der Webapp unter Erweiterungen › Wetter einen Ort suchen.'
            return
          }
          if (answer.error) {
            foot.textContent = data ? 'Der Wetterserver antwortet nicht – letzte Werte' : 'Der Wetterserver antwortet nicht.'
            return
          }
          data = answer
          draw(true)
          foot.textContent = [answer.place, `Stand ${answer.timeText}`, PROVIDERS[answer.provider], answer.stale ? 'Server antwortet nicht – letzte Werte' : ''].filter(Boolean).join('  ·  ')
        }

        let resizeTimer = null
        const observer =
          typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(() => {
                clearTimeout(resizeTimer)
                // (the first call of the observer comes at once, with the size the dials already have: it must not cut the swing short)
                resizeTimer = setTimeout(() => {
                  if (dialSize() !== lastSize) draw(false)
                }, 200)
              })
        observer?.observe(content)
        loadLibrary().then(
          (lib) => {
            if (closed) return
            ss = lib
            void refresh()
          },
          () => {
            foot.textContent = 'Die Anzeigen konnten nicht geladen werden.'
          },
        )
        const timer = setInterval(() => void refresh(), intervalMs(settings))
        return () => {
          closed = true
          clearInterval(timer)
          clearTimeout(resizeTimer)
          observer?.disconnect()
          box.remove()
        }
      },
    })
  }

  api.tabs.set({ id: 'weather', src: api.url('icon.svg'), visible: configured, onSelect: open })
}
