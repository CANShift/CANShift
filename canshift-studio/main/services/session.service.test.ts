// session.service.test.ts — coverage for the first-run onboarding flag and
// the legacy-user heuristic that protects power users on upgrade.
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let workDir: string

// Mock Electron's app.getPath('userData') so each test gets an isolated dir.
const electronMock = vi.hoisted(() => ({
  app: {
    getPath: vi.fn<(name: string) => string>(),
  },
}))
vi.mock('electron', () => electronMock)

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'cs-session-test-'))
  electronMock.app.getPath.mockReturnValue(workDir)
  vi.resetModules()
})

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
})

async function loadService(): Promise<typeof import('./session.service').sessionService> {
  const mod = await import('./session.service')
  return mod.sessionService
}

async function writeSession(payload: Record<string, unknown>): Promise<void> {
  await writeFile(join(workDir, 'session.json'), JSON.stringify(payload), 'utf-8')
}

describe('sessionService — first-run onboarding', () => {
  it('returns false on a fresh install with no session.json', async () => {
    const service = await loadService()
    expect(service.getFirstRunCompleted()).toBe(false)
  })

  it('persists true after markFirstRunCompleted()', async () => {
    const service = await loadService()
    service.markFirstRunCompleted()
    expect(service.getFirstRunCompleted()).toBe(true)

    // Fresh module load should still see the persisted flag.
    vi.resetModules()
    const reloaded = await loadService()
    expect(reloaded.getFirstRunCompleted()).toBe(true)
  })

  it('treats an existing lastFilePath as a legacy user (no onboarding)', async () => {
    await writeSession({ lastFilePath: '/Users/me/dashboard.json', recentFiles: [] })
    const service = await loadService()
    expect(service.getFirstRunCompleted()).toBe(true)
  })

  it('treats existing recentFiles as a legacy user', async () => {
    await writeSession({ lastFilePath: null, recentFiles: ['/Users/me/dashboard.json'] })
    const service = await loadService()
    expect(service.getFirstRunCompleted()).toBe(true)
  })

  it('treats an existing lastPortPath as a legacy user', async () => {
    await writeSession({ lastFilePath: null, recentFiles: [], lastPortPath: '/dev/tty.usbserial' })
    const service = await loadService()
    expect(service.getFirstRunCompleted()).toBe(true)
  })

  it('honours an explicit firstRunCompleted=false even when legacy signals exist', async () => {
    // Once the user has gone through onboarding (or was reset), the explicit
    // flag wins over the heuristic.
    await writeSession({
      lastFilePath: '/Users/me/dashboard.json',
      recentFiles: ['/Users/me/dashboard.json'],
      firstRunCompleted: false,
    })
    const service = await loadService()
    expect(service.getFirstRunCompleted()).toBe(false)
  })

  it('resetFirstRun() flips a completed flag back to false', async () => {
    const service = await loadService()
    service.markFirstRunCompleted()
    expect(service.getFirstRunCompleted()).toBe(true)
    service.resetFirstRun()
    expect(service.getFirstRunCompleted()).toBe(false)
  })

  it('clear() resets firstRunCompleted to false alongside the rest', async () => {
    const service = await loadService()
    service.markFirstRunCompleted()
    service.addRecentFile('/Users/me/dashboard.json')
    service.clear()
    expect(service.getFirstRunCompleted()).toBe(false)
    expect(service.getRecentFiles()).toEqual([])
    expect(service.getLastFilePath()).toBeNull()
  })

  it('writes a session.json file under app.getPath("userData")', async () => {
    const service = await loadService()
    service.markFirstRunCompleted()
    await access(join(workDir, 'session.json'))
    const raw = await readFile(join(workDir, 'session.json'), 'utf-8')
    const parsed = JSON.parse(raw) as { firstRunCompleted: boolean }
    expect(parsed.firstRunCompleted).toBe(true)
  })
})

describe('sessionService — recent files (dedup, cap, ordering)', () => {
  it('addRecentFile prepends and dedupes the path', async () => {
    const service = await loadService()
    service.addRecentFile('/a/dashboard-1.json')
    service.addRecentFile('/a/dashboard-2.json')
    service.addRecentFile('/a/dashboard-3.json')

    expect(service.getRecentFiles()).toEqual([
      '/a/dashboard-3.json',
      '/a/dashboard-2.json',
      '/a/dashboard-1.json',
    ])

    // Re-adding an existing entry hoists it to the front without duplicating.
    service.addRecentFile('/a/dashboard-1.json')
    expect(service.getRecentFiles()).toEqual([
      '/a/dashboard-1.json',
      '/a/dashboard-3.json',
      '/a/dashboard-2.json',
    ])
  })

  it('caps the list at 10 entries (drops the oldest)', async () => {
    const service = await loadService()
    for (let i = 0; i < 12; i++) {
      service.addRecentFile(`/a/dashboard-${String(i)}.json`)
    }
    const recent = service.getRecentFiles()
    expect(recent).toHaveLength(10)
    expect(recent[0]).toBe('/a/dashboard-11.json')
    // The two oldest entries (0 and 1) must have fallen off.
    expect(recent).not.toContain('/a/dashboard-0.json')
    expect(recent).not.toContain('/a/dashboard-1.json')
  })

  it('addRecentFile also updates lastFilePath', async () => {
    const service = await loadService()
    service.addRecentFile('/a/dashboard.json')
    expect(service.getLastFilePath()).toBe('/a/dashboard.json')
  })

  it('clearRecentFiles wipes the list but preserves lastFilePath and lastPortPath', async () => {
    const service = await loadService()
    service.addRecentFile('/a/dashboard.json')
    service.setLastPortPath('/dev/tty.usbserial')

    service.clearRecentFiles()

    expect(service.getRecentFiles()).toEqual([])
    expect(service.getLastFilePath()).toBe('/a/dashboard.json')
    expect(service.getLastPortPath()).toBe('/dev/tty.usbserial')
  })
})

describe('sessionService — last port path', () => {
  it('setLastPortPath persists across module reloads', async () => {
    const service = await loadService()
    service.setLastPortPath('/dev/tty.usbserial-A1')
    expect(service.getLastPortPath()).toBe('/dev/tty.usbserial-A1')

    vi.resetModules()
    const reloaded = await loadService()
    expect(reloaded.getLastPortPath()).toBe('/dev/tty.usbserial-A1')
  })

  it('setLastPortPath(null) clears the saved port', async () => {
    const service = await loadService()
    service.setLastPortPath('/dev/tty.usbserial')
    service.setLastPortPath(null)
    expect(service.getLastPortPath()).toBeNull()
  })

  it('returns null on a fresh install with no session.json', async () => {
    const service = await loadService()
    expect(service.getLastPortPath()).toBeNull()
    expect(service.getLastFilePath()).toBeNull()
    expect(service.getRecentFiles()).toEqual([])
  })
})

describe('sessionService — corrupt/partial session.json fallbacks', () => {
  it('returns the safe defaults when session.json is unparseable', async () => {
    await writeFile(join(workDir, 'session.json'), '{ not json', 'utf-8')
    const service = await loadService()

    expect(service.getLastFilePath()).toBeNull()
    expect(service.getRecentFiles()).toEqual([])
    expect(service.getLastPortPath()).toBeNull()
    expect(service.getFirstRunCompleted()).toBe(false)
  })

  it('coerces a non-array recentFiles field into an empty array', async () => {
    // Writes from older or buggy versions could land here. The service must
    // never expose a non-array to callers — downstream UI assumes array shape.
    await writeFile(
      join(workDir, 'session.json'),
      JSON.stringify({ recentFiles: 'not an array' }),
      'utf-8'
    )
    const service = await loadService()
    expect(service.getRecentFiles()).toEqual([])
  })

  it('clear() overwrites a corrupt session.json with safe defaults', async () => {
    await writeFile(join(workDir, 'session.json'), '%%%', 'utf-8')
    const service = await loadService()
    service.clear()

    const raw = await readFile(join(workDir, 'session.json'), 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    expect(parsed).toEqual({
      lastFilePath: null,
      recentFiles: [],
      lastPortPath: null,
      firstRunCompleted: false,
    })
  })
})
