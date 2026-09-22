import { randomBytes } from 'node:crypto';
export const REQUESTED_SCOPES = [
    'streaming',
    'user-read-currently-playing',
    'user-modify-playback-state',
    'user-read-playback-state',
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
];
const STATE_TTL_MS = 10 * 60 * 1000;
const oauthStates = new Map();
function purgeExpiredStates(now = Date.now()) {
    for (const [state, entry] of oauthStates) {
        if (now - entry.issued > STATE_TTL_MS)
            oauthStates.delete(state);
    }
}
export function buildAuthorizeUrl(deps) {
    const cfg = deps.getMupiboxConfig();
    const spotify = cfg?.spotify ?? {};
    const clientId = typeof spotify.clientId === 'string' ? spotify.clientId : '';
    if (!clientId)
        return { error: 'no_client_id' };
    purgeExpiredStates();
    const state = randomBytes(24).toString('hex');
    oauthStates.set(state, {
        sessionId: deps.sessionId,
        issued: Date.now(),
        redirectAfter: deps.redirectAfter ?? '/eltern',
    });
    const redirectUri = buildRedirectUri(deps.protocol, deps.host);
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: REQUESTED_SCOPES.join(' '),
        state,
        show_dialog: 'true',
    });
    return {
        url: `https://accounts.spotify.com/authorize?${params.toString()}`,
        state,
        redirectUri,
    };
}
export function buildRedirectUri(protocol, host) {
    return `${protocol}://${host}/api/eltern/spotify-oauth/callback`;
}
export function consumeOauthState(state) {
    purgeExpiredStates();
    const entry = oauthStates.get(state);
    if (!entry)
        return null;
    oauthStates.delete(state);
    return { sessionId: entry.sessionId, redirectAfter: entry.redirectAfter };
}
export async function exchangeCodeForTokens(deps) {
    const cfg = deps.getMupiboxConfig();
    const spotify = cfg?.spotify ?? {};
    const clientId = typeof spotify.clientId === 'string' ? spotify.clientId : '';
    const clientSecret = typeof spotify.clientSecret === 'string' ? spotify.clientSecret : '';
    if (!clientId)
        return { ok: false, reason: 'clientId missing' };
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: deps.code,
        redirect_uri: deps.redirectUri,
    });
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (clientSecret) {
        const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        headers.Authorization = `Basic ${basic}`;
    }
    else {
        body.append('client_id', clientId);
    }
    let response;
    try {
        response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(10_000),
        });
    }
    catch (err) {
        return { ok: false, reason: `network error: ${err.message}` };
    }
    let parsed;
    try {
        parsed = (await response.json());
    }
    catch (err) {
        return { ok: false, reason: `response not JSON: ${err.message}` };
    }
    if (!response.ok) {
        const errorCode = typeof parsed.error === 'string' ? parsed.error : 'unknown_error';
        const desc = typeof parsed.error_description === 'string' ? parsed.error_description : '';
        return { ok: false, reason: `${response.status} ${errorCode}: ${desc}` };
    }
    const accessToken = typeof parsed.access_token === 'string' ? parsed.access_token : '';
    const refreshToken = typeof parsed.refresh_token === 'string' ? parsed.refresh_token : '';
    if (!accessToken || !refreshToken) {
        return { ok: false, reason: 'response missing access_token or refresh_token' };
    }
    const expiresIn = typeof parsed.expires_in === 'number' ? parsed.expires_in : 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const scopes = typeof parsed.scope === 'string' ? parsed.scope.split(/\s+/).filter(Boolean) : [];
    const nowIso = new Date().toISOString();
    await deps.updateMupiboxConfig((cfg) => {
        const spotify = (cfg.spotify ?? {});
        spotify.accessToken = accessToken;
        spotify.refreshToken = refreshToken;
        spotify.tokenExpiresAt = expiresAt;
        spotify.tokenUpdatedAt = nowIso;
        spotify.tokenScopes = scopes;
        cfg.spotify = spotify;
    });
    return { ok: true, scopes, expiresAt };
}
export async function clearSpotifyTokens(updateMupiboxConfig) {
    await updateMupiboxConfig((cfg) => {
        const spotify = (cfg.spotify ?? {});
        spotify.accessToken = '';
        spotify.refreshToken = '';
        spotify.tokenScopes = [];
        spotify.tokenExpiresAt = undefined;
        cfg.spotify = spotify;
    });
}
//# sourceMappingURL=oauth.js.map