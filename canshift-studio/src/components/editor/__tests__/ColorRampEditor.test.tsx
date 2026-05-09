// ColorRampEditor.test.tsx — interaction tests for the color ramp editor
// (issue #430). Uses jsdom + react 18's createRoot, matching the existing
// hook tests — no @testing-library/react dependency.
//
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { SENSOR_DEFAULT_RAMPS } from '@tmbk/canshift-core'
import type { ColorRamp } from '@tmbk/canshift-core'
import ColorRampEditor from '../ColorRampEditor'

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

function renderEditor(props: Parameters<typeof ColorRampEditor>[0]): void {
  const target = root
  if (!target) throw new Error('root not initialised')
  act(() => {
    target.render(<ColorRampEditor {...props} />)
  })
}

function clickButton(testId: string): void {
  if (!container) throw new Error('no container')
  const btn = container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
  if (!btn) throw new Error(`testid not found: ${testId}`)
  act(() => {
    btn.click()
  })
}

function inputAt(stopIdx: number): HTMLInputElement {
  if (!container) throw new Error('no container')
  const row = container.querySelector(`[data-testid="ramp-stop-${stopIdx.toString()}"]`)
  if (!row) throw new Error(`row not found: ${stopIdx.toString()}`)
  const input = row.querySelector<HTMLInputElement>('input[type="number"]')
  if (!input) throw new Error('value input not found')
  return input
}

// Drive the native HTMLInputElement value setter without triggering React's
// "same-value" short-circuit. Required because act() can't observe a direct
// .value assignment on a controlled input.
function setNativeInputValue(el: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
  if (!descriptor || typeof descriptor.set !== 'function') {
    throw new Error('HTMLInputElement value setter unavailable')
  }
  // Native DOM setter — drive it via Reflect.apply so we never reference an
  // unbound method on its own. ts-eslint flags any direct `descriptor.set`
  // identifier even inside Reflect.apply, so wrap once locally first.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const fn = descriptor.set
  Reflect.apply(fn, el, [value])
}

const baseRamp: ColorRamp = {
  interpolate: 'linear',
  stops: [
    { value: 0, color: '#44CC66' },
    { value: 100, color: '#CC3333' },
  ],
}

describe('ColorRampEditor', () => {
  it('renders the preview gradient and each stop row', () => {
    const onChange = vi.fn<(r: ColorRamp | undefined) => void>()
    renderEditor({ ramp: baseRamp, sensorKind: undefined, min: 0, max: 100, onChange })

    expect(container?.querySelector('[data-testid="ramp-preview"]')).not.toBeNull()
    expect(container?.querySelector('[data-testid="ramp-stop-0"]')).not.toBeNull()
    expect(container?.querySelector('[data-testid="ramp-stop-1"]')).not.toBeNull()
  })

  it('appends a stop on Add', () => {
    const onChange = vi.fn<(r: ColorRamp | undefined) => void>()
    renderEditor({ ramp: baseRamp, sensorKind: undefined, min: 0, max: 100, onChange })

    clickButton('ramp-add')

    expect(onChange).toHaveBeenCalledTimes(1)
    const next: ColorRamp | undefined = onChange.mock.calls[0]?.[0]
    if (!next) throw new Error('onChange not called with a ramp')
    expect(next.stops).toHaveLength(3)
  })

  it('removes a stop when Remove is clicked', () => {
    const ramp: ColorRamp = {
      interpolate: 'linear',
      stops: [
        { value: 0, color: '#44CC66' },
        { value: 50, color: '#CC8800' },
        { value: 100, color: '#CC3333' },
      ],
    }
    const onChange = vi.fn<(r: ColorRamp | undefined) => void>()
    renderEditor({ ramp, sensorKind: undefined, min: 0, max: 100, onChange })

    clickButton('ramp-remove-1')

    expect(onChange).toHaveBeenCalledTimes(1)
    const next: ColorRamp | undefined = onChange.mock.calls[0]?.[0]
    if (!next) throw new Error('onChange not called with a ramp')
    expect(next.stops).toHaveLength(2)
    expect(next.stops[0]?.value).toBe(0)
    expect(next.stops[1]?.value).toBe(100)
  })

  it('resets to the catalog ramp when a sensor kind is detected', () => {
    const onChange = vi.fn<(r: ColorRamp | undefined) => void>()
    renderEditor({
      ramp: undefined,
      sensorKind: 'coolant_temp',
      min: 0,
      max: 150,
      onChange,
    })

    clickButton('ramp-reset')

    expect(onChange).toHaveBeenCalledTimes(1)
    const next: ColorRamp | undefined = onChange.mock.calls[0]?.[0]
    if (!next) throw new Error('onChange not called with a ramp')
    expect(next).toEqual(SENSOR_DEFAULT_RAMPS.coolant_temp)
  })

  it('changing a stop value emits a new ramp', () => {
    const onChange = vi.fn<(r: ColorRamp | undefined) => void>()
    renderEditor({ ramp: baseRamp, sensorKind: undefined, min: 0, max: 100, onChange })

    const input = inputAt(0)
    // React's controlled input dedups on identity — bypass it via the native
    // setter so our synthetic 'input' event carries the new value.
    setNativeInputValue(input, '25')
    act(() => {
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(onChange).toHaveBeenCalled()
    const last: ColorRamp | undefined = onChange.mock.calls.at(-1)?.[0]
    if (!last) throw new Error('onChange not called with a ramp')
    expect(last.stops[0]?.value).toBe(25)
  })

  it('preview gradient renders without crashing on a single-segment ramp', () => {
    const onChange = vi.fn<(r: ColorRamp | undefined) => void>()
    renderEditor({
      ramp: {
        interpolate: 'step',
        stops: [
          { value: 0, color: '#44CC66' },
          { value: 100, color: '#CC3333' },
        ],
      },
      sensorKind: undefined,
      min: 0,
      max: 100,
      onChange,
    })

    const preview = container?.querySelector('[data-testid="ramp-preview"]')
    expect(preview).not.toBeNull()
    const style = (preview as HTMLElement).style.background
    expect(style).toContain('linear-gradient')
  })
})
