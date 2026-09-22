import { parseDescriptionOverrides, playlistMatchesPrefix, resolveItemCategoryFromAlbumType, resolvePlaylistCategory, } from './categorizer';
const API_BASE = 'https://api.spotify.com/v1';
const HTTP_TIMEOUT_MS = 10_000;
const TRACKS_PAGE_LIMIT = 100;
const PLAYLISTS_PAGE_LIMIT = 50;
export class SpotifyApiException extends Error {
    detail;
    constructor(detail) {
        super(detail.reason);
        this.detail = detail;
    }
}
async function spotifyGet(path, accessToken) {
    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        });
    }
    catch (err) {
        const e = err;
        throw new SpotifyApiException({ kind: 'network', reason: `${path}: ${e?.message ?? String(err)}` });
    }
    if (response.status === 401) {
        throw new SpotifyApiException({ kind: 'auth', reason: `401 from ${path}` });
    }
    if (response.status === 429) {
        const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '60', 10);
        throw new SpotifyApiException({
            kind: 'rate-limit',
            reason: `429 from ${path}`,
            retryAfterSeconds: retryAfter,
        });
    }
    if (!response.ok) {
        throw new SpotifyApiException({
            kind: 'internal',
            reason: `${response.status} ${response.statusText} from ${path}`,
        });
    }
    try {
        return (await response.json());
    }
    catch (err) {
        throw new SpotifyApiException({
            kind: 'internal',
            reason: `JSON parse failure from ${path}: ${err.message}`,
        });
    }
}
export async function discoverPlaylists(accessToken, config) {
    if (config.playlist_explicit_ids.length > 0) {
        const out = [];
        for (const id of config.playlist_explicit_ids) {
            try {
                const p = await spotifyGet(`/playlists/${id}?fields=id,name,description,tracks(total)`, accessToken);
                out.push(buildDiscoveredPlaylist(p));
            }
            catch (err) {
                if (err instanceof SpotifyApiException && err.detail.kind === 'auth')
                    throw err;
                console.warn(`${new Date().toLocaleString()}: [spotify-sync] discover: explicit playlist ${id} failed: ${err.message}`);
            }
        }
        return out;
    }
    const matched = [];
    let offset = 0;
    let next = true;
    const prefix = config.playlist_prefix.trim();
    if (prefix.length < 2) {
        console.warn(`${new Date().toLocaleString()}: [spotify-sync] discover: playlist_prefix too short ("${prefix}"), skipping`);
        return [];
    }
    while (next) {
        const page = await spotifyGet(`/me/playlists?limit=${PLAYLISTS_PAGE_LIMIT}&offset=${offset}`, accessToken);
        for (const item of page.items ?? []) {
            if (playlistMatchesPrefix(item.name, prefix)) {
                matched.push(buildDiscoveredPlaylist(item));
            }
        }
        next = page.next !== null && (page.items?.length ?? 0) === PLAYLISTS_PAGE_LIMIT;
        offset += PLAYLISTS_PAGE_LIMIT;
        if (offset > 50 * PLAYLISTS_PAGE_LIMIT)
            break;
    }
    return matched;
}
function buildDiscoveredPlaylist(p) {
    const overrides = parseDescriptionOverrides(p.description);
    return {
        id: p.id,
        name: p.name,
        description: p.description,
        categoryOverride: overrides.categoryOverride,
        episodeOnly: overrides.episodeOnly,
        trackCount: p.tracks?.total ?? 0,
    };
}
async function fetchPlaylistTracks(playlistId, accessToken) {
    const out = [];
    const fields = 'items(track(id,uri,type,name,artists(id,name),album(id,name,album_type,images,artists(id,name)),show(id,name,publisher,images))),next';
    let offset = 0;
    while (true) {
        const page = await spotifyGet(`/playlists/${playlistId}/tracks?fields=${encodeURIComponent(fields)}&limit=${TRACKS_PAGE_LIMIT}&offset=${offset}`, accessToken);
        for (const i of page.items ?? []) {
            if (i.track)
                out.push(i.track);
        }
        if (!page.next || (page.items?.length ?? 0) < TRACKS_PAGE_LIMIT)
            break;
        offset += TRACKS_PAGE_LIMIT;
        if (offset > 50 * TRACKS_PAGE_LIMIT)
            break;
    }
    return out;
}
async function fetchArtistCovers(artistIds, accessToken) {
    const out = new Map();
    const unique = [...new Set(artistIds)];
    for (let i = 0; i < unique.length; i += 50) {
        const batch = unique.slice(i, i + 50);
        try {
            const resp = await spotifyGet(`/artists?ids=${batch.join(',')}`, accessToken);
            for (const a of resp.artists ?? []) {
                const url = pickImage(a?.images);
                if (a?.id && url)
                    out.set(a.id, url);
            }
        }
        catch (err) {
            console.warn(`${new Date().toLocaleString()}: [spotify-sync] artist-cover fetch failed: ${err.message}`);
        }
    }
    return out;
}
export async function resolveSyncItems(playlists, accessToken, config) {
    const items = new Map();
    const perPlaylistCounts = new Map();
    for (const playlist of playlists) {
        const tracks = await fetchPlaylistTracks(playlist.id, accessToken);
        perPlaylistCounts.set(playlist.id, tracks.length);
        for (const track of tracks) {
            const resolved = resolveSingleTrack(track, playlist, config);
            if (!resolved)
                continue;
            const existing = items.get(resolved.groupKey);
            if (existing) {
                if (!existing.playlistIds.includes(playlist.id))
                    existing.playlistIds.push(playlist.id);
            }
            else {
                items.set(resolved.groupKey, resolved);
            }
        }
    }
    for (const pin of config.explicit_albums ?? []) {
        const albumId = pin?.id;
        if (!albumId || items.has(`album:${albumId}`))
            continue;
        try {
            const album = await spotifyGet(`/albums/${encodeURIComponent(albumId)}`, accessToken);
            const item = buildExplicitAlbumItem(album, pin.category);
            if (item)
                items.set(item.groupKey, item);
        }
        catch (err) {
            console.warn(`${new Date().toLocaleString()}: [spotify-sync] explicit album ${albumId} fetch failed: ${err.message}`);
        }
    }
    for (const sub of config.artists ?? []) {
        if (!sub?.id)
            continue;
        try {
            const albums = await fetchArtistAlbums(sub.id, accessToken, sub.album_types ?? 'album');
            albums.sort((a, b) => (a.release_date ?? '').localeCompare(b.release_date ?? ''));
            const from = Math.max(1, sub.range_from ?? 1);
            const to = sub.range_to && sub.range_to > 0 ? sub.range_to : albums.length;
            const excluded = new Set(sub.exclude_album_ids ?? []);
            for (const album of albums.slice(from - 1, to)) {
                if (!album?.id || items.has(`album:${album.id}`) || excluded.has(album.id))
                    continue;
                const item = buildExplicitAlbumItem(album, sub.category);
                if (item)
                    items.set(item.groupKey, item);
            }
        }
        catch (err) {
            console.warn(`${new Date().toLocaleString()}: [spotify-sync] artist subscription ${sub.id} failed: ${err.message}`);
        }
    }
    const artistIds = [...items.values()]
        .map((it) => it.artistId)
        .filter((id) => typeof id === 'string' && id.length > 0);
    if (artistIds.length > 0) {
        const covers = await fetchArtistCovers(artistIds, accessToken);
        for (const it of items.values()) {
            if (it.artistId && !it.artistCover) {
                const c = covers.get(it.artistId);
                if (c)
                    it.artistCover = c;
            }
        }
    }
    return { items, perPlaylistCounts };
}
function resolveSingleTrack(track, playlist, config) {
    const trackId = track.id ?? undefined;
    const isEpisode = track.type === 'episode';
    const albumType = track.album?.album_type;
    const isAudiobook = albumType === 'audiobook';
    const isCompilation = albumType === 'compilation' && /^various artists$/i.test(track.album?.artists?.[0]?.name ?? '');
    const categoryFromPlaylist = playlist.categoryOverride
        ? playlist.categoryOverride
        : resolvePlaylistCategory(playlist.name, config.playlist_prefix, config.category_mapping);
    const categoryFromAlbum = resolveItemCategoryFromAlbumType(albumType, track.type);
    const category = playlist.categoryOverride
        ? playlist.categoryOverride
        : (categoryFromAlbum ?? categoryFromPlaylist);
    if (playlist.episodeOnly) {
        if (!trackId)
            return undefined;
        return {
            groupKey: `episode:${trackId}`,
            mode: 'episode-only',
            identifierField: 'id',
            type: 'spotify',
            category: 'audiobook',
            title: track.name ?? track.show?.name ?? '',
            artist: track.show?.name ?? track.artists?.[0]?.name ?? '',
            artistId: undefined,
            cover: pickImage(track.show?.images ?? track.album?.images),
            artistCover: undefined,
            playlistIds: [playlist.id],
        };
    }
    if (isEpisode && track.show?.id) {
        return {
            groupKey: `show:${track.show.id}`,
            mode: 'album',
            identifierField: 'showid',
            type: 'spotify',
            category: 'audiobook',
            title: track.show.name ?? '',
            artist: track.show.publisher ?? '',
            artistId: undefined,
            cover: pickImage(track.show.images),
            artistCover: undefined,
            playlistIds: [playlist.id],
        };
    }
    if (isAudiobook && track.album?.id) {
        return {
            groupKey: `audiobook:${track.album.id}`,
            mode: 'album',
            identifierField: 'audiobookid',
            type: 'spotify',
            category: 'audiobook',
            title: track.album.name ?? '',
            artist: track.album.artists?.[0]?.name ?? '',
            artistId: track.album.artists?.[0]?.id,
            cover: pickImage(track.album.images),
            artistCover: undefined,
            playlistIds: [playlist.id],
        };
    }
    if (isCompilation && track.album?.id) {
        const trackArtist = track.artists?.[0];
        if (!trackArtist?.id)
            return undefined;
        return {
            groupKey: `compilation:${trackArtist.id}:${track.album.id}`,
            mode: 'album',
            identifierField: 'id',
            type: 'spotify',
            category,
            title: track.album.name ?? '',
            artist: trackArtist.name ?? '',
            artistId: trackArtist.id,
            cover: pickImage(track.album.images),
            artistCover: undefined,
            playlistIds: [playlist.id],
        };
    }
    if (track.album?.id) {
        return {
            groupKey: `album:${track.album.id}`,
            mode: 'album',
            identifierField: 'id',
            type: 'spotify',
            category,
            title: track.album.name ?? '',
            artist: track.album.artists?.[0]?.name ?? track.artists?.[0]?.name ?? '',
            artistId: track.album.artists?.[0]?.id ?? track.artists?.[0]?.id,
            cover: pickImage(track.album.images),
            artistCover: undefined,
            playlistIds: [playlist.id],
        };
    }
    return undefined;
}
export async function fetchArtistAlbums(artistId, accessToken, albumTypes = 'album') {
    const out = [];
    const seen = new Set();
    let offset = 0;
    const LIMIT = 50;
    while (out.length < 300) {
        const page = await spotifyGet(`/artists/${encodeURIComponent(artistId)}/albums?include_groups=${encodeURIComponent(albumTypes)}&market=DE&limit=${LIMIT}&offset=${offset}`, accessToken);
        const its = page.items ?? [];
        for (const a of its) {
            if (a?.id && !seen.has(a.id)) {
                seen.add(a.id);
                out.push(a);
            }
        }
        if (its.length < LIMIT)
            break;
        offset += LIMIT;
    }
    return out;
}
function buildExplicitAlbumItem(album, pinCategory) {
    if (!album?.id)
        return undefined;
    return {
        groupKey: `album:${album.id}`,
        mode: 'album',
        identifierField: 'id',
        type: 'spotify',
        category: pinCategory ?? 'music',
        title: album.name ?? '',
        artist: album.artists?.[0]?.name ?? '',
        artistId: album.artists?.[0]?.id,
        cover: pickImage(album.images),
        artistCover: undefined,
        playlistIds: [],
    };
}
function pickImage(images) {
    if (!images || images.length === 0)
        return undefined;
    return images[1]?.url ?? images[0]?.url;
}
//# sourceMappingURL=playlists.js.map