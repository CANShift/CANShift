// useCliLogBridge.ts — Bidirectional log bridge for CLI surfaces (issue #433).
//
// • Subscribes to `CLI_LOG_BROADCAST` so entries produced in another renderer
//   land in this window's `useLogStore`.
// • Watches the local store for new entries and forwards them to main via
//   `CLI_LOG_PUSH` so other CLI surfaces can render them too.
//
// The bus deduplicates by `webContents.id` on the main side, so we don't have
// to worry about an entry pushed locally arriving back via the broadcast.
// On startup we also seed the local store with the backlog returned by
// `CLI_GET_STATE` so a freshly-detached window doesn't appear empty.

import { useEffect, useRef } from 'react'
import { IpcChannels } from '../../main/ipc/ipc-channels'
import type { CliLogPayload } from '../../main/ipc/cli-detach.types'
import { useLogStore, type LogEntry } from '../stores/log.store'

interface CliGetStateResponse {
  state: { kind: 'inApp' } | { kind: 'detached'; windowId: number }
  backlog: readonly CliLogPayload[]
}

function payloadToEntry(payload: CliLogPayload): LogEntry {
  // Local id is assigned by `pushFromBridge`; we forward the payload's
  // metadata only.
  const base = {
    id: payload.id,
    level: payload.level,
    message: payload.message,
    timestamp: new Date(payload.timestampMs),
  }
  return payload.scope !== undefined ? { ...base, scope: payload.scope } : base
}

function entryToPayload(entry: LogEntry): CliLogPayload {
  const base: CliLogPayload = {
    id: entry.id,
    level: entry.level,
    message: entry.message,
    timestampMs: entry.timestamp.getTime(),
  }
  return entry.scope !== undefined ? { ...base, scope: entry.scope } : base
}

function isCliLogPayload(value: unknown): value is CliLogPayload {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'number' &&
    typeof v.level === 'string' &&
    typeof v.message === 'string' &&
    typeof v.timestampMs === 'number'
  )
}

/**
 * Mounts the cross-window log bridge. Idempotent — only one instance should
 * be alive per window, but a duplicate mount is harmless because the dedupe
 * happens by `id` upstream.
 */
export function useCliLogBridge(): void {
  const seedDoneRef = useRef<boolean>(false)
  const lastForwardedIdRef = useRef<number>(0)

  // Seed the backlog and subscribe to broadcasts.
  useEffect(() => {
    let cancelled = false

    if (!seedDoneRef.current) {
      seedDoneRef.current = true
      void window.ipc
        .invoke(IpcChannels.CLI_GET_STATE)
        .then((value) => {
          if (cancelled) return
          const resp = value as CliGetStateResponse
          for (const payload of resp.backlog) {
            useLogStore.getState().pushFromBridge(payloadToEntry(payload))
          }
        })
        .catch(() => {
          // Best-effort — backlog is a UX nicety, not a correctness gate.
        })
    }

    const onBroadcast = (...args: unknown[]): void => {
      const payload = args[0]
      if (!isCliLogPayload(payload)) return
      useLogStore.getState().pushFromBridge(payloadToEntry(payload))
    }
    window.ipc.on(IpcChannels.CLI_LOG_BROADCAST, onBroadcast)

    return () => {
      cancelled = true
      window.ipc.off(IpcChannels.CLI_LOG_BROADCAST, onBroadcast)
    }
  }, [])

  // Forward new local entries out to main.
  useEffect(() => {
    // Initial seed: skip whatever's already in the store so we don't
    // re-broadcast the historical buffer.
    lastForwardedIdRef.current = useLogStore.getState().entries.reduce<number>((max, e) => {
      return e.id > max ? e.id : max
    }, 0)

    const unsubscribe = useLogStore.subscribe((s) => {
      for (const entry of s.entries) {
        if (entry.id <= lastForwardedIdRef.current) continue
        lastForwardedIdRef.current = entry.id
        try {
          window.ipc.send(IpcChannels.CLI_LOG_PUSH, entryToPayload(entry))
        } catch {
          // Bridge unavailable (e.g. tests that don't stub `window.ipc`) —
          // local rendering still works.
        }
      }
    })
    return () => {
      unsubscribe()
    }
  }, [])
}
