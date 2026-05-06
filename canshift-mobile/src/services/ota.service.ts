// ota.service.ts — Firmware release download + WiFi OTA push

import * as FileSystem from 'expo-file-system'

const GITHUB_API = 'https://api.github.com/repos/tburkhalterr/CANShift/releases'
const ESP32_OTA_URL = 'http://192.168.4.1/ota' // ESP32 softAP default IP

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FirmwareRelease {
  version: string
  publishedAt: string
  notes: string
  downloadUrl: string
  sizeBytes: number
}

// ---------------------------------------------------------------------------
// GitHub release fetch
// ---------------------------------------------------------------------------

export async function fetchReleases(): Promise<FirmwareRelease[]> {
  const response = await fetch(`${GITHUB_API}?per_page=10`)
  if (!response.ok) throw new Error(`GitHub API error: ${String(response.status)}`)

  const data = (await response.json()) as {
    tag_name: string
    published_at: string
    body: string
    assets: { name: string; browser_download_url: string; size: number }[]
    draft: boolean
    prerelease: boolean
  }[]

  return data
    .filter((r) => !r.draft && !r.prerelease)
    .map((r) => {
      const asset = r.assets.find((a) => a.name.endsWith('.bin'))
      return {
        version: r.tag_name.replace(/^v/, ''),
        publishedAt: r.published_at,
        notes: r.body,
        downloadUrl: asset?.browser_download_url ?? '',
        sizeBytes: asset?.size ?? 0,
      }
    })
    .filter((r) => r.downloadUrl !== '')
}

// ---------------------------------------------------------------------------
// Download firmware binary (over cellular / current network)
// ---------------------------------------------------------------------------

export async function downloadFirmware(
  release: FirmwareRelease,
  onProgress?: (progress: number) => void
): Promise<string> {
  const dest = `${FileSystem.cacheDirectory ?? ''}canshift-${release.version}.bin`

  // Check if already cached
  const info = await FileSystem.getInfoAsync(dest)
  if (info.exists && info.size === release.sizeBytes) {
    onProgress?.(1)
    return dest
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    release.downloadUrl,
    dest,
    {},
    (downloadProgress) => {
      const progress =
        downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
      onProgress?.(progress)
    }
  )

  const result = await downloadResumable.downloadAsync()
  if (!result?.uri) throw new Error('Download failed')
  return result.uri
}

// ---------------------------------------------------------------------------
// Push firmware to ESP32 over WiFi AP
// The device must be in WiFi AP mode (triggered via BLE CMD start_wifi_ap).
// Phone must be connected to the CANShift-XXXX WiFi network.
// ---------------------------------------------------------------------------

export async function pushFirmware(
  localPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const formData = new FormData()
  formData.append('firmware', {
    uri: localPath,
    type: 'application/octet-stream',
    name: 'firmware.bin',
  } as unknown as Blob)

  const xhr = new XMLHttpRequest()
  await new Promise<void>((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`OTA failed: HTTP ${String(xhr.status)}`))
      }
    }
    xhr.onerror = () => { reject(new Error('OTA network error')); }
    xhr.open('POST', ESP32_OTA_URL)
    xhr.send(formData)
  })
}
