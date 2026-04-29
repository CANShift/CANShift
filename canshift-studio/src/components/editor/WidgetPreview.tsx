// WidgetPreview.tsx — Live-looking canvas previews for each widget type.
// Renders at the widget's display size (firmware px × SCALE).
// All previews use a fixed demo value at ~65 % of range so the shape is clear.

import type { Widget } from '@tmbk/canshift-core'
import { SensorIcon } from '../icons/SensorIcons'

const DEMO_PCT = 0.65 // fraction of range used for demo value

// ---------------------------------------------------------------------------
// Arc-path helpers (SVG coordinate system: x→right, y→down)
// ---------------------------------------------------------------------------

/** Point on a circle in SVG coordinates. angleDeg=0 → right, 90 → down. */
function svgPt(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/**
 * SVG arc path string.
 * The gauge starts at SVG 135° (lower-left) and sweeps 270° clockwise to 45° (lower-right).
 * fromPct / toPct are fractions [0, 1] of the 270° sweep.
 */
function gaugeArcD(cx: number, cy: number, r: number, fromPct: number, toPct: number): string {
  const START_DEG = 135
  const SWEEP_DEG = 270
  const fromAngle = START_DEG + fromPct * SWEEP_DEG
  const toAngle = START_DEG + toPct * SWEEP_DEG
  const from = svgPt(cx, cy, r, fromAngle)
  const to = svgPt(cx, cy, r, toAngle)
  const sweep = (toPct - fromPct) * SWEEP_DEG
  const largeArc = sweep > 180 ? 1 : 0
  const rStr = String(r)
  const laStr = String(largeArc)
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${rStr} ${rStr} 0 ${laStr} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
}

// ---------------------------------------------------------------------------
// Gauge — Arc style
// ---------------------------------------------------------------------------

function GaugeArcPreview({
  widget,
  w,
  h,
  revLimiting,
}: {
  widget: Widget
  w: number
  h: number
  revLimiting: boolean
}) {
  if (widget.config.type !== 'gauge') return null
  const cfg = widget.config
  const st = widget.style

  const range = cfg.maxValue - cfg.minValue || 1
  const warnPct = Math.max(0, Math.min(1, (cfg.warningLevel - cfg.minValue) / range))
  const dangerPct = Math.max(0, Math.min(1, (cfg.dangerLevel - cfg.minValue) / range))
  const valuePct = DEMO_PCT

  const demoValue = cfg.minValue + range * valuePct
  const valueStr = demoValue.toFixed(cfg.decimalPlaces)

  const valueColor =
    valuePct >= dangerPct
      ? st.criticalColor
      : valuePct >= warnPct
        ? st.warningColor
        : st.primaryColor

  const cx = w / 2
  const cy = h * 0.65
  const r = Math.min(w * 0.44, h * 0.62)
  const strokeW = Math.max(3, r * 0.16)
  const innerR = r - strokeW / 2 - 2

  const needleTip = svgPt(cx, cy, r * 0.88, 135 + valuePct * 270)
  const revFlash = cfg.revFlash === true
  const showRevFlash = revFlash && revLimiting

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      {/* Rev-flash background fill when at rev limit */}
      {showRevFlash && <rect x={0} y={0} width={w} height={h} fill="#FF000022" />}
      {/* Rev-flash indicator ring (dashed = configured, solid = active) */}
      {revFlash && (
        <circle
          cx={cx}
          cy={cy}
          r={r + strokeW * 0.6}
          fill="none"
          stroke="#FF0000"
          strokeWidth={showRevFlash ? 3 : 1.5}
          opacity={showRevFlash ? 1 : 0.45}
          strokeDasharray={showRevFlash ? undefined : '4 3'}
        />
      )}
      {/* Background arc */}
      <path
        d={gaugeArcD(cx, cy, r, 0, 1)}
        fill="none"
        stroke="#252525"
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      {/* Warning zone */}
      {dangerPct > warnPct && (
        <path
          d={gaugeArcD(cx, cy, r, warnPct, dangerPct)}
          fill="none"
          stroke={st.warningColor + '55'}
          strokeWidth={strokeW}
        />
      )}
      {/* Danger zone */}
      <path
        d={gaugeArcD(cx, cy, r, dangerPct, 1)}
        fill="none"
        stroke={st.criticalColor + '55'}
        strokeWidth={strokeW}
      />
      {/* Value arc */}
      <path
        d={gaugeArcD(cx, cy, r, 0, valuePct)}
        fill="none"
        stroke={valueColor}
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      {/* Inner circle */}
      <circle cx={cx} cy={cy} r={innerR} fill="#0D0D0D" />
      {/* Needle */}
      {cfg.showNeedle !== false && (
        <>
          <line
            x1={cx}
            y1={cy}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke={st.textColor}
            strokeWidth={Math.max(1, strokeW * 0.22)}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={Math.max(2, strokeW * 0.3)} fill={valueColor} />
        </>
      )}
      {/* Value text */}
      <text
        x={cx}
        y={cy - r * 0.08}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={valueColor}
        fontSize={Math.max(8, Math.min(r * 0.34, h * 0.18))}
        fontWeight="700"
        fontFamily="monospace"
      >
        {valueStr}
      </text>
      {/* Suffix label */}
      {cfg.suffix && (
        <text
          x={cx}
          y={cy + r * 0.22}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={st.textColor + '88'}
          fontSize={Math.max(6, r * 0.18)}
          fontFamily="sans-serif"
        >
          {cfg.suffix}
        </text>
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Gauge — Vertical bar style
// ---------------------------------------------------------------------------

function GaugeBarPreview({ widget, w, h }: { widget: Widget; w: number; h: number }) {
  if (widget.config.type !== 'gauge') return null
  const cfg = widget.config
  const st = widget.style

  const range = cfg.maxValue - cfg.minValue || 1
  const warnPct = Math.max(0, Math.min(1, (cfg.warningLevel - cfg.minValue) / range))
  const dangerPct = Math.max(0, Math.min(1, (cfg.dangerLevel - cfg.minValue) / range))
  const valuePct = DEMO_PCT

  const demoValue = cfg.minValue + range * valuePct
  const valueStr = demoValue.toFixed(cfg.decimalPlaces)

  const valueColor =
    valuePct >= dangerPct
      ? st.criticalColor
      : valuePct >= warnPct
        ? st.warningColor
        : st.primaryColor

  const bw = Math.min(w * 0.35, 18)
  const padX = (w - bw) / 2
  const padTop = 6
  const padBot = h * 0.28
  const trackH = h - padTop - padBot

  // SVG y: bottom of track = padTop + trackH, top = padTop
  const fillY = padTop + trackH * (1 - valuePct)
  const fillH = trackH * valuePct

  const warnY = padTop + trackH * (1 - warnPct)
  const dangerY = padTop + trackH * (1 - dangerPct)

  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      {/* Track background */}
      <rect x={padX} y={padTop} width={bw} height={trackH} fill="#1C1C1C" rx={3} />
      {/* Warning zone */}
      {dangerPct > warnPct && (
        <rect
          x={padX}
          y={warnY}
          width={bw}
          height={(warnPct - dangerPct) * trackH}
          fill={st.warningColor + '35'}
        />
      )}
      {/* Danger zone */}
      <rect
        x={padX}
        y={dangerY}
        width={bw}
        height={dangerPct * trackH}
        fill={st.criticalColor + '35'}
      />
      {/* Danger line tick */}
      <line
        x1={padX - 3}
        y1={dangerY}
        x2={padX + bw + 3}
        y2={dangerY}
        stroke={st.criticalColor}
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      {/* Value fill from bottom */}
      <rect x={padX} y={fillY} width={bw} height={fillH} fill={valueColor} rx={3} />
      {/* Scale ticks — min and max */}
      <text
        x={padX - 4}
        y={padTop + trackH}
        textAnchor="end"
        dominantBaseline="middle"
        fill="#444444"
        fontSize={Math.max(6, Math.min(8, w * 0.14))}
        fontFamily="monospace"
      >
        {cfg.minValue}
      </text>
      <text
        x={padX - 4}
        y={padTop}
        textAnchor="end"
        dominantBaseline="middle"
        fill="#444444"
        fontSize={Math.max(6, Math.min(8, w * 0.14))}
        fontFamily="monospace"
      >
        {cfg.maxValue}
      </text>
      {/* Value label */}
      <text
        x={w / 2}
        y={h - padBot * 0.4}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={valueColor}
        fontSize={Math.max(8, Math.min(14, h * 0.13))}
        fontWeight="700"
        fontFamily="monospace"
      >
        {valueStr}
        {cfg.suffix ?? ''}
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Gauge — Numeric style
// ---------------------------------------------------------------------------

function GaugeNumericPreview({ widget, w, h }: { widget: Widget; w: number; h: number }) {
  if (widget.config.type !== 'gauge') return null
  const cfg = widget.config
  const st = widget.style

  const range = cfg.maxValue - cfg.minValue || 1
  const warnPct = Math.max(0, Math.min(1, (cfg.warningLevel - cfg.minValue) / range))
  const dangerPct = Math.max(0, Math.min(1, (cfg.dangerLevel - cfg.minValue) / range))
  const valuePct = DEMO_PCT

  const demoValue = cfg.minValue + range * valuePct
  const valueStr = demoValue.toFixed(cfg.decimalPlaces)
  const fullStr = (cfg.prefix ?? '') + valueStr + (cfg.suffix ?? '')

  const valueColor =
    valuePct >= dangerPct ? st.criticalColor : valuePct >= warnPct ? st.warningColor : st.textColor

  const iconName = cfg.iconName ?? null
  const fontSize = Math.max(10, Math.min(st.fontSize, h * 0.5, w * 0.35))
  const hasIcon = iconName !== null
  const iconSize = Math.min(h * 0.38, w * 0.28, 24)

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '0 4px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {hasIcon && <SensorIcon name={iconName} size={iconSize} color={valueColor + 'AA'} />}
      <span
        style={{
          color: valueColor,
          fontSize,
          fontWeight: 700,
          fontFamily: 'monospace',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: hasIcon ? `calc(100% - ${String(iconSize + 4)}px)` : '100%',
          textAlign: 'center',
        }}
      >
        {fullStr}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bar widget — horizontal progress bar
// ---------------------------------------------------------------------------

function BarWidgetPreview({ widget, w, h }: { widget: Widget; w: number; h: number }) {
  if (widget.config.type !== 'bar') return null
  const cfg = widget.config
  const st = widget.style

  const fillW = w * DEMO_PCT
  const barH = Math.max(4, h * 0.35)
  const textY = (h - barH) / 2
  const valueStr = (cfg.prefix ?? '') + String(Math.round(DEMO_PCT * 100)) + (cfg.suffix ?? '')

  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      {/* Track */}
      <rect x={0} y={(h - barH) / 2} width={w} height={barH} fill="#1C1C1C" rx={2} />
      {/* Fill */}
      <rect x={0} y={(h - barH) / 2} width={fillW} height={barH} fill={st.primaryColor} rx={2} />
      {/* Label */}
      {h > 18 && (
        <text
          x={w / 2}
          y={textY > 10 ? textY - 2 : h - textY + 2}
          textAnchor="middle"
          dominantBaseline={textY > 10 ? 'auto' : 'hanging'}
          fill={st.textColor + 'BB'}
          fontSize={Math.max(7, Math.min(10, h * 0.28))}
          fontFamily="monospace"
        >
          {valueStr}
        </text>
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Warning widget
// ---------------------------------------------------------------------------

function WarningPreview({ widget, w, h }: { widget: Widget; w: number; h: number }) {
  if (widget.config.type !== 'warning') return null
  const cfg = widget.config
  const st = widget.style
  const iconName = cfg.iconName ?? 'warning'
  const iconSize = Math.min(w, h) * 0.52

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: st.criticalColor + '22',
        borderRadius: 3,
      }}
    >
      <SensorIcon name={iconName} size={iconSize} color={st.criticalColor} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Button widget
// ---------------------------------------------------------------------------

function ButtonPreview({
  widget,
  w,
  h,
  active,
}: {
  widget: Widget
  w: number
  h: number
  active: boolean
}) {
  if (widget.config.type !== 'button') return null
  const cfg = widget.config
  const st = widget.style
  const iconName = cfg.iconName ?? null
  const showIcon = cfg.showIcon === true && iconName !== null
  const showLabel = cfg.showLabel !== false
  const iconSize = Math.min(h * 0.5, 18)
  const fontSize = Math.max(8, Math.min(12, h * 0.36))

  const bgColor = active ? st.primaryColor + '55' : st.primaryColor + '18'
  const borderColor = active ? st.primaryColor : st.secondaryColor
  const textColor = active ? st.primaryColor : st.textColor

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '0 6px',
        boxSizing: 'border-box',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 3,
        overflow: 'hidden',
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      {showIcon && <SensorIcon name={iconName} size={iconSize} color={textColor + 'CC'} />}
      {showLabel && (
        <span
          style={{
            color: textColor,
            fontSize,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '0.04em',
          }}
        >
          {cfg.label}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gear widget — large gear-position digit
// ---------------------------------------------------------------------------

function GearPreview({ widget, w, h }: { widget: Widget; w: number; h: number }) {
  const st = widget.style
  const fontSize = Math.min(w * 0.7, h * 0.75)

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          color: st.primaryColor,
          fontSize,
          fontWeight: 700,
          fontFamily: 'monospace',
          lineHeight: 1,
        }}
      >
        3
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timer widget
// ---------------------------------------------------------------------------

function TimerPreview({ widget, w, h }: { widget: Widget; w: number; h: number }) {
  if (widget.config.type !== 'timer') return null
  const cfg = widget.config
  const st = widget.style
  const timeStr = cfg.format === 'ss.mmm' ? '12.847' : '01:23'
  const fontSize = Math.max(9, Math.min(st.fontSize, h * 0.44, w * 0.22))

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          color: st.textColor,
          fontSize,
          fontWeight: 600,
          fontFamily: 'monospace',
          letterSpacing: '0.06em',
        }}
      >
        {timeStr}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Image widget
// ---------------------------------------------------------------------------

function ImagePreview({ w, h }: { w: number; h: number }) {
  const pts = [
    `${String(w * 0.2)},${String(h * 0.72)}`,
    `${String(w * 0.42)},${String(h * 0.38)}`,
    `${String(w * 0.58)},${String(h * 0.55)}`,
    `${String(w * 0.7)},${String(h * 0.42)}`,
    `${String(w * 0.82)},${String(h * 0.72)}`,
  ].join(' ')

  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      <rect x={4} y={4} width={w - 8} height={h - 8} fill="#1A1A1A" rx={3} stroke="#2A2A2A" />
      {/* Mountain / photo icon */}
      <polyline points={pts} fill="none" stroke="#333333" strokeWidth={1.5} />
      <circle cx={w * 0.3} cy={h * 0.35} r={Math.min(w, h) * 0.06} fill="#333333" />
    </svg>
  )
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
  /** When true, rev-flash gauges show the activated (red) state */
  revLimiting?: boolean
  /** When true, button widget renders in its active/pressed visual state */
  buttonActive?: boolean
}

export function WidgetPreview({
  widget,
  displayW: w,
  displayH: h,
  revLimiting = false,
  buttonActive = false,
}: WidgetPreviewProps) {
  const { config } = widget

  if (config.type === 'gauge') {
    if (config.displayStyle === 'arc')
      return <GaugeArcPreview widget={widget} w={w} h={h} revLimiting={revLimiting} />
    if (config.displayStyle === 'bar') return <GaugeBarPreview widget={widget} w={w} h={h} />
    return <GaugeNumericPreview widget={widget} w={w} h={h} />
  }
  if (config.type === 'bar') return <BarWidgetPreview widget={widget} w={w} h={h} />
  if (config.type === 'warning') return <WarningPreview widget={widget} w={w} h={h} />
  if (config.type === 'button')
    return <ButtonPreview widget={widget} w={w} h={h} active={buttonActive} />
  if (config.type === 'gear') return <GearPreview widget={widget} w={w} h={h} />
  if (config.type === 'timer') return <TimerPreview widget={widget} w={w} h={h} />
  return <ImagePreview w={w} h={h} />
}
