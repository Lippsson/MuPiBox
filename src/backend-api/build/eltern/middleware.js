import { CSRF_HEADER, SESSION_COOKIE, validateSession } from './auth';
function isPrivateIp(ip) {
    const v = ip.replace(/^::ffff:/, '');
    if (v === '127.0.0.1' || v === '::1' || v === 'localhost')
        return true;
    if (v.startsWith('10.'))
        return true;
    if (v.startsWith('192.168.'))
        return true;
    if (v.startsWith('172.')) {
        const second = Number.parseInt(v.split('.')[1] ?? '0', 10);
        if (second >= 16 && second <= 31)
            return true;
    }
    if (v.startsWith('169.254.'))
        return true;
    if (v.startsWith('fe80:'))
        return true;
    if (v.startsWith('fd') || v.startsWith('fc'))
        return true;
    return false;
}
export const localNetworkOnly = (req, res, next) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? '';
    if (!isPrivateIp(ip)) {
        console.warn(`${new Date().toLocaleString()}: [eltern] rejecting WAN access from ${ip}`);
        res.status(403).json({ error: 'local network only' });
        return;
    }
    next();
};
function parseCookie(req, name) {
    const header = req.headers.cookie;
    if (!header)
        return undefined;
    for (const part of header.split(';')) {
        const trimmed = part.trim();
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 0)
            continue;
        if (trimmed.slice(0, eqIdx) === name) {
            return trimmed.slice(eqIdx + 1);
        }
    }
    return undefined;
}
export const requireSession = (req, res, next) => {
    const sessionId = parseCookie(req, SESSION_COOKIE);
    const session = validateSession(sessionId);
    if (!session) {
        res.status(401).json({ error: 'unauthenticated' });
        return;
    }
    req.elternSessionId = sessionId;
    req.elternSessionCsrf = session.csrf;
    next();
};
export const requireCsrf = (req, res, next) => {
    const headerToken = req.headers[CSRF_HEADER];
    if (typeof headerToken !== 'string' || headerToken !== req.elternSessionCsrf) {
        res.status(403).json({ error: 'csrf token missing or invalid' });
        return;
    }
    next();
};
const buckets = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
export function ipRateLimit(maxPerMin = RATE_LIMIT_MAX) {
    return (req, res, next) => {
        const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        const now = Date.now();
        const bucket = buckets.get(ip);
        if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
            buckets.set(ip, { count: 1, windowStart: now });
            next();
            return;
        }
        bucket.count++;
        if (bucket.count > maxPerMin) {
            res.status(429).json({ error: 'rate limited', retry_after_seconds: 60 });
            return;
        }
        next();
    };
}
export function startBucketCleanup() {
    setInterval(() => {
        const now = Date.now();
        for (const [ip, bucket] of buckets) {
            if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
                buckets.delete(ip);
            }
        }
    }, RATE_LIMIT_WINDOW_MS).unref?.();
}
export function _noop(_next, _res) {
}
//# sourceMappingURL=middleware.js.map