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
// Automotive control icons
// ---------------------------------------------------------------------------

function FlameIcon({ size = 20, color = 'currentColor' }: IconProps) {
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
      {/* Outer flame */}
      <path d="M12 2C10 6 6 9 6 14a6 6 0 0 0 12 0c0-5-4-8-6-12Z" />
      {/* Inner flicker */}
      <path
        d="M12 9C11 12 10.5 13 10.5 14.5a1.5 1.5 0 0 0 3 0C13.5 13 13 12 12 9Z"
        strokeWidth={1.2}
      />
    </svg>
  )
}

function TurboIcon({ size = 20, color = 'currentColor' }: IconProps) {
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
      <circle cx="12" cy="12" r="2.5" />
      {/* Swept impeller blades */}
      <path d="M12 9.5Q15.5 8 15.5 12" />
      <path d="M14.5 14.5Q13 18 9.5 17" strokeWidth={1.4} />
      <path d="M9.5 14.5Q6 16 6 12" />
      <path d="M9.5 9.5Q11 6 14.5 7" strokeWidth={1.4} />
    </svg>
  )
}

function EngineIcon({ size = 20, color = 'currentColor' }: IconProps) {
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
      {/* Engine block */}
      <rect x="2" y="8" width="20" height="10" rx="2" />
      {/* Pistons */}
      <path d="M6 8V5h3v3M11 8V5h2v3M16 8V5h2v3" />
      {/* Cylinder dividers */}
      <path d="M9 8v10M15 8v10" strokeWidth={1} />
    </svg>
  )
}

function BrakeIcon({ size = 20, color = 'currentColor' }: IconProps) {
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
      {/* Disc */}
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      {/* Vents */}
      <path d="M12 3v5M12 16v5M3 12h5M16 12h5" strokeWidth={1.2} />
      <path
        d="M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"
        strokeWidth={1.2}
      />
    </svg>
  )
}

function LaunchIcon({ size = 20, color = 'currentColor' }: IconProps) {
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
      {/* Rocket body */}
      <path d="M12 2l4 8h-3v8H11v-8H8l4-8Z" />
      {/* Exhaust flames */}
      <path d="M10 18l-1.5 4M14 18l1.5 4" strokeWidth={1.4} />
      {/* Start line */}
      <path d="M4 21h4M16 21h4" />
    </svg>
  )
}

function TractionIcon({ size = 20, color = 'currentColor' }: IconProps) {
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
      {/* Tire outline */}
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      {/* Lock / slip mark */}
      <path d="M9 9l6 6M15 9l-6 6" strokeWidth={2} />
    </svg>
  )
}

function MapIconIcon({ size = 20, color = 'currentColor' }: IconProps) {
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
      {/* Stacked map/tune layers */}
      <path d="M4 7l8-4 8 4-8 4-8-4Z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 17l8 4 8-4" />
    </svg>
  )
}

function ExhaustIcon({ size = 20, color = 'currentColor' }: IconProps) {
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
      {/* Exhaust pipe */}
      <path d="M3 16h10" />
      <path d="M13 16q3 0 3-4V8h2v4q0 6-5 6H3" />
      {/* Heat waves rising */}
      <path d="M7 12Q8 9 9 12Q10 15 11 12" strokeWidth={1.3} />
      <path d="M10 9Q11 6 12 9Q13 12 14 9" strokeWidth={1} />
    </svg>
  )
}

function CogIcon({ size = 20, color = 'currentColor' }: IconProps) {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP: Record<SensorIconName, (props: IconProps) => React.JSX.Element> = {
  // Sensors
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
  // Automotive controls
  flame: FlameIcon,
  turbo: TurboIcon,
  engine: EngineIcon,
  brake: BrakeIcon,
  launch: LaunchIcon,
  traction: TractionIcon,
  map_icon: MapIconIcon,
  exhaust: ExhaustIcon,
  // Mechanical
  cog: CogIcon,
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
  flame: 'Flame',
  turbo: 'Turbo',
  engine: 'Engine',
  brake: 'Brake',
  launch: 'Launch Control',
  traction: 'Traction Control',
  map_icon: 'Map / Tune',
  exhaust: 'Exhaust / EGT',
  cog: 'Cog / Mechanical Gear',
}
