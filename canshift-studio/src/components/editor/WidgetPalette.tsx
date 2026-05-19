// WidgetPalette.tsx — Widget type picker.
// Click a tile to add a new widget of that type to the current page.

import type { WidgetType, SensorIconName } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { SensorIcon } from '../icons/SensorIcons'
import { SIZE_TOKENS } from '../../utils/sizeTokens'

// 'bar' is not in the palette — it is a display style inside gauge
type PaletteWidgetType = Exclude<WidgetType, 'bar'>

interface PaletteItem {
  type: PaletteWidgetType
  label: string
  icon: SensorIconName
  defaultSignal: string
  defaultW: number
  defaultH: number
}

// Default sizes use binary-halving size tokens
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
    type: 'warning',
    label: 'Warning',
    icon: 'warning',
    defaultSignal: 'mil',
    defaultW: SIZE_TOKENS.L.w,
    defaultH: SIZE_TOKENS.L.h,
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
  {
    type: 'timer',
    label: 'Timer',
    icon: 'timer',
    defaultSignal: '',
    defaultW: SIZE_TOKENS.L.w,
    defaultH: SIZE_TOKENS.L.h,
  },
  {
    type: 'image',
    label: 'Image',
    icon: 'warning',
    defaultSignal: '',
    defaultW: SIZE_TOKENS.L.w,
    defaultH: SIZE_TOKENS.L.h,
  },
]

function generateId(type: string): string {
  return `${type}_${Date.now().toString(36)}`
}

interface WidgetPaletteProps {
  pageId: string
}

export default function WidgetPalette({ pageId }: WidgetPaletteProps) {
  const addWidget = useDashboardStore((s) => s.addWidget)

  const handleAdd = (item: PaletteItem) => {
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
        case 'warning':
          return {
            type: 'warning' as const,
            threshold: 0,
            invertLogic: false,
            iconName: item.icon,
          }
        case 'button':
          return {
            type: 'button' as const,
            label: 'Button',
            iconName: item.icon,
            showLabel: true,
            showIcon: false,
            actions: [],
          }
        case 'gear':
          return { type: 'gear' as const, decimalPlaces: 0 as const }
        case 'timer':
          return { type: 'timer' as const, autoStart: false, format: 'mm:ss' as const }
        case 'image':
          return { type: 'image' as const, imagePath: '' }
      }
    })()

    addWidget(pageId, {
      id,
      type: item.type,
      signal: item.defaultSignal,
      layout: { x: 10, y: 10, w: item.defaultW, h: item.defaultH, zOrder: 0 },
      style: {
        primaryColor: '#FF4444',
        secondaryColor: '#333333',
        warningColor: '#FF8800',
        criticalColor: '#FF0000',
        textColor: '#FFFFFF',
        fontSize: 16,
      },
      config: baseConfig,
    })
  }

  return (
    <div style={{ padding: '8px 4px' }}>
      <div
        style={{
          fontSize: 10,
          color: '#AAAAAA',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          paddingLeft: 4,
        }}
      >
        Add Widget
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {PALETTE_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              handleAdd(item)
            }}
            title={`Add ${item.label}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 8px',
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 4,
              color: '#AAAAAA',
              cursor: 'pointer',
              fontSize: 12,
              textAlign: 'left',
              transition: 'all 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2A2A2A'
              e.currentTarget.style.borderColor = '#3A3A3A'
              e.currentTarget.style.color = '#FFFFFF'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
              e.currentTarget.style.color = '#AAAAAA'
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
