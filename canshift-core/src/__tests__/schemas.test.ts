// schemas.test.ts — Regression tests for the Zod schemas introduced by #673.
//
// Each schema gets:
//   1. a valid-sample happy-path
//   2. an invalid-field rejection (wrong enum / wrong type)
// Plus an explicit guard that `ButtonActionSchema` does not accept the legacy
// `targetPageId` field removed in #672.

// `DashboardConfigSchema` is the only schema re-exported from the package
// barrel (#771); the rest are internal — import them directly from the
// schemas modules.
import {
  DashboardConfigSchema,
  DeviceConfigSchema,
  DeviceConfigWireSchema,
  deviceConfigFromWire,
  deviceConfigToWire,
} from '../index.js'
import type { DeviceConfig, DeviceConfigWire } from '../index.js'
import { ButtonActionSchema, ButtonWidgetConfigSchema } from '../schemas/dashboard.js'
import { SignalConfigSchema } from '../schemas/signal.js'

// ---------------------------------------------------------------------------
// DashboardConfigSchema
// ---------------------------------------------------------------------------

describe('DashboardConfigSchema', () => {
  const validDashboard = {
    version: '1.14.0',
    name: 'Test',
    defaultPageId: 'p1',
    revLimitRpm: 7000,
    topBar: {
      height: 30,
      bgColor: '#000000',
      textColor: '#FFFFFF',
    },
    pages: [
      {
        id: 'p1',
        backgroundImage: null,
        backgroundColor: '#000000',
        palette: {
          surface: '#1E1E1E',
          primary: '#FF4444',
          accent: '#FF8800',
          text: '#FFFFFF',
          textDim: '#888888',
          warning: '#FF8800',
          danger: '#FF4444',
          success: '#00CC44',
        },
        showTopBar: true,
        widgets: [],
      },
    ],
  }

  it('accepts a minimal valid dashboard config', () => {
    const result = DashboardConfigSchema.safeParse(validDashboard)
    expect(result.success).toBe(true)
  })

  it('rejects a missing required field (defaultPageId)', () => {
    const invalid: Record<string, unknown> = { ...validDashboard }
    delete invalid.defaultPageId
    const result = DashboardConfigSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('defaultPageId'))).toBe(true)
    }
  })

  it('rejects a malformed semver in version', () => {
    const result = DashboardConfigSchema.safeParse({ ...validDashboard, version: 'v1.0' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing required field (pages)', () => {
    const invalid: Record<string, unknown> = { ...validDashboard }
    delete invalid.pages
    const result = DashboardConfigSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('pages'))).toBe(true)
    }
  })

  // PR #800 (#769) applied `.strict()` to every object schema — unknown keys at
  // the top level must be rejected outright rather than silently stripped.
  it('rejects an unknown top-level key', () => {
    const result = DashboardConfigSchema.safeParse({ ...validDashboard, mystery: 1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// SignalConfigSchema
// ---------------------------------------------------------------------------

describe('SignalConfigSchema', () => {
  const validSignals = {
    version: '1.14.0',
    protocol: 'custom_v1.0',
    canSpeedKbps: 500,
    signals: [
      {
        name: 'rpm',
        canFrameId: '0x370',
        startByte: 0,
        byteLength: 2,
        bigEndian: true,
        signed: false,
        scale: 1,
        offset: 0,
        unit: 'rpm',
        min: 0,
        max: 8000,
        timeoutMs: 1000,
      },
    ],
  }

  it('accepts a minimal valid signal catalog', () => {
    const result = SignalConfigSchema.safeParse(validSignals)
    expect(result.success).toBe(true)
  })

  it('rejects a missing required field (canSpeedKbps)', () => {
    const invalid: Record<string, unknown> = { ...validSignals }
    delete invalid.canSpeedKbps
    const result = SignalConfigSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('canSpeedKbps'))).toBe(true)
    }
  })

  it('rejects a missing required field (signals)', () => {
    const invalid: Record<string, unknown> = { ...validSignals }
    delete invalid.signals
    const result = SignalConfigSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('signals'))).toBe(true)
    }
  })

  // PR #800 (#769) applied `.strict()` to every object schema — unknown keys at
  // the top level must be rejected outright rather than silently stripped.
  it('rejects an unknown top-level key', () => {
    const result = SignalConfigSchema.safeParse({ ...validSignals, mystery: 1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true)
    }
  })

  it('rejects an invalid byteLength (3)', () => {
    const broken = {
      ...validSignals,
      signals: [{ ...validSignals.signals[0], byteLength: 3 }],
    }
    const result = SignalConfigSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it('rejects a non-string protocol field', () => {
    const result = SignalConfigSchema.safeParse({ ...validSignals, protocol: 42 })
    expect(result.success).toBe(false)
  })

  // colorRamp cap enforcement (#700) — firmware mirrors MAX_RAMP_STOPS=8 as a
  // fixed C array. Over-limit configs lose stops on-device, and a single-stop
  // ramp can't interpolate so it's degenerate too.
  it('rejects a colorRamp with fewer than 2 stops', () => {
    const broken = {
      ...validSignals,
      signals: [
        {
          ...validSignals.signals[0],
          colorRamp: { stops: [{ value: 0, color: '#00FF00' }], interpolate: 'linear' },
        },
      ],
    }
    const result = SignalConfigSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it('rejects a colorRamp with more than MAX_RAMP_STOPS=8 stops', () => {
    const stops = Array.from({ length: 9 }, (_, i) => ({
      value: i * 100,
      color: '#FF0000',
    }))
    const broken = {
      ...validSignals,
      signals: [
        {
          ...validSignals.signals[0],
          colorRamp: { stops, interpolate: 'linear' },
        },
      ],
    }
    const result = SignalConfigSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it('rejects a colorRamp whose stops are not strictly ascending', () => {
    const broken = {
      ...validSignals,
      signals: [
        {
          ...validSignals.signals[0],
          colorRamp: {
            stops: [
              { value: 100, color: '#00FF00' },
              { value: 50, color: '#FF0000' },
            ],
            interpolate: 'linear',
          },
        },
      ],
    }
    const result = SignalConfigSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ButtonActionSchema (discriminated union — the core of #673)
// ---------------------------------------------------------------------------

describe('ButtonActionSchema', () => {
  it('accepts a navigate action', () => {
    const result = ButtonActionSchema.safeParse({
      category: 'dashboard',
      type: 'navigate',
      pageId: 'p2',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a map_switch action', () => {
    const result = ButtonActionSchema.safeParse({
      category: 'ecu',
      type: 'map_switch',
      mapIndex: 2,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a can_raw action with hex data', () => {
    const result = ButtonActionSchema.safeParse({
      category: 'ecu',
      type: 'can_raw',
      frameId: 0x520,
      data: 'DEADBEEF',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a can_raw action with non-hex data', () => {
    const result = ButtonActionSchema.safeParse({
      category: 'ecu',
      type: 'can_raw',
      frameId: 0x520,
      data: 'NOTHEX',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown type discriminant', () => {
    const result = ButtonActionSchema.safeParse({
      category: 'dashboard',
      type: 'teleport',
      pageId: 'p2',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a mismatched (category, type) pair', () => {
    // map_switch is an ECU action — pairing it with category: 'dashboard'
    // must fail because each variant pins its own `category` literal.
    const result = ButtonActionSchema.safeParse({
      category: 'dashboard',
      type: 'map_switch',
      mapIndex: 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a button widget with more than MAX_BUTTON_ACTIONS=4 actions (#700)', () => {
    const tooMany = {
      type: 'button',
      label: 'x',
      actions: Array.from({ length: 5 }, () => ({
        category: 'dashboard',
        type: 'navigate',
        pageId: 'p1',
      })),
    }
    const result = ButtonWidgetConfigSchema.safeParse(tooMany)
    expect(result.success).toBe(false)
  })

  it('rejects the legacy targetPageId field on a navigate action (issue #672)', () => {
    // `targetPageId` lived on ButtonWidgetConfig before the 1.0→1.1 migration
    // (issue #672). Since #769 every object schema is `.strict()`, so an
    // unknown key is now an outright rejection rather than a silent strip —
    // the stricter behaviour catches drift immediately if the legacy field
    // ever resurfaces in a config.
    const parsed = ButtonActionSchema.safeParse({
      category: 'dashboard',
      type: 'navigate',
      pageId: 'p2',
      targetPageId: 'p3',
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// DeviceConfigSchema — camelCase domain shape (issue #715)
// ---------------------------------------------------------------------------

describe('DeviceConfigSchema', () => {
  const validDeviceConfig: DeviceConfig = {
    canSpeedKbps: 500,
    twaiTxPin: 22,
    twaiRxPin: 21,
  }

  it('accepts a valid device config', () => {
    const result = DeviceConfigSchema.safeParse(validDeviceConfig)
    expect(result.success).toBe(true)
  })

  it('rejects a missing required field (twaiTxPin)', () => {
    const invalid: Record<string, unknown> = { ...validDeviceConfig }
    delete invalid.twaiTxPin
    const result = DeviceConfigSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects an unsupported CAN speed (e.g. 800 kbps)', () => {
    const result = DeviceConfigSchema.safeParse({ ...validDeviceConfig, canSpeedKbps: 800 })
    expect(result.success).toBe(false)
  })

  it('rejects a GPIO pin outside the ESP32 range (40)', () => {
    const result = DeviceConfigSchema.safeParse({ ...validDeviceConfig, twaiTxPin: 40 })
    expect(result.success).toBe(false)
  })

  it('rejects a non-integer GPIO pin', () => {
    const result = DeviceConfigSchema.safeParse({ ...validDeviceConfig, twaiRxPin: 21.5 })
    expect(result.success).toBe(false)
  })

  it('rejects extra (unknown) fields — .strict() per #769', () => {
    const result = DeviceConfigSchema.safeParse({ ...validDeviceConfig, extra: true })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true)
    }
  })

  it('rejects the snake_case wire shape outright (#715)', () => {
    const wireShape = { can_speed_kbps: 500, twai_tx_pin: 22, twai_rx_pin: 21 }
    const result = DeviceConfigSchema.safeParse(wireShape)
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// DeviceConfigWireSchema — snake_case on-disk format consumed by firmware
// ---------------------------------------------------------------------------

describe('DeviceConfigWireSchema', () => {
  const validWire: DeviceConfigWire = {
    can_speed_kbps: 500,
    twai_tx_pin: 22,
    twai_rx_pin: 21,
  }

  it('accepts the snake_case shape firmware reads from device.json', () => {
    const result = DeviceConfigWireSchema.safeParse(validWire)
    expect(result.success).toBe(true)
  })

  it('rejects a missing required field (twai_rx_pin)', () => {
    const invalid: Record<string, unknown> = { ...validWire }
    delete invalid.twai_rx_pin
    const result = DeviceConfigWireSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects an unsupported CAN speed', () => {
    const result = DeviceConfigWireSchema.safeParse({ ...validWire, can_speed_kbps: 800 })
    expect(result.success).toBe(false)
  })

  it('rejects extra (unknown) fields — .strict()', () => {
    const result = DeviceConfigWireSchema.safeParse({ ...validWire, extra: true })
    expect(result.success).toBe(false)
  })

  it('rejects the camelCase domain shape outright', () => {
    const domainShape = { canSpeedKbps: 500, twaiTxPin: 22, twaiRxPin: 21 }
    const result = DeviceConfigWireSchema.safeParse(domainShape)
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// deviceConfigFromWire / deviceConfigToWire — boundary mappers (issue #715)
// ---------------------------------------------------------------------------

describe('deviceConfigFromWire / deviceConfigToWire', () => {
  it('deviceConfigFromWire renames snake_case keys to camelCase verbatim', () => {
    const wire: DeviceConfigWire = {
      can_speed_kbps: 500,
      twai_tx_pin: 22,
      twai_rx_pin: 21,
    }
    expect(deviceConfigFromWire(wire)).toEqual({
      canSpeedKbps: 500,
      twaiTxPin: 22,
      twaiRxPin: 21,
    })
  })

  it('deviceConfigToWire renames camelCase keys to snake_case verbatim', () => {
    const cfg: DeviceConfig = {
      canSpeedKbps: 250,
      twaiTxPin: 5,
      twaiRxPin: 4,
    }
    expect(deviceConfigToWire(cfg)).toEqual({
      can_speed_kbps: 250,
      twai_tx_pin: 5,
      twai_rx_pin: 4,
    })
  })

  it('round-trips wire → domain → wire without loss', () => {
    const wire: DeviceConfigWire = {
      can_speed_kbps: 1000,
      twai_tx_pin: 0,
      twai_rx_pin: 39,
    }
    expect(deviceConfigToWire(deviceConfigFromWire(wire))).toEqual(wire)
  })

  it('round-trips domain → wire → domain without loss', () => {
    const cfg: DeviceConfig = {
      canSpeedKbps: 125,
      twaiTxPin: 22,
      twaiRxPin: 21,
    }
    expect(deviceConfigFromWire(deviceConfigToWire(cfg))).toEqual(cfg)
  })
})
