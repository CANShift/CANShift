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
