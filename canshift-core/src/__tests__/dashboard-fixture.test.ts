// dashboard-fixture.test.ts — pinned drift guard against bundled firmware dashboards
//
// Loads the dashboard.json shipped with the firmware (data/config) and asserts
// it validates clean against the canonical signal catalog and is already at
// CURRENT_SCHEMA_VERSION. This is the automated guard requested in issue #265:
// future TS field additions cannot slip past without breaking the fixture or
// being matched by a migration step.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CURRENT_SCHEMA_VERSION } from '../index.js'
import { migrateConfig } from '../migrations/migration-runner.js'
import type { SignalConfig } from '../schemas/signal.js'
import { validateDashboard } from '../validation/validate-dashboard.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../..')

interface Fixture {
  label: string
  dashboardPath: string
  signalsPath: string
}

const FIXTURES: Fixture[] = [
  {
    label: 'canshift-firmware/data/config/dashboard.json',
    dashboardPath: resolve(REPO_ROOT, 'canshift-firmware/data/config/dashboard.json'),
    signalsPath: resolve(REPO_ROOT, 'canshift-firmware/data/config/signals.json'),
  },
]

function loadJson(absolutePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as Record<string, unknown>
}

describe.each(FIXTURES)('bundled fixture — $label', ({ dashboardPath, signalsPath }) => {
  const dashboard = loadJson(dashboardPath)
  const signalCatalog = loadJson(signalsPath) as unknown as SignalConfig

  it('validates clean against the bundled signal catalog', () => {
    const result = validateDashboard(dashboard, { signalCatalog })

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)

    const crossRefWarnings = result.warnings.filter((w) =>
      w.includes('not defined in config.signals')
    )
    expect(crossRefWarnings).toEqual([])
  })

  it('is pinned at CURRENT_SCHEMA_VERSION', () => {
    expect(dashboard.version).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('migrateConfig is a no-op at CURRENT_SCHEMA_VERSION (idempotent)', () => {
    const result = migrateConfig(dashboard, CURRENT_SCHEMA_VERSION)

    expect(result.applied).toEqual([])
    expect(result.config).toEqual(dashboard)
  })
})
