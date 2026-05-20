// topbar-colors.ts — single source of truth for TopBar status colours
//
// Both renderers (Studio preview in canshift-studio/src/components/editor/Canvas.tsx
// and firmware top bar in canshift-firmware/src/ui/top_bar.cpp) read the same
// palette so the two stay pixel-faithful. The firmware mirrors these constants
// as `static constexpr uint32_t COLOR_*` at the top of top_bar.cpp — a unit
// test pins the values here so accidental drift surfaces on the TS side.
//
// Values are 24-bit RGB integers (0xRRGGBB) rather than the `#RRGGBB` hex
// strings the renderer-facing design tokens use, because the firmware consumes
// them as `lv_color_hex(uint32_t)` directly.

export interface TopBarColorPalette {
  /** Green — connected, telemetry within freshness window. */
  readonly dotOk: number
  /** Orange — was connected but signal timed out. */
  readonly dotStale: number
  /** Red — never connected since boot. */
  readonly dotDown: number
  /** Gray — USB host not active. */
  readonly usbOff: number
  /** Blue — mobile BLE client connected. */
  readonly bleConn: number
  /** Dim blue — BLE advertising, no client. */
  readonly bleAdv: number
  /** Gray — BLE disabled. */
  readonly bleOff: number
  /** Amber — operating mode armed (track / cruise / …). */
  readonly modeActive: number
  /** Near-black — operating mode off. */
  readonly modeIdle: number
  /** Default label colour. */
  readonly label: number
  /** Muted-label colour (secondary text). */
  readonly muted: number
}

export const TopBarColors: TopBarColorPalette = {
  dotOk: 0x33cc44,
  dotStale: 0xff8800,
  dotDown: 0xcc3333,
  usbOff: 0x444444,
  bleConn: 0x4499ff,
  bleAdv: 0x225588,
  bleOff: 0x444444,
  modeActive: 0xff8800,
  modeIdle: 0x1c1c1c,
  label: 0xcccccc,
  muted: 0x666666,
} as const
