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
import { ShiftLightPreview } from './widget-previews/ShiftLight'
import { ImagePreview } from './widget-previews/Image'
import { TimerPreview } from './widget-previews/Timer'
import { WarningPreview } from './widget-previews/Warning'
import { isDangerState } from './widget-previews/gauge-math'

const FALLBACK_UNIT_TABLE: Readonly<Record<string, string>> = MAXXECU_SIGNAL_UNITS

const applyPalette = (widget: Widget, palette: PagePalette): Widget => {
  return {
    ...widget,
    style: {
      ...widget.style,
      textColor: palette.text,
    },
  }
}

interface RenderContext {
  w: number
  h: number
  revLimiting: boolean
  buttonActive: boolean
  cycleStateIndex: number | undefined
  noAnimate: boolean
  testValue: number | null
  danger: boolean
  signalUnit: string
}

type WidgetTypeKey = WidgetConfig['type']

type RendererDispatch = Record<
  WidgetTypeKey,
  (widget: Widget, ctx: RenderContext) => React.JSX.Element | null
>

type GaugeRendererProps = GaugeArcRendererProps | GaugeNumericRendererProps

const gaugeRendererByDisplay: Record<'arc' | 'numeric', ComponentType<GaugeRendererProps>> = {
  arc: GaugeArcPreview as ComponentType<GaugeRendererProps>,
  numeric: GaugeNumericPreview as ComponentType<GaugeRendererProps>,
}

const RENDERERS: RendererDispatch = {
  shift_light: (widget, ctx) => (
    <ShiftLightPreview widget={widget} w={ctx.w} h={ctx.h} testValue={ctx.testValue} />
  ),
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
    <ButtonPreview
      widget={widget}
      w={ctx.w}
      h={ctx.h}
      active={ctx.buttonActive}
      cycleStateIndex={ctx.cycleStateIndex}
    />
  ),
  gear: (widget, ctx) => <GearPreview widget={widget} w={ctx.w} h={ctx.h} />,
  timer: (widget, ctx) => <TimerPreview widget={widget} w={ctx.w} h={ctx.h} />,
  image: (widget, ctx) => <ImagePreview widget={widget} w={ctx.w} h={ctx.h} />,
}

interface WidgetPreviewProps {
  widget: Widget
  displayW: number
  displayH: number
  palette?: PagePalette
  revLimiting?: boolean
  buttonActive?: boolean
  cycleStateIndex?: number | undefined
  noAnimate?: boolean
  testValue?: number | null
}

const useResolvedSignalUnit = (widget: Widget): string => {
  const signals = useSignalStore((s) => s.signals)
  const cfg = widget.config
  const configSuffix =
    cfg.type === 'gauge' || cfg.type === 'timer' ? ((cfg as { suffix?: string }).suffix ?? '') : ''
  if (configSuffix !== '') return configSuffix
  if (!widget.signal) return ''
  const def = signals.find((s) => s.name === widget.signal)
  if (def?.unit) return def.unit
  return FALLBACK_UNIT_TABLE[widget.signal] ?? ''
}

const WidgetPreviewImpl = ({
  widget,
  displayW: rawW,
  displayH: rawH,
  palette,
  revLimiting = false,
  buttonActive = false,
  cycleStateIndex,
  noAnimate = false,
  testValue = null,
}: WidgetPreviewProps) => {
  const w = Math.max(0, rawW)
  const h = Math.max(0, rawH)

  const resolved = palette ? applyPalette(widget, palette) : widget
  const danger = noAnimate ? false : isDangerState(resolved, testValue)
  const signalUnit = useResolvedSignalUnit(resolved)

  const ctx: RenderContext = {
    w,
    h,
    revLimiting: noAnimate ? false : revLimiting,
    buttonActive,
    cycleStateIndex,
    noAnimate,
    testValue,
    danger,
    signalUnit,
  }

  const render = RENDERERS[resolved.config.type]
  return render(resolved, ctx)
}

export const WidgetPreview = memo(WidgetPreviewImpl)
