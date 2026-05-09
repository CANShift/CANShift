// cli-window.test.ts — coverage for the detached CLI BrowserWindow lifecycle
// (issue #433). The Electron `BrowserWindow` constructor is mocked so the
// test stays in pure node land — we only exercise our wiring on top.
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IpcChannels } from '../ipc/ipc-channels'

interface CapturedSend {
  channel: string
  payload: unknown
}

interface FakeWebContents {
  id: number
  send: (channel: string, payload: unknown) => void
  isDestroyed: () => boolean
  on: (event: string, listener: (...args: unknown[]) => void) => void
}

interface FakeBrowserWindow {
  id: number
  webContents: FakeWebContents
  on: (event: string, listener: (...args: unknown[]) => void) => FakeBrowserWindow
  once: (event: string, listener: (...args: unknown[]) => void) => FakeBrowserWindow
  loadURL: (url: string) => Promise<void>
  loadFile: (file: string, opts?: unknown) => Promise<void>
  isDestroyed: () => boolean
  show: () => void
  close: () => void
  destroy: () => void
  getBounds: () => { x: number; y: number; width: number; height: number }
  __emit: (event: string, ...args: unknown[]) => void
  __destroyed: boolean
  __sends: CapturedSend[]
}

let nextId = 100

function buildFakeBrowserWindow(): FakeBrowserWindow {
  const id = nextId++
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()
  const wcListeners = new Map<string, ((...args: unknown[]) => void)[]>()
  const sends: CapturedSend[] = []
  const win: FakeBrowserWindow = {
    id,
    webContents: {
      id: id + 1000,
      send: (channel, payload) => {
        sends.push({ channel, payload })
      },
      isDestroyed: () => false,
      on: (event, listener) => {
        const list = wcListeners.get(event) ?? []
        list.push(listener)
        wcListeners.set(event, list)
      },
    },
    on: (event, listener) => {
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
      return win
    },
    once: (event, listener) => {
      const list = listeners.get(event) ?? []
      list.push((...args) => {
        listener(...args)
      })
      listeners.set(event, list)
      return win
    },
    loadURL: () => Promise.resolve(),
    loadFile: () => Promise.resolve(),
    isDestroyed: () => win.__destroyed,
    show: () => undefined,
    close: () => {
      win.__emit('close')
      win.__destroyed = true
      win.__emit('closed')
    },
    destroy: () => {
      win.__destroyed = true
      win.__emit('closed')
    },
    getBounds: () => ({ x: 100, y: 100, width: 800, height: 400 }),
    __emit: (event, ...args) => {
      const ls = listeners.get(event) ?? wcListeners.get(event) ?? []
      for (const l of ls) {
        l(...args)
      }
    },
    __destroyed: false,
    __sends: sends,
  }
  return win
}

const electronMock = vi.hoisted(() => {
  const created: unknown[] = []
  let userDataPath = '/tmp/cli-window-test'
  let factory: (() => unknown) | null = null
  // `new` returns the constructor's explicit object return rather than `this`,
  // so we hand back the fully-built fake whose closures point at its own state.
  function FakeBrowserWindowCtor(): object {
    const win = factory === null ? {} : factory()
    created.push(win)
    return win as object
  }
  return {
    BrowserWindow: FakeBrowserWindowCtor,
    app: {
      getPath: (): string => userDataPath,
    },
    screen: {
      getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }),
      getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
    },
    __created: created,
    __setUserDataPath: (p: string): void => {
      userDataPath = p
    },
    __setFactory: (f: () => unknown): void => {
      factory = f
    },
  }
})

vi.mock('electron', () => electronMock)

let tmpUserData: string

beforeEach(() => {
  tmpUserData = mkdtempSync(join(tmpdir(), 'cli-window-test-'))
  electronMock.__setUserDataPath(tmpUserData)
  electronMock.__created.length = 0
  nextId = 100
  electronMock.__setFactory(() => buildFakeBrowserWindow())
  vi.resetModules()
})

afterEach(() => {
  rmSync(tmpUserData, { recursive: true, force: true })
})

async function loadModule(): Promise<typeof import('./cli-window')> {
  return import('./cli-window')
}

interface FakeMain {
  win: FakeBrowserWindow
  sends: CapturedSend[]
}

function makeMainWindow(): FakeMain {
  const sends: CapturedSend[] = []
  const win: FakeBrowserWindow = {
    id: 1,
    webContents: {
      id: 2,
      send: (channel, payload) => {
        sends.push({ channel, payload })
      },
      isDestroyed: () => false,
      on: () => undefined,
    },
    on: () => win,
    once: () => win,
    loadURL: () => Promise.resolve(),
    loadFile: () => Promise.resolve(),
    isDestroyed: () => false,
    show: () => undefined,
    close: () => undefined,
    destroy: () => undefined,
    getBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    __emit: () => undefined,
    __destroyed: false,
    __sends: sends,
  }
  return { win, sends }
}

describe('cli-window — openCliWindow is idempotent', () => {
  it('returns the same windowId on repeated calls until close', async () => {
    const main = makeMainWindow()
    const mod = await loadModule()
    const id1 = mod.openCliWindow(() => main.win as unknown as Electron.BrowserWindow)
    const id2 = mod.openCliWindow(() => main.win as unknown as Electron.BrowserWindow)
    expect(id2).toBe(id1)
    expect(electronMock.__created.length).toBe(1)
  })

  it('broadcasts CLI_STATE_CHANGED { kind: detached } on first open', async () => {
    const main = makeMainWindow()
    const mod = await loadModule()
    mod.openCliWindow(() => main.win as unknown as Electron.BrowserWindow)
    const stateBroadcasts = main.sends.filter((s) => s.channel === IpcChannels.CLI_STATE_CHANGED)
    expect(stateBroadcasts).toHaveLength(1)
    expect(stateBroadcasts[0]?.payload).toMatchObject({ state: { kind: 'detached' } })
  })
})

describe('cli-window — close → reattach broadcast', () => {
  it('re-broadcasts inApp state when the window is closed', async () => {
    const main = makeMainWindow()
    const mod = await loadModule()
    mod.openCliWindow(() => main.win as unknown as Electron.BrowserWindow)
    main.sends.length = 0

    mod.closeCliWindow()
    const stateBroadcasts = main.sends.filter((s) => s.channel === IpcChannels.CLI_STATE_CHANGED)
    expect(stateBroadcasts).toHaveLength(1)
    expect(stateBroadcasts[0]?.payload).toEqual({ state: { kind: 'inApp' } })
  })

  it('re-broadcasts inApp on render-process-gone', async () => {
    const main = makeMainWindow()
    const mod = await loadModule()
    mod.openCliWindow(() => main.win as unknown as Electron.BrowserWindow)
    main.sends.length = 0

    const created = electronMock.__created[0] as FakeBrowserWindow | undefined
    expect(created).toBeDefined()
    created?.__emit('render-process-gone')

    const stateBroadcasts = main.sends.filter((s) => s.channel === IpcChannels.CLI_STATE_CHANGED)
    expect(stateBroadcasts.length).toBeGreaterThanOrEqual(1)
    expect(stateBroadcasts[stateBroadcasts.length - 1]?.payload).toEqual({
      state: { kind: 'inApp' },
    })
  })
})
