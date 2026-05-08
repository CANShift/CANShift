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

// ---------------------------------------------------------------------------
// Issue #219 — recent-files dedupe + cap and lastPortPath round-trip
// ---------------------------------------------------------------------------

describe('sessionService.addRecentFile — dedupe and cap (#219)', () => {
  it('deduplicates the same path so it appears once at the head', async () => {
    const service = await loadService()
    service.addRecentFile('/Users/me/a.json')
    service.addRecentFile('/Users/me/b.json')
    service.addRecentFile('/Users/me/a.json') // re-add — should move to head

    expect(service.getRecentFiles()).toEqual(['/Users/me/a.json', '/Users/me/b.json'])
  })

  it('caps recent files at 10 entries — oldest evicted first', async () => {
    const service = await loadService()
    for (let i = 0; i < 12; i++) {
      service.addRecentFile(`/Users/me/file-${String(i)}.json`)
    }
    const recents = service.getRecentFiles()
    expect(recents).toHaveLength(10)
    // Newest at the head, oldest two evicted (file-0 and file-1).
    expect(recents[0]).toBe('/Users/me/file-11.json')
    expect(recents).not.toContain('/Users/me/file-0.json')
    expect(recents).not.toContain('/Users/me/file-1.json')
  })

  it('also updates lastFilePath on each add', async () => {
    const service = await loadService()
    service.addRecentFile('/Users/me/a.json')
    expect(service.getLastFilePath()).toBe('/Users/me/a.json')
    service.addRecentFile('/Users/me/b.json')
    expect(service.getLastFilePath()).toBe('/Users/me/b.json')
  })
})

describe('sessionService.lastPortPath round-trip (#219)', () => {
  it('returns null on a fresh install', async () => {
    const service = await loadService()
    expect(service.getLastPortPath()).toBeNull()
  })

  it('persists a port path through setLastPortPath', async () => {
    const service = await loadService()
    service.setLastPortPath('/dev/tty.usbserial-A1B2')
    expect(service.getLastPortPath()).toBe('/dev/tty.usbserial-A1B2')
  })

  it('clears the port path when set to null', async () => {
    const service = await loadService()
    service.setLastPortPath('/dev/tty.test')
    service.setLastPortPath(null)
    expect(service.getLastPortPath()).toBeNull()
  })

  it('survives a module reload', async () => {
    const service = await loadService()
    service.setLastPortPath('/dev/tty.persistent')

    vi.resetModules()
    const reloaded = await loadService()
    expect(reloaded.getLastPortPath()).toBe('/dev/tty.persistent')
  })
})

describe('sessionService — corrupt session.json (#219)', () => {
  it('returns defaults when the file is malformed JSON', async () => {
    await writeFile(join(workDir, 'session.json'), '{ not json', 'utf-8')
    const service = await loadService()

    expect(service.getLastFilePath()).toBeNull()
    expect(service.getRecentFiles()).toEqual([])
    expect(service.getLastPortPath()).toBeNull()
    expect(service.getFirstRunCompleted()).toBe(false)
  })

  it('coerces a non-array recentFiles field to []', async () => {
    await writeSession({ recentFiles: 'not an array', lastFilePath: '/foo.json' })
    const service = await loadService()
    expect(service.getRecentFiles()).toEqual([])
    // Other fields still survive the coercion.
    expect(service.getLastFilePath()).toBe('/foo.json')
  })

  it('does not crash on writes when the userData dir is missing', async () => {
    // Point app.getPath at a directory we just deleted — every write should
    // swallow ENOENT silently and getters fall back to defaults.
    await rm(workDir, { recursive: true, force: true })
    const service = await loadService()

    expect(() => {
      service.markFirstRunCompleted()
      service.setLastPortPath('/dev/tty.x')
      service.addRecentFile('/Users/me/a.json')
    }).not.toThrow()

    // Reads also fall through to defaults — best-effort persistence is the
    // documented contract.
    expect(service.getFirstRunCompleted()).toBe(false)
    expect(service.getLastPortPath()).toBeNull()
    expect(service.getRecentFiles()).toEqual([])
  })
})
