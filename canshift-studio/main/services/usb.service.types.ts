// usb.service.types.ts — Cross-module types extracted from usb.service.ts.
// Lives here so the renderer (via ipc.service.ts re-exports) and other main
// modules can consume these shapes without pulling in the SerialPort runtime.

export interface CanFrame {
  id: number
  len: number
  data: number[]
}

export interface CanHealth {
  fps: number
  errors: number
}

/**
 * Runtime SD-card state reported by CMD_GET_STATUS.
 *
 * - 'ok'             — SD mounted, persistent writes work.
 * - 'no_card'        — no card inserted, device is on built-in defaults.
 * - 'mount_failed'   — card present but unreadable, defaults active.
 * - 'unknown'        — older firmware that doesn't include `sd_state` in its
 *                      status response. Treat as best-effort OK so the UI
 *                      doesn't regress on devices we haven't reflashed yet.
 */
export type SdRuntimeState = 'ok' | 'no_card' | 'mount_failed' | 'unknown'
