import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SignalConfigSchema } from '../schemas/signal.js'
import { validateSignalConfig } from '../validation/validate-signal-config.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../..')
const SIGNALS_JSON_PATH = resolve(REPO_ROOT, 'canshift-firmware/data/config/signals.json')

const loadFirmwareSignals = (): unknown =>
  JSON.parse(readFileSync(SIGNALS_JSON_PATH, 'utf8')) as unknown

describe('bundled fixture — canshift-firmware/data/config/signals.json (#1303)', () => {
  const signals = loadFirmwareSignals()

  it('validates clean via validateSignalConfig', () => {
    const result = validateSignalConfig(signals)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('parses successfully via SignalConfigSchema.safeParse', () => {
    const result = SignalConfigSchema.safeParse(signals)
    expect(result.success).toBe(true)
  })

  it('preserves the out.map_switch override after parsing', () => {
    const result = SignalConfigSchema.safeParse(signals)
    if (!result.success) throw new Error('fixture failed to parse')
    expect(result.data.out?.map_switch?.id).toBe('0x600')
    expect(result.data.out?.map_switch?.extended).toBe(false)
  })

  it('preserves the battery_volts _batteryThresholds documentation string', () => {
    const result = SignalConfigSchema.safeParse(signals)
    if (!result.success) throw new Error('fixture failed to parse')
    const battery = result.data.signals.find((s) => s.name === 'battery_volts')
    expect(battery?._batteryThresholds).toMatch(/Battery uses BOTH low-side/)
  })
})
