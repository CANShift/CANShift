// useDeviceConfigLoad.ts — Read the dashboard.json off the device after connect.
//
// On connect (after firmware version probe succeeds), CMD_GET_CONFIG is sent
// to the device and the parsed response is loaded into the editor store.
// This makes the round-trip workflow possible: connect → tweak → push without
// having to first open a file from disk that may have diverged from the
// device's actual state (issue #100).
//
// When the device acks but reports `config_not_found` (e.g. fresh device, SD
// not mounted, file deleted) we auto-load the bundled demo so the editor
// doesn't sit empty (issue #418). Transport-level failures keep the editor
// untouched — we don't want a flaky link to clobber unsaved edits.

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  CURRENT_SCHEMA_VERSION,
  ECU_PROFILES,
  migrateConfig,
  parseRealDashXML,
  validateDashboard,
  type DashboardConfig,
} from '@tmbk/canshift-core'
import { useDeviceStore } from '../stores/device.store'
import { useDashboardStore } from '../stores/dashboard.store'
import { useSignalStore } from '../stores/signal.store'
import { useLogStore, type LogLevel } from '../stores/log.store'
import { useErrorStore } from '../stores/error.store'
import { deviceIpc, type DeviceConfigResult } from '../services/ipc.service'
import { REALDASH_CATALOG } from '../data/realdash-catalog'

async function restoreEcuProfile(ecuProfileKey: string | undefined): Promise<void> {
  if (!ecuProfileKey) return
  if (ecuProfileKey.startsWith('builtin:')) {
    const profileId = ecuProfileKey.slice('builtin:'.length)
    const profile = ECU_PROFILES.find((p) => p.id === profileId)
    if (!profile) return
    useSignalStore.getState().applyProfile(ecuProfileKey, profile.signals)
  } else if (ecuProfileKey.startsWith('xml:')) {
    const xmlId = ecuProfileKey.slice('xml:'.length)
    const profile = REALDASH_CATALOG.find((p) => p.id === xmlId)
    if (!profile) return
    const xml = await profile.load()
    const { signals } = parseRealDashXML(xml)
    useSignalStore.getState().applyProfile(ecuProfileKey, signals)
  }
}

/**
 * Pure outcome of the device-config probe — what the renderer should do
 * with the result. Extracted so the decision logic stays testable without
 * pulling in React, Zustand, or the toast UI.
 */
export type DeviceConfigAction =
  | { kind: 'auto-load-demo' }
  | { kind: 'no-config-but-editor-has-edits' }
  | { kind: 'transport-failure' }
  | { kind: 'apply-device-config'; config: DashboardConfig }
  | { kind: 'invalid-device-config'; errors: string[]; warnings: string[] }
  | { kind: 'migration-failed-device-config'; message: string }
  | { kind: 'stage-pending-device-config'; config: DashboardConfig; warnings: string[] }
  | { kind: 'apply-device-config-with-warnings'; config: DashboardConfig; warnings: string[] }

interface DecideContext {
  result: DeviceConfigResult
  /** True when the editor currently has no config loaded. */
  isEditorEmpty: boolean
  /**
   * True when the editor is currently displaying the auto-demo seeded by
   * a previous "no-config" branch — drives the post-recovery prompt (#418).
   */
  loadedFromDemoFallback: boolean
}

/**
 * Decide what to do based on the IPC result and the current editor state.
 * Pure; no side effects. Migrates older schemas up to the current version
 * before validation so a device running an older firmware (with a config
 * written at an older schema) still loads cleanly (#157).
 */
export function decideDeviceConfigAction(ctx: DecideContext): DeviceConfigAction {
  const { result, isEditorEmpty, loadedFromDemoFallback } = ctx
  if (!result.ok) {
    // Any failure on an empty editor → seed the demo so the user has something
    // to work with. Non-empty editor: distinguish no-config from transport so
    // flaky links don't clobber in-progress edits.
    if (isEditorEmpty) return { kind: 'auto-load-demo' }
    if (result.reason === 'no-config') return { kind: 'no-config-but-editor-has-edits' }
    return { kind: 'transport-failure' }
  }

  // Bring the device config up to the current schema before validating.
  // A future-version config (impossible chain) will throw — surface that
  // explicitly so the user is never silently editing a stale shape.
  let migrated: Record<string, unknown>
  try {
    migrated = migrateConfig(result.config, CURRENT_SCHEMA_VERSION).config
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { kind: 'migration-failed-device-config', message }
  }

  const validation = validateDashboard(migrated)
  if (validation.errors.length > 0) {
    return {
      kind: 'invalid-device-config',
      errors: validation.errors,
      warnings: validation.warnings,
    }
  }
  // validateDashboard guarantees structural conformance; cast through unknown.
  const config = migrated as unknown as DashboardConfig
  if (loadedFromDemoFallback) {
    return {
      kind: 'stage-pending-device-config',
      config,
      warnings: validation.warnings,
    }
  }
  return {
    kind: 'apply-device-config-with-warnings',
    config,
    warnings: validation.warnings,
  }
}

interface ApplyContext {
  log: (level: LogLevel, message: string) => void
  pushError: (entry: { source: 'config'; code: string; message: string; detail?: string }) => void
}

/**
 * Apply a {@link DeviceConfigAction} to the global stores. Side-effectful —
 * the pure decision is in {@link decideDeviceConfigAction} so tests can
 * cover it without faking the entire store graph.
 */
export function applyDeviceConfigAction(
  action: DeviceConfigAction,
  { log, pushError }: ApplyContext
): void {
  switch (action.kind) {
    case 'auto-load-demo': {
      const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(null)
      if (outcome === 'demo') {
        log('info', 'No dashboard config on device — loaded demo so the editor is not empty')
        toast.info('Loaded demo dashboard — device has no config saved.')
      } else {
        // Race: another caller seeded a config between probe and apply.
        log('info', 'No dashboard config on device — keeping current editor state')
      }
      return
    }
    case 'no-config-but-editor-has-edits': {
      log('info', 'No dashboard config on device — keeping current editor state')
      toast.info('Device has no config saved — keeping your in-progress edits.')
      return
    }
    case 'transport-failure': {
      log('info', 'No dashboard config on device — keeping current editor state')
      return
    }
    case 'invalid-device-config': {
      const summary = `Device config failed validation — ${String(action.errors.length)} error(s)`
      log('error', summary)
      pushError({
        source: 'config',
        code: 'DEVICE_CONFIG_INVALID',
        message: summary,
        detail: action.errors.join('\n'),
      })
      if (useDashboardStore.getState().config === null) {
        const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(null)
        if (outcome === 'demo') {
          log('info', 'Loaded demo config as fallback — fix device config and push to deploy')
        }
      }
      return
    }
    case 'migration-failed-device-config': {
      const summary = `Device config migration failed: ${action.message}`
      log('error', summary)
      pushError({
        source: 'config',
        code: 'DEVICE_CONFIG_MIGRATION_FAILED',
        message: summary,
      })
      if (useDashboardStore.getState().config === null) {
        const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(null)
        if (outcome === 'demo') {
          log('info', 'Loaded demo config as fallback — fix device config and push to deploy')
        }
      }
      return
    }
    case 'apply-device-config-with-warnings': {
      action.warnings.forEach((w) => {
        log('warn', `Device config: ${w}`)
      })
      useDashboardStore.getState().loadFromDeviceOrDemo(action.config)
      void restoreEcuProfile(action.config.ecuProfileKey)
      log('success', 'Loaded dashboard config from device SD')
      return
    }
    case 'stage-pending-device-config': {
      action.warnings.forEach((w) => {
        log('warn', `Device config: ${w}`)
      })
      useDashboardStore.getState().stagePendingDeviceConfig(action.config)
      void restoreEcuProfile(action.config.ecuProfileKey)
      log('info', 'Device config available — kept demo until you confirm')
      return
    }
    case 'apply-device-config': {
      // Reserved for future direct-apply paths; treat like the warnings variant.
      useDashboardStore.getState().loadFromDeviceOrDemo(action.config)
      void restoreEcuProfile(action.config.ecuProfileKey)
      log('success', 'Loaded dashboard config from device SD')
      return
    }
  }
}

export function useDeviceConfigLoad(): void {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const firmwareCheck = useDeviceStore((s) => s.firmwareCheck)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const burnPhase = useDeviceStore((s) => s.burnPhase)
  const log = useLogStore((s) => s.push)
  const pushError = useErrorStore((s) => s.push)

  // Only run once per (port, version) pair so reconnects to the same device
  // don't repeatedly stomp the editor.
  const loadedKeyRef = useRef<string | null>(null)

  // A burn always writes a new config — clear the cache key so the post-reboot
  // reconnect reads the updated file back from the device instead of skipping.
  useEffect(() => {
    if (burnPhase === 'rebooting') {
      loadedKeyRef.current = null
    }
  }, [burnPhase])

  // When the firmware probe fails completely (no_firmware), the main effect
  // never fires because firmwareVersion stays null. Seed the demo so the
  // editor isn't blank.
  useEffect(() => {
    if (simulationMode || !connected) return
    if (firmwareCheck.kind !== 'no_firmware') return
    if (useDashboardStore.getState().config !== null) return
    const outcome = useDashboardStore.getState().loadFromDeviceOrDemo(null)
    if (outcome === 'demo') {
      log('info', 'No CANShift firmware detected — loaded demo config')
      toast.info('No firmware detected — loaded demo dashboard.')
    }
  }, [connected, simulationMode, firmwareCheck, log])

  useEffect(() => {
    if (simulationMode || !connected || !portPath || !firmwareVersion) return

    const key = `${portPath}:${firmwareVersion}`
    if (loadedKeyRef.current === key) return
    loadedKeyRef.current = key

    let cancelled = false

    void (async () => {
      const result = await deviceIpc.getConfig()
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (cancelled) return

      // Read the LATEST store state inside the async callback — never a
      // closure captured before the user typed something (#216).
      const dashboardState = useDashboardStore.getState()
      const action = decideDeviceConfigAction({
        result,
        isEditorEmpty: dashboardState.config === null,
        loadedFromDemoFallback: dashboardState.loadedFromDemoFallback,
      })
      applyDeviceConfigAction(action, { log, pushError })
    })()

    return () => {
      cancelled = true
    }
  }, [connected, portPath, firmwareVersion, simulationMode, log, pushError])
}
