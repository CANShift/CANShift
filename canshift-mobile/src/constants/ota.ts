// ota.ts — WiFi OTA endpoint shape + GitHub release source.
// Must stay in sync with:
//   canshift-firmware/src/hal/wifi/wifi_ap.cpp  (HTTP routes, multipart shape)
//   canshift-firmware/include/app_config.h      (BLE_WIFI_AP_PASSWORD)
//
// All values are firmware-authoritative — change here only when the firmware
// changes.

// ---------------------------------------------------------------------------
// ESP32 softAP (firmware: wifi_ap.cpp → WiFi.softAP / softAPIP)
// ---------------------------------------------------------------------------

/** Default IP of the ESP32 softAP. */
export const ESP32_AP_IP = '192.168.4.1' as const

/** softAP shared password — `BLE_WIFI_AP_PASSWORD` in firmware app_config.h. */
export const ESP32_AP_PASSWORD = 'canshift' as const

/**
 * Static SSID prefix; firmware appends the last 2 MAC bytes (uppercase hex)
 * to produce e.g. `CANShift-AB12`.
 */
export const ESP32_AP_SSID_PREFIX = 'CANShift-' as const

// ---------------------------------------------------------------------------
// HTTP OTA endpoints exposed by the firmware while the AP is up
// ---------------------------------------------------------------------------

/** Base URL of the firmware HTTP server (port 80, hard-coded in firmware). */
export const ESP32_OTA_BASE_URL = `http://${ESP32_AP_IP}` as const

/** Firmware route: GET → `{status, ver}` JSON. */
export const ESP32_OTA_STATUS_PATH = '/status' as const

/** Firmware route: POST multipart upload → applies new firmware then reboots. */
export const ESP32_OTA_PATH = '/ota' as const

/** Full URL the mobile app POSTs the firmware binary to. */
export const ESP32_OTA_URL = `${ESP32_OTA_BASE_URL}${ESP32_OTA_PATH}` as const

// ---------------------------------------------------------------------------
// Multipart upload payload shape (POST /ota)
// Firmware reads the first uploaded file via `s_server.upload()` regardless of
// field name, but we keep the names stable so curl-equivalent debugging works.
// ---------------------------------------------------------------------------

/** Form-data field name carrying the firmware binary. */
export const OTA_UPLOAD_FIELD_NAME = 'firmware' as const

/** Filename advertised in the multipart payload. */
export const OTA_UPLOAD_FILE_NAME = 'firmware.bin' as const

/** MIME type advertised in the multipart payload. */
export const OTA_UPLOAD_MIME_TYPE = 'application/octet-stream' as const

// ---------------------------------------------------------------------------
// GitHub release source — where firmware binaries are downloaded from
// ---------------------------------------------------------------------------

/** GitHub REST endpoint listing CANShift firmware releases. */
export const GITHUB_RELEASES_API =
  'https://api.github.com/repos/tburkhalterr/CANShift/releases' as const

/** Page size used when listing releases. */
export const GITHUB_RELEASES_PER_PAGE = 10 as const
