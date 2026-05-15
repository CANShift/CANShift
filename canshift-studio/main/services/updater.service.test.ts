// updater.service.test.ts — coverage for the auto-update event-to-IPC bridge.
//
// The renderer never sees raw markdown from GitHub release bodies — the
// markdownToPlainText() pass in main is the only sanitisation barrier (#240).
// Lock down that contract: untrusted upstream content must reach the renderer
// as plain text, and the IPC payload shape must match the discriminated union
// from updater.service.types.
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IpcChannels } from '../../shared/ipc-channels'
import type { UpdateAvailablePayload, UpdateErrorPayload } from '../../shared/updater.service.types'

type UpdaterEvent = 'update-available' | 'update-downloaded' | 'error'
type UpdaterListener<E extends UpdaterEvent> = E extends 'error'
  ? (err: Error) => void
  : (info: { version: string; releaseDate: string; releaseNotes?: string | null }) => void

const updaterMock = vi.hoisted(() => {
  const listeners = new Map<UpdaterEvent, UpdaterListener<UpdaterEvent>>()
  return {
    autoUpdater: {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      on: vi.fn(<E extends UpdaterEvent>(event: E, cb: UpdaterListener<E>): void => {
        listeners.set(event, cb)
      }),
      checkForUpdates: vi.fn(),
      quitAndInstall: vi.fn(),
    },
    listeners,
    fire<E extends UpdaterEvent>(
      event: E,
      payload: E extends 'error' ? Error : Parameters<UpdaterListener<E>>[0]
    ): void {
      const listener = listeners.get(event)
      if (!listener) throw new Error(`No listener registered for ${event}`)
      ;(listener as (p: unknown) => void)(payload)
    },
  }
})

vi.mock('electron-updater', () => ({
  autoUpdater: updaterMock.autoUpdater,
  // UpdateInfo is a type-only import in the source — surface it as a no-op
  // value so vi.mock's CommonJS transform doesn't trip on the missing export.
  UpdateInfo: undefined,
}))

beforeEach(() => {
  updaterMock.autoUpdater.on.mockClear()
  updaterMock.autoUpdater.checkForUpdates.mockClear()
  updaterMock.autoUpdater.quitAndInstall.mockClear()
  updaterMock.listeners.clear()
  vi.useRealTimers()
})

interface CapturedSend {
  channel: string
  payload: unknown
}

function makeWindow(): {
  webContents: { send: (channel: string, payload: unknown) => void }
  sends: CapturedSend[]
} {
  const sends: CapturedSend[] = []
  return {
    sends,
    webContents: {
      send: (channel: string, payload: unknown): void => {
        sends.push({ channel, payload })
      },
    },
  }
}

async function loadInPackagedMode(): Promise<typeof import('./updater.service')> {
  // initUpdater() bails when ELECTRON_RENDERER_URL is set (dev mode) — mirror
  // the packaged-app environment for tests.
  delete process.env.ELECTRON_RENDERER_URL
  vi.resetModules()
  return import('./updater.service')
}

describe('updater.service — initUpdater event wiring', () => {
  it('forwards update-available with sanitized release notes (#240)', async () => {
    const { initUpdater } = await loadInPackagedMode()
    vi.useFakeTimers()
    const win = makeWindow()
    initUpdater(() => win as unknown as Electron.BrowserWindow)

    updaterMock.fire('update-available', {
      version: '0.7.2',
      releaseDate: '2026-05-08T12:00:00Z',
      releaseNotes: '## Heading\n[link](https://x) **bold** plain text',
    })

    expect(win.sends).toHaveLength(1)
    const sent = win.sends[0]
    expect(sent?.channel).toBe(IpcChannels.UPDATE_AVAILABLE)
    const payload = sent?.payload as UpdateAvailablePayload
    expect(payload.version).toBe('0.7.2')
    expect(payload.releaseDate).toBe('2026-05-08T12:00:00Z')
    // The plain-text pass strips markdown — the heading hashes and the link
    // brackets must be gone, but the visible words remain.
    expect(payload.releaseNotesPlain).not.toMatch(/##|\[|\]\(/)
    expect(payload.releaseNotesPlain).toMatch(/Heading/)
    expect(payload.releaseNotesPlain).toMatch(/bold/)
  })

  it('forwards update-downloaded on the dedicated channel', async () => {
    const { initUpdater } = await loadInPackagedMode()
    vi.useFakeTimers()
    const win = makeWindow()
    initUpdater(() => win as unknown as Electron.BrowserWindow)

    updaterMock.fire('update-downloaded', {
      version: '0.7.2',
      releaseDate: '2026-05-08T12:00:00Z',
      releaseNotes: 'Notes',
    })

    expect(win.sends).toHaveLength(1)
    expect(win.sends[0]?.channel).toBe(IpcChannels.UPDATE_DOWNLOADED)
  })

  it('forwards error events as { message } payloads', async () => {
    const { initUpdater } = await loadInPackagedMode()
    vi.useFakeTimers()
    const win = makeWindow()
    initUpdater(() => win as unknown as Electron.BrowserWindow)

    updaterMock.fire('error', new Error('Network down'))

    expect(win.sends).toHaveLength(1)
    const sent = win.sends[0]
    expect(sent?.channel).toBe(IpcChannels.UPDATE_ERROR)
    const payload = sent?.payload as UpdateErrorPayload
    expect(payload).toEqual({ message: 'Network down' })
  })

  it('coerces null release notes to an empty plain-text string', async () => {
    const { initUpdater } = await loadInPackagedMode()
    vi.useFakeTimers()
    const win = makeWindow()
    initUpdater(() => win as unknown as Electron.BrowserWindow)

    updaterMock.fire('update-available', {
      version: '0.7.2',
      releaseDate: '2026-05-08T12:00:00Z',
      releaseNotes: null,
    })

    const payload = win.sends[0]?.payload as UpdateAvailablePayload
    expect(payload.releaseNotesPlain).toBe('')
  })

  it('drops events when getWindow() returns null (closed window)', async () => {
    const { initUpdater } = await loadInPackagedMode()
    vi.useFakeTimers()
    initUpdater(() => null)

    // Must not throw — the optional chaining on .webContents.send protects this.
    expect(() => {
      updaterMock.fire('update-available', {
        version: '0.7.2',
        releaseDate: '2026-05-08T12:00:00Z',
        releaseNotes: 'whatever',
      })
    }).not.toThrow()
  })

  it('configures autoDownload=true and autoInstallOnAppQuit=false', async () => {
    const { initUpdater } = await loadInPackagedMode()
    vi.useFakeTimers()
    initUpdater(() => null)

    expect(updaterMock.autoUpdater.autoDownload).toBe(true)
    expect(updaterMock.autoUpdater.autoInstallOnAppQuit).toBe(false)
  })

  it('runs a silent check 3 seconds after init', async () => {
    const { initUpdater } = await loadInPackagedMode()
    vi.useFakeTimers()
    initUpdater(() => null)

    expect(updaterMock.autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3_000)
    expect(updaterMock.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('is a no-op in dev mode (ELECTRON_RENDERER_URL set)', async () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
    vi.resetModules()
    const { initUpdater } = await import('./updater.service')
    initUpdater(() => null)

    // No event listeners registered when init bails.
    expect(updaterMock.autoUpdater.on).not.toHaveBeenCalled()
    delete process.env.ELECTRON_RENDERER_URL
  })
})

describe('updater.service — public command wrappers', () => {
  it('checkForUpdates delegates to autoUpdater.checkForUpdates', async () => {
    const { checkForUpdates } = await loadInPackagedMode()
    checkForUpdates()
    expect(updaterMock.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('installUpdate calls quitAndInstall(silent=false, forceRunAfter=true)', async () => {
    const { installUpdate } = await loadInPackagedMode()
    installUpdate()
    expect(updaterMock.autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })
})
