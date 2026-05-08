// useDeviceConfigLoad.ts — Read the dashboard.json off the device after connect.
//
// On connect (after firmware version probe succeeds), CMD_GET_CONFIG is sent
// to the device and the parsed response is loaded into the editor store.
// This makes the round-trip workflow possible: connect → tweak → push without
// having to first open a file from disk that may have diverged from the
// device's actual state (issue #100).
//
// Failures are surfaced through the log + error stores so the user can tell
// the difference between a device with no config, a corrupt config, and a
// successful empty load. The editor's existing state is preserved on failure
// (#180).

import { useEffect, useRef } from 'react'
import { validateDashboard, type DashboardConfig } from '@tmbk/canshift-core'
import { useDeviceStore } from '../stores/device.store'
import { useDashboardStore } from '../stores/dashboard.store'
import { useLogStore } from '../stores/log.store'
import { useErrorStore } from '../stores/error.store'
import { deviceIpc } from '../services/ipc.service'

export function useDeviceConfigLoad(): void {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const log = useLogStore((s) => s.push)
  const pushError = useErrorStore((s) => s.push)

  // Only run once per (port, version) pair so reconnects to the same device
  // don't repeatedly stomp the editor.
  const loadedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (simulationMode || !connected || !portPath || !firmwareVersion) return

    const key = `${portPath}:${firmwareVersion}`
    if (loadedKeyRef.current === key) return
    loadedKeyRef.current = key

    let cancelled = false

    void (async () => {
      const raw = await deviceIpc.getConfig()
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (cancelled) return

      if (raw === null) {
        // Firmware returned no config (missing file, SD not mounted, parse
        // error, or timeout). Keep this at info level — it's the expected
        // state for a freshly-flashed device.
        log('info', 'No dashboard config on device — keeping current editor state')
        return
      }

      const result = validateDashboard(raw)
      if (result.errors.length > 0) {
        // Bad config on device — leave the editor's current state alone.
        const summary = `Device config failed validation — ${String(result.errors.length)} error(s), keeping editor state`
        log('error', summary)
        pushError({
          source: 'config',
          code: 'DEVICE_CONFIG_INVALID',
          message: summary,
          detail: result.errors.join('\n'),
        })
        return
      }
      result.warnings.forEach((w) => {
        log('warn', `Device config: ${w}`)
      })

      // validateDashboard guarantees structural conformance; cast through
      // unknown to satisfy the TS structural mismatch on Record<string, unknown>.
      // Route through the store action so the device-vs-editor decision reads
      // the LATEST state, not a closure captured before the user's edits (#216).
      useDashboardStore.getState().loadFromDeviceOrDemo(raw as unknown as DashboardConfig)
      log('success', 'Loaded dashboard config from device SD')
    })()

    return () => {
      cancelled = true
    }
  }, [connected, portPath, firmwareVersion, simulationMode, log, pushError])
}
