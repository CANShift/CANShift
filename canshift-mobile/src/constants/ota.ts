export const ESP32_AP_IP = '192.168.4.1' as const

export const ESP32_AP_SSID_PREFIX = 'CANShift-' as const

export const ESP32_OTA_BASE_URL = `http://${ESP32_AP_IP}` as const

export const ESP32_OTA_STATUS_PATH = '/status' as const

export const ESP32_OTA_PATH = '/ota' as const

export const ESP32_OTA_URL = `${ESP32_OTA_BASE_URL}${ESP32_OTA_PATH}` as const

export const OTA_UPLOAD_FIELD_NAME = 'firmware' as const

export const OTA_UPLOAD_FILE_NAME = 'firmware.bin' as const

export const OTA_UPLOAD_MIME_TYPE = 'application/octet-stream' as const

export const GITHUB_RELEASES_API =
  'https://api.github.com/repos/tburkhalterr/CANShift/releases' as const

export const GITHUB_RELEASES_PER_PAGE = 10 as const

export const RELEASE_OTA_ASSET_SUFFIX = '-firmware.bin' as const

export const RELEASE_MERGED_ASSET_SUFFIX = '-merged.bin' as const
