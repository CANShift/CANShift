import type { Obd2Pid } from '../schemas/obd2.js'

export interface Obd2Mode01PidEntry {
  pid: Obd2Pid
  signal: string
  label: string
  unit: string
  decode: {
    startByte: number
    byteLength: 1 | 2 | 4
    scale: number
    offset: number
  }
  range: { min: number; max: number }
  description: string
}

export const OBD2_MODE01_PIDS: readonly Obd2Mode01PidEntry[] = [
  {
    pid: 0x05,
    signal: 'coolant_temp_c',
    label: 'Coolant temperature',
    unit: '°C',
    decode: { startByte: 3, byteLength: 1, scale: 1.0, offset: -40.0 },
    range: { min: -40, max: 150 },
    description: 'Engine coolant temperature, °C — A - 40',
  },
  {
    pid: 0x0a,
    signal: 'fuel_press_bar',
    label: 'Fuel pressure',
    unit: 'bar',
    decode: { startByte: 3, byteLength: 1, scale: 0.03, offset: 0.0 },
    range: { min: 0, max: 7.65 },
    description: 'Fuel rail pressure (gauge), bar — (A * 3) kPa converted',
  },
  {
    pid: 0x0b,
    signal: 'map_kpa',
    label: 'Intake manifold pressure',
    unit: 'kPa',
    decode: { startByte: 3, byteLength: 1, scale: 1.0, offset: 0.0 },
    range: { min: 0, max: 255 },
    description: 'Intake manifold absolute pressure, kPa — A',
  },
  {
    pid: 0x0c,
    signal: 'rpm',
    label: 'Engine RPM',
    unit: 'rpm',
    decode: { startByte: 3, byteLength: 2, scale: 0.25, offset: 0.0 },
    range: { min: 0, max: 16383.75 },
    description: 'Engine speed, rpm — (256*A + B) / 4',
  },
  {
    pid: 0x0d,
    signal: 'speed_kph',
    label: 'Vehicle speed',
    unit: 'km/h',
    decode: { startByte: 3, byteLength: 1, scale: 1.0, offset: 0.0 },
    range: { min: 0, max: 255 },
    description: 'Vehicle speed, km/h — A',
  },
  {
    pid: 0x0f,
    signal: 'iat_c',
    label: 'Intake air temperature',
    unit: '°C',
    decode: { startByte: 3, byteLength: 1, scale: 1.0, offset: -40.0 },
    range: { min: -40, max: 215 },
    description: 'Intake air temperature, °C — A - 40',
  },
  {
    pid: 0x10,
    signal: 'maf_gps',
    label: 'Mass air flow',
    unit: 'g/s',
    decode: { startByte: 3, byteLength: 2, scale: 0.01, offset: 0.0 },
    range: { min: 0, max: 655.35 },
    description: 'Mass air flow, g/s — (256*A + B) / 100',
  },
  {
    pid: 0x11,
    signal: 'throttle_pos',
    label: 'Throttle position',
    unit: '%',
    decode: { startByte: 3, byteLength: 1, scale: 100 / 255, offset: 0.0 },
    range: { min: 0, max: 100 },
    description: 'Throttle position, % — A * 100/255',
  },
  {
    pid: 0x1f,
    signal: 'run_time_s',
    label: 'Engine run time',
    unit: 's',
    decode: { startByte: 3, byteLength: 2, scale: 1.0, offset: 0.0 },
    range: { min: 0, max: 65535 },
    description: 'Run time since engine start, seconds — 256*A + B',
  },
  {
    pid: 0x2f,
    signal: 'fuel_level_pct',
    label: 'Fuel tank level',
    unit: '%',
    decode: { startByte: 3, byteLength: 1, scale: 100 / 255, offset: 0.0 },
    range: { min: 0, max: 100 },
    description: 'Fuel tank level input, % — A * 100/255',
  },
  {
    pid: 0x42,
    signal: 'battery_volts',
    label: 'Control module voltage',
    unit: 'V',
    decode: { startByte: 3, byteLength: 2, scale: 0.001, offset: 0.0 },
    range: { min: 0, max: 65.535 },
    description: 'Control module voltage, V — (256*A + B) / 1000',
  },
  {
    pid: 0x5c,
    signal: 'oil_temp_c',
    label: 'Engine oil temperature',
    unit: '°C',
    decode: { startByte: 3, byteLength: 1, scale: 1.0, offset: -40.0 },
    range: { min: -40, max: 210 },
    description: 'Engine oil temperature, °C — A - 40',
  },
] as const

export const obd2PidLookup = (pid: Obd2Pid): Obd2Mode01PidEntry | undefined =>
  OBD2_MODE01_PIDS.find((entry) => entry.pid === pid)
