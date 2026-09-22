import fs from 'node:fs';
import path from 'node:path';
export class SpotifyMediaInfo {
    cacheDir = path.join(process.cwd(), 'cache', 'spotify');
    cacheExpiry = 12 * 60 * 60 * 1000;
    backgroundUpdates = new Set();
    backgroundQueue = [];
    isProcessingBackground = false;
    maxConcurrentBackground = 3;
    foregroundQueue = [];
    isProcessingForeground = false;
    pendingForegroundRequests = new Map();
    async fetchPlaylistDataSync(playlistId, isBackground = false) {
        const logPrefix = isBackground ? '[BG]' : '[FG]';
        try {
            console.debug(`${logPrefix} Fetching playlist data from Spotify Embed: ${playlistId}`);
            const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
            const response = await fetch(embedUrl, {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                },
                signal: AbortSignal.timeout(20000),
            });
            if (!response.ok) {
                throw new Error(`Spotify Embed API error: ${response.status}`);
            }
            const html = await response.text();
            const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
            if (!match) {
                throw new Error('Could not find __NEXT_DATA__ script tag in Spotify Embed HTML');
            }
            const nextData = JSON.parse(match[1]);
            const playlistData = this.transformEmbedData(nextData);
            await this.saveToCache(playlistId, playlistData);
            return playlistData;
        }
        catch (error) {
            console.error(`${logPrefix} Error fetching playlist data:`, error);
            throw error;
        }
    }
    transformEmbedData(nextData) {
        const entity = nextData.props?.pageProps?.state?.data?.entity;
        if (!entity) {
            throw new Error('Invalid data structure: missing entity in NEXT_DATA');
        }
        const playlist = {
            name: entity.name || entity.title || 'Unknown Playlist',
            images: entity.coverArt?.sources?.length > 0
                ? entity.coverArt.sources.map((source) => ({
                    url: source.url,
                    width: source.width || 0,
                    height: source.height || 0,
                }))
                : [],
            tracks: {
                total: entity.trackList?.length || 0,
            },
        };
        const tracks = (entity.trackList || []).map((item) => {
            const artists = item.subtitle
                ? item.subtitle.split(/[,;]\s*|\s*,\s*| /).map((name) => ({
                    name: name.trim(),
                    uri: '',
                }))
                : [];
            return {
                name: item.title || 'Unknown Track',
                uri: item.uri || '',
                duration_ms: item.duration || 0,
                artists: artists,
                album: {
                    name: '',
                    uri: '',
                    images: [],
                },
            };
        });
        return {
            playlist,
            tracks,
        };
    }
    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }
    getCacheFilePath(id, type) {
        return path.join(this.cacheDir, `${type}_${id}.json`);
    }
    async getFromCache(id, type) {
        try {
            const cacheFile = this.getCacheFilePath(id, type);
            if (!fs.existsSync(cacheFile)) {
                return { data: null, isStale: false };
            }
            const stats = fs.statSync(cacheFile);
            const isStale = Date.now() - stats.mtime.getTime() > this.cacheExpiry;
            const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            if (isStale) {
                console.info(`📦 Cache stale for ${type} ${id}, will update in background`);
            }
            else {
                console.info(`✅ Fresh cache hit for ${type} ${id}`);
            }
            return { data: cachedData, isStale };
        }
        catch (error) {
            console.error(`Error reading cache for ${type} ${id}:`, error);
            return { data: null, isStale: false };
        }
    }
    async saveToCache(id, data) {
        try {
            this.ensureCacheDir();
            const type = 'playlist';
            const cacheFile = this.getCacheFilePath(id, type);
            fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
            console.info(`💾 Cached ${type} data for ${id}`);
        }
        catch (error) {
            console.error(`Error saving cache for ${id}:`, error);
        }
    }
    async getCachedPlaylistData(playlistId) {
        const cacheResult = await this.getFromCache(playlistId, 'playlist');
        return cacheResult.data;
    }
    async fetchPlaylistData(playlistId) {
        const cacheResult = await this.getFromCache(playlistId, 'playlist');
        if (cacheResult.data) {
            if (cacheResult.isStale) {
                this.triggerBackgroundUpdate(playlistId, 'playlist');
            }
            return cacheResult.data;
        }
        console.info(`🔍 No cache for playlist ${playlistId}, adding to foreground queue...`);
        return this.queueForegroundRequest(playlistId, 'playlist');
    }
    async queueForegroundRequest(id, type) {
        const existingRequest = this.pendingForegroundRequests.get(id);
        if (existingRequest) {
            console.debug(`🔗 Joining existing foreground request for ${type} ${id} (${existingRequest.subscribers.length + 1} total subscribers)`);
            return new Promise((resolve, reject) => {
                existingRequest.subscribers.push({ resolve, reject });
            });
        }
        return new Promise((resolve, reject) => {
            const subscribers = [{ resolve, reject }];
            const requestPromise = new Promise((promiseResolve, promiseReject) => {
                const queueEntry = {
                    id,
                    type,
                    resolve: promiseResolve,
                    reject: promiseReject,
                };
                this.foregroundQueue.push(queueEntry);
                console.debug(`📋 Queued new foreground request for ${type} ${id} (position ${this.foregroundQueue.length})`);
                if (!this.isProcessingForeground) {
                    this.processForegroundQueue();
                }
            });
            this.pendingForegroundRequests.set(id, {
                promise: requestPromise,
                subscribers,
            });
            requestPromise
                .then((data) => {
                console.debug(`✅ Resolving ${subscribers.length} subscribers for ${type} ${id}`);
                for (const sub of subscribers) {
                    sub.resolve(data);
                }
            })
                .catch((error) => {
                console.error(`❌ Rejecting ${subscribers.length} subscribers for ${type} ${id}:`, error instanceof Error ? error.message : String(error));
                for (const sub of subscribers) {
                    sub.reject(error);
                }
            })
                .finally(() => {
                this.pendingForegroundRequests.delete(id);
            });
        });
    }
    async processForegroundQueue() {
        if (this.isProcessingForeground) {
            return;
        }
        this.isProcessingForeground = true;
        console.debug(`🏃 Starting foreground queue processing (${this.foregroundQueue.length} requests)`);
        while (this.foregroundQueue.length > 0) {
            const queueEntry = this.foregroundQueue.shift();
            if (!queueEntry)
                break;
            const { id, type, resolve, reject } = queueEntry;
            try {
                console.debug(`⚡ Processing foreground request for ${type} ${id} (${this.foregroundQueue.length} remaining)`);
                const data = await this.fetchPlaylistDataSync(id, false);
                resolve(data);
                console.debug(`✅ Completed foreground request for ${type} ${id}`);
            }
            catch (error) {
                console.error(`❌ Failed foreground request for ${type} ${id}:`, error instanceof Error ? error.message : String(error));
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        }
        this.isProcessingForeground = false;
        console.debug('🏁 Finished processing foreground queue');
    }
    triggerBackgroundUpdate(id, type) {
        if (this.backgroundUpdates.has(id)) {
            console.debug(`🔄 Background update already in progress for ${type} ${id}`);
            return;
        }
        if (this.backgroundQueue.some((item) => item.id === id && item.type === type)) {
            console.debug(`📋 Background update already queued for ${type} ${id}`);
            return;
        }
        this.backgroundQueue.push({ id, type });
        console.debug(`📋 Queued background update for ${type} ${id} (position ${this.backgroundQueue.length})`);
        if (!this.isProcessingBackground) {
            this.processBackgroundQueue();
        }
    }
    async processBackgroundQueue() {
        if (this.isProcessingBackground) {
            return;
        }
        this.isProcessingBackground = true;
        console.debug(`🔄 Starting background queue processing (${this.backgroundQueue.length} updates pending)`);
        const concurrentPromises = new Set();
        while (this.backgroundQueue.length > 0 || concurrentPromises.size > 0) {
            while (this.backgroundQueue.length > 0 && concurrentPromises.size < this.maxConcurrentBackground) {
                const queueItem = this.backgroundQueue.shift();
                if (!queueItem)
                    break;
                const { id, type } = queueItem;
                if (this.backgroundUpdates.has(id)) {
                    console.debug(`⏭️ Skipping ${type} ${id} - already in progress`);
                    continue;
                }
                console.debug(`🚀 Starting background update for ${type} ${id} (${concurrentPromises.size + 1}/${this.maxConcurrentBackground} slots)`);
                this.backgroundUpdates.add(id);
                const updatePromise = this.fetchPlaylistDataSync(id, true)
                    .then(() => {
                    console.debug(`✅ [BG] Background update completed for ${type} ${id}`);
                })
                    .catch((error) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error(`❌ [BG] Background update failed for ${type} ${id}:`, errorMessage);
                })
                    .finally(() => {
                    this.backgroundUpdates.delete(id);
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
    async dispose() {
        this.backgroundUpdates.clear();
        this.backgroundQueue.length = 0;
        this.isProcessingBackground = false;
        while (this.foregroundQueue.length > 0) {
            const queueEntry = this.foregroundQueue.shift();
            if (queueEntry) {
                queueEntry.reject(new Error('Service is being disposed'));
            }
        }
        this.isProcessingForeground = false;
        for (const [playlistId, pendingRequest] of this.pendingForegroundRequests) {
            console.debug(`🧹 Cleaning up ${pendingRequest.subscribers.length} subscribers for playlist ${playlistId}`);
            for (const sub of pendingRequest.subscribers) {
                sub.reject(new Error('Service is being disposed'));
            }
        }
        this.pendingForegroundRequests.clear();
    }
}
//# sourceMappingURL=spotify-media-info.service.js.map