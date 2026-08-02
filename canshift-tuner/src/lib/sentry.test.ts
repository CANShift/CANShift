import { describe, expect, it } from 'vitest'
import { scrubText } from './sentry'

describe('sentry scrubbing', () => {
  it('replaces CAN payload hex sequences with a placeholder', () => {
    expect(scrubText('frame 0A 1B 2C 3D 4E arrived')).toBe('frame [payload] arrived')
    expect(scrubText('bytes 0a:1b:2c:3d')).toBe('bytes [payload]')
  })

  it('keeps ordinary messages and short hex intact', () => {
    expect(scrubText('Burn failed: port_busy')).toBe('Burn failed: port_busy')
    expect(scrubText('frame id 0x360 rate 50 Hz')).toBe('frame id 0x360 rate 50 Hz')
  })
})
