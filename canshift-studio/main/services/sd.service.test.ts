// sd.service.test.ts — coverage for the volume allowlist guarding SD_PREPARE
// (#214). A compromised renderer must not be able to write the sd_contents/
// tree into an arbitrary directory by passing a fabricated volumePath.
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub Electron's app — sdContentsPath() reads it, but prepareSD bails on the
// volume guard before any FS work, so a minimal stub is enough.
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: (): string => '/tmp/canshift-studio-fake',
    getPath: (): string => '/tmp/canshift-studio-fake',
  },
}))

const osMock = vi.hoisted(() => ({
  platform: vi.fn<() => NodeJS.Platform>(),
}))
vi.mock('node:os', () => osMock)

const fsMock = vi.hoisted(() => ({
  readdir: vi.fn(),
  copyFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
}))
vi.mock('node:fs/promises', () => fsMock)

import { sdService } from './sd.service'

beforeEach(() => {
  fsMock.readdir.mockReset()
  fsMock.copyFile.mockReset()
  fsMock.access.mockReset()
  fsMock.mkdir.mockReset()
  fsMock.readFile.mockReset()
  osMock.platform.mockReset()
})

describe('sdService.prepareSD — volume allowlist (#214)', () => {
  it('rejects a renderer-supplied path that is not in the current volume list', async () => {
    osMock.platform.mockReturnValue('darwin')
    // Pretend /Volumes contains exactly one removable volume.
    fsMock.readdir.mockResolvedValueOnce(['CANSHIFT_SD'])

    const result = await sdService.prepareSD('/Users/victim/Documents')

    expect(result.success).toBe(false)
    expect(result.error).toBe('blocked: volumePath not in current volume list')
    // The guard runs before any directory walk — no copy/mkdir touched.
    expect(fsMock.copyFile).not.toHaveBeenCalled()
    expect(fsMock.mkdir).not.toHaveBeenCalled()
  })

  it('rejects a path-traversal attempt that resolves outside listed volumes', async () => {
    osMock.platform.mockReturnValue('darwin')
    fsMock.readdir.mockResolvedValueOnce(['CANSHIFT_SD'])

    // /Volumes/CANSHIFT_SD/../../etc resolves to /etc — must be rejected even
    // though the prefix matches a listed volume.
    const traversal = '/Volumes/CANSHIFT_SD/../../etc'
    const result = await sdService.prepareSD(traversal)

    expect(result.success).toBe(false)
    expect(result.error).toBe('blocked: volumePath not in current volume list')
  })

  it('rejects when no volumes are mounted', async () => {
    osMock.platform.mockReturnValue('darwin')
    fsMock.readdir.mockResolvedValueOnce([])

    const result = await sdService.prepareSD('/Volumes/CANSHIFT_SD')

    expect(result.success).toBe(false)
    expect(result.error).toBe('blocked: volumePath not in current volume list')
  })
})
