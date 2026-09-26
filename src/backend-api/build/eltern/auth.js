import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import * as fs from 'node:fs';
import { promisify } from 'node:util';
const scryptAsync = promisify(scryptCb);
const MAGIC_LINKS_PATH = '/tmp/.eltern_magic_links.json';
const SESSIONS_PATH = '/tmp/.eltern_sessions.json';
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;
let magicLinksCache = null;
let sessionsCache = null;
function readMap(path) {
    try {
        if (!fs.existsSync(path))
            return {};
        const raw = fs.readFileSync(path, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
function writeMap(path, map) {
    const tmp = `${path}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(map), 'utf8');
    fs.renameSync(tmp, path);
}
function loadMagicLinks() {
    if (magicLinksCache === null)
        magicLinksCache = readMap(MAGIC_LINKS_PATH);
    return magicLinksCache;
}
function loadSessions() {
    if (sessionsCache === null)
        sessionsCache = readMap(SESSIONS_PATH);
    return sessionsCache;
}
function saveMagicLinks() {
    if (magicLinksCache)
        writeMap(MAGIC_LINKS_PATH, magicLinksCache);
}
function saveSessions() {
    if (sessionsCache)
        writeMap(SESSIONS_PATH, sessionsCache);
}
function purgeExpiredMagicLinks(now = Date.now()) {
    const links = loadMagicLinks();
    let touched = false;
    for (const [token, entry] of Object.entries(links)) {
        if (now - Date.parse(entry.issued) > MAGIC_LINK_TTL_MS) {
            delete links[token];
            touched = true;
        }
    }
    if (touched)
        saveMagicLinks();
}
function purgeExpiredSessions(now = Date.now()) {
    const sessions = loadSessions();
    let touched = false;
    for (const [id, entry] of Object.entries(sessions)) {
        if (now - Date.parse(entry.issued) > SESSION_TTL_MS) {
            delete sessions[id];
            touched = true;
        }
    }
    if (touched)
        saveSessions();
}
export function generateMagicLink(source) {
    purgeExpiredMagicLinks();
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const links = loadMagicLinks();
    links[token] = {
        issued: new Date().toISOString(),
        used: false,
        source,
    };
    magicLinksCache = links;
    saveMagicLinks();
    return { token, expiresIn: Math.floor(MAGIC_LINK_TTL_MS / 1000) };
}
export function issueSession(ip) {
    const sessions = loadSessions();
    const sessionId = randomBytes(TOKEN_BYTES).toString('hex');
    const csrf = randomBytes(TOKEN_BYTES).toString('hex');
    const nowIso = new Date().toISOString();
    sessions[sessionId] = {
        issued: nowIso,
        lastSeen: nowIso,
        ip,
        csrf,
    };
    sessionsCache = sessions;
    saveSessions();
    return { sessionId, csrf };
}
export function redeemMagicLink(token, ip) {
    purgeExpiredMagicLinks();
    const links = loadMagicLinks();
    const entry = links[token];
    if (!entry || entry.used)
        return null;
    entry.used = true;
    saveMagicLinks();
    return issueSession(ip);
}
export function validateSession(sessionId) {
    if (!sessionId)
        return null;
    purgeExpiredSessions();
    const sessions = loadSessions();
    const entry = sessions[sessionId];
    if (!entry)
        return null;
    entry.lastSeen = new Date().toISOString();
    sessionsCache = sessions;
    return entry;
}
export function destroySession(sessionId) {
    if (!sessionId)
        return;
    const sessions = loadSessions();
    if (sessions[sessionId]) {
        delete sessions[sessionId];
        sessionsCache = sessions;
        saveSessions();
    }
}
export const SESSION_COOKIE = 'mupibox_eltern_session';
export const CSRF_HEADER = 'x-mupibox-csrf';
export const MAGIC_LINK_PATH = '/eltern';
const SCRYPT_KEY_LEN = 32;
const SCRYPT_SALT_BYTES = 16;
const MIN_PASSWORD_LENGTH = 4;
function readPasswordEntry(mupibox) {
    const e = mupibox?.eltern?.password;
    if (!e || typeof e.salt !== 'string' || typeof e.hash !== 'string' || !e.salt || !e.hash)
        return undefined;
    return { salt: e.salt, hash: e.hash };
}
export function hasElternPassword(mupibox) {
    return readPasswordEntry(mupibox) !== undefined;
}
export async function verifyElternPassword(plain, mupibox) {
    const entry = readPasswordEntry(mupibox);
    if (!entry)
        return false;
    try {
        const salt = Buffer.from(entry.salt, 'hex');
        const expected = Buffer.from(entry.hash, 'hex');
        if (expected.length === 0 || salt.length === 0)
            return false;
        const candidate = (await scryptAsync(plain, salt, expected.length));
        return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    }
    catch {
        return false;
    }
}
export async function setElternPassword(plain, updateMupiboxConfig) {
    const trimmed = plain.trim();
    if (!trimmed) {
        await updateMupiboxConfig((cfg) => {
            const e = (cfg.eltern ?? {});
            delete e.password;
            cfg.eltern = e;
        });
        return;
    }
    const salt = randomBytes(SCRYPT_SALT_BYTES);
    const hash = (await scryptAsync(trimmed, salt, SCRYPT_KEY_LEN));
    const entry = { salt: salt.toString('hex'), hash: hash.toString('hex') };
    await updateMupiboxConfig((cfg) => {
        const e = (cfg.eltern ?? {});
        e.password = entry;
        cfg.eltern = e;
    });
}
export const ELTERN_PASSWORD_MIN_LENGTH = MIN_PASSWORD_LENGTH;
//# sourceMappingURL=auth.js.map