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
  // H-pattern gear selector: two rails (columns), three positions each
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
      {/* Vertical rails */}
      <line x1="8" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="16" y2="21" />
      {/* Horizontal gate */}
      <line x1="8" y1="12" x2="16" y2="12" />
      {/* Gear positions: circles at 1,2,3,4,5,R */}
      <circle cx="8" cy="5" r="1.6" fill={color} stroke="none" />
      <circle cx="16" cy="5" r="1.6" stroke={color} strokeWidth={1.4} />
      <circle cx="8" cy="19" r="1.6" stroke={color} strokeWidth={1.4} />
      <circle cx="16" cy="19" r="1.6" stroke={color} strokeWidth={1.4} />
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
  // Classic multi-lobe flame: rounded base, three tapering tongues
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
      {/* Left tongue */}
      <path d="M8 20C5 18 4 14 6 11C6.5 14 8 15 8 15C8 12 9 9 9 7C10.5 10 10 13 10 14" />
      {/* Right tongue */}
      <path d="M16 20C19 18 20 14 18 11C17.5 14 16 15 16 15C16 12 15 9 15 7C13.5 10 14 13 14 14" />
      {/* Center main flame */}
      <path d="M10 14C10 11 11 8 12 4C13 8 14 11 14 14C14 17.3 13.1 20 12 20C10.9 20 10 17.3 10 14Z" />
    </svg>
  )
}

function TurboIcon({ size = 20, color = 'currentColor' }: IconProps) {
  // Turbocharger: scroll/snail housing silhouette + compressor wheel
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
      {/* Compressor housing (outer ring) */}
      <circle cx="11" cy="13" r="7" />
      {/* Shaft center */}
      <circle cx="11" cy="13" r="1.8" fill={color} stroke="none" />
      {/* 4 backward-swept impeller blades */}
      <path d="M11 11.2C13 10 15 10.8 13.2 13" strokeWidth={2} strokeLinecap="round" />
      <path d="M12.8 14.8C14 16.8 13.2 18.8 11 17" strokeWidth={2} strokeLinecap="round" />
      <path d="M11 14.8C9 16 7 15.2 8.8 13" strokeWidth={2} strokeLinecap="round" />
      <path d="M9.2 11.2C8 9.2 8.8 7.2 11 9" strokeWidth={2} strokeLinecap="round" />
      {/* Inlet duct pipe at top-right */}
      <path d="M16.5 7.5L20 4" />
      <path d="M14.5 6L16.5 7.5L15 9.5" />
    </svg>
  )
}

function EngineIcon({ size = 20, color = 'currentColor' }: IconProps) {
  // Engine: piston + connecting rod cross-section — universally recognizable
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
      {/* Cylinder block */}
      <rect x="7" y="2" width="10" height="12" rx="1.5" />
      {/* Piston inside cylinder */}
      <rect x="9" y="5" width="6" height="4" rx="1" />
      {/* Connecting rod */}
      <line x1="12" y1="9" x2="12" y2="16" />
      {/* Crankshaft */}
      <circle cx="12" cy="19" r="3" />
      <circle cx="12" cy="19" r="1" fill={color} stroke="none" />
      {/* Crank pin offset */}
      <line x1="12" y1="16" x2="14" y2="18" />
    </svg>
  )
}

function BrakeIcon({ size = 20, color = 'currentColor' }: IconProps) {
  // Disc brake: rotor disc with caliper — clear automotive symbol
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
      {/* Rotor disc */}
      <circle cx="12" cy="12" r="9" />
      {/* Hub */}
      <circle cx="12" cy="12" r="3.5" />
      {/* Vent slots (6 equally spaced) */}
      <line x1="12" y1="8.5" x2="12" y2="5" strokeWidth={2.5} />
      <line x1="15.5" y1="10" x2="18.5" y2="8.2" strokeWidth={2.5} />
      <line x1="15.5" y1="14" x2="18.5" y2="15.8" strokeWidth={2.5} />
      <line x1="12" y1="15.5" x2="12" y2="19" strokeWidth={2.5} />
      <line x1="8.5" y1="14" x2="5.5" y2="15.8" strokeWidth={2.5} />
      <line x1="8.5" y1="10" x2="5.5" y2="8.2" strokeWidth={2.5} />
      {/* Caliper */}
      <path d="M3 9 L3 15 Q3 16 4 16 L5 16 L5 8 L4 8 Q3 8 3 9Z" />
    </svg>
  )
}

function LaunchIcon({ size = 20, color = 'currentColor' }: IconProps) {
  // Launch control: traffic light / countdown — clear racing symbol
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
      {/* Traffic light housing */}
      <rect x="8" y="2" width="8" height="18" rx="3" />
      {/* Red light (top) */}
      <circle cx="12" cy="7" r="2" fill={color} stroke="none" />
      {/* Amber (mid) */}
      <circle cx="12" cy="12" r="2" />
      {/* Green (bottom — active) */}
      <circle cx="12" cy="17" r="2" />
      {/* Stand */}
      <line x1="12" y1="20" x2="12" y2="22" />
    </svg>
  )
}

function TractionIcon({ size = 20, color = 'currentColor' }: IconProps) {
  // TC: car with wavy skid marks — the universal traction control symbol
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
      {/* Car body side silhouette */}
      <path d="M2 14 L2 12 L6 9 L10 8 L16 8 L20 10 L22 12 L22 14 L2 14Z" />
      {/* Roof */}
      <path d="M7 8 L9 5 L15 5 L17 8" />
      {/* Wheels */}
      <circle cx="7" cy="15" r="2.5" />
      <circle cx="17" cy="15" r="2.5" />
      {/* Skid / slip marks */}
      <path d="M6 20 Q7 18 8 20 Q9 22 10 20" strokeWidth={1.4} />
      <path d="M14 20 Q15 18 16 20 Q17 22 18 20" strokeWidth={1.4} />
    </svg>
  )
}

function MapIconIcon({ size = 20, color = 'currentColor' }: IconProps) {
  // ECU map / tune: grid table with a highlighted cell — recognizable "map table"
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
      {/* Table border */}
      <rect x="3" y="3" width="18" height="18" rx="2" />
      {/* Column dividers */}
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      {/* Row dividers */}
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      {/* Highlighted active cell */}
      <rect x="9" y="9" width="6" height="6" fill={color} stroke="none" rx="0.5" />
    </svg>
  )
}

function ExhaustIcon({ size = 20, color = 'currentColor' }: IconProps) {
  // Exhaust: pipe exit with smoke puffs — recognizable EGT / exhaust symbol
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
      {/* Exhaust pipe (horizontal, exit right) */}
      <path d="M2 15 L12 15" />
      <path d="M12 15 Q14 15 14 12 L14 8 Q14 6 16 6 L20 6" />
      {/* Pipe flanges */}
      <line x1="2" y1="13" x2="2" y2="17" />
      {/* Smoke puffs coming out the top */}
      <path d="M17 4 Q18 2 19 4 Q20 6 21 4" strokeWidth={1.5} />
      <path d="M15 2 Q16 0.5 17 2" strokeWidth={1.3} />
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
