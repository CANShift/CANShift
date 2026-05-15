// ipc-handlers.test.ts — coverage for the IPC layer that wires renderer
// commands to main-process services.
//
// Strategy: replace ipcMain.handle with a recorder that captures the (channel,
// handler) pairs, mock the underlying services, then invoke each handler
// directly with synthetic IpcMainInvokeEvent + payload. This lets us assert
// both the validation envelope (bad payload → typed error) and the delegation
// (good payload → service called with the right args).
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IpcChannels } from './ipc-channels'

// ---------------------------------------------------------------------------
// Mocks — recorder + service stubs
// ---------------------------------------------------------------------------

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown
type IpcSendListener = (event: unknown, ...args: unknown[]) => void

const handlerRegistry = vi.hoisted(() => {
  const handlers = new Map<string, IpcHandler>()
  const sendListeners = new Map<string, IpcSendListener>()
  return {
    handlers,
    sendListeners,
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler)
    }),
    on: vi.fn((channel: string, listener: IpcSendListener) => {
      sendListeners.set(channel, listener)
    }),
  }
})

// Hoisted block — vi.mock factories run before module-level imports, so the
// stub class must live where they can reach it. The instance member dodges
// no-extraneous-class (which fires on static-only classes too).
const stubs = vi.hoisted(() => {
  class EmptyStub {
    readonly _stub = true
  }
  return { EmptyStub }
})

vi.mock('electron', () => ({
  ipcMain: { handle: handlerRegistry.handle, on: handlerRegistry.on },
  app: {
    getVersion: (): string => '0.0.0-test',
    getPath: (): string => '/tmp/canshift-studio-test',
    isPackaged: false,
    getAppPath: (): string => '/tmp/canshift-studio-test',
  },
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  BrowserWindow: stubs.EmptyStub,
  net: { fetch: vi.fn() },
}))

vi.mock('electron-updater', () => ({
  autoUpdater: { on: vi.fn(), checkForUpdates: vi.fn(), quitAndInstall: vi.fn() },
}))

vi.mock('serialport', () => ({ SerialPort: stubs.EmptyStub }))
vi.mock('@serialport/parser-readline', () => ({ ReadlineParser: stubs.EmptyStub }))

// Service stubs — only the methods the IPC layer calls.
const configFileMock = vi.hoisted(() => ({
  openFile: vi.fn(),
  openFilePath: vi.fn(),
  saveFile: vi.fn(),
  saveFileAs: vi.fn(),
  importFile: vi.fn(),
  exportFile: vi.fn(),
}))
vi.mock('../services/config-file.service', () => ({
  ConfigFileService: function ConfigFileService(): unknown {
    return configFileMock
  },
}))

const usbServiceMock = vi.hoisted(() => ({
  setEventHandlers: vi.fn(),
  listPorts: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  pushConfig: vi.fn(),
  pushScreenSettings: vi.fn(),
  getStatus: vi.fn(),
  rebootDevice: vi.fn(),
  toggleDayNight: vi.fn(),
  setDayNight: vi.fn(),
  calibrateTouch: vi.fn(),
  startCanScan: vi.fn(),
  stopCanScan: vi.fn(),
  queryVersion: vi.fn(),
  getConfig: vi.fn(),
}))
vi.mock('../services/usb.service', () => ({
  UsbService: function UsbService(): unknown {
    return usbServiceMock
  },
}))

const updaterMock = vi.hoisted(() => ({
  checkForUpdates: vi.fn(),
  installUpdate: vi.fn(),
}))
vi.mock('../services/updater.service', () => updaterMock)

const firmwareMock = vi.hoisted(() => ({
  listReleases: vi.fn(),
  resetIntoBootloader: vi.fn(),
  setFlashPort: vi.fn(),
  getFlashPort: vi.fn(),
  downloadBinary: vi.fn(),
  downloadText: vi.fn(),
}))
vi.mock('../services/firmware.service', () => ({ firmwareService: firmwareMock }))

const sessionMock = vi.hoisted(() => ({
  addRecentFile: vi.fn(),
  getLastFilePath: vi.fn(),
  getLastPortPath: vi.fn(),
  setLastPortPath: vi.fn(),
  getFirstRunCompleted: vi.fn(),
  markFirstRunCompleted: vi.fn(),
  resetFirstRun: vi.fn(),
}))
vi.mock('../services/session.service', () => ({ sessionService: sessionMock }))

vi.mock('../menu', () => ({ buildMenu: vi.fn() }))

const cliWindowMock = vi.hoisted(() => ({
  openCliWindow: vi.fn<(getMainWindow: () => unknown) => number>(() => 42),
  closeCliWindow: vi.fn(),
  getCliWindowState: vi.fn<() => { kind: 'inApp' } | { kind: 'detached'; windowId: number }>(
    () => ({
      kind: 'inApp',
    })
  ),
  disposeCliWindow: vi.fn(),
}))
vi.mock('../windows/cli-window', () => cliWindowMock)

const cliLogBusMock = vi.hoisted(() => ({
  getBacklog: vi.fn<() => readonly unknown[]>(() => []),
  publish: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}))
vi.mock('../services/cli-log-bus', () => cliLogBusMock)

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return { ...actual, writeFile: vi.fn(), readFile: vi.fn() }
})

import { registerIpcHandlers } from './ipc-handlers'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CapturedSend {
  channel: string
  payload: unknown
}

function makeWindow(): {
  win: {
    isDestroyed: () => boolean
    webContents: { isDestroyed: () => boolean; send: (channel: string, payload: unknown) => void }
  }
  sends: CapturedSend[]
} {
  const sends: CapturedSend[] = []
  return {
    sends,
    win: {
      isDestroyed: () => false,
      webContents: {
        isDestroyed: () => false,
        send: (channel: string, payload: unknown): void => {
          sends.push({ channel, payload })
        },
      },
    },
  }
}

function getHandler(channel: string): IpcHandler {
  const handler = handlerRegistry.handlers.get(channel)
  if (!handler) throw new Error(`No handler registered for ${channel}`)
  return handler
}

function makeEvent(): { sender: { send: (c: string, p: unknown) => void } } {
  // Stub IpcMainInvokeEvent — handlers only access event.sender.send for the
  // FIRMWARE_DOWNLOAD progress channel. Recording is irrelevant to current tests.
  return { sender: { send: vi.fn() } }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  handlerRegistry.handlers.clear()
  handlerRegistry.sendListeners.clear()
  handlerRegistry.handle.mockClear()
  handlerRegistry.on.mockClear()
  for (const fn of Object.values(configFileMock)) fn.mockReset()
  for (const fn of Object.values(usbServiceMock)) fn.mockReset()
  for (const fn of Object.values(firmwareMock)) fn.mockReset()
  for (const fn of Object.values(sessionMock)) fn.mockReset()
  for (const fn of Object.values(cliWindowMock)) fn.mockReset()
  for (const fn of Object.values(cliLogBusMock)) fn.mockReset()
  cliWindowMock.openCliWindow.mockImplementation(() => 42)
  cliWindowMock.getCliWindowState.mockImplementation(() => ({ kind: 'inApp' }))
  cliLogBusMock.getBacklog.mockImplementation(() => [])
  updaterMock.checkForUpdates.mockReset()
  updaterMock.installUpdate.mockReset()
})

describe('registerIpcHandlers — channel registration', () => {
  it('registers a handler for every channel name in IpcChannels (renderer→main only)', () => {
    const { win } = makeWindow()
    registerIpcHandlers(() => win as unknown as Electron.BrowserWindow)

    // Renderer→main one-shot calls. Channels ending in events (main→renderer)
    // are excluded.
    const expectedChannels = [
      IpcChannels.CONFIG_OPEN,
      IpcChannels.CONFIG_OPEN_PATH,
      IpcChannels.CONFIG_SAVE,
      IpcChannels.CONFIG_SAVE_AS,
      IpcChannels.CONFIG_IMPORT,
      IpcChannels.CONFIG_EXPORT,
      IpcChannels.SESSION_GET_LAST_FILE,
      IpcChannels.SESSION_GET_LAST_PORT,
      IpcChannels.SESSION_GET_FIRST_RUN_COMPLETED,
      IpcChannels.SESSION_MARK_FIRST_RUN_COMPLETED,
      IpcChannels.SESSION_RESET_FIRST_RUN,
      IpcChannels.USB_LIST_PORTS,
      IpcChannels.USB_CONNECT,
      IpcChannels.USB_DISCONNECT,
      IpcChannels.USB_PUSH_CONFIG,
      IpcChannels.USB_SCREEN_SETTINGS,
      IpcChannels.USB_GET_STATUS,
      IpcChannels.USB_REBOOT,
      IpcChannels.USB_TOGGLE_DAY_NIGHT,
      IpcChannels.USB_SET_DAY_NIGHT,
      IpcChannels.USB_CALIBRATE_TOUCH,
      IpcChannels.CAN_SCAN_START,
      IpcChannels.CAN_SCAN_STOP,
      IpcChannels.FIRMWARE_QUERY_VERSION,
      IpcChannels.DEVICE_GET_CONFIG,
      IpcChannels.FIRMWARE_LIST_RELEASES,
      IpcChannels.FIRMWARE_ENTER_FLASH,
      IpcChannels.FIRMWARE_EXIT_FLASH,
      IpcChannels.FIRMWARE_RETRY_RESET,
      IpcChannels.FIRMWARE_DOWNLOAD,
      IpcChannels.FIRMWARE_DOWNLOAD_TEXT,
      IpcChannels.SIGNAL_EXPORT,
      IpcChannels.APP_VERSION,
      IpcChannels.UPDATE_CHECK,
      IpcChannels.UPDATE_INSTALL,
      IpcChannels.DEVICE_CONFIG_READ,
      IpcChannels.DEVICE_CONFIG_WRITE,
    ]

    for (const channel of expectedChannels) {
      expect(handlerRegistry.handlers.has(channel)).toBe(true)
    }
  })
})

describe('USB IPC handlers — payload validation and service delegation', () => {
  beforeEach(() => {
    const { win } = makeWindow()
    registerIpcHandlers(() => win as unknown as Electron.BrowserWindow)
  })

  it('USB_CONNECT rejects a non-string portPath without touching the service', async () => {
    const handler = getHandler(IpcChannels.USB_CONNECT)
    const result = await handler(makeEvent(), 42)
    expect(result).toEqual({ success: false, error: 'portPath must be a non-empty string' })
    expect(usbServiceMock.connect).not.toHaveBeenCalled()
  })

  it('USB_CONNECT rejects an empty string', async () => {
    const handler = getHandler(IpcChannels.USB_CONNECT)
    const result = await handler(makeEvent(), '')
    expect(result).toEqual({ success: false, error: 'portPath must be a non-empty string' })
  })

  it('USB_CONNECT short-circuits while a flash is in progress (no connect call)', async () => {
    firmwareMock.getFlashPort.mockReturnValue('/dev/tty.usbserial')
    const handler = getHandler(IpcChannels.USB_CONNECT)
    const result = await handler(makeEvent(), '/dev/tty.usbserial')
    expect(result).toEqual({ success: false, error: 'Flash in progress' })
    expect(usbServiceMock.connect).not.toHaveBeenCalled()
  })

  it('USB_CONNECT delegates and persists the port on success', async () => {
    firmwareMock.getFlashPort.mockReturnValue(null)
    usbServiceMock.connect.mockResolvedValueOnce({ success: true })
    const handler = getHandler(IpcChannels.USB_CONNECT)

    const result = await handler(makeEvent(), '/dev/tty.usbserial')
    expect(result).toEqual({ success: true })
    expect(usbServiceMock.connect).toHaveBeenCalledWith('/dev/tty.usbserial')
    expect(sessionMock.setLastPortPath).toHaveBeenCalledWith('/dev/tty.usbserial')
  })

  it('USB_CONNECT does NOT persist the port when the connect fails', async () => {
    firmwareMock.getFlashPort.mockReturnValue(null)
    usbServiceMock.connect.mockResolvedValueOnce({ success: false, error: 'EBUSY' })
    const handler = getHandler(IpcChannels.USB_CONNECT)

    await handler(makeEvent(), '/dev/tty.usbserial')
    expect(sessionMock.setLastPortPath).not.toHaveBeenCalled()
  })

  it('USB_PUSH_CONFIG rejects a non-object config', async () => {
    const handler = getHandler(IpcChannels.USB_PUSH_CONFIG)
    expect(await handler(makeEvent(), null)).toEqual({
      success: false,
      error: 'Push payload must be a config object',
    })
    expect(await handler(makeEvent(), 'string')).toEqual({
      success: false,
      error: 'Push payload must be a config object',
    })
    expect(await handler(makeEvent(), [1, 2])).toEqual({
      success: false,
      error: 'Push payload must be a config object',
    })
    expect(usbServiceMock.pushConfig).not.toHaveBeenCalled()
  })

  it('USB_PUSH_CONFIG forwards a valid config to the service', async () => {
    usbServiceMock.pushConfig.mockResolvedValueOnce({ success: true })
    const handler = getHandler(IpcChannels.USB_PUSH_CONFIG)
    const cfg = { schemaVersion: 7 }
    await handler(makeEvent(), cfg)
    expect(usbServiceMock.pushConfig).toHaveBeenCalledWith(cfg)
  })

  it('USB_SCREEN_SETTINGS rejects rotation: 90 with the typed error', async () => {
    const handler = getHandler(IpcChannels.USB_SCREEN_SETTINGS)
    const result = await handler(makeEvent(), { brightness: 80, sleep: 30, rotation: 90 })
    expect(result).toEqual({ success: false, error: 'Screen settings payload is invalid' })
    expect(usbServiceMock.pushScreenSettings).not.toHaveBeenCalled()
  })

  it('USB_SCREEN_SETTINGS forwards a valid payload to the service', async () => {
    usbServiceMock.pushScreenSettings.mockResolvedValueOnce({ success: true })
    const handler = getHandler(IpcChannels.USB_SCREEN_SETTINGS)
    await handler(makeEvent(), { brightness: 80, sleep: 30, rotation: 180 })
    expect(usbServiceMock.pushScreenSettings).toHaveBeenCalledWith({
      brightness: 80,
      sleep: 30,
      rotation: 180,
    })
  })

  it('USB_SET_DAY_NIGHT rejects a non-boolean payload', async () => {
    const handler = getHandler(IpcChannels.USB_SET_DAY_NIGHT)
    expect(await handler(makeEvent(), 1)).toEqual({
      success: false,
      error: 'set-day-night payload must be a boolean',
    })
    expect(await handler(makeEvent(), 'true')).toEqual({
      success: false,
      error: 'set-day-night payload must be a boolean',
    })
    expect(usbServiceMock.setDayNight).not.toHaveBeenCalled()
  })

  it('USB_SET_DAY_NIGHT forwards true/false', async () => {
    usbServiceMock.setDayNight.mockResolvedValue({ success: true })
    const handler = getHandler(IpcChannels.USB_SET_DAY_NIGHT)
    await handler(makeEvent(), true)
    await handler(makeEvent(), false)
    expect(usbServiceMock.setDayNight).toHaveBeenNthCalledWith(1, true)
    expect(usbServiceMock.setDayNight).toHaveBeenNthCalledWith(2, false)
  })

  it('USB_DISCONNECT, USB_GET_STATUS, USB_REBOOT, USB_TOGGLE_DAY_NIGHT, USB_CALIBRATE_TOUCH delegate without args', async () => {
    usbServiceMock.disconnect.mockResolvedValue({ success: true })
    usbServiceMock.getStatus.mockReturnValue({ connected: false })
    usbServiceMock.rebootDevice.mockResolvedValue({ success: true })
    usbServiceMock.toggleDayNight.mockResolvedValue({ success: true })
    usbServiceMock.calibrateTouch.mockResolvedValue({ success: true })

    await getHandler(IpcChannels.USB_DISCONNECT)(makeEvent())
    await getHandler(IpcChannels.USB_GET_STATUS)(makeEvent())
    await getHandler(IpcChannels.USB_REBOOT)(makeEvent())
    await getHandler(IpcChannels.USB_TOGGLE_DAY_NIGHT)(makeEvent())
    await getHandler(IpcChannels.USB_CALIBRATE_TOUCH)(makeEvent())

    expect(usbServiceMock.disconnect).toHaveBeenCalledTimes(1)
    expect(usbServiceMock.getStatus).toHaveBeenCalledTimes(1)
    expect(usbServiceMock.rebootDevice).toHaveBeenCalledTimes(1)
    expect(usbServiceMock.toggleDayNight).toHaveBeenCalledTimes(1)
    expect(usbServiceMock.calibrateTouch).toHaveBeenCalledTimes(1)
  })
})

describe('Config IPC handlers — payload validation and recent-file plumbing', () => {
  beforeEach(() => {
    const { win } = makeWindow()
    registerIpcHandlers(() => win as unknown as Electron.BrowserWindow)
  })

  it('CONFIG_OPEN delegates and updates recent files on success', async () => {
    configFileMock.openFile.mockResolvedValueOnce({
      success: true,
      filePath: '/a/b.json',
      content: {},
    })

    const result = await getHandler(IpcChannels.CONFIG_OPEN)(makeEvent())
    expect(result).toMatchObject({ success: true, filePath: '/a/b.json' })
    expect(sessionMock.addRecentFile).toHaveBeenCalledWith('/a/b.json')
  })

  it('CONFIG_OPEN does not touch recent files when the dialog is cancelled', async () => {
    configFileMock.openFile.mockResolvedValueOnce({ success: false })
    await getHandler(IpcChannels.CONFIG_OPEN)(makeEvent())
    expect(sessionMock.addRecentFile).not.toHaveBeenCalled()
  })

  it('CONFIG_SAVE rejects a non-object payload', async () => {
    expect(await getHandler(IpcChannels.CONFIG_SAVE)(makeEvent(), null)).toEqual({
      success: false,
      error: 'Save payload must be a config object',
    })
    expect(configFileMock.saveFile).not.toHaveBeenCalled()
  })

  it('CONFIG_SAVE_AS rejects an array payload', async () => {
    expect(await getHandler(IpcChannels.CONFIG_SAVE_AS)(makeEvent(), [1, 2, 3])).toEqual({
      success: false,
      error: 'Save payload must be a config object',
    })
  })

  it('CONFIG_EXPORT rejects a non-object payload', async () => {
    expect(await getHandler(IpcChannels.CONFIG_EXPORT)(makeEvent(), 'string')).toEqual({
      success: false,
      error: 'Export payload must be a config object',
    })
    expect(configFileMock.exportFile).not.toHaveBeenCalled()
  })

  it('CONFIG_EXPORT does NOT update recent files (foreign target)', async () => {
    configFileMock.exportFile.mockResolvedValueOnce({ success: true, filePath: '/x/y.json' })
    await getHandler(IpcChannels.CONFIG_EXPORT)(makeEvent(), { schemaVersion: 1 })
    expect(sessionMock.addRecentFile).not.toHaveBeenCalled()
  })

  it('CONFIG_IMPORT does NOT update recent files (foreign source)', async () => {
    configFileMock.importFile.mockResolvedValueOnce({
      success: true,
      filePath: '/x/y.json',
      content: {},
    })
    await getHandler(IpcChannels.CONFIG_IMPORT)(makeEvent())
    expect(sessionMock.addRecentFile).not.toHaveBeenCalled()
  })

  it('CONFIG_OPEN_PATH delegates the path to the service', async () => {
    configFileMock.openFilePath.mockResolvedValueOnce({
      success: true,
      filePath: '/a.json',
      content: {},
    })
    await getHandler(IpcChannels.CONFIG_OPEN_PATH)(makeEvent(), '/a.json')
    expect(configFileMock.openFilePath).toHaveBeenCalledWith('/a.json')
  })

  it('CONFIG_OPEN_PATH rejects a non-string payload without touching the service', async () => {
    const handler = getHandler(IpcChannels.CONFIG_OPEN_PATH)
    expect(await handler(makeEvent(), 42)).toEqual({
      success: false,
      error: 'filePath must be a non-empty string',
    })
    expect(await handler(makeEvent(), '')).toEqual({
      success: false,
      error: 'filePath must be a non-empty string',
    })
    expect(await handler(makeEvent(), null)).toEqual({
      success: false,
      error: 'filePath must be a non-empty string',
    })
    expect(configFileMock.openFilePath).not.toHaveBeenCalled()
  })
})

describe('Session IPC handlers — pure delegation', () => {
  beforeEach(() => {
    const { win } = makeWindow()
    registerIpcHandlers(() => win as unknown as Electron.BrowserWindow)
  })

  it('SESSION_GET_LAST_FILE returns sessionService value', async () => {
    sessionMock.getLastFilePath.mockReturnValue('/last.json')
    expect(await getHandler(IpcChannels.SESSION_GET_LAST_FILE)(makeEvent())).toBe('/last.json')
  })

  it('SESSION_GET_LAST_PORT returns sessionService value', async () => {
    sessionMock.getLastPortPath.mockReturnValue('/dev/tty.usbserial')
    expect(await getHandler(IpcChannels.SESSION_GET_LAST_PORT)(makeEvent())).toBe(
      '/dev/tty.usbserial'
    )
  })

  it('SESSION_GET_FIRST_RUN_COMPLETED returns sessionService value', async () => {
    sessionMock.getFirstRunCompleted.mockReturnValue(true)
    expect(await getHandler(IpcChannels.SESSION_GET_FIRST_RUN_COMPLETED)(makeEvent())).toBe(true)
  })

  it('SESSION_MARK_FIRST_RUN_COMPLETED delegates without args', async () => {
    await getHandler(IpcChannels.SESSION_MARK_FIRST_RUN_COMPLETED)(makeEvent())
    expect(sessionMock.markFirstRunCompleted).toHaveBeenCalledTimes(1)
  })

  it('SESSION_RESET_FIRST_RUN delegates without args', async () => {
    await getHandler(IpcChannels.SESSION_RESET_FIRST_RUN)(makeEvent())
    expect(sessionMock.resetFirstRun).toHaveBeenCalledTimes(1)
  })
})

describe('Firmware IPC handlers — flash and download plumbing', () => {
  beforeEach(() => {
    const { win } = makeWindow()
    registerIpcHandlers(() => win as unknown as Electron.BrowserWindow)
  })

  it('FIRMWARE_LIST_RELEASES forwards the channel arg', async () => {
    firmwareMock.listReleases.mockResolvedValueOnce([])
    await getHandler(IpcChannels.FIRMWARE_LIST_RELEASES)(makeEvent(), 'beta')
    expect(firmwareMock.listReleases).toHaveBeenCalledWith('beta')
  })

  it('FIRMWARE_LIST_RELEASES rejects an unknown channel without touching the service', async () => {
    const handler = getHandler(IpcChannels.FIRMWARE_LIST_RELEASES)
    await expect(handler(makeEvent(), 'nightly')).rejects.toThrow(
      'channel must be "stable" or "beta"'
    )
    await expect(handler(makeEvent(), null)).rejects.toThrow()
    await expect(handler(makeEvent(), 42)).rejects.toThrow()
    expect(firmwareMock.listReleases).not.toHaveBeenCalled()
  })

  it('FIRMWARE_ENTER_FLASH disconnects USB, resets bootloader, and locks the flash port', async () => {
    usbServiceMock.disconnect.mockResolvedValueOnce({ success: true })
    firmwareMock.resetIntoBootloader.mockResolvedValueOnce({ success: true })

    const result = await getHandler(IpcChannels.FIRMWARE_ENTER_FLASH)(
      makeEvent(),
      '/dev/tty.usbserial'
    )

    expect(usbServiceMock.disconnect).toHaveBeenCalled()
    expect(firmwareMock.resetIntoBootloader).toHaveBeenCalledWith('/dev/tty.usbserial')
    expect(firmwareMock.setFlashPort).toHaveBeenCalledWith('/dev/tty.usbserial')
    expect(result).toEqual({ success: true })
  })

  it('FIRMWARE_ENTER_FLASH rejects a non-string portPath without touching services', async () => {
    const handler = getHandler(IpcChannels.FIRMWARE_ENTER_FLASH)
    expect(await handler(makeEvent(), 0)).toEqual({
      success: false,
      error: 'portPath must be a non-empty string',
    })
    expect(await handler(makeEvent(), '')).toEqual({
      success: false,
      error: 'portPath must be a non-empty string',
    })
    expect(usbServiceMock.disconnect).not.toHaveBeenCalled()
    expect(firmwareMock.resetIntoBootloader).not.toHaveBeenCalled()
    expect(firmwareMock.setFlashPort).not.toHaveBeenCalled()
  })

  it('FIRMWARE_EXIT_FLASH clears the flash port', async () => {
    const result = await getHandler(IpcChannels.FIRMWARE_EXIT_FLASH)(makeEvent())
    expect(firmwareMock.setFlashPort).toHaveBeenCalledWith(null)
    expect(result).toEqual({ success: true })
  })

  it('FIRMWARE_RETRY_RESET re-runs resetIntoBootloader and validates the port path (#482)', async () => {
    firmwareMock.resetIntoBootloader.mockResolvedValueOnce({ success: true })
    const handler = getHandler(IpcChannels.FIRMWARE_RETRY_RESET)

    // Reject non-string portPath — service must not be called.
    expect(await handler(makeEvent(), 0)).toEqual({
      success: false,
      error: 'portPath must be a non-empty string',
    })
    expect(firmwareMock.resetIntoBootloader).not.toHaveBeenCalled()

    // Valid portPath delegates and surfaces the service result verbatim.
    const result = await handler(makeEvent(), '/dev/tty.usbserial')
    expect(result).toEqual({ success: true })
    expect(firmwareMock.resetIntoBootloader).toHaveBeenCalledWith('/dev/tty.usbserial')
  })

  it('FIRMWARE_DOWNLOAD rejects a non-allowlisted URL host', async () => {
    const handler = getHandler(IpcChannels.FIRMWARE_DOWNLOAD)
    await expect(handler(makeEvent(), 'https://evil.example/firmware.bin', 'dl-1')).rejects.toThrow(
      'blocked: firmware download URL not on allowlist'
    )
    expect(firmwareMock.downloadBinary).not.toHaveBeenCalled()
  })

  it('FIRMWARE_DOWNLOAD rejects http:// URLs even on allowlisted hosts', async () => {
    const handler = getHandler(IpcChannels.FIRMWARE_DOWNLOAD)
    await expect(
      handler(makeEvent(), 'http://github.com/foo/bar/release.bin', 'dl-1')
    ).rejects.toThrow('blocked: firmware download URL not on allowlist')
    expect(firmwareMock.downloadBinary).not.toHaveBeenCalled()
  })

  it('FIRMWARE_DOWNLOAD rejects a malformed URL', async () => {
    const handler = getHandler(IpcChannels.FIRMWARE_DOWNLOAD)
    await expect(handler(makeEvent(), 'not-a-url', 'dl-1')).rejects.toThrow(
      'blocked: firmware download URL not on allowlist'
    )
  })

  it('FIRMWARE_DOWNLOAD rejects a non-string downloadId', async () => {
    const handler = getHandler(IpcChannels.FIRMWARE_DOWNLOAD)
    await expect(handler(makeEvent(), 'https://github.com/foo/bar/release.bin', 7)).rejects.toThrow(
      'downloadId must be a non-empty string'
    )
    expect(firmwareMock.downloadBinary).not.toHaveBeenCalled()
  })

  it('FIRMWARE_DOWNLOAD forwards an allowlisted https URL to the service', async () => {
    const buf = new ArrayBuffer(8)
    firmwareMock.downloadBinary.mockResolvedValueOnce(buf)
    const handler = getHandler(IpcChannels.FIRMWARE_DOWNLOAD)
    const result = await handler(
      makeEvent(),
      'https://objects.githubusercontent.com/abc/def.bin',
      'dl-1'
    )
    expect(result).toBe(buf)
    expect(firmwareMock.downloadBinary).toHaveBeenCalledWith(
      'https://objects.githubusercontent.com/abc/def.bin',
      expect.any(Function)
    )
  })

  it('FIRMWARE_DOWNLOAD_TEXT rejects a non-allowlisted URL host (#671)', async () => {
    const handler = getHandler(IpcChannels.FIRMWARE_DOWNLOAD_TEXT)
    await expect(handler(makeEvent(), 'https://evil.example/fw.bin.sha256')).rejects.toThrow(
      'blocked: firmware download URL not on allowlist'
    )
    expect(firmwareMock.downloadText).not.toHaveBeenCalled()
  })

  it('FIRMWARE_DOWNLOAD_TEXT rejects http:// URLs (#671)', async () => {
    const handler = getHandler(IpcChannels.FIRMWARE_DOWNLOAD_TEXT)
    await expect(
      handler(makeEvent(), 'http://objects.githubusercontent.com/abc.sha256')
    ).rejects.toThrow('blocked: firmware download URL not on allowlist')
    expect(firmwareMock.downloadText).not.toHaveBeenCalled()
  })

  it('FIRMWARE_DOWNLOAD_TEXT forwards an allowlisted https URL to the service (#671)', async () => {
    firmwareMock.downloadText.mockResolvedValueOnce('deadbeef\n')
    const handler = getHandler(IpcChannels.FIRMWARE_DOWNLOAD_TEXT)
    const result = await handler(
      makeEvent(),
      'https://objects.githubusercontent.com/abc/def.bin.sha256'
    )
    expect(result).toBe('deadbeef\n')
    expect(firmwareMock.downloadText).toHaveBeenCalledWith(
      'https://objects.githubusercontent.com/abc/def.bin.sha256'
    )
  })
})

describe('Update IPC handlers — pure delegation', () => {
  beforeEach(() => {
    const { win } = makeWindow()
    registerIpcHandlers(() => win as unknown as Electron.BrowserWindow)
  })

  it('UPDATE_CHECK calls checkForUpdates', async () => {
    await getHandler(IpcChannels.UPDATE_CHECK)(makeEvent())
    expect(updaterMock.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('UPDATE_INSTALL calls installUpdate', async () => {
    await getHandler(IpcChannels.UPDATE_INSTALL)(makeEvent())
    expect(updaterMock.installUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('Device-config IPC handlers — payload validation', () => {
  beforeEach(() => {
    const { win } = makeWindow()
    registerIpcHandlers(() => win as unknown as Electron.BrowserWindow)
  })

  it('DEVICE_CONFIG_WRITE rejects a non-object config', async () => {
    expect(await getHandler(IpcChannels.DEVICE_CONFIG_WRITE)(makeEvent(), null)).toEqual({
      success: false,
      error: 'Device config payload must be an object',
    })
  })

  it('SIGNAL_EXPORT rejects a non-object payload', async () => {
    expect(await getHandler(IpcChannels.SIGNAL_EXPORT)(makeEvent(), null)).toEqual({
      success: false,
      error: 'Signal export payload must be an object',
    })
  })
})

describe('App-info IPC handler', () => {
  it('APP_VERSION returns app.getVersion()', async () => {
    const { win } = makeWindow()
    registerIpcHandlers(() => win as unknown as Electron.BrowserWindow)
    expect(await getHandler(IpcChannels.APP_VERSION)(makeEvent())).toBe('0.0.0-test')
  })
})

describe('CLI detach IPC handlers (issue #433)', () => {
  beforeEach(() => {
    const { win } = makeWindow()
    registerIpcHandlers(() => win as unknown as Electron.BrowserWindow)
  })

  it('CLI_DETACH returns { windowId } and opens the detached window', async () => {
    cliWindowMock.openCliWindow.mockReturnValue(99)
    const result = await getHandler(IpcChannels.CLI_DETACH)(makeEvent())
    expect(result).toEqual({ windowId: 99 })
    expect(cliWindowMock.openCliWindow).toHaveBeenCalledTimes(1)
  })

  it('CLI_REATTACH closes the detached window', async () => {
    const result = await getHandler(IpcChannels.CLI_REATTACH)(makeEvent())
    expect(result).toEqual({ success: true })
    expect(cliWindowMock.closeCliWindow).toHaveBeenCalledTimes(1)
  })

  it('CLI_GET_STATE returns the live state and the backlog', async () => {
    cliWindowMock.getCliWindowState.mockReturnValueOnce({ kind: 'detached', windowId: 7 })
    cliLogBusMock.getBacklog.mockReturnValueOnce([
      { id: 1, level: 'info', message: 'hello', timestampMs: 12345 },
    ])
    const result = await getHandler(IpcChannels.CLI_GET_STATE)(makeEvent())
    expect(result).toEqual({
      state: { kind: 'detached', windowId: 7 },
      backlog: [{ id: 1, level: 'info', message: 'hello', timestampMs: 12345 }],
    })
  })

  it('CLI_LOG_PUSH validates the payload and rebroadcasts excluding the sender', () => {
    const listener = handlerRegistry.sendListeners.get(IpcChannels.CLI_LOG_PUSH)
    expect(listener).toBeDefined()

    const event = { sender: { id: 555 } }
    listener?.(event, {
      id: 9,
      level: 'info',
      message: 'log from window A',
      timestampMs: 1000,
      scope: 'usb',
    })

    expect(cliLogBusMock.publish).toHaveBeenCalledWith(
      { id: 9, level: 'info', message: 'log from window A', timestampMs: 1000, scope: 'usb' },
      555
    )
  })

  it('CLI_LOG_PUSH drops malformed payloads silently', () => {
    const listener = handlerRegistry.sendListeners.get(IpcChannels.CLI_LOG_PUSH)
    expect(listener).toBeDefined()
    listener?.({ sender: { id: 1 } }, { id: 'not a number', level: 'info' })
    listener?.({ sender: { id: 1 } }, null)
    listener?.({ sender: { id: 1 } }, { id: 1, level: 'invalid', message: 'x', timestampMs: 1 })
    expect(cliLogBusMock.publish).not.toHaveBeenCalled()
  })
})
