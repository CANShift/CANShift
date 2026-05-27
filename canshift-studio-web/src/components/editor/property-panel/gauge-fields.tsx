// property-panel/gauge-fields.tsx — Editor for `gauge` widgets.
//
// The arc / bar / numeric variants all live in this same component because
// switching style automatically applies the matching default size token,
// and the shared range/warn/danger row needs to know about that transition.

import { Checkbox } from '@/components/ui/checkbox'
import {
  GAUGE_DEFAULT_TOKEN,
  SIZE_TOKENS,
  gaugeTokenIds,
  tokenFromDimensions,
} from '../../../utils/sizeTokens'
import {
  ConfigFieldsProps,
  Field,
  GAUGE_STYLES,
  Row,
  inputStyle,
  numberInputStyle,
} from './shared'

export function GaugeFields({ widget, onChange, signalDef }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'gauge' ? widget.config : null
  if (!cfg) return null
  const style = cfg.displayStyle
  // Pre-narrowed default for the "Reset to signal default" affordance —
  // TypeScript can't follow signalDef?.X through the chained ternaries inside
  // the JSX, so we hoist the value once.
  const defaultDanger = signalDef?.dangerLevel
  const allowedTokenIds = gaugeTokenIds(style)
  // If current dimensions don't match any token, fall back to the first available
  const activeTokenId =
    tokenFromDimensions(widget.layout.w, widget.layout.h) ?? allowedTokenIds[0] ?? null

  return (
    <>
      {/* Display style selector — switching also applies the default size token */}
      <Field label="Style">
        <div style={{ display: 'flex', gap: 4 }}>
          {GAUGE_STYLES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => {
                const defaultTokenId = GAUGE_DEFAULT_TOKEN[value]
                const defaultToken = SIZE_TOKENS[defaultTokenId]
                onChange({
                  config: { ...cfg, displayStyle: value },
                  layout: { ...widget.layout, w: defaultToken.w, h: defaultToken.h },
                })
              }}
              style={{
                flex: 1,
                padding: '3px 0',
                background: style === value ? '#2A2A3A' : '#111111',
                border: `1px solid ${style === value ? '#5566AA' : '#2A2A2A'}`,
                borderRadius: 3,
                color: style === value ? '#7788CC' : '#AAAAAA',
                cursor: 'pointer',
                fontSize: 10,
                textTransform: 'uppercase',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      {/* Size tokens for the current style */}
      <Field label="Size">
        <div style={{ display: 'flex', gap: 4 }}>
          {allowedTokenIds.map((tokenId) => {
            const token = SIZE_TOKENS[tokenId]
            const isActive = tokenId === activeTokenId
            return (
              <button
                key={tokenId}
                onClick={() => {
                  onChange({ layout: { ...widget.layout, w: token.w, h: token.h } })
                }}
                title={token.description}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  background: isActive ? '#1A2A1A' : '#111111',
                  border: `1px solid ${isActive ? '#448844' : '#2A2A2A'}`,
                  borderRadius: 3,
                  color: isActive ? '#66AA66' : '#AAAAAA',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                {token.label}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Unit, prefix, decimals — inherited from the bound signal definition
          (signal.unit + signal-side scaling). Per-widget overrides were
          dropped from the picker so the dashboard reads consistently with
          the signal catalogue. */}

      {/* Arc range fields. */}
      {style === 'arc' && (
        <>
          <Row>
            <Field
              label="Min"
              onReset={
                signalDef && cfg.minValue !== signalDef.min
                  ? () => {
                      onChange({ config: { ...cfg, minValue: signalDef.min } })
                    }
                  : undefined
              }
            >
              <input
                type="number"
                style={numberInputStyle}
                value={cfg.minValue}
                onChange={(e) => {
                  const newMin = Number(e.target.value)
                  onChange({
                    config: {
                      ...cfg,
                      minValue: newMin,
                      dangerLevel: Math.max(cfg.dangerLevel, newMin),
                    },
                  })
                }}
              />
            </Field>
            <Field
              label="Max"
              onReset={
                signalDef && cfg.maxValue !== signalDef.max
                  ? () => {
                      onChange({ config: { ...cfg, maxValue: signalDef.max } })
                    }
                  : undefined
              }
            >
              <input
                type="number"
                style={numberInputStyle}
                value={cfg.maxValue}
                onChange={(e) => {
                  const newMax = Number(e.target.value)
                  // Scale dangerLevel proportionally when max changes so the
                  // user's relative cut-off survives the range adjustment.
                  const range = cfg.maxValue - cfg.minValue || 1
                  const dangerPct = (cfg.dangerLevel - cfg.minValue) / range
                  const newRange = newMax - cfg.minValue || 1
                  onChange({
                    config: {
                      ...cfg,
                      maxValue: newMax,
                      dangerLevel: Math.round(cfg.minValue + dangerPct * newRange),
                    },
                  })
                }}
              />
            </Field>
          </Row>
          <Row>
            <Field
              label="Danger"
              onReset={
                defaultDanger !== undefined && cfg.dangerLevel !== defaultDanger
                  ? () => {
                      onChange({ config: { ...cfg, dangerLevel: defaultDanger } })
                    }
                  : undefined
              }
            >
              <input
                type="number"
                style={numberInputStyle}
                value={cfg.dangerLevel}
                onChange={(e) => {
                  onChange({ config: { ...cfg, dangerLevel: Number(e.target.value) } })
                }}
              />
            </Field>
          </Row>
          {style === 'arc' && (
            <>
              <Field label="Needle">
                <Checkbox
                  checked={cfg.showNeedle ?? false}
                  onCheckedChange={(checked) => {
                    onChange({ config: { ...cfg, showNeedle: checked === true } })
                  }}
                />
              </Field>
              <Field label="Rev flash">
                <Checkbox
                  checked={cfg.revFlash ?? false}
                  onCheckedChange={(checked) => {
                    onChange({ config: { ...cfg, revFlash: checked === true } })
                  }}
                />
              </Field>
            </>
          )}
          <Row>
            <Field
              label="Alert at"
              onReset={
                cfg.alertThreshold !== undefined
                  ? () => {
                      const { alertThreshold: _drop, ...rest } = cfg
                      void _drop
                      onChange({ config: rest })
                    }
                  : undefined
              }
            >
              <input
                type="number"
                style={numberInputStyle}
                placeholder="off"
                value={cfg.alertThreshold ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    const { alertThreshold: _drop, ...rest } = cfg
                    void _drop
                    onChange({ config: rest })
                    return
                  }
                  const v = Number(raw)
                  if (!Number.isFinite(v)) return
                  onChange({ config: { ...cfg, alertThreshold: v } })
                }}
              />
            </Field>
          </Row>
        </>
      )}

      {/* Sensor + Label blocks were dropped from the gauge editor. The
          two-zone palette now resolves through the bound signal's `type`
          (see SignalType / signalTypeOkColor in canshift-core), and the
          widget renders the signal name as an auto-header — no per-widget
          icon or custom label fields needed here. */}
    </>
  )
}
