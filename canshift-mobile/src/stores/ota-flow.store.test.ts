// ota-flow.store.test.ts — Coverage for the in-session OTA flow cache (#1165).

import type { FirmwareRelease } from '../services/ota.service'
import { useOtaFlowStore } from './ota-flow.store'

const mockRelease: FirmwareRelease = {
  version: '1.2.3',
  publishedAt: '2026-01-01T00:00:00Z',
  notes: '',
  downloadUrl: 'https://example.com/fw.bin',
  sizeBytes: 1024,
  sha256: 'abc123',
}

describe('ota-flow.store', () => {
  beforeEach(() => {
    useOtaFlowStore.getState().clear()
  })

  it('starts in idle state', () => {
    const s = useOtaFlowStore.getState()
    expect(s.stage).toBe('idle')
    expect(s.release).toBeNull()
    expect(s.localPath).toBeNull()
    expect(s.verifiedSha).toBeNull()
    expect(s.verifiedAt).toBeNull()
  })

  it('setDownloaded transitions to downloaded with path, no verifiedSha', () => {
    useOtaFlowStore.getState().setDownloaded(mockRelease, '/cache/fw.bin')
    const s = useOtaFlowStore.getState()
    expect(s.stage).toBe('downloaded')
    expect(s.release).toEqual(mockRelease)
    expect(s.localPath).toBe('/cache/fw.bin')
    expect(s.verifiedSha).toBeNull()
    expect(s.verifiedAt).toBeNull()
  })

  it('setVerified after setDownloaded produces verified stage with sha and timestamp', () => {
    useOtaFlowStore.getState().setDownloaded(mockRelease, '/cache/fw.bin')
    const before = Date.now()
    useOtaFlowStore.getState().setVerified(mockRelease, '/cache/fw.bin', 'abc123')
    const after = Date.now()
    const s = useOtaFlowStore.getState()
    expect(s.stage).toBe('verified')
    expect(s.localPath).toBe('/cache/fw.bin')
    expect(s.verifiedSha).toBe('abc123')
    expect(s.verifiedAt).not.toBeNull()
    expect(s.verifiedAt).toBeGreaterThanOrEqual(before)
    expect(s.verifiedAt).toBeLessThanOrEqual(after)
  })

  it('clear resets to idle with all nulls', () => {
    useOtaFlowStore.getState().setVerified(mockRelease, '/cache/fw.bin', 'abc123')
    useOtaFlowStore.getState().clear()
    const s = useOtaFlowStore.getState()
    expect(s.stage).toBe('idle')
    expect(s.release).toBeNull()
    expect(s.localPath).toBeNull()
    expect(s.verifiedSha).toBeNull()
    expect(s.verifiedAt).toBeNull()
  })
})
