import { HexColorSchema } from '@tmbk/canshift-core'
import type { WidgetType, SensorIconName } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { SensorIcon } from '../icons/SensorIcons'
import { SIZE_TOKENS } from '../../utils/size-tokens'

const DEFAULT_WIDGET_STYLE = {
  primaryColor: HexColorSchema.parse('#FF4444'),
  secondaryColor: HexColorSchema.parse('#333333'),
  warningColor: HexColorSchema.parse('#FF8800'),
  criticalColor: HexColorSchema.parse('#FF0000'),
  textColor: HexColorSchema.parse('#FFFFFF'),
}

const TILE_LABEL = '#AAAAAA'
const TILE_HOVER_BG = '#2A2A2A'
const TILE_HOVER_BORDER = '#3A3A3A'

type PaletteWidgetType = Extract<WidgetType, 'gauge' | 'button' | 'gear'>

interface PaletteItem {
  type: PaletteWidgetType
  label: string
  icon: SensorIconName
  defaultSignal: string
  defaultW: number
  defaultH: number
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'gauge',
    label: 'Gauge',
    icon: 'rpm',
    defaultSignal: 'rpm',
    defaultW: SIZE_TOKENS.XL.w,
    defaultH: SIZE_TOKENS.XL.h,
  },
  {
    type: 'button',
    label: 'Button',
    icon: 'cog',
    defaultSignal: '',
    defaultW: SIZE_TOKENS.L.w,
    defaultH: SIZE_TOKENS.L.h,
  },
  {
    type: 'gear',
    label: 'Gear',
    icon: 'gear',
    defaultSignal: 'gear',
    defaultW: SIZE_TOKENS.L.w,
    defaultH: SIZE_TOKENS.L.h,
  },
]

const generateId = (type: string): string => {
  return `${type}_${Date.now().toString(36)}`
}

interface WidgetPaletteProps {
  pageId: string
}

const WidgetPalette = ({ pageId }: WidgetPaletteProps) => {
  const addWidget = useDashboardStore((s) => s.addWidget)
  const page = useDashboardStore((s) => s.config?.pages.find((p) => p.id === pageId))
  const templateLocked = (page?.template ?? 'custom') !== 'custom'

  const handleAdd = (item: PaletteItem) => {
    if (templateLocked) return
    const id = generateId(item.type)

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
      }
    })()

    addWidget(pageId, {
      id,
      type: item.type,
      signal: item.defaultSignal,
      layout: { x: 10, y: 10, w: item.defaultW, h: item.defaultH, zOrder: 0 },
      style: {
        ...DEFAULT_WIDGET_STYLE,
        fontSize: 16,
      },
      config: baseConfig,
    })
  }

  return (
    <div style={{ padding: '8px 4px', opacity: templateLocked ? 0.4 : 1 }}>
      <div
        style={{
          fontSize: 10,
          color: TILE_LABEL,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          paddingLeft: 4,
        }}
      >
        Add Widget
      </div>
      {templateLocked && (
        <div
          style={{
            fontSize: 10,
            color: TILE_LABEL,
            padding: '4px 6px 8px',
            lineHeight: 1.4,
          }}
        >
          This page uses a built-in template — widget edits are ignored. Switch the page template
          back to <em>Custom layout</em> to add widgets.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {PALETTE_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              handleAdd(item)
            }}
            disabled={templateLocked}
            title={templateLocked ? 'Disabled — page uses a template' : `Add ${item.label}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 8px',
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 4,
              color: TILE_LABEL,
              cursor: templateLocked ? 'not-allowed' : 'pointer',
              fontSize: 12,
              textAlign: 'left',
              transition: 'all 0.1s',
            }}
            onMouseEnter={(e) => {
              if (templateLocked) return
              e.currentTarget.style.background = TILE_HOVER_BG
              e.currentTarget.style.borderColor = TILE_HOVER_BORDER
              e.currentTarget.style.color = 'hsl(var(--text))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
              e.currentTarget.style.color = TILE_LABEL
            }}
          >
            <SensorIcon name={item.icon} size={14} color="currentColor" />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default WidgetPalette
