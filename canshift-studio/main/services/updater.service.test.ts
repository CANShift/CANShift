// updater.service.test.ts — coverage for the auto-update event wiring
// (issue #219). The release body crossing the IPC boundary must be reduced
// to plain text so a future "What's new" UI cannot accidentally render
// markup (issue #240). Also locks the dev-mode bypass so we don't pester
// developers with bogus update events.
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

const updaterMock = vi.hoisted(() => {
  const listeners = new Map<string, (...args: unknown[]) => void>()
  return {
    listeners,
    autoUpdater: {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        listeners.set(event, fn)
      }),
      checkForUpdates: vi.fn().mockResolvedValue(undefined),
      quitAndInstall: vi.fn(),
    },
  }
})
vi.mock('electron-updater', () => updaterMock)

vi.useFakeTimers()

import { initUpdater, checkForUpdates, installUpdate } from './updater.service'
import { IpcChannels } from '../ipc/ipc-channels'

interface FakeWindow {
  webContents: { send: ReturnType<typeof vi.fn> }
}

function makeWindow(): FakeWindow {
  return { webContents: { send: vi.fn() } }
}

beforeEach(() => {
  // Drop any setTimeout left over from a previous test (initUpdater always
  // schedules a 3 s silent check) before resetting the mocks.
  vi.clearAllTimers()
  updaterMock.listeners.clear()
  updaterMock.autoUpdater.on.mockClear()
  updaterMock.autoUpdater.checkForUpdates.mockClear()
  updaterMock.autoUpdater.quitAndInstall.mockClear()
  // Default to packaged-app behaviour (env unset). Individual tests may flip.
  delete process.env.ELECTRON_RENDERER_URL
})

describe('initUpdater — dev-mode bypass', () => {
  it('registers no listeners when ELECTRON_RENDERER_URL is set (dev mode)', () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
    initUpdater(() => null)
    expect(updaterMock.autoUpdater.on).not.toHaveBeenCalled()
  })

  it('registers update-available, update-downloaded and error listeners in prod', () => {
    initUpdater(() => null)
    const events = updaterMock.autoUpdater.on.mock.calls.map(([event]) => event)
    expect(events).toEqual(
      expect.arrayContaining(['update-available', 'update-downloaded', 'error'])
    )
  })

  it('schedules a silent update check 3 seconds after init', () => {
    initUpdater(() => null)
    expect(updaterMock.autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(updaterMock.autoUpdater.checkForUpdates).toHaveBeenCalledOnce()
  })
})

describe('initUpdater — event forwarding', () => {
  it('sanitises markdown release notes before sending UPDATE_AVAILABLE', () => {
    const win = makeWindow()
    initUpdater(() => win as unknown as Electron.BrowserWindow)

    const onAvailable = updaterMock.listeners.get('update-available')
    expect(onAvailable).toBeDefined()
    onAvailable?.({
      version: '1.2.3',
      releaseDate: '2026-01-01',
      releaseNotes: '# Changelog\n\n<script>alert(1)</script>\n\n- New stuff',
    })

    expect(win.webContents.send).toHaveBeenCalledOnce()
    const call = win.webContents.send.mock.calls[0] as [string, unknown] | undefined
    const channel = call?.[0]
    const payload = call?.[1]
    expect(channel).toBe(IpcChannels.UPDATE_AVAILABLE)
    const sent = payload as {
      version: string
      releaseDate: string
      releaseNotesPlain: string
    }
    expect(sent.version).toBe('1.2.3')
    expect(sent.releaseDate).toBe('2026-01-01')
    // Markdown markers + the script tag must be reduced to plain text. The
    // exact normalised form depends on markdownToPlainText's rules; the
    // contract here is "no raw markup forwarded to the renderer".
    expect(sent.releaseNotesPlain).not.toContain('<script>')
    expect(sent.releaseNotesPlain).not.toContain('# Changelog')
  })

  it('forwards UPDATE_DOWNLOADED with the same sanitisation contract', () => {
    const win = makeWindow()
    initUpdater(() => win as unknown as Electron.BrowserWindow)

    const onDownloaded = updaterMock.listeners.get('update-downloaded')
    onDownloaded?.({
      version: '1.2.3',
      releaseDate: '2026-01-01',
      releaseNotes: 'Plain text notes.',
    })

    expect(win.webContents.send).toHaveBeenCalledOnce()
    const call = win.webContents.send.mock.calls[0] as [string, unknown] | undefined
    const channel = call?.[0]
    const payload = call?.[1]
    expect(channel).toBe(IpcChannels.UPDATE_DOWNLOADED)
    const sent = payload as { version: string; releaseNotesPlain: string }
    expect(sent.version).toBe('1.2.3')
    expect(sent.releaseNotesPlain).toContain('Plain text notes.')
  })

  it('forwards UPDATE_ERROR with the error message only', () => {
    const win = makeWindow()
    initUpdater(() => win as unknown as Electron.BrowserWindow)

    const onError = updaterMock.listeners.get('error')
    onError?.(new Error('network down'))

    expect(win.webContents.send).toHaveBeenCalledWith(IpcChannels.UPDATE_ERROR, {
      message: 'network down',
    })
  })

  it('does not crash when getWindow returns null on event arrival', () => {
    initUpdater(() => null)
    const onAvailable = updaterMock.listeners.get('update-available')
    expect(() =>
      onAvailable?.({
        version: '1.2.3',
        releaseDate: '2026-01-01',
        releaseNotes: '',
      })
    ).not.toThrow()
  })
})

describe('checkForUpdates / installUpdate', () => {
  it('checkForUpdates delegates to autoUpdater.checkForUpdates', () => {
    checkForUpdates()
    expect(updaterMock.autoUpdater.checkForUpdates).toHaveBeenCalledOnce()
  })

  it('installUpdate calls quitAndInstall(false, true) — silent reinstall, force run', () => {
    installUpdate()
    expect(updaterMock.autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })
})
