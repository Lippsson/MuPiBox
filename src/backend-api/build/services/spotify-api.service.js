import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';
export class SpotifyApiService {
    config;
    spotifyApi;
    cacheDir = path.join(process.cwd(), 'cache', 'spotify-api');
    cacheExpiry = {
        static: 7 * 24 * 60 * 60 * 1000,
        semiStatic: 24 * 60 * 60 * 1000,
        dynamic: 2 * 60 * 60 * 1000,
        search: 6 * 60 * 60 * 1000,
    };
    static CACHE_MAX_FILES = 1000;
    static CACHE_PRUNE_BATCH = 200;
    memCache = new Map();
    memCacheCap = Math.max(50, Math.min(500, Math.floor((os.freemem() * 0.05) / (10 * 1024))));
    memHits = 0;
    memMisses = 0;
    lastRequestTime = 0;
    minRequestInterval = 100;
    requestQueue = [];
    isProcessingQueue = false;
    pendingRequests = new Map();
    backgroundUpdates = new Set();
    backgroundQueue = [];
    isProcessingBackground = false;
    maxConcurrentBackground = 1;
    backgroundUpdateDelay = 10000;
    constructor(config) {
        this.config = config;
        this.spotifyApi = SpotifyApi.withClientCredentials(this.config.spotify?.clientId || '', this.config.spotify?.clientSecret || '');
        console.info('Spotify API service initialized - token management handled by library');
    }
    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }
    normalizePagination(limit, offset) {
        const l = Math.floor(Number(limit));
        const o = Math.floor(Number(offset));
        return {
            limit: Number.isFinite(l) ? Math.min(Math.max(l, 1), 50) : 10,
            offset: Number.isFinite(o) ? Math.max(o, 0) : 0,
        };
    }
    pruneCacheIfNeeded() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            if (files.length <= SpotifyApiService.CACHE_MAX_FILES)
                return;
            const stats = files
                .map((name) => {
                try {
                    return { name, mtime: fs.statSync(path.join(this.cacheDir, name)).mtimeMs };
                }
                catch {
                    return null;
                }
            })
                .filter((x) => x !== null)
                .sort((a, b) => a.mtime - b.mtime);
            const victims = stats.slice(0, SpotifyApiService.CACHE_PRUNE_BATCH);
            for (const v of victims) {
                try {
                    fs.unlinkSync(path.join(this.cacheDir, v.name));
                }
                catch {
                }
            }
            console.info(`🗑️  Cache pruned: removed ${victims.length} oldest entries (was ${files.length})`);
        }
        catch (error) {
            console.error('Error pruning cache:', error);
        }
    }
    getCacheFilePath(cacheKey) {
        const hashed = createHash('sha256').update(cacheKey).digest('hex');
        return path.join(this.cacheDir, `${hashed}.json`);
    }
    getCacheExpiryForKey(cacheKey) {
        if (cacheKey.startsWith('album_') ||
            cacheKey.startsWith('show_') ||
            cacheKey.startsWith('audiobook_') ||
            cacheKey.startsWith('artist_') ||
            cacheKey.startsWith('episode_')) {
            return this.cacheExpiry.static;
        }
        if (cacheKey.startsWith('artist_albums_') || cacheKey.startsWith('show_episodes_')) {
            return this.cacheExpiry.semiStatic;
        }
        if (cacheKey.startsWith('playlist_')) {
            return this.cacheExpiry.dynamic;
        }
        if (cacheKey.startsWith('search_')) {
            return this.cacheExpiry.search;
        }
        return this.cacheExpiry.dynamic;
    }
    memCacheTouch(cacheKey, value) {
        if (this.memCache.has(cacheKey)) {
            this.memCache.delete(cacheKey);
        }
        this.memCache.set(cacheKey, value);
        while (this.memCache.size > this.memCacheCap) {
            const oldestKey = this.memCache.keys().next().value;
            if (oldestKey === undefined)
                break;
            this.memCache.delete(oldestKey);
        }
    }
    async getFromCache(cacheKey) {
        const memEntry = this.memCache.get(cacheKey);
        if (memEntry !== undefined) {
            this.memCache.delete(cacheKey);
            this.memCache.set(cacheKey, memEntry);
            this.memHits++;
            const isStale = Date.now() > (memEntry.expiresAt || Date.now());
            if (isStale) {
                console.info(`📦 Cache stale (mem) for ${cacheKey}, will update in background`);
            }
            return { data: memEntry.data, isStale };
        }
        this.memMisses++;
        try {
            const cacheFile = this.getCacheFilePath(cacheKey);
            let raw;
            try {
                raw = await fsPromises.readFile(cacheFile, 'utf8');
            }
            catch (readErr) {
                if (readErr.code === 'ENOENT') {
                    return { data: null, isStale: false };
                }
                throw readErr;
            }
            const cachedData = JSON.parse(raw);
            const isStale = Date.now() > (cachedData.expiresAt || Date.now());
            if (isStale) {
                console.info(`📦 Cache stale for ${cacheKey}, will update in background`);
            }
            else {
                console.info(`✅ Fresh cache hit for ${cacheKey}`);
            }
            this.memCacheTouch(cacheKey, cachedData);
            return { data: cachedData.data, isStale };
        }
        catch (error) {
            console.error(`Error reading cache for ${cacheKey}:`, error);
            return { data: null, isStale: false };
        }
    }
    async saveToCache(cacheKey, data) {
        try {
            this.ensureCacheDir();
            const cacheFile = this.getCacheFilePath(cacheKey);
            const expiryTime = this.getCacheExpiryForKey(cacheKey);
            const cachedData = {
                data,
                timestamp: Date.now(),
                expiresAt: Date.now() + expiryTime,
            };
            await fsPromises.writeFile(cacheFile, JSON.stringify(cachedData, null, 2));
            this.memCacheTouch(cacheKey, cachedData);
            console.info(`💾 Cached data for ${cacheKey}`);
            this.pruneCacheIfNeeded();
        }
        catch (error) {
            console.error(`Error saving cache for ${cacheKey}:`, error);
        }
    }
    static SPOTIFY_REQUEST_TIMEOUT_MS = 20000;
    async withTimeout(operation, ms) {
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Spotify request timed out after ${ms}ms`)), ms);
        });
        try {
            return await Promise.race([operation(), timeoutPromise]);
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
    async rateLimitedRequest(operation) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            await new Promise((resolve) => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
        }
        try {
            this.lastRequestTime = Date.now();
            return await this.withTimeout(operation, SpotifyApiService.SPOTIFY_REQUEST_TIMEOUT_MS);
        }
        catch (error) {
            if (error.statusCode === 429) {
                const retryAfter = error.headers?.['retry-after']
                    ? Number.parseInt(error.headers['retry-after'], 10) * 1000
                    : 1000;
                console.warn(`Rate limited by Spotify API. Retrying after ${retryAfter}ms`);
                await new Promise((resolve) => setTimeout(resolve, retryAfter));
                return this.rateLimitedRequest(operation);
            }
            throw error;
        }
    }
    async executeWithCache(cacheKey, operation, forceBackgroundRefresh = false) {
        const cacheResult = await this.getFromCache(cacheKey);
        if (cacheResult.data) {
            if (cacheResult.isStale || forceBackgroundRefresh) {
                this.triggerBackgroundUpdate(cacheKey, operation, forceBackgroundRefresh);
            }
            return cacheResult.data;
        }
        console.info(`🔍 No cache for ${cacheKey}, executing request...`);
        return this.queueRequest(cacheKey, operation);
    }
    async queueRequest(key, operation) {
        const existingRequest = this.pendingRequests.get(key);
        if (existingRequest) {
            console.debug(`🔗 Joining existing request for ${key}`);
            return new Promise((resolve, reject) => {
                existingRequest.subscribers.push({ resolve, reject });
            });
        }
        return new Promise((resolve, reject) => {
            const subscribers = [{ resolve, reject }];
            const requestPromise = new Promise((promiseResolve, promiseReject) => {
                this.requestQueue.push({
                    key,
                    operation: async () => {
                        const result = await this.rateLimitedRequest(operation);
                        await this.saveToCache(key, result);
                        return result;
                    },
                    resolve: promiseResolve,
                    reject: promiseReject,
                });
                if (!this.isProcessingQueue) {
                    this.processRequestQueue();
                }
            });
            this.pendingRequests.set(key, {
                promise: requestPromise,
                subscribers,
            });
            requestPromise
                .then((data) => {
                for (const sub of subscribers) {
                    sub.resolve(data);
                }
            })
                .catch((error) => {
                for (const sub of subscribers) {
                    sub.reject(error);
                }
            })
                .finally(() => {
                this.pendingRequests.delete(key);
            });
        });
    }
    async processRequestQueue() {
        if (this.isProcessingQueue)
            return;
        this.isProcessingQueue = true;
        console.debug(`🏃 Starting request queue processing (${this.requestQueue.length} requests)`);
        while (this.requestQueue.length > 0) {
            const queueEntry = this.requestQueue.shift();
            if (!queueEntry)
                break;
            const { key, operation, resolve, reject } = queueEntry;
            try {
                console.debug(`⚡ Processing request for ${key}`);
                const result = await operation();
                resolve(result);
                console.debug(`✅ Completed request for ${key}`);
            }
            catch (error) {
                console.error(`❌ Failed request for ${key}:`, error instanceof Error ? error.message : String(error));
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        }
        this.isProcessingQueue = false;
        console.debug('🏁 Finished processing request queue');
    }
    triggerBackgroundUpdate(cacheKey, operation, prioritize = false) {
        if (this.backgroundUpdates.has(cacheKey)) {
            console.debug(`🔄 Background update already in progress for ${cacheKey}`);
            return;
        }
        if (this.backgroundQueue.some((item) => item.key === cacheKey)) {
            console.debug(`📋 Background update already queued for ${cacheKey}`);
            return;
        }
        if (prioritize) {
            this.backgroundQueue.unshift({ key: cacheKey, operation });
            console.debug(`⚡ Prioritized background update for ${cacheKey} (added to front of queue)`);
        }
        else {
            this.backgroundQueue.push({ key: cacheKey, operation });
            console.debug(`📋 Queued background update for ${cacheKey}`);
        }
        if (!this.isProcessingBackground) {
            this.processBackgroundQueue();
        }
    }
    async processBackgroundQueue() {
        if (this.isProcessingBackground)
            return;
        this.isProcessingBackground = true;
        console.debug(`🔄 Starting background queue processing (${this.backgroundQueue.length} updates)`);
        const concurrentPromises = new Set();
        while (this.backgroundQueue.length > 0 || concurrentPromises.size > 0) {
            while (this.backgroundQueue.length > 0 && concurrentPromises.size < this.maxConcurrentBackground) {
                const queueItem = this.backgroundQueue.shift();
                if (!queueItem)
                    break;
                const { key, operation } = queueItem;
                if (this.backgroundUpdates.has(key)) {
                    console.debug(`⏭️ Skipping ${key} - already in progress`);
                    continue;
                }
                this.backgroundUpdates.add(key);
                const updatePromise = this.rateLimitedRequest(operation)
                    .then(async (result) => {
                    await this.saveToCache(key, result);
                    console.debug(`✅ [BG] Background update completed for ${key}`);
                    await new Promise((resolve) => setTimeout(resolve, this.backgroundUpdateDelay));
                })
                    .catch((error) => {
                    console.error(`❌ [BG] Background update failed for ${key}:`, error instanceof Error ? error.message : String(error));
                })
                    .finally(() => {
                    this.backgroundUpdates.delete(key);
                    concurrentPromises.delete(updatePromise);
                });
                concurrentPromises.add(updatePromise);
            }
            if (concurrentPromises.size > 0) {
                await Promise.race(Array.from(concurrentPromises));
            }
        }
        this.isProcessingBackground = false;
        console.debug('🏁 Finished processing background queue');
    }
    async searchAlbums(query, limit = 10, offset = 0) {
        const { limit: l, offset: o } = this.normalizePagination(limit, offset);
        const cacheKey = `search_albums_${query}_${l}_${o}`;
        return this.executeWithCache(cacheKey, async () => {
            const result = await this.spotifyApi.search(query, ['album'], 'DE', Math.min(l, 10), o);
            return {
                items: result.albums.items.map((item) => ({
                    id: item.id,
                    name: item.name,
                    artists: item.artists,
                    images: item.images,
                    release_date: item.release_date,
                })) || [],
                total: result.albums.total || 0,
                limit: result.albums.limit || l,
                offset: result.albums.offset || o,
            };
        });
    }
    async searchAll(query, types = ['artist', 'album', 'track'], limit = 8) {
        const l = Math.min(Math.max(limit, 1), 10);
        const cacheKey = `search_all_${query}_${types.join(',')}_${l}`;
        return this.executeWithCache(cacheKey, async () => {
            const result = (await this.spotifyApi.search(query, types, 'DE', l, 0));
            return {
                artists: (result.artists?.items ?? []).map((a) => ({ id: a.id, name: a.name, images: a.images ?? [] })),
                albums: (result.albums?.items ?? []).map((a) => ({
                    id: a.id,
                    name: a.name,
                    artists: a.artists ?? [],
                    images: a.images ?? [],
                    release_date: a.release_date,
                    album_type: a.album_type,
                    total_tracks: a.total_tracks,
                })),
                tracks: (result.tracks?.items ?? []).map((t) => ({
                    id: t.id,
                    name: t.name,
                    artists: t.artists ?? [],
                    album: t.album ?? null,
                })),
            };
        });
    }
    async getArtistAlbums(artistId, albumTypes = 'album,single,compilation', limit = 10, offset = 0) {
        const { limit: l, offset: o } = this.normalizePagination(limit, offset);
        const cacheKey = `artist_albums_${artistId}_${albumTypes}_${l}_${o}`;
        return this.executeWithCache(cacheKey, async () => {
            const result = await this.spotifyApi.artists.albums(artistId, 'album,single,compilation', 'DE', Math.min(l, 10), o);
            return {
                items: (result.items || []).map((item) => ({
                    id: item.id,
                    name: item.name,
                    artists: item.artists,
                    images: item.images,
                    release_date: item.release_date,
                })),
                total: result.total || 0,
                limit: result.limit || l,
                offset: result.offset || o,
            };
        });
    }
    async getShowEpisodes(showId, limit = 10, offset = 0) {
        const { limit: l, offset: o } = this.normalizePagination(limit, offset);
        const cacheKey = `show_episodes_${showId}_${l}_${o}`;
        return this.executeWithCache(cacheKey, async () => {
            const result = await this.spotifyApi.shows.episodes(showId, 'DE', Math.min(l, 10), o);
            return {
                items: result.items.map((item) => ({
                    id: item.id,
                    name: item.name,
                    images: item.images,
                    release_date: item.release_date,
                })),
                total: result.total || 0,
                limit: result.limit || l,
                offset: result.offset || o,
            };
        });
    }
    async getAlbum(albumId) {
        const cacheKey = `album_${albumId}`;
        return this.executeWithCache(cacheKey, async () => {
            const result = await this.spotifyApi.albums.get(albumId, 'DE');
            return {
                id: result.id,
                name: result.name,
                artists: result.artists,
                images: result.images,
                release_date: result.release_date,
                tracks: result.tracks,
                total_tracks: result.total_tracks,
            };
        });
    }
    async getPlaylist(playlistId, forceBackgroundRefresh = false) {
        const cacheKey = `playlist_${playlistId}`;
        return this.executeWithCache(cacheKey, async () => {
            const result = await this.spotifyApi.playlists.getPlaylist(playlistId, 'DE');
            return {
                id: result.id,
                name: result.name,
                images: result.images,
                tracks: {
                    total: 0,
                    items: [],
                },
            };
        }, forceBackgroundRefresh);
    }
    async getPlaylistTracks(playlistId, limit = 10, offset = 0, forceBackgroundRefresh = false) {
        const { limit: l, offset: o } = this.normalizePagination(limit, offset);
        const cacheKey = `playlist_tracks_${playlistId}_${l}_${o}`;
        return this.executeWithCache(cacheKey, async () => {
            const result = await this.spotifyApi.playlists.getPlaylistItems(playlistId, 'DE', 'items(track(id,uri,name))', Math.min(l, 10), o);
            return result.items;
        }, forceBackgroundRefresh);
    }
    async getShow(showId) {
        const cacheKey = `show_${showId}`;
        return this.executeWithCache(cacheKey, async () => {
            const result = await this.spotifyApi.shows.get(showId, 'DE');
            return {
                id: result.id,
                name: result.name,
                images: result.images,
                episodes: result.episodes,
                total_episodes: result.total_episodes || result.episodes?.total || 0,
            };
        });
    }
    async getAudiobook(audiobookId) {
        const cacheKey = `audiobook_${audiobookId}`;
        return this.executeWithCache(cacheKey, async () => {
            const result = await this.spotifyApi.audiobooks.get(audiobookId, 'DE');
            return {
                id: result.id,
                name: result.name,
                images: result.images,
                authors: result.authors,
                chapters: result.chapters,
            };
        });
    }
    async getEpisode(episodeId) {
        const cacheKey = `episode_${episodeId}`;
        return this.executeWithCache(cacheKey, async () => {
            const result = await this.spotifyApi.episodes.get(episodeId, 'DE');
            return {
                id: result.id,
                name: result.name,
                show: result.show,
                images: result.images,
                release_date: result.release_date,
            };
        });
    }
    async getArtist(artistId) {
        const cacheKey = `artist_${artistId}`;
        return this.executeWithCache(cacheKey, async () => {
            const result = await this.spotifyApi.artists.get(artistId);
            return {
                id: result.id,
                name: result.name,
                images: result.images,
            };
        });
    }
    async validateSpotifyResource(id, type) {
        try {
            switch (type) {
                case 'album':
                    await this.getAlbum(id);
                    return true;
                case 'show':
                    await this.getShow(id);
                    return true;
                case 'audiobook':
                    await this.getAudiobook(id);
                    return true;
                case 'artist':
                    await this.getArtist(id);
                    return true;
                case 'playlist':
                    await this.getPlaylist(id);
                    return true;
                default:
                    return false;
            }
        }
        catch (error) {
            console.warn(`Validation failed for ${type} ${id}:`, error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    async dispose() {
        this.backgroundUpdates.clear();
        this.backgroundQueue.length = 0;
        this.isProcessingBackground = false;
        while (this.requestQueue.length > 0) {
            const queueEntry = this.requestQueue.shift();
            if (queueEntry) {
                queueEntry.reject(new Error('Service is being disposed'));
            }
        }
        this.isProcessingQueue = false;
        for (const [_key, pendingRequest] of this.pendingRequests) {
            for (const sub of pendingRequest.subscribers) {
                sub.reject(new Error('Service is being disposed'));
            }
        }
        this.pendingRequests.clear();
    }
}
//# sourceMappingURL=spotify-api.service.js.map