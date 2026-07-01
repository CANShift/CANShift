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
import {
  CAN_29BIT_MAX,
  CAN_FRAME_MAX_BYTES,
  FIRMWARE_CAPS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  MAP_INDEX_MAX,
  STRING_CAPS,
} from '../constants/firmware-caps.js'
import { SignalDefSchema } from '../schemas/signal.js'
import { WidgetLayoutSchema, WidgetStyleSchema } from '../schemas/common.js'
import type { DeviceConfig, InputBinding, InputBindingsConfig } from '../index.js'
import {
  ButtonActionSchema,
  ButtonWidgetConfigSchema,
  TopBarItemSchema,
  WidgetSchema,
} from '../schemas/dashboard.js'
import { DeviceConfigWireSchema, type DeviceConfigWire } from '../schemas/device.js'
import {
  InputBindingSchema,
  InputBindingWireSchema,
  InputBindingsConfigWireSchema,
  type InputBindingsConfigWire,
} from '../schemas/input-bindings.js'
import { SignalConfigSchema } from '../schemas/signal.js'

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

  it('rejects an unknown top-level key', () => {
    const result = DashboardConfigSchema.safeParse({ ...validDashboard, mystery: 1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true)
    }
  })

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

  describe('DashboardConfigSchema.nightTheme', () => {
    const validNightTheme = {
      bgColor: '#000000',
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
    }

    it('accepts a dashboard with no nightTheme (backward compat)', () => {
      const result = DashboardConfigSchema.safeParse(validDashboard)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.nightTheme).toBeUndefined()
      }
    })

    it('accepts a dashboard with a full nightTheme', () => {
      const result = DashboardConfigSchema.safeParse({
        ...validDashboard,
        nightTheme: validNightTheme,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.nightTheme?.bgColor).toBe('#000000')
        expect(result.data.nightTheme?.palette?.primary).toBe('#FF4444')
      }
    })

    it('accepts a nightTheme with bgColor only (palette is optional)', () => {
      const result = DashboardConfigSchema.safeParse({
        ...validDashboard,
        nightTheme: { bgColor: '#101010' },
      })
      expect(result.success).toBe(true)
    })

    it('rejects a nightTheme with a malformed bgColor', () => {
      const result = DashboardConfigSchema.safeParse({
        ...validDashboard,
        nightTheme: { bgColor: 'not-a-hex' },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('nightTheme'))).toBe(true)
      }
    })

    it('accepts both dayTheme and nightTheme on the same dashboard', () => {
      const result = DashboardConfigSchema.safeParse({
        ...validDashboard,
        dayTheme: { bgColor: '#DDDDDD' },
        nightTheme: validNightTheme,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.dayTheme?.bgColor).toBe('#DDDDDD')
        expect(result.data.nightTheme?.bgColor).toBe('#000000')
      }
    })
  })

  describe('PageConfigSchema.template', () => {
    it('accepts a page with no template (defaults to custom behavior)', () => {
      const result = DashboardConfigSchema.safeParse(validDashboard)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.pages[0]?.template).toBeUndefined()
      }
    })

    it('accepts a page with template: "custom"', () => {
      const page0 = validDashboard.pages[0] as Record<string, unknown>
      const dash = {
        ...validDashboard,
        pages: [{ ...page0, template: 'custom' }],
      }
      const result = DashboardConfigSchema.safeParse(dash)
      expect(result.success).toBe(true)
    })

    it('accepts a page with template: "cruise_control" — widgets[] still required (may be empty)', () => {
      const page0 = validDashboard.pages[0] as Record<string, unknown>
      const dash = {
        ...validDashboard,
        pages: [{ ...page0, template: 'cruise_control', widgets: [] }],
      }
      const result = DashboardConfigSchema.safeParse(dash)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.pages[0]?.template).toBe('cruise_control')
      }
    })

    it('rejects an unknown template value', () => {
      const page0 = validDashboard.pages[0] as Record<string, unknown>
      const dash = {
        ...validDashboard,
        pages: [{ ...page0, template: 'tempomat' }],
      }
      const result = DashboardConfigSchema.safeParse(dash)
      expect(result.success).toBe(false)
    })
  })
})

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

  it('rejects an unknown top-level key', () => {
    const result = SignalConfigSchema.safeParse({ ...validSignals, mystery: 1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true)
    }
  })

  it('accepts the firmware-decodable byteLengths (1, 2, 4)', () => {
    for (const len of [1, 2, 4]) {
      const candidate = {
        ...validSignals,
        signals: [{ ...validSignals.signals[0], byteLength: len }],
      }
      const result = SignalConfigSchema.safeParse(candidate)
      expect(result.success).toBe(true)
    }
  })

  it('rejects byteLengths the firmware cannot decode (3, 5, 8)', () => {
    for (const len of [3, 5, 8]) {
      const broken = {
        ...validSignals,
        signals: [{ ...validSignals.signals[0], byteLength: len }],
      }
      const result = SignalConfigSchema.safeParse(broken)
      expect(result.success).toBe(false)
    }
  })

  it('accepts a signal that exactly fills the frame (startByte 6 + byteLength 2)', () => {
    const candidate = {
      ...validSignals,
      signals: [{ ...validSignals.signals[0], startByte: 6, byteLength: 2 }],
    }
    expect(SignalConfigSchema.safeParse(candidate).success).toBe(true)
  })

  it('rejects a signal overflowing the frame (startByte 7 + byteLength 2)', () => {
    const broken = {
      ...validSignals,
      signals: [{ ...validSignals.signals[0], startByte: 7, byteLength: 2 }],
    }
    const result = SignalConfigSchema.safeParse(broken)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('byteLength'))).toBe(true)
    }
  })

  it('accepts a bitMask at the uint8_t limit (0xFF)', () => {
    const candidate = {
      ...validSignals,
      signals: [{ ...validSignals.signals[0], bitMask: '0xFF' }],
    }
    expect(SignalConfigSchema.safeParse(candidate).success).toBe(true)
  })

  it('rejects a bitMask wider than uint8_t (0x100)', () => {
    const broken = {
      ...validSignals,
      signals: [{ ...validSignals.signals[0], bitMask: '0x100' }],
    }
    expect(SignalConfigSchema.safeParse(broken).success).toBe(false)
  })

  it('accepts a canFrameId at the 29-bit limit (0x1FFFFFFF)', () => {
    const candidate = {
      ...validSignals,
      signals: [{ ...validSignals.signals[0], canFrameId: '0x1FFFFFFF' }],
    }
    expect(SignalConfigSchema.safeParse(candidate).success).toBe(true)
  })

  it('rejects a canFrameId past the 29-bit limit (0x20000000)', () => {
    const broken = {
      ...validSignals,
      signals: [{ ...validSignals.signals[0], canFrameId: '0x20000000' }],
    }
    expect(SignalConfigSchema.safeParse(broken).success).toBe(false)
  })

  it('accepts timeoutMs at the bounds (0 and 60000)', () => {
    for (const timeoutMs of [0, 60000]) {
      const candidate = {
        ...validSignals,
        signals: [{ ...validSignals.signals[0], timeoutMs }],
      }
      expect(SignalConfigSchema.safeParse(candidate).success).toBe(true)
    }
  })

  it('rejects negative, fractional, and oversized timeoutMs', () => {
    for (const timeoutMs of [-1, 1.5, 60001]) {
      const broken = {
        ...validSignals,
        signals: [{ ...validSignals.signals[0], timeoutMs }],
      }
      expect(SignalConfigSchema.safeParse(broken).success).toBe(false)
    }
  })

  it('rejects a non-string protocol field', () => {
    const result = SignalConfigSchema.safeParse({ ...validSignals, protocol: 42 })
    expect(result.success).toBe(false)
  })

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
      mode: 'single',
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

  it('rejects twai_tx_pin in the SPI-flash range (7)', () => {
    const result = DeviceConfigWireSchema.safeParse({ ...validWire, twai_tx_pin: 7 })
    expect(result.success).toBe(false)
  })

  it('rejects an input-only pin on twai_tx_pin (35)', () => {
    const result = DeviceConfigWireSchema.safeParse({ ...validWire, twai_tx_pin: 35 })
    expect(result.success).toBe(false)
  })
})

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

  it.each([20, 24, 28, 29, 30, 31])('rejects unbonded pin %i', (pin) => {
    expect(Esp32InputGpioSchema.safeParse(pin).success).toBe(false)
  })

  it('rejection message names SPI flash, unbonded pins, and the input-only exception', () => {
    const result = Esp32InputGpioSchema.safeParse(6)
    expect(result.success).toBe(false)
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? ''
      expect(message).toMatch(/6-11/)
      expect(message).toMatch(/SPI flash/)
      expect(message).toMatch(/20/)
      expect(message).toMatch(/24/)
      expect(message).toMatch(/28-31/)
      expect(message).toMatch(/34-39/)
    }
  })
})

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

describe('schema bounds hardening', () => {
  const validSignal = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
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
    ...overrides,
  })

  const validSignalConfig = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    version: '1.14.0',
    protocol: 'custom_v1.0',
    canSpeedKbps: 500,
    signals: [validSignal()],
    ...overrides,
  })

  const validStyle = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    primaryColor: '#FFFFFF',
    secondaryColor: '#2A2A2A',
    warningColor: '#FF8800',
    criticalColor: '#FF4444',
    textColor: '#FFFFFF',
    fontSize: 14,
    ...overrides,
  })

  const validLayout = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    x: 0,
    y: 0,
    w: 80,
    h: 40,
    zOrder: 0,
    ...overrides,
  })

  describe('signals[] cap (#1168)', () => {
    it(`accepts a catalog with exactly ${String(FIRMWARE_CAPS.MAX_SIGNALS)} signals`, () => {
      const signals = Array.from({ length: FIRMWARE_CAPS.MAX_SIGNALS }, (_, i) =>
        validSignal({ name: `s${String(i)}` })
      )
      const result = SignalConfigSchema.safeParse(validSignalConfig({ signals }))
      expect(result.success).toBe(true)
    })

    it(`rejects a catalog with ${String(FIRMWARE_CAPS.MAX_SIGNALS + 1)} signals`, () => {
      const signals = Array.from({ length: FIRMWARE_CAPS.MAX_SIGNALS + 1 }, (_, i) =>
        validSignal({ name: `s${String(i)}` })
      )
      const result = SignalConfigSchema.safeParse(validSignalConfig({ signals }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('signals'))).toBe(true)
      }
    })
  })

  describe('SignalDef.startByte', () => {
    it('accepts the high boundary (CAN_FRAME_MAX_BYTES - 1)', () => {
      expect(
        SignalDefSchema.safeParse(
          validSignal({ startByte: CAN_FRAME_MAX_BYTES - 1, byteLength: 1 })
        ).success
      ).toBe(true)
    })

    it('rejects startByte = CAN_FRAME_MAX_BYTES (would read past the frame)', () => {
      expect(
        SignalDefSchema.safeParse(validSignal({ startByte: CAN_FRAME_MAX_BYTES })).success
      ).toBe(false)
    })

    it('rejects a negative startByte', () => {
      expect(SignalDefSchema.safeParse(validSignal({ startByte: -1 })).success).toBe(false)
    })

    it('rejects a non-integer startByte', () => {
      expect(SignalDefSchema.safeParse(validSignal({ startByte: 1.5 })).success).toBe(false)
    })
  })

  describe('SignalDef.scale / offset finiteness', () => {
    it('rejects NaN scale', () => {
      expect(SignalDefSchema.safeParse(validSignal({ scale: NaN })).success).toBe(false)
    })

    it('rejects Infinity scale', () => {
      expect(SignalDefSchema.safeParse(validSignal({ scale: Infinity })).success).toBe(false)
    })

    it('rejects NaN offset', () => {
      expect(SignalDefSchema.safeParse(validSignal({ offset: NaN })).success).toBe(false)
    })

    it('rejects Infinity offset', () => {
      expect(SignalDefSchema.safeParse(validSignal({ offset: -Infinity })).success).toBe(false)
    })
  })

  describe('WidgetLayout.zOrder integer-only', () => {
    it('accepts an integer zOrder', () => {
      expect(WidgetLayoutSchema.safeParse(validLayout({ zOrder: 3 })).success).toBe(true)
    })

    it('rejects a non-integer zOrder', () => {
      expect(WidgetLayoutSchema.safeParse(validLayout({ zOrder: 1.5 })).success).toBe(false)
    })
  })

  describe('WidgetStyle.fontSize bounds', () => {
    it('accepts fontSize at the lower boundary', () => {
      expect(WidgetStyleSchema.safeParse(validStyle({ fontSize: FONT_SIZE_MIN })).success).toBe(
        true
      )
    })

    it('accepts fontSize at the upper boundary', () => {
      expect(WidgetStyleSchema.safeParse(validStyle({ fontSize: FONT_SIZE_MAX })).success).toBe(
        true
      )
    })

    it('rejects fontSize below the lower boundary', () => {
      expect(WidgetStyleSchema.safeParse(validStyle({ fontSize: FONT_SIZE_MIN - 1 })).success).toBe(
        false
      )
    })

    it('rejects fontSize above the upper boundary', () => {
      expect(WidgetStyleSchema.safeParse(validStyle({ fontSize: FONT_SIZE_MAX + 1 })).success).toBe(
        false
      )
    })

    it('rejects a non-integer fontSize', () => {
      expect(WidgetStyleSchema.safeParse(validStyle({ fontSize: 14.5 })).success).toBe(false)
    })
  })

  describe('MapSwitchAction.mapIndex bounds', () => {
    it('accepts mapIndex at the high boundary', () => {
      expect(
        ButtonActionSchema.safeParse({
          category: 'ecu',
          type: 'map_switch',
          mapIndex: MAP_INDEX_MAX,
        }).success
      ).toBe(true)
    })

    it('rejects mapIndex past the high boundary', () => {
      expect(
        ButtonActionSchema.safeParse({
          category: 'ecu',
          type: 'map_switch',
          mapIndex: MAP_INDEX_MAX + 1,
        }).success
      ).toBe(false)
    })

    it('rejects a negative mapIndex', () => {
      expect(
        ButtonActionSchema.safeParse({ category: 'ecu', type: 'map_switch', mapIndex: -1 }).success
      ).toBe(false)
    })

    it('rejects a non-integer mapIndex', () => {
      expect(
        ButtonActionSchema.safeParse({ category: 'ecu', type: 'map_switch', mapIndex: 1.5 }).success
      ).toBe(false)
    })
  })

  describe('CanRawAction.frameId bounds', () => {
    it('accepts frameId at the 29-bit boundary when extended=true', () => {
      expect(
        ButtonActionSchema.safeParse({
          category: 'ecu',
          type: 'can_raw',
          frameId: CAN_29BIT_MAX,
          data: 'DEAD',
          extended: true,
        }).success
      ).toBe(true)
    })

    it('rejects frameId past the 29-bit boundary', () => {
      expect(
        ButtonActionSchema.safeParse({
          category: 'ecu',
          type: 'can_raw',
          frameId: CAN_29BIT_MAX + 1,
          data: 'DEAD',
          extended: true,
        }).success
      ).toBe(false)
    })

    it('rejects a negative frameId', () => {
      expect(
        ButtonActionSchema.safeParse({
          category: 'ecu',
          type: 'can_raw',
          frameId: -1,
          data: 'DEAD',
        }).success
      ).toBe(false)
    })

    it('rejects a non-integer frameId', () => {
      expect(
        ButtonActionSchema.safeParse({
          category: 'ecu',
          type: 'can_raw',
          frameId: 1.5,
          data: 'DEAD',
        }).success
      ).toBe(false)
    })
  })

  describe('SignalDef.name cap', () => {
    it('accepts a name at the cap', () => {
      expect(
        SignalDefSchema.safeParse(validSignal({ name: 'a'.repeat(STRING_CAPS.SIGNAL_NAME) }))
          .success
      ).toBe(true)
    })

    it('rejects a name one over the cap', () => {
      expect(
        SignalDefSchema.safeParse(validSignal({ name: 'a'.repeat(STRING_CAPS.SIGNAL_NAME + 1) }))
          .success
      ).toBe(false)
    })
  })

  describe('SignalDef.unit cap', () => {
    it('accepts a unit at the cap', () => {
      expect(
        SignalDefSchema.safeParse(validSignal({ unit: 'u'.repeat(STRING_CAPS.SIGNAL_UNIT) }))
          .success
      ).toBe(true)
    })

    it('rejects a unit one over the cap', () => {
      expect(
        SignalDefSchema.safeParse(validSignal({ unit: 'u'.repeat(STRING_CAPS.SIGNAL_UNIT + 1) }))
          .success
      ).toBe(false)
    })
  })

  describe('SignalConfig.protocol cap', () => {
    it('accepts a protocol string at the cap', () => {
      expect(
        SignalConfigSchema.safeParse(
          validSignalConfig({ protocol: 'p'.repeat(STRING_CAPS.PROTOCOL) })
        ).success
      ).toBe(true)
    })

    it('rejects a protocol string one over the cap', () => {
      expect(
        SignalConfigSchema.safeParse(
          validSignalConfig({ protocol: 'p'.repeat(STRING_CAPS.PROTOCOL + 1) })
        ).success
      ).toBe(false)
    })
  })

  describe('ButtonWidgetConfig.label cap', () => {
    it('accepts a label at the cap', () => {
      const result = ButtonWidgetConfigSchema.safeParse({
        type: 'button',
        mode: 'single',
        label: 'l'.repeat(STRING_CAPS.WIDGET_LABEL),
        actions: [{ category: 'dashboard', type: 'navigate', pageId: 'p' }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects a label one over the cap', () => {
      const result = ButtonWidgetConfigSchema.safeParse({
        type: 'button',
        mode: 'single',
        label: 'l'.repeat(STRING_CAPS.WIDGET_LABEL + 1),
        actions: [{ category: 'dashboard', type: 'navigate', pageId: 'p' }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects an iconPath one over the cap', () => {
      const result = ButtonWidgetConfigSchema.safeParse({
        type: 'button',
        mode: 'single',
        label: 'btn',
        iconPath: 'i'.repeat(STRING_CAPS.ICON_PATH + 1),
        actions: [{ category: 'dashboard', type: 'navigate', pageId: 'p' }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('InputBinding.signal cap', () => {
    const baseWire = {
      id: 'b1',
      pin: 32,
      active: 'low' as const,
      pullup: true,
      debounce_ms: 20,
      kind: 'short' as const,
      action: { category: 'ecu', type: 'cruise_control', op: 'toggle' },
    }

    it('accepts a wire signal at the cap', () => {
      expect(
        InputBindingWireSchema.safeParse({
          ...baseWire,
          signal: 's'.repeat(STRING_CAPS.BINDING_SIGNAL),
        }).success
      ).toBe(true)
    })

    it('rejects a wire signal one over the cap', () => {
      expect(
        InputBindingWireSchema.safeParse({
          ...baseWire,
          signal: 's'.repeat(STRING_CAPS.BINDING_SIGNAL + 1),
        }).success
      ).toBe(false)
    })

    it('rejects a domain signal one over the cap', () => {
      const domainShape: InputBinding = {
        id: 'b1',
        pin: 32,
        active: 'low',
        pullup: true,
        debounceMs: 20,
        kind: 'short',
        action: { category: 'ecu', type: 'cruise_control', op: 'toggle' },
        signal: 's'.repeat(STRING_CAPS.BINDING_SIGNAL + 1),
      }
      expect(InputBindingSchema.safeParse(domainShape).success).toBe(false)
    })
  })

  describe('Widget.signal bounds (#1289)', () => {
    const validGaugeWidget = (signal: string): Record<string, unknown> => ({
      id: 'w1',
      type: 'gauge',
      signal,
      layout: validLayout(),
      style: validStyle(),
      config: {
        type: 'gauge',
        displayStyle: 'numeric',
        minValue: 0,
        maxValue: 100,
        dangerLevel: 80,
        decimalPlaces: 0,
      },
    })

    const validButtonWidget = (signal: string): Record<string, unknown> => ({
      id: 'b1',
      type: 'button',
      signal,
      layout: validLayout(),
      style: validStyle(),
      config: {
        type: 'button',
        mode: 'single',
        label: 'Map 1',
        actions: [{ category: 'dashboard', type: 'navigate', pageId: 'p1' }],
      },
    })

    it('accepts a gauge signal at the SIGNAL_NAME cap', () => {
      expect(
        WidgetSchema.safeParse(validGaugeWidget('s'.repeat(STRING_CAPS.SIGNAL_NAME))).success
      ).toBe(true)
    })

    it('rejects an empty signal on a gauge widget', () => {
      const result = WidgetSchema.safeParse(validGaugeWidget(''))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('signal'))).toBe(true)
      }
    })

    it('accepts an empty signal on a button widget (firmware demo convention)', () => {
      expect(WidgetSchema.safeParse(validButtonWidget('')).success).toBe(true)
    })

    it('rejects a gauge signal one over the SIGNAL_NAME cap', () => {
      expect(
        WidgetSchema.safeParse(validGaugeWidget('s'.repeat(STRING_CAPS.SIGNAL_NAME + 1))).success
      ).toBe(false)
    })

    it('rejects a button signal one over the SIGNAL_NAME cap', () => {
      expect(
        WidgetSchema.safeParse(validButtonWidget('s'.repeat(STRING_CAPS.SIGNAL_NAME + 1))).success
      ).toBe(false)
    })
  })

  describe('TopBarItem.signal bounds (#1289)', () => {
    const validStatusDot = (signal: string): Record<string, unknown> => ({
      type: 'statusDot',
      signal,
      position: 'left',
    })

    it('accepts a signal at the SIGNAL_NAME cap', () => {
      expect(
        TopBarItemSchema.safeParse(validStatusDot('s'.repeat(STRING_CAPS.SIGNAL_NAME))).success
      ).toBe(true)
    })

    it('rejects an empty signal', () => {
      expect(TopBarItemSchema.safeParse(validStatusDot('')).success).toBe(false)
    })

    it('rejects a signal one over the SIGNAL_NAME cap', () => {
      expect(
        TopBarItemSchema.safeParse(validStatusDot('s'.repeat(STRING_CAPS.SIGNAL_NAME + 1))).success
      ).toBe(false)
    })
  })

  describe('CanRawAction 11-bit guard (#1289)', () => {
    it('rejects frameId 0x800 with extended=false', () => {
      expect(
        ButtonActionSchema.safeParse({
          category: 'ecu',
          type: 'can_raw',
          frameId: 0x800,
          data: 'DEAD',
          extended: false,
        }).success
      ).toBe(false)
    })

    it('rejects frameId 0x800 with extended omitted', () => {
      expect(
        ButtonActionSchema.safeParse({
          category: 'ecu',
          type: 'can_raw',
          frameId: 0x800,
          data: 'DEAD',
        }).success
      ).toBe(false)
    })

    it('accepts frameId 0x800 with extended=true', () => {
      expect(
        ButtonActionSchema.safeParse({
          category: 'ecu',
          type: 'can_raw',
          frameId: 0x800,
          data: 'DEAD',
          extended: true,
        }).success
      ).toBe(true)
    })

    it('accepts frameId 0x7FF with extended=false', () => {
      expect(
        ButtonActionSchema.safeParse({
          category: 'ecu',
          type: 'can_raw',
          frameId: 0x7ff,
          data: 'DEAD',
          extended: false,
        }).success
      ).toBe(true)
    })
  })

  describe('ButtonWidget cycling states (#1380)', () => {
    const sampleAction = {
      category: 'ecu' as const,
      type: 'map_switch' as const,
      mapIndex: 0,
    }
    const cycleState = (mapIndex: number) => ({
      label: `Map ${String(mapIndex + 1)}`,
      action: { ...sampleAction, mapIndex },
    })
    const baseStyle = {
      primaryColor: '#FFFFFF',
      secondaryColor: '#2A2A2A',
      warningColor: '#FF8800',
      criticalColor: '#FF4444',
      textColor: '#FFFFFF',
      fontSize: 14,
    }
    const baseLayout = { x: 0, y: 0, w: 80, h: 40, zOrder: 0 }
    const buildWidget = (configOverrides: Record<string, unknown>) => ({
      id: 'btn1',
      type: 'button' as const,
      signal: '',
      layout: baseLayout,
      style: baseStyle,
      config: {
        type: 'button' as const,
        label: 'Maps',
        ...configOverrides,
      },
    })

    it('accepts a single-mode button with actions[]', () => {
      expect(
        WidgetSchema.safeParse(buildWidget({ mode: 'single', actions: [sampleAction] })).success
      ).toBe(true)
    })

    it('accepts a cycle-mode button with 2 states', () => {
      expect(
        WidgetSchema.safeParse(
          buildWidget({
            mode: 'cycle',
            states: [cycleState(0), cycleState(1)],
            initialActiveIndex: 0,
          })
        ).success
      ).toBe(true)
    })

    it('accepts a cycle-mode button with 4 states (max)', () => {
      expect(
        WidgetSchema.safeParse(
          buildWidget({
            mode: 'cycle',
            states: [cycleState(0), cycleState(1), cycleState(2), cycleState(3)],
            initialActiveIndex: 3,
          })
        ).success
      ).toBe(true)
    })

    it('rejects a button with no mode discriminator', () => {
      expect(WidgetSchema.safeParse(buildWidget({ actions: [sampleAction] })).success).toBe(false)
    })

    it('rejects single mode with states', () => {
      expect(
        WidgetSchema.safeParse(
          buildWidget({
            mode: 'single',
            actions: [sampleAction],
            states: [cycleState(0), cycleState(1)],
            initialActiveIndex: 0,
          })
        ).success
      ).toBe(false)
    })

    it('rejects cycle mode with actions', () => {
      expect(
        WidgetSchema.safeParse(
          buildWidget({
            mode: 'cycle',
            actions: [sampleAction],
            states: [cycleState(0), cycleState(1)],
            initialActiveIndex: 0,
          })
        ).success
      ).toBe(false)
    })

    it('rejects cycle with 1 state (below min)', () => {
      expect(
        WidgetSchema.safeParse(
          buildWidget({
            mode: 'cycle',
            states: [cycleState(0)],
            initialActiveIndex: 0,
          })
        ).success
      ).toBe(false)
    })

    it('rejects cycle with 5 states (above max)', () => {
      expect(
        WidgetSchema.safeParse(
          buildWidget({
            mode: 'cycle',
            states: [cycleState(0), cycleState(1), cycleState(2), cycleState(3), cycleState(0)],
            initialActiveIndex: 0,
          })
        ).success
      ).toBe(false)
    })

    it('rejects cycle with initialActiveIndex out of range', () => {
      expect(
        WidgetSchema.safeParse(
          buildWidget({
            mode: 'cycle',
            states: [cycleState(0), cycleState(1)],
            initialActiveIndex: 2,
          })
        ).success
      ).toBe(false)
    })

    it('rejects cycle without initialActiveIndex', () => {
      expect(
        WidgetSchema.safeParse(
          buildWidget({
            mode: 'cycle',
            states: [cycleState(0), cycleState(1)],
          })
        ).success
      ).toBe(false)
    })

    it('rejects a cycle state with an empty label', () => {
      expect(
        WidgetSchema.safeParse(
          buildWidget({
            mode: 'cycle',
            states: [{ label: '', action: sampleAction }, cycleState(1)],
            initialActiveIndex: 0,
          })
        ).success
      ).toBe(false)
    })
  })
})
