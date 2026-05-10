// WidgetPreview.gear.test.tsx — regression guard for issue #513.
// Orbitron Black single-digit side-bearing asymmetry shifts the glyph off
// the visual midline when the parent only relies on flex `alignItems: center`.
// The fix wraps the digit in a full-width flex row and anchors the span with
// `width: 100%` + `textAlign: center`. These structural style assertions lock
// in the centering contract — jsdom does not load Orbitron, so glyph metrics
// would be unreliable for a pixel-level test.
//
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Widget } from '@tmbk/canshift-core'
import { WidgetPreview } from '../WidgetPreview'

let container: HTMLDivElement | null = null
let root: Root | null = null

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  if (root !== null) {
    act(() => {
      root?.unmount()
    })
    root = null
  }
  if (container !== null) {
    container.remove()
    container = null
  }
})

const GEAR_WIDGET: Widget = {
  id: 'gear-1',
  type: 'gear',
  signal: 'Gear',
  layout: { x: 0, y: 0, w: 80, h: 80, zOrder: 0 },
  style: {
    primaryColor: '#FFFFFF',
    secondaryColor: '#888888',
    warningColor: '#FFAA00',
    criticalColor: '#FF4444',
    textColor: '#FFFFFF',
    fontSize: 32,
  },
  config: { type: 'gear', decimalPlaces: 0 },
}

function renderGearPreview(): void {
  const target = root
  if (!target) throw new Error('root not initialised')
  act(() => {
    target.render(<WidgetPreview widget={GEAR_WIDGET} displayW={80} displayH={80} />)
  })
}

function findDigitSpan(): HTMLSpanElement {
  if (!container) throw new Error('no container')
  const spans = container.querySelectorAll('span')
  for (const span of spans) {
    if (span.textContent === '3') return span
  }
  throw new Error('digit span not found')
}

describe('GearPreview centering (issue #513)', () => {
  it('anchors the digit span with textAlign: center', () => {
    renderGearPreview()
    const digit = findDigitSpan()
    expect(digit.style.textAlign).toBe('center')
  })

  it('gives the digit span full width so textAlign acts on the container midline', () => {
    renderGearPreview()
    const digit = findDigitSpan()
    expect(digit.style.width).toBe('100%')
  })

  it('renders the digit span as inline-block so width takes effect', () => {
    renderGearPreview()
    const digit = findDigitSpan()
    expect(digit.style.display).toBe('inline-block')
  })

  it('wraps the digit in a full-width flex row that justifies content to center', () => {
    renderGearPreview()
    const digit = findDigitSpan()
    const wrapper = digit.parentElement
    if (!wrapper) throw new Error('digit wrapper missing')
    expect(wrapper.style.display).toBe('flex')
    expect(wrapper.style.width).toBe('100%')
    expect(wrapper.style.justifyContent).toBe('center')
  })
})
