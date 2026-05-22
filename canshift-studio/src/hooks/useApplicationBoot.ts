// useApplicationBoot.ts — Composite root-mount hook (audit S-L-5, umbrella #1015).
//
// Bundles every "register-once-at-the-App-root" hook into a single call so the
// ordering, which used to be an implicit contract inside `App.tsx`, lives in
// one place with the rationale spelled out.
//
// Order matters — do not shuffle without re-reading this comment:
//
//   1. `useUsbEvents`           — opens the single IPC subscription for
//                                 `USB_DEVICE_LOG` / connection events and
//                                 owns `deviceLog.store` (S-M-2). Must run
//                                 first so the listeners exist before any
//                                 later hook can fire an action that ends up
//                                 emitting a device log line.
//   2. `useMenuEvents`          — wires native menu items (File > Open, Save,
//                                 Edit > Undo, …) to dashboard-store actions.
//                                 Independent of device state, but kept near
//                                 the top so menu-triggered loads happen
//                                 before the device-side restore races them.
//   3. `useFirmwareCheck`       — reacts to device-store connection changes
//                                 and writes the `firmwareCheck` slice.
//                                 Must run before `useDeviceConfigLoad`
//                                 because the latter waits for a valid
//                                 firmware probe before pulling config.
//   4. `useDeviceConfigLoad`    — pulls dashboard.json off the device once
//                                 firmware-check succeeds; depends on (3).
//   5. `useSessionRestore`      — best-effort reopen of the last file. Runs
//                                 after the device load chain so an actual
//                                 device config wins over a stale on-disk
//                                 session if both resolve in the same tick.
//   6. `useAutoConnect`         — kicks the 2 s reconnect loop. Mounted late
//                                 so the listeners from (1) are already
//                                 attached when the first connection lands.
//   7. `useDirtySync`           — pushes the dashboard isDirty flag to main
//                                 for the close-prompt; subscribes to the
//                                 dashboard store after restore/load have
//                                 had a chance to seed it.
//   8. `useBurnPhaseTracker`    — derives burn lifecycle from connection
//                                 state; safe anywhere after (1) but kept
//                                 grouped with the other device-derived
//                                 hooks.
//   9. `useCliLogBridge`        — relays log entries between renderers via
//                                 IPC; runs after the log store has been
//                                 seeded by the earlier hooks so the first
//                                 forwarded batch is non-empty.
//  10. `useBootLoopDetector`    — last subscriber on the device-log stream
//                                 from (1); needs `useUsbEvents` mounted to
//                                 see any events at all.
//
// Adding a new App-root hook? Decide where it slots based on:
//   • does it open an IPC subscription? → near the top, after (1)
//   • does it depend on the firmware probe? → after (3)
//   • does it only react to the dashboard store? → after (5)
//
// Keep this hook parameterless; per-feature configuration belongs in the
// underlying hooks, not in the composite.

import { useUsbEvents } from './useUsbEvents'
import { useMenuEvents } from './useMenuEvents'
import { useFirmwareCheck } from './useFirmwareCheck'
import { useDeviceConfigLoad } from './useDeviceConfigLoad'
import { useSessionRestore } from './useSessionRestore'
import { useAutoConnect } from './useAutoConnect'
import { useDirtySync } from './useDirtySync'
import { useBurnPhaseTracker } from './useBurnPhaseTracker'
import { useCliLogBridge } from '../cli/useCliLogBridge'
import { useBootLoopDetector } from './useBootLoopDetector'

export function useApplicationBoot(): void {
  useUsbEvents()
  useMenuEvents()
  useFirmwareCheck()
  useDeviceConfigLoad()
  useSessionRestore()
  useAutoConnect()
  useDirtySync()
  useBurnPhaseTracker()
  useCliLogBridge()
  useBootLoopDetector()
}
