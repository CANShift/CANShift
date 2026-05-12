// ble.ts — BLE UUIDs and telemetry key mapping.
// Must stay in sync with canshift-firmware/src/hal/ble/ble_server.cpp
// (UUID constants and `NimBLEDevice::init("CANShift")`).
//
// All UUID values are firmware-authoritative — change here only when the
// firmware changes.

// ---------------------------------------------------------------------------
// GATT service + characteristics (vendor prefix `4fa0b6a0-*`)
// ---------------------------------------------------------------------------

/** Primary GATT service exposed by the dashboard. */
export const BLE_SERVICE_UUID = '4fa0b6a0-0000-0000-0000-000000000001' as const

/** Notify — live telemetry JSON pushed at ~10 Hz. */
export const BLE_CHAR_TELE = '4fa0b6a0-0000-0000-0000-000000000002' as const

/** Read + notify — firmware version, CAN health, day/night, AP SSID. */
export const BLE_CHAR_STATUS = '4fa0b6a0-0000-0000-0000-000000000003' as const

/** Read + write — screen settings JSON (brightness, sleep). */
export const BLE_CHAR_SETTINGS = '4fa0b6a0-0000-0000-0000-000000000004' as const

/** Write — command JSON (start_wifi_ap, set_day_night, start_calibration, …). */
export const BLE_CHAR_CMD = '4fa0b6a0-0000-0000-0000-000000000005' as const

/** Advertised local name set by `NimBLEDevice::init("CANShift")`. */
export const BLE_DEVICE_NAME = 'CANShift' as const

// Compact telemetry key → human-readable label + unit
// Keys match firmware ble_server.cpp addSignalIfValid() calls
export interface SignalMeta {
  label: string
  unit: string
  decimals: number
}

export const SIGNAL_META: Record<string, SignalMeta> = {
  r: { label: 'RPM', unit: '', decimals: 0 },
  tps: { label: 'Throttle', unit: '%', decimals: 0 },
  map: { label: 'MAP', unit: 'kPa', decimals: 0 },
  bst: { label: 'Boost', unit: 'bar', decimals: 2 },
  iat: { label: 'Intake Air', unit: '°C', decimals: 0 },
  ct: { label: 'Coolant', unit: '°C', decimals: 0 },
  ot: { label: 'Oil Temp', unit: '°C', decimals: 0 },
  op: { label: 'Oil Pressure', unit: 'bar', decimals: 1 },
  fp: { label: 'Fuel Press.', unit: 'bar', decimals: 1 },
  lam: { label: 'Lambda', unit: 'λ', decimals: 2 },
  s: { label: 'Speed', unit: 'kph', decimals: 0 },
  g: { label: 'Gear', unit: '', decimals: 0 },
  bat: { label: 'Battery', unit: 'V', decimals: 1 },
}
