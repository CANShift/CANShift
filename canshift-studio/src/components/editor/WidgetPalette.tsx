// WidgetPalette.tsx — Widget type picker.
// Click a tile to add a new widget of that type to the current page.

import type { WidgetType, SensorIconName } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { SensorIcon } from '../icons/SensorIcons'

interface PaletteItem {
  type: WidgetType
  label: string
  icon: SensorIconName
  defaultSignal: string
  defaultW: number
  defaultH: number
}

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'gauge', label: 'Gauge', icon: 'rpm', defaultSignal: 'rpm', defaultW: 80, defaultH: 80 },
  {
    type: 'label',
    label: 'Label',
    icon: 'speed',
    defaultSignal: 'speed',
    defaultW: 80,
    defaultH: 40,
  },
  {
    type: 'bar',
    label: 'Bar',
    icon: 'throttle',
    defaultSignal: 'tps',
    defaultW: 100,
    defaultH: 24,
  },
  {
    type: 'warning',
    label: 'Warning',
    icon: 'warning',
    defaultSignal: 'mil',
    defaultW: 40,
    defaultH: 40,
  },
  { type: 'button', label: 'Button', icon: 'gear', defaultSignal: '', defaultW: 60, defaultH: 30 },
  { type: 'gear', label: 'Gear', icon: 'gear', defaultSignal: 'gear', defaultW: 48, defaultH: 56 },
  { type: 'timer', label: 'Timer', icon: 'timer', defaultSignal: '', defaultW: 80, defaultH: 30 },
  { type: 'image', label: 'Image', icon: 'warning', defaultSignal: '', defaultW: 60, defaultH: 60 },
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
            minValue: 0,
            maxValue: 8000,
            warningLevel: 6000,
            dangerLevel: 7000,
            showArc: true,
            iconName: item.icon as SensorIconName,
          }
        case 'label':
          return { type: 'label' as const, decimalPlaces: 0, iconName: item.icon as SensorIconName }
        case 'bar':
          return { type: 'bar' as const, decimalPlaces: 0, iconName: item.icon as SensorIconName }
        case 'warning':
          return {
            type: 'warning' as const,
            threshold: 0,
            invertLogic: false,
            iconName: item.icon as SensorIconName,
          }
        case 'button':
          return {
            type: 'button' as const,
            targetPageId: '',
            label: 'Button',
            iconName: item.icon as SensorIconName,
            showLabel: true,
            showIcon: false,
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
          color: '#555555',
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
            key={item.type}
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
