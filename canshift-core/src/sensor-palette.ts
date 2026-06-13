import { HexColorSchema } from './schemas/common.js'
import type { HexColor } from './schemas/common.js'
import type { SensorIconName } from './schemas/dashboard.js'
import type { SignalType } from './schemas/signal-type.js'

export interface SensorPaletteEntry {
  ok: HexColor
  warning?: HexColor
}

const hex = (value: string): HexColor => HexColorSchema.parse(value)

const RED = hex('#CC3333')
const AMBER = hex('#FFA000')

export const SENSOR_PALETTE: Record<SensorIconName, SensorPaletteEntry> = {
  coolant: { ok: hex('#1E88E5'), warning: RED },
  oil_temp: { ok: hex('#F5A623'), warning: RED },
  oil_pressure: { ok: hex('#4CAF50'), warning: RED },
  boost: { ok: hex('#8E24AA'), warning: RED },
  turbo: { ok: hex('#8E24AA'), warning: RED },
  battery: { ok: hex('#FBC02D'), warning: RED },
  fuel: { ok: hex('#4CAF50'), warning: AMBER },
  afr: { ok: hex('#C2185B'), warning: RED },
  rpm: { ok: hex('#00ACC1'), warning: RED },
  throttle: { ok: hex('#FB8C00') },
  speed: { ok: hex('#ECEFF1') },
  iat: { ok: hex('#4FC3F7'), warning: RED },
  exhaust: { ok: hex('#FB8C00'), warning: RED },
  gear: { ok: hex('#ECEFF1') },
  timer: { ok: hex('#ECEFF1') },
  warning: { ok: RED },
  flame: { ok: hex('#FF6F00'), warning: RED },
  engine: { ok: hex('#4CAF50'), warning: RED },
  brake: { ok: RED },
  launch: { ok: hex('#43A047') },
  traction: { ok: hex('#43A047') },
  map_icon: { ok: hex('#42A5F5') },
  cog: { ok: hex('#9E9E9E') },
}

export const sensorOkColor = (iconName: SensorIconName | undefined): HexColor | undefined =>
  iconName ? SENSOR_PALETTE[iconName].ok : undefined

export const sensorWarningColor = (iconName: SensorIconName | undefined): HexColor | undefined =>
  iconName ? SENSOR_PALETTE[iconName].warning : undefined

const paletteEntry = (type: SignalType | undefined): SensorPaletteEntry | undefined => {
  if (!type || type === 'generic' || !(type in SENSOR_PALETTE)) return undefined
  return SENSOR_PALETTE[type as SensorIconName]
}

export const signalTypeOkColor = (type: SignalType | undefined): HexColor | undefined =>
  paletteEntry(type)?.ok

export const signalTypeWarningColor = (type: SignalType | undefined): HexColor | undefined =>
  paletteEntry(type)?.warning
