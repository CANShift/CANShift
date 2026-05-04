// ble.ts — BLE UUIDs and telemetry key mapping
// Must stay in sync with canshift-firmware/src/hal/ble/ble_server.cpp

export const BLE_SERVICE_UUID   = '4fa0b6a0-0000-0000-0000-000000000001'
export const BLE_CHAR_TELE      = '4fa0b6a0-0000-0000-0000-000000000002'
export const BLE_CHAR_STATUS    = '4fa0b6a0-0000-0000-0000-000000000003'
export const BLE_CHAR_SETTINGS  = '4fa0b6a0-0000-0000-0000-000000000004'
export const BLE_CHAR_CMD       = '4fa0b6a0-0000-0000-0000-000000000005'

export const BLE_DEVICE_NAME = 'CANShift'

// Compact telemetry key → human-readable label + unit
// Keys match firmware ble_server.cpp addSignalIfValid() calls
export interface SignalMeta {
  label: string
  unit: string
  decimals: number
}

export const SIGNAL_META: Record<string, SignalMeta> = {
  r:   { label: 'RPM',          unit: '',    decimals: 0 },
  tps: { label: 'Throttle',     unit: '%',   decimals: 0 },
  map: { label: 'MAP',          unit: 'kPa', decimals: 0 },
  bst: { label: 'Boost',        unit: 'bar', decimals: 2 },
  iat: { label: 'Intake Air',   unit: '°C',  decimals: 0 },
  ct:  { label: 'Coolant',      unit: '°C',  decimals: 0 },
  ot:  { label: 'Oil Temp',     unit: '°C',  decimals: 0 },
  op:  { label: 'Oil Pressure', unit: 'bar', decimals: 1 },
  fp:  { label: 'Fuel Press.',  unit: 'bar', decimals: 1 },
  lam: { label: 'Lambda',       unit: 'λ',   decimals: 2 },
  s:   { label: 'Speed',        unit: 'kph', decimals: 0 },
  g:   { label: 'Gear',         unit: '',    decimals: 0 },
  bat: { label: 'Battery',      unit: 'V',   decimals: 1 },
}
