// ota-cache.test.ts — Coverage for the isStillValid() cache helper (#1165).

import * as FileSystem from 'expo-file-system'
import type { OtaFlowState } from '../stores/ota-flow.store'
import { isStillValid } from './ota-cache'

jest.mock('expo-file-system')
const mockGetInfoAsync = FileSystem.getInfoAsync as jest.Mock

const mockRelease = {
  version: '1.2.3',
  publishedAt: '2026-01-01T00:00:00Z',
  notes: '',
  downloadUrl: 'https://example.com/fw.bin',
  sizeBytes: 1024,
  sha256: 'abc123',
}

function makeEntry(overrides: Partial<OtaFlowState> = {}): OtaFlowState {
  return {
    stage: 'verified',
    release: mockRelease,
    localPath: '/cache/fw.bin',
    verifiedSha: 'abc123',
    verifiedAt: Date.now(),
    setDownloaded: jest.fn(),
    setVerified: jest.fn(),
    clear: jest.fn(),
    ...overrides,
  }
}

beforeEach(() => jest.clearAllMocks())

describe('isStillValid', () => {
  it('returns true for a fresh verified entry with existing file', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true })
    expect(await isStillValid(makeEntry())).toBe(true)
  })

  it('returns false when stage is not verified', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true })
    expect(await isStillValid(makeEntry({ stage: 'downloaded' }))).toBe(false)
  })

  it('returns false when stage is idle', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true })
    expect(
      await isStillValid(
        makeEntry({ stage: 'idle', release: null, localPath: null, verifiedAt: null })
      )
    ).toBe(false)
  })

  it('returns false when the local file is missing', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: false })
    expect(await isStillValid(makeEntry())).toBe(false)
  })

  it('returns false when TTL is expired (>24 h)', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true })
    const expired = makeEntry({ verifiedAt: Date.now() - 25 * 60 * 60 * 1000 })
    expect(await isStillValid(expired)).toBe(false)
  })

  it('returns false when verifiedAt is null', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true })
    expect(await isStillValid(makeEntry({ verifiedAt: null }))).toBe(false)
  })

  it('returns false when localPath is null', async () => {
    expect(await isStillValid(makeEntry({ localPath: null }))).toBe(false)
  })
})
