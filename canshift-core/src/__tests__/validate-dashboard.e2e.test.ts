import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SignalConfig } from '../schemas/signal.js'
import { validateDashboard } from '../validation/validate-dashboard.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIRMWARE_CONFIG_DIR = resolve(HERE, '../../../canshift-firmware/data/config')

const loadJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(resolve(FIRMWARE_CONFIG_DIR, relativePath), 'utf8'))

describe('validateDashboard — firmware demo regression', () => {
  it('accepts canshift-firmware/data/config/dashboard.json with the canonical signals catalog', () => {
    const dashboard = loadJson('dashboard.json')
    const signalCatalog = loadJson('signals.json') as SignalConfig

    const result = validateDashboard(dashboard, { signalCatalog })

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)

    const crossRefWarnings = result.warnings.filter((w) =>
      w.includes('not defined in config.signals')
    )
    expect(crossRefWarnings).toEqual([])
  })
})
