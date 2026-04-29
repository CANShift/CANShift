// validate-dashboard.test.ts

import { validateDashboard } from '../validation/validate-dashboard.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minimalWidget(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'w1', type: 'gauge', ...overrides }
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
