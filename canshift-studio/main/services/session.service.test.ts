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
