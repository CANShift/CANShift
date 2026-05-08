// src/cli/useCliRuntime.ts — Build a `CommandContext` from the live stores.
//
// The hook exposes a stable ref to `CommandContext`; consumers (the CliTerminal
// keystroke handler) read from the ref synchronously to avoid stale closures.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { appIpc } from '../services/ipc.service'
import { COMMANDS } from './commands'
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
  const configName = useDashboardStore((s) => s.config?.name ?? null)

  const config = useMemo(() => (configName !== null ? { name: configName } : null), [configName])

  const ctx: CommandContext = useMemo(
    () => ({
      appVersion,
      device: { connected, portPath, firmwareVersion, sdState },
      config,
      log: (level, message, scope) => {
        useLogStore.getState().push(level, message, scope)
      },
      terminal,
      commands: COMMANDS,
    }),
    [appVersion, connected, portPath, firmwareVersion, sdState, config, terminal]
  )

  const ctxRef = useRef<CommandContext>(ctx)
  ctxRef.current = ctx

  return { ctxRef }
}
