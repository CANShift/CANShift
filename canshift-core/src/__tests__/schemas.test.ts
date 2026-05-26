// schemas.test.ts — Regression tests for the Zod schemas introduced by #673.
//
// Each schema gets:
//   1. a valid-sample happy-path
//   2. an invalid-field rejection (wrong enum / wrong type)
// Plus an explicit guard that `ButtonActionSchema` does not accept the legacy
// `targetPageId` field removed in #672.

// `DashboardConfigSchema` / `SignalConfigSchema` / `DeviceConfigSchema` /
// `InputBindingsConfigSchema` are re-exported from the package barrel (#771,
// #1016); sub-schemas (single binding, wire variants) are internal and
// imported directly from the schemas modules.
import {
  DashboardConfigSchema,
  DeviceConfigSchema,
  Esp32OutputGpioSchema,
  Esp32InputGpioSchema,
  deviceConfigFromWire,
  deviceConfigToWire,
  inputBindingsFromWire,
  inputBindingsToWire,
  isPinAvailableForBoard,
  MAX_INPUT_BINDINGS,
  SAFE_OUTPUT_PINS_WROOM32,
  SAFE_INPUT_PINS_WROOM32,
  TrackTelemetrySchema,
} from '../index.js'
import type { DeviceConfig, InputBinding, InputBindingsConfig } from '../index.js'
import { ButtonActionSchema, ButtonWidgetConfigSchema } from '../schemas/dashboard.js'
import { DeviceConfigWireSchema, type DeviceConfigWire } from '../schemas/device.js'
import {
  InputBindingSchema,
  InputBindingWireSchema,
  InputBindingsConfigWireSchema,
  type InputBindingsConfigWire,
} from '../schemas/input-bindings.js'
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

  // Issue #548 — optional `targetProfile` field. Backward compatibility:
  // dashboards predating the field must parse cleanly without one.
  it('accepts a dashboard with no targetProfile (backward compat)', () => {
    const result = DashboardConfigSchema.safeParse(validDashboard)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.targetProfile).toBeUndefined()
    }
  })

  it('accepts a dashboard with a known targetProfile', () => {
    const result = DashboardConfigSchema.safeParse({
      ...validDashboard,
      targetProfile: 'crowpanel-28',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.targetProfile).toBe('crowpanel-28')
    }
  })

  it('rejects a dashboard with an unknown targetProfile', () => {
    const result = DashboardConfigSchema.safeParse({
      ...validDashboard,
      targetProfile: 'crowpanel-99',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('targetProfile'))).toBe(true)
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

  // -- #831: chip-level GPIO safety enforced through DeviceConfigSchema -------

  it('rejects twaiTxPin in the SPI-flash range (7) — would brick the device', () => {
    const result = DeviceConfigSchema.safeParse({ ...validDeviceConfig, twaiTxPin: 7 })
    expect(result.success).toBe(false)
  })

  it('rejects twaiRxPin in the SPI-flash range (10) — would brick the device', () => {
    const result = DeviceConfigSchema.safeParse({ ...validDeviceConfig, twaiRxPin: 10 })
    expect(result.success).toBe(false)
  })

  it('rejects an input-only pin on twaiTxPin (35) — TWAI TX needs output', () => {
    const result = DeviceConfigSchema.safeParse({ ...validDeviceConfig, twaiTxPin: 35 })
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

  // -- #831: chip-level GPIO safety also enforced on the wire schema ----------

  it('rejects twai_tx_pin in the SPI-flash range (7)', () => {
    const result = DeviceConfigWireSchema.safeParse({ ...validWire, twai_tx_pin: 7 })
    expect(result.success).toBe(false)
  })

  it('rejects an input-only pin on twai_tx_pin (35)', () => {
    const result = DeviceConfigWireSchema.safeParse({ ...validWire, twai_tx_pin: 35 })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Esp32OutputGpioSchema / Esp32InputGpioSchema (issue #831)
// ---------------------------------------------------------------------------

describe('Esp32OutputGpioSchema', () => {
  it('accepts known-safe output pins (22, 25, 32)', () => {
    expect(Esp32OutputGpioSchema.safeParse(22).success).toBe(true)
    expect(Esp32OutputGpioSchema.safeParse(25).success).toBe(true)
    expect(Esp32OutputGpioSchema.safeParse(32).success).toBe(true)
  })

  it.each([6, 7, 8, 9, 10, 11])('rejects SPI-flash pin %i (would brick the device)', (pin) => {
    expect(Esp32OutputGpioSchema.safeParse(pin).success).toBe(false)
  })

  it.each([34, 35, 36, 37, 38, 39])('rejects input-only pin %i', (pin) => {
    expect(Esp32OutputGpioSchema.safeParse(pin).success).toBe(false)
  })

  it('rejects an unbonded pin (20)', () => {
    expect(Esp32OutputGpioSchema.safeParse(20).success).toBe(false)
  })

  it('rejects a non-integer pin', () => {
    expect(Esp32OutputGpioSchema.safeParse(22.5).success).toBe(false)
  })
})

describe('Esp32InputGpioSchema', () => {
  it('accepts the input-only range (34-39) since they can still be read', () => {
    for (const pin of [34, 35, 36, 37, 38, 39]) {
      expect(Esp32InputGpioSchema.safeParse(pin).success).toBe(true)
    }
  })

  it.each([6, 7, 8, 9, 10, 11])('still rejects SPI-flash pin %i', (pin) => {
    expect(Esp32InputGpioSchema.safeParse(pin).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SAFE_OUTPUT_PINS_WROOM32 / SAFE_INPUT_PINS_WROOM32 (audit C-LO-7, #1016)
// ---------------------------------------------------------------------------

describe('SAFE_OUTPUT_PINS_WROOM32', () => {
  it('matches the canonical snapshot', () => {
    expect([...SAFE_OUTPUT_PINS_WROOM32]).toEqual([
      0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33,
    ])
  })

  it('stays in lockstep with Esp32OutputGpioSchema', () => {
    for (const pin of SAFE_OUTPUT_PINS_WROOM32) {
      expect(Esp32OutputGpioSchema.safeParse(pin).success).toBe(true)
    }
  })

  it('excludes every SPI-flash pin (6-11)', () => {
    for (const pin of [6, 7, 8, 9, 10, 11]) {
      expect((SAFE_OUTPUT_PINS_WROOM32 as readonly number[]).includes(pin)).toBe(false)
    }
  })
})

describe('SAFE_INPUT_PINS_WROOM32', () => {
  it('is a superset of SAFE_OUTPUT_PINS_WROOM32 + (34-39)', () => {
    const input = new Set<number>(SAFE_INPUT_PINS_WROOM32)
    for (const pin of SAFE_OUTPUT_PINS_WROOM32) expect(input.has(pin)).toBe(true)
    for (const pin of [34, 35, 36, 37, 38, 39]) expect(input.has(pin)).toBe(true)
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
      twai_tx_pin: 22,
      twai_rx_pin: 21,
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

// ---------------------------------------------------------------------------
// ButtonActionSchema — cruise control variant (issue #833 / #451)
// ---------------------------------------------------------------------------

describe('ButtonActionSchema — cruise_control variant', () => {
  it('accepts a bare op (on/off/toggle/set/resume)', () => {
    for (const op of ['on', 'off', 'toggle', 'set', 'resume']) {
      const result = ButtonActionSchema.safeParse({
        category: 'ecu',
        type: 'cruise_control',
        op,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts increment/decrement with stepKmh', () => {
    const result = ButtonActionSchema.safeParse({
      category: 'ecu',
      type: 'cruise_control',
      op: 'increment',
      stepKmh: 5,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown op', () => {
    const result = ButtonActionSchema.safeParse({
      category: 'ecu',
      type: 'cruise_control',
      op: 'fly',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a wrong category (must be ecu)', () => {
    const result = ButtonActionSchema.safeParse({
      category: 'dashboard',
      type: 'cruise_control',
      op: 'on',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an out-of-range stepKmh', () => {
    expect(
      ButtonActionSchema.safeParse({
        category: 'ecu',
        type: 'cruise_control',
        op: 'increment',
        stepKmh: 0,
      }).success
    ).toBe(false)
    expect(
      ButtonActionSchema.safeParse({
        category: 'ecu',
        type: 'cruise_control',
        op: 'increment',
        stepKmh: 999,
      }).success
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// InputBindingsConfig — physical GPIO buttons (issue #833)
// ---------------------------------------------------------------------------

describe('InputBindingWireSchema / InputBindingSchema', () => {
  const validWire = {
    id: 'steering_set',
    pin: 34,
    active: 'low' as const,
    pullup: true,
    debounce_ms: 25,
    kind: 'short' as const,
    action: { category: 'ecu', type: 'cruise_control', op: 'set' },
  }

  it('accepts a minimal valid wire binding', () => {
    expect(InputBindingWireSchema.safeParse(validWire).success).toBe(true)
  })

  it('accepts the optional signal field on both wire and domain', () => {
    expect(InputBindingWireSchema.safeParse({ ...validWire, signal: 'als_armed' }).success).toBe(
      true
    )
    const domainShape: InputBinding = {
      id: 'als_btn',
      pin: 32,
      active: 'low',
      pullup: true,
      debounceMs: 20,
      kind: 'short',
      action: { category: 'ecu', type: 'cruise_control', op: 'toggle' },
      signal: 'als_armed',
    }
    expect(InputBindingSchema.safeParse(domainShape).success).toBe(true)
  })

  it('rejects an SPI-flash pin (6-11)', () => {
    expect(InputBindingWireSchema.safeParse({ ...validWire, pin: 7 }).success).toBe(false)
  })

  it('rejects extra (unknown) fields — .strict()', () => {
    expect(InputBindingWireSchema.safeParse({ ...validWire, foo: 'bar' }).success).toBe(false)
  })

  it('rejects an unknown press kind', () => {
    expect(InputBindingWireSchema.safeParse({ ...validWire, kind: 'triple' }).success).toBe(false)
  })

  it('rejects an out-of-range debounce', () => {
    expect(InputBindingWireSchema.safeParse({ ...validWire, debounce_ms: 0 }).success).toBe(false)
    expect(InputBindingWireSchema.safeParse({ ...validWire, debounce_ms: 9999 }).success).toBe(
      false
    )
  })

  it('rejects camelCase debounceMs on the wire schema', () => {
    const rest = { ...validWire } as Record<string, unknown>
    delete rest.debounce_ms
    expect(InputBindingWireSchema.safeParse({ ...rest, debounceMs: 25 }).success).toBe(false)
  })
})

describe('InputBindingsConfigWireSchema cap', () => {
  it(`rejects > ${String(MAX_INPUT_BINDINGS)} bindings`, () => {
    const one = {
      id: 'b',
      pin: 32,
      active: 'low' as const,
      pullup: true,
      debounce_ms: 20,
      kind: 'short' as const,
      action: { category: 'ecu', type: 'cruise_control', op: 'toggle' },
    }
    const tooMany = {
      input_bindings: Array.from({ length: MAX_INPUT_BINDINGS + 1 }, (_, i) => ({
        ...one,
        id: `b${String(i)}`,
      })),
    }
    expect(InputBindingsConfigWireSchema.safeParse(tooMany).success).toBe(false)
  })
})

describe('inputBindingsFromWire / inputBindingsToWire', () => {
  const wire: InputBindingsConfigWire = {
    input_bindings: [
      {
        id: 'steering_set',
        pin: 34,
        active: 'low',
        pullup: true,
        debounce_ms: 25,
        kind: 'short',
        action: { category: 'ecu', type: 'cruise_control', op: 'set' },
      },
      {
        id: 'als_btn',
        pin: 32,
        active: 'low',
        pullup: true,
        debounce_ms: 20,
        kind: 'short',
        action: { category: 'ecu', type: 'can_raw', frameId: 0x123, data: 'DEAD' },
        signal: 'als_armed',
      },
    ],
  }

  it('renames debounce_ms → debounceMs and preserves the action verbatim', () => {
    const domain = inputBindingsFromWire(wire)
    expect(domain.inputBindings[0]?.debounceMs).toBe(25)
    expect(domain.inputBindings[0]?.action).toEqual(wire.input_bindings[0]?.action)
    expect(domain.inputBindings[1]?.signal).toBe('als_armed')
  })

  it('round-trips wire → domain → wire without loss', () => {
    expect(inputBindingsToWire(inputBindingsFromWire(wire))).toEqual(wire)
  })

  it('round-trips domain → wire → domain without loss', () => {
    const cfg: InputBindingsConfig = {
      inputBindings: [
        {
          id: 'b1',
          pin: 22,
          active: 'high',
          pullup: false,
          debounceMs: 50,
          kind: 'long',
          action: { category: 'dashboard', type: 'navigate', pageId: 'home' },
        },
      ],
    }
    expect(inputBindingsFromWire(inputBindingsToWire(cfg))).toEqual(cfg)
  })

  it('round-trips a domain binding with the optional signal field set', () => {
    const cfg: InputBindingsConfig = {
      inputBindings: [
        {
          id: 'als_btn',
          pin: 25,
          active: 'low',
          pullup: true,
          debounceMs: 20,
          kind: 'short',
          action: { category: 'ecu', type: 'cruise_control', op: 'toggle' },
          signal: 'als_armed',
        },
      ],
    }
    expect(inputBindingsFromWire(inputBindingsToWire(cfg))).toEqual(cfg)
  })
})

// ---------------------------------------------------------------------------
// HardwareProfile helpers (issue #831)
// ---------------------------------------------------------------------------

describe('isPinAvailableForBoard', () => {
  it('marks display MOSI (GPIO 13) as unavailable on crowpanel_28', () => {
    expect(isPinAvailableForBoard('crowpanel_28', 13)).toBe(false)
  })

  it('marks touch CS (GPIO 33) as unavailable on crowpanel_28', () => {
    expect(isPinAvailableForBoard('crowpanel_28', 33)).toBe(false)
  })

  it('marks expansion-header pins (GPIO 25, 32) as available on crowpanel_28', () => {
    expect(isPinAvailableForBoard('crowpanel_28', 25)).toBe(true)
    expect(isPinAvailableForBoard('crowpanel_28', 32)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TrackTelemetrySchema (issue #843) — BLE Track-mode message contract
// ---------------------------------------------------------------------------

describe('TrackTelemetrySchema', () => {
  it('accepts the minimal payload with only trackMode', () => {
    expect(TrackTelemetrySchema.safeParse({ trackMode: false }).success).toBe(true)
  })

  it('accepts a fully populated payload', () => {
    expect(
      TrackTelemetrySchema.safeParse({
        trackMode: true,
        currentLapMs: 45_321,
        lastLapMs: 92_100,
        bestLapMs: 88_500,
        lapNumber: 3,
        deltaMs: 3_600,
        isBestLap: false,
      }).success
    ).toBe(true)
  })

  it('rejects negative lap times', () => {
    expect(TrackTelemetrySchema.safeParse({ trackMode: true, currentLapMs: -1 }).success).toBe(
      false
    )
  })

  it('rejects non-integer lap times', () => {
    expect(TrackTelemetrySchema.safeParse({ trackMode: true, currentLapMs: 1.5 }).success).toBe(
      false
    )
  })

  it('rejects laps longer than 1 hour', () => {
    expect(
      TrackTelemetrySchema.safeParse({ trackMode: true, currentLapMs: 60 * 60 * 1000 + 1 }).success
    ).toBe(false)
  })

  it('rejects a negative lapNumber', () => {
    expect(TrackTelemetrySchema.safeParse({ trackMode: true, lapNumber: -1 }).success).toBe(false)
  })

  it('accepts a signed delta in both directions', () => {
    expect(TrackTelemetrySchema.safeParse({ trackMode: true, deltaMs: 250 }).success).toBe(true)
    expect(TrackTelemetrySchema.safeParse({ trackMode: true, deltaMs: -250 }).success).toBe(true)
  })

  it('rejects an out-of-range delta (more than an hour)', () => {
    expect(
      TrackTelemetrySchema.safeParse({ trackMode: true, deltaMs: 60 * 60 * 1000 + 1 }).success
    ).toBe(false)
  })

  it('rejects a missing trackMode flag', () => {
    expect(TrackTelemetrySchema.safeParse({ currentLapMs: 1000 }).success).toBe(false)
  })

  it('rejects an unknown top-level key — .strict()', () => {
    expect(TrackTelemetrySchema.safeParse({ trackMode: true, sectorMs: 12345 }).success).toBe(false)
  })
})
