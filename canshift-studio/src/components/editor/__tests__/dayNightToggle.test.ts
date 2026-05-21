// dayNightToggle.test.ts — Locks in the day/night toggle policy used by the
// canvas preview top-bar button (issue #957). Regression guard: the previous
// shape sent the USB command without mirroring the new mode locally, which
// left the preview frozen on the old mode until the next reconnect probe.

import { describe, it, expect } from 'vitest'
import { decideDayNightAction } from '../dayNightToggle'

describe('decideDayNightAction', () => {
  it('returns offline when no device has reported its day mode yet', () => {
    expect(decideDayNightAction(null)).toEqual({ kind: 'offline' })
  })

  it('returns connected+true when the device currently reports night mode', () => {
    expect(decideDayNightAction(false)).toEqual({ kind: 'connected', next: true })
  })

  it('returns connected+false when the device currently reports day mode', () => {
    expect(decideDayNightAction(true)).toEqual({ kind: 'connected', next: false })
  })
})
