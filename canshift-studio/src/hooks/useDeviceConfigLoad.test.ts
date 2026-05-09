// useDeviceConfigLoad.test.ts — Locks the pure decision step that drives
// the post-connect dashboard load. Covers issue #418 acceptance criteria:
//
//   1. no-config + empty editor      → auto-load demo
//   2. no-config + non-empty editor  → keep edits, no clobber
//   3. transport failure             → no-op, no auto-load
//   4. valid device config           → apply
//   5. valid device config + demo-fallback active → stage for swap prompt
//   6. invalid device config         → keep editor, surface error
//
// We test the pure helper (no React, no Zustand, no toast UI) so the test
// stays a true unit and won't drag the whole renderer harness in.

import { describe, expect, it } from 'vitest'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { decideDeviceConfigAction } from './useDeviceConfigLoad'
import { DEFAULT_SIM_CONFIG } from '../config/defaultSimConfig'

function makeValidDeviceResponse(): Record<string, unknown> {
  // The store's DEFAULT_SIM_CONFIG is already validateDashboard-clean —
  // reuse it as a known-good wire payload so we don't reinvent the schema.
  return DEFAULT_SIM_CONFIG as unknown as Record<string, unknown>
}

describe('decideDeviceConfigAction', () => {
  it('auto-loads the demo when device reports no config and editor is empty', () => {
    const action = decideDeviceConfigAction({
      result: { ok: false, reason: 'no-config' },
      isEditorEmpty: true,
      loadedFromDemoFallback: false,
    })
    expect(action.kind).toBe('auto-load-demo')
  })

  it('keeps editor edits when device reports no config but editor is non-empty', () => {
    const action = decideDeviceConfigAction({
      result: { ok: false, reason: 'no-config' },
      isEditorEmpty: false,
      loadedFromDemoFallback: false,
    })
    expect(action.kind).toBe('no-config-but-editor-has-edits')
  })

  it('treats transport failures as no-op (does NOT auto-load demo) — AC #4', () => {
    const action = decideDeviceConfigAction({
      result: { ok: false, reason: 'transport' },
      isEditorEmpty: true,
      loadedFromDemoFallback: false,
    })
    expect(action.kind).toBe('transport-failure')
  })

  it('applies a valid device config directly when no demo fallback is active', () => {
    const action = decideDeviceConfigAction({
      result: { ok: true, config: makeValidDeviceResponse() },
      isEditorEmpty: false,
      loadedFromDemoFallback: false,
    })
    expect(action.kind).toBe('apply-device-config-with-warnings')
    if (action.kind === 'apply-device-config-with-warnings') {
      const cfg: DashboardConfig = action.config
      expect(cfg.defaultPageId).toBe(DEFAULT_SIM_CONFIG.defaultPageId)
    }
  })

  it('stages the device config behind the prompt when demo fallback is active — AC #5', () => {
    const action = decideDeviceConfigAction({
      result: { ok: true, config: makeValidDeviceResponse() },
      isEditorEmpty: false,
      loadedFromDemoFallback: true,
    })
    expect(action.kind).toBe('stage-pending-device-config')
    if (action.kind === 'stage-pending-device-config') {
      expect(action.config.defaultPageId).toBe(DEFAULT_SIM_CONFIG.defaultPageId)
    }
  })

  it('flags an invalid device config without clobbering the editor', () => {
    // Pin the version to the current schema so the structural-validation
    // path is exercised — without a version, migrateConfig would catch this
    // first as a chain failure (#157).
    const action = decideDeviceConfigAction({
      result: { ok: true, config: { version: '1.11.0', not: 'a-dashboard' } },
      isEditorEmpty: false,
      loadedFromDemoFallback: false,
    })
    expect(action.kind).toBe('invalid-device-config')
    if (action.kind === 'invalid-device-config') {
      expect(action.errors.length).toBeGreaterThan(0)
    }
  })

  it('flags a migration failure when device reports a future schema version — #157', () => {
    // A version that no migration can reach from the current chain.
    const futureConfig: Record<string, unknown> = {
      ...makeValidDeviceResponse(),
      version: '99.0.0',
    }
    const action = decideDeviceConfigAction({
      result: { ok: true, config: futureConfig },
      isEditorEmpty: false,
      loadedFromDemoFallback: false,
    })
    expect(action.kind).toBe('migration-failed-device-config')
    if (action.kind === 'migration-failed-device-config') {
      expect(action.message.length).toBeGreaterThan(0)
    }
  })

  it('migrates an older device config up to the current schema before applying — #157', () => {
    // A 1.10.0 → 1.11.0 step is a no-op data migration; the version must
    // still flip on the returned config so downstream burns are clean.
    const olderConfig: Record<string, unknown> = {
      ...makeValidDeviceResponse(),
      version: '1.10.0',
    }
    const action = decideDeviceConfigAction({
      result: { ok: true, config: olderConfig },
      isEditorEmpty: false,
      loadedFromDemoFallback: false,
    })
    expect(action.kind).toBe('apply-device-config-with-warnings')
    if (action.kind === 'apply-device-config-with-warnings') {
      expect(action.config.version).toBe('1.11.0')
    }
  })
})
