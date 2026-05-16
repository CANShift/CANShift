// schemas/hardware-profile.ts — Per-board reserved/expansion pin sets.
//
// Mirrors the firmware-side `hardware_profile.h` concept TS-side so studio
// can validate pin assignments against the actual board's wiring (not just
// the chip's safety rules in `Esp32OutputGpioSchema`).
//
// `reservedPins` are pins the board uses for its own hardware (display SPI,
// touch SPI, etc.) — never available to user config.
// `expansionPins` are the pins the board exposes on its expansion header
// for user wiring (TWAI bus, I2C, UART2, etc.).
//
// Issue #831 — second defence layer on top of chip-level GPIO safety.

export const HARDWARE_PROFILES = {
  crowpanel_28: {
    label: 'Elecrow CrowPanel 2.8" ESP32',
    // From canshift-firmware/include/board_config.h:
    //   TFT MOSI=13, MISO=12, SCLK=14, CS=15, DC=2, BL=27
    //   Touch CS=33
    //   TWAI on expansion: 25, 32
    //   I2C header free: 21, 22
    //   UART2 free: 16, 17
    reservedPins: new Set<number>([13, 12, 14, 15, 2, 27, 33]),
    expansionPins: new Set<number>([25, 32, 21, 22, 16, 17]),
  },
} as const

export type HardwareProfileId = keyof typeof HARDWARE_PROFILES
export type HardwareProfile = (typeof HARDWARE_PROFILES)[HardwareProfileId]

/**
 * Returns `true` when the given pin is not claimed by the board's own
 * hardware (display SPI, touch SPI, …) on the given board.
 *
 * Note this is purely the *board-level* check — chip-level safety
 * (flash SPI, input-only) is enforced separately by
 * `Esp32OutputGpioSchema` / `Esp32InputGpioSchema`. Both layers should be
 * applied at the studio UI / IPC entry.
 */
export function isPinAvailableForBoard(boardId: HardwareProfileId, pin: number): boolean {
  return !HARDWARE_PROFILES[boardId].reservedPins.has(pin)
}
