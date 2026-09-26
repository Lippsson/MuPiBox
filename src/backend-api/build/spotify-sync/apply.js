import * as fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
export async function applyDiff(diff, library, dataFilePath, now = new Date()) {
    const isoNow = now.toISOString();
    const removalSet = new Set(diff.removals);
    let after = library.filter((entry) => !removalSet.has(entry));
    const appliedRemovals = library.length - after.length;
    let appliedUpdates = 0;
    for (const { existing, item } of diff.updates) {
        const target = after.find((e) => e === existing);
        if (!target)
            continue;
        applyUpdate(target, item, isoNow);
        appliedUpdates++;
    }
    for (const item of diff.additions) {
        after.push(buildLibraryEntry(item, isoNow));
    }
    const appliedAdditions = diff.additions.length;
    after = renumber(after);
    const tmpPath = `${dataFilePath}.tmp.${process.pid}`;
    await fsPromises.writeFile(tmpPath, `${JSON.stringify(after, null, 2)}\n`, 'utf8');
    fs.renameSync(tmpPath, dataFilePath);
    return { libraryAfter: after, appliedAdditions, appliedUpdates, appliedRemovals };
}
function applyUpdate(target, item, isoNow) {
    target.artist = item.artist;
    target.title = item.title;
    target.category = item.category;
    target.cover = item.cover;
    target.artistcover = item.artistCover;
    target.spotify_sync_last_seen = isoNow;
    target.spotify_sync_playlists = [...item.playlistIds];
    target.spotify_sync_mode = item.mode;
}
function buildLibraryEntry(item, isoNow) {
    const idValue = extractIdValue(item);
    const entry = {
        type: item.type,
        category: item.category,
        source: 'spotify-sync',
        artist: item.artist,
        title: item.title,
        cover: item.cover,
        artistcover: item.artistCover,
        spotify_sync_added: isoNow,
        spotify_sync_last_seen: isoNow,
        spotify_sync_playlists: [...item.playlistIds],
        spotify_sync_mode: item.mode,
    };
    entry[item.identifierField] = idValue;
    if (item.groupKey.startsWith('compilation:') && item.artistId) {
        entry.artistid = item.artistId;
    }
    return entry;
}
function extractIdValue(item) {
    if (item.groupKey.startsWith('compilation:')) {
        const parts = item.groupKey.split(':');
        return parts[parts.length - 1] ?? '';
    }
    const colonIdx = item.groupKey.indexOf(':');
    return colonIdx >= 0 ? item.groupKey.slice(colonIdx + 1) : item.groupKey;
}
function renumber(library) {
    for (let i = 0; i < library.length; i++) {
        library[i].index = i;
    }
    return library;
}
//# sourceMappingURL=apply.js.map