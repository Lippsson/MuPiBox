import { getValidAccessToken, requiresReAuth } from './auth';
import { loadSpotifySyncConfig, loadSpotifyTokenStore } from './config-loader';
import { applyDiff } from './apply';
import { computeSyncDiff } from './diff';
import { maybeNotifyAfterRun } from './notify';
import { discoverPlaylists, resolveSyncItems, SpotifyApiException } from './playlists';
import { readStateFile, writeStateFile } from './state-file';
import { acquireSyncLock, releaseSyncLock } from './sync-lock';
import * as fs from 'node:fs';
export async function runSync(trigger, deps) {
    const startedAt = new Date();
    const startedAtIso = startedAt.toISOString();
    const previousState = readStateFile(deps.stateFilePath);
    let failureCounters = { ...previousState.failure_counters };
    const previousFailureCounters = { ...previousState.failure_counters };
    const finalise = (state, counts = {
        additions: 0,
        updates: 0,
        removals: 0,
        conflictsCount: 0,
    }, extras = {}) => {
        const endedAt = new Date();
        const result = {
            state,
            trigger,
            startedAt: startedAtIso,
            endedAt: endedAt.toISOString(),
            durationMs: endedAt.getTime() - startedAt.getTime(),
            additions: counts.additions,
            updates: counts.updates,
            removals: counts.removals,
            conflictsCount: counts.conflictsCount,
            reason: extras.reason,
            retryAfterSeconds: extras.retryAfterSeconds,
        };
        const persisted = {
            last_sync_start: result.startedAt,
            last_sync_end: result.endedAt,
            last_sync_duration_ms: result.durationMs,
            last_sync_trigger: trigger,
            last_sync_status: state,
            playlists_seen: previousState.playlists_seen,
            additions_count: result.additions,
            updates_count: result.updates,
            removals_count: result.removals,
            conflicts: counts.conflicts ?? previousState.conflicts,
            failure_counters: failureCounters,
            next_scheduled_sync: extras.nextScheduled ?? previousState.next_scheduled_sync,
            current_state: 'IDLE',
        };
        writeStateFile(persisted, deps.stateFilePath);
        try {
            maybeNotifyAfterRun(result, persisted, config, previousFailureCounters);
        }
        catch (err) {
            console.warn(`${new Date().toLocaleString()}: [spotify-sync] notify hook threw (non-fatal): ${err.message}`);
        }
        return result;
    };
    const config = loadSpotifySyncConfig(deps.getMupiboxConfig());
    if (!config.enabled) {
        failureCounters = {};
        return finalise('IDLE', undefined, { reason: 'spotify_sync.enabled is false' });
    }
    const syncLock = acquireSyncLock(config.stale_lock_minutes * 60 * 1000, deps.syncLockPath);
    if (syncLock === 'locked') {
        return finalise('IDLE', undefined, { reason: 'another sync run is in progress' });
    }
    if (syncLock === 'error') {
        return finalise('INTERNAL_ERROR', undefined, { reason: 'sync-lock filesystem error' });
    }
    try {
        const tokenStore = loadSpotifyTokenStore(deps.getMupiboxConfig());
        if (!tokenStore) {
            return finalise('AUTH_NEEDS_REAUTH', undefined, { reason: 'no Spotify tokens configured' });
        }
        if (requiresReAuth(tokenStore)) {
            return finalise('AUTH_NEEDS_REAUTH', undefined, {
                reason: 'token scopes lack playlist-read-private/collaborative',
            });
        }
        const tokenResult = await getValidAccessToken(tokenStore, deps.updateMupiboxConfig);
        if (!tokenResult.ok) {
            const { failure } = tokenResult;
            const kind = failure.kind === 'auth' ? 'auth' : failure.kind === 'rate-limit' ? 'rate-limit' : failure.kind === 'network' ? 'network' : 'internal';
            failureCounters = bumpFailureCounter(failureCounters, kind);
            const mappedState = kind === 'auth' ? 'AUTH_FAILED' : kind === 'rate-limit' ? 'RATE_LIMITED' : kind === 'network' ? 'NETWORK_ERROR' : 'INTERNAL_ERROR';
            return finalise(mappedState, undefined, {
                reason: failure.reason,
                retryAfterSeconds: failure.retryAfterSeconds,
            });
        }
        const accessToken = tokenResult.token;
        let playlistsDiscovered;
        try {
            playlistsDiscovered = await discoverPlaylists(accessToken, config);
        }
        catch (err) {
            return mapSpotifyError(err, failureCounters, finalise);
        }
        let resolved;
        try {
            resolved = await resolveSyncItems(playlistsDiscovered, accessToken, config);
        }
        catch (err) {
            return mapSpotifyError(err, failureCounters, finalise);
        }
        const dataLock = deps.acquireDataLock();
        if (dataLock !== 'acquired') {
            return finalise('INTERNAL_ERROR', undefined, { reason: `data.json lock unavailable (${dataLock})` });
        }
        let diff;
        let applyResult;
        try {
            const raw = fs.readFileSync(deps.dataFile, 'utf8');
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                deps.releaseDataLock();
                return finalise('INTERNAL_ERROR', undefined, { reason: 'data.json root is not an array' });
            }
            const library = parsed;
            diff = computeSyncDiff(resolved.items, library);
            applyResult = await applyDiff(diff, library, deps.dataFile, new Date());
        }
        catch (err) {
            deps.releaseDataLock();
            failureCounters = bumpFailureCounter(failureCounters, 'internal');
            return finalise('INTERNAL_ERROR', undefined, { reason: `apply failed: ${err.message}` });
        }
        deps.releaseDataLock();
        failureCounters = {};
        const playlistsSeen = playlistsDiscovered.map((p) => ({
            id: p.id,
            name: p.name,
            items: resolved.perPlaylistCounts.get(p.id) ?? 0,
        }));
        const endedAt = new Date();
        const persistedSuccess = {
            last_sync_start: startedAtIso,
            last_sync_end: endedAt.toISOString(),
            last_sync_duration_ms: endedAt.getTime() - startedAt.getTime(),
            last_sync_trigger: trigger,
            last_sync_status: 'COMPLETED',
            playlists_seen: playlistsSeen,
            additions_count: applyResult.appliedAdditions,
            updates_count: applyResult.appliedUpdates,
            removals_count: applyResult.appliedRemovals,
            conflicts: diff.conflicts,
            failure_counters: failureCounters,
            next_scheduled_sync: new Date(Date.now() + config.polling_interval_seconds * 1000).toISOString(),
            current_state: 'IDLE',
        };
        writeStateFile(persistedSuccess, deps.stateFilePath);
        const successResult = {
            state: 'COMPLETED',
            trigger,
            startedAt: startedAtIso,
            endedAt: endedAt.toISOString(),
            durationMs: endedAt.getTime() - startedAt.getTime(),
            additions: applyResult.appliedAdditions,
            updates: applyResult.appliedUpdates,
            removals: applyResult.appliedRemovals,
            conflictsCount: diff.conflicts.length,
        };
        try {
            maybeNotifyAfterRun(successResult, persistedSuccess, config, previousFailureCounters);
        }
        catch (err) {
            console.warn(`${new Date().toLocaleString()}: [spotify-sync] notify hook (success path) threw: ${err.message}`);
        }
        return successResult;
    }
    finally {
        releaseSyncLock(deps.syncLockPath);
    }
}
function bumpFailureCounter(counters, kind) {
    return { ...counters, [kind]: (counters[kind] ?? 0) + 1 };
}
function mapSpotifyError(err, counters, finalise) {
    if (err instanceof SpotifyApiException) {
        const k = err.detail.kind;
        const kind = k === 'auth' ? 'auth' : k === 'rate-limit' ? 'rate-limit' : k === 'network' ? 'network' : 'internal';
        bumpFailureCounter(counters, kind);
        const mappedState = kind === 'auth' ? 'AUTH_FAILED' : kind === 'rate-limit' ? 'RATE_LIMITED' : kind === 'network' ? 'NETWORK_ERROR' : 'INTERNAL_ERROR';
        return finalise(mappedState, undefined, {
            reason: err.detail.reason,
            retryAfterSeconds: 'retryAfterSeconds' in err.detail ? err.detail.retryAfterSeconds : undefined,
        });
    }
    return finalise('INTERNAL_ERROR', undefined, { reason: `unexpected error: ${err.message}` });
}
//# sourceMappingURL=state-machine.js.map