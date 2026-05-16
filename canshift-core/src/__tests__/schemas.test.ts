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
import { DashboardConfigSchema } from '../index.js'
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
    // (issue #672). It must NEVER appear inside a ButtonAction — the new
    // discriminated union does not declare it and `z.object` strips unknown
    // keys, so `safeParse` succeeds but the parsed shape MUST NOT carry
    // `targetPageId`. This guards against schema drift if the field is ever
    // accidentally re-introduced.
    const parsed = ButtonActionSchema.safeParse({
      category: 'dashboard',
      type: 'navigate',
      pageId: 'p2',
      targetPageId: 'p3',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect('targetPageId' in parsed.data).toBe(false)
    }
  })
})
