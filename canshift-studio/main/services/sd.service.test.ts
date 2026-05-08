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

describe('sdService.listVolumes — platform branches', () => {
  it('lists /Volumes entries on macOS, excluding system volumes', async () => {
    osMock.platform.mockReturnValue('darwin')
    fsMock.readdir.mockResolvedValueOnce([
      'Macintosh HD',
      'Macintosh HD - Data',
      'Recovery',
      'VM',
      'Preboot',
      'Update',
      '.Spotlight-V100', // dotfile
      'CANSHIFT_SD',
      'My Backup Drive',
    ])

    const volumes = await sdService.listVolumes()
    expect(volumes).toEqual([
      { path: '/Volumes/CANSHIFT_SD', label: 'CANSHIFT_SD' },
      { path: '/Volumes/My Backup Drive', label: 'My Backup Drive' },
    ])
  })

  it('returns an empty list on Linux (unsupported)', async () => {
    osMock.platform.mockReturnValue('linux')
    const volumes = await sdService.listVolumes()
    expect(volumes).toEqual([])
    // Must not even probe /Volumes on Linux.
    expect(fsMock.readdir).not.toHaveBeenCalled()
  })

  it('swallows readdir errors and returns an empty list (no propagated throw)', async () => {
    osMock.platform.mockReturnValue('darwin')
    fsMock.readdir.mockRejectedValueOnce(new Error('EACCES /Volumes'))

    const volumes = await sdService.listVolumes()
    expect(volumes).toEqual([])
  })

  it('probes drive letters D-Z on Windows via access()', async () => {
    osMock.platform.mockReturnValue('win32')
    // access() resolves for present drives, rejects for missing ones. Our
    // helper uses .then(()=>true).catch(()=>false), so a single resolve is
    // sufficient. Make D: and F: resolve, the rest reject.
    fsMock.access.mockImplementation((p: unknown) => {
      const path = String(p)
      if (path === 'D:\\' || path === 'F:\\') return Promise.resolve()
      return Promise.reject(new Error('ENOENT'))
    })

    const volumes = await sdService.listVolumes()
    expect(volumes).toEqual([
      { path: 'D:\\', label: 'D:' },
      { path: 'F:\\', label: 'F:' },
    ])
  })
})

describe('sdService.pushOverUsb — push events and user-data preservation', () => {
  beforeEach(() => {
    fsMock.readdir.mockReset()
    fsMock.copyFile.mockReset()
    fsMock.access.mockReset()
    fsMock.mkdir.mockReset()
    fsMock.readFile.mockReset()
  })

  it('emits per-file progress events and skips config/* user data', async () => {
    // Walk: top-level returns assets/ + config/. Fake file tree:
    //   assets/font.bin
    //   assets/icon.bin
    //   config/dashboard.json
    fsMock.readdir.mockImplementation((dir: unknown) => {
      const path = String(dir)
      if (path.endsWith('sd_contents')) {
        return Promise.resolve([
          { name: 'assets', isDirectory: (): boolean => true },
          { name: 'config', isDirectory: (): boolean => true },
        ] as unknown)
      }
      if (path.endsWith('assets')) {
        return Promise.resolve([
          { name: 'font.bin', isDirectory: (): boolean => false },
          { name: 'icon.bin', isDirectory: (): boolean => false },
        ] as unknown)
      }
      if (path.endsWith('config')) {
        return Promise.resolve([
          { name: 'dashboard.json', isDirectory: (): boolean => false },
        ] as unknown)
      }
      return Promise.resolve([] as unknown)
    })
    fsMock.readFile.mockResolvedValue(Buffer.from('binary content'))

    const pushFile = vi.fn().mockResolvedValue({ success: true })
    const usbService = { pushFile } as unknown as Parameters<typeof sdService.pushOverUsb>[0]
    const onProgress = vi.fn()

    const result = await sdService.pushOverUsb(usbService, onProgress)

    expect(result.success).toBe(true)
    // assets/* pushed, config/* skipped.
    expect(result.copied.sort()).toEqual(['assets/font.bin', 'assets/icon.bin'])
    expect(result.skipped).toEqual(['config/dashboard.json'])

    // Two progress events, one per pushed file, with monotonic indexes.
    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      fileIndex: 0,
      totalFiles: 2,
      relPath: expect.stringMatching(/^assets\//) as unknown,
    })
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      fileIndex: 1,
      totalFiles: 2,
      relPath: expect.stringMatching(/^assets\//) as unknown,
    })

    // pushFile must receive a leading slash in the destination path.
    for (const call of pushFile.mock.calls) {
      const dest = call[0] as string
      expect(dest.startsWith('/')).toBe(true)
      expect(dest.startsWith('/config/')).toBe(false)
    }
  })

  it('aborts on the first pushFile failure and surfaces the error', async () => {
    fsMock.readdir.mockImplementation((dir: unknown) => {
      const path = String(dir)
      if (path.endsWith('sd_contents')) {
        return Promise.resolve([{ name: 'assets', isDirectory: (): boolean => true }] as unknown)
      }
      if (path.endsWith('assets')) {
        return Promise.resolve([
          { name: 'a.bin', isDirectory: (): boolean => false },
          { name: 'b.bin', isDirectory: (): boolean => false },
        ] as unknown)
      }
      return Promise.resolve([] as unknown)
    })
    fsMock.readFile.mockResolvedValue(Buffer.from(''))

    const pushFile = vi.fn().mockResolvedValueOnce({ success: false, error: 'firmware NACK' })
    const usbService = { pushFile } as unknown as Parameters<typeof sdService.pushOverUsb>[0]

    const result = await sdService.pushOverUsb(usbService)

    expect(result.success).toBe(false)
    expect(result.error).toBe('firmware NACK')
    expect(result.copied).toEqual([])
    // The push stops at the first failure — only one pushFile call should
    // have been made even though there were two files to process.
    expect(pushFile).toHaveBeenCalledTimes(1)
  })

  it('falls back to a synthetic error message when pushFile fails without one', async () => {
    fsMock.readdir.mockImplementation((dir: unknown) => {
      const path = String(dir)
      if (path.endsWith('sd_contents')) {
        return Promise.resolve([{ name: 'assets', isDirectory: (): boolean => true }] as unknown)
      }
      if (path.endsWith('assets')) {
        return Promise.resolve([
          { name: 'silent.bin', isDirectory: (): boolean => false },
        ] as unknown)
      }
      return Promise.resolve([] as unknown)
    })
    fsMock.readFile.mockResolvedValue(Buffer.from(''))

    const pushFile = vi.fn().mockResolvedValueOnce({ success: false })
    const usbService = { pushFile } as unknown as Parameters<typeof sdService.pushOverUsb>[0]

    const result = await sdService.pushOverUsb(usbService)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Failed to push assets\/silent\.bin/)
  })

  it('surfaces an error when reading sd_contents/ fails', async () => {
    fsMock.readdir.mockRejectedValueOnce(new Error('ENOENT sd_contents'))

    const usbService = { pushFile: vi.fn() } as unknown as Parameters<
      typeof sdService.pushOverUsb
    >[0]
    const result = await sdService.pushOverUsb(usbService)

    expect(result.success).toBe(false)
    expect(result.error).toBe('ENOENT sd_contents')
    expect(result.copied).toEqual([])
  })
})
