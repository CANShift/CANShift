// sim.service.ts — Simulated device for UI development without hardware
//
// Mimics BLE telemetry: generates synthetic engine values that cycle over time.
// Call start() to enter sim mode; stop() to exit.

import { useDeviceStore } from '../stores/device.store'
import { useSignalsStore } from '../stores/signals.store'
import { clearBuffer } from '../stores/telemetry.store'
import { log } from '../stores/log.store'
import { parseTelemetry } from './ble.validators'

let tickInterval: ReturnType<typeof setInterval> | null = null
let elapsed = 0 // seconds since sim start

// Realistic value generators
const rpm = (t: number) => Math.round(800 + 4200 * Math.abs(Math.sin(t / 12)))
const speed = (r: number) => Math.round(r * 0.028)
const gear = (r: number) => {
  if (r < 1200) return 1
  if (r < 2000) return 2
  if (r < 3000) return 3
  if (r < 4200) return 4
  return 5
}
const rand = (base: number, range: number) => base + (Math.random() - 0.5) * range

export function start() {
  const { setDevice, setFirmwareStatus, setMode } = useDeviceStore.getState()
  setDevice('SIM', 'CANShift (sim)')
  setFirmwareStatus('sim', true)
  setMode('sim')
  clearBuffer()
  log('info', 'Simulation mode started')

  elapsed = 0
  tickInterval = setInterval(() => {
    elapsed += 0.1
    const r = rpm(elapsed)
    const s = speed(r)
    const g = gear(r)
    const tps = Math.round(Math.abs(Math.sin(elapsed / 8)) * 100)

    // Route through parseTelemetry so sim samples go through the same
    // allowlist + finite-number validation as real BLE telemetry. Keeps the
    // two producers in lockstep — any future SIGNAL_META addition surfaces
    // here without a parallel sim-side change (#783).
    const sample = {
      r,
      s,
      g,
      tps,
      ct: Math.round(rand(88, 4)),
      ot: Math.round(rand(95, 6)),
      op: parseFloat(rand(4.2, 0.4).toFixed(1)),
      lam: parseFloat(rand(1.0, 0.06).toFixed(2)),
      bat: parseFloat(rand(13.8, 0.4).toFixed(1)),
      bst: parseFloat((tps > 50 ? rand(0.8, 0.2) : rand(0.0, 0.05)).toFixed(2)),
      iat: Math.round(rand(35, 4)),
    }
    const payload = parseTelemetry(JSON.stringify(sample))
    if (!payload) {
      log('warn', 'sim: rejected malformed telemetry payload')
      return
    }
    useSignalsStore.getState().update(payload)
  }, 100)
}

export function stop() {
  if (tickInterval) {
    clearInterval(tickInterval)
    tickInterval = null
  }
  useDeviceStore.getState().disconnect()
  useSignalsStore.getState().markStale()
  // Drop synthetic history so the next real BLE connection's GraphScreen
  // does not plot real signals on top of stale sim samples (#686).
  clearBuffer()
  log('info', 'Simulation mode stopped')
}

export function isRunning() {
  return tickInterval !== null
}
