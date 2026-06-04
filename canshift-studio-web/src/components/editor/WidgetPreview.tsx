// WidgetPreview.tsx — Live-looking canvas previews for each widget type.
// Renders at the widget's display size (firmware px × SCALE).
// All previews use a fixed demo value at ~65 % of range so the shape is clear.

import * as React from 'react'
import { memo } from 'react'
import type { ComponentType } from 'react'
import type { Widget, WidgetConfig, PagePalette } from '@tmbk/canshift-core'
import { MAXXECU_SIGNAL_UNITS } from '@tmbk/canshift-core'
import { useSignalStore } from '../../stores/signal.store'
import { ButtonPreview } from './widget-previews/Button'
import { GearPreview } from './widget-previews/Gear'
import { GaugeArcPreview, type GaugeArcRendererProps } from './widget-previews/GaugeArc'
import { GaugeNumericPreview, type GaugeNumericRendererProps } from './widget-previews/GaugeNumeric'
import { ImagePreview } from './widget-previews/Image'
import { TimerPreview } from './widget-previews/Timer'
import { WarningPreview } from './widget-previews/Warning'
import { isDangerState } from './widget-previews/gauge-math'

// Built-in name → unit fallback table imported as a lean constant rather
// than derived at runtime from `ECU_PROFILES`. The full profiles registry
// drags the entire MaxxECU + OBD-II CAN-frame metadata into the renderer
// bundle (~30 KB) and pushes us over the studio size budget. The fallback
// only needs unit strings — keep the table in lockstep via canshift-core.
const FALLBACK_UNIT_TABLE: Readonly<Record<string, string>> = MAXXECU_SIGNAL_UNITS

// ---------------------------------------------------------------------------
// Palette → widget style resolver
// Mirrors the firmware's day/night handling: only the text colour follows the
// active page palette (so it stays legible against the swapped background).
// Per-widget primary / warning / critical colours and — crucially — the
// `iconName` sensor palette are PRESERVED so each gauge keeps its semantic
// colour. The previous implementation overrode every style slot with the page
// palette, which collapsed every gauge to the same uniform red on Canvas
// while the rail thumbnails (no palette prop, no override) kept their proper
// per-sensor colour — see issue #963.
// ---------------------------------------------------------------------------

function applyPalette(widget: Widget, palette: PagePalette): Widget {
  return {
    ...widget,
    style: {
      ...widget.style,
      textColor: palette.text,
    },
  }
}

// ---------------------------------------------------------------------------
// Renderer dispatch — keyed by WidgetConfig['type']. Each entry receives the
// fully-resolved widget plus the variant flags it cares about. The map shape
// gives O(1) lookup, exhaustiveness via discriminated-union narrowing, and
// makes adding a new widget type a single-line change.
// ---------------------------------------------------------------------------

interface RenderContext {
  w: number
  h: number
  revLimiting: boolean
  buttonActive: boolean
  noAnimate: boolean
  testValue: number | null
  danger: boolean
  /**
   * Unit string resolved by `WidgetPreviewImpl` from the bound signal's
   * `unit` field (signals.json), with the widget's explicit `cfg.suffix`
   * winning as a manual override. Mirrors firmware
   * `WidgetHelpers::resolveDisplayUnit`. Empty string when no unit applies.
   */
  signalUnit: string
}

type WidgetTypeKey = WidgetConfig['type']

type RendererDispatch = Record<
  WidgetTypeKey,
  (widget: Widget, ctx: RenderContext) => React.JSX.Element | null
>

// Gauge has three sub-styles; pick the matching memoized renderer.
const gaugeRendererByDisplay: Record<
  'arc' | 'numeric',
  ComponentType<GaugeArcRendererProps | GaugeNumericRendererProps>
> = {
  arc: GaugeArcPreview as ComponentType<GaugeArcRendererProps | GaugeNumericRendererProps>,
  numeric: GaugeNumericPreview as ComponentType<GaugeArcRendererProps | GaugeNumericRendererProps>,
}

const RENDERERS: RendererDispatch = {
  gauge: (widget, ctx) => {
    if (widget.config.type !== 'gauge') return null
    const Renderer = gaugeRendererByDisplay[widget.config.displayStyle]
    return (
      <Renderer
        widget={widget}
        w={ctx.w}
        h={ctx.h}
        revLimiting={ctx.revLimiting}
        danger={ctx.danger}
        testValue={ctx.testValue}
        signalUnit={ctx.signalUnit}
      />
    )
  },
  warning: (widget, ctx) => (
    <WarningPreview widget={widget} w={ctx.w} h={ctx.h} noAnimate={ctx.noAnimate} />
  ),
  button: (widget, ctx) => (
    <ButtonPreview widget={widget} w={ctx.w} h={ctx.h} active={ctx.buttonActive} />
  ),
  gear: (widget, ctx) => <GearPreview widget={widget} w={ctx.w} h={ctx.h} />,
  timer: (widget, ctx) => <TimerPreview widget={widget} w={ctx.w} h={ctx.h} />,
  image: (widget, ctx) => <ImagePreview widget={widget} w={ctx.w} h={ctx.h} />,
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

interface WidgetPreviewProps {
  widget: Widget
  /** Display width in pixels (= layout.w × SCALE) */
  displayW: number
  /** Display height in pixels (= layout.h × SCALE) */
  displayH: number
  /** Page palette — when provided, overrides widget style semantic colors */
  palette?: PagePalette
  /** When true, rev-flash gauges show the activated (red) state */
  revLimiting?: boolean
  /** When true, button widget renders in its active/pressed visual state */
  buttonActive?: boolean
  /** When true, suppresses all CSS animations (blink, flash). Use for thumbnails. */
  noAnimate?: boolean
  /** Test-mode injected raw value for this widget's signal; null falls back to the demo percentage. */
  testValue?: number | null
}

/**
 * Resolve the unit string to display next to a widget's value. Mirrors the
 * firmware helper `WidgetHelpers::resolveDisplayUnit`: an explicit per-widget
 * `cfg.suffix` wins as a manual override, otherwise the unit declared on the
 * bound signal (signals.json) is used. Returns "" when no unit applies so
 * callers don't have to special-case nullish handling.
 *
 * Subscribes to `useSignalStore` so a unit change in the signal mapper
 * surfaces in every preview without a manual refresh.
 */
function useResolvedSignalUnit(widget: Widget): string {
  const signals = useSignalStore((s) => s.signals)
  const cfg = widget.config
  const configSuffix =
    cfg.type === 'gauge' || cfg.type === 'timer' ? ((cfg as { suffix?: string }).suffix ?? '') : ''
  if (configSuffix !== '') return configSuffix
  if (!widget.signal) return ''
  const def = signals.find((s) => s.name === widget.signal)
  if (def?.unit) return def.unit
  // Hook-level fallback: even if the user's signal store doesn't carry the
  // bound name (custom profile, partial import, …), look the unit up in the
  // built-in MaxxECU table so standard names still show their units. Beats
  // the previous behaviour where the preview ran with no units at all when
  // localStorage held a non-empty but mismatched catalog (which the
  // store-level fallback couldn't reach).
  return FALLBACK_UNIT_TABLE[widget.signal] ?? ''
}

function WidgetPreviewImpl({
  widget,
  displayW: rawW,
  displayH: rawH,
  palette,
  revLimiting = false,
  buttonActive = false,
  noAnimate = false,
  testValue = null,
}: WidgetPreviewProps) {
  // Clamp to zero — SVG attributes reject negative values, which can occur
  // transiently when the parent container hasn't laid out yet or scale is < 1.
  const w = Math.max(0, rawW)
  const h = Math.max(0, rawH)
  // `@keyframes canshift-blink` is injected once at App mount (see
  // `useBlinkKeyframes` in `App.tsx`) instead of on every preview mount.

  const resolved = palette ? applyPalette(widget, palette) : widget
  const danger = noAnimate ? false : isDangerState(resolved, testValue)
  const signalUnit = useResolvedSignalUnit(resolved)

  const ctx: RenderContext = {
    w,
    h,
    revLimiting: noAnimate ? false : revLimiting,
    buttonActive,
    noAnimate,
    testValue,
    danger,
    signalUnit,
  }

  // Exhaustive dispatch — TypeScript enforces every WidgetConfig['type'] has
  // a renderer entry; missing entries fail typecheck on the RENDERERS object.
  const render = RENDERERS[resolved.config.type]
  return render(resolved, ctx)
}

// React.memo with shallow prop comparison — `widget` and `palette` are stable
// across store updates thanks to immer (unchanged entries keep the same ref),
// so unrelated changes (selection, drag of another widget) no longer rerun
// every preview's SVG path math. The leaf renderers are individually memoized
// so even when this wrapper rerenders, only the renderer whose own props
// changed will actually do work.
export const WidgetPreview = memo(WidgetPreviewImpl)
