// useDeviceConfigLoad.ts — Read the dashboard.json off the device after connect.
//
// On connect (after firmware version probe succeeds), CMD_GET_CONFIG is sent
// to the device and the parsed response is loaded into the editor store.
// This makes the round-trip workflow possible: connect → tweak → push without
// having to first open a file from disk that may have diverged from the
// device's actual state (issue #100).
//
// Failures are non-fatal: a missing or invalid config leaves whatever the
// user already had loaded untouched.

import { useEffect, useRef } from 'react'
import { validateDashboard, type DashboardConfig } from '@tmbk/canshift-core'
import { useDeviceStore } from '../stores/device.store'
import { useDashboardStore } from '../stores/dashboard.store'
import { deviceIpc } from '../services/ipc.service'

export function useDeviceConfigLoad(): void {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const setConfig = useDashboardStore((s) => s.setConfig)

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
      if (raw === null) return
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (cancelled) return

      const result = validateDashboard(raw)
      if (result.errors.length > 0) {
        // Bad config on device — leave the editor's current state alone.
        console.warn('Device config failed validation:', result.errors)
        return
      }

      // validateDashboard guarantees structural conformance; cast through
      // unknown to satisfy the TS structural mismatch on Record<string, unknown>.
      setConfig(raw as unknown as DashboardConfig)
    })()

    return () => {
      cancelled = true
    }
  }, [connected, portPath, firmwareVersion, simulationMode, setConfig])
}
