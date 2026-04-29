// WidgetPreview.tsx — Live-looking canvas previews for each widget type.
// Renders at the widget's display size (firmware px × SCALE).
// All previews use a fixed demo value at ~65 % of range so the shape is clear.

import type { Widget, WidgetLabelPosition } from '@tmbk/canshift-core'
import { SensorIcon } from '../icons/SensorIcons'

const DEMO_PCT = 0.65 // fraction of range used for demo value

// ---------------------------------------------------------------------------
// Danger blink — inject keyframe once, use as CSS animation string
// ---------------------------------------------------------------------------

const BLINK_ANIM = 'canshift-blink 0.7s step-end infinite'

let _blinkStyleInjected = false
function ensureBlinkStyle(): void {
  if (_blinkStyleInjected) return
  _blinkStyleInjected = true
  const el = document.createElement('style')
  el.textContent = '@keyframes canshift-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }'
  document.head.appendChild(el)
}

function isDangerState(widget: Widget): boolean {
  const cfg = widget.config
  if (cfg.type !== 'gauge') return false
  const range = cfg.maxValue - cfg.minValue || 1
  const dangerPct = Math.max(0, Math.min(1, (cfg.dangerLevel - cfg.minValue) / range))
  return DEMO_PCT >= dangerPct
}

// ---------------------------------------------------------------------------
// Signal label helper — converts "coolant_temp_c" → "COOLANT TEMP C"
// ---------------------------------------------------------------------------

function formatSignalLabel(signal: string): string {
  if (!signal) return '—'
  return signal.replace(/_+/g, ' ').toUpperCase().trim()
}

// ---------------------------------------------------------------------------
// Label overlay helpers
// ---------------------------------------------------------------------------

function svgLabelAttrs(
  pos: WidgetLabelPosition,
  w: number,
  h: number,
  pad = 4
): {
  x: number
  y: number
  textAnchor: 'start' | 'middle' | 'end'
  dominantBaseline: 'hanging' | 'auto'
} {
  const isTop = pos.startsWith('top')
  const isCenter = pos.endsWith('center')
  const isRight = pos.endsWith('right')
  return {
    x: isCenter ? w / 2 : isRight ? w - pad : pad,
    y: isTop ? pad + 6 : h - pad - 1,
    textAnchor: isCenter ? 'middle' : isRight ? 'end' : 'start',
    dominantBaseline: isTop ? 'hanging' : 'auto',
  }
}

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
  danger,
}: {
  widget: Widget
  w: number
  h: number
  revLimiting: boolean
  danger: boolean
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
  // Arc centered in widget; r chosen so arc never overflows (cy ± r stays inside h)
  const r = Math.min(w * 0.45, h * 0.46)
  const cy = h * 0.5 // true vertical center
  const strokeW = Math.max(3, r * 0.16)
  const innerR = r - strokeW / 2 - 2

  const needleTip = svgPt(cx, cy, r * 0.88, 135 + valuePct * 270)
  const revFlash = cfg.revFlash === true
  const showRevFlash = revFlash && revLimiting

  const signalLabel = formatSignalLabel(widget.signal)
  const valueFontSize = Math.max(9, Math.min(r * 0.38, h * 0.18, 28))
  const unitFontSize = Math.max(6, r * 0.17)
  const labelFontSize = Math.max(6, Math.min(10, r * 0.17))

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'hidden' }} aria-hidden="true">
      {/* Rev-flash background fill */}
      {showRevFlash && <rect x={0} y={0} width={w} height={h} fill="#FF000022" />}
      {/* Rev-flash indicator ring */}
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
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      />
      {/* Inner circle */}
      <circle cx={cx} cy={cy} r={innerR} fill="#0D0D0D" />
      {/* Signal name — inside arc, above center */}
      <text
        x={cx}
        y={cy - r * 0.28}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#888888"
        fontSize={labelFontSize}
        fontFamily="sans-serif"
        fontWeight="600"
        letterSpacing="0.06em"
      >
        {signalLabel}
      </text>
      {/* Needle */}
      {cfg.showNeedle !== false && (
        <g style={{ animation: danger ? BLINK_ANIM : undefined }}>
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
        </g>
      )}
      {/* Value text — center of arc */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={valueColor}
        fontSize={valueFontSize}
        fontWeight="700"
        fontFamily="monospace"
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      >
        {valueStr}
      </text>
      {/* Suffix / unit */}
      {cfg.suffix && (
        <text
          x={cx}
          y={cy + r * 0.32}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={st.textColor + '77'}
          fontSize={unitFontSize}
          fontFamily="sans-serif"
        >
          {cfg.suffix}
        </text>
      )}
      {/* Widget label (user-configured, shown at bottom when set) */}
      {cfg.label &&
        (() => {
          const pos = cfg.labelPosition ?? 'top-left'
          const lAttrs = svgLabelAttrs(pos, w, h)
          return (
            <text
              x={lAttrs.x}
              y={lAttrs.y}
              textAnchor={lAttrs.textAnchor}
              dominantBaseline={lAttrs.dominantBaseline}
              fill={st.textColor + '77'}
              fontSize={Math.max(6, Math.min(9, w * 0.1))}
              fontFamily="sans-serif"
              fontWeight="600"
              letterSpacing="0.04em"
            >
              {cfg.label}
            </text>
          )
        })()}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Gauge — Vertical bar style (also renders horizontal when barOrientation='horizontal')
// ---------------------------------------------------------------------------

function GaugeBarPreview({
  widget,
  w,
  h,
  danger,
}: {
  widget: Widget
  w: number
  h: number
  danger: boolean
}) {
  if (widget.config.type !== 'gauge') return null
  const cfg = widget.config
  const st = widget.style

  const isHorizontal = cfg.barOrientation === 'horizontal'

  const range = cfg.maxValue - cfg.minValue || 1
  const warnPct = Math.max(0, Math.min(1, (cfg.warningLevel - cfg.minValue) / range))
  const dangerPct = Math.max(0, Math.min(1, (cfg.dangerLevel - cfg.minValue) / range))
  const valuePct = DEMO_PCT

  const demoValue = cfg.minValue + range * valuePct
  const valueStr = demoValue.toFixed(cfg.decimalPlaces)
  const signalLabel = formatSignalLabel(widget.signal)

  if (isHorizontal) {
    const valueColor =
      valuePct >= dangerPct
        ? st.criticalColor
        : valuePct >= warnPct
          ? st.warningColor
          : st.primaryColor
    const barH = Math.max(4, h * 0.35)
    const padX = 6 // equal left/right breathing room around the track
    const trackW = w - padX * 2
    const textY = (h - barH) / 2
    const labelPos = cfg.labelPosition ?? 'bottom-left'
    const labelIsTop = labelPos.startsWith('top')
    const sigFontSize = Math.max(6, Math.min(11, h * 0.26))

    return (
      <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
        <rect x={padX} y={(h - barH) / 2} width={trackW} height={barH} fill="#1C1C1C" rx={2} />
        {dangerPct > warnPct && (
          <rect
            x={padX + trackW * warnPct}
            y={(h - barH) / 2}
            width={(dangerPct - warnPct) * trackW}
            height={barH}
            fill={st.warningColor + '35'}
          />
        )}
        <rect
          x={padX + trackW * dangerPct}
          y={(h - barH) / 2}
          width={(1 - dangerPct) * trackW}
          height={barH}
          fill={st.criticalColor + '35'}
        />
        <line
          x1={padX + trackW * dangerPct}
          y1={(h - barH) / 2 - 2}
          x2={padX + trackW * dangerPct}
          y2={(h + barH) / 2 + 2}
          stroke={st.criticalColor}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        <rect
          x={padX}
          y={(h - barH) / 2}
          width={trackW * valuePct}
          height={barH}
          fill={valueColor}
          rx={2}
          style={{ animation: danger ? BLINK_ANIM : undefined }}
        />
        {/* Signal name */}
        <text
          x={4}
          y={labelIsTop ? h - 3 : 3}
          textAnchor="start"
          dominantBaseline={labelIsTop ? 'auto' : 'hanging'}
          fill="#888888"
          fontSize={sigFontSize}
          fontFamily="sans-serif"
          fontWeight="600"
          letterSpacing="0.05em"
        >
          {signalLabel}
        </text>
        {h > 18 && (
          <text
            x={w / 2}
            y={textY > 10 ? textY - 2 : h - textY + 2}
            textAnchor="middle"
            dominantBaseline={textY > 10 ? 'auto' : 'hanging'}
            fill={valueColor}
            fontSize={Math.max(8, Math.min(15, h * 0.38))}
            fontWeight="700"
            fontFamily="monospace"
            style={{ animation: danger ? BLINK_ANIM : undefined }}
          >
            {valueStr}
            {cfg.suffix ?? ''}
          </text>
        )}
        {cfg.label &&
          (() => {
            const lAttrs = svgLabelAttrs(labelPos, w, h)
            return (
              <text
                x={lAttrs.x}
                y={labelIsTop ? 8 : h - 3}
                textAnchor={lAttrs.textAnchor}
                dominantBaseline={labelIsTop ? 'hanging' : 'auto'}
                fill={st.textColor + '77'}
                fontSize={Math.max(6, Math.min(9, h * 0.22))}
                fontFamily="sans-serif"
                fontWeight="600"
              >
                {cfg.label}
              </text>
            )
          })()}
      </svg>
    )
  }

  const valueColor =
    valuePct >= dangerPct
      ? st.criticalColor
      : valuePct >= warnPct
        ? st.warningColor
        : st.primaryColor

  // Bar track: 60 % of widget width, centered
  const bw = Math.max(10, w * 0.6)
  const padX = (w - bw) / 2
  // Top: signal label; bottom: value + unit on two lines
  const sigLabelH = Math.max(10, Math.min(h * 0.12, 14))
  const padTop = sigLabelH + 3
  const unitLineH = Math.max(8, Math.min(h * 0.09, 13))
  const valLineH = Math.max(10, Math.min(h * 0.14, 22))
  const padBot = valLineH + unitLineH + 6
  const trackH = Math.max(4, h - padTop - padBot)

  const fillY = padTop + trackH * (1 - valuePct)
  const fillH = trackH * valuePct

  const warnY = padTop + trackH * (1 - warnPct)
  const dangerY = padTop + trackH * (1 - dangerPct)

  const sigFontSize = Math.max(6, Math.min(sigLabelH * 0.82, w * 0.12))
  const valFontSize = Math.max(10, Math.min(valLineH * 0.9, w * 0.46))
  const unitFontSize = Math.max(7, Math.min(unitLineH * 0.85, w * 0.3))

  // Value always in white for readability; warning/danger state shown by fill color
  const valTextColor =
    valuePct >= dangerPct ? st.criticalColor : valuePct >= warnPct ? st.warningColor : '#FFFFFF'
  const unitTextColor =
    valuePct >= dangerPct
      ? st.criticalColor + 'BB'
      : valuePct >= warnPct
        ? st.warningColor + 'BB'
        : '#888888'

  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      {/* Signal name — top center */}
      <text
        x={w / 2}
        y={2}
        textAnchor="middle"
        dominantBaseline="hanging"
        fill="#888888"
        fontSize={sigFontSize}
        fontFamily="sans-serif"
        fontWeight="600"
        letterSpacing="0.04em"
      >
        {signalLabel}
      </text>
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
      <rect
        x={padX}
        y={fillY}
        width={bw}
        height={fillH}
        fill={valueColor}
        rx={3}
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      />
      {/* Scale ticks — min/max on sides when space allows */}
      {padX >= 14 && (
        <>
          <text
            x={padX - 4}
            y={padTop + trackH}
            textAnchor="end"
            dominantBaseline="middle"
            fill="#383838"
            fontSize={Math.max(6, Math.min(8, w * 0.12))}
            fontFamily="monospace"
          >
            {cfg.minValue}
          </text>
          <text
            x={padX - 4}
            y={padTop}
            textAnchor="end"
            dominantBaseline="middle"
            fill="#383838"
            fontSize={Math.max(6, Math.min(8, w * 0.12))}
            fontFamily="monospace"
          >
            {cfg.maxValue}
          </text>
        </>
      )}
      {/* Value — white for max readability, warning/danger state changes color */}
      <text
        x={w / 2}
        y={h - padBot + valLineH * 0.88}
        textAnchor="middle"
        dominantBaseline="auto"
        fill={valTextColor}
        fontSize={valFontSize}
        fontWeight="700"
        fontFamily="monospace"
        style={{ animation: danger ? BLINK_ANIM : undefined }}
      >
        {valueStr}
      </text>
      {cfg.suffix && (
        <text
          x={w / 2}
          y={h - 3}
          textAnchor="middle"
          dominantBaseline="auto"
          fill={unitTextColor}
          fontSize={unitFontSize}
          fontFamily="sans-serif"
          fontWeight="600"
          letterSpacing="0.03em"
          style={{ animation: danger ? BLINK_ANIM : undefined }}
        >
          {cfg.suffix}
        </text>
      )}
      {/* Widget label */}
      {cfg.label &&
        (() => {
          const pos = cfg.labelPosition ?? 'top-left'
          const lAttrs = svgLabelAttrs(pos, w, h)
          return (
            <text
              x={lAttrs.x}
              y={lAttrs.y}
              textAnchor={lAttrs.textAnchor}
              dominantBaseline={lAttrs.dominantBaseline}
              fill={st.textColor + '77'}
              fontSize={Math.max(5, Math.min(8, w * 0.22))}
              fontFamily="sans-serif"
              fontWeight="600"
            >
              {cfg.label}
            </text>
          )
        })()}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Gauge — Numeric style
// ---------------------------------------------------------------------------

function GaugeNumericPreview({
  widget,
  w,
  h,
  danger,
}: {
  widget: Widget
  w: number
  h: number
  danger: boolean
}) {
  if (widget.config.type !== 'gauge') return null
  const cfg = widget.config
  const st = widget.style

  const range = cfg.maxValue - cfg.minValue || 1
  const warnPct = Math.max(0, Math.min(1, (cfg.warningLevel - cfg.minValue) / range))
  const dangerPct = Math.max(0, Math.min(1, (cfg.dangerLevel - cfg.minValue) / range))
  const valuePct = DEMO_PCT

  const demoValue = cfg.minValue + range * valuePct
  const valueOnly = demoValue.toFixed(cfg.decimalPlaces)
  const prefix = cfg.prefix ?? ''
  const suffix = cfg.suffix ?? ''

  const valueColor =
    valuePct >= dangerPct ? st.criticalColor : valuePct >= warnPct ? st.warningColor : st.textColor

  const iconName = cfg.iconName ?? null
  const hasIcon = iconName !== null
  const iconSize = Math.min(h * 0.35, w * 0.22, 20)
  const labelText = cfg.label ?? null
  const labelPos = cfg.labelPosition ?? 'top-left'

  const hasSuffix = suffix.length > 0
  const hasPrefix = prefix.length > 0
  const twoLine = hasSuffix || hasPrefix

  // Signal name shown at top when no custom label
  const showSignalHeader = labelText === null
  const signalLabel = formatSignalLabel(widget.signal)
  const sigHeaderH = showSignalHeader ? Math.max(8, Math.min(h * 0.18, 14)) : 0
  const availH = h - sigHeaderH

  // Two-line: value gets most of height, unit/prefix gets ~22 %
  const unitLineH = twoLine ? Math.max(8, availH * 0.24) : 0
  const valueLineH = availH - unitLineH
  const fontSize = Math.max(8, Math.min(valueLineH * 0.72, w * 0.52))
  const unitFontSize = Math.max(7, Math.min(unitLineH * 0.72, w * 0.2))

  const isLabelTop = labelText !== null && labelPos.startsWith('top')
  const isLabelRight = labelPos.endsWith('right')
  const isLabelCenter = labelPos.endsWith('center')
  const labelAlign = isLabelCenter ? 'center' : isLabelRight ? 'right' : 'left'
  const labelFontSize = Math.max(6, Math.min(9, w * 0.1))

  return (
    <div
      style={{
        width: w,
        height: h,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${String(sigHeaderH + 2)}px 4px 2px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        gap: twoLine ? 1 : 0,
      }}
    >
      {/* Signal name header */}
      {showSignalHeader && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 3,
            fontSize: Math.max(5, Math.min(7, sigHeaderH * 0.75)),
            fontFamily: 'sans-serif',
            fontWeight: 600,
            color: '#888888',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: `calc(100% - 6px)`,
            letterSpacing: '0.06em',
          }}
        >
          {signalLabel}
        </span>
      )}
      {/* Widget label overlay (user-configured) */}
      {labelText !== null && (
        <span
          style={{
            position: 'absolute',
            ...(isLabelTop ? { top: 2 } : { bottom: 2 }),
            ...(isLabelCenter
              ? { left: '50%', transform: 'translateX(-50%)' }
              : isLabelRight
                ? { right: 3 }
                : { left: 3 }),
            fontSize: labelFontSize,
            fontFamily: 'sans-serif',
            fontWeight: 600,
            color: '#888888',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            letterSpacing: '0.04em',
            textAlign: labelAlign,
          }}
        >
          {labelText}
        </span>
      )}
      {/* Prefix line (two-line layout) */}
      {hasPrefix && (
        <span
          style={{
            color: valueColor + 'BB',
            fontSize: unitFontSize,
            fontWeight: 600,
            fontFamily: 'sans-serif',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            letterSpacing: '0.03em',
          }}
        >
          {prefix}
        </span>
      )}
      {/* Value row */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          width: '100%',
          flexShrink: 0,
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
            textOverflow: 'clip',
            maxWidth: hasIcon ? `calc(100% - ${String(iconSize + 4)}px)` : '100%',
            textAlign: 'center',
            animation: danger ? BLINK_ANIM : undefined,
          }}
        >
          {twoLine ? valueOnly : prefix + valueOnly + suffix}
        </span>
      </div>
      {/* Suffix / unit line (two-line layout) */}
      {hasSuffix && (
        <span
          style={{
            color: valueColor + 'BB',
            fontSize: unitFontSize,
            fontWeight: 600,
            fontFamily: 'sans-serif',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            letterSpacing: '0.03em',
            animation: danger ? BLINK_ANIM : undefined,
          }}
        >
          {suffix}
        </span>
      )}
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
  const labelPos = cfg.labelPosition ?? 'bottom-center'
  const labelIsTop = labelPos === 'top-center'
  const signalLabel = formatSignalLabel(widget.signal)

  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      {/* Track */}
      <rect x={0} y={(h - barH) / 2} width={w} height={barH} fill="#1C1C1C" rx={2} />
      {/* Fill */}
      <rect x={0} y={(h - barH) / 2} width={fillW} height={barH} fill={st.primaryColor} rx={2} />
      {/* Signal name */}
      <text
        x={4}
        y={labelIsTop ? h - 3 : 3}
        textAnchor="start"
        dominantBaseline={labelIsTop ? 'auto' : 'hanging'}
        fill="#888888"
        fontSize={Math.max(5, Math.min(7, h * 0.22))}
        fontFamily="sans-serif"
        fontWeight="600"
        letterSpacing="0.05em"
      >
        {signalLabel}
      </text>
      {/* Value readout */}
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
      {/* Widget label */}
      {cfg.label && (
        <text
          x={w / 2}
          y={labelIsTop ? 8 : h - 3}
          textAnchor="middle"
          dominantBaseline={labelIsTop ? 'hanging' : 'auto'}
          fill={st.textColor + '77'}
          fontSize={Math.max(6, Math.min(9, h * 0.22))}
          fontFamily="sans-serif"
          fontWeight="600"
          letterSpacing="0.04em"
        >
          {cfg.label}
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
  const signalLabel = formatSignalLabel(widget.signal)
  const sigFontSize = Math.max(8, Math.min(h * 0.16, w * 0.13, 14))
  const labelH = sigFontSize + 4
  const iconSize = Math.min(w * 0.55, h - labelH - 8, 64)

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: st.criticalColor + '22',
        borderRadius: 3,
        animation: BLINK_ANIM,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <SensorIcon name={iconName} size={iconSize} color={st.criticalColor} />
      <span
        style={{
          fontSize: sigFontSize,
          fontFamily: 'sans-serif',
          fontWeight: 600,
          color: st.criticalColor + '99',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          letterSpacing: '0.06em',
        }}
      >
        {signalLabel}
      </span>
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
  // Scale icon and label font to fill the assigned widget dimensions
  const iconSize = Math.min(h * 0.48, w * 0.3)
  const fontSize = Math.max(8, Math.min(h * 0.38, w * 0.28))

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
  const signalLabel = formatSignalLabel(widget.signal)
  const sigHeaderH = Math.max(8, Math.min(h * 0.16, 13))
  // Digit fills available height below signal label
  const fontSize = Math.min(w * 0.72, (h - sigHeaderH) * 0.85)
  const sigFontSize = Math.max(5, Math.min(sigHeaderH * 0.72, w * 0.12))

  return (
    <div
      style={{
        width: w,
        height: h,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: sigHeaderH,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: sigFontSize,
          fontFamily: 'sans-serif',
          fontWeight: 600,
          color: '#888888',
          lineHeight: 1,
          letterSpacing: '0.05em',
        }}
      >
        {signalLabel}
      </span>
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
  const fontSize = Math.max(9, Math.min(h * 0.44, w * 0.22))
  const sigFontSize = Math.max(5, Math.min(7, w * 0.07))

  return (
    <div
      style={{
        width: w,
        height: h,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
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
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 3,
          fontSize: sigFontSize,
          fontFamily: 'sans-serif',
          fontWeight: 600,
          color: '#888888',
          lineHeight: 1,
          letterSpacing: '0.05em',
        }}
      >
        TIMER
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
      <text
        x={w / 2}
        y={h - 6}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="#2A2A2A"
        fontSize={Math.max(5, Math.min(7, w * 0.07))}
        fontFamily="sans-serif"
        fontWeight="600"
        letterSpacing="0.05em"
      >
        IMAGE
      </text>
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
  ensureBlinkStyle()

  const { config } = widget
  const danger = isDangerState(widget)

  if (config.type === 'gauge') {
    if (config.displayStyle === 'arc')
      return (
        <GaugeArcPreview widget={widget} w={w} h={h} revLimiting={revLimiting} danger={danger} />
      )
    if (config.displayStyle === 'bar')
      return <GaugeBarPreview widget={widget} w={w} h={h} danger={danger} />
    return <GaugeNumericPreview widget={widget} w={w} h={h} danger={danger} />
  }
  if (config.type === 'bar') return <BarWidgetPreview widget={widget} w={w} h={h} />
  if (config.type === 'warning') return <WarningPreview widget={widget} w={w} h={h} />
  if (config.type === 'button')
    return <ButtonPreview widget={widget} w={w} h={h} active={buttonActive} />
  if (config.type === 'gear') return <GearPreview widget={widget} w={w} h={h} />
  if (config.type === 'timer') return <TimerPreview widget={widget} w={w} h={h} />
  return <ImagePreview w={w} h={h} />
}
