import * as fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import { Router } from 'express';
import { loadSpotifySyncConfig, loadSpotifyTokenStore } from './config-loader';
import { getValidAccessToken, requiresReAuth, tokenStillValid } from './auth';
import { fetchArtistAlbums } from './playlists';
import { readStateFile } from './state-file';
import { triggerManualSync } from './scheduler';
import { POLLING_INTERVAL_SECONDS_MAX, POLLING_INTERVAL_SECONDS_MIN, } from './types';
export function createSpotifySyncRouter(deps) {
    const router = Router();
    router.get('/status', (_req, res) => {
        const state = readStateFile(deps.stateFilePath);
        const config = loadSpotifySyncConfig(deps.getMupiboxConfig());
        const tokenStore = loadSpotifyTokenStore(deps.getMupiboxConfig());
        res.json({
            enabled: config.enabled,
            polling_interval_seconds: config.polling_interval_seconds,
            playlist_prefix: config.playlist_prefix,
            token: {
                configured: !!tokenStore,
                valid: tokenStore ? tokenStillValid(tokenStore) : false,
                scopes_ok: tokenStore ? !requiresReAuth(tokenStore) : false,
                expires_at: tokenStore?.tokenExpiresAt,
            },
            state,
        });
    });
    router.post('/trigger', async (req, res) => {
        const sourceRaw = typeof req.query.source === 'string' ? req.query.source : 'webapp';
        const source = sourceRaw === 'telegram' ? 'telegram' : 'webapp';
        const result = await triggerManualSync(source, deps);
        if (!result.ok) {
            const code = result.status === 'running' ? 409 : 400;
            res.status(code).json(result);
            return;
        }
        res.status(202).json(result);
    });
    router.get('/config', (_req, res) => {
        const config = loadSpotifySyncConfig(deps.getMupiboxConfig());
        res.json(config);
    });
    router.post('/conflicts/promote', async (req, res) => {
        const body = (req.body ?? {});
        const allowedFields = ['id', 'artistid', 'showid', 'audiobookid', 'playlistid'];
        const field = typeof body.identifierField === 'string' ? body.identifierField : '';
        const value = typeof body.identifierValue === 'string' ? body.identifierValue : '';
        if (!allowedFields.includes(field) || !value) {
            res.status(400).json({ error: 'identifierField + identifierValue required' });
            return;
        }
        const lockResult = deps.acquireDataLock();
        if (lockResult === 'locked') {
            res.status(409).json({ error: 'data.json is locked' });
            return;
        }
        if (lockResult === 'error') {
            res.status(500).json({ error: 'data.json lock acquisition failed' });
            return;
        }
        try {
            const raw = await fsPromises.readFile(deps.dataFile, 'utf8');
            const library = JSON.parse(raw);
            if (!Array.isArray(library)) {
                res.status(500).json({ error: 'data.json root is not an array' });
                return;
            }
            const target = library.find((entry) => entry[field] === value);
            if (!target) {
                res.status(404).json({ error: 'no library entry matches the identifier' });
                return;
            }
            target.source = 'spotify-sync';
            if (!target.spotify_sync_playlists)
                target.spotify_sync_playlists = [];
            const tmp = `${deps.dataFile}.tmp.${process.pid}`;
            await fsPromises.writeFile(tmp, `${JSON.stringify(library, null, 2)}\n`, 'utf8');
            fs.renameSync(tmp, deps.dataFile);
            res.json({ ok: true, promoted: { field, value } });
        }
        catch (err) {
            res.status(500).json({ error: `failed: ${err.message}` });
        }
        finally {
            deps.releaseDataLock();
        }
    });
    router.post('/config', async (req, res) => {
        const body = req.body;
        if (!body || typeof body !== 'object') {
            res.status(400).json({ error: 'body must be a JSON object' });
            return;
        }
        const mutations = {};
        if (typeof body.enabled === 'boolean')
            mutations.enabled = body.enabled;
        if (typeof body.playlist_prefix === 'string' && body.playlist_prefix.trim().length >= 2) {
            mutations.playlist_prefix = body.playlist_prefix.trim();
        }
        if (typeof body.polling_interval_seconds === 'number') {
            const clamped = Math.max(POLLING_INTERVAL_SECONDS_MIN, Math.min(POLLING_INTERVAL_SECONDS_MAX, Math.floor(body.polling_interval_seconds)));
            mutations.polling_interval_seconds = clamped;
        }
        if (Array.isArray(body.playlist_explicit_ids)) {
            mutations.playlist_explicit_ids = body.playlist_explicit_ids.filter((id) => typeof id === 'string');
        }
        if (typeof body.notify_on_sync === 'boolean')
            mutations.notify_on_sync = body.notify_on_sync;
        if (typeof body.notify_on_conflict === 'boolean')
            mutations.notify_on_conflict = body.notify_on_conflict;
        if (typeof body.notify_on_failure_after_attempts === 'number') {
            mutations.notify_on_failure_after_attempts = Math.max(1, Math.floor(body.notify_on_failure_after_attempts));
        }
        if (Object.keys(mutations).length === 0) {
            res.status(400).json({ error: 'no recognised fields in body' });
            return;
        }
        await deps.updateMupiboxConfig((cfg) => {
            const existing = (cfg.spotify_sync ?? {});
            Object.assign(existing, mutations);
            cfg.spotify_sync = existing;
        });
        const merged = loadSpotifySyncConfig(deps.getMupiboxConfig());
        res.json({ ok: true, applied: mutations, current: merged });
    });
    router.get('/artist-albums', async (req, res) => {
        const artistId = String(req.query.artistId ?? '').trim();
        if (!/^[A-Za-z0-9]{22}$/.test(artistId)) {
            res.status(400).json({ error: 'invalid artistId (expected 22-char Spotify id)' });
            return;
        }
        const tokenStore = loadSpotifyTokenStore(deps.getMupiboxConfig());
        if (!tokenStore) {
            res.status(409).json({ error: 'spotify not configured' });
            return;
        }
        const tok = await getValidAccessToken(tokenStore, deps.updateMupiboxConfig);
        if (!tok.ok) {
            res.status(502).json({ error: 'token unavailable', detail: tok.failure.reason });
            return;
        }
        const config = loadSpotifySyncConfig(deps.getMupiboxConfig());
        const sub = (config.artists ?? []).find((a) => a.id === artistId);
        let albums;
        try {
            albums = await fetchArtistAlbums(artistId, tok.token, sub?.album_types ?? 'album');
        }
        catch (err) {
            res.status(502).json({ error: `artist albums fetch failed: ${err.message}` });
            return;
        }
        albums.sort((a, b) => (a.release_date ?? '').localeCompare(b.release_date ?? ''));
        const from = Math.max(1, sub?.range_from ?? 1);
        const to = sub?.range_to && sub.range_to > 0 ? sub.range_to : albums.length;
        const excluded = new Set(sub?.exclude_album_ids ?? []);
        res.json({
            artistId,
            subscribed: !!sub,
            range_from: sub?.range_from,
            range_to: sub?.range_to,
            albums: albums.map((al, i) => {
                const position = i + 1;
                return {
                    id: al.id,
                    name: al.name,
                    release_date: al.release_date,
                    cover: al.images?.[0]?.url,
                    position,
                    inRange: position >= from && position <= to,
                    excluded: !!al.id && excluded.has(al.id),
                };
            }),
        });
    });
    return router;
}
//# sourceMappingURL=routes.js.map