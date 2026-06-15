export const CMD_GET_CONFIG = 0x01
export const CMD_PUSH_CONFIG = 0x02
export const CMD_GET_DEVICE_CONFIG = 0x03
export const CMD_PUT_DEVICE_CONFIG = 0x04
export const CMD_SCREEN_SETTINGS = 0x05
export const CMD_TOGGLE_DAY_NIGHT = 0x07
export const CMD_CALIBRATE_TOUCH = 0x08
export const CMD_SET_DAY_NIGHT = 0x09
export const CMD_GET_INPUT_BINDINGS = 0x0b
export const CMD_PUT_INPUT_BINDINGS = 0x0c
export const CMD_QUERY_VERSION = 0x10
export const CMD_PING = 0x11
export const CMD_CAN_SCAN_START = 0x20
export const CMD_CAN_SCAN_STOP = 0x21
export const CMD_OTA_BEGIN = 0x30
export const CMD_OTA_WRITE = 0x31
export const CMD_OTA_END = 0x32
export const CMD_REBOOT = 0xf0

export interface KnownOpcode {
  id: number
  name: string
  description: string
}

export const KNOWN_OPCODES: readonly KnownOpcode[] = [
  { id: CMD_GET_CONFIG, name: 'CMD_GET_CONFIG', description: 'Read dashboard JSON from device' },
  { id: CMD_PUSH_CONFIG, name: 'CMD_PUSH_CONFIG', description: 'Write dashboard JSON (reboots)' },
  {
    id: CMD_GET_DEVICE_CONFIG,
    name: 'CMD_GET_DEVICE_CONFIG',
    description: 'Read hardware device config',
  },
  {
    id: CMD_PUT_DEVICE_CONFIG,
    name: 'CMD_PUT_DEVICE_CONFIG',
    description: 'Write hardware device config',
  },
  { id: CMD_SCREEN_SETTINGS, name: 'CMD_SCREEN_SETTINGS', description: 'Brightness, rotation' },
  {
    id: CMD_TOGGLE_DAY_NIGHT,
    name: 'CMD_TOGGLE_DAY_NIGHT',
    description: 'Flip day/night theme',
  },
  { id: CMD_CALIBRATE_TOUCH, name: 'CMD_CALIBRATE_TOUCH', description: 'Enter touch calibration' },
  {
    id: CMD_SET_DAY_NIGHT,
    name: 'CMD_SET_DAY_NIGHT',
    description: 'Set day/night theme — payload { day: boolean }',
  },
  {
    id: CMD_GET_INPUT_BINDINGS,
    name: 'CMD_GET_INPUT_BINDINGS',
    description: 'Read input bindings',
  },
  {
    id: CMD_PUT_INPUT_BINDINGS,
    name: 'CMD_PUT_INPUT_BINDINGS',
    description: 'Write input bindings',
  },
  {
    id: CMD_QUERY_VERSION,
    name: 'CMD_QUERY_VERSION',
    description: 'Firmware version handshake',
  },
  { id: CMD_PING, name: 'CMD_PING', description: 'Liveness probe — replies with uptime_ms' },
  { id: CMD_CAN_SCAN_START, name: 'CMD_CAN_SCAN_START', description: 'Start CAN scan' },
  { id: CMD_CAN_SCAN_STOP, name: 'CMD_CAN_SCAN_STOP', description: 'Stop CAN scan' },
  { id: CMD_REBOOT, name: 'CMD_REBOOT', description: 'Reboot the dash' },
]
