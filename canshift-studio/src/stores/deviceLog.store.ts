// deviceLog.store.ts — Single funnel for the USB_DEVICE_LOG IPC stream
// (audit S-M-2, umbrella #1015).
//
// Pre-refactor, three independent consumers (`useUsbEvents`, `useFirmwareCheck`,
// `useBootLoopDetector`) each registered their own `window.ipc.on(USB_DEVICE_LOG,
// …)` listener, so every device-log line crossed the renderer boundary three
// times. This store owns the single IPC subscription and exposes:
//
//   - a bounded ring buffer of the most recent entries (`MAX_ENTRIES`),
//   - the latest version captured from the firmware `[BOOT] CANShift vX.Y.Z`
//     banner — a derived read used by the firmware probe as a last-resort
//     fallback (#485),
//   - a `subscribeEntry(handler)` channel so consumers needing per-event
//     reactivity (boot-loop detector, log/error fan-out in useUsbEvents) get
//     called once per entry — without re-mounting the IPC listener.
//
// Mirrors the pattern introduced in `releases.store.ts` (#905): all IPC
// traffic and shape-validation lives in one store; React hooks become thin
// readers. The cap on `entries` is intentionally generous (~500) — enough to
// service the boot-loop context window (CONTEXT_LINES = 30) and any future
// in-UI device-log panel, while still being safe against an unbounded leak
// during a chatty firmware session.

import { create } from 'zustand'
import { IpcChannels } from '../../shared/ipc-channels'
import { isDeviceLogPayload, type DeviceLogPayload } from '../services/ipc.service'
import { BOOT_VERSION_RE } from './deviceLog.boot-regex'

/** Maximum number of device-log entries retained in the ring buffer. */
export const MAX_ENTRIES = 500

/**
 * Per-entry subscriber callback signature. Subscribers see every well-formed
 * device-log payload exactly once, in arrival order. Malformed payloads are
 * dropped before fan-out — consumers don't need to re-validate.
 */
export type DeviceLogEntryHandler = (entry: DeviceLogPayload) => void

interface DeviceLogState {
  /** Ring buffer of the most recent USB_DEVICE_LOG payloads, capped at MAX_ENTRIES. */
  entries: DeviceLogPayload[]
  /**
   * Latest version string parsed from a `[BOOT] CANShift vX.Y.Z` banner.
   * `null` until a banner is seen (or after a connection-scoped reset).
   */
  bootLogVersion: string | null
  /**
   * Mount the single IPC listener. Idempotent — calling twice is a no-op.
   * Increments an internal ref-count so a future second mount could re-start
   * the listener after a prior `stop()`; today the hook only calls this once
   * at App boot.
   */
  start: () => void
  /** Tear down the IPC listener and clear any registered entry subscribers. */
  stop: () => void
  /**
   * Register a per-entry handler. Returns an unsubscribe function.
   * Handlers are invoked synchronously in registration order on every entry
   * the store ingests (after malformed payloads are filtered).
   */
  subscribeEntry: (handler: DeviceLogEntryHandler) => () => void
  /**
   * Reset the buffer + parsed boot version. Hooks call this on disconnect so
   * a stale ring from a previous board can't leak into a fresh probe.
   */
  reset: () => void
  /** Test seam: directly ingest a payload as if it arrived from IPC. */
  _ingestForTest: (payload: unknown) => void
}

// Module-scoped IPC listener handle so start/stop can register/unregister it.
// Lives outside the store to keep the listener identity stable across
// `start()` calls — Electron's `ipcRenderer.off` matches by reference.
let ipcListener: ((...args: unknown[]) => void) | null = null
let started = false

// Module-scoped subscriber set — kept outside zustand state to avoid render
// churn when handlers come and go. Mirrors how `useBootLoopStore` keeps its
// timer ref module-local.
const entrySubscribers = new Set<DeviceLogEntryHandler>()

function fanOut(entry: DeviceLogPayload): void {
  // Snapshot before iterating — a handler may unsubscribe itself or another.
  for (const handler of [...entrySubscribers]) {
    handler(entry)
  }
}

function appendCapped(prev: DeviceLogPayload[], next: DeviceLogPayload): DeviceLogPayload[] {
  if (prev.length < MAX_ENTRIES) return [...prev, next]
  // Drop the oldest entry. `slice(1)` is O(n) but n ≤ MAX_ENTRIES so the
  // total cost stays bounded; a queue-style implementation would optimise
  // further but complicates selector reads.
  return [...prev.slice(1), next]
}

function extractBootVersion(entry: DeviceLogPayload): string | null {
  if (entry.tag !== 'BOOT') return null
  const match = BOOT_VERSION_RE.exec(entry.message)
  return match?.[1] ?? null
}

function ingest(
  set: (partial: Partial<DeviceLogState>) => void,
  get: () => DeviceLogState
): (payload: unknown) => void {
  return (payload: unknown): void => {
    if (!isDeviceLogPayload(payload)) return
    const next: DeviceLogState = {
      ...get(),
      entries: appendCapped(get().entries, payload),
    }
    const bootVersion = extractBootVersion(payload)
    if (bootVersion !== null) next.bootLogVersion = bootVersion
    set({ entries: next.entries, bootLogVersion: next.bootLogVersion })
    fanOut(payload)
  }
}

export const useDeviceLogStore = create<DeviceLogState>()((set, get) => ({
  entries: [],
  bootLogVersion: null,

  start: () => {
    if (started) return
    const handler = ingest(set, get)
    ipcListener = handler
    window.ipc.on(IpcChannels.USB_DEVICE_LOG, handler)
    started = true
  },

  stop: () => {
    if (!started || ipcListener === null) return
    window.ipc.off(IpcChannels.USB_DEVICE_LOG, ipcListener)
    ipcListener = null
    started = false
    entrySubscribers.clear()
  },

  subscribeEntry: (handler) => {
    entrySubscribers.add(handler)
    return () => {
      entrySubscribers.delete(handler)
    }
  },

  reset: () => {
    set({ entries: [], bootLogVersion: null })
  },

  _ingestForTest: (payload: unknown) => {
    ingest(set, get)(payload)
  },
}))

/**
 * Test seam — resets module-local IPC state (the `started` flag, the captured
 * listener, registered entry subscribers) so each test starts from a clean
 * slate without leaking listeners across `window.ipc` stubs.
 */
export function _resetDeviceLogStoreForTest(): void {
  ipcListener = null
  started = false
  entrySubscribers.clear()
  useDeviceLogStore.setState({ entries: [], bootLogVersion: null })
}

/**
 * Selector helpers — kept as named functions so test files and components can
 * share the same read paths without each re-implementing the same `getState()`
 * shape inspection.
 */
export const selectDeviceLogEntries = (s: DeviceLogState): DeviceLogPayload[] => s.entries
export const selectBootLogVersion = (s: DeviceLogState): string | null => s.bootLogVersion
