// The weather, display part: a "Wetter" tab after the categories (when a place is chosen in the app) that opens a full-screen page with
// measuring dials - temperature, humidity, wind speed, wind direction, pressure and rain. The dials are the SteelSeries gauges
// (steelseries.js, BSD-2, see LICENSE-steelseries.md), which come with the extension, so the display draws them without the internet;
// the values come from the API part (api.js) every ten minutes.

const REFRESH_MS = 10 * 60 * 1000

/** The first of the steps that holds the value, else the last: a scale that fits what the dial shows. */
export function pickMax(value, steps) {
  return steps.find((s) => value <= s) ?? steps[steps.length - 1]
}

/** The scale of the temperature dial: -20 - 40 °C, wider (in steps of ten) when it is colder or warmer. */
export function temperatureScale(value) {
  if (!Number.isFinite(value)) return { min: -20, max: 40 }
  return { min: Math.min(-20, Math.floor((value - 5) / 10) * 10), max: Math.max(40, Math.ceil((value + 5) / 10) * 10) }
}

/** The scale of the pressure dial: 960 - 1060 hPa, wider when the pressure is outside of it. */
export function pressureScale(value) {
  if (!Number.isFinite(value)) return { min: 960, max: 1060 }
  return { min: Math.min(960, Math.floor((value - 10) / 10) * 10), max: Math.max(1060, Math.ceil((value + 10) / 10) * 10) }
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

/** A coloured scale in steps of five degrees: blue when it is cold, over green and yellow to red when it is hot. */
export function temperatureSections(min, max) {
  const out = []
  for (let from = min; from < max; from += 5) out.push({ start: from, stop: Math.min(max, from + 5), color: tempColor(from + 2.5) })
  return out
}

const range = (low, high, min, max) => (Number.isFinite(low) && Number.isFinite(high) && high >= low ? [{ start: clamp(low, min, max), stop: clamp(high, min, max), color: RANGE }] : [])

const fmt = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '–')
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const trendName = (n) => (n > 0 ? 'UP' : n < 0 ? 'DOWN' : 'STEADY')

/** The dials with their scales, coloured sections, areas and texts for an answer of the API part. */
export function dialsFor(data) {
  const t = temperatureScale(data.temperature)
  const p = pressureScale(data.pressure)
  const windMax = pickMax(Math.max(data.windSpeed || 0, data.windGust || 0), [30, 60, 120, 200])
  const rainMax = pickMax(data.rain24 || 0, [10, 25, 50, 100, 200, 400])
  return [
    { id: 'temp', kind: 'radial', title: 'Temperatur', unit: '°C', min: t.min, max: t.max, value: data.temperature, decimals: 1, sections: temperatureSections(t.min, t.max), areas: range(data.tempMin, data.tempMax, t.min, t.max), minMeasured: data.tempMin, maxMeasured: data.tempMax, trend: data.trend?.temp ?? 0, caption: '' },
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
    { id: 'wind', kind: 'radial', title: 'Windstärke', unit: 'km/h', min: 0, max: windMax, value: data.windSpeed, decimals: 1, sections: [], areas: range(data.windSpeed, data.windGust, 0, windMax), trend: 0, caption: Number.isFinite(data.windGust) ? `Böen bis ${fmt(data.windGust)} km/h` : '' },
    { id: 'dir', kind: 'direction', title: 'Windrichtung', latest: data.windDir, average: data.windDirAvg, caption: 'legend' },
    // (a low and a high pressure are the red ends of the scale)
    { id: 'baro', kind: 'radial', title: 'Luftdruck', unit: 'hPa', min: p.min, max: p.max, value: data.pressure, decimals: 1, sections: [], areas: [{ start: p.min, stop: 975, color: 'rgba(225,30,0,0.55)' }, { start: 1045, stop: p.max, color: 'rgba(225,30,0,0.55)' }], minMeasured: data.pressMin, maxMeasured: data.pressMax, trend: data.trend?.press ?? 0, caption: '' },
    {
      id: 'rain', kind: 'radial', title: 'Regenmenge', unit: data.rainKind === 'forecast' ? 'mm / nächste 24 h' : 'mm / 24 h', min: 0, max: rainMax, value: data.rain24, decimals: 1,
      sections: [
        { start: 0, stop: rainMax * 0.5, color: 'rgb(0,170,60)' },
        { start: rainMax * 0.5, stop: rainMax * 0.8, color: WARM },
        { start: rainMax * 0.8, stop: rainMax, color: RED },
      ],
      areas: [], trend: 0, caption: '',
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
          for (const dial of dialsFor(data)) {
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
              trendVisible: dial.trend !== 0,
            })
            if (Number.isFinite(dial.minMeasured)) gauge.setMinMeasuredValue(clamp(dial.minMeasured, dial.min, dial.max))
            if (Number.isFinite(dial.maxMeasured)) gauge.setMaxMeasuredValue(clamp(dial.maxMeasured, dial.min, dial.max))
            if (dial.trend !== 0) gauge.setTrend(ss.TrendState[trendName(dial.trend)])
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
        const timer = setInterval(() => void refresh(), REFRESH_MS)
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
