import { SYNC_ALLOWED_CATEGORIES } from './category-types';
const TAG_CATEGORY = /\[mupibox:category=([a-zA-Z]+)\]/i;
const TAG_EPISODE_ONLY = /\[mupibox:episode-only\]/i;
export function parseDescriptionOverrides(description) {
    if (!description)
        return { episodeOnly: false };
    const result = {
        episodeOnly: TAG_EPISODE_ONLY.test(description),
    };
    const categoryMatch = description.match(TAG_CATEGORY);
    if (categoryMatch) {
        const raw = categoryMatch[1].toLowerCase();
        if (SYNC_ALLOWED_CATEGORIES.includes(raw)) {
            result.categoryOverride = raw;
        }
    }
    return result;
}
export function resolvePlaylistCategory(playlistName, prefix, mapping) {
    const suffix = extractSuffixAfterPrefix(playlistName, prefix);
    if (suffix) {
        const exact = mapping[suffix];
        if (exact && exact !== 'default' && SYNC_ALLOWED_CATEGORIES.includes(exact)) {
            return exact;
        }
        const lowerKeys = Object.keys(mapping).filter((k) => k.toLowerCase() === suffix.toLowerCase());
        if (lowerKeys.length) {
            const value = mapping[lowerKeys[0]];
            if (value && value !== 'default' && SYNC_ALLOWED_CATEGORIES.includes(value)) {
                return value;
            }
        }
    }
    const fallback = mapping.default;
    if (fallback && fallback !== 'default' && SYNC_ALLOWED_CATEGORIES.includes(fallback)) {
        return fallback;
    }
    return 'music';
}
export function extractSuffixAfterPrefix(playlistName, prefix) {
    if (playlistName === prefix)
        return '';
    if (playlistName.startsWith(`${prefix}-`))
        return playlistName.slice(prefix.length + 1);
    if (playlistName.startsWith(`${prefix} `))
        return playlistName.slice(prefix.length + 1);
    return undefined;
}
export function playlistMatchesPrefix(playlistName, prefix) {
    return extractSuffixAfterPrefix(playlistName, prefix) !== undefined;
}
export function resolveItemCategoryFromAlbumType(albumType, trackType) {
    if (trackType === 'episode')
        return 'audiobook';
    if (albumType === 'audiobook')
        return 'audiobook';
    return undefined;
}
//# sourceMappingURL=categorizer.js.map