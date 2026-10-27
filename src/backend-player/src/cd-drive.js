// The CD drive: is there an audio CD in it, and how many tracks? The display shows a "CD" category while there is one.
//
// The drive is asked with the kernel's own ioctls (through a few lines of Python, as Node has no ioctl): the state of
// the drive (CDROM_DRIVE_STATUS) is a cheap question that does not spin the disc up, so it is asked every few seconds;
// what is on the disc (type and number of tracks, which reads the table of contents) only once when a disc has come in.
// The watcher itself is plain logic over a `probe` function, so it runs in a test without a drive.

const { execFile } = require('node:child_process')

const DEVICE = process.env.MUPIBOX_CD_DEVICE || '/dev/sr0'
const POLL_MS = 3000

// CDROM_DRIVE_STATUS 0x5326: 1 no disc, 2 tray open, 3 not ready (spinning up), 4 disc ok;
// CDROM_DISC_STATUS 0x5327: 100 audio, 101-104 data, 105 mixed; CDROMREADTOCHDR 0x5305: first and last track
const PROBE_PY = `
import fcntl, json, os, struct, sys
dev, full = sys.argv[1], sys.argv[2] == "1"
try:
    fd = os.open(dev, os.O_RDONLY | os.O_NONBLOCK)
except FileNotFoundError:
    print(json.dumps({"drive": "nodrive"})); sys.exit(0)
except PermissionError:
    print(json.dumps({"drive": "noaccess"})); sys.exit(0)
except OSError as e:
    print(json.dumps({"drive": "error", "errno": e.errno})); sys.exit(0)
status = fcntl.ioctl(fd, 0x5326, 0)
out = {"drive": {1: "none", 2: "open", 3: "notready", 4: "ok"}.get(status, "error")}
if full and status == 4:
    disc = fcntl.ioctl(fd, 0x5327, 0)
    out["disc"] = "audio" if disc == 100 else "mixed" if disc == 105 else "data" if 101 <= disc <= 104 else "unknown"
    if out["disc"] == "audio":
        hdr = fcntl.ioctl(fd, 0x5305, bytes(2))
        out["first"], out["last"] = hdr[0], hdr[1]
        out["tracks"] = hdr[1] - hdr[0] + 1
        # where each track starts (seconds from the start of the first track; the last entry is the end of the disc) -
        # mpv plays the disc as one file with a chapter per track and tells the time of the whole disc
        def lba(track):
            buf = bytearray(12)
            buf[0] = track
            buf[2] = 1  # CDROM_LBA
            return struct.unpack_from("<i", fcntl.ioctl(fd, 0x5306, bytes(buf)), 4)[0]
        try:
            marks = [lba(t) for t in range(hdr[0], hdr[1] + 1)] + [lba(0xAA)]
            out["starts"] = [round((m - marks[0]) / 75.0, 3) for m in marks]
        except OSError:
            pass
print(json.dumps(out))
`

/** One question to the drive; resolves to what the script printed ({ drive, disc?, tracks? }), never rejects. */
function probeDevice(device = DEVICE, full = false) {
  return new Promise((resolve) => {
    execFile('python3', ['-c', PROBE_PY, device, full ? '1' : '0'], { timeout: 8000 }, (err, stdout) => {
      if (err) return resolve({ drive: 'error' })
      try {
        resolve(JSON.parse(String(stdout).trim()))
      } catch {
        resolve({ drive: 'error' })
      }
    })
  })
}

/** What the display is told: an audio CD with its tracks, or nothing. */
const NO_CD = Object.freeze({ present: false, tracks: 0, id: 0 })
// (a state also carries `starts`: the start of each track in seconds and the end of the disc, when the drive told them)

/**
 * Watches the drive. `probe(full)` answers as probeDevice does; `onChange(state)` gets { present, tracks, id } whenever it
 * changes (id counts up with every disc that comes in, so a swapped disc is a new one). `fixAccess()` is called when the
 * drive cannot be opened (a drive that is not readable by this user); it may make it readable, the next question tells.
 */
function createCdWatcher({ probe = (full) => probeDevice(DEVICE, full), onChange = () => {}, intervalMs = POLL_MS, fixAccess = () => {} } = {}) {
  let state = NO_CD
  let lastDrive = 'unknown'
  let discs = 0
  let timer = null
  let busy = false
  let lastFix = 0
  let skipped = 0

  const set = (next) => {
    if (next.present === state.present && next.tracks === state.tracks && next.id === state.id) return
    state = next
    onChange(state)
  }

  async function tick() {
    if (busy) return
    // (a box without a drive, or without Python: asked only every tenth time - a drive may be plugged in later)
    if ((lastDrive === 'nodrive' || lastDrive === 'error') && ++skipped % 10 !== 0) return
    busy = true
    try {
      const quick = await probe(false)
      if (quick.drive === 'noaccess') {
        if (Date.now() - lastFix > 30000) {
          lastFix = Date.now()
          fixAccess()
        }
      }
      if (quick.drive !== 'ok') {
        // no disc, tray open, spinning up, no drive: nothing to play
        lastDrive = quick.drive
        if (quick.drive !== 'notready') set(NO_CD)
        return
      }
      // a disc is in: its contents are read when it has just come in (or when the drive was not seen before)
      if (lastDrive !== 'ok') {
        const full = await probe(true)
        lastDrive = full.drive
        if (full.drive === 'ok' && full.disc === 'audio' && full.tracks > 0) {
          discs++
          set({ present: true, tracks: full.tracks, id: discs, ...(Array.isArray(full.starts) ? { starts: full.starts } : {}) })
        } else if (full.drive === 'ok') {
          // a data disc, a blank one: nothing this player plays (it is asked again only when the disc is changed)
          set(NO_CD)
        }
      }
    } finally {
      busy = false
    }
  }

  return {
    start() {
      if (timer) return
      timer = setInterval(() => void tick(), intervalMs)
      timer.unref?.()
      void tick()
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    tick,
    get state() {
      return state
    },
  }
}

module.exports = { createCdWatcher, probeDevice, NO_CD, DEVICE, POLL_MS }
