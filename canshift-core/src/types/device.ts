export type CanSpeedKbps = 125 | 250 | 500 | 1000

export interface DeviceConfig {
  /** CAN bus speed in kbps — must match ECU output configuration */
  can_speed_kbps: CanSpeedKbps
  /** ESP32 TWAI TX GPIO pin */
  twai_tx_pin: number
  /** ESP32 TWAI RX GPIO pin */
  twai_rx_pin: number
}

export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  can_speed_kbps: 500,
  twai_tx_pin: 22,
  twai_rx_pin: 21,
}

export const CAN_SPEED_OPTIONS: CanSpeedKbps[] = [125, 250, 500, 1000]
