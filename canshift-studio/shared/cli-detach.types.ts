// cli-detach.types.ts — Shared payloads for the CLI detach IPC channels.
//
// Imported by the main-process modules that own the detached BrowserWindow
// (windows/cli-window.ts, services/cli-window.service.ts, services/cli-log-bus.ts)
// and by the renderer hooks (src/cli/useCliDetach.ts,
// src/cli/useCliLogBridge.ts) so both sides agree on the wire format.
//
// `LogLevel` is duplicated here rather than imported from
// `src/stores/log.store.ts` because the main-process tsconfig
// (`tsconfig.main.json`) only `include`s `main/**` + `shared/**`. The renderer
// re-exports its own `LogLevel` and treats this file as the contract.

import { z } from 'zod'

/**
 * Mirror of the `LogLevel` union in `src/stores/log.store.ts`. Kept in lockstep
 * — narrowing this set without updating the renderer (or vice-versa) means the
 * CLI_LOG_PUSH IPC payload validator will silently drop log entries.
 */
export const LogLevelSchema = z.enum(['info', 'warn', 'error', 'success', 'debug'])

export type LogLevel = z.infer<typeof LogLevelSchema>

/**
 * Top-level state of the CLI panel surface. The renderer mirrors this so
 * the in-app slot can collapse to a "Re-attach" stub when the detached
 * window is open. `windowId` is the Electron `BrowserWindow.id` and is
 * scoped to the lifetime of the detached window.
 */
export type CliPanelState = { kind: 'inApp' } | { kind: 'detached'; windowId: number }

/**
 * Wire-friendly version of `LogEntry` from `src/stores/log.store.ts`.
 * `Date` would survive the IPC structured clone but we also normalize to
 * `timestampMs` so the bridge stays small and JSON-printable. The id is
 * carried through so the receiving renderer can dedupe against its own
 * locally-pushed entries.
 *
 * `.strict()` rejects unknown fields so the renderer can't smuggle extra
 * keys past the main-process boundary (matches the project-wide IPC
 * convention per #769).
 */
export const CliLogPayloadSchema = z
  .object({
    id: z.number().finite(),
    level: LogLevelSchema,
    message: z.string(),
    timestampMs: z.number().finite(),
    scope: z.string().optional(),
  })
  .strict()

export type CliLogPayload = z.infer<typeof CliLogPayloadSchema>

/** Payload of `IpcChannels.CLI_STATE_CHANGED`. */
export interface CliStateChangedEvent {
  state: CliPanelState
}
