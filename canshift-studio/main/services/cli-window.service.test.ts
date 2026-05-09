// cli-window.service.test.ts — coverage for the persisted bounds of the
// detached CLI window (issue #433).
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let workDir: string

const electronMock = vi.hoisted(() => ({
  app: {
    getPath: vi.fn<(name: string) => string>(),
  },
  screen: {
    getPrimaryDisplay: vi.fn<() => Electron.Display>(),
    getAllDisplays: vi.fn<() => Electron.Display[]>(),
  },
}))

vi.mock('electron', () => electronMock)

function makeDisplay(workArea: {
  x: number
  y: number
  width: number
  height: number
}): Electron.Display {
  // Cast — only the fields used by cli-window.service.ts are populated.
  return { workArea } as unknown as Electron.Display
}

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'cs-cli-window-test-'))
  electronMock.app.getPath.mockReturnValue(workDir)
  // Default: a single 1920x1080 primary display at origin.
  const primary = makeDisplay({ x: 0, y: 0, width: 1920, height: 1080 })
  electronMock.screen.getPrimaryDisplay.mockReturnValue(primary)
  electronMock.screen.getAllDisplays.mockReturnValue([primary])
  vi.resetModules()
})

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
})

async function loadModule(): Promise<typeof import('./cli-window.service')> {
  return import('./cli-window.service')
}

describe('cli-window.service — bounds round-trip', () => {
  it('persists and reads back a sane rectangle', async () => {
    const mod = await loadModule()
    mod.saveCliWindowBounds({ x: 100, y: 80, width: 800, height: 480 })

    vi.resetModules()
    const reloaded = await loadModule()
    const bounds = reloaded.loadCliWindowBounds()
    expect(bounds).toEqual({ x: 100, y: 80, width: 800, height: 480 })

    const raw = await readFile(join(workDir, 'cli-window.json'), 'utf-8')
    expect(JSON.parse(raw)).toEqual({ x: 100, y: 80, width: 800, height: 480 })
  })

  it('falls back to default centered bounds when nothing is persisted yet', async () => {
    const mod = await loadModule()
    const bounds = mod.loadCliWindowBounds()
    // Default is 720x360 centered on the 1920x1080 primary display.
    expect(bounds.width).toBe(720)
    expect(bounds.height).toBe(360)
    expect(bounds.x).toBe(Math.floor((1920 - 720) / 2))
    expect(bounds.y).toBe(Math.floor((1080 - 360) / 2))
  })
})

describe('cli-window.service — off-screen fallback', () => {
  it('replaces persisted bounds with default when no display covers them', async () => {
    // Simulate a previously-saved rectangle on a now-disconnected monitor at
    // x=3000 (beyond the only attached 1920x1080 display).
    await writeFile(
      join(workDir, 'cli-window.json'),
      JSON.stringify({ x: 3000, y: 100, width: 800, height: 480 }),
      'utf-8'
    )
    const mod = await loadModule()
    const bounds = mod.loadCliWindowBounds()
    // Should have snapped back to centered defaults on the primary display.
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1920)
    expect(bounds.width).toBe(720)
    expect(bounds.height).toBe(360)
  })

  it('keeps persisted bounds that overlap any attached display', async () => {
    // Two displays — primary 1920x1080 + secondary 1024x768 at x=1920.
    const primary = makeDisplay({ x: 0, y: 0, width: 1920, height: 1080 })
    const secondary = makeDisplay({ x: 1920, y: 0, width: 1024, height: 768 })
    electronMock.screen.getPrimaryDisplay.mockReturnValue(primary)
    electronMock.screen.getAllDisplays.mockReturnValue([primary, secondary])

    await writeFile(
      join(workDir, 'cli-window.json'),
      JSON.stringify({ x: 2200, y: 100, width: 600, height: 360 }),
      'utf-8'
    )
    const mod = await loadModule()
    const bounds = mod.loadCliWindowBounds()
    expect(bounds).toEqual({ x: 2200, y: 100, width: 600, height: 360 })
  })
})

describe('cli-window.service — min-size clamp', () => {
  it('clamps width/height below the minimum on save and load', async () => {
    const mod = await loadModule()
    mod.saveCliWindowBounds({ x: 50, y: 50, width: 100, height: 80 })
    const bounds = mod.loadCliWindowBounds()
    expect(bounds.width).toBe(mod.CLI_WINDOW_MIN_WIDTH)
    expect(bounds.height).toBe(mod.CLI_WINDOW_MIN_HEIGHT)
  })

  it('rejects malformed JSON and falls back to default bounds', async () => {
    await writeFile(join(workDir, 'cli-window.json'), '{ not json', 'utf-8')
    const mod = await loadModule()
    const bounds = mod.loadCliWindowBounds()
    expect(bounds.width).toBe(720)
    expect(bounds.height).toBe(360)
  })

  it('rejects non-numeric fields and falls back to default bounds', async () => {
    await writeFile(
      join(workDir, 'cli-window.json'),
      JSON.stringify({ x: 'wrong', y: 0, width: 800, height: 480 }),
      'utf-8'
    )
    const mod = await loadModule()
    const bounds = mod.loadCliWindowBounds()
    expect(bounds.width).toBe(720)
    expect(bounds.height).toBe(360)
  })
})
