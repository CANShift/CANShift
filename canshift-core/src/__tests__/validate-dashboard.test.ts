// validate-dashboard.test.ts

import type { SignalConfig } from '../types/signal.js'
import { validateDashboard } from '../validation/validate-dashboard.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minimalWidget(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'w1',
    type: 'gauge',
    minValue: 0,
    maxValue: 8000,
    decimalPlaces: 0,
    ...overrides,
  }
}

function minimalPage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'p1', name: 'Main', widgets: [minimalWidget()], ...overrides }
}

function minimalConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: '1.2.0',
    name: 'Test Dashboard',
    defaultPageId: 'p1',
    revLimitRpm: 7000,
    pages: [minimalPage()],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Top-level field validation
// ---------------------------------------------------------------------------

describe('validateDashboard — top-level fields', () => {
  it('accepts a minimal valid config', () => {
    const result = validateDashboard(minimalConfig())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects non-object input', () => {
    expect(validateDashboard(null).valid).toBe(false)
    expect(validateDashboard(42).valid).toBe(false)
    expect(validateDashboard('string').valid).toBe(false)
    expect(validateDashboard(undefined).valid).toBe(false)
  })

  it('requires version to be a string', () => {
    const result = validateDashboard(minimalConfig({ version: 3 }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required field: version')
  })

  it('requires name to be a non-empty string', () => {
    const missingName = validateDashboard(minimalConfig({ name: undefined }))
    expect(missingName.errors).toContain('Missing required field: name')

    const emptyName = validateDashboard(minimalConfig({ name: '' }))
    expect(emptyName.errors).toContain('Missing required field: name')
  })

  it('requires defaultPageId to be a string', () => {
    const result = validateDashboard(minimalConfig({ defaultPageId: 99 }))
    expect(result.errors).toContain('Missing required field: defaultPageId')
  })

  it('requires revLimitRpm to be a positive number', () => {
    const zero = validateDashboard(minimalConfig({ revLimitRpm: 0 }))
    expect(zero.errors).toContain('revLimitRpm must be a positive number')

    const negative = validateDashboard(minimalConfig({ revLimitRpm: -500 }))
    expect(negative.errors).toContain('revLimitRpm must be a positive number')

    const string = validateDashboard(minimalConfig({ revLimitRpm: '7000' }))
    expect(string.errors).toContain('revLimitRpm must be a positive number')
  })

  it('requires pages to be a non-empty array', () => {
    const noPages = validateDashboard(minimalConfig({ pages: [] }))
    expect(noPages.errors).toContain('pages must be a non-empty array')

    const notArray = validateDashboard(minimalConfig({ pages: 'oops' }))
    expect(notArray.errors).toContain('pages must be a non-empty array')
  })

  it('rejects defaultPageId that does not match any page id', () => {
    const result = validateDashboard(minimalConfig({ defaultPageId: 'missing' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('does not match any page id'))).toBe(true)
  })

  it('accumulates all errors rather than stopping at first', () => {
    const result = validateDashboard({
      pages: [minimalPage()],
    })
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

// ---------------------------------------------------------------------------
// TopBar validation
// ---------------------------------------------------------------------------

describe('validateDashboard — topBar validation', () => {
  it('accepts topBar with a positive height', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: 30,
          showMapName: true,
          showMapProfile: false,
          bgColor: '#000',
          textColor: '#fff',
        },
      })
    )
    expect(result.errors.some((e) => e.includes('topBar.height'))).toBe(false)
  })

  it('rejects topBar.height of zero', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: 0,
          showMapName: false,
          showMapProfile: false,
          bgColor: '#000',
          textColor: '#fff',
        },
      })
    )
    expect(result.errors).toContain('topBar.height must be a positive number')
  })

  it('rejects topBar.height that is negative', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: -5,
          showMapName: false,
          showMapProfile: false,
          bgColor: '#000',
          textColor: '#fff',
        },
      })
    )
    expect(result.errors).toContain('topBar.height must be a positive number')
  })

  it('rejects topBar.height that is not a number', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: '30',
          showMapName: false,
          showMapProfile: false,
          bgColor: '#000',
          textColor: '#fff',
        },
      })
    )
    expect(result.errors).toContain('topBar.height must be a positive number')
  })
})

// ---------------------------------------------------------------------------
// Page validation
// ---------------------------------------------------------------------------

describe('validateDashboard — page validation', () => {
  it('requires page.id', () => {
    const result = validateDashboard(minimalConfig({ pages: [minimalPage({ id: '' })] }))
    expect(result.errors.some((e) => e.includes('pages[0].id'))).toBe(true)
  })

  it('requires page.widgets to be an array', () => {
    const result = validateDashboard(minimalConfig({ pages: [minimalPage({ widgets: null })] }))
    expect(result.errors.some((e) => e.includes('pages[0].widgets'))).toBe(true)
  })

  it('validates each page independently', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ id: 'p1' }), minimalPage({ id: 'p2', widgets: null })],
        defaultPageId: 'p1',
      })
    )
    expect(result.errors.some((e) => e.includes('pages[1].widgets'))).toBe(true)
    expect(result.errors.some((e) => e.includes('pages[0]'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Widget validation
// ---------------------------------------------------------------------------

describe('validateDashboard — widget validation', () => {
  it('requires widget.id', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [{ type: 'gauge' }] })] })
    )
    expect(result.errors.some((e) => e.includes('.id is required'))).toBe(true)
  })

  it('requires widget.type', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [{ id: 'w1' }] })] })
    )
    expect(result.errors.some((e) => e.includes('.type is required'))).toBe(true)
  })

  it('rejects unknown widget types', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [minimalWidget({ type: 'chart' })] })] })
    )
    expect(result.errors.some((e) => e.includes('"chart" is not a valid widget type'))).toBe(true)
  })

  it('accepts a minimal valid widget for every widget type', () => {
    const cases: Record<string, Record<string, unknown>> = {
      gauge: { id: 'w1', type: 'gauge', minValue: 0, maxValue: 8000, decimalPlaces: 0 },
      warning: { id: 'w1', type: 'warning', signal: 'oil_press_bar', threshold: 1 },
      button: {
        id: 'w1',
        type: 'button',
        actions: [{ category: 'dashboard', type: 'navigate', pageId: 'p1' }],
      },
      timer: { id: 'w1', type: 'timer' },
      bar: { id: 'w1', type: 'bar', minValue: 0, maxValue: 100, decimalPlaces: 0 },
      gear: { id: 'w1', type: 'gear', decimalPlaces: 0 },
      image: { id: 'w1', type: 'image', imagePath: 'gear.png' },
    }

    for (const [type, widget] of Object.entries(cases)) {
      const result = validateDashboard(
        minimalConfig({ pages: [minimalPage({ widgets: [widget] })] })
      )
      expect(result.errors.filter((e) => e.includes('not a valid widget type'))).toHaveLength(0)
      // Sanity check: the type-specific shape is also valid
      expect(result.errors.filter((e) => e.includes(`(${type})`))).toHaveLength(0)
    }
  })

  it('rejects a non-object widget', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: ['not-a-widget'] })] })
    )
    expect(result.errors.some((e) => e.includes('must be an object'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Gauge widget validation
// ---------------------------------------------------------------------------

describe('validateDashboard — gauge widget type fields', () => {
  function gaugeWidget(cfg: Record<string, unknown>): Record<string, unknown> {
    return { id: 'w1', type: 'gauge', decimalPlaces: 0, ...cfg }
  }

  it('accepts a valid gauge widget', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [gaugeWidget({ minValue: 0, maxValue: 8000 })] })],
      })
    )
    expect(result.errors.filter((e) => e.includes('(gauge)'))).toHaveLength(0)
  })

  it('requires minValue to be a number', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [gaugeWidget({ maxValue: 8000 })] })],
      })
    )
    expect(result.errors.some((e) => e.includes('(gauge): minValue must be a number'))).toBe(true)
  })

  it('requires maxValue to be a number', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [gaugeWidget({ minValue: 0 })] })],
      })
    )
    expect(result.errors.some((e) => e.includes('(gauge): maxValue must be a number'))).toBe(true)
  })

  it('rejects minValue >= maxValue', () => {
    const equal = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [gaugeWidget({ minValue: 100, maxValue: 100 })] })],
      })
    )
    expect(
      equal.errors.some((e) => e.includes('(gauge): minValue must be less than maxValue'))
    ).toBe(true)

    const inverted = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [gaugeWidget({ minValue: 200, maxValue: 100 })] })],
      })
    )
    expect(
      inverted.errors.some((e) => e.includes('(gauge): minValue must be less than maxValue'))
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Warning widget validation
// ---------------------------------------------------------------------------

describe('validateDashboard — warning widget type fields', () => {
  function warningWidget(cfg: Record<string, unknown>): Record<string, unknown> {
    return { id: 'w1', type: 'warning', ...cfg }
  }

  it('accepts a valid warning widget', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({ widgets: [warningWidget({ signal: 'oil_pressure', threshold: 95 })] }),
        ],
      })
    )
    expect(result.errors.filter((e) => e.includes('(warning)'))).toHaveLength(0)
  })

  it('requires threshold to be a number', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [warningWidget({ signal: 'oil_pressure' })] })],
      })
    )
    expect(result.errors.some((e) => e.includes('(warning): threshold must be a number'))).toBe(
      true
    )
  })

  it('requires signal to be a non-empty string on the parent widget', () => {
    const missing = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [warningWidget({ threshold: 95 })] })],
      })
    )
    expect(
      missing.errors.some((e) => e.includes('(warning): signal must be a non-empty string'))
    ).toBe(true)

    const empty = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [warningWidget({ signal: '', threshold: 95 })] })],
      })
    )
    expect(
      empty.errors.some((e) => e.includes('(warning): signal must be a non-empty string'))
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Button widget validation
// ---------------------------------------------------------------------------

describe('validateDashboard — button widget type fields', () => {
  function buttonWidget(cfg: Record<string, unknown>): Record<string, unknown> {
    return { id: 'w1', type: 'button', ...cfg }
  }

  it('accepts a button with an actions array', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              buttonWidget({
                actions: [{ category: 'dashboard', type: 'navigate', pageId: 'p2' }],
              }),
            ],
          }),
        ],
      })
    )
    expect(result.errors.filter((e) => e.includes('(button)'))).toHaveLength(0)
  })

  it('rejects a legacy targetPageId-only button (must be migrated to actions first)', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [buttonWidget({ targetPageId: 'p2' })] })],
      })
    )
    expect(
      result.errors.some((e) => e.includes('(button): actions must be a non-empty array'))
    ).toBe(true)
  })

  it('rejects a button with an empty actions array', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [buttonWidget({ actions: [] })] })],
      })
    )
    expect(
      result.errors.some((e) => e.includes('(button): actions must be a non-empty array'))
    ).toBe(true)
  })

  it('rejects a button with no actions field at all', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [buttonWidget({})] })],
      })
    )
    expect(
      result.errors.some((e) => e.includes('(button): actions must be a non-empty array'))
    ).toBe(true)
  })

  it('rejects a navigate action with empty pageId', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              buttonWidget({
                actions: [{ category: 'dashboard', type: 'navigate', pageId: '' }],
              }),
            ],
          }),
        ],
      })
    )
    expect(
      result.errors.some((e) => e.includes('navigate.pageId must be a non-empty string'))
    ).toBe(true)
  })

  it('rejects a map_switch action with non-integer mapIndex', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              buttonWidget({
                actions: [{ category: 'ecu', type: 'map_switch', mapIndex: 1.5 }],
              }),
            ],
          }),
        ],
      })
    )
    expect(
      result.errors.some((e) => e.includes('map_switch.mapIndex must be an integer'))
    ).toBe(true)
  })

  it('rejects an action with unknown category/type combination', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [buttonWidget({ actions: [{ category: 'bogus', type: 'whatever' }] })],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('unknown action'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CanRawAction.data validation
// ---------------------------------------------------------------------------

describe('validateDashboard — can_raw action data validation', () => {
  function buttonWithCanRaw(data: unknown): Record<string, unknown> {
    return {
      id: 'w1',
      type: 'button',
      label: 'Send',
      actions: [{ category: 'ecu', type: 'can_raw', frameId: 0x520, data }],
    }
  }

  it('accepts an empty string (zero-byte frame)', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [buttonWithCanRaw('')] })] })
    )
    expect(result.errors.filter((e) => e.includes('can_raw') || e.includes('data'))).toHaveLength(0)
  })

  it('accepts a valid 8-character hex payload (DEADBEEF)', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [buttonWithCanRaw('DEADBEEF')] })] })
    )
    expect(result.errors.filter((e) => e.includes('actions[0]'))).toHaveLength(0)
  })

  it('accepts a maximum-length 16-character hex payload', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [buttonWithCanRaw('0102030405060708')] })],
      })
    )
    expect(result.errors.filter((e) => e.includes('actions[0]'))).toHaveLength(0)
  })

  it('rejects a non-hex string (GG)', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [buttonWithCanRaw('GG')] })] })
    )
    expect(
      result.errors.some((e) => e.includes('actions[0]') && e.includes('even-length hex'))
    ).toBe(true)
  })

  it('rejects an odd-length hex string (012)', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [buttonWithCanRaw('012')] })] })
    )
    expect(
      result.errors.some((e) => e.includes('actions[0]') && e.includes('even-length hex'))
    ).toBe(true)
  })

  it('rejects a payload longer than 16 hex characters', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [buttonWithCanRaw('0102030405060708090A')] })],
      })
    )
    expect(
      result.errors.some((e) => e.includes('actions[0]') && e.includes('at most 16 hex characters'))
    ).toBe(true)
  })

  it('rejects a non-string data value', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [buttonWithCanRaw(42)] })] })
    )
    expect(
      result.errors.some((e) => e.includes('actions[0]') && e.includes('data must be a string'))
    ).toBe(true)
  })

  it('accepts an explicit extended=true flag (issue #319)', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              {
                id: 'w1',
                type: 'button',
                label: 'Send',
                actions: [
                  {
                    category: 'ecu',
                    type: 'can_raw',
                    frameId: 0x18ff5021,
                    data: 'DEADBEEF',
                    extended: true,
                  },
                ],
              },
            ],
          }),
        ],
      })
    )
    expect(result.errors.filter((e) => e.includes('actions[0]'))).toHaveLength(0)
  })

  it('rejects a non-boolean extended value', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              {
                id: 'w1',
                type: 'button',
                label: 'Send',
                actions: [
                  {
                    category: 'ecu',
                    type: 'can_raw',
                    frameId: 0x520,
                    data: '00',
                    extended: 'yes',
                  },
                ],
              },
            ],
          }),
        ],
      })
    )
    expect(
      result.errors.some(
        (e) => e.includes('actions[0]') && e.includes('extended must be a boolean')
      )
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Bar widget validation
// ---------------------------------------------------------------------------

describe('validateDashboard — bar widget type fields', () => {
  function barWidget(cfg: Record<string, unknown>): Record<string, unknown> {
    return { id: 'w1', type: 'bar', decimalPlaces: 0, ...cfg }
  }

  it('accepts a valid bar widget', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [barWidget({ minValue: 0, maxValue: 100 })] })],
      })
    )
    expect(result.errors.filter((e) => e.includes('(bar)'))).toHaveLength(0)
  })

  it('requires minValue to be a number', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [barWidget({ maxValue: 100 })] })],
      })
    )
    expect(result.errors.some((e) => e.includes('(bar): minValue must be a number'))).toBe(true)
  })

  it('requires maxValue to be a number', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [barWidget({ minValue: 0 })] })],
      })
    )
    expect(result.errors.some((e) => e.includes('(bar): maxValue must be a number'))).toBe(true)
  })

  it('rejects minValue >= maxValue', () => {
    const equal = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [barWidget({ minValue: 50, maxValue: 50 })] })],
      })
    )
    expect(equal.errors.some((e) => e.includes('(bar): minValue must be less than maxValue'))).toBe(
      true
    )

    const inverted = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [barWidget({ minValue: 100, maxValue: 0 })] })],
      })
    )
    expect(
      inverted.errors.some((e) => e.includes('(bar): minValue must be less than maxValue'))
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Top bar layout validation
// ---------------------------------------------------------------------------

describe('validateDashboard — top bar layout', () => {
  it('accepts a config without topBar.layout (legacy fallback)', () => {
    const result = validateDashboard(minimalConfig({ topBar: { height: 16 } }))
    expect(result.errors.filter((e) => e.includes('topBar.layout'))).toHaveLength(0)
  })

  it('accepts a valid layout', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: 16,
          layout: [
            { type: 'statusDot', signal: 'rpm', position: 'left' },
            { type: 'label', text: 'ECU', position: 'center' },
            { type: 'themeToggle', position: 'right' },
          ],
        },
      })
    )
    expect(result.errors.filter((e) => e.includes('topBar.layout'))).toHaveLength(0)
  })

  it('rejects a non-array layout', () => {
    const result = validateDashboard(minimalConfig({ topBar: { height: 16, layout: 'oops' } }))
    expect(result.errors).toContain('topBar.layout must be an array')
  })

  it('rejects an unknown item type', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: 16,
          layout: [{ type: 'rocket', position: 'left' }],
        },
      })
    )
    expect(
      result.errors.some(
        (e) => e.includes('topBar.layout[0].type') && e.includes('not a valid top-bar item type')
      )
    ).toBe(true)
  })

  it('rejects an invalid position', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: 16,
          layout: [{ type: 'statusDot', signal: 'rpm', position: 'top' }],
        },
      })
    )
    expect(result.errors.some((e) => e.includes('topBar.layout[0].position'))).toBe(true)
  })

  it('requires statusDot.signal to be a non-empty string', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: 16,
          layout: [{ type: 'statusDot', signal: '', position: 'left' }],
        },
      })
    )
    expect(result.errors.some((e) => e.includes('(statusDot): signal'))).toBe(true)
  })

  it('requires label.text to be a non-empty string', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: 16,
          layout: [{ type: 'label', text: '', position: 'left' }],
        },
      })
    )
    expect(result.errors.some((e) => e.includes('(label): text'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Signal cross-reference warnings
// ---------------------------------------------------------------------------

describe('validateDashboard — signal cross-reference', () => {
  it('emits no warning when signals catalog is absent', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              { id: 'w1', type: 'gauge', signal: 'unknown_signal', minValue: 0, maxValue: 100 },
            ],
          }),
        ],
      })
    )
    expect(result.warnings).toHaveLength(0)
  })

  it('emits no warning when widget.signal is found in catalog', () => {
    const result = validateDashboard(
      minimalConfig({
        signals: [{ name: 'rpm' }],
        pages: [
          minimalPage({
            widgets: [{ id: 'w1', type: 'gauge', signal: 'rpm', minValue: 0, maxValue: 8000 }],
          }),
        ],
      })
    )
    expect(result.warnings.filter((w) => w.includes('not defined in config.signals'))).toHaveLength(
      0
    )
  })

  it('warns when widget.signal is not in the catalog', () => {
    const result = validateDashboard(
      minimalConfig({
        signals: [{ name: 'rpm' }],
        pages: [
          minimalPage({
            widgets: [{ id: 'w1', type: 'gauge', signal: 'boost', minValue: 0, maxValue: 300 }],
          }),
        ],
      })
    )
    expect(
      result.warnings.some(
        (w) => w.includes('"boost"') && w.includes('not defined in config.signals')
      )
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Timer widget
// ---------------------------------------------------------------------------

describe('validateDashboard — timer widget type fields', () => {
  function timerWidget(cfg: Record<string, unknown>): Record<string, unknown> {
    return { id: 'w1', type: 'timer', ...cfg }
  }

  it('accepts a minimal timer widget', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [timerWidget({})] })] })
    )
    expect(result.errors.filter((e) => e.includes('(timer)'))).toHaveLength(0)
  })

  it('accepts known formats', () => {
    for (const format of ['mm:ss', 'ss.mmm']) {
      const result = validateDashboard(
        minimalConfig({ pages: [minimalPage({ widgets: [timerWidget({ format })] })] })
      )
      expect(result.errors.filter((e) => e.includes('(timer)'))).toHaveLength(0)
    }
  })

  it('rejects unknown formats', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [timerWidget({ format: 'hh:mm' })] })] })
    )
    expect(result.errors.some((e) => e.includes('(timer): format'))).toBe(true)
  })

  it('rejects non-boolean autoStart', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [timerWidget({ autoStart: 'yes' })] })],
      })
    )
    expect(result.errors.some((e) => e.includes('(timer): autoStart'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Gear widget
// ---------------------------------------------------------------------------

describe('validateDashboard — gear widget type fields', () => {
  function gearWidget(cfg: Record<string, unknown>): Record<string, unknown> {
    return { id: 'w1', type: 'gear', ...cfg }
  }

  it('accepts a minimal gear widget with decimalPlaces=0', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [gearWidget({ decimalPlaces: 0 })] })],
      })
    )
    expect(result.errors.filter((e) => e.includes('(gear)'))).toHaveLength(0)
  })

  it('rejects decimalPlaces other than 0', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [gearWidget({ decimalPlaces: 1 })] })],
      })
    )
    expect(result.errors.some((e) => e.includes('(gear): decimalPlaces must be 0'))).toBe(true)
  })

  it('rejects non-string prefix/suffix', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [gearWidget({ decimalPlaces: 0, prefix: 42, suffix: true })],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('(gear): prefix'))).toBe(true)
    expect(result.errors.some((e) => e.includes('(gear): suffix'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Image widget
// ---------------------------------------------------------------------------

describe('validateDashboard — image widget type fields', () => {
  function imageWidget(cfg: Record<string, unknown>): Record<string, unknown> {
    return { id: 'w1', type: 'image', ...cfg }
  }

  it('accepts a valid image widget', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [imageWidget({ imagePath: 'logo.png' })] })],
      })
    )
    expect(result.errors.filter((e) => e.includes('(image)'))).toHaveLength(0)
  })

  it('rejects missing imagePath', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [imageWidget({})] })] })
    )
    expect(
      result.errors.some((e) => e.includes('(image): imagePath must be a non-empty string'))
    ).toBe(true)
  })

  it('rejects empty imagePath', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [imageWidget({ imagePath: '' })] })],
      })
    )
    expect(
      result.errors.some((e) => e.includes('(image): imagePath must be a non-empty string'))
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Layout bounds
// ---------------------------------------------------------------------------

describe('validateDashboard — layout bounds', () => {
  function widgetWithLayout(layout: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 'w1',
      type: 'gauge',
      minValue: 0,
      maxValue: 100,
      decimalPlaces: 0,
      layout,
    }
  }

  it('accepts a layout fully inside the canvas', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [widgetWithLayout({ x: 0, y: 0, w: 320, h: 240, zOrder: 0 })],
          }),
        ],
      })
    )
    expect(result.errors.filter((e) => e.includes('layout'))).toHaveLength(0)
  })

  it('rejects negative x/y', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [widgetWithLayout({ x: -1, y: -1, w: 10, h: 10, zOrder: 0 })],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('layout.x'))).toBe(true)
    expect(result.errors.some((e) => e.includes('layout.y'))).toBe(true)
  })

  it('rejects x or y outside the canvas', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [widgetWithLayout({ x: 320, y: 240, w: 10, h: 10, zOrder: 0 })],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('layout.x'))).toBe(true)
    expect(result.errors.some((e) => e.includes('layout.y'))).toBe(true)
  })

  it('rejects x+w > canvas width', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [widgetWithLayout({ x: 200, y: 0, w: 200, h: 10, zOrder: 0 })],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('x+w must be <= 320'))).toBe(true)
  })

  it('rejects y+h > canvas height', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [widgetWithLayout({ x: 0, y: 200, w: 10, h: 200, zOrder: 0 })],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('y+h must be <= 240'))).toBe(true)
  })

  it('rejects zero or negative w/h', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [widgetWithLayout({ x: 0, y: 0, w: 0, h: 0, zOrder: 0 })],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('layout.w'))).toBe(true)
    expect(result.errors.some((e) => e.includes('layout.h'))).toBe(true)
  })

  it('rejects non-numeric zOrder', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [widgetWithLayout({ x: 0, y: 0, w: 10, h: 10, zOrder: 'top' })],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('layout.zOrder'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Hex color regex
// ---------------------------------------------------------------------------

describe('validateDashboard — hex color regex', () => {
  it('rejects a 3-digit hex color in topBar.bgColor', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: { height: 16, bgColor: '#000', textColor: '#FFFFFF' },
      })
    )
    expect(result.errors.some((e) => e.includes('topBar.bgColor'))).toBe(true)
  })

  it('rejects a malformed hex color in widget.style', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              {
                id: 'w1',
                type: 'gauge',
                minValue: 0,
                maxValue: 100,
                decimalPlaces: 0,
                style: {
                  primaryColor: 'red',
                  secondaryColor: '#2A2A2A',
                  warningColor: '#FF8800',
                  criticalColor: '#FF4444',
                  textColor: '#FFFFFF',
                  fontSize: 16,
                },
              },
            ],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('style.primaryColor'))).toBe(true)
  })

  it('rejects a malformed hex color in page.palette', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            palette: {
              surface: 'not-a-color',
              primary: '#FF4444',
              accent: '#FF8800',
              text: '#FFFFFF',
              textDim: '#888888',
              warning: '#FF8800',
              danger: '#FF4444',
              success: '#00CC44',
            },
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('palette.surface'))).toBe(true)
  })

  it('accepts borderColor as null', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              {
                id: 'w1',
                type: 'gauge',
                minValue: 0,
                maxValue: 100,
                decimalPlaces: 0,
                style: {
                  primaryColor: '#FFFFFF',
                  secondaryColor: '#2A2A2A',
                  warningColor: '#FF8800',
                  criticalColor: '#FF4444',
                  textColor: '#FFFFFF',
                  fontSize: 16,
                  borderColor: null,
                },
              },
            ],
          }),
        ],
      })
    )
    expect(result.errors.filter((e) => e.includes('borderColor'))).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// decimalPlaces bounds
// ---------------------------------------------------------------------------

describe('validateDashboard — decimalPlaces bounds', () => {
  function gaugeDP(decimalPlaces: unknown): Record<string, unknown> {
    return { id: 'w1', type: 'gauge', minValue: 0, maxValue: 100, decimalPlaces }
  }

  it('accepts decimalPlaces=4 (upper bound)', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [gaugeDP(4)] })] })
    )
    expect(result.errors.filter((e) => e.includes('decimalPlaces'))).toHaveLength(0)
  })

  it('rejects decimalPlaces=5', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [gaugeDP(5)] })] })
    )
    expect(result.errors.some((e) => e.includes('decimalPlaces'))).toBe(true)
  })

  it('rejects decimalPlaces=-1', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [gaugeDP(-1)] })] })
    )
    expect(result.errors.some((e) => e.includes('decimalPlaces'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// revLimitRpm upper bound
// ---------------------------------------------------------------------------

describe('validateDashboard — revLimitRpm bounds', () => {
  it('accepts revLimitRpm=20000', () => {
    const result = validateDashboard(minimalConfig({ revLimitRpm: 20000 }))
    expect(result.errors.filter((e) => e.includes('revLimitRpm'))).toHaveLength(0)
  })

  it('rejects revLimitRpm=20001', () => {
    const result = validateDashboard(minimalConfig({ revLimitRpm: 20001 }))
    expect(result.errors.some((e) => e.includes('revLimitRpm'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// topBar.height range
// ---------------------------------------------------------------------------

describe('validateDashboard — topBar.height range', () => {
  it('accepts height=60', () => {
    const result = validateDashboard(minimalConfig({ topBar: { height: 60 } }))
    expect(result.errors.filter((e) => e.includes('topBar.height'))).toHaveLength(0)
  })

  it('rejects height=15', () => {
    const result = validateDashboard(minimalConfig({ topBar: { height: 15 } }))
    expect(result.errors.some((e) => e.includes('topBar.height'))).toBe(true)
  })

  it('rejects height=61', () => {
    const result = validateDashboard(minimalConfig({ topBar: { height: 61 } }))
    expect(result.errors.some((e) => e.includes('topBar.height'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// barOrientation enum
// ---------------------------------------------------------------------------

describe('validateDashboard — gauge.barOrientation enum', () => {
  function gaugeOrient(barOrientation: unknown): Record<string, unknown> {
    return {
      id: 'w1',
      type: 'gauge',
      minValue: 0,
      maxValue: 100,
      decimalPlaces: 0,
      barOrientation,
    }
  }

  it('accepts vertical and horizontal', () => {
    for (const orientation of ['vertical', 'horizontal']) {
      const result = validateDashboard(
        minimalConfig({ pages: [minimalPage({ widgets: [gaugeOrient(orientation)] })] })
      )
      expect(result.errors.filter((e) => e.includes('barOrientation'))).toHaveLength(0)
    }
  })

  it('rejects unknown orientation', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [gaugeOrient('diagonal')] })] })
    )
    expect(result.errors.some((e) => e.includes('barOrientation'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// arcFillStyle enum (issue #175)
// ---------------------------------------------------------------------------

describe('validateDashboard — gauge.arcFillStyle enum', () => {
  function gaugeFill(arcFillStyle: unknown): Record<string, unknown> {
    return {
      id: 'w1',
      type: 'gauge',
      minValue: 0,
      maxValue: 100,
      decimalPlaces: 0,
      arcFillStyle,
    }
  }

  it('accepts undefined (legacy configs)', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [{ id: 'w1', type: 'gauge', minValue: 0, maxValue: 100, decimalPlaces: 0 }],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('arcFillStyle'))).toBe(false)
  })

  it('accepts zones and gradient', () => {
    for (const style of ['zones', 'gradient']) {
      const result = validateDashboard(
        minimalConfig({ pages: [minimalPage({ widgets: [gaugeFill(style)] })] })
      )
      expect(result.errors.filter((e) => e.includes('arcFillStyle'))).toHaveLength(0)
    }
  })

  it('rejects unknown values', () => {
    const result = validateDashboard(
      minimalConfig({ pages: [minimalPage({ widgets: [gaugeFill('foobar')] })] })
    )
    expect(result.errors.some((e) => e.includes('arcFillStyle'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Gauge thresholds within range
// ---------------------------------------------------------------------------

describe('validateDashboard — gauge thresholds within range', () => {
  function gaugeThresh(extra: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 'w1',
      type: 'gauge',
      minValue: 0,
      maxValue: 100,
      decimalPlaces: 0,
      ...extra,
    }
  }

  it('accepts thresholds inside [min,max]', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [gaugeThresh({ warningLevel: 50, dangerLevel: 80 })],
          }),
        ],
      })
    )
    expect(
      result.errors.filter((e) => e.includes('warningLevel') || e.includes('dangerLevel'))
    ).toHaveLength(0)
  })

  it('rejects warningLevel above max', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [gaugeThresh({ warningLevel: 150 })] })],
      })
    )
    expect(result.errors.some((e) => e.includes('warningLevel'))).toBe(true)
  })

  it('rejects dangerLevel below min', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [gaugeThresh({ dangerLevel: -5 })] })],
      })
    )
    expect(result.errors.some((e) => e.includes('dangerLevel'))).toBe(true)
  })

  it('does not enforce ordering (warning > danger is allowed for low-side alerts)', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [gaugeThresh({ warningLevel: 80, dangerLevel: 20 })],
          }),
        ],
      })
    )
    expect(
      result.errors.filter((e) => e.includes('warningLevel') || e.includes('dangerLevel'))
    ).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Duplicate-id detection
// ---------------------------------------------------------------------------

describe('validateDashboard — duplicate-id detection', () => {
  it('rejects duplicate page ids', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ id: 'p1' }), minimalPage({ id: 'p1' })],
      })
    )
    expect(result.errors.some((e) => e.includes('duplicate page id'))).toBe(true)
  })

  it('rejects duplicate widget ids within a page', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [minimalWidget({ id: 'dup' }), minimalWidget({ id: 'dup' })],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('duplicate widget id'))).toBe(true)
  })

  it('allows the same widget id on different pages', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({ id: 'p1', widgets: [minimalWidget({ id: 'shared' })] }),
          minimalPage({ id: 'p2', widgets: [minimalWidget({ id: 'shared' })] }),
        ],
      })
    )
    expect(result.errors.filter((e) => e.includes('duplicate widget id'))).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// defaultPageId visibility
// ---------------------------------------------------------------------------

describe('validateDashboard — defaultPageId visibility', () => {
  it('rejects defaultPageId pointing to an invisible page', () => {
    const result = validateDashboard(
      minimalConfig({
        defaultPageId: 'p1',
        pages: [minimalPage({ id: 'p1', visible: false })],
      })
    )
    expect(result.errors.some((e) => e.includes('visible is false'))).toBe(true)
  })

  it('accepts defaultPageId pointing to a visible page', () => {
    const result = validateDashboard(
      minimalConfig({
        defaultPageId: 'p1',
        pages: [minimalPage({ id: 'p1', visible: true })],
      })
    )
    expect(result.errors.filter((e) => e.includes('visible is false'))).toHaveLength(0)
  })

  it('accepts defaultPageId pointing to a page with no visible field', () => {
    const result = validateDashboard(
      minimalConfig({
        defaultPageId: 'p1',
        pages: [minimalPage({ id: 'p1' })],
      })
    )
    expect(result.errors.filter((e) => e.includes('visible is false'))).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Firmware caps
// ---------------------------------------------------------------------------

describe('validateDashboard — firmware caps', () => {
  it('rejects more than MAX_PAGES (5)', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({ id: 'p1' }),
          minimalPage({ id: 'p2' }),
          minimalPage({ id: 'p3' }),
          minimalPage({ id: 'p4' }),
          minimalPage({ id: 'p5' }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('too many pages'))).toBe(true)
  })

  it('rejects more than MAX_WIDGETS_PER_PAGE (13)', () => {
    const tooMany = Array.from({ length: 13 }, (_, i) => minimalWidget({ id: `w${i.toString()}` }))
    const result = validateDashboard(minimalConfig({ pages: [minimalPage({ widgets: tooMany })] }))
    expect(result.errors.some((e) => e.includes('too many widgets'))).toBe(true)
  })

  it('rejects more than MAX_TOPBAR_ITEMS (17)', () => {
    const layout = Array.from({ length: 17 }, () => ({ type: 'separator', position: 'left' }))
    const result = validateDashboard(minimalConfig({ topBar: { height: 16, layout } }))
    expect(result.errors.some((e) => e.includes('too many items'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// signalCatalog option (external)
// ---------------------------------------------------------------------------

describe('validateDashboard — signalCatalog option', () => {
  function externalCatalog(name: string): SignalConfig {
    return {
      version: '1.0.0',
      protocol: 'maxxecu',
      canSpeedKbps: 500,
      signals: [
        {
          name,
          canFrameId: '0x000',
          startByte: 0,
          byteLength: 1,
          bigEndian: true,
          signed: false,
          scale: 1,
          offset: 0,
          unit: '',
          min: 0,
          max: 0,
          timeoutMs: 1000,
        },
      ],
    }
  }

  it('takes precedence over embedded config.signals', () => {
    // Embedded says only 'rpm' exists; external says only 'speed_kph' exists.
    // Widget references 'speed_kph' — should NOT warn.
    const result = validateDashboard(
      minimalConfig({
        signals: [{ name: 'rpm' }],
        pages: [
          minimalPage({
            widgets: [
              {
                id: 'w1',
                type: 'gauge',
                signal: 'speed_kph',
                minValue: 0,
                maxValue: 300,
                decimalPlaces: 0,
              },
            ],
          }),
        ],
      }),
      { signalCatalog: externalCatalog('speed_kph') }
    )
    expect(result.warnings.filter((w) => w.includes('not defined in config.signals'))).toHaveLength(
      0
    )
  })

  it('warns when widget.signal is missing from the external catalog', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              {
                id: 'w1',
                type: 'gauge',
                signal: 'unknown',
                minValue: 0,
                maxValue: 300,
                decimalPlaces: 0,
              },
            ],
          }),
        ],
      }),
      { signalCatalog: externalCatalog('rpm') }
    )
    expect(
      result.warnings.some(
        (w) => w.includes('"unknown"') && w.includes('not defined in config.signals')
      )
    ).toBe(true)
  })

  it('cross-references topBar.layout signal items', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: 16,
          layout: [
            { type: 'signal', signal: 'missing_one', position: 'right' },
            { type: 'statusDot', signal: 'any', position: 'left' },
          ],
        },
      }),
      { signalCatalog: externalCatalog('rpm') }
    )
    expect(
      result.warnings.some((w) => w.includes('topBar.layout[0]') && w.includes('"missing_one"'))
    ).toBe(true)
    // The 'any' magic value should be skipped
    expect(result.warnings.some((w) => w.includes('topBar.layout[1]') && w.includes('"any"'))).toBe(
      false
    )
  })
})

// ---------------------------------------------------------------------------
// Coverage gap fillers — exercise the remaining error branches that the
// existing tests above don't reach (line-coverage push to ≥95%).
// ---------------------------------------------------------------------------

describe('validateDashboard — colour and shape branches', () => {
  it('rejects topBar.bgColor that is not a hex string', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: { height: 20, bgColor: 'red' },
      })
    )
    expect(result.errors.some((e) => e.startsWith('topBar.bgColor must be a 6-digit hex'))).toBe(
      true
    )
  })

  it('rejects dayTheme.bgColor that is not a hex string', () => {
    const result = validateDashboard(
      minimalConfig({
        dayTheme: { bgColor: 'not-a-hex' },
      })
    )
    expect(result.errors).toContain('dayTheme.bgColor must be a 6-digit hex color')
  })

  it('rejects a non-object page entry inside the pages array', () => {
    const result = validateDashboard(minimalConfig({ pages: [42] }))
    expect(result.errors).toContain('pages[0] must be an object')
  })

  it('rejects page.backgroundColor that is not a hex string', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ backgroundColor: 'cornflowerblue' })],
      })
    )
    expect(result.errors).toContain('pages[0].backgroundColor must be a 6-digit hex color')
  })

  it('rejects a widget whose layout is not an object', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [minimalWidget({ layout: 'not-an-object' })],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('layout must be an object'))).toBe(true)
  })

  it('rejects style.borderColor that is neither null nor a hex string', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              minimalWidget({
                style: {
                  primaryColor: '#FF4444',
                  borderColor: 'mauve',
                },
              }),
            ],
          }),
        ],
      })
    )
    expect(
      result.errors.some((e) => e.includes('style.borderColor') && e.includes('hex color or null'))
    ).toBe(true)
  })

  it('accepts style.borderColor === null without an error', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              minimalWidget({
                style: {
                  primaryColor: '#FF4444',
                  borderColor: null,
                },
              }),
            ],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('borderColor'))).toBe(false)
  })
})

describe('validateDashboard — topBar.layout shape errors', () => {
  it('rejects a layout entry that is not an object', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: 16,
          layout: [42],
        },
      })
    )
    expect(result.errors).toContain('topBar.layout[0] must be an object')
  })

  it('rejects a layout entry with no type field', () => {
    const result = validateDashboard(
      minimalConfig({
        topBar: {
          height: 16,
          layout: [{ position: 'left' }],
        },
      })
    )
    expect(result.errors).toContain('topBar.layout[0].type is required')
  })
})

describe('validateDashboard — widget config branches', () => {
  it('rejects gauge.alertThreshold that is not a number', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [minimalWidget({ alertThreshold: 'high' })],
          }),
        ],
      })
    )
    expect(result.errors.some((e) => e.includes('alertThreshold must be a number'))).toBe(true)
  })

  it('rejects gauge.displayStyle that is not a known string', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [minimalWidget({ displayStyle: 'pie' })],
          }),
        ],
      })
    )
    expect(
      result.errors.some(
        (e) => e.includes('displayStyle') && e.includes("'numeric' | 'arc' | 'bar'")
      )
    ).toBe(true)
  })

  it('rejects bar.alertThreshold that is not a number', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              {
                id: 'b1',
                type: 'bar',
                signal: 'rpm',
                minValue: 0,
                maxValue: 100,
                decimalPlaces: 0,
                alertThreshold: 'spicy',
              },
            ],
          }),
        ],
      })
    )
    expect(
      result.errors.some(
        (e) => e.includes('(bar)') && e.includes('alertThreshold must be a number')
      )
    ).toBe(true)
  })

  it('rejects button.colors.normal that is not a hex string', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              {
                id: 'b1',
                type: 'button',
                actions: [{ category: 'dashboard', type: 'navigate', pageId: 'p1' }],
                colors: { normal: 'red' },
              },
            ],
          }),
        ],
      })
    )
    expect(
      result.errors.some(
        (e) => e.includes('(button)') && e.includes('colors.normal must be a 6-digit hex color')
      )
    ).toBe(true)
  })

  it('rejects button.colors.active that is not a hex string', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [
              {
                id: 'b1',
                type: 'button',
                actions: [{ category: 'dashboard', type: 'navigate', pageId: 'p1' }],
                colors: { active: 'green' },
              },
            ],
          }),
        ],
      })
    )
    expect(
      result.errors.some(
        (e) => e.includes('(button)') && e.includes('colors.active must be a 6-digit hex color')
      )
    ).toBe(true)
  })
})
