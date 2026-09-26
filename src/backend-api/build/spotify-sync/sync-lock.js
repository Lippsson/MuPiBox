import * as fs from 'node:fs';
const SYNC_LOCK_PATH = '/tmp/.spotify_sync.lock';
export function acquireSyncLock(staleMs, lockPath = SYNC_LOCK_PATH) {
    const tryOpen = () => {
        try {
            fs.closeSync(fs.openSync(lockPath, 'wx'));
            return 'acquired';
        }
        catch (err) {
            const code = err.code;
            if (code === 'EEXIST')
                return 'locked';
            console.error(`${new Date().toLocaleString()}: [spotify-sync] sync-lock open failed:`, err.message);
            return 'error';
        }
    };
    const first = tryOpen();
    if (first !== 'locked')
        return first;
    try {
        const stat = fs.statSync(lockPath);
        const ageMs = Date.now() - stat.mtimeMs;
        if (ageMs > staleMs) {
            try {
                fs.unlinkSync(lockPath);
            }
            catch {
                return 'locked';
            }
            console.warn(`${new Date().toLocaleString()}: [spotify-sync] sync-lock: stole stale lock (age ${Math.round(ageMs / 1000)}s)`);
            const second = tryOpen();
            return second === 'locked' ? 'locked' : second;
        }
    }
    catch {
        const second = tryOpen();
        return second === 'locked' ? 'locked' : second;
    }
    return 'locked';
}
export function releaseSyncLock(lockPath = SYNC_LOCK_PATH) {
    try {
        fs.unlinkSync(lockPath);
    }
    catch (err) {
        if (err.code !== 'ENOENT') {
            console.warn(`${new Date().toLocaleString()}: [spotify-sync] sync-lock release failed:`, err.message);
        }
    }
}
//# sourceMappingURL=sync-lock.js.map