import { execFile, spawn } from 'node:child_process';
import { promises as fsp, readFileSync } from 'node:fs';
import * as os from 'node:os';
import { Router } from 'express';
import QRCode from 'qrcode';
import { CSRF_HEADER, ELTERN_PASSWORD_MIN_LENGTH, SESSION_COOKIE, destroySession, generateMagicLink, hasElternPassword, issueSession, redeemMagicLink, setElternPassword, verifyElternPassword, } from './auth';
import { ipRateLimit, localNetworkOnly, requireCsrf, requireSession } from './middleware';
import { REQUESTED_SCOPES, buildAuthorizeUrl, buildRedirectUri, clearSpotifyTokens, consumeOauthState, exchangeCodeForTokens, } from './oauth';
function buildSessionCookie(sessionId, maxAgeSeconds) {
    return `${SESSION_COOKIE}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
}
function buildClearCookie() {
    return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
const BT_MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
function execCapture(cmd, args, timeoutMs = 8000) {
    return new Promise((resolve) => {
        execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout) => {
            resolve({ ok: !err, stdout: stdout ?? '' });
        });
    });
}
export function createElternApiRouter(deps) {
    const router = Router();
    router.use(localNetworkOnly);
    router.post('/magic-link/generate', ipRateLimit(10), (req, res) => {
        const body = (req.body ?? {});
        const source = typeof body.source === 'string' ? body.source : 'unknown';
        const link = generateMagicLink(source);
        res.status(201).json({
            token: link.token,
            expires_in: link.expiresIn,
            url_path: `/eltern?token=${encodeURIComponent(link.token)}`,
        });
    });
    router.get('/magic-link/qr', async (req, res) => {
        const token = typeof req.query.token === 'string' ? req.query.token : '';
        if (!token || !/^[a-f0-9]{32,128}$/i.test(token)) {
            res.status(400).send('invalid token');
            return;
        }
        const host = req.headers.host;
        if (typeof host !== 'string') {
            res.status(400).send('no host header');
            return;
        }
        const url = `http://${host}/eltern?token=${encodeURIComponent(token)}`;
        try {
            const svg = await QRCode.toString(url, {
                type: 'svg',
                errorCorrectionLevel: 'M',
                margin: 2,
                color: { dark: '#1a1c20', light: '#ffffff' },
            });
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'no-store');
            res.send(svg);
        }
        catch (err) {
            res.status(500).send(`QR-Code generation failed: ${err.message}`);
        }
    });
    router.get('/session', requireSession, (req, res) => {
        res.json({
            authenticated: true,
            csrf_header: CSRF_HEADER,
            csrf_token: req.elternSessionCsrf,
            passwordConfigured: hasElternPassword(deps.getMupiboxConfig()),
        });
    });
    router.get('/auth-info', (_req, res) => {
        res.json({ passwordConfigured: hasElternPassword(deps.getMupiboxConfig()) });
    });
    router.post('/login', ipRateLimit(5), async (req, res) => {
        const body = req.body ?? {};
        const pw = typeof body.password === 'string' ? body.password : '';
        const mupibox = deps.getMupiboxConfig();
        if (!hasElternPassword(mupibox)) {
            res.status(401).json({ error: 'password login not enabled' });
            return;
        }
        const ok = await verifyElternPassword(pw, mupibox);
        if (!ok) {
            res.status(401).json({ error: 'invalid password' });
            return;
        }
        const ip = req.ip ?? req.socket.remoteAddress ?? '';
        const session = issueSession(ip);
        res.setHeader('Set-Cookie', buildSessionCookie(session.sessionId, 24 * 60 * 60));
        res.json({ ok: true, csrf_header: CSRF_HEADER, csrf_token: session.csrf });
    });
    router.post('/password', requireSession, requireCsrf, async (req, res) => {
        const body = req.body ?? {};
        const pw = typeof body.password === 'string' ? body.password : '';
        if (pw.trim() && pw.trim().length < ELTERN_PASSWORD_MIN_LENGTH) {
            res.status(400).json({ error: `password too short (min ${ELTERN_PASSWORD_MIN_LENGTH} chars)` });
            return;
        }
        await setElternPassword(pw, deps.updateMupiboxConfig);
        res.json({ ok: true, configured: hasElternPassword(deps.getMupiboxConfig()) });
    });
    router.post('/logout', requireSession, requireCsrf, (req, res) => {
        destroySession(req.elternSessionId);
        res.setHeader('Set-Cookie', buildClearCookie());
        res.json({ ok: true });
    });
    router.get('/spotify-oauth/init', requireSession, (req, res) => {
        const host = req.headers.host;
        if (typeof host !== 'string') {
            res.status(400).json({ error: 'no host header' });
            return;
        }
        const ret = typeof req.query.return === 'string' ? req.query.return : '/eltern';
        const result = buildAuthorizeUrl({
            getMupiboxConfig: deps.getMupiboxConfig,
            sessionId: req.elternSessionId ?? '',
            host,
            protocol: 'http',
            redirectAfter: ret,
        });
        if ('error' in result) {
            res.status(400).json({ error: 'no_client_id', redirect_to: '/eltern/wizard' });
            return;
        }
        res.json({
            authorize_url: result.url,
            redirect_uri: result.redirectUri,
            scopes: REQUESTED_SCOPES,
        });
    });
    router.get('/spotify-oauth/callback', requireSession, async (req, res) => {
        const state = typeof req.query.state === 'string' ? req.query.state : '';
        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const error = typeof req.query.error === 'string' ? req.query.error : '';
        if (error) {
            res.redirect(`/eltern?spotify_error=${encodeURIComponent(error)}`);
            return;
        }
        if (!state || !code) {
            res.status(400).send('missing code or state');
            return;
        }
        const original = consumeOauthState(state);
        if (!original || original.sessionId !== req.elternSessionId) {
            res.status(403).send('invalid or replayed state');
            return;
        }
        const host = req.headers.host;
        if (typeof host !== 'string') {
            res.status(400).send('no host header');
            return;
        }
        const redirectUri = buildRedirectUri('http', host);
        const exchange = await exchangeCodeForTokens({
            code,
            redirectUri,
            getMupiboxConfig: deps.getMupiboxConfig,
            updateMupiboxConfig: deps.updateMupiboxConfig,
        });
        if (!exchange.ok) {
            res.redirect(`/eltern?spotify_error=${encodeURIComponent(exchange.reason)}`);
            return;
        }
        res.redirect(`${original.redirectAfter}?spotify_connected=1`);
    });
    router.post('/spotify-oauth/disconnect', requireSession, requireCsrf, async (_req, res) => {
        await clearSpotifyTokens(deps.updateMupiboxConfig);
        res.json({ ok: true });
    });
    router.get('/caps-config', requireSession, (_req, res) => {
        const cfg = deps.getMupiboxConfig();
        const playtime = cfg?.playtimeLimit ?? {};
        const quiet = cfg?.quietHours ?? {};
        res.json({
            playtimeLimit: {
                enabled: playtime.enabled ?? false,
                maxOverrunMinutes: playtime.maxOverrunMinutes ?? 10,
                resetHour: playtime.resetHour ?? 0,
                limitsMinutes: playtime.limitsMinutes ?? {
                    mon: 60, tue: 60, wed: 60, thu: 60, fri: 60, sat: 60, sun: 60,
                },
            },
            quietHours: {
                enabled: quiet.enabled ?? false,
                maxOverrunMinutes: quiet.maxOverrunMinutes ?? 10,
                schedule: quiet.schedule ?? { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
            },
        });
    });
    router.post('/caps-config', requireSession, requireCsrf, async (req, res) => {
        const body = (req.body ?? {});
        const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        const validatedLimits = {};
        if (body.playtimeLimit?.limitsMinutes) {
            for (const day of days) {
                const v = body.playtimeLimit.limitsMinutes[day];
                if (v === undefined)
                    continue;
                if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1440) {
                    res.status(400).json({ error: `invalid limitsMinutes.${day}` });
                    return;
                }
                validatedLimits[day] = Math.floor(v);
            }
        }
        const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
        const validatedSchedule = {};
        if (body.quietHours?.schedule) {
            for (const day of days) {
                const windows = body.quietHours.schedule[day];
                if (windows === undefined)
                    continue;
                if (!Array.isArray(windows)) {
                    res.status(400).json({ error: `schedule.${day} must be an array` });
                    return;
                }
                const accepted = [];
                for (const w of windows) {
                    if (!w || typeof w !== 'object') {
                        res.status(400).json({ error: `schedule.${day} entry must be {from,to,label?}` });
                        return;
                    }
                    const rec = w;
                    const from = rec.from;
                    const to = rec.to;
                    if (typeof from !== 'string' || typeof to !== 'string' || !HHMM.test(from) || !HHMM.test(to)) {
                        res.status(400).json({ error: `schedule.${day} times must be HH:MM strings (fields: from, to)` });
                        return;
                    }
                    const entry = { from, to };
                    if (typeof rec.label === 'string' && rec.label.trim())
                        entry.label = rec.label.trim().slice(0, 80);
                    accepted.push(entry);
                }
                validatedSchedule[day] = accepted;
            }
        }
        await deps.updateMupiboxConfig((cfg) => {
            if (body.playtimeLimit) {
                const block = (cfg.playtimeLimit ?? {});
                if (typeof body.playtimeLimit.enabled === 'boolean')
                    block.enabled = body.playtimeLimit.enabled;
                if (typeof body.playtimeLimit.maxOverrunMinutes === 'number')
                    block.maxOverrunMinutes = Math.max(0, Math.min(120, Math.floor(body.playtimeLimit.maxOverrunMinutes)));
                if (Object.keys(validatedLimits).length > 0) {
                    const lm = (block.limitsMinutes ?? {});
                    Object.assign(lm, validatedLimits);
                    block.limitsMinutes = lm;
                }
                cfg.playtimeLimit = block;
            }
            if (body.quietHours) {
                const block = (cfg.quietHours ?? {});
                if (typeof body.quietHours.enabled === 'boolean')
                    block.enabled = body.quietHours.enabled;
                if (typeof body.quietHours.maxOverrunMinutes === 'number')
                    block.maxOverrunMinutes = Math.max(0, Math.min(120, Math.floor(body.quietHours.maxOverrunMinutes)));
                if (Object.keys(validatedSchedule).length > 0) {
                    const sched = (block.schedule ?? {});
                    Object.assign(sched, validatedSchedule);
                    block.schedule = sched;
                }
                cfg.quietHours = block;
            }
        });
        res.json({ ok: true });
    });
    router.get('/power-config', requireSession, (_req, res) => {
        const cfg = deps.getMupiboxConfig();
        const timeout = cfg?.timeout ?? {};
        const mupihat = cfg?.mupihat ?? {};
        const selectedBattery = typeof mupihat.selected_battery === 'string' ? mupihat.selected_battery : '';
        const types = Array.isArray(mupihat.battery_types) ? mupihat.battery_types : [];
        const profile = types.find((p) => p?.name === selectedBattery);
        res.json({
            timeout: {
                idlePiShutdown: Number(timeout.idlePiShutdown ?? 0),
                idleDisplayOff: Number(timeout.idleDisplayOff ?? 10),
                pressDelay: Number(timeout.pressDelay ?? 2),
            },
            battery: {
                selected: selectedBattery,
                profile: profile?.config ?? null,
            },
        });
    });
    router.post('/power-config', requireSession, requireCsrf, async (req, res) => {
        const body = (req.body ?? {});
        const timeoutMutations = {};
        if (typeof body.idlePiShutdown === 'number' && Number.isFinite(body.idlePiShutdown)) {
            const v = Math.max(0, Math.min(1440, Math.floor(body.idlePiShutdown)));
            timeoutMutations.idlePiShutdown = String(v);
        }
        if (typeof body.idleDisplayOff === 'number' && Number.isFinite(body.idleDisplayOff)) {
            const v = Math.max(0, Math.min(1440, Math.floor(body.idleDisplayOff)));
            timeoutMutations.idleDisplayOff = String(v);
        }
        let profileMutations = null;
        if (body.batteryProfile && typeof body.batteryProfile === 'object') {
            const ranges = {
                v_100: [5000, 9000],
                v_75: [5000, 9000],
                v_50: [5000, 9000],
                v_25: [5000, 9000],
                v_0: [5000, 9000],
                th_warning: [5500, 8000],
                th_shutdown: [5000, 7500],
                vreg: [6000, 8500],
            };
            const candidates = {};
            for (const [field, [lo, hi]] of Object.entries(ranges)) {
                const raw = body.batteryProfile[field];
                if (raw === undefined || raw === null || raw === '')
                    continue;
                const n = Math.floor(Number(raw));
                if (!Number.isFinite(n) || n < lo || n > hi) {
                    res.status(400).json({ error: `${field} must be ${lo}-${hi} mV` });
                    return;
                }
                candidates[field] = String(n);
            }
            const cfgRead = deps.getMupiboxConfig();
            const mupihatRead = cfgRead?.mupihat ?? {};
            const selectedRead = String(mupihatRead.selected_battery ?? '');
            const typesRead = Array.isArray(mupihatRead.battery_types)
                ? mupihatRead.battery_types
                : [];
            const profileRead = typesRead.find((p) => p?.name === selectedRead);
            const profConfigRead = profileRead?.config ?? {};
            const finalShutdown = Number(candidates.th_shutdown ?? profConfigRead.th_shutdown ?? 0);
            const finalWarning = Number(candidates.th_warning ?? profConfigRead.th_warning ?? 0);
            if (finalShutdown && finalWarning && finalShutdown >= finalWarning) {
                res.status(400).json({ error: `th_shutdown (${finalShutdown}) must be < th_warning (${finalWarning})` });
                return;
            }
            if (Object.keys(candidates).length > 0)
                profileMutations = candidates;
        }
        if (Object.keys(timeoutMutations).length === 0 && !profileMutations) {
            res.status(400).json({ error: 'no recognised fields in body' });
            return;
        }
        await deps.updateMupiboxConfig((cfg) => {
            if (Object.keys(timeoutMutations).length > 0) {
                const timeout = (cfg.timeout ?? {});
                Object.assign(timeout, timeoutMutations);
                cfg.timeout = timeout;
            }
            if (profileMutations) {
                const mupihat = (cfg.mupihat ?? {});
                const selected = String(mupihat.selected_battery ?? '');
                const types = Array.isArray(mupihat.battery_types)
                    ? mupihat.battery_types
                    : [];
                const profile = types.find((p) => p?.name === selected);
                if (profile) {
                    const pConfig = (profile.config ?? {});
                    Object.assign(pConfig, profileMutations);
                    profile.config = pConfig;
                    mupihat.battery_types = types;
                    cfg.mupihat = mupihat;
                }
            }
        });
        res.json({ ok: true, applied: { timeout: timeoutMutations, batteryProfile: profileMutations } });
    });
    router.get('/sleeptimer', requireSession, (_req, res) => {
        try {
            const raw = readFileSync('/tmp/.time2sleep', 'utf8').trim();
            const remaining = Number.parseInt(raw, 10);
            if (Number.isFinite(remaining) && remaining > 0) {
                const until = new Date(Date.now() + remaining * 1000);
                res.json({ active: true, remaining_seconds: remaining, until_iso: until.toISOString() });
                return;
            }
        }
        catch {
        }
        res.json({ active: false });
    });
    router.post('/sleeptimer/start', requireSession, requireCsrf, (req, res) => {
        const body = req.body ?? {};
        const minutes = Math.floor(Number(body.minutes));
        if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
            res.status(400).json({ error: 'minutes must be an integer between 1 and 1440' });
            return;
        }
        const seconds = minutes * 60;
        try {
            const child = spawn('sudo', ['/usr/local/bin/mupibox/sleep_timer.sh', String(seconds)], {
                detached: true,
                stdio: 'ignore',
            });
            child.unref();
        }
        catch (err) {
            res.status(500).json({ error: `spawn failed: ${err.message}` });
            return;
        }
        res.json({ ok: true, minutes, seconds });
    });
    router.post('/sleeptimer/stop', requireSession, requireCsrf, (_req, res) => {
        execFile('sudo', ['pkill', '-f', 'sleep_timer.sh'], { timeout: 5000 }, () => {
            execFile('sudo', ['rm', '-f', '/tmp/.time2sleep'], { timeout: 5000 }, () => {
                res.json({ ok: true });
            });
        });
    });
    router.get('/audio', requireSession, (_req, res) => {
        const cfg = deps.getMupiboxConfig();
        if (!cfg) {
            res.status(503).json({ error: 'config not yet loaded, please retry' });
            return;
        }
        execFile('/usr/bin/amixer', ['sget', 'Master'], { timeout: 3000 }, (err, stdout) => {
            let current = null;
            if (!err && stdout) {
                const m = stdout.match(/\[(\d+)%\]/);
                if (m)
                    current = Number.parseInt(m[1], 10);
            }
            const mb = cfg.mupibox ?? {};
            const maxVolume = typeof mb.maxVolume === 'number' ? mb.maxVolume : 100;
            const startupVolume = typeof mb.startupVolume === 'number' ? mb.startupVolume : null;
            res.json({ current, maxVolume, startupVolume });
        });
    });
    router.post('/audio/volume', requireSession, requireCsrf, (req, res) => {
        const body = req.body ?? {};
        const raw = Number(body.volume);
        if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
            res.status(400).json({ error: 'volume must be a number between 0 and 100' });
            return;
        }
        const cfg = deps.getMupiboxConfig();
        if (!cfg) {
            res.status(503).json({ error: 'config not yet loaded, please retry' });
            return;
        }
        const mb = cfg.mupibox ?? {};
        const cap = typeof mb.maxVolume === 'number' ? mb.maxVolume : 100;
        const requested = Math.floor(raw);
        const applied = Math.min(requested, cap);
        execFile('/usr/bin/amixer', ['sset', 'Master', `${applied}%`], { timeout: 3000 }, (err) => {
            if (err) {
                res.status(500).json({ error: `amixer failed: ${err.message}` });
                return;
            }
            res.json({ ok: true, applied, capped: applied < requested });
        });
    });
    router.post('/audio/config', requireSession, requireCsrf, async (req, res) => {
        const body = req.body ?? {};
        const mutations = {};
        if (body.maxVolume !== undefined) {
            const v = Number(body.maxVolume);
            if (!Number.isFinite(v) || v < 10 || v > 100) {
                res.status(400).json({ error: 'maxVolume must be a number between 10 and 100' });
                return;
            }
            mutations.maxVolume = Math.floor(v);
        }
        if (body.startupVolume !== undefined) {
            if (body.startupVolume === null) {
                mutations.startupVolume = null;
            }
            else {
                const v = Number(body.startupVolume);
                if (!Number.isFinite(v) || v < 0 || v > 100) {
                    res.status(400).json({ error: 'startupVolume must be a number between 0 and 100, or null' });
                    return;
                }
                mutations.startupVolume = Math.floor(v);
            }
        }
        if (Object.keys(mutations).length === 0) {
            res.status(400).json({ error: 'no recognised fields in body' });
            return;
        }
        await deps.updateMupiboxConfig((cfg) => {
            const mb = (cfg.mupibox ?? {});
            if (mutations.maxVolume !== undefined)
                mb.maxVolume = mutations.maxVolume;
            if (mutations.startupVolume !== undefined) {
                if (mutations.startupVolume === null)
                    delete mb.startupVolume;
                else
                    mb.startupVolume = mutations.startupVolume;
            }
            cfg.mupibox = mb;
        });
        res.json({ ok: true, applied: mutations });
    });
    router.get('/wlan/scan', requireSession, (_req, res) => {
        execFile('sudo', ['/usr/sbin/iwlist', 'wlan0', 'scanning'], { timeout: 12000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
            if (err) {
                res.status(500).json({ error: `iwlist failed: ${err.message}` });
                return;
            }
            const blocks = stdout.split(/Cell \d+ -/);
            const byBest = new Map();
            for (const blk of blocks) {
                const ssidMatch = blk.match(/ESSID:"([^"]*)"/);
                if (!ssidMatch)
                    continue;
                const ssid = ssidMatch[1];
                if (!ssid)
                    continue;
                const sigMatch = blk.match(/Signal level=(-?\d+)\s*dBm/);
                const signal_dbm = sigMatch ? Number.parseInt(sigMatch[1], 10) : -100;
                const encrypted = /Encryption key:on/.test(blk);
                const prev = byBest.get(ssid);
                if (!prev || signal_dbm > prev.signal_dbm) {
                    byBest.set(ssid, { ssid, signal_dbm, encrypted });
                }
            }
            const networks = [...byBest.values()].sort((a, b) => b.signal_dbm - a.signal_dbm);
            res.json({ networks });
        });
    });
    router.get('/wlan/saved', requireSession, (_req, res) => {
        execFile('sudo', ['/usr/sbin/wpa_cli', '-i', 'wlan0', 'list_networks'], { timeout: 5000 }, (err, stdout) => {
            if (err) {
                res.status(500).json({ error: `wpa_cli failed: ${err.message}` });
                return;
            }
            const lines = stdout.split('\n');
            const networks = [];
            for (const ln of lines) {
                if (!ln || ln.startsWith('network id'))
                    continue;
                const parts = ln.split('\t');
                if (parts.length < 2)
                    continue;
                const id = Number.parseInt(parts[0], 10);
                if (!Number.isFinite(id))
                    continue;
                const ssid = parts[1] ?? '';
                const flags = parts[3] ?? '';
                networks.push({ id, ssid, active: flags.includes('[CURRENT]') });
            }
            res.json({ networks });
        });
    });
    router.post('/wlan/add', requireSession, requireCsrf, async (req, res) => {
        const body = req.body ?? {};
        const ssid = typeof body.ssid === 'string' ? body.ssid : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (!ssid || ssid.length > 32 || /[\r\n\0]/.test(ssid)) {
            res.status(400).json({ error: 'ssid must be 1-32 chars, no line breaks or NUL' });
            return;
        }
        if (password && (password.length < 8 || password.length > 63)) {
            res.status(400).json({ error: 'password must be empty (open network) or 8-63 chars' });
            return;
        }
        const WLAN_FILE = '/home/dietpi/.mupibox/Sonos-Kids-Controller-master/server/config/wlan.json';
        let existing;
        try {
            const raw = await fsp.readFile(WLAN_FILE, 'utf8');
            existing = JSON.parse(raw);
        }
        catch {
            existing = [];
        }
        const queue = Array.isArray(existing) ? existing : [];
        queue.push({ ssid, pw: password });
        try {
            await fsp.writeFile(WLAN_FILE, JSON.stringify(queue, null, 4), 'utf8');
        }
        catch (writeErr) {
            res.status(500).json({ error: `failed to queue wlan: ${writeErr.message}` });
            return;
        }
        res.json({ ok: true, queued_position: queue.length });
    });
    router.post('/wlan/remove', requireSession, requireCsrf, (req, res) => {
        const body = req.body ?? {};
        const ssid = typeof body.ssid === 'string' ? body.ssid : '';
        if (!ssid) {
            res.status(400).json({ error: 'ssid required' });
            return;
        }
        execFile('sudo', ['/usr/sbin/wpa_cli', '-i', 'wlan0', 'list_networks'], { timeout: 5000 }, (err, stdout) => {
            if (err) {
                res.status(500).json({ error: `wpa_cli failed: ${err.message}` });
                return;
            }
            let targetId = null;
            let targetActive = false;
            for (const ln of stdout.split('\n')) {
                if (!ln || ln.startsWith('network id'))
                    continue;
                const parts = ln.split('\t');
                if (parts.length < 2)
                    continue;
                if (parts[1] !== ssid)
                    continue;
                targetId = Number.parseInt(parts[0], 10);
                targetActive = (parts[3] ?? '').includes('[CURRENT]');
                break;
            }
            if (targetId === null) {
                res.status(404).json({ error: 'ssid not in saved networks' });
                return;
            }
            if (targetActive) {
                res.status(409).json({ error: 'refusing to remove the currently-connected network — would lock the box out' });
                return;
            }
            execFile('sudo', ['/usr/sbin/wpa_cli', '-i', 'wlan0', 'remove_network', String(targetId)], { timeout: 5000 }, (rmErr, rmOut) => {
                if (rmErr || !/OK/.test(rmOut)) {
                    res.status(500).json({ error: `remove_network failed: ${rmErr?.message ?? rmOut.trim()}` });
                    return;
                }
                execFile('sudo', ['/usr/sbin/wpa_cli', '-i', 'wlan0', 'save_config'], { timeout: 5000 }, (saveErr, saveOut) => {
                    if (saveErr || !/OK/.test(saveOut)) {
                        res.status(500).json({ error: `save_config failed: ${saveErr?.message ?? saveOut.trim()}` });
                        return;
                    }
                    res.json({ ok: true });
                });
            });
        });
    });
    router.get('/battery-history', requireSession, (req, res) => {
        const hours = Math.max(1, Math.min(168, Math.floor(Number(req.query.hours) || 24)));
        let raw = '';
        try {
            raw = readFileSync('/home/dietpi/.mupibox/battery_log.jsonl', 'utf8');
        }
        catch {
            res.json({ hours, samples: [] });
            return;
        }
        const cutoffMs = Date.now() - hours * 3600 * 1000;
        const all = [];
        for (const ln of raw.split('\n')) {
            if (!ln)
                continue;
            try {
                const e = JSON.parse(ln);
                if (e.ts && Date.parse(e.ts) >= cutoffMs)
                    all.push(e);
            }
            catch {
            }
        }
        const TARGET = 120;
        const samples = all.length <= TARGET ? all : all.filter((_, i) => i % Math.ceil(all.length / TARGET) === 0);
        res.json({ hours, samples });
    });
    router.get('/playback', requireSession, async (_req, res) => {
        try {
            const localRes = await fetch('http://127.0.0.1:5005/local', { signal: AbortSignal.timeout(3000) });
            if (!localRes.ok) {
                res.status(502).json({ error: 'player unreachable' });
                return;
            }
            const local = (await localRes.json());
            const player = String(local.currentPlayer ?? '');
            let playing = false;
            let title = '';
            let artist = '';
            let album = '';
            let coverUrl = null;
            let progressMs = null;
            let durationMs = null;
            if (player === 'mplayer') {
                playing = local.playing === true;
                title = String(local.currentTrackname ?? '');
                album = String(local.album ?? '');
            }
            else if (player === 'spotify') {
                try {
                    const stateRes = await fetch('http://127.0.0.1:5005/state', { signal: AbortSignal.timeout(3000) });
                    if (stateRes.ok) {
                        const state = (await stateRes.json());
                        playing = state.is_playing === true;
                        if (typeof state.progress_ms === 'number')
                            progressMs = state.progress_ms;
                        if (typeof state.item?.duration_ms === 'number')
                            durationMs = state.item.duration_ms;
                        if (state.item?.name)
                            title = String(state.item.name);
                        if (state.item?.album?.name)
                            album = String(state.item.album.name);
                        if (state.item?.show?.name) {
                            artist = String(state.item.show.name);
                            if (!album && state.item.show.publisher)
                                album = String(state.item.show.publisher);
                        }
                        else if (Array.isArray(state.item?.artists) && state.item.artists[0]?.name) {
                            artist = String(state.item.artists[0].name);
                        }
                        const candidates = [
                            state.item?.images?.[0]?.url,
                            state.item?.show?.images?.[0]?.url,
                            state.item?.album?.images?.[0]?.url,
                        ].filter((u) => typeof u === 'string' && u.length > 0);
                        if (candidates.length > 0)
                            coverUrl = candidates[0];
                    }
                }
                catch {
                }
            }
            res.json({
                playing,
                player,
                source: String(local.currentType ?? ''),
                title,
                artist,
                album,
                coverUrl,
                progressMs,
                durationMs,
                volume: typeof local.volume === 'number' ? local.volume : null,
            });
        }
        catch (err) {
            res.status(502).json({ error: `player unreachable: ${err.message}` });
        }
    });
    for (const action of ['pause', 'play', 'stop']) {
        router.post(`/playback/${action}`, requireSession, requireCsrf, async (_req, res) => {
            try {
                const r = await fetch(`http://127.0.0.1:5005/${action}`, { signal: AbortSignal.timeout(3000) });
                if (!r.ok) {
                    res.status(502).json({ error: `player rejected ${action} (HTTP ${r.status})` });
                    return;
                }
                res.json({ ok: true, action });
            }
            catch (err) {
                res.status(502).json({ error: `player unreachable: ${err.message}` });
            }
        });
    }
    router.get('/playlog', requireSession, (req, res) => {
        const range = String(req.query.range ?? 'today');
        if (range !== 'today' && range !== 'week') {
            res.status(400).json({ error: 'range must be today or week' });
            return;
        }
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const cutoffMs = range === 'today' ? todayStart.getTime() : now.getTime() - 7 * 24 * 3600 * 1000;
        let raw = '';
        try {
            raw = readFileSync('/home/dietpi/.mupibox/play_log.jsonl', 'utf8');
        }
        catch {
        }
        const entries = [];
        for (const ln of raw.split('\n')) {
            if (!ln)
                continue;
            try {
                const e = JSON.parse(ln);
                if (Date.parse(e.ts) >= cutoffMs)
                    entries.push(e);
            }
            catch {
            }
        }
        const plays = [];
        let pending = null;
        for (const e of entries) {
            if (e.event === 'start') {
                if (pending !== null) {
                    plays.push({ ...pending, duration: Math.max(0, Math.round((Date.parse(e.ts) - pending.tsMs) / 1000)) });
                }
                pending = {
                    tsMs: Date.parse(e.ts),
                    source: e.source ?? '',
                    title: e.title ?? '',
                    artist: e.artist ?? '',
                    album: e.album ?? '',
                };
            }
            else if (e.event === 'stop' && pending !== null) {
                plays.push({ ...pending, duration: e.duration_seconds ?? 0 });
                pending = null;
            }
        }
        if (pending !== null) {
            plays.push({ ...pending, duration: Math.max(0, Math.round((Date.now() - pending.tsMs) / 1000)) });
        }
        const totalSeconds = plays.reduce((s, p) => s + p.duration, 0);
        const totalMinutes = Math.round(totalSeconds / 60);
        const trackCount = plays.length;
        const artistMap = new Map();
        for (const p of plays) {
            const key = p.artist || '(unbekannt)';
            const cur = artistMap.get(key) ?? { name: key, seconds: 0, count: 0 };
            cur.seconds += p.duration;
            cur.count += 1;
            artistMap.set(key, cur);
        }
        const topArtists = [...artistMap.values()]
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, 5)
            .map((a) => ({ name: a.name, minutes: Math.round(a.seconds / 60), count: a.count }));
        const titleMap = new Map();
        for (const p of plays) {
            const key = `${p.artist}|${p.title}`;
            const cur = titleMap.get(key) ?? { title: p.title, artist: p.artist, seconds: 0, count: 0 };
            cur.seconds += p.duration;
            cur.count += 1;
            titleMap.set(key, cur);
        }
        const topTitles = [...titleMap.values()]
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, 5)
            .map((t) => ({ title: t.title, artist: t.artist, minutes: Math.round(t.seconds / 60), count: t.count }));
        const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const timeline = [];
        if (range === 'today') {
            timeline.push({ date: dateKey(todayStart), minutes: totalMinutes });
        }
        else {
            const dayBuckets = new Map();
            for (let i = 6; i >= 0; i--) {
                const d = new Date(todayStart.getTime() - i * 24 * 3600 * 1000);
                dayBuckets.set(dateKey(d), 0);
            }
            for (const p of plays) {
                const d = new Date(p.tsMs);
                const key = dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
                if (dayBuckets.has(key))
                    dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + p.duration / 60);
            }
            for (const [date, mins] of dayBuckets) {
                timeline.push({ date, minutes: Math.round(mins) });
            }
        }
        res.json({ range, totalMinutes, trackCount, topArtists, topTitles, timeline });
    });
    router.get('/theme', requireSession, (_req, res) => {
        const cfg = deps.getMupiboxConfig();
        if (!cfg) {
            res.status(503).json({ error: 'config not yet loaded, please retry' });
            return;
        }
        const mb = cfg.mupibox ?? {};
        const current = typeof mb.theme === 'string' ? mb.theme : '';
        const available = Array.isArray(mb.installedThemes)
            ? mb.installedThemes.filter((x) => typeof x === 'string').sort()
            : [];
        res.json({ current, available });
    });
    router.post('/theme', requireSession, requireCsrf, async (req, res) => {
        const cfg = deps.getMupiboxConfig();
        if (!cfg) {
            res.status(503).json({ error: 'config not yet loaded, please retry' });
            return;
        }
        const body = req.body ?? {};
        const theme = typeof body.theme === 'string' ? body.theme.trim() : '';
        const mb = cfg.mupibox ?? {};
        const installed = Array.isArray(mb.installedThemes)
            ? mb.installedThemes.filter((x) => typeof x === 'string')
            : [];
        if (!theme || !installed.includes(theme)) {
            res.status(400).json({ error: 'theme not in installed-themes whitelist' });
            return;
        }
        await deps.updateMupiboxConfig((c) => {
            const m = (c.mupibox ?? {});
            m.theme = theme;
            c.mupibox = m;
        });
        const symlinkPath = '/home/dietpi/.mupibox/Sonos-Kids-Controller-master/www/active_theme.css';
        const target = `/home/dietpi/MuPiBox/themes/${theme}.css`;
        try {
            await fsp.rm(symlinkPath, { force: true });
            await fsp.symlink(target, symlinkPath);
        }
        catch (err) {
            res.status(500).json({ error: `symlink update failed: ${err.message}` });
            return;
        }
        res.json({ ok: true, theme });
    });
    router.get('/theme-preview/:name', requireSession, (req, res) => {
        const cfg = deps.getMupiboxConfig();
        if (!cfg) {
            res.status(503).end();
            return;
        }
        const mb = cfg.mupibox ?? {};
        const installed = Array.isArray(mb.installedThemes)
            ? mb.installedThemes.filter((x) => typeof x === 'string')
            : [];
        const name = String(req.params.name ?? '').replace(/\.png$/, '');
        if (!installed.includes(name)) {
            res.status(404).end();
            return;
        }
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.sendFile(`/var/www/images/${name}.png`, (err) => {
            if (err && !res.headersSent)
                res.status(404).end();
        });
    });
    router.post('/spotify-credentials', requireSession, requireCsrf, async (req, res) => {
        const body = (req.body ?? {});
        const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
        const clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret.trim() : '';
        if (clientId.length < 16 || clientId.length > 64 || !/^[A-Za-z0-9]+$/.test(clientId)) {
            res.status(400).json({ error: 'clientId must be 16-64 alphanumeric characters' });
            return;
        }
        if (clientSecret && (clientSecret.length < 16 || clientSecret.length > 64 || !/^[A-Za-z0-9]+$/.test(clientSecret))) {
            res.status(400).json({ error: 'clientSecret must be 16-64 alphanumeric characters when provided' });
            return;
        }
        await deps.updateMupiboxConfig((cfg) => {
            const spotify = (cfg.spotify ?? {});
            spotify.clientId = clientId;
            spotify.clientSecret = clientSecret;
            cfg.spotify = spotify;
        });
        res.json({ ok: true, mode: clientSecret ? 'classic' : 'pkce' });
    });
    router.get('/bluetooth', requireSession, async (_req, res) => {
        const show = await execCapture('sudo', ['-u', 'dietpi', 'bluetoothctl', 'show']);
        const powered = /Powered:\s*yes/i.test(show.stdout);
        const devices = [];
        if (powered) {
            const dev = await execCapture('sudo', ['-u', 'dietpi', 'bluetoothctl', 'devices']);
            const parsed = [];
            for (const line of dev.stdout.split('\n')) {
                const m = line.match(/^Device\s+([0-9A-Fa-f:]{17})\s+(.*)$/);
                if (m && BT_MAC_RE.test(m[1]))
                    parsed.push({ mac: m[1], name: m[2].trim() || m[1] });
            }
            for (const d of parsed) {
                const info = await execCapture('sudo', ['-u', 'dietpi', 'bluetoothctl', 'info', d.mac]);
                devices.push({ ...d, connected: /Connected:\s*yes/i.test(info.stdout) });
            }
        }
        const ac = await execCapture('systemctl', ['is-active', 'mupi_autoconnect_bt']);
        res.json({ powered, devices, autoconnect: ac.stdout.trim() === 'active' });
    });
    router.post('/bluetooth/power', requireSession, requireCsrf, async (req, res) => {
        const on = req.body?.on === true;
        const script = on ? 'start_bt.sh' : 'stop_bt.sh';
        const r = await execCapture('sudo', ['-u', 'dietpi', `/usr/local/bin/mupibox/${script}`], 15000);
        res.json({ ok: r.ok });
    });
    router.post('/bluetooth/scan', requireSession, requireCsrf, async (_req, res) => {
        await execCapture('sudo', ['-u', 'dietpi', '/usr/local/bin/mupibox/scan_bt.sh'], 30000);
        const found = [];
        try {
            const raw = readFileSync('/tmp/bt_scan', 'utf8');
            for (const line of raw.split('\n')) {
                const cols = line.split('\t');
                const mac = (cols[1] ?? '').trim();
                if (BT_MAC_RE.test(mac))
                    found.push({ mac, name: (cols[2] ?? '').trim() || mac });
            }
        }
        catch {
        }
        res.json({ ok: true, found });
    });
    router.post('/bluetooth/pair', requireSession, requireCsrf, async (req, res) => {
        const mac = String(req.body?.mac ?? '').trim();
        if (!BT_MAC_RE.test(mac)) {
            res.status(400).json({ error: 'invalid MAC' });
            return;
        }
        const r = await execCapture('sudo', ['-u', 'dietpi', '/usr/local/bin/mupibox/pair_bt.sh', mac], 30000);
        res.json({ ok: r.ok });
    });
    router.post('/bluetooth/remove', requireSession, requireCsrf, async (req, res) => {
        const mac = String(req.body?.mac ?? '').trim();
        if (!BT_MAC_RE.test(mac)) {
            res.status(400).json({ error: 'invalid MAC' });
            return;
        }
        await execCapture('sudo', ['-u', 'dietpi', '/usr/local/bin/mupibox/remove_bt.sh', mac], 15000);
        await execCapture('sudo', ['-u', 'dietpi', '/usr/local/bin/mupibox/stop_bt.sh'], 15000);
        await execCapture('sudo', ['-u', 'dietpi', '/usr/local/bin/mupibox/start_bt.sh'], 15000);
        res.json({ ok: true });
    });
    router.post('/bluetooth/autoconnect', requireSession, requireCsrf, async (req, res) => {
        const enable = req.body?.enable === true;
        if (enable) {
            await execCapture('sudo', ['systemctl', 'enable', 'mupi_autoconnect_bt']);
            await execCapture('sudo', ['systemctl', 'start', 'mupi_autoconnect_bt']);
        }
        else {
            await execCapture('sudo', ['systemctl', 'stop', 'mupi_autoconnect_bt']);
            await execCapture('sudo', ['systemctl', 'disable', 'mupi_autoconnect_bt']);
        }
        res.json({ ok: true });
    });
    router.get('/telegram-config', requireSession, (_req, res) => {
        const cfg = deps.getMupiboxConfig();
        const tg = cfg?.telegram ?? {};
        const rawChats = Array.isArray(tg.chatId) ? tg.chatId : [];
        const chatIds = rawChats
            .filter((c) => !!c && typeof c === 'object')
            .map((c) => ({ id: String(c.id ?? ''), label: String(c.label ?? '') }))
            .filter((c) => c.id);
        res.json({
            active: tg.active === true,
            token_configured: typeof tg.token === 'string' && tg.token.length > 0,
            chatIds,
        });
    });
    router.post('/telegram-config', requireSession, requireCsrf, async (req, res) => {
        const body = (req.body ?? {});
        let validatedChats;
        if (body.chatIds !== undefined) {
            if (!Array.isArray(body.chatIds)) {
                res.status(400).json({ error: 'chatIds must be an array' });
                return;
            }
            validatedChats = [];
            for (const c of body.chatIds) {
                if (!c || typeof c !== 'object') {
                    res.status(400).json({ error: 'each chatId must be an object {id,label}' });
                    return;
                }
                const id = String(c.id ?? '').trim();
                const label = String(c.label ?? '').trim();
                if (!/^-?\d{1,20}$/.test(id)) {
                    res.status(400).json({ error: `invalid chat id: ${id}` });
                    return;
                }
                validatedChats.push({ id, label: label.slice(0, 60) });
            }
        }
        let newToken;
        if (typeof body.token === 'string' && body.token.trim().length > 0) {
            const t = body.token.trim();
            if (!/^\d{6,12}:[A-Za-z0-9_-]{30,50}$/.test(t)) {
                res.status(400).json({ error: 'Bot-Token-Format sieht ungültig aus' });
                return;
            }
            newToken = t;
        }
        await deps.updateMupiboxConfig((cfg) => {
            const tg = (cfg.telegram ?? {});
            if (typeof body.active === 'boolean')
                tg.active = body.active;
            if (validatedChats !== undefined)
                tg.chatId = validatedChats;
            if (newToken !== undefined)
                tg.token = newToken;
            cfg.telegram = tg;
        });
        execFile('sudo', ['systemctl', 'restart', 'mupi_telegram'], { timeout: 15000 }, (err) => {
            if (err)
                console.warn(`${new Date().toLocaleString()}: [eltern] mupi_telegram restart failed: ${err.message}`);
        });
        res.json({ ok: true });
    });
    router.get('/system', requireSession, async (_req, res) => {
        let cpuTempC = null;
        try {
            const milli = Number.parseInt(readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim(), 10);
            if (Number.isFinite(milli))
                cpuTempC = Math.round(milli / 100) / 10;
        }
        catch {
        }
        let disk = null;
        try {
            const st = await fsp.statfs('/');
            disk = { total: st.blocks * st.bsize, free: st.bavail * st.bsize };
        }
        catch {
        }
        res.json({
            hostname: os.hostname(),
            uptime_seconds: Math.floor(os.uptime()),
            load_1: Math.round(os.loadavg()[0] * 100) / 100,
            cpu_count: os.cpus().length,
            mem_total: os.totalmem(),
            mem_free: os.freemem(),
            cpu_temp_c: cpuTempC,
            disk,
        });
    });
    router.post('/library/add-album', requireSession, requireCsrf, async (req, res) => {
        const body = req.body ?? {};
        const albumId = String(body.albumId ?? '').trim();
        if (!/^[A-Za-z0-9]{22}$/.test(albumId)) {
            res.status(400).json({ error: 'invalid albumId (expected 22-char Spotify id)' });
            return;
        }
        const allowed = ['audiobook', 'music', 'other'];
        const catRaw = String(body.category ?? '').trim();
        const category = allowed.includes(catRaw) ? catRaw : undefined;
        const name = String(body.name ?? '').trim().slice(0, 120);
        await deps.updateMupiboxConfig((cfg) => {
            const ss = (cfg.spotify_sync ?? {});
            const list = Array.isArray(ss.explicit_albums) ? ss.explicit_albums : [];
            if (!list.some((a) => a?.id === albumId)) {
                const entry = { id: albumId };
                if (name)
                    entry.name = name;
                if (category)
                    entry.category = category;
                list.push(entry);
            }
            ss.explicit_albums = list;
            cfg.spotify_sync = ss;
        });
        res.json({ ok: true });
    });
    router.post('/library/subscribe-artist', requireSession, requireCsrf, async (req, res) => {
        const body = req.body ?? {};
        const artistId = String(body.artistId ?? '').trim();
        if (!/^[A-Za-z0-9]{22}$/.test(artistId)) {
            res.status(400).json({ error: 'invalid artistId (expected 22-char Spotify id)' });
            return;
        }
        const name = String(body.name ?? '').trim().slice(0, 80);
        const allowed = ['audiobook', 'music', 'other'];
        const catRaw = String(body.category ?? '').trim();
        const category = allowed.includes(catRaw) ? catRaw : undefined;
        const toNum = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined);
        const rangeFrom = toNum(body.range_from);
        const rangeTo = toNum(body.range_to);
        await deps.updateMupiboxConfig((cfg) => {
            const ss = (cfg.spotify_sync ?? {});
            const list = Array.isArray(ss.artists) ? ss.artists : [];
            const existing = list.find((a) => a?.id === artistId);
            const preservedExclude = Array.isArray(existing?.exclude_album_ids)
                ? existing.exclude_album_ids.filter((x) => typeof x === 'string')
                : [];
            const entry = { id: artistId };
            if (name)
                entry.name = name;
            if (category)
                entry.category = category;
            if (rangeFrom !== undefined)
                entry.range_from = rangeFrom;
            if (rangeTo !== undefined)
                entry.range_to = rangeTo;
            if (preservedExclude.length)
                entry.exclude_album_ids = preservedExclude;
            if (existing) {
                for (const k of Object.keys(existing))
                    if (k !== 'id')
                        delete existing[k];
                Object.assign(existing, entry);
            }
            else {
                list.push(entry);
            }
            ss.artists = list;
            cfg.spotify_sync = ss;
        });
        res.json({ ok: true });
    });
    router.get('/library/subscriptions', requireSession, (_req, res) => {
        const ss = deps.getMupiboxConfig()?.spotify_sync ?? {};
        res.json({
            artists: Array.isArray(ss.artists) ? ss.artists : [],
            explicit_albums: Array.isArray(ss.explicit_albums) ? ss.explicit_albums : [],
        });
    });
    router.post('/library/unsubscribe-artist', requireSession, requireCsrf, async (req, res) => {
        const artistId = String(req.body?.artistId ?? '').trim();
        if (!artistId) {
            res.status(400).json({ error: 'artistId required' });
            return;
        }
        await deps.updateMupiboxConfig((cfg) => {
            const ss = (cfg.spotify_sync ?? {});
            ss.artists = (Array.isArray(ss.artists) ? ss.artists : []).filter((a) => a?.id !== artistId);
            cfg.spotify_sync = ss;
        });
        res.json({ ok: true });
    });
    router.post('/library/remove-album', requireSession, requireCsrf, async (req, res) => {
        const albumId = String(req.body?.albumId ?? '').trim();
        if (!albumId) {
            res.status(400).json({ error: 'albumId required' });
            return;
        }
        await deps.updateMupiboxConfig((cfg) => {
            const ss = (cfg.spotify_sync ?? {});
            ss.explicit_albums = (Array.isArray(ss.explicit_albums) ? ss.explicit_albums : []).filter((a) => a?.id !== albumId);
            cfg.spotify_sync = ss;
        });
        res.json({ ok: true });
    });
    router.post('/library/artist-exclude', requireSession, requireCsrf, async (req, res) => {
        const body = req.body ?? {};
        const artistId = String(body.artistId ?? '').trim();
        const albumId = String(body.albumId ?? '').trim();
        if (!/^[A-Za-z0-9]{22}$/.test(artistId) || !/^[A-Za-z0-9]{22}$/.test(albumId)) {
            res.status(400).json({ error: 'invalid artistId/albumId (expected 22-char Spotify ids)' });
            return;
        }
        const excluded = body.excluded === true || body.excluded === 'true';
        const cur = deps.getMupiboxConfig()?.spotify_sync ?? {};
        const curArtists = Array.isArray(cur.artists) ? cur.artists : [];
        if (!curArtists.some((a) => a?.id === artistId)) {
            res.status(404).json({ error: 'artist not subscribed' });
            return;
        }
        await deps.updateMupiboxConfig((cfg) => {
            const ss = (cfg.spotify_sync ?? {});
            const list = Array.isArray(ss.artists) ? ss.artists : [];
            const sub = list.find((a) => a?.id === artistId);
            if (!sub)
                return;
            const ex = new Set(Array.isArray(sub.exclude_album_ids)
                ? sub.exclude_album_ids.filter((x) => typeof x === 'string')
                : []);
            if (excluded)
                ex.add(albumId);
            else
                ex.delete(albumId);
            if (ex.size)
                sub.exclude_album_ids = [...ex];
            else
                delete sub.exclude_album_ids;
            ss.artists = list;
            cfg.spotify_sync = ss;
        });
        res.json({ ok: true });
    });
    return router;
}
export function buildElternLandingHandler() {
    return (req, res, next) => {
        const token = typeof req.query.token === 'string' ? req.query.token : '';
        if (!token) {
            next();
            return;
        }
        const ip = req.ip ?? req.socket.remoteAddress ?? '';
        const session = redeemMagicLink(token, ip);
        if (!session) {
            res.status(401).send('Magic-Link ungültig oder abgelaufen');
            return;
        }
        res.setHeader('Set-Cookie', buildSessionCookie(session.sessionId, 24 * 60 * 60));
        res.redirect('/eltern');
    };
}
//# sourceMappingURL=routes.js.map