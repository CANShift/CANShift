import type { DashboardConfig } from '@tmbk/canshift-core'
import { CURRENT_SCHEMA_VERSION, DashboardConfigSchema, migrateConfig } from '@tmbk/canshift-core'

import { CMD_GET_CONFIG } from './opcodes'
import type { DeviceConfigResult } from './types'
import { isRecord } from './types'
import { getSerialClient } from './webserial-client'

const migrateAndParse = (raw: Record<string, unknown>): DeviceConfigResult => {
  let migrated: ReturnType<typeof migrateConfig>
  try {
    migrated = migrateConfig(raw, CURRENT_SCHEMA_VERSION)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { kind: 'error', error: `config_migration_failed: ${message}` }
  }
  const parsed = DashboardConfigSchema.safeParse(migrated.config)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const detail = issue ? `${issue.path.join('.')}: ${issue.message}` : 'schema_mismatch'
    return { kind: 'error', error: `invalid_dashboard_config: ${detail}` }
  }
  return {
    kind: 'ok',
    config: parsed.data as DashboardConfig,
    migrationsApplied: migrated.applied,
  }
}

export const deviceIpc = {
  getConfig: async (): Promise<DeviceConfigResult> => {
    const result = await getSerialClient().send(CMD_GET_CONFIG, {}, { timeoutMs: 8_000 })
    if (result.ok) {
      const cfg = result.data?.config
      if (!isRecord(cfg)) return { kind: 'none' }
      return migrateAndParse(cfg)
    }
    if (result.error === 'config_not_found') return { kind: 'none' }
    return { kind: 'error', error: result.error ?? 'unknown_error' }
  },
}
