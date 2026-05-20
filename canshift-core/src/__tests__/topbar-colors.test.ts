// topbar-colors.test.ts — pin TopBar status colour palette.
//
// The firmware C++ mirror (canshift-firmware/src/ui/top_bar.cpp) reads from
// the same numbers. Pinning them prevents accidental drift; if a value is
// changed here, the firmware top_bar.cpp constants MUST be updated to match.

import { TopBarColors } from '../topbar-colors.js'

describe('TopBarColors', () => {
  it('pins the canonical status palette', () => {
    expect(TopBarColors).toEqual({
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
    })
  })

  it('every entry is a 24-bit RGB integer (0 <= v <= 0xFFFFFF)', () => {
    for (const value of Object.values(TopBarColors)) {
      expect(typeof value).toBe('number')
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(0xffffff)
    }
  })
})
