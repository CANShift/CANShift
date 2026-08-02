import { Checkbox } from '@/components/ui/checkbox'
import {
  GAUGE_DEFAULT_TOKEN,
  SIZE_TOKENS,
  gaugeTokenIds,
  tokenFromSpans,
} from '../../../utils/size-tokens'
import { ConfigFieldsProps, Field, GAUGE_STYLES, Row, numberInputStyle } from './shared'

export const GaugeFields = ({ widget, onChange, signalDef }: ConfigFieldsProps) => {
  const cfg = widget.config.type === 'gauge' ? widget.config : null
  if (!cfg) return null
  const style = cfg.displayStyle
  const defaultDanger = signalDef?.dangerLevel
  const allowedTokenIds = gaugeTokenIds(style)
  const activeTokenId =
    tokenFromSpans(widget.layout.colSpan, widget.layout.rowSpan) ?? allowedTokenIds[0] ?? null

  return (
    <>
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
                  layout: {
                    ...widget.layout,
                    colSpan: defaultToken.colSpan,
                    rowSpan: defaultToken.rowSpan,
                  },
                })
              }}
              style={{
                flex: 1,
                padding: '3px 0',
                background:
                  style === value
                    ? 'color-mix(in srgb, #5566AA 14%, transparent)'
                    : 'hsl(var(--brand-neutral-100))',
                border: `1px solid ${style === value ? '#5566AA' : 'hsl(var(--brand-neutral-300))'}`,
                color: style === value ? '#7788CC' : 'hsl(var(--brand-neutral-600))',
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

      <Field label="Size">
        <div style={{ display: 'flex', gap: 4 }}>
          {allowedTokenIds.map((tokenId) => {
            const token = SIZE_TOKENS[tokenId]
            const isActive = tokenId === activeTokenId
            return (
              <button
                key={tokenId}
                onClick={() => {
                  onChange({
                    layout: { ...widget.layout, colSpan: token.colSpan, rowSpan: token.rowSpan },
                  })
                }}
                title={token.description}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  background: isActive
                    ? 'color-mix(in srgb, #448844 14%, transparent)'
                    : 'hsl(var(--brand-neutral-100))',
                  border: `1px solid ${isActive ? '#448844' : 'hsl(var(--brand-neutral-300))'}`,
                  color: isActive ? '#66AA66' : 'hsl(var(--brand-neutral-600))',
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
            <Field label="Rev flash">
              <Checkbox
                checked={cfg.revFlash ?? false}
                onCheckedChange={(checked) => {
                  onChange({ config: { ...cfg, revFlash: checked === true } })
                }}
              />
            </Field>
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
    </>
  )
}
