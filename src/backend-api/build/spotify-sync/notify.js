import { spawn } from 'node:child_process';
const TELEGRAM_SCRIPT = '/usr/local/bin/mupibox/telegram_send_message.py';
function pushMessage(text) {
    try {
        const child = spawn('/usr/bin/python3', [TELEGRAM_SCRIPT, text], {
            stdio: 'ignore',
            detached: false,
        });
        child.on('error', (err) => {
            console.warn(`${new Date().toLocaleString()}: [spotify-sync] telegram notify spawn failed: ${err.message}`);
        });
    }
    catch (err) {
        console.warn(`${new Date().toLocaleString()}: [spotify-sync] telegram notify spawn threw: ${err.message}`);
    }
}
export function maybeNotifyAfterRun(result, state, config, previousCounts) {
    if (!config.enabled)
        return;
    if (config.notify_on_auth_failure_immediately &&
        (result.state === 'AUTH_FAILED' || result.state === 'AUTH_NEEDS_REAUTH') &&
        (previousCounts.auth ?? 0) === 0) {
        pushMessage(`⚠️ MuPiBox Smart-Sync: Spotify-Anmeldung abgelaufen oder ungültig.\n\nBitte neu verbinden:\n/spotify-connect`);
        return;
    }
    const threshold = Math.max(1, config.notify_on_failure_after_attempts);
    const kinds = ['network', 'internal'];
    for (const kind of kinds) {
        const before = previousCounts[kind] ?? 0;
        const now = state.failure_counters[kind] ?? 0;
        if (now >= threshold && before < threshold) {
            pushMessage(`⚠️ MuPiBox Smart-Sync: ${kind === 'network' ? 'Netzwerk' : 'interner Fehler'} — ${now} fehlgeschlagene Versuche in Folge.\n\nDetails via /syncstatus.`);
            return;
        }
    }
    if (config.notify_on_conflict && result.state === 'COMPLETED' && result.conflictsCount > 0) {
        pushMessage(`ℹ️ MuPiBox Smart-Sync: ${result.conflictsCount} Konflikt(e) (Manual + Sync-Playlist gleich).\n\nManuelle Einträge bleiben unangetastet. Details in der Eltern-WebApp.`);
        return;
    }
    if (config.notify_on_sync && result.state === 'COMPLETED') {
        if (result.additions > 0 || result.removals > 0) {
            pushMessage(`✅ MuPiBox Smart-Sync: +${result.additions} hinzugefügt, −${result.removals} entfernt.`);
        }
    }
}
//# sourceMappingURL=notify.js.map