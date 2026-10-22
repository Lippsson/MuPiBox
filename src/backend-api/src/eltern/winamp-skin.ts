// The Winamp theme's skins: a classic Winamp 2.x skin is a .wsz (a zip) of bitmaps. The parents' app uploads one; here
// it is unpacked into one folder of lower-case bitmaps next to a skin.json (the sizes of the bitmaps, the analyser's
// colours from viscolor.txt, the playlist's colours from pledit.txt) that the display reads - see
// frontend-box/src/app/winamp. No zip library: a skin is a small, plain zip, read here with node:zlib.

import { inflateRawSync } from 'node:zlib'
import { promises as fsp } from 'node:fs'
import path from 'node:path'

export const WINAMP_SKIN_DIR = '/home/dietpi/.mupibox/Sonos-Kids-Controller-master/www/theme-data/winamp/skin'

const MAX_ENTRIES = 600
const MAX_FILE = 4 * 1024 * 1024
const MAX_TOTAL = 20 * 1024 * 1024
// what the display uses (everything else in a skin - cursors, region.txt, readmes - is left out)
const KEEP = /^(main|cbuttons|titlebar|shufrep|numbers|nums_ex|playpaus|posbar|volume|balance|monoster|text|eqmain|eq_ex|pledit|gen|genex|mb|video|avs)\.bmp$/

export interface SkinMeta {
  name: string
  version: number
  files: Record<string, [number, number]>
  viscolors: string[]
  pledit: { normal: string; current: string; normalBg: string; selectedBg: string; font: string }
}

export interface ZipEntry {
  name: string
  data: Buffer
}

/** The files of a zip (stored or deflated); throws on anything that is not a plain zip. */
export function readZip(buf: Buffer): ZipEntry[] {
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip')
  const count = buf.readUInt16LE(eocd + 10)
  let pos = buf.readUInt32LE(eocd + 16)
  if (count > MAX_ENTRIES) throw new Error('too many files')
  const entries: ZipEntry[] = []
  let total = 0
  for (let n = 0; n < count; n++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('broken zip')
    const method = buf.readUInt16LE(pos + 10)
    const compressed = buf.readUInt32LE(pos + 20)
    const size = buf.readUInt32LE(pos + 24)
    const nameLen = buf.readUInt16LE(pos + 28)
    const extraLen = buf.readUInt16LE(pos + 30)
    const commentLen = buf.readUInt16LE(pos + 32)
    const local = buf.readUInt32LE(pos + 42)
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen)
    pos += 46 + nameLen + extraLen + commentLen
    if (name.endsWith('/')) continue
    if (size > MAX_FILE) continue
    total += size
    if (total > MAX_TOTAL) throw new Error('too large')
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw new Error('broken zip')
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(start, start + compressed)
    if (method === 0) entries.push({ name, data: Buffer.from(raw) })
    else if (method === 8) entries.push({ name, data: inflateRawSync(raw, { maxOutputLength: MAX_FILE }) })
  }
  return entries
}

/** Width and height of a Windows bitmap, or undefined when it is not one (or absurdly large). */
export function bmpSize(data: Buffer): [number, number] | undefined {
  if (data.length < 26 || data.toString('latin1', 0, 2) !== 'BM') return undefined
  const w = data.readInt32LE(18)
  const h = Math.abs(data.readInt32LE(22))
  return w > 0 && h > 0 && w <= 2048 && h <= 2048 ? [w, h] : undefined
}

export function parseViscolors(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/)
    if (!m) continue
    out.push(`#${[m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('')}`)
    if (out.length === 24) break
  }
  return out
}

export function parsePledit(text: string): SkinMeta['pledit'] {
  const get = (key: string, fallback: string) => {
    const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(#?[0-9a-fA-F]{6})\\s*$`, 'm'))
    return m ? `#${m[1].replace('#', '').toUpperCase()}` : fallback
  }
  const font = text.match(/^\s*Font\s*=\s*([^\r\n]+)/m)?.[1]?.trim().replace(/[^\w \-]/g, '') || 'Arial'
  return {
    normal: get('Normal', '#00FF00'),
    current: get('Current', '#FFFFFF'),
    normalBg: get('NormalBG', '#000000'),
    selectedBg: get('SelectedBG', '#0000C6'),
    font,
  }
}

/** The skin's files from a .wsz, ready to be written: lower-case names, only bitmaps the display uses, plus skin.json. */
export function skinFiles(wsz: Buffer, name: string, version: number): { files: Map<string, Buffer>; meta: SkinMeta } {
  const entries = readZip(wsz)
  const files = new Map<string, Buffer>()
  const sizes: Record<string, [number, number]> = {}
  let viscolors: string[] = []
  let pledit = parsePledit('')
  for (const entry of entries) {
    // (some skins keep everything in a folder: the file name is what counts)
    const base = path.posix.basename(entry.name.replace(/\\/g, '/')).toLowerCase()
    if (KEEP.test(base)) {
      const size = bmpSize(entry.data)
      if (!size) continue
      files.set(base, entry.data)
      sizes[base] = size
    } else if (base === 'viscolor.txt') {
      viscolors = parseViscolors(entry.data.toString('latin1'))
    } else if (base === 'pledit.txt') {
      pledit = parsePledit(entry.data.toString('latin1'))
    }
  }
  if (!sizes['main.bmp'] || !sizes['cbuttons.bmp']) throw new Error('not a Winamp skin')
  const meta: SkinMeta = { name, version, files: sizes, viscolors, pledit }
  return { files, meta }
}

/** Writes a skin over the installed one: first into a folder next to it, then swapped, so the display never sees half of it. */
export async function installSkin(wsz: Buffer, name: string, dir = WINAMP_SKIN_DIR): Promise<SkinMeta> {
  const { files, meta } = skinFiles(wsz, name.replace(/\.wsz$/i, '').slice(0, 60) || 'Skin', Date.now())
  const tmp = `${dir}.new`
  await fsp.rm(tmp, { recursive: true, force: true })
  await fsp.mkdir(tmp, { recursive: true })
  for (const [file, data] of files) await fsp.writeFile(path.join(tmp, file), data)
  await fsp.writeFile(path.join(tmp, 'skin.json'), JSON.stringify(meta))
  await fsp.rm(dir, { recursive: true, force: true })
  await fsp.rename(tmp, dir)
  return meta
}

export async function readSkinMeta(dir = WINAMP_SKIN_DIR): Promise<SkinMeta | undefined> {
  try {
    return JSON.parse(await fsp.readFile(path.join(dir, 'skin.json'), 'utf8')) as SkinMeta
  } catch {
    return undefined
  }
}

export async function removeSkin(dir = WINAMP_SKIN_DIR): Promise<void> {
  await fsp.rm(dir, { recursive: true, force: true })
}
