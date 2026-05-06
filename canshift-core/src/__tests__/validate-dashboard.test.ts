// validate-dashboard.test.ts

import { validateDashboard } from '../validation/validate-dashboard.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minimalWidget(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'w1', type: 'gauge', minValue: 0, maxValue: 8000, ...overrides }
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

  it('requires page.name', () => {
    const result = validateDashboard(minimalConfig({ pages: [minimalPage({ name: 42 })] }))
    expect(result.errors.some((e) => e.includes('pages[0].name'))).toBe(true)
  })

  it('requires page.widgets to be an array', () => {
    const result = validateDashboard(minimalConfig({ pages: [minimalPage({ widgets: null })] }))
    expect(result.errors.some((e) => e.includes('pages[0].widgets'))).toBe(true)
  })

  it('validates each page independently', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ id: 'p1' }), minimalPage({ id: 'p2', name: undefined })],
        defaultPageId: 'p1',
      })
    )
    expect(result.errors.some((e) => e.includes('pages[1].name'))).toBe(true)
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

  it('accepts all valid widget types', () => {
    const validTypes = ['gauge', 'warning', 'button', 'timer', 'bar', 'gear', 'image']
    for (const type of validTypes) {
      const result = validateDashboard(
        minimalConfig({ pages: [minimalPage({ widgets: [minimalWidget({ type })] })] })
      )
      expect(result.errors.filter((e) => e.includes('not a valid widget type'))).toHaveLength(0)
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
    return { id: 'w1', type: 'gauge', ...cfg }
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
          minimalPage({ widgets: [warningWidget({ threshold: 95, signalId: 'oil_pressure' })] }),
        ],
      })
    )
    expect(result.errors.filter((e) => e.includes('(warning)'))).toHaveLength(0)
  })

  it('requires threshold to be a number', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [warningWidget({ signalId: 'oil_pressure' })] })],
      })
    )
    expect(result.errors.some((e) => e.includes('(warning): threshold must be a number'))).toBe(
      true
    )
  })

  it('requires signalId to be a non-empty string', () => {
    const missing = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [warningWidget({ threshold: 95 })] })],
      })
    )
    expect(
      missing.errors.some((e) => e.includes('(warning): signalId must be a non-empty string'))
    ).toBe(true)

    const empty = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [warningWidget({ threshold: 95, signalId: '' })] })],
      })
    )
    expect(
      empty.errors.some((e) => e.includes('(warning): signalId must be a non-empty string'))
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

  it('accepts a button with a valid targetPageId', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [buttonWidget({ targetPageId: 'p2' })] })],
      })
    )
    expect(result.errors.filter((e) => e.includes('(button)'))).toHaveLength(0)
  })

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

  it('rejects a button with an empty targetPageId string', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [buttonWidget({ targetPageId: '' })] })],
      })
    )
    expect(
      result.errors.some((e) => e.includes('(button): targetPageId must be a non-empty string'))
    ).toBe(true)
  })

  it('rejects a button with neither targetPageId nor actions', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [minimalPage({ widgets: [buttonWidget({})] })],
      })
    )
    expect(
      result.errors.some((e) => e.includes('(button): targetPageId must be a non-empty string'))
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Bar widget validation
// ---------------------------------------------------------------------------

describe('validateDashboard — bar widget type fields', () => {
  function barWidget(cfg: Record<string, unknown>): Record<string, unknown> {
    return { id: 'w1', type: 'bar', ...cfg }
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
            { type: 'pageName', position: 'center' },
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
          layout: [{ type: 'pageName', position: 'top' }],
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
              { id: 'w1', type: 'gauge', signalId: 'unknown_signal', minValue: 0, maxValue: 100 },
            ],
          }),
        ],
      })
    )
    expect(result.warnings).toHaveLength(0)
  })

  it('emits no warning when signalId is found in catalog', () => {
    const result = validateDashboard(
      minimalConfig({
        signals: [{ name: 'rpm' }],
        pages: [
          minimalPage({
            widgets: [{ id: 'w1', type: 'gauge', signalId: 'rpm', minValue: 0, maxValue: 8000 }],
          }),
        ],
      })
    )
    expect(result.warnings.filter((w) => w.includes('signalId'))).toHaveLength(0)
  })

  it('warns when signalId is not in the catalog', () => {
    const result = validateDashboard(
      minimalConfig({
        signals: [{ name: 'rpm' }],
        pages: [
          minimalPage({
            widgets: [{ id: 'w1', type: 'gauge', signalId: 'boost', minValue: 0, maxValue: 300 }],
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
