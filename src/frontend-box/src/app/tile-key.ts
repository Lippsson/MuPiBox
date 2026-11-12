import type { Media } from './media'

// The tile of the start page a media belongs to (5.1, a day's limit per tile - "Kachel-Limit"), as the player counts and
// limits it (spotify-control.js "Tile time") and the parents' app sets it (app.js tileKeyOfEntry):
//   artist:<category>:<name>   the artist's tile (the name as the start page shows it)
//   lib:<path>                 a folder of the box's library - the player takes it for the tile whose folder it is in
//   nas:<path>                 a NAS folder - the same
//   single:<category>:<id>     a playlist or radio station without an artist: a tile of its own
// The category as the start page sorts it: none is "audiobook", the old "radio" is "other". null: no tile (nothing to
// count it by).

export function tileCategory(category: string | undefined): string {
  if (!category) return 'audiobook'
  return category === 'radio' ? 'other' : category
}

export function tileKeyOf(media: Media | undefined): string | null {
  if (!media) return null
  if (media.nasPath) return `nas:${media.nasPath}`
  if (media.type === 'library' && media.libraryPath) return `lib:${media.libraryPath}`
  const cat = tileCategory(media.category)
  if (!media.artist) {
    // (as isStandaloneMedia: a playlist or a station on a tile of its own)
    if (media.playlistid) return `single:${cat}:${media.playlistid}`
    if (media.type === 'radio' && media.id) return `single:${cat}:${media.id}`
    if (media.type === 'tidal' && media.tidalKind === 'playlist' && media.id) return `single:${cat}:${media.id}`
    return null
  }
  return `artist:${cat}:${media.artist}`
}

// The query part that names it on a command to the player ('' without a tile): "?tile=…" or "&tile=…"
export function tileQuery(url: string, media: Media | undefined): string {
  const key = tileKeyOf(media)
  if (!key || key.length > 400 || key.includes('\n')) return ''
  return `${url.includes('?') ? '&' : '?'}tile=${encodeURIComponent(key)}`
}
