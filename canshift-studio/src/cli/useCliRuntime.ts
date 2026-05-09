// src/cli/useCliRuntime.ts — Build a `CommandContext` from the live stores.
//
// The hook exposes a stable ref to `CommandContext`; consumers (the CliTerminal
// keystroke handler) read from the ref synchronously to avoid stale closures.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { appIpc } from '../services/ipc.service'
import { COMMANDS } from './commands'
import { buildActions } from './actions'
import type { CliTerminalHandle, CommandContext } from './types'

/**
 * Bind a CLI runtime to a terminal handle. Returns a ref that always points
 * to the latest `CommandContext` snapshot.
 *
 * The studio version is cached after the first IPC roundtrip — it never
 * changes mid-session.
 */
export function useCliRuntime(terminal: CliTerminalHandle): {
  ctxRef: React.MutableRefObject<CommandContext>
} {
  const [appVersion, setAppVersion] = useState<string>('')
  const fetchedVersion = useRef<boolean>(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (fetchedVersion.current) return
    fetchedVersion.current = true
    void appIpc.version().then((v) => {
      setAppVersion(v)
    })
  }, [])

  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const sdState = useDeviceStore((s) => s.sdState)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const configName = useDashboardStore((s) => s.config?.name ?? null)

  const config = useMemo(() => (configName !== null ? { name: configName } : null), [configName])

  // Actions are stable across renders because each impl reads live state
  // through `useXxxStore.getState()`, never closing over stale snapshots.
  const actions = useMemo(() => buildActions(navigate), [navigate])

  const ctx: CommandContext = useMemo(
    () => ({
      appVersion,
      device: { connected, portPath, firmwareVersion, sdState, simulationMode },
      config,
      log: (level, message, scope) => {
        useLogStore.getState().push(level, message, scope)
      },
      terminal,
      commands: COMMANDS,
      actions,
    }),
    [
      appVersion,
      connected,
      portPath,
      firmwareVersion,
      sdState,
      simulationMode,
      config,
      terminal,
      actions,
    ]
  )

  const ctxRef = useRef<CommandContext>(ctx)
  ctxRef.current = ctx

  return { ctxRef }
}
