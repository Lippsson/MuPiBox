// The weather, display part: a "Wetter" tab after the categories (when a place is chosen in the app) that opens a full-screen page with
// measuring dials - temperature, humidity, wind speed, wind direction, pressure and rain. The dials are the SteelSeries gauges
// (steelseries.bundled.js, BSD-2, see LICENSE-steelseries.md), which come with the extension, so the display draws them without the
// internet; the values come from the API part (api.js) every ten minutes.

const REFRESH_MS = 10 * 60 * 1000

/** The first of the steps that holds the value, else the last: a scale that fits what the dial shows. */
export function pickMax(value, steps) {
  return steps.find((s) => value <= s) ?? steps[steps.length - 1]
}

/** The scale of the pressure dial: 960 - 1040 hPa, wider when the pressure is outside of it. */
export function pressureScale(value) {
  if (!Number.isFinite(value)) return { min: 960, max: 1040 }
  return { min: Math.min(960, Math.floor((value - 10) / 10) * 10), max: Math.max(1040, Math.ceil((value + 10) / 10) * 10) }
}

/** The scale of the temperature dial: -30 - 50 °C, wider when it is colder or warmer. */
export function temperatureScale(value) {
  if (!Number.isFinite(value)) return { min: -30, max: 50 }
  return { min: Math.min(-30, Math.floor((value - 5) / 10) * 10), max: Math.max(50, Math.ceil((value + 5) / 10) * 10) }
}

const fmt = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '–')
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

/** The dials with their texts for an answer of the API part. */
export function dialsFor(data) {
  const t = temperatureScale(data.temperature)
  const p = pressureScale(data.pressure)
  return [
    { id: 'temp', kind: 'radial', title: 'Temperatur', unit: '°C', min: t.min, max: t.max, value: data.temperature, decimals: 1, caption: Number.isFinite(data.tempMin) ? `24 h: ${fmt(data.tempMin)} … ${fmt(data.tempMax)} °C` : '' },
    { id: 'hum', kind: 'radial', title: 'Luftfeuchte', unit: '%', min: 0, max: 100, value: data.humidity, decimals: 0, caption: '' },
    { id: 'wind', kind: 'radial', title: 'Windstärke', unit: 'km/h', min: 0, max: pickMax(Math.max(data.windSpeed || 0, data.windGust || 0), [30, 60, 120, 200]), value: data.windSpeed, decimals: 1, caption: Number.isFinite(data.windGust) ? `Böen bis ${fmt(data.windGust)} km/h` : '' },
    { id: 'dir', kind: 'direction', title: 'Windrichtung', latest: data.windDir, average: data.windDirAvg, caption: '' },
    { id: 'baro', kind: 'radial', title: 'Luftdruck', unit: 'hPa', min: p.min, max: p.max, value: data.pressure, decimals: 1, caption: '' },
    { id: 'rain', kind: 'radial', title: 'Regenmenge', unit: 'mm', min: 0, max: pickMax(data.rain24 || 0, [10, 25, 50, 100, 200, 400]), value: data.rain24, decimals: 1, caption: data.rainKind === 'forecast' ? 'Vorhersage, nächste 24 h' : 'letzte 24 h' },
  ]
}

const PROVIDERS = { openmeteo: 'Open-Meteo', metno: 'MET Norway' }

// the look of the dials: silver frame, beige face and display, red pointer
const LOOK = { frameDesign: 'METAL', backgroundColor: 'BEIGE', lcdColor: 'BEIGE', foregroundType: 'TYPE1', pointerColor: 'RED', transitionTime: 900 }

export function activate(api) {
  const settings = api.settings()
  const configured = Number.isFinite(settings?.lat) && Number.isFinite(settings?.lon)
  let library = null

  const loadLibrary = () => (library ??= import(api.url('steelseries.bundled.js')))

  function open() {
    api.overlay.open({
      title: settings?.placeName ? `Wetter – ${settings.placeName}` : 'Wetter',
      mount(content) {
        const box = document.createElement('div')
        box.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column'
        const row = document.createElement('div')
        row.style.cssText = 'flex:1;min-height:0;display:flex;justify-content:space-evenly;align-items:center;gap:0'
        const foot = document.createElement('div')
        foot.style.cssText = 'flex:none;height:30px;display:flex;align-items:center;justify-content:center;font:500 15px/1 var(--ion-font-family,inherit);opacity:.75;padding:0 16px;text-align:center'
        foot.textContent = 'Lade …'
        box.append(row, foot)
        content.append(box)

        const cells = new Map() // dial id -> { gauge, caption }
        let size = 200
        let closed = false

        const measure = () => {
          const w = content.clientWidth
          const h = content.clientHeight
          // (six dials in a row, a line of text under each and the status line at the bottom)
          size = Math.max(120, Math.floor(Math.min(w / 6 - 4, h - 30 - 30)))
          for (const { gauge } of cells.values()) gauge.size = size
        }

        const build = (dials) => {
          for (const dial of dials) {
            if (cells.has(dial.id)) continue
            const cell = document.createElement('div')
            cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px'
            const gauge = document.createElement(dial.kind === 'direction' ? 'steelseries-wind-direction' : 'steelseries-radial')
            Object.assign(gauge, LOOK, { size })
            if (dial.kind === 'direction') Object.assign(gauge, { titleString: dial.title, lcdTitleStrings: ['Aktuell', 'Mittelwert'], pointSymbols: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'], knobStyle: 'SILVER' })
            const caption = document.createElement('div')
            caption.style.cssText = 'height:26px;display:flex;align-items:center;font:500 15px/1 var(--ion-font-family,inherit);opacity:.85;text-align:center;white-space:nowrap'
            cell.append(gauge, caption)
            row.append(cell)
            cells.set(dial.id, { gauge, caption })
          }
        }

        const show = (data) => {
          const dials = dialsFor(data)
          build(dials)
          for (const dial of dials) {
            const { gauge, caption } = cells.get(dial.id)
            if (dial.kind === 'direction') {
              Object.assign(gauge, { valueLatest: Number.isFinite(dial.latest) ? dial.latest : 0, valueAverage: Number.isFinite(dial.average) ? dial.average : 0 })
            } else {
              // (the scale first, then the value: the pointer moves on the new scale)
              Object.assign(gauge, {
                minValue: dial.min,
                maxValue: dial.max,
                threshold: dial.max,
                titleString: dial.title,
                unitString: dial.unit,
                lcdDecimals: dial.decimals,
                value: Number.isFinite(dial.value) ? clamp(dial.value, dial.min, dial.max) : dial.min,
              })
            }
            caption.textContent = dial.caption
          }
          foot.textContent = [data.place, `Stand ${data.timeText}`, PROVIDERS[data.provider], data.stale ? 'Server antwortet nicht – letzte Werte' : ''].filter(Boolean).join('  ·  ')
        }

        const refresh = async () => {
          const data = await api.fetchApi('/data')
          if (closed) return
          if (!data) {
            if (cells.size === 0) foot.textContent = 'Keine Verbindung zur Box oder zum Wetterserver.'
            else foot.textContent = 'Keine Verbindung zum Wetterserver – letzte Werte'
            return
          }
          if (data.configured === false) {
            foot.textContent = 'Kein Ort gewählt. In der Webapp unter Erweiterungen › Wetter einen Ort suchen.'
            return
          }
          if (data.error) {
            foot.textContent = cells.size === 0 ? 'Der Wetterserver antwortet nicht.' : 'Der Wetterserver antwortet nicht – letzte Werte'
            return
          }
          show(data)
        }

        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
        observer?.observe(content)
        measure()
        loadLibrary().then(
          () => {
            if (closed) return
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
          observer?.disconnect()
          box.remove()
        }
      },
    })
  }

  api.tabs.set({ id: 'weather', src: api.url('icon.svg'), visible: configured, onSelect: open })
}
