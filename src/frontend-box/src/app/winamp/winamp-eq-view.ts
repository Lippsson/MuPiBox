// The equaliser window of Winamp (275 x 116): ON and AUTO buttons, the curve, PRESETS, the pre-amp and ten band sliders.
// Built from eqmain.bmp. The values are in dB (-12 .. +12); the service sends them to the player.

import { dragValue, el, ref, setSprite, Skin, sprite, WaButton } from './winamp-skin'

export const EQ_W = 275
export const EQ_H = 116

export const EQ_BANDS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K']
export const EQ_FREQS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000]

export interface EqState {
  on: boolean
  auto: boolean
  /** dB, -12 .. 12 */
  preamp: number
  /** ten bands in dB */
  bands: number[]
}

export const EQ_FLAT: EqState = { on: false, auto: false, preamp: 0, bands: new Array<number>(10).fill(0) }

// Winamp's own presets (preamp stays where it is); values in dB, cut to the sliders' range
export const EQ_PRESETS: { name: string; bands: number[] }[] = [
  { name: 'Classical', bands: [0, 0, 0, 0, 0, 0, -7, -7, -7, -9] },
  { name: 'Club', bands: [0, 0, 8, 5, 5, 5, 3, 0, 0, 0] },
  { name: 'Dance', bands: [9, 7, 2, 0, 0, -5, -7, -7, 0, 0] },
  { name: 'Flat', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Full Bass', bands: [-8, 9, 9, 5, 1, -4, -8, -10, -11, -11] },
  { name: 'Full Bass & Treble', bands: [7, 5, 0, -7, -4, 1, 8, 11, 12, 12] },
  { name: 'Full Treble', bands: [-9, -9, -9, -4, 2, 11, 12, 12, 12, 12] },
  { name: 'Laptop Speakers', bands: [4, 11, 5, -3, -2, 1, 4, 9, 12, 12] },
  { name: 'Large Hall', bands: [10, 10, 5, 5, 0, -4, -4, -4, 0, 0] },
  { name: 'Live', bands: [-4, 0, 4, 5, 5, 5, 4, 2, 2, 2] },
  { name: 'Party', bands: [7, 7, 0, 0, 0, 0, 0, 0, 7, 7] },
  { name: 'Pop', bands: [-2, 4, 7, 8, 5, 0, -2, -2, -2, -2] },
  { name: 'Reggae', bands: [0, 0, -1, -6, 0, -6, -4, 0, 0, 0] },
  { name: 'Rock', bands: [8, 4, -5, -8, -3, 4, 8, 11, 11, 11] },
  { name: 'Ska', bands: [-2, -4, -4, 0, 4, 5, 8, 9, 11, 9] },
  { name: 'Soft', bands: [4, 1, 0, -2, 0, 4, 8, 9, 11, 12] },
  { name: 'Soft Rock', bands: [4, 4, 2, 0, -4, -5, -3, 0, 2, 8] },
  { name: 'Techno', bands: [8, 5, 0, -5, -4, 0, 8, 9, 9, 8] },
]

const SLIDER_H = 63
const THUMB = 11
const clampDb = (v: number) => Math.max(-12, Math.min(12, Math.round(v * 2) / 2))

export class WinampEqView {
  readonly node: HTMLElement
  private state: EqState = { ...EQ_FLAT, bands: [...EQ_FLAT.bands] }
  private readonly sliders: { box: HTMLElement; thumb: HTMLElement }[] = []
  private readonly graph: HTMLCanvasElement
  private readonly preampLine: HTMLElement
  private readonly onBtn: WaButton
  private readonly autoBtn: WaButton
  private lineColours: string[] = []
  private popup: HTMLElement | undefined

  constructor(
    private readonly skin: Skin,
    private readonly onChange: (s: EqState) => void,
    private readonly onClose: () => void,
    /** a note under the sliders ("only with mpv" ...): shown over the graph when the engine cannot do it */
    private readonly notes: { unsupported?: boolean } = {},
  ) {
    const win = el('wa-win wa-eq', { width: `${EQ_W}px`, height: `${EQ_H}px` })
    this.node = win
    win.appendChild(sprite(skin, 'eqmain.bmp', [0, 0, EQ_W, EQ_H]))
    win.appendChild(sprite(skin, 'eqmain.bmp', [0, 134, EQ_W, 14]))
    const close = new WaButton(skin, { normal: ref('eqmain.bmp', 0, 116, 9, 9), pressed: ref('eqmain.bmp', 0, 125, 9, 9) }, [264, 3, 9, 9], () => onClose(), 'Close')
    win.appendChild(close.node)

    this.onBtn = new WaButton(
      skin,
      { normal: ref('eqmain.bmp', 10, 119, 26, 12), pressed: ref('eqmain.bmp', 128, 119, 26, 12), on: ref('eqmain.bmp', 69, 119, 26, 12), onPressed: ref('eqmain.bmp', 187, 119, 26, 12) },
      [14, 18, 26, 12],
      () => this.set({ on: !this.state.on }),
      'On / off',
    )
    this.autoBtn = new WaButton(
      skin,
      { normal: ref('eqmain.bmp', 36, 119, 32, 12), pressed: ref('eqmain.bmp', 154, 119, 32, 12), on: ref('eqmain.bmp', 94, 119, 32, 12), onPressed: ref('eqmain.bmp', 213, 119, 32, 12) },
      [39, 18, 32, 12],
      () => this.set({ auto: !this.state.auto }),
      'Auto',
    )
    const presets = new WaButton(skin, { normal: ref('eqmain.bmp', 224, 164, 44, 12), pressed: ref('eqmain.bmp', 224, 176, 44, 12) }, [217, 18, 44, 12], () => this.togglePresets(), 'Presets')
    win.append(this.onBtn.node, this.autoBtn.node, presets.node)

    // the curve
    win.appendChild(sprite(skin, 'eqmain.bmp', [0, 294, 113, 19], 86, 17))
    this.graph = document.createElement('canvas')
    this.graph.width = 113
    this.graph.height = 19
    Object.assign(this.graph.style, { left: '86px', top: '17px', width: '113px', height: '19px' })
    win.appendChild(this.graph)
    this.preampLine = sprite(skin, 'eqmain.bmp', [0, 314, 113, 1], 86, 17)
    win.appendChild(this.preampLine)
    this.loadLineColours()

    // sliders: pre-amp, then the ten bands
    const xs = [21, ...EQ_BANDS.map((_, i) => 78 + 15 * i)]
    xs.forEach((x, index) => {
      const box = sprite(skin, 'eqmain.bmp', [13, 164, 14, SLIDER_H], x, 38, 'wa-sprite wa-eq-slider')
      const thumb = sprite(skin, 'eqmain.bmp', [0, 164, THUMB, THUMB], 1, 0)
      box.appendChild(thumb)
      win.appendChild(box)
      dragValue(
        box,
        'y',
        (v) => {
          const db = clampDb(12 - v * 24)
          if (index === 0) this.set({ preamp: db })
          else {
            const bands = [...this.state.bands]
            bands[index - 1] = db
            this.set({ bands })
          }
        },
        THUMB / 2,
      )
      box.addEventListener('dblclick', () => (index === 0 ? this.set({ preamp: 0 }) : this.set({ bands: this.state.bands.map((b, i) => (i === index - 1 ? 0 : b)) })))
      this.sliders.push({ box, thumb })
    })
    if (notes.unsupported) {
      const note = el('wa-eq-note', { left: '88px', top: '5px', width: '108px', height: '9px' })
      note.textContent = 'needs the mpv player'
      win.appendChild(note)
    }
    this.render()
  }

  get value(): EqState {
    return { ...this.state, bands: [...this.state.bands] }
  }

  /** From outside (loaded from the player): no change event. */
  setState(s: EqState): void {
    this.state = { ...s, bands: [...s.bands] }
    this.render()
  }

  private set(part: Partial<EqState>): void {
    this.state = { ...this.state, ...part }
    // moving a slider switches the equaliser on, as it does in Winamp when it was never used
    if (!('on' in part) && !this.state.on && ('preamp' in part || 'bands' in part)) this.state.on = true
    this.render()
    this.onChange(this.value)
  }

  private togglePresets(): void {
    if (this.popup) {
      this.popup.remove()
      this.popup = undefined
      return
    }
    const box = el('wa-eq-presets', { left: '120px', top: '16px', width: '150px', height: '96px' })
    const meta = this.skin.meta.pledit
    box.style.background = meta.normalBg
    box.style.color = meta.normal
    for (const preset of EQ_PRESETS) {
      const row = el('wa-eq-preset')
      row.textContent = preset.name
      row.addEventListener('click', () => {
        this.popup?.remove()
        this.popup = undefined
        this.set({ bands: [...preset.bands], on: true })
      })
      box.appendChild(row)
    }
    this.node.appendChild(box)
    this.popup = box
  }

  private render(): void {
    this.onBtn.setOn(this.state.on)
    this.autoBtn.setOn(this.state.auto)
    const values = [this.state.preamp, ...this.state.bands]
    values.forEach((db, i) => {
      const t = (12 - db) / 24
      const frame = Math.round(27 * (1 - t))
      const s = this.sliders[i]
      setSprite(this.skin, s.box, 'eqmain.bmp', [13 + (frame % 14) * 15, 164 + Math.floor(frame / 14) * 65, 14, SLIDER_H])
      s.thumb.style.top = `${Math.round(t * (SLIDER_H - THUMB))}px`
    })
    this.drawGraph()
  }

  private loadLineColours(): void {
    // the colours of the curve are a one pixel wide strip of the bitmap (top = loudest)
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const ctx = c.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(115, 294, 1, 19).data
        this.lineColours = Array.from({ length: 19 }, (_, y) => `rgb(${data[y * 4]},${data[y * 4 + 1]},${data[y * 4 + 2]})`)
        this.drawGraph()
      } catch {
        // the plain line stays
      }
    }
    img.src = this.skin.url('eqmain.bmp')
  }

  private drawGraph(): void {
    const ctx = this.graph.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 113, 19)
    const dbToY = (db: number) => Math.max(0, Math.min(18, Math.round(((12 - db) / 24) * 18)))
    // the pre-amp line
    this.preampLine.style.top = `${17 + dbToY(this.state.preamp)}px`
    // the curve through the ten bands (smooth between them)
    const points = this.state.bands.map((db, i) => ({ x: Math.round((i * 112) / 9), y: dbToY(db) }))
    let prev = points[0].y
    for (let x = 0; x < 113; x++) {
      const seg = Math.min(8, Math.floor((x / 112) * 9))
      const a = points[seg]
      const b = points[seg + 1]
      const f = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x)
      const y = Math.round(a.y + (b.y - a.y) * f)
      ctx.fillStyle = this.lineColours[y] ?? '#e0e0e0'
      // connect to the previous column so steep parts have no gaps
      const lo = Math.min(prev, y)
      const hi = Math.max(prev, y)
      ctx.fillRect(x, lo, 1, hi - lo + 1)
      prev = y
    }
  }
}
