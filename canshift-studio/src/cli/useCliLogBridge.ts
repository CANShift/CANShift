// useCliLogBridge.ts — Bidirectional log bridge for CLI surfaces (issue #433).
//
// • Subscribes to `CLI_LOG_BROADCAST_BATCH` so entries produced in another renderer
//   land in this window's `useLogStore`.
// • Watches the local store for new entries and forwards them to main via
//   `CLI_LOG_PUSH` so other CLI surfaces can render them too.
//
// On startup we seed the local store with the backlog returned by
// `CLI_GET_STATE` so a freshly-detached window doesn't appear empty. The seed
// MUST skip entries that this window already pushed locally — otherwise the
// main window's own forwarded entries come back through the seed and produce
// duplicate log lines (#575). We track per-id forwarded IDs to deduplicate.
//
// Seed completion is marked AFTER the IPC resolves so a StrictMode mount /
// cleanup / re-mount cycle (or any cancelled invoke) doesn't permanently
// suppress the seed — that was the cause of the detached window staying empty
// in dev (#574).

import { useEffect, useRef } from 'react'
import { IpcChannels } from '../../shared/ipc-channels'
import type { CliLogPayload } from '../../shared/cli-detach.types'
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
  // Tracks payload ids this window already forwarded to main. The seed must
  // skip these — otherwise pushFromBridge would re-inject entries already
  // present in this window's store (the source window for those ids), which
  // is the duplicate-line regression (#575). Each window has its own local
  // id counter so collisions across windows are not a concern here.
  const forwardedIdsRef = useRef<Set<number>>(new Set<number>())

  // Seed the backlog and subscribe to broadcasts.
  useEffect(() => {
    let cancelled = false

    if (!seedDoneRef.current) {
      void window.ipc
        .invoke(IpcChannels.CLI_GET_STATE)
        .then((value) => {
          if (cancelled) return
          // Mark complete AFTER successful resolution so a cancelled invoke
          // doesn't permanently suppress retries on the next mount (#574).
          seedDoneRef.current = true
          const resp = value as CliGetStateResponse
          for (const payload of resp.backlog) {
            // Skip entries this window itself produced — they're already in
            // the local store under their original ids (#575).
            if (forwardedIdsRef.current.has(payload.id)) continue
            useLogStore.getState().pushFromBridge(payloadToEntry(payload))
          }
        })
        .catch(() => {
          // Best-effort — backlog is a UX nicety, not a correctness gate.
        })
    }

    const onBroadcastBatch = (...args: unknown[]): void => {
      const payload = args[0]
      if (!Array.isArray(payload)) return
      const push = useLogStore.getState().pushFromBridge
      for (const entry of payload) {
        if (!isCliLogPayload(entry)) continue
        push(payloadToEntry(entry))
      }
    }
    window.ipc.on(IpcChannels.CLI_LOG_BROADCAST_BATCH, onBroadcastBatch)

    return () => {
      cancelled = true
      window.ipc.off(IpcChannels.CLI_LOG_BROADCAST_BATCH, onBroadcastBatch)
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
        // Skip entries that originated from another window — re-broadcasting
        // them would produce a feedback loop where the originating window
        // receives its own log back, doubling every line in the store (#484).
        if (entry.bridged === true) continue
        // Record the local id so the seed can skip this entry when it comes
        // back through `CLI_GET_STATE`'s backlog (#575).
        forwardedIdsRef.current.add(entry.id)
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
