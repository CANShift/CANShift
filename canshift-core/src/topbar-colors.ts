export interface TopBarColorPalette {
  readonly dotOk: number
  readonly dotStale: number
  readonly dotDown: number
  readonly usbOff: number
  readonly bleConn: number
  readonly bleAdv: number
  readonly bleOff: number
  readonly modeActive: number
  readonly modeIdle: number
  readonly label: number
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
