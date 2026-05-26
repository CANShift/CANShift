// scripts/mock-ws.mjs — Local WS server that impersonates the firmware so the
// renderer can be exercised end-to-end without flashing hardware.
//
// Mirrors the wire-protocol surface of `canshift-firmware/src/hal/wifi/wifi_ws.cpp`:
// text frames, JSON objects, NO trailing `\n`. Single client policy is
// enforced the same way (refusal frame `single-client only` then close).
//
// Usage
// -----
//   npm run dev:mock      # boots this script on ws://127.0.0.1:8181/
//   npm run dev           # then point the connect screen at 127.0.0.1:8181
//
// The script depends on the `ws` package (added as a devDependency). Kept
// out of the production bundle — strictly a Node.js dev harness.

import { WebSocketServer } from 'ws'
import { argv } from 'node:process'
import { performance } from 'node:perf_hooks'

const PORT = Number.parseInt(getArg('--port') ?? '8181', 10)
const HOST = getArg('--host') ?? '127.0.0.1'

const wss = new WebSocketServer({ host: HOST, port: PORT })
let activeClient = null

console.log(`[mock-ws] listening on ws://${HOST}:${String(PORT)}/`)

wss.on('connection', (socket, req) => {
  const remote = req.socket.remoteAddress ?? 'unknown'
  if (activeClient) {
    console.log(`[mock-ws] refusing extra client from ${remote}`)
    try {
      socket.send('single-client only')
    } catch {
      // Ignore — peer may be gone already.
    }
    socket.close()
    return
  }
  activeClient = socket
  console.log(`[mock-ws] client connected (${remote})`)

  socket.on('message', (raw) => {
    handleFrame(socket, raw.toString('utf-8'))
  })

  socket.on('close', () => {
    if (activeClient === socket) activeClient = null
    console.log('[mock-ws] client disconnected')
  })

  // Boot log line so the renderer's log surface sees something on connect.
  socket.send(jsonFrame({ log: 1, lvl: 'I', tag: 'BOOT', msg: 'mock dash online' }))
})

// ---------------------------------------------------------------------------
// Telemetry simulator — oscillates a few canned signals on a fixed cadence
// so the live-signal hooks in the editor light up.
// ---------------------------------------------------------------------------

const SIGNAL_NAMES = ['rpm', 'coolant_temp', 'speed', 'oil_pressure', 'throttle']
const SIGNAL_RANGES = {
  rpm: [0, 8000],
  coolant_temp: [60, 110],
  speed: [0, 220],
  oil_pressure: [1, 6],
  throttle: [0, 100],
}
const START = performance.now()

setInterval(() => {
  if (!activeClient) return
  const t = (performance.now() - START) / 1000
  const values = {}
  SIGNAL_NAMES.forEach((name, i) => {
    const [min, max] = SIGNAL_RANGES[name]
    const period = 6 + i * 1.5
    const pct = (Math.sin((t * 2 * Math.PI) / period + i * 1.3) + 1) / 2
    values[name] = +(min + pct * (max - min)).toFixed(2)
  })
  try {
    activeClient.send(jsonFrame({ tele: 1, v: values }))
  } catch {
    // Socket may have closed mid-send — next tick will skip.
  }
}, 200)

setInterval(() => {
  if (!activeClient) return
  try {
    activeClient.send(
      jsonFrame({ can_stat: 1, fps: 60 + Math.round(Math.random() * 4), errors: 0 })
    )
  } catch {
    // Best-effort emit.
  }
}, 2000)

// ---------------------------------------------------------------------------
// Command dispatch
// ---------------------------------------------------------------------------

function handleFrame(socket, raw) {
  if (!raw) return
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    socket.send(jsonFrame({ status: 'error', message: 'bad_json' }))
    return
  }
  const cmd = parsed?.cmd
  switch (cmd) {
    case 0x01: // get-config
      socket.send(jsonFrame({ status: 'ok', config: DEMO_CONFIG }))
      return
    case 0x02: // push-config
      console.log('[mock-ws] push-config received (size:', JSON.stringify(parsed.payload).length, 'bytes)')
      socket.send(jsonFrame({ status: 'ok' }))
      return
    case 0x03: // get-device-config
      socket.send(jsonFrame({ status: 'ok', device_config: DEMO_DEVICE_CONFIG }))
      return
    case 0x04: // put-device-config
      console.log('[mock-ws] put-device-config received:', parsed.device_config)
      socket.send(jsonFrame({ status: 'ok' }))
      return
    case 0x05: // screen-settings
      console.log('[mock-ws] screen-settings:', parsed)
      socket.send(jsonFrame({ status: 'ok' }))
      return
    case 0x07: // toggle day/night
      socket.send(jsonFrame({ status: 'ok' }))
      return
    case 0x08: // calibrate
      socket.send(jsonFrame({ status: 'ok' }))
      return
    case 0x09: // set day
      console.log('[mock-ws] set day:', parsed.day)
      socket.send(jsonFrame({ status: 'ok' }))
      return
    case 0x0b: // get-input-bindings
      socket.send(jsonFrame({ status: 'ok', input_bindings: DEMO_INPUT_BINDINGS.input_bindings }))
      return
    case 0x0c: // put-input-bindings
      console.log('[mock-ws] put-input-bindings received:', parsed.input_bindings)
      socket.send(jsonFrame({ status: 'ok' }))
      return
    case 0x10: // query-version
      socket.send(jsonFrame({ status: 'ok', version: '0.0.0-mock', is_day: 0 }))
      return
    case 0x20: // can-scan start
    case 0x21: // can-scan stop
      socket.send(jsonFrame({ status: 'ok' }))
      return
    case 0xf0: // reboot
      socket.send(jsonFrame({ status: 'ok' }))
      setTimeout(() => {
        socket.close()
      }, 50)
      return
    default:
      socket.send(jsonFrame({ status: 'error', message: `unknown_cmd:${String(cmd)}` }))
  }
}

function jsonFrame(obj) {
  return JSON.stringify(obj)
}

function getArg(flag) {
  const idx = argv.indexOf(flag)
  if (idx === -1) return null
  return argv[idx + 1] ?? null
}

// Minimal canned dashboard config — just enough structure for the editor to
// mount with a single page and one widget. Schema lives in canshift-core; we
// stay deliberately small here so the mock is approachable.
const DEMO_CONFIG = {
  version: '1.3.0',
  pages: [
    {
      id: 'p1',
      name: 'Mock Page',
      isDefault: true,
      showTopBar: true,
      backgroundColor: '#000000',
      widgets: [],
    },
  ],
  signals: SIGNAL_NAMES.map((name) => ({
    name,
    canFrameId: 0,
    bitStart: 0,
    bitLength: 8,
    scale: 1,
    offset: 0,
    min: SIGNAL_RANGES[name][0],
    max: SIGNAL_RANGES[name][1],
    unit: '',
    isLittleEndian: true,
    isSigned: false,
  })),
  topBar: { layout: 'minimal' },
}

// Canned ESP32 hardware config served by CMD_GET_DEVICE_CONFIG (snake_case
// wire shape, mirrors `/config/device.json` on a real device).
const DEMO_DEVICE_CONFIG = {
  can_speed_kbps: 500,
  twai_tx_pin: 22,
  twai_rx_pin: 21,
}

// Canned input bindings served by CMD_GET_INPUT_BINDINGS. Empty by default so
// the editor mounts the "no bindings yet" state cleanly.
const DEMO_INPUT_BINDINGS = {
  input_bindings: [],
}
