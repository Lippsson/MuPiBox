import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Covers from the internet for albums (NAS or local folders) that have no picture of their own.
 *
 * The iTunes Search API and the Deezer API (both free, no key) are asked with the folder name, alone and together
 * with the series (the folder above). A result is only taken when it clearly is this album - better no cover than
 * a wrong one:
 *   - every word of the album name is in the result's title,
 *   - and something confirms it: the same episode number ("084" / "Folge 84"), the series name in the result, or
 *     (iTunes) an audiobook/children genre,
 *   - a different episode number rules a result out.
 * Lookups run in the background, one at a time and spaced out, when the box shows such an album; each album is
 * looked up once (a miss is remembered too). The pictures are kept on the box. It sends folder names to Apple and
 * Deezer, so it is off unless switched on (mupibox.onlineCovers).
 */

export type OnlineCoverStatus = 'found' | 'none' | 'rejected'
export interface OnlineCoverEntry {
  status: OnlineCoverStatus
  file?: string // <sha1>.jpg in the cover folder
  source?: 'itunes' | 'deezer'
  matchedTitle?: string
  matchedArtist?: string
  series: string
  album: string
  at: number
}

interface Candidate {
  source: 'itunes' | 'deezer'
  title: string
  artist: string
  imageUrl: string
  genre?: string
}

const SPACING_MS = 3000 // between two requests to the same service
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
// Deezer only gives genre ids: 457 Hörbücher, 462 Hörbücher auf Deutsch, 95 Kids
const DEEZER_GENRES: Record<number, string> = { 457: 'Hörbücher', 462: 'Hörbücher', 95: 'Kinder' }
const KIDS_GENRES = /h(ö|oe)r(buch|bücher|spiel)|kinder|children|spoken|gesprochen|audiobook/i

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// folder names that say nothing about the album ("Hörspiele/Pumuckl" - but also "Hörspiele/Pollyanna")
const GENERIC_FOLDERS = new Set([
  'horspiele',
  'horspiel',
  'horbucher',
  'horbuch',
  'musik',
  'music',
  'audio',
  'kinder',
  'kindermusik',
  'lieder',
  'songs',
  'alben',
  'albums',
  'mp3',
  'nas',
  'media',
  'medien',
  'freigabe',
  'audiobook',
  'audiobooks',
  'other',
])

/** The series (folder above) when it means something, else '' */
export function usefulSeries(series: string): string {
  const n = normalize(series)
  return n.length < 3 || GENERIC_FOLDERS.has(n.replace(/ /g, '')) ? '' : series
}

/** "029  Originalmusik" -> { number: 29, words: 'Originalmusik' }; "03_Pollyanna" -> 3 / 'Pollyanna' */
export function splitEpisode(folderName: string): { number?: number; name: string } {
  const cleaned = folderName.replace(/_/g, ' ').trim()
  const m = /^(\d{1,4})\s*(?:[-.:)]\s*)?(.*)$/.exec(cleaned)
  if (m && m[2]) return { number: Number.parseInt(m[1], 10), name: m[2].trim() }
  return { name: cleaned }
}

function numbersIn(text: string): number[] {
  return (normalize(text).match(/\b\d{1,4}\b/g) ?? []).map((n) => Number.parseInt(n, 10))
}

/** How well a result fits the album; below 2 it is not taken (see the top of this file). */
export function scoreCandidate(series: string, album: string, c: Candidate): number {
  const { number, name } = splitEpisode(album)
  const title = normalize(c.title)
  const both = ` ${title} ${normalize(c.artist)} `
  const words = normalize(name)
    .split(' ')
    .filter((w) => w.length >= 3 || /^\d+$/.test(w))
  if (words.length === 0) return 0
  // whole words; long ones may also sit inside a longer word ("Abenteuerwälder" in "Abenteuerwäldern")
  const padded = ` ${title} `
  if (!words.every((w) => padded.includes(` ${w} `) || (w.length >= 8 && title.includes(w)))) return 0
  let score = 1
  if (number !== undefined) {
    const found = numbersIn(c.title)
    if (found.includes(number)) score += 2
    else if (found.length > 0 && /\b(folge|teil|band|episode|fall|nr)\b/.test(title)) return 0 // another episode
  }
  const seriesCompact = normalize(series).replace(/ /g, '')
  if (seriesCompact.length >= 4 && both.replace(/ /g, '').includes(seriesCompact)) score += 2
  // Without episode number or series the name has to be the whole title, apart from additions in brackets or before/
  // after a colon or dash ("Pollyanna (Das immer fröhliche Mädchen)", "Folge 1: In 80 Tagen um die Welt") - else
  // "Christliche" takes "Christliche Kinderlieder" and "Asterix & Obelix" "34: Asterix & Obelix feiern Geburtstag".
  if (score === 1) {
    const withoutBrackets = (text: string) => text.replace(/[([{].*?[)\]}]/g, ' ')
    const names = [normalize(name), normalize(withoutBrackets(name))]
    const parts = [title, ...withoutBrackets(c.title).split(/:| - /).map((part) => normalize(part))]
    if (!parts.some((part) => names.includes(part))) return 0
  }
  if (c.genre && KIDS_GENRES.test(c.genre)) score += 1
  if (/\bsingle\b/.test(title)) score -= 1
  return score
}

export class OnlineCovers {
  private index: Record<string, OnlineCoverEntry> = {}
  private readonly indexPath: string
  private queue: Array<{ key: string; series: string; album: string }> = []
  private queued = new Set<string>()
  private running = false
  private lastRequest = { itunes: 0, deezer: 0 }
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly dir: string,
    private readonly isEnabled: () => boolean,
  ) {
    this.indexPath = path.join(dir, 'index.json')
    try {
      this.index = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'))
    } catch {
      this.index = {}
    }
  }

  static key(type: 'nas' | 'local', folderPath: string): string {
    return `${type}:${folderPath}`
  }

  /**
   * The online cover's URL for an album without a picture of its own, or undefined. Unknown albums are queued for
   * a lookup (when switched on), so the cover shows the next time.
   */
  coverFor(type: 'nas' | 'local', folderPath: string, series: string, album: string): string | undefined {
    const key = OnlineCovers.key(type, folderPath)
    const entry = this.index[key]
    if (entry?.status === 'found' && entry.file) return `/api/online-cover/${entry.file}`
    if (!entry && this.isEnabled() && !this.queued.has(key)) {
      this.queued.add(key)
      this.queue.push({ key, series, album })
      void this.work()
    }
    return undefined
  }

  list(): Array<OnlineCoverEntry & { key: string; url?: string }> {
    return Object.entries(this.index)
      .map(([key, e]) => ({ key, ...e, url: e.file ? `/api/online-cover/${e.file}` : undefined }))
      .sort((a, b) => b.at - a.at)
  }

  /** A wrong cover: the picture goes, and this album is never looked up again. */
  reject(key: string): boolean {
    const entry = this.index[key]
    if (!entry) return false
    if (entry.file) fs.rmSync(path.join(this.dir, entry.file), { force: true })
    this.index[key] = { ...entry, status: 'rejected', file: undefined, at: Date.now() }
    this.scheduleSave()
    return true
  }

  /** Forget the misses (and, with `alsoRejected`, the rejected ones), so they are looked up again. */
  retry(alsoRejected = false): number {
    let n = 0
    for (const [key, e] of Object.entries(this.index)) {
      if (e.status === 'none' || (alsoRejected && e.status === 'rejected')) {
        delete this.index[key]
        n++
      }
    }
    this.scheduleSave()
    return n
  }

  filePath(file: string): string | undefined {
    return /^[a-f0-9]{40}\.jpg$/.test(file) ? path.join(this.dir, file) : undefined
  }

  private async work(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      while (this.queue.length > 0 && this.isEnabled()) {
        const job = this.queue.shift()
        if (!job) break
        try {
          this.index[job.key] = await this.lookUp(job.series, job.album)
        } catch (error) {
          // network trouble: not remembered, it is tried again the next time the album is shown
          console.warn(`${new Date().toLocaleString()}: [OnlineCovers] ${job.album}: ${(error as Error).message}`)
        } finally {
          this.queued.delete(job.key)
        }
        this.scheduleSave()
      }
    } finally {
      this.running = false
    }
  }

  private async lookUp(folderAbove: string, album: string): Promise<OnlineCoverEntry> {
    const series = usefulSeries(folderAbove)
    const { name } = splitEpisode(album)
    const queries = [...new Set([`${series} ${name}`.trim(), name])].filter((q) => q.length >= 3)
    let best: { c: Candidate; score: number } | undefined
    for (const q of queries) {
      for (const c of [...(await this.itunes(q)), ...(await this.deezer(q))]) {
        const score = scoreCandidate(series, album, c)
        if (score >= 2 && (!best || score > best.score)) best = { c, score }
      }
      if (best && best.score >= 3) break
    }
    const base = { series: folderAbove, album, at: Date.now() }
    if (!best) return { ...base, status: 'none' }
    const file = `${crypto.createHash('sha1').update(best.c.imageUrl).digest('hex')}.jpg`
    await this.download(best.c.imageUrl, path.join(this.dir, file))
    console.log(`${new Date().toLocaleString()}: [OnlineCovers] "${album}" -> ${best.c.source}: ${best.c.artist} - ${best.c.title}`)
    return {
      ...base,
      status: 'found',
      file,
      source: best.c.source,
      matchedTitle: best.c.title,
      matchedArtist: best.c.artist,
    }
  }

  private async spaced(service: 'itunes' | 'deezer'): Promise<void> {
    const wait = this.lastRequest[service] + SPACING_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    this.lastRequest[service] = Date.now()
  }

  private async itunes(term: string): Promise<Candidate[]> {
    await this.spaced('itunes')
    const url = `https://itunes.apple.com/search?${new URLSearchParams({ term, media: 'music', entity: 'album', country: 'DE', limit: '10' })}`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(`iTunes ${r.status}`)
    const body = (await r.json()) as {
      results?: Array<{ collectionName?: string; artistName?: string; artworkUrl100?: string; primaryGenreName?: string }>
    }
    return (body.results ?? [])
      .filter((x) => x.collectionName && x.artworkUrl100)
      .map((x) => ({
        source: 'itunes' as const,
        title: String(x.collectionName),
        artist: String(x.artistName ?? ''),
        imageUrl: String(x.artworkUrl100).replace(/\/\d+x\d+bb\./, '/600x600bb.'),
        genre: x.primaryGenreName,
      }))
  }

  private async deezer(q: string): Promise<Candidate[]> {
    await this.spaced('deezer')
    const r = await fetch(`https://api.deezer.com/search/album?${new URLSearchParams({ q, limit: '10' })}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) throw new Error(`Deezer ${r.status}`)
    const body = (await r.json()) as {
      data?: Array<{ title?: string; artist?: { name?: string }; cover_big?: string; genre_id?: number }>
    }
    return (body.data ?? [])
      .filter((x) => x.title && x.cover_big)
      .map((x) => ({
        source: 'deezer' as const,
        title: String(x.title),
        artist: String(x.artist?.name ?? ''),
        imageUrl: String(x.cover_big),
        genre: x.genre_id !== undefined ? DEEZER_GENRES[x.genre_id] : undefined,
      }))
  }

  private async download(url: string, target: string): Promise<void> {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const type = r.headers.get('content-type') ?? ''
    if (!r.ok || !type.startsWith('image/')) throw new Error(`cover download ${r.status} ${type}`)
    const data = Buffer.from(await r.arrayBuffer())
    if (data.length === 0 || data.length > MAX_IMAGE_BYTES) throw new Error(`cover size ${data.length}`)
    fs.mkdirSync(this.dir, { recursive: true })
    const tmp = `${target}.tmp`
    fs.writeFileSync(tmp, data)
    fs.renameSync(tmp, target)
  }

  private scheduleSave(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      try {
        fs.mkdirSync(this.dir, { recursive: true })
        const tmp = `${this.indexPath}.tmp`
        fs.writeFileSync(tmp, JSON.stringify(this.index))
        fs.renameSync(tmp, this.indexPath)
      } catch (error) {
        console.warn(`${new Date().toLocaleString()}: [OnlineCovers] saving the index failed: ${(error as Error).message}`)
      }
    }, 2000)
  }
}
