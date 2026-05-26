// ecu-profiles/obd2-mode01-pids.ts — Standard SAE J1979 Mode 01 PID catalog.
//
// Drives the Studio OBD-II signal editor PID picker (issue #841). Each entry
// captures everything the editor needs to turn "I want RPM" into a valid
// polling block + a sensible default decode (startByte/byteLength/scale/offset
// for the response payload). The firmware does not import this — it ships
// only the polling tick state machine + a generic response decoder that
// reuses the existing SignalDef byte layout.
//
// Catalog scope: the everyday PIDs a tuner / racer would actually wire to a
// dash widget. Exhaustive J1979 coverage is intentionally out of scope —
// PIDs not on this list can still be entered manually via raw PID + decode
// fields. v1 = Mode 01 only.

import type { Obd2Pid } from '../schemas/obd2.js'

/** OBD-II functional request frame ID (broadcast query). */
export const OBD2_REQUEST_FRAME_ID = 0x7df

/** OBD-II response frame ID for a single ECU (ECM at 0x7E8). Multi-ECU
 *  vehicles emit additional responses at 0x7E9..0x7EF — deferred from v1
 *  scope per the umbrella (#556). */
export const OBD2_RESPONSE_FRAME_ID = 0x7e8

/**
 * Catalog entry — describes one J1979 Mode 01 PID.
 *
 * `decode` fields target the raw response payload. The standard J1979 layout
 * is `[length] [mode+0x40] [pid] A B C D` — so A lives at byte index 3 on the
 * received frame and a single-byte PID like coolant temp uses
 * `{ startByte: 3, byteLength: 1, scale: 1.0, offset: -40 }`.
 */
export interface Obd2Mode01PidEntry {
  /** PID byte the dash queries for. */
  pid: Obd2Pid
  /** Stable signal name (matches SignalIds in firmware signal_map). */
  signal: string
  /** Human-readable label for the editor picker. */
  label: string
  /** Display unit — copied into `SignalDef.unit` when the user picks this PID. */
  unit: string
  /** Default decode hint for the response payload. */
  decode: {
    /** Byte offset into the response frame (J1979 puts A at byte 3). */
    startByte: number
    /** 1, 2, or 4 — matches SignalDef.byteLength. */
    byteLength: 1 | 2 | 4
    /** Physical = raw * scale + offset. */
    scale: number
    offset: number
  }
  /** Sensible defaults for the SignalDef numeric range. */
  range: { min: number; max: number }
  /** Short explanation for the editor hint text. */
  description: string
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
//
// Sourced from SAE J1979 Mode 01 PID definitions. The formula column on the
// SAE reference table maps to `decode.scale` / `decode.offset` directly:
//   - RPM  (PID 0x0C): A*256+B / 4  → 2 bytes, scale 0.25
//   - Speed (PID 0x0D): A           → 1 byte,  scale 1.0
//   - Coolant (PID 0x05): A - 40    → 1 byte,  scale 1.0, offset -40
//   - Throttle (PID 0x11): A * 100/255 → 1 byte
//   - IAT (PID 0x0F): A - 40        → 1 byte,  offset -40
//   - MAF (PID 0x10): (256*A+B)/100 → 2 bytes, scale 0.01
//   - MAP (PID 0x0B): A             → 1 byte (kPa absolute)
//   - Battery (PID 0x42): (256*A+B)/1000 → 2 bytes, scale 0.001 (V control module)
//   - Fuel level (PID 0x2F): A * 100/255 → 1 byte
//   - Fuel pressure (PID 0x0A): A * 3 → 1 byte (kPa, gauge)
//   - Run time (PID 0x1F): 256*A+B → 2 bytes, seconds
//
// Keep ordered by PID hex so the editor dropdown is predictable.
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
    // J1979 unit is kPa gauge (A * 3). Convert to bar via scale 0.03.
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

// ---------------------------------------------------------------------------
// Lookup helper — exposed as a function so adding/removing PIDs doesn't
// require regenerating a Map at module load time when consumers only ever
// look up one entry (the studio editor's onChange handler).
// ---------------------------------------------------------------------------
export function obd2PidLookup(pid: Obd2Pid): Obd2Mode01PidEntry | undefined {
  return OBD2_MODE01_PIDS.find((entry) => entry.pid === pid)
}
