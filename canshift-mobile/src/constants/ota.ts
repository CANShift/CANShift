// ota.ts — WiFi OTA endpoint shape + GitHub release source.
// Must stay in sync with:
//   canshift-firmware/src/hal/wifi/wifi_ap.cpp  (HTTP routes, multipart shape)
//
// All values are firmware-authoritative — change here only when the firmware
// changes.
//
// The softAP password is NOT hardcoded here: it ships from the firmware via
// the BLE STATUS payload (`ap_password`). Dashboards running firmware older
// than v0.8.x do not advertise it and must be updated once via the desktop
// app before wireless OTA becomes available.

// ---------------------------------------------------------------------------
// ESP32 softAP (firmware: wifi_ap.cpp → WiFi.softAP / softAPIP)
// ---------------------------------------------------------------------------

/** Default IP of the ESP32 softAP. */
export const ESP32_AP_IP = '192.168.4.1' as const

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

/**
 * Suffix of the GitHub release asset that holds the firmware-partition image
 * (the only file `Update.write` on the ESP32 will accept). Released alongside
 * a `-merged.bin` (USB esptool factory image) and a `-spiffs.bin` (data
 * partition) which OTA must NOT consume — pushing those would brick the dash.
 */
export const RELEASE_OTA_ASSET_SUFFIX = '-firmware.bin' as const

/** Suffix of the merged factory image — USB esptool flashing only. */
export const RELEASE_MERGED_ASSET_SUFFIX = '-merged.bin' as const
