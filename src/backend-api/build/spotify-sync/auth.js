import { hasRequiredSyncScopes } from './config-loader';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;
export async function refreshAccessToken(store) {
    if (!store.clientId || !store.refreshToken) {
        return { ok: false, kind: 'auth', reason: 'missing clientId or refreshToken in token store' };
    }
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: store.refreshToken,
    });
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (store.clientSecret) {
        const basic = Buffer.from(`${store.clientId}:${store.clientSecret}`).toString('base64');
        headers.Authorization = `Basic ${basic}`;
    }
    else {
        body.append('client_id', store.clientId);
    }
    let response;
    try {
        response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
        });
    }
    catch (err) {
        const e = err;
        return { ok: false, kind: 'network', reason: `refresh request failed: ${e?.message ?? String(err)}` };
    }
    if (response.status === 429) {
        const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '60', 10);
        return { ok: false, kind: 'rate-limit', reason: 'Spotify rate-limited refresh', retryAfterSeconds: retryAfter };
    }
    let parsed;
    try {
        parsed = (await response.json());
    }
    catch (err) {
        return { ok: false, kind: 'internal', reason: `refresh response not JSON: ${err.message}` };
    }
    if (!response.ok) {
        const errorCode = typeof parsed.error === 'string' ? parsed.error : 'unknown_error';
        const isAuth = response.status === 400 || response.status === 401;
        return {
            ok: false,
            kind: isAuth ? 'auth' : 'internal',
            reason: `${response.status} ${errorCode}: ${typeof parsed.error_description === 'string' ? parsed.error_description : ''}`,
        };
    }
    const accessToken = typeof parsed.access_token === 'string' ? parsed.access_token : '';
    if (!accessToken) {
        return { ok: false, kind: 'internal', reason: 'refresh response missing access_token' };
    }
    const refreshToken = typeof parsed.refresh_token === 'string' ? parsed.refresh_token : undefined;
    const expiresIn = typeof parsed.expires_in === 'number' ? parsed.expires_in : 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const scopes = typeof parsed.scope === 'string' ? parsed.scope.split(/\s+/).filter(Boolean) : [];
    return {
        ok: true,
        result: { accessToken, refreshToken, expiresAt, scopes },
    };
}
export async function persistRefreshedToken(result, store, updateCfg) {
    const newStore = {
        ...store,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? store.refreshToken,
        tokenExpiresAt: result.expiresAt,
        tokenUpdatedAt: new Date().toISOString(),
        tokenScopes: result.scopes,
    };
    await updateCfg((cfg) => {
        const spotify = (cfg.spotify ?? {});
        spotify.accessToken = newStore.accessToken;
        spotify.refreshToken = newStore.refreshToken ?? '';
        spotify.tokenExpiresAt = newStore.tokenExpiresAt;
        spotify.tokenUpdatedAt = newStore.tokenUpdatedAt;
        spotify.tokenScopes = newStore.tokenScopes;
        cfg.spotify = spotify;
    });
    return newStore;
}
export function tokenStillValid(store, slackSeconds = 300) {
    if (!store.accessToken || !store.tokenExpiresAt)
        return false;
    const expiresAt = Date.parse(store.tokenExpiresAt);
    if (Number.isNaN(expiresAt))
        return false;
    return expiresAt - Date.now() > slackSeconds * 1000;
}
export async function getValidAccessToken(store, updateCfg) {
    if (tokenStillValid(store)) {
        return { ok: true, token: store.accessToken, store };
    }
    const outcome = await refreshAccessToken(store);
    if (!outcome.ok) {
        const { ok: _ok, ...failure } = outcome;
        return { ok: false, failure };
    }
    const newStore = await persistRefreshedToken(outcome.result, store, updateCfg);
    return { ok: true, token: newStore.accessToken, store: newStore };
}
export function requiresReAuth(store) {
    if (!store)
        return true;
    if (!store.tokenScopes || store.tokenScopes.length === 0)
        return true;
    return !hasRequiredSyncScopes(store);
}
//# sourceMappingURL=auth.js.map