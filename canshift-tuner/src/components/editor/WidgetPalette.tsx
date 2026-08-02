import type { CSSProperties } from 'react'
import { HexColorSchema } from '@tmbk/canshift-core'
import type { WidgetType, SensorIconName } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { SensorIcon } from '../icons/SensorIcons'
import { SIZE_TOKENS } from '../../utils/size-tokens'
import { createId } from '../../utils/id'
import { MONO_FONT } from '../../lib/typography'

const DEFAULT_WIDGET_STYLE = {
  primaryColor: HexColorSchema.parse('#FF4444'),
  secondaryColor: HexColorSchema.parse('#333333'),
  warningColor: HexColorSchema.parse('#FF8800'),
  criticalColor: HexColorSchema.parse('#FF0000'),
  textColor: HexColorSchema.parse('#FFFFFF'),
}

type PaletteWidgetType = Extract<WidgetType, 'gauge' | 'button' | 'gear' | 'shift_light'>

interface PaletteItem {
  type: PaletteWidgetType
  label: string
  icon: SensorIconName
  defaultSignal: string
  defaultColSpan: number
  defaultRowSpan: number
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'gauge',
    label: 'Gauge',
    icon: 'rpm',
    defaultSignal: 'rpm',
    defaultColSpan: SIZE_TOKENS.XL.colSpan,
    defaultRowSpan: SIZE_TOKENS.XL.rowSpan,
  },
  {
    type: 'button',
    label: 'Button',
    icon: 'cog',
    defaultSignal: '',
    defaultColSpan: SIZE_TOKENS.L.colSpan,
    defaultRowSpan: SIZE_TOKENS.L.rowSpan,
  },
  {
    type: 'gear',
    label: 'Gear',
    icon: 'gear',
    defaultSignal: 'gear',
    defaultColSpan: SIZE_TOKENS.L.colSpan,
    defaultRowSpan: SIZE_TOKENS.L.rowSpan,
  },
  {
    type: 'shift_light',
    label: 'Shift light',
    icon: 'rpm',
    defaultSignal: 'rpm',
    defaultColSpan: 12,
    defaultRowSpan: 1,
  },
]

interface WidgetPaletteProps {
  pageId: string
}

const WidgetPalette = ({ pageId }: WidgetPaletteProps) => {
  const addWidget = useDashboardStore((s) => s.addWidget)
  const page = useDashboardStore((s) => s.config?.pages.find((p) => p.id === pageId))
  const templateLocked = (page?.template ?? 'custom') !== 'custom'

  const handleAdd = (item: PaletteItem) => {
    if (templateLocked) return
    const id = createId(item.type)

    const baseConfig = (() => {
      switch (item.type) {
        case 'gauge':
          return {
            type: 'gauge' as const,
            displayStyle: 'arc' as const,
            minValue: 0,
            maxValue: 8000,
            dangerLevel: 7000,
            decimalPlaces: 0,
            iconName: item.icon,
          }
        case 'button':
          return {
            type: 'button' as const,
            mode: 'single' as const,
            label: 'Button',
            iconName: item.icon,
            showLabel: true,
            showIcon: false,
            actions: [],
          }
        case 'gear':
          return { type: 'gear' as const, decimalPlaces: 0 as const }
        case 'shift_light':
          return { type: 'shift_light' as const, startValue: 3000, redSegments: 5 }
      }
    })()

    addWidget(pageId, {
      id,
      type: item.type,
      signal: item.defaultSignal,
      layout: {
        col: 0,
        colSpan: item.defaultColSpan,
        row: 0,
        rowSpan: item.defaultRowSpan,
        zOrder: 0,
      },
      style: {
        ...DEFAULT_WIDGET_STYLE,
        fontSize: 16,
      },
      config: baseConfig,
    })
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', opacity: templateLocked ? 0.5 : 1 }}>
      <div style={libraryHeaderStyle}>
        <span>WIDGET LIBRARY</span>
        <span>{PALETTE_ITEMS.length}</span>
      </div>
      {templateLocked && (
        <div style={lockedNoteStyle}>
          This page uses a built-in template — widget edits are ignored. Switch the page template
          back to <em>Custom layout</em> to add widgets.
        </div>
      )}
      {PALETTE_ITEMS.map((item) => (
        <button
          key={item.label}
          type="button"
          className={templateLocked ? undefined : 'shell-nav-item'}
          onClick={() => {
            handleAdd(item)
          }}
          disabled={templateLocked}
          title={templateLocked ? 'Disabled — page uses a template' : `Add ${item.label}`}
          style={libraryRowStyle(templateLocked)}
        >
          <span style={rowIconStyle}>
            <SensorIcon name={item.icon} size={13} color="currentColor" />
          </span>
          <span style={{ fontSize: 13 }}>{item.label}</span>
          <span style={rowSizeStyle}>
            {item.defaultColSpan}×{item.defaultRowSpan}
          </span>
        </button>
      ))}
    </div>
  )
}

const libraryHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '2px solid var(--brand-divider)',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.18em',
  color: 'hsl(var(--brand-neutral-600))',
}

const lockedNoteStyle: CSSProperties = {
  padding: '10px 16px',
  fontSize: 11,
  lineHeight: 1.4,
  color: 'hsl(var(--brand-neutral-600))',
  borderBottom: '1px solid hsl(var(--brand-neutral-200))',
}

const libraryRowStyle = (locked: boolean): CSSProperties => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  padding: '9px 16px',
  background: 'none',
  border: 0,
  borderBottom: '1px solid hsl(var(--brand-neutral-200))',
  color: 'hsl(var(--brand-neutral-700))',
  cursor: locked ? 'not-allowed' : 'pointer',
  textAlign: 'left',
})

const rowIconStyle: CSSProperties = {
  width: 20,
  flexShrink: 0,
  display: 'inline-flex',
  color: 'hsl(var(--brand-accent))',
}

const rowSizeStyle: CSSProperties = {
  marginLeft: 'auto',
  fontFamily: MONO_FONT,
  fontSize: 10,
  color: 'hsl(var(--brand-neutral-600))',
}

export default WidgetPalette
