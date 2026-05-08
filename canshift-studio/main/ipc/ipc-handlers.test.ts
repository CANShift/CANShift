// ipc-handlers.test.ts — coverage for renderer payload guards and the IPC
// dispatch wiring (issue #219). The guards live at the Electron process
// boundary, so they are the right place to enforce shape on every value
// crossing from the (trusted) renderer into the main process. A regression
// (e.g. parseScreenSettings accepting `rotation: 90`) would silently brick
// screens by sending an out-of-range rotation to firmware.
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared via vi.hoisted so vi.mock factories can reference
// them. ipc-handlers.ts pulls in heavy modules (serialport, dialog, fs); we
// stub everything that has side effects on import.
// ---------------------------------------------------------------------------

const electronMock = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    handlers,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      }),
    },
    dialog: {
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn(),
    },
    app: {
      getVersion: vi.fn().mockReturnValue('0.0.0-test'),
      getPath: vi.fn().mockReturnValue('/tmp/canshift-test'),
    },
  }
})
vi.mock('electron', () => electronMock)

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
}))

const usbServiceMock = vi.hoisted(() => ({
  setEventHandlers: vi.fn(),
  listPorts: vi.fn().mockResolvedValue([]),
  connect: vi.fn().mockResolvedValue({ success: true }),
  disconnect: vi.fn().mockResolvedValue({ success: true }),
  pushConfig: vi.fn().mockResolvedValue({ success: true }),
  pushScreenSettings: vi.fn().mockResolvedValue({ success: true }),
  getStatus: vi.fn().mockReturnValue({ connected: false }),
  rebootDevice: vi.fn().mockResolvedValue({ success: true }),
  toggleDayNight: vi.fn().mockResolvedValue({ success: true }),
  setDayNight: vi.fn().mockResolvedValue({ success: true }),
  calibrateTouch: vi.fn().mockResolvedValue({ success: true }),
  startCanScan: vi.fn().mockResolvedValue({ success: true }),
  stopCanScan: vi.fn().mockResolvedValue({ success: true }),
  queryVersion: vi.fn().mockResolvedValue({ version: '0.0.0', isDay: null, sdState: 'unknown' }),
  getConfig: vi.fn().mockResolvedValue({ success: false }),
}))
vi.mock('../services/usb.service', () => ({
  // The constructor is invoked once inside ipc-handlers.ts as `new UsbService()`.
  // Returning a class that proxies to the shared mock keeps every instance
  // talking to the same vi.fn() spies the tests assert on.
  UsbService: class {
    setEventHandlers = usbServiceMock.setEventHandlers
    listPorts = usbServiceMock.listPorts
    connect = usbServiceMock.connect
    disconnect = usbServiceMock.disconnect
    pushConfig = usbServiceMock.pushConfig
    pushScreenSettings = usbServiceMock.pushScreenSettings
    getStatus = usbServiceMock.getStatus
    rebootDevice = usbServiceMock.rebootDevice
    toggleDayNight = usbServiceMock.toggleDayNight
    setDayNight = usbServiceMock.setDayNight
    calibrateTouch = usbServiceMock.calibrateTouch
    startCanScan = usbServiceMock.startCanScan
    stopCanScan = usbServiceMock.stopCanScan
    queryVersion = usbServiceMock.queryVersion
    getConfig = usbServiceMock.getConfig
  },
}))

const configFileServiceMock = vi.hoisted(() => ({
  openFile: vi.fn(),
  openFilePath: vi.fn(),
  saveFile: vi.fn(),
  saveFileAs: vi.fn(),
  importFile: vi.fn(),
  exportFile: vi.fn(),
}))
vi.mock('../services/config-file.service', () => ({
  ConfigFileService: class {
    openFile = configFileServiceMock.openFile
    openFilePath = configFileServiceMock.openFilePath
    saveFile = configFileServiceMock.saveFile
    saveFileAs = configFileServiceMock.saveFileAs
    importFile = configFileServiceMock.importFile
    exportFile = configFileServiceMock.exportFile
  },
}))

const sessionServiceMock = vi.hoisted(() => ({
  addRecentFile: vi.fn(),
  setLastPortPath: vi.fn(),
  getLastFilePath: vi.fn().mockReturnValue(null),
  getLastPortPath: vi.fn().mockReturnValue(null),
  getFirstRunCompleted: vi.fn().mockReturnValue(false),
  markFirstRunCompleted: vi.fn(),
  resetFirstRun: vi.fn(),
  getRecentFiles: vi.fn().mockReturnValue([]),
}))
vi.mock('../services/session.service', () => ({
  sessionService: sessionServiceMock,
}))

const firmwareServiceMock = vi.hoisted(() => ({
  getFlashPort: vi.fn().mockReturnValue(null),
  setFlashPort: vi.fn(),
  listReleases: vi.fn().mockResolvedValue([]),
  resetIntoBootloader: vi.fn().mockResolvedValue({ success: true }),
  downloadBinary: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
}))
vi.mock('../services/firmware.service', () => ({
  firmwareService: firmwareServiceMock,
}))

vi.mock('../services/sd.service', () => ({
  sdService: {
    listVolumes: vi.fn().mockResolvedValue([]),
    prepareSD: vi.fn().mockResolvedValue({ success: true, copied: [], skipped: [] }),
    pushOverUsb: vi.fn().mockResolvedValue({ success: true, copied: [], skipped: [] }),
  },
}))

vi.mock('../services/updater.service', () => ({
  checkForUpdates: vi.fn(),
  installUpdate: vi.fn(),
}))

vi.mock('../menu', () => ({
  buildMenu: vi.fn(),
}))

// Silence the 100ms CAN-batch timer started inside registerIpcHandlers — it
// would otherwise leak across tests.
vi.useFakeTimers()

import {
  isNonEmptyString,
  isPlainObject,
  parseScreenSettings,
  registerIpcHandlers,
} from './ipc-handlers'
import { IpcChannels } from './ipc-channels'

// ---------------------------------------------------------------------------
// Direct guard tests — table-driven, fast, no IPC plumbing
// ---------------------------------------------------------------------------

describe('isNonEmptyString', () => {
  it.each([
    { input: 'a', expected: true },
    { input: 'hello', expected: true },
    { input: ' ', expected: true }, // whitespace counts — caller decides semantics
    { input: '', expected: false },
    { input: undefined, expected: false },
    { input: null, expected: false },
    { input: 0, expected: false },
    { input: 42, expected: false },
    { input: {}, expected: false },
    { input: [], expected: false },
  ])('returns $expected for $input', ({ input, expected }) => {
    expect(isNonEmptyString(input)).toBe(expected)
  })
})

describe('isPlainObject', () => {
  it.each([
    { label: 'empty object', input: {}, expected: true },
    { label: 'populated object', input: { a: 1 }, expected: true },
    { label: 'array', input: [], expected: false },
    { label: 'array with values', input: [1, 2], expected: false },
    { label: 'null', input: null, expected: false },
    { label: 'undefined', input: undefined, expected: false },
    { label: 'string', input: 'x', expected: false },
    { label: 'number', input: 42, expected: false },
    { label: 'boolean', input: true, expected: false },
  ])('returns $expected for $label', ({ input, expected }) => {
    expect(isPlainObject(input)).toBe(expected)
  })
})

describe('parseScreenSettings — rotation regression guard (#219)', () => {
  it('accepts brightness + sleep without rotation', () => {
    expect(parseScreenSettings({ brightness: 50, sleep: 30 })).toEqual({
      brightness: 50,
      sleep: 30,
    })
  })

  it('accepts rotation 0', () => {
    expect(parseScreenSettings({ brightness: 50, sleep: 30, rotation: 0 })).toEqual({
      brightness: 50,
      sleep: 30,
      rotation: 0,
    })
  })

  it('accepts rotation 180', () => {
    expect(parseScreenSettings({ brightness: 50, sleep: 30, rotation: 180 })).toEqual({
      brightness: 50,
      sleep: 30,
      rotation: 180,
    })
  })

  // The regression named in issue #219: the firmware only handles 0 / 180.
  // Anything else (90, 270) bricks the screen by leaving LVGL in an
  // unsupported orientation. The guard MUST reject these before they reach
  // CMD_SCREEN_SETTINGS.
  it.each([90, 270, 1, -1, 360])('rejects rotation %i', (rotation) => {
    expect(parseScreenSettings({ brightness: 50, sleep: 30, rotation })).toBeNull()
  })

  it.each([
    { label: 'string rotation', input: { brightness: 50, sleep: 30, rotation: '0' } },
    { label: 'null rotation', input: { brightness: 50, sleep: 30, rotation: null } },
    { label: 'missing brightness', input: { sleep: 30 } },
    { label: 'missing sleep', input: { brightness: 50 } },
    { label: 'NaN brightness', input: { brightness: NaN, sleep: 30 } },
    { label: 'Infinity sleep', input: { brightness: 50, sleep: Infinity } },
    { label: 'string brightness', input: { brightness: '50', sleep: 30 } },
    { label: 'null payload', input: null },
    { label: 'array payload', input: [50, 30] },
    { label: 'string payload', input: 'brightness=50' },
  ])('rejects $label', ({ input }) => {
    expect(parseScreenSettings(input)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// IPC dispatch tests — registerIpcHandlers wires guards + services
// ---------------------------------------------------------------------------

interface FakeWebContents {
  send: ReturnType<typeof vi.fn>
}
interface FakeWindow {
  webContents: FakeWebContents
}

function makeWindow(): FakeWindow {
  return { webContents: { send: vi.fn() } }
}

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const handler = electronMock.handlers.get(channel)
  if (!handler) throw new Error(`No handler registered for ${channel}`)
  return handler
}

function fakeEvent(): unknown {
  // Handlers receive an IpcMainInvokeEvent; only event.sender.send is touched
  // (and only by FIRMWARE_DOWNLOAD). Anything else just needs to exist.
  return { sender: { send: vi.fn() } }
}

describe('registerIpcHandlers — guard wiring', () => {
  beforeEach(() => {
    electronMock.handlers.clear()
    vi.clearAllMocks()
    firmwareServiceMock.getFlashPort.mockReturnValue(null)

    const win = makeWindow()
    registerIpcHandlers(() => win as unknown as Electron.BrowserWindow)
  })

  it('USB_SCREEN_SETTINGS rejects rotation:90 without calling pushScreenSettings', async () => {
    const handler = getHandler(IpcChannels.USB_SCREEN_SETTINGS)

    const result = await handler(fakeEvent(), { brightness: 50, sleep: 30, rotation: 90 })

    expect(result).toEqual({ success: false, error: 'Screen settings payload is invalid' })
    expect(usbServiceMock.pushScreenSettings).not.toHaveBeenCalled()
  })

  it('USB_SCREEN_SETTINGS forwards a valid payload to the service', async () => {
    const handler = getHandler(IpcChannels.USB_SCREEN_SETTINGS)

    const result = await handler(fakeEvent(), { brightness: 80, sleep: 60, rotation: 180 })

    expect(result).toEqual({ success: true })
    expect(usbServiceMock.pushScreenSettings).toHaveBeenCalledWith({
      brightness: 80,
      sleep: 60,
      rotation: 180,
    })
  })

  it('USB_CONNECT rejects empty portPath without calling connect', async () => {
    const handler = getHandler(IpcChannels.USB_CONNECT)

    const result = await handler(fakeEvent(), '')

    expect(result).toEqual({ success: false, error: 'portPath must be a non-empty string' })
    expect(usbServiceMock.connect).not.toHaveBeenCalled()
  })

  it('USB_CONNECT rejects non-string portPath without calling connect', async () => {
    const handler = getHandler(IpcChannels.USB_CONNECT)

    const result = await handler(fakeEvent(), 42)

    expect(result).toEqual({ success: false, error: 'portPath must be a non-empty string' })
    expect(usbServiceMock.connect).not.toHaveBeenCalled()
  })

  it('USB_CONNECT refuses connect while a flash is in progress', async () => {
    firmwareServiceMock.getFlashPort.mockReturnValue('/dev/tty.test')
    const handler = getHandler(IpcChannels.USB_CONNECT)

    const result = await handler(fakeEvent(), '/dev/tty.test')

    expect(result).toEqual({ success: false, error: 'Flash in progress' })
    expect(usbServiceMock.connect).not.toHaveBeenCalled()
  })

  it('USB_CONNECT records the port after a successful connect', async () => {
    usbServiceMock.connect.mockResolvedValueOnce({ success: true })
    const handler = getHandler(IpcChannels.USB_CONNECT)

    await handler(fakeEvent(), '/dev/tty.test')

    expect(sessionServiceMock.setLastPortPath).toHaveBeenCalledWith('/dev/tty.test')
  })

  it('USB_CONNECT does NOT record the port when connect fails', async () => {
    usbServiceMock.connect.mockResolvedValueOnce({ success: false, error: 'busy' })
    const handler = getHandler(IpcChannels.USB_CONNECT)

    await handler(fakeEvent(), '/dev/tty.test')

    expect(sessionServiceMock.setLastPortPath).not.toHaveBeenCalled()
  })

  it('USB_SET_DAY_NIGHT rejects non-boolean payload', async () => {
    const handler = getHandler(IpcChannels.USB_SET_DAY_NIGHT)

    const result = await handler(fakeEvent(), 1)

    expect(result).toEqual({ success: false, error: 'set-day-night payload must be a boolean' })
    expect(usbServiceMock.setDayNight).not.toHaveBeenCalled()
  })

  it('USB_PUSH_CONFIG rejects array payload', async () => {
    const handler = getHandler(IpcChannels.USB_PUSH_CONFIG)

    const result = await handler(fakeEvent(), [1, 2, 3])

    expect(result).toEqual({ success: false, error: 'Push payload must be a config object' })
    expect(usbServiceMock.pushConfig).not.toHaveBeenCalled()
  })

  it('CONFIG_SAVE rejects non-object payload', async () => {
    const handler = getHandler(IpcChannels.CONFIG_SAVE)

    const result = await handler(fakeEvent(), null)

    expect(result).toEqual({ success: false, error: 'Save payload must be a config object' })
    expect(configFileServiceMock.saveFile).not.toHaveBeenCalled()
  })

  it('CONFIG_SAVE adds successful path to recent files', async () => {
    configFileServiceMock.saveFile.mockResolvedValueOnce({
      success: true,
      filePath: '/tmp/dash.json',
    })
    const handler = getHandler(IpcChannels.CONFIG_SAVE)

    await handler(fakeEvent(), { schemaVersion: 1 })

    expect(sessionServiceMock.addRecentFile).toHaveBeenCalledWith('/tmp/dash.json')
  })

  it('CONFIG_OPEN does not touch recent files when the user cancels', async () => {
    configFileServiceMock.openFile.mockResolvedValueOnce({ success: false })
    const handler = getHandler(IpcChannels.CONFIG_OPEN)

    await handler(fakeEvent())

    expect(sessionServiceMock.addRecentFile).not.toHaveBeenCalled()
  })

  it('CONFIG_IMPORT does NOT add to recent files even on success — import is foreign', async () => {
    configFileServiceMock.importFile.mockResolvedValueOnce({
      success: true,
      filePath: '/tmp/foreign.json',
      content: {},
    })
    const handler = getHandler(IpcChannels.CONFIG_IMPORT)

    await handler(fakeEvent())

    expect(sessionServiceMock.addRecentFile).not.toHaveBeenCalled()
  })

  it('CONFIG_EXPORT rejects non-object payload', async () => {
    const handler = getHandler(IpcChannels.CONFIG_EXPORT)

    const result = await handler(fakeEvent(), 'not an object')

    expect(result).toEqual({ success: false, error: 'Export payload must be a config object' })
    expect(configFileServiceMock.exportFile).not.toHaveBeenCalled()
  })

  it('SIGNAL_EXPORT rejects non-object payload', async () => {
    const handler = getHandler(IpcChannels.SIGNAL_EXPORT)

    const result = await handler(fakeEvent(), 42)

    expect(result).toEqual({ success: false, error: 'Signal export payload must be an object' })
  })

  it('SD_PREPARE rejects empty volumePath without calling sdService', async () => {
    const handler = getHandler(IpcChannels.SD_PREPARE)

    const result = await handler(fakeEvent(), '', false)

    expect(result).toEqual({ success: false, error: 'volumePath must be a non-empty string' })
  })

  it('DEVICE_CONFIG_WRITE rejects non-object payload', async () => {
    const handler = getHandler(IpcChannels.DEVICE_CONFIG_WRITE)

    const result = await handler(fakeEvent(), null)

    expect(result).toEqual({ success: false, error: 'Device config payload must be an object' })
  })
})
