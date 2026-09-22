function findLibraryMatch(item, library) {
    for (const entry of library) {
        const candidate = entry[item.identifierField];
        if (typeof candidate !== 'string' || !candidate)
            continue;
        if (matchesIdentifier(item, entry, candidate)) {
            return entry;
        }
    }
    return undefined;
}
function matchesIdentifier(item, entry, candidate) {
    if (item.groupKey.startsWith('compilation:')) {
        const [, artistId, albumId] = item.groupKey.split(':');
        if (candidate !== albumId)
            return false;
        return entry.artistid === artistId;
    }
    return candidate === extractIdFromGroupKey(item.groupKey);
}
function extractIdFromGroupKey(groupKey) {
    const colonIdx = groupKey.indexOf(':');
    return colonIdx >= 0 ? groupKey.slice(colonIdx + 1) : groupKey;
}
function syncEntryDiffersFromItem(entry, item) {
    if (entry.artist !== item.artist)
        return true;
    if (entry.title !== item.title)
        return true;
    if (entry.category !== item.category)
        return true;
    if (entry.cover !== item.cover)
        return true;
    if (entry.artistcover !== item.artistCover)
        return true;
    if (entry.spotify_sync_mode !== item.mode)
        return true;
    const existingPlaylists = new Set(entry.spotify_sync_playlists ?? []);
    const newPlaylists = new Set(item.playlistIds);
    if (existingPlaylists.size !== newPlaylists.size)
        return true;
    for (const id of newPlaylists) {
        if (!existingPlaylists.has(id))
            return true;
    }
    return false;
}
export function computeSyncDiff(syncItems, library) {
    const additions = [];
    const updates = [];
    const conflicts = [];
    const matchedLibrary = new Set();
    for (const item of syncItems.values()) {
        const match = findLibraryMatch(item, library);
        if (!match) {
            additions.push(item);
            continue;
        }
        matchedLibrary.add(match);
        const source = match.source ?? 'manual';
        if (source === 'manual') {
            conflicts.push({
                groupKey: item.groupKey,
                identifierField: item.identifierField,
                manualArtist: match.artist,
                manualTitle: match.title,
                inPlaylists: [...item.playlistIds],
                note: 'Manual entry takes precedence — sync left it untouched',
            });
            continue;
        }
        if (syncEntryDiffersFromItem(match, item)) {
            updates.push({ existing: match, item });
        }
    }
    const removals = [];
    for (const entry of library) {
        if ((entry.source ?? 'manual') !== 'spotify-sync')
            continue;
        if (matchedLibrary.has(entry))
            continue;
        removals.push(entry);
    }
    return { additions, updates, removals, conflicts };
}
//# sourceMappingURL=diff.js.map