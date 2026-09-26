import { runSync } from './state-machine';
import { loadSpotifySyncConfig } from './config-loader';
const MANUAL_THROTTLE_PATH = '/tmp/.last_sync_trigger';
let timerHandle = null;
let inflight = null;
let trailingTimer = null;
export function startScheduler(deps) {
    if (timerHandle) {
        clearTimeout(timerHandle);
        timerHandle = null;
    }
    const config = loadSpotifySyncConfig(deps.getMupiboxConfig());
    scheduleNext(60, deps);
    console.log(`${new Date().toLocaleString()}: [spotify-sync] scheduler started (enabled=${config.enabled}, interval=${config.polling_interval_seconds}s)`);
}
function scheduleNext(delaySeconds, deps) {
    if (timerHandle)
        clearTimeout(timerHandle);
    timerHandle = setTimeout(async () => {
        timerHandle = null;
        const config = loadSpotifySyncConfig(deps.getMupiboxConfig());
        if (!config.enabled) {
            scheduleNext(config.polling_interval_seconds, deps);
            return;
        }
        const result = await runOnce('cron', deps);
        const next = result.state === 'RATE_LIMITED' && result.retryAfterSeconds ? result.retryAfterSeconds : config.polling_interval_seconds;
        scheduleNext(next, deps);
    }, delaySeconds * 1000);
    if (typeof timerHandle.unref === 'function')
        timerHandle.unref();
}
export async function triggerManualSync(source, deps) {
    const config = loadSpotifySyncConfig(deps.getMupiboxConfig());
    if (!config.enabled)
        return { ok: false, status: 'disabled' };
    const cooldownLeft = getManualThrottleRemaining(config.manual_throttle_seconds);
    if (inflight) {
        armTrailingRun(source, deps, cooldownLeft);
        return { ok: false, status: 'running' };
    }
    if (cooldownLeft > 0) {
        armTrailingRun(source, deps, cooldownLeft);
        return { ok: true, status: 'scheduled', scheduledInSeconds: cooldownLeft };
    }
    markManualTrigger();
    if (trailingTimer) {
        clearTimeout(trailingTimer);
        trailingTimer = null;
    }
    void runOnce(source, deps);
    return { ok: true, status: 'queued', estimatedSeconds: 3 };
}
function armTrailingRun(source, deps, delaySeconds) {
    if (trailingTimer)
        return;
    const fire = () => {
        if (inflight) {
            trailingTimer = setTimeout(fire, 5000);
            if (typeof trailingTimer.unref === 'function')
                trailingTimer.unref();
            return;
        }
        trailingTimer = null;
        markManualTrigger();
        void runOnce(source, deps);
    };
    trailingTimer = setTimeout(fire, Math.max(0, delaySeconds) * 1000 + 250);
    if (typeof trailingTimer.unref === 'function')
        trailingTimer.unref();
}
function getManualThrottleRemaining(throttleSeconds) {
    try {
        const fs = require('node:fs');
        if (!fs.existsSync(MANUAL_THROTTLE_PATH))
            return 0;
        const stat = fs.statSync(MANUAL_THROTTLE_PATH);
        const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
        if (ageSeconds >= throttleSeconds)
            return 0;
        return Math.ceil(throttleSeconds - ageSeconds);
    }
    catch {
        return 0;
    }
}
function markManualTrigger() {
    try {
        const fs = require('node:fs');
        fs.writeFileSync(MANUAL_THROTTLE_PATH, String(Date.now()));
    }
    catch {
    }
}
async function runOnce(trigger, deps) {
    if (inflight)
        return inflight;
    inflight = runSync(trigger, deps).finally(() => {
        inflight = null;
    });
    return inflight;
}
export function stopScheduler() {
    if (timerHandle) {
        clearTimeout(timerHandle);
        timerHandle = null;
    }
}
//# sourceMappingURL=scheduler.js.map