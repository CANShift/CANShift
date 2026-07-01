import { describe, it, expect, beforeEach } from 'vitest'
import { useDeviceStore } from './device.store'

const connectAndPopulate = (): void => {
  const s = useDeviceStore.getState()
  s.setConnected('webserial')
  s.setFirmwareVersion('1.2.3')
  s.setFirmwareCheck({ kind: 'up_to_date', version: '1.2.3', checkedAt: 1 })
  s.setFirmwareCompat({ kind: 'mismatch', expected: 2, got: 1, version: '1.2.3' })
  s.setFirmwareLiveness({ kind: 'alive', lastPongAt: 1, uptimeMs: 100 })
  s.pushHeapStats({
    tsMs: 1,
    freeInternal: 1000,
    largestInternal: 500,
    freePsram: null,
    largestPsram: null,
  })
  s.setBurnPhase('pushing')
  s.setIsDayMode(true)
}

describe('device.store setDisconnected (#1704)', () => {
  beforeEach(() => {
    connectAndPopulate()
  })

  it('resets everything that must not survive a reconnect', () => {
    useDeviceStore.getState().setDisconnected()
    const s = useDeviceStore.getState()
    expect(s.status).toBe('disconnected')
    expect(s.connected).toBe(false)
    expect(s.portPath).toBeNull()
    expect(s.transport).toBeNull()
    expect(s.firmwareVersion).toBeNull()
    expect(s.firmwareCheck).toEqual({ kind: 'idle' })
    expect(s.firmwareCompat).toEqual({ kind: 'unknown' })
    expect(s.firmwareLiveness).toEqual({ kind: 'unknown' })
    expect(s.heapStats).toEqual([])
    expect(s.burnPhase).toBe('idle')
    expect(s.isDayMode).toBeNull()
    expect(s.lastPushedConfig).toBeNull()
    expect(s.errorMessage).toBeNull()
  })

  it('surfaces a transport error when one is passed', () => {
    useDeviceStore.getState().setDisconnected('port_gone')
    const s = useDeviceStore.getState()
    expect(s.status).toBe('error')
    expect(s.errorMessage).toBe('port_gone')
    expect(s.connected).toBe(false)
    expect(s.firmwareVersion).toBeNull()
  })
})
