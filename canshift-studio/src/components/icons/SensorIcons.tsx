// SensorIcons.tsx — Built-in SVG icon set for common automotive sensors.
// Used in the canvas preview, widget palette, and property panel.

import type { SensorIconName } from '@tmbk/canshift-core'

interface IconProps {
  size?: number
  color?: string
}

// ---------------------------------------------------------------------------
// Individual icons
// ---------------------------------------------------------------------------

function RpmIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 12 L12 6" />
      <path d="M12 12 L16 9" strokeWidth={2.5} />
      <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
      <path d="M5.5 17 a8 8 0 0 1 0-10" strokeDasharray="2 1.5" />
    </svg>
  )
}

function SpeedIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M5 12 a7 7 0 0 1 14 0" />
      <path d="M12 12 L15 8" strokeWidth={2.2} />
      <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
      <path d="M8 17 h8" />
    </svg>
  )
}

function CoolantIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M12 3 C12 3 7 9 7 14 a5 5 0 0 0 10 0 C17 9 12 3 12 3z" />
      <path d="M9.5 14 a2.5 2.5 0 0 0 5 0" strokeDasharray="2 1" />
    </svg>
  )
}

function OilPressureIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <ellipse cx="12" cy="16" rx="5" ry="4" />
      <path d="M12 12 L12 5" />
      <path d="M9 8 L12 5 L15 8" />
      <path d="M7 14 Q5 10 8 7" strokeDasharray="2 1.5" />
    </svg>
  )
}

function OilTempIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <circle cx="12" cy="18" r="3" />
      <path d="M12 15 L12 10" strokeWidth={2.5} stroke={color} />
      <path d="M14 7 h2 M14 10 h2" strokeWidth={1.2} />
    </svg>
  )
}

function BatteryIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <rect x="2" y="7" width="18" height="10" rx="2" />
      <path d="M20 11 L22 11 L22 13 L20 13" />
      <path d="M7 11 L10 11 L9 13 L12 13 L9 13 M12 11 L11 13" strokeWidth={1.5} />
    </svg>
  )
}

function FuelIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <rect x="3" y="6" width="11" height="15" rx="2" />
      <path d="M14 9 L17 9 Q19 9 19 11 L19 14 Q19 15 18 15 L17 15" />
      <path d="M17 15 L17 20" />
      <path d="M6 11 h5" />
    </svg>
  )
}

function AfrIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <text
        x="3"
        y="18"
        fontSize="18"
        fontFamily="serif"
        fontStyle="italic"
        fill={color}
        stroke="none"
      >
        λ
      </text>
    </svg>
  )
}

function BoostIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M4 18 a8 8 0 0 1 16 0" />
      <path d="M12 10 L12 5 M10 7 L12 5 L14 7" />
      <path d="M8 18 L8 15 M16 18 L16 15" strokeWidth={1.2} />
      <circle cx="12" cy="18" r="1.5" fill={color} stroke="none" />
    </svg>
  )
}

function ThrottleIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="9" ry="3" />
      <path d="M12 3 L12 21" strokeWidth={1.2} />
    </svg>
  )
}

function IatIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M4 8 Q8 4 12 8 Q16 12 20 8" />
      <rect x="9" y="10" width="6" height="9" rx="3" />
      <circle cx="12" cy="21" r="0.5" fill={color} />
    </svg>
  )
}

function GearIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12 M4.9 4.9 L7.1 7.1 M16.9 16.9 L19.1 19.1 M19.1 4.9 L16.9 7.1 M7.1 16.9 L4.9 19.1" />
    </svg>
  )
}

function TimerIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9 L12 13 L15 15" />
      <path d="M9 2 L15 2 M12 2 L12 5" />
    </svg>
  )
}

function WarningIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 4 L2 20 h20 L13.7 4 a2 2 0 0 0-3.4 0z" />
      <path d="M12 10 L12 14 M12 17 L12 17.5" strokeWidth={2} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP: Record<SensorIconName, (props: IconProps) => React.JSX.Element> = {
  rpm: RpmIcon,
  speed: SpeedIcon,
  coolant: CoolantIcon,
  oil_pressure: OilPressureIcon,
  oil_temp: OilTempIcon,
  battery: BatteryIcon,
  fuel: FuelIcon,
  afr: AfrIcon,
  boost: BoostIcon,
  throttle: ThrottleIcon,
  iat: IatIcon,
  gear: GearIcon,
  timer: TimerIcon,
  warning: WarningIcon,
}

export const SENSOR_ICON_NAMES = Object.keys(ICON_MAP) as SensorIconName[]

interface SensorIconProps extends IconProps {
  name: SensorIconName
}

export function SensorIcon({ name, size = 20, color = 'currentColor' }: SensorIconProps) {
  const Component = ICON_MAP[name]
  return <Component size={size} color={color} />
}

/** Human-readable label for each sensor icon */
export const SENSOR_ICON_LABELS: Record<SensorIconName, string> = {
  rpm: 'RPM',
  speed: 'Speed',
  coolant: 'Coolant Temp',
  oil_pressure: 'Oil Pressure',
  oil_temp: 'Oil Temp',
  battery: 'Battery',
  fuel: 'Fuel',
  afr: 'AFR / Lambda',
  boost: 'Boost / MAP',
  throttle: 'Throttle (TPS)',
  iat: 'Intake Air Temp',
  gear: 'Gear',
  timer: 'Timer',
  warning: 'Warning',
}
