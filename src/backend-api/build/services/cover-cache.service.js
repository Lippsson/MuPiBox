import { existsSync, mkdirSync } from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
export class CoverCacheService {
    cacheDir;
    static MAX_FILES = 2000;
    static PRUNE_BATCH = 400;
    static UPSTREAM_TIMEOUT_MS = 5000;
    static NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;
    memCache = new Map();
    memCacheBytes = 0;
    memCacheMaxBytes;
    pendingFetches = new Map();
    negativeCache = new Map();
    stats = { memHits: 0, sdHits: 0, cdnHits: 0, negativeHits: 0, fetchErrors: 0 };
    constructor(baseDir) {
        this.cacheDir = path.join(baseDir, 'covers');
        if (!existsSync(this.cacheDir)) {
            mkdirSync(this.cacheDir, { recursive: true });
        }
        this.memCacheMaxBytes = Math.max(512 * 1024, Math.min(10 * 1024 * 1024, Math.floor(os.freemem() * 0.05)));
    }
    static isValidImageId(id) {
        return /^[A-Za-z0-9]{32,80}$/.test(id);
    }
    async get(imageId) {
        if (!CoverCacheService.isValidImageId(imageId))
            return null;
        const mem = this.memCache.get(imageId);
        if (mem !== undefined) {
            this.memCache.delete(imageId);
            this.memCache.set(imageId, mem);
            this.stats.memHits++;
            return mem;
        }
        const negExp = this.negativeCache.get(imageId);
        if (negExp !== undefined) {
            if (Date.now() < negExp) {
                this.stats.negativeHits++;
                return null;
            }
            this.negativeCache.delete(imageId);
        }
        const filePath = path.join(this.cacheDir, `${imageId}.jpg`);
        try {
            const buf = await fsPromises.readFile(filePath);
            const now = new Date();
            fsPromises.utimes(filePath, now, now).catch(() => { });
            this.memCachePut(imageId, buf);
            this.stats.sdHits++;
            return buf;
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(`cover-cache SD read error for ${imageId}:`, err);
            }
        }
        const inflight = this.pendingFetches.get(imageId);
        if (inflight)
            return inflight;
        const fetchPromise = this.fetchFromCdn(imageId, filePath).finally(() => {
            this.pendingFetches.delete(imageId);
        });
        this.pendingFetches.set(imageId, fetchPromise);
        return fetchPromise;
    }
    async fetchFromCdn(imageId, filePath) {
        const url = `https://i.scdn.co/image/${imageId}`;
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(CoverCacheService.UPSTREAM_TIMEOUT_MS),
            });
            if (response.status === 404) {
                this.negativeCache.set(imageId, Date.now() + CoverCacheService.NEGATIVE_CACHE_TTL_MS);
                return null;
            }
            if (!response.ok) {
                console.warn(`cover-cache upstream non-OK for ${imageId}: HTTP ${response.status}`);
                this.stats.fetchErrors++;
                return null;
            }
            const arrayBuf = await response.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            fsPromises.writeFile(filePath, buf).catch((err) => {
                console.error(`cover-cache SD write error for ${imageId}:`, err);
            });
            this.memCachePut(imageId, buf);
            this.stats.cdnHits++;
            this.pruneIfNeeded().catch(() => { });
            return buf;
        }
        catch (err) {
            console.error(`cover-cache fetch failed for ${imageId}:`, err);
            this.stats.fetchErrors++;
            return null;
        }
    }
    memCachePut(key, buf) {
        if (this.memCache.has(key)) {
            const old = this.memCache.get(key);
            this.memCacheBytes -= old.length;
            this.memCache.delete(key);
        }
        this.memCache.set(key, buf);
        this.memCacheBytes += buf.length;
        while (this.memCacheBytes > this.memCacheMaxBytes) {
            const oldest = this.memCache.keys().next().value;
            if (oldest === undefined)
                break;
            const oldBuf = this.memCache.get(oldest);
            this.memCacheBytes -= oldBuf.length;
            this.memCache.delete(oldest);
        }
    }
    async pruneIfNeeded() {
        try {
            const files = await fsPromises.readdir(this.cacheDir);
            if (files.length <= CoverCacheService.MAX_FILES)
                return;
            const stats = await Promise.all(files.map(async (name) => {
                try {
                    const s = await fsPromises.stat(path.join(this.cacheDir, name));
                    return { name, mtime: s.mtimeMs };
                }
                catch {
                    return null;
                }
            }));
            const valid = stats.filter((s) => s !== null);
            valid.sort((a, b) => a.mtime - b.mtime);
            const victims = valid.slice(0, CoverCacheService.PRUNE_BATCH);
            for (const v of victims) {
                try {
                    await fsPromises.unlink(path.join(this.cacheDir, v.name));
                }
                catch {
                }
            }
            console.info(`🗑️  Cover-cache pruned: removed ${victims.length} of ${files.length}`);
        }
        catch (err) {
            console.error('cover-cache prune error:', err);
        }
    }
}
//# sourceMappingURL=cover-cache.service.js.map