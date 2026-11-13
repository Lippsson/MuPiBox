// NFC-Reader - the API part (runs in the server of the box): starts the driver of the reader (pn5180.py, Python: Node has no way to
// speak SPI), keeps what it reports and tells the app on the settings page what it sees.
//
//   settings (which reader, which pins)  ->  logic.js
//   the driver program                   ->  runner.js, pn5180.py
//   the status block of the app          ->  GET /api/ext/nfc/state
//
// First step: the reader works and shows the tags it reads. What a tag starts (an album, say) comes next: it hooks in at the
// 'tag' and 'gone' reports in onEvent below.
'use strict'

const path = require('node:path')
const { readConfig, driverArgs, statusRows } = require('./logic.js')
const { createRunner, headerChipNumber, detect } = require('./runner.js')

exports.activate = (host) => {
  const log = host.log ?? console
  const dir = host.dir ?? __dirname
  let runner = null
  let config = readConfig({})
  let view = null
  const history = []

  const fresh = () => ({ config, phase: config.reader === 'none' || config.problem ? 'off' : 'starting', firmware: null, product: null, errorCode: null, inField: false, last: null })
  view = fresh()

  const onEvent = (event) => {
    switch (event.event) {
      case 'starting':
        view.phase = 'starting'
        break
      case 'ready':
        Object.assign(view, { phase: 'ready', firmware: event.firmware, product: event.product, errorCode: null })
        log.info(`[nfc] PN5180 ready (firmware ${event.firmware}, product ${event.product})`)
        break
      case 'tag':
        view.inField = true
        view.last = { tech: event.tech, uid: event.uid, at: Date.now() }
        history.push(view.last)
        if (history.length > 20) history.shift()
        log.info(`[nfc] tag ${event.uid} (${event.tech})`)
        break
      case 'gone':
        view.inField = false
        break
      case 'error':
        view.phase = 'error'
        view.errorCode = event.code
        log.warn(`[nfc] reader: ${event.code}: ${event.message}`)
        break
      default:
    }
  }

  // (one change after the other: the pins and the SPI device of the settings before are free before the new ones are taken)
  let chain = Promise.resolve()
  const apply = (settings) => {
    chain = chain
      .then(async () => {
        if (runner) await runner.stop()
        runner = null
        config = readConfig(settings)
        view = fresh()
        if (config.reader === 'none') return
        if (config.problem) {
          log.warn(`[nfc] not started: ${config.problem}`)
          return
        }
        const chip = headerChipNumber(await detect())
        runner = createRunner({
          command: 'python3',
          args: [path.join(dir, 'pn5180.py'), ...driverArgs(config, chip)],
          onEvent,
          onEnd: (reason) => {
            // (the driver says what is wrong before it ends; if it did not - it fell over - this is all there is to say)
            if (view.phase !== 'error') Object.assign(view, { phase: 'error', errorCode: 'other' })
            view.inField = false
            log.warn(`[nfc] reader program: ${reason}`)
          },
          log,
        })
        runner.start()
        log.info(`[nfc] reader PN5180 on SPI ${config.spi}, BUSY GPIO ${config.busy}, RST GPIO ${config.reset} (${config.tech})`)
      })
      .catch((error) => log.warn(`[nfc] not started: ${error?.message ?? error}`))
    return chain
  }
  // (the server ends: the driver must not stay behind and hold the pins and the SPI device)
  process.once('exit', () => runner?.kill())
  if (typeof host.onSettings === 'function') host.onSettings(apply)
  Promise.resolve(host.settings()).then(apply)

  // What the app shows on the settings page, and for a look from the outside what was read last (with the login of the parents)
  host.route(
    'get',
    '/state',
    (_req, res) => {
      res.json({ rows: statusRows(view), reader: { ...view, config: undefined, reader: config.reader }, process: runner ? runner.state() : null, history })
    },
    { session: true },
  )
}
