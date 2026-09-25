'use strict'

// A radio link can point at a playlist (m3u / m3u8 / pls) instead of at the stream itself. mplayer opens such a
// link as one file and does not play what is listed in it, so the playlist is opened here and the FIRST stream of
// the list is played.
//
//   - a plain list (one address per line, optionally with #EXTINF lines) or a .pls file: the first address is used
//   - a playlist inside a playlist is followed (up to MAX_DEPTH levels)
//   - relative addresses are completed with the address of the playlist
//   - a .m3u8 with #EXT-X tags is HLS, i.e. the stream itself: mplayer plays it as it is, the address stays
//   - if the playlist can't be read (no answer, error, empty, no usable address) the original address is used, as before

const PLAYLIST_EXTENSION = /\.(m3u8?|pls)$/i
const STREAM_ADDRESS = /^(https?|mms|mmsh|rtsp|rtmp):\/\//i
const BYTE_ORDER_MARK = new RegExp(`^${String.fromCharCode(0xfeff)}`)
const NUL = String.fromCharCode(0)
const MAX_DEPTH = 3
const MAX_BYTES = 256 * 1024
const MAX_ADDRESS_LENGTH = 2048
const TIMEOUT_MS = 8000

function isPlaylistUrl(url) {
  try {
    return PLAYLIST_EXTENSION.test(new URL(url).pathname)
  } catch {
    return false
  }
}

// The first usable stream address of a playlist text: { hls: true } for an HLS list, { url } for a list, or
// undefined when there is none.
function firstEntry(text, baseUrl) {
  const clean = text.replace(BYTE_ORDER_MARK, '')
  // binary data is not a playlist (a link that only looks like one, e.g. an audio stream)
  if (clean.includes(NUL)) {
    return undefined
  }
  if (/^#EXT-X-/m.test(clean)) {
    return { hls: true }
  }
  const lines = clean.split(/\r?\n/).map((line) => line.trim())
  const isPls = /^\[playlist\]/i.test(lines.find((line) => line !== '') ?? '')
  for (const line of lines) {
    let entry
    if (isPls) {
      entry = /^File\d+\s*=\s*(.+)$/i.exec(line)?.[1]?.trim()
    } else if (line !== '' && !line.startsWith('#')) {
      entry = line
    }
    if (!entry || entry.length > MAX_ADDRESS_LENGTH) continue
    let absolute
    try {
      absolute = new URL(entry, baseUrl).href
    } catch {
      continue
    }
    if (STREAM_ADDRESS.test(absolute)) {
      return { url: absolute }
    }
  }
  return undefined
}

// At most MAX_BYTES of the answer: a link that only looks like a playlist but is an endless stream must not be read
// to the end.
async function readLimited(response) {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(Buffer.from(value))
    size += value.length
  }
  await reader.cancel().catch(() => {})
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks))
}

// The address to play for a radio link: the first stream of the playlist when the link is one, else the link itself.
async function resolveStreamUrl(url, fetchImpl = fetch, depth = 0) {
  if (!isPlaylistUrl(url) || depth >= MAX_DEPTH) {
    return url
  }
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' })
    if (!response.ok) {
      return url
    }
    const entry = firstEntry(await readLimited(response), response.url || url)
    if (!entry || entry.hls) {
      return url
    }
    return await resolveStreamUrl(entry.url, fetchImpl, depth + 1)
  } catch {
    return url
  }
}

module.exports = { isPlaylistUrl, firstEntry, resolveStreamUrl }
