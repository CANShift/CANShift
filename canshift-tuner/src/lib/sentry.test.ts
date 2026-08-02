import { describe, expect, it } from 'vitest'
import { scrubText } from './sentry'

describe('sentry scrubbing', () => {
  it('replaces CAN payload hex sequences with a placeholder', () => {
    expect(scrubText('frame 0A 1B 2C 3D 4E arrived')).toBe('frame [payload] arrived')
    expect(scrubText('bytes 0a:1b:2c:3d')).toBe('bytes [payload]')
  })

  it('replaces frame ids', () => {
    expect(scrubText('promoted 0x360 to draft')).toBe('promoted [frame-id] to draft')
    expect(scrubText('id 0x1E005000 unbound')).toBe('id [frame-id] unbound')
  })

  it('replaces quoted signal and dashboard names', () => {
    expect(scrubText('Signal "oil_press_custom" already bound')).toBe('Signal [name] already bound')
    expect(scrubText("project 'Trackday R32' saved")).toBe('project [name] saved')
  })

  it('keeps ordinary messages intact', () => {
    expect(scrubText('Burn failed: port_busy')).toBe('Burn failed: port_busy')
    expect(scrubText('Device did not come back after reboot')).toBe(
      'Device did not come back after reboot'
    )
  })
})
