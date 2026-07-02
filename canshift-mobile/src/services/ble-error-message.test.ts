import { bleErrorMessage } from './ble-error-message'
import type { BleConnectionError } from './ble.errors'

describe('bleErrorMessage', () => {
  it('maps bluetooth-off to a curated title and body', () => {
    expect(bleErrorMessage({ kind: 'bluetooth-off' })).toEqual({
      title: 'Bluetooth is off',
      body: 'Turn Bluetooth on to connect to your dashboard.',
    })
  })

  it('maps not-paired', () => {
    expect(bleErrorMessage({ kind: 'not-paired' }).title).toBe('Device not found')
  })

  it('maps not-in-range', () => {
    expect(bleErrorMessage({ kind: 'not-in-range' }).title).toBe('Device out of range')
  })

  it('maps disconnected', () => {
    expect(bleErrorMessage({ kind: 'disconnected' }).title).toBe('Disconnected')
  })

  it('maps characteristic-missing to incompatible firmware', () => {
    expect(bleErrorMessage({ kind: 'characteristic-missing' }).title).toBe('Incompatible firmware')
  })

  it('uses the write-failed reason as the body when present', () => {
    expect(bleErrorMessage({ kind: 'write-failed', reason: 'timeout' }).body).toBe('timeout')
  })

  it('falls back to a generic body when write-failed has no reason', () => {
    expect(bleErrorMessage({ kind: 'write-failed' }).body).toBe(
      'A BLE write failed. Try again in a moment.'
    )
  })

  it('gives platform-specific copy for permission-denied on android', () => {
    expect(bleErrorMessage({ kind: 'permission-denied', platform: 'android' }).body).toContain(
      'nearby devices permission'
    )
  })

  it('gives platform-specific copy for permission-denied on ios', () => {
    expect(bleErrorMessage({ kind: 'permission-denied', platform: 'ios' }).body).toContain(
      'Bluetooth access'
    )
  })

  it('surfaces the raw message for unknown errors', () => {
    const err: BleConnectionError = { kind: 'unknown', message: 'boom' }
    expect(bleErrorMessage(err)).toEqual({ title: 'Connection failed', body: 'boom' })
  })
})
