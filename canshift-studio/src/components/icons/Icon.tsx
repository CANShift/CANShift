// Icon.tsx — Minimal SVG icon set used across the Studio UI

interface IconProps {
  size?: number
  color?: string
  style?: React.CSSProperties
}

type IconComponent = (props: IconProps) => React.JSX.Element

function icon(path: string, viewBox = '0 0 16 16'): IconComponent {
  return function Icon({ size = 14, color = 'currentColor', style }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        style={{ flexShrink: 0, ...style }}
        aria-hidden
      >
        <path
          d={path}
          stroke={color}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
}

// Navigation
export const IconEditor = icon('M2 3h12M2 8h8M2 13h10')
export const IconSignals = icon('M1 8c1-3 2-5 3-5s2 4 3 8 2 5 3 2 2-6 3-5')
export const IconTheme = icon('M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2ZM5 8a3 3 0 0 1 6 0')
// Upload arrow + chip — firmware update
export const IconFirmware = icon('M8 2v8M5 7l3-3 3 3M3 11v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2')
// CAN bus scanner — two nodes connected by a bus line
export const IconCanScanner = icon(
  'M3 5h2M11 5h2M3 11h2M11 11h2M5 5h6M5 11h6M5 5v6M11 5v6M2 3h3v4H2zM11 3h3v4h-3zM2 9h3v4H2zM11 9h3v4h-3z',
  '0 0 16 16'
)

// File actions
export const IconLoad = icon(
  'M2 3.5A1.5 1.5 0 0 1 3.5 2h3.086a1.5 1.5 0 0 1 1.06.44l.915.914A1.5 1.5 0 0 0 9.62 3.8H12.5A1.5 1.5 0 0 1 14 5.3V12.5A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-9Z'
)
export const IconExport = icon(
  'M3 2h8l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1ZM5 2v4h6V2M5 15v-5h6v5'
)
export const IconBurn = icon(
  'M8 2C5 5 3 8 5 11c.8 1.5 2 2.5 3 3 1-.5 2.2-1.5 3-3 2-3 0-6-3-9ZM8 10c-.5-1-1-2-.5-3.5C8 8 9.5 8.5 9.5 10a1.5 1.5 0 0 1-3 0'
)

// Device / connection
export const IconUsb = icon('M8 2v8M5 7l3 3 3-3M4 10h8a2 2 0 0 1 0 4H4a2 2 0 0 1 0-4Z')
export const IconSimulation = icon('M3 8a5 5 0 1 0 10 0A5 5 0 0 0 3 8Zm3-2 4 2-4 2V6Z')
export const IconDisconnect = icon('M10 6 6 10M4 4l8 8M2 8a6 6 0 1 0 12 0A6 6 0 0 0 2 8Z')
// WiFi — three concentric arcs + dot. Used by the WiFi connect tab (#1071).
export const IconWifi = icon(
  'M1 6.5a10 10 0 0 1 14 0M3 9a7 7 0 0 1 10 0M5 11.5a4 4 0 0 1 6 0M8 13.5h.01'
)

// Actions
export const IconTrash = icon('M3 5h10M5 5V3h6v2M6 8v4M10 8v4M4 5l1 9h6l1-9')
export const IconClear = icon('M4 4l8 8M12 4 4 12')
export const IconRefresh = icon('M13 6A6 6 0 0 0 2 8m1 4a6 6 0 0 0 11-2M14 10l-1 2-2-1')
export const IconExit = icon('M10 3h3v10h-3M7 10l3-3-3-3M2 8h8')

// Status
export const IconCheck = icon('M3 8l4 4 6-7')
// Triangle-warning glyph — generic warning indicator
export const IconWarning = icon('M8 2 1.5 13.5h13L8 2ZM8 6.5v3.5M8 12v.5')

// Settings gear — needs circle + path, so defined as a standalone component
export function IconSettings({ size = 14, color = 'currentColor', style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      style={{ flexShrink: 0, ...style }}
      aria-hidden
    >
      <path
        d="M6.5 2.5h3l.5 1.5a4 4 0 0 1 1.1.65l1.5-.4 1.5 2.6-1.1 1.1c.03.35.03.7 0 1.05l1.1 1.1-1.5 2.6-1.5-.4A4 4 0 0 1 10 12l-.5 1.5h-3L6 12a4 4 0 0 1-1.1-.65l-1.5.4-1.5-2.6 1.1-1.1a4 4 0 0 1 0-1.05L1.9 5.85l1.5-2.6 1.5.4A4 4 0 0 1 6 3.5L6.5 2.5Z"
        stroke={color}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke={color} strokeWidth="1.1" />
    </svg>
  )
}
