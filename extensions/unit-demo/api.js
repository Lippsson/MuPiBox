// The demo, API part: GET /api/ext/unit-demo/status tells whether the background program (daemon.js, started by the systemd service of
// the extension) is alive, from the heartbeat file it writes.
//   -> { running, pid, startedAt, lastBeat, beats }   (running: the last beat is less than 30 seconds old)

const fs = require('node:fs')
const path = require('node:path')

const ALIVE_MS = 30 * 1000

/** The state from the heartbeat file in `dir` (no file or no sense in it: not running). */
function status(dir, now = Date.now()) {
  let beat
  try {
    beat = JSON.parse(fs.readFileSync(path.join(dir, 'heartbeat.json'), 'utf8'))
  } catch {
    return { running: false }
  }
  const last = Date.parse(beat?.lastBeat)
  return { running: Number.isFinite(last) && now - last < ALIVE_MS, pid: beat?.pid ?? null, startedAt: beat?.startedAt ?? null, lastBeat: beat?.lastBeat ?? null, beats: beat?.beats ?? 0 }
}

exports.status = status
exports.activate = (host) => {
  host.route('get', '/status', (_req, res) => {
    res.set('Cache-Control', 'no-store').json(status(host.dir))
  })
}
