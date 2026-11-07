// The background program of the demo, started by the systemd service of the extension (units/mpx-unit-demo.service).
// It runs as the user of the box and writes a small file every 10 seconds; the API part of the extension (api.js) reads it.

const fs = require('node:fs')
const path = require('node:path')

const FILE = path.join(__dirname, 'heartbeat.json')
const EVERY_MS = 10 * 1000
const startedAt = new Date().toISOString()
let beats = 0

function beat() {
  beats += 1
  const body = { pid: process.pid, startedAt, lastBeat: new Date().toISOString(), beats }
  try {
    // (written whole into a new file and renamed: the API never reads half a file)
    fs.writeFileSync(`${FILE}.new`, JSON.stringify(body))
    fs.renameSync(`${FILE}.new`, FILE)
  } catch (error) {
    console.error(`unit-demo: cannot write the heartbeat: ${error.message}`)
  }
  // (a line in the journal now and then: journalctl -u mpx-unit-demo)
  if (beats === 1 || beats % 6 === 0) console.log(`unit-demo: alive, ${beats} beats since ${startedAt}`)
}

beat()
const timer = setInterval(beat, EVERY_MS)
// (stopped by systemd with SIGTERM: leave quietly)
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    clearInterval(timer)
    process.exit(0)
  })
}
