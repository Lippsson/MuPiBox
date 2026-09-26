import * as fs from 'node:fs';
import { EMPTY_SYNC_STATE } from './types';
const STATE_FILE_PATH = '/tmp/.spotify_sync_state.json';
export function readStateFile(path = STATE_FILE_PATH) {
    try {
        if (!fs.existsSync(path))
            return { ...EMPTY_SYNC_STATE };
        const raw = fs.readFileSync(path, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            ...EMPTY_SYNC_STATE,
            ...parsed,
            failure_counters: { ...EMPTY_SYNC_STATE.failure_counters, ...(parsed.failure_counters ?? {}) },
        };
    }
    catch (err) {
        console.warn(`${new Date().toLocaleString()}: [spotify-sync] state-file read failed (${err.message}), returning empty`);
        return { ...EMPTY_SYNC_STATE };
    }
}
export function writeStateFile(state, path = STATE_FILE_PATH) {
    try {
        const tmp = `${path}.tmp.${process.pid}`;
        fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
        fs.renameSync(tmp, path);
    }
    catch (err) {
        console.warn(`${new Date().toLocaleString()}: [spotify-sync] state-file write failed: ${err.message}`);
    }
}
//# sourceMappingURL=state-file.js.map