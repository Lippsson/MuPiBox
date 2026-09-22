import { DEFAULT_SPOTIFY_SYNC_CONFIG, POLLING_INTERVAL_SECONDS_MAX, POLLING_INTERVAL_SECONDS_MIN, } from './types';
export function loadSpotifySyncConfig(mupibox) {
    const raw = mupibox?.spotify_sync ?? {};
    const merged = {
        ...DEFAULT_SPOTIFY_SYNC_CONFIG,
        ...raw,
        category_mapping: {
            ...DEFAULT_SPOTIFY_SYNC_CONFIG.category_mapping,
            ...(raw.category_mapping ?? {}),
        },
    };
    if (merged.polling_interval_seconds < POLLING_INTERVAL_SECONDS_MIN ||
        merged.polling_interval_seconds > POLLING_INTERVAL_SECONDS_MAX) {
        console.warn(`${new Date().toLocaleString()}: [spotify-sync] polling_interval_seconds=${merged.polling_interval_seconds} out of [${POLLING_INTERVAL_SECONDS_MIN},${POLLING_INTERVAL_SECONDS_MAX}], clamping`);
        merged.polling_interval_seconds = Math.max(POLLING_INTERVAL_SECONDS_MIN, Math.min(POLLING_INTERVAL_SECONDS_MAX, merged.polling_interval_seconds));
    }
    return merged;
}
export function loadSpotifyTokenStore(mupibox) {
    const raw = mupibox?.spotify;
    if (!raw || typeof raw !== 'object')
        return undefined;
    const r = raw;
    const clientId = typeof r.clientId === 'string' ? r.clientId : '';
    const accessToken = typeof r.accessToken === 'string' ? r.accessToken : '';
    const refreshToken = typeof r.refreshToken === 'string' ? r.refreshToken : '';
    if (!clientId || !refreshToken)
        return undefined;
    const out = {
        clientId,
        accessToken,
        refreshToken,
    };
    if (typeof r.clientSecret === 'string' && r.clientSecret)
        out.clientSecret = r.clientSecret;
    if (Array.isArray(r.tokenScopes))
        out.tokenScopes = r.tokenScopes.filter((s) => typeof s === 'string');
    if (typeof r.tokenExpiresAt === 'string')
        out.tokenExpiresAt = r.tokenExpiresAt;
    if (typeof r.tokenUpdatedAt === 'string')
        out.tokenUpdatedAt = r.tokenUpdatedAt;
    return out;
}
export function hasRequiredSyncScopes(store) {
    if (!store?.tokenScopes)
        return false;
    return (store.tokenScopes.includes('playlist-read-private') ||
        store.tokenScopes.includes('playlist-read-collaborative'));
}
//# sourceMappingURL=config-loader.js.map