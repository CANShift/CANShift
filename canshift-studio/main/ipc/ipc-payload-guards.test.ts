// ipc-payload-guards.test.ts — table-driven coverage for the renderer payload
// guards exported from ipc-handlers.ts. These guards are the only thing
// standing between a corrupt IPC payload and a crash in the main process, and
// a regression that silently accepts e.g. `rotation: 90` would brick screens
// once the next firmware boot tries to apply it. Worth exercising directly.
//
// @vitest-environment node

import { describe, it, expect, vi } from 'vitest'

// ipc-handlers.ts imports electron, electron-updater, and the USB service tree
// for its side-effects. The guards themselves don't touch any of that, so we
// stub the heavy modules to make the import light.
// Hoisted block — vi.mock factories run before module-level imports, so the
// stub class must live where they can reach it. The instance member dodges
// no-extraneous-class (rule fires on static-only classes too).
const stubs = vi.hoisted(() => {
  class EmptyStub {
    readonly _stub = true
  }
  return { EmptyStub }
})

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: (): string => '/tmp', getVersion: (): string => '0.0.0' },
  dialog: {},
  BrowserWindow: stubs.EmptyStub,
}))
vi.mock('electron-updater', () => ({
  autoUpdater: { on: vi.fn(), checkForUpdates: vi.fn(), quitAndInstall: vi.fn() },
}))
vi.mock('serialport', () => ({ SerialPort: stubs.EmptyStub }))
vi.mock('@serialport/parser-readline', () => ({ ReadlineParser: stubs.EmptyStub }))

// Mock the firmware service trust check — `isFirmwareDownloadUrlAllowed`
// consults it for opaque-CDN URLs (issue #880). Default returns false; the
// "accepts" cases for objects.githubusercontent.com / release-assets flip
// the mock to true so we test both halves of the policy independently.
const firmwareMock = vi.hoisted(() => ({
  isFirmwareUrlTrusted: vi.fn<(url: string) => boolean>(() => false),
}))
vi.mock('../services/firmware.service', () => ({ firmwareService: firmwareMock }))

import {
  isFirmwareChannel,
  isFirmwareDownloadUrlAllowed,
  isNonEmptyString,
  isPlainObject,
  parseScreenSettings,
} from './ipc-handlers'

describe('isNonEmptyString — payload guard for portPath / volumePath', () => {
  const cases: { label: string; value: unknown; expected: boolean }[] = [
    { label: 'plain ASCII path', value: '/dev/tty.usbserial-A1', expected: true },
    { label: 'Windows COM port', value: 'COM3', expected: true },
    { label: 'single character string', value: 'a', expected: true },
    { label: 'empty string', value: '', expected: false },
    { label: 'null', value: null, expected: false },
    { label: 'undefined', value: undefined, expected: false },
    { label: 'number', value: 0, expected: false },
    { label: 'number 1', value: 1, expected: false },
    { label: 'boolean false', value: false, expected: false },
    { label: 'boolean true', value: true, expected: false },
    { label: 'object', value: { path: '/dev/tty' }, expected: false },
    { label: 'array', value: ['/dev/tty'], expected: false },
    { label: 'String wrapper object', value: new String('hi'), expected: false },
  ]

  for (const { label, value, expected } of cases) {
    it(`${expected ? 'accepts' : 'rejects'} ${label}`, () => {
      expect(isNonEmptyString(value)).toBe(expected)
    })
  }

  it('narrows the type so callers can use string methods', () => {
    const v: unknown = '/dev/tty'
    if (isNonEmptyString(v)) {
      // Compile-time check: v is now `string`, not unknown.
      expect(v.length).toBeGreaterThan(0)
    } else {
      throw new Error('expected narrowing branch')
    }
  })
})

describe('isPlainObject — payload guard for config / settings / device-config', () => {
  const cases: { label: string; value: unknown; expected: boolean }[] = [
    { label: 'empty object', value: {}, expected: true },
    { label: 'populated object', value: { schemaVersion: 1 }, expected: true },
    { label: 'nested object', value: { a: { b: 1 } }, expected: true },
    { label: 'object with prototype', value: Object.create({ proto: 1 }), expected: true },
    { label: 'null', value: null, expected: false },
    { label: 'undefined', value: undefined, expected: false },
    { label: 'array', value: [], expected: false },
    { label: 'array with items', value: [1, 2, 3], expected: false },
    { label: 'string', value: '{}', expected: false },
    { label: 'number', value: 42, expected: false },
    { label: 'boolean', value: true, expected: false },
    { label: 'function', value: (): void => undefined, expected: false },
  ]

  for (const { label, value, expected } of cases) {
    it(`${expected ? 'accepts' : 'rejects'} ${label}`, () => {
      expect(isPlainObject(value)).toBe(expected)
    })
  }

  it('rejects an array even when typeof is "object"', () => {
    // Regression guard: a naive `typeof v === "object" && v !== null` check
    // would let arrays through, and downstream serialisation would silently
    // accept them as configs. Make sure that doesn't drift.
    expect(isPlainObject(['anything'])).toBe(false)
  })
})

describe('parseScreenSettings — rotation must be 0 | 180 only', () => {
  it('accepts a payload with brightness + sleep + rotation 0', () => {
    const result = parseScreenSettings({ brightness: 80, sleep: 30, rotation: 0 })
    expect(result).toEqual({ brightness: 80, sleep: 30, rotation: 0 })
  })

  it('accepts a payload with rotation 180', () => {
    const result = parseScreenSettings({ brightness: 50, sleep: 0, rotation: 180 })
    expect(result).toEqual({ brightness: 50, sleep: 0, rotation: 180 })
  })

  it('accepts a payload without rotation (omitted is fine)', () => {
    const result = parseScreenSettings({ brightness: 100, sleep: 60 })
    expect(result).toEqual({ brightness: 100, sleep: 60 })
  })

  it('drops the rotation key entirely when it was undefined (vs. setting it to undefined)', () => {
    // Key absence vs. explicit undefined matters for downstream JSON.stringify —
    // the firmware contract treats { rotation: undefined } and {} differently
    // in some serialisers. The current implementation guarantees the key is
    // omitted, lock that down.
    const result = parseScreenSettings({ brightness: 100, sleep: 60 })
    expect(result).not.toBeNull()
    expect(Object.prototype.hasOwnProperty.call(result, 'rotation')).toBe(false)
  })

  // Critical regression: 90/270 must not slip through. A device that boots
  // with rotation=90 has its display orientation upside-sideways and the touch
  // calibration matrix becomes unusable.
  const invalidRotations: { label: string; rotation: unknown }[] = [
    { label: '90 (portrait CW)', rotation: 90 },
    { label: '270 (portrait CCW)', rotation: 270 },
    { label: '-90 (negative)', rotation: -90 },
    { label: '360 (full turn)', rotation: 360 },
    { label: 'string "0"', rotation: '0' },
    { label: 'string "180"', rotation: '180' },
    { label: 'null', rotation: null },
    { label: 'NaN', rotation: NaN },
    { label: 'Infinity', rotation: Infinity },
    { label: 'object', rotation: { value: 0 } },
  ]

  for (const { label, rotation } of invalidRotations) {
    it(`rejects rotation ${label}`, () => {
      expect(parseScreenSettings({ brightness: 50, sleep: 30, rotation })).toBeNull()
    })
  }

  const invalidEnvelopes: { label: string; value: unknown }[] = [
    { label: 'null payload', value: null },
    { label: 'undefined payload', value: undefined },
    { label: 'array payload', value: [50, 30] },
    { label: 'string payload', value: '{"brightness":50}' },
    { label: 'missing brightness', value: { sleep: 30 } },
    { label: 'missing sleep', value: { brightness: 80 } },
    { label: 'string brightness', value: { brightness: '80', sleep: 30 } },
    { label: 'string sleep', value: { brightness: 80, sleep: '30' } },
    { label: 'NaN brightness', value: { brightness: NaN, sleep: 30 } },
    { label: 'Infinity sleep', value: { brightness: 80, sleep: Infinity } },
    { label: 'boolean brightness', value: { brightness: true, sleep: 30 } },
  ]

  for (const { label, value } of invalidEnvelopes) {
    it(`rejects ${label}`, () => {
      expect(parseScreenSettings(value)).toBeNull()
    })
  }

  it('accepts brightness 0 (off — the lower bound)', () => {
    // 0 is the documented lower bound for brightness so users can turn the
    // backlight off. Locking it down prevents an over-eager refactor from
    // bumping the floor and breaking that behaviour.
    expect(parseScreenSettings({ brightness: 0, sleep: 0 })).toEqual({ brightness: 0, sleep: 0 })
  })

  // Audit finding S-H-1 (#1015) — the previous Number.isFinite-only guard
  // accepted brightness=-9999 and sleep=86400000 (24h). The shared
  // ScreenSettingsSchema in @tmbk/canshift-core now enforces bounds.
  const outOfBoundsCases: { label: string; payload: Record<string, unknown> }[] = [
    { label: 'brightness=-1 (below 0)', payload: { brightness: -1, sleep: 0 } },
    { label: 'brightness=-9999 (audit repro)', payload: { brightness: -9999, sleep: 0 } },
    { label: 'brightness=101 (above 100)', payload: { brightness: 101, sleep: 0 } },
    { label: 'brightness=255 (PWM duty, wrong unit)', payload: { brightness: 255, sleep: 0 } },
    { label: 'sleep=-1 (below 0)', payload: { brightness: 80, sleep: -1 } },
    { label: 'sleep=3601 (above 1h cap)', payload: { brightness: 80, sleep: 3601 } },
    { label: 'sleep=86400000 (audit repro: 24h)', payload: { brightness: 80, sleep: 86_400_000 } },
    { label: 'brightness=50.5 (non-integer)', payload: { brightness: 50.5, sleep: 0 } },
  ]
  for (const { label, payload } of outOfBoundsCases) {
    it(`rejects ${label} (audit S-H-1)`, () => {
      expect(parseScreenSettings(payload)).toBeNull()
    })
  }

  it('rejects unknown top-level keys (strict schema)', () => {
    expect(parseScreenSettings({ brightness: 80, sleep: 30, mystery: 1 })).toBeNull()
  })
})

describe('isFirmwareChannel — payload guard for FIRMWARE_LIST_RELEASES', () => {
  const cases: { label: string; value: unknown; expected: boolean }[] = [
    { label: '"stable"', value: 'stable', expected: true },
    { label: '"beta"', value: 'beta', expected: true },
    { label: '"nightly"', value: 'nightly', expected: false },
    { label: '"STABLE" (case-sensitive)', value: 'STABLE', expected: false },
    { label: 'empty string', value: '', expected: false },
    { label: 'number', value: 1, expected: false },
    { label: 'null', value: null, expected: false },
    { label: 'undefined', value: undefined, expected: false },
    { label: 'object wrapper', value: { channel: 'stable' }, expected: false },
  ]
  for (const { label, value, expected } of cases) {
    it(`${expected ? 'accepts' : 'rejects'} ${label}`, () => {
      expect(isFirmwareChannel(value)).toBe(expected)
    })
  }
})

describe('isFirmwareDownloadUrlAllowed — two-tier policy (#880)', () => {
  // Repo-bound hosts: github.com / api.github.com URLs are accepted ONLY when
  // the path is rooted at the CANShift repo. A foreign-repo path is refused.
  const repoBoundAllowed: string[] = [
    'https://github.com/tburkhalterr/CANShift/releases/download/v1/firmware.bin',
    'https://api.github.com/repos/tburkhalterr/CANShift/releases',
  ]
  for (const url of repoBoundAllowed) {
    it(`accepts repo-rooted ${url}`, () => {
      expect(isFirmwareDownloadUrlAllowed(url)).toBe(true)
    })
  }

  // Opaque CDN hosts: URLs pass only when previously surfaced by listReleases()
  // (mocked via firmwareService.isFirmwareUrlTrusted).
  const opaqueCdnUrls: string[] = [
    'https://objects.githubusercontent.com/abc/def.bin',
    'https://release-assets.githubusercontent.com/abc/def.bin',
  ]
  for (const url of opaqueCdnUrls) {
    it(`accepts trusted ${url} (after listReleases populated the set)`, () => {
      firmwareMock.isFirmwareUrlTrusted.mockReturnValueOnce(true)
      expect(isFirmwareDownloadUrlAllowed(url)).toBe(true)
      expect(firmwareMock.isFirmwareUrlTrusted).toHaveBeenCalledWith(url)
    })
    it(`rejects untrusted ${url} (URL never surfaced by listReleases)`, () => {
      firmwareMock.isFirmwareUrlTrusted.mockReturnValueOnce(false)
      expect(isFirmwareDownloadUrlAllowed(url)).toBe(false)
    })
  }

  const rejected: { label: string; value: unknown }[] = [
    {
      label: 'github.com URL pointing at a foreign repo',
      value: 'https://github.com/foo/bar/releases/download/v1/firmware.bin',
    },
    {
      label: 'api.github.com URL pointing at a foreign repo',
      value: 'https://api.github.com/repos/foo/bar/releases',
    },
    {
      label: 'http:// on github.com (cleartext)',
      value: 'http://github.com/tburkhalterr/CANShift/releases/download/v1/fw.bin',
    },
    { label: 'https on evil host', value: 'https://evil.example/firmware.bin' },
    { label: 'https on subdomain not in allowlist', value: 'https://raw.github.com/foo/bar.bin' },
    { label: 'file:// path', value: 'file:///etc/passwd' },
    { label: 'javascript: URL', value: 'javascript:alert(1)' },
    { label: 'data: URL', value: 'data:application/octet-stream;base64,AAAA' },
    { label: 'malformed URL', value: 'not-a-url' },
    { label: 'empty string', value: '' },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'number', value: 42 },
    { label: 'object', value: { url: 'https://github.com' } },
  ]
  for (const { label, value } of rejected) {
    it(`rejects ${label}`, () => {
      expect(isFirmwareDownloadUrlAllowed(value)).toBe(false)
    })
  }
})
