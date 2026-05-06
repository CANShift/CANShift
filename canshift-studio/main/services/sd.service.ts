import { readdir, copyFile, access, mkdir, readFile } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { platform } from 'node:os'
import { app } from 'electron'
import type { UsbService } from './usb.service'

export interface SdVolume {
  path: string
  label: string
}

export interface SdPrepareResult {
  success: boolean
  copied: string[]
  skipped: string[]
  error?: string
}

export interface SdPushProgress {
  fileIndex: number
  totalFiles: number
  relPath: string
}

export type SdPushProgressCallback = (progress: SdPushProgress) => void

// Files under config/ belong to the user (dashboard, signals). Never overwrite.
// Everything else (fonts, assets) is app-managed and always refreshed.
function isUserData(relativePath: string): boolean {
  return relativePath.startsWith('config/')
}

async function fileExists(filePath: string): Promise<boolean> {
  return access(filePath)
    .then(() => true)
    .catch(() => false)
}

function toUnixRelativePath(from: string, to: string): string {
  return relative(from, to).replace(/\\/g, '/')
}

// sd_contents/ lives next to the firmware project in dev, bundled in resources when packaged.
function sdContentsPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'sd_contents')
    : join(app.getAppPath(), '../canshift-firmware/sd_contents')
}

async function walkDirectory(
  dir: string,
  baseDir: string
): Promise<{ src: string; rel: string }[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const results: { src: string; rel: string }[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await walkDirectory(fullPath, baseDir)))
    } else {
      results.push({ src: fullPath, rel: toUnixRelativePath(baseDir, fullPath) })
    }
  }

  return results
}

const MACOS_SYSTEM_VOLUMES = new Set([
  'Macintosh HD',
  'Macintosh HD - Data',
  'Recovery',
  'VM',
  'Preboot',
  'Update',
])

async function listMacOsVolumes(): Promise<SdVolume[]> {
  const entries = await readdir('/Volumes')
  return entries
    .filter((name) => !MACOS_SYSTEM_VOLUMES.has(name) && !name.startsWith('.'))
    .map((name) => ({ path: join('/Volumes', name), label: name }))
}

async function listWindowsVolumes(): Promise<SdVolume[]> {
  const volumes: SdVolume[] = []
  for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZ') {
    const drivePath = `${letter}:\\`
    if (await fileExists(drivePath)) {
      volumes.push({ path: drivePath, label: `${letter}:` })
    }
  }
  return volumes
}

async function listVolumes(): Promise<SdVolume[]> {
  try {
    if (platform() === 'darwin') return await listMacOsVolumes()
    if (platform() === 'win32') return await listWindowsVolumes()
    return []
  } catch {
    return []
  }
}

// `forceRefresh` overrides the user-data preservation rule: every file under
// sd_contents/, including config/, is overwritten. Used during firmware
// development when a new dashboard.json schema needs to land on existing SDs.
async function prepareSD(volumePath: string, forceRefresh = false): Promise<SdPrepareResult> {
  const copied: string[] = []
  const skipped: string[] = []

  try {
    const files = await walkDirectory(sdContentsPath(), sdContentsPath())

    for (const { src, rel } of files) {
      const dest = join(volumePath, rel)
      await mkdir(dirname(dest), { recursive: true })

      if (!forceRefresh && isUserData(rel) && (await fileExists(dest))) {
        skipped.push(rel)
        continue
      }

      await copyFile(src, dest)
      copied.push(rel)
    }

    return { success: true, copied, skipped }
  } catch (err) {
    return {
      success: false,
      copied,
      skipped,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---------------------------------------------------------------------------
// Push sd_contents/ to a connected board over USB (no card removal)
// ---------------------------------------------------------------------------

/**
 * Stream every file under sd_contents/ to the connected board's SD card.
 * /config/* is intentionally excluded — those are user data managed by other
 * flows (CMD_PUT_CONFIG / dashboard editor). Use the mounted-volume Prepare
 * SD path for first-time setup that needs to seed default config.
 */
async function pushOverUsb(
  usbService: UsbService,
  onProgress?: SdPushProgressCallback
): Promise<SdPrepareResult> {
  const copied: string[] = []
  const skipped: string[] = []

  try {
    const files = await walkDirectory(sdContentsPath(), sdContentsPath())
    const pushable = files.filter(({ rel }) => !isUserData(rel))
    skipped.push(...files.filter(({ rel }) => isUserData(rel)).map((f) => f.rel))

    for (let i = 0; i < pushable.length; i++) {
      const entry = pushable[i]
      if (!entry) continue
      const { src, rel } = entry
      onProgress?.({ fileIndex: i, totalFiles: pushable.length, relPath: rel })

      const content = await readFile(src)
      const result = await usbService.pushFile('/' + rel, content)
      if (!result.success) {
        return {
          success: false,
          copied,
          skipped,
          error: result.error ?? `Failed to push ${rel}`,
        }
      }
      copied.push(rel)
    }

    return { success: true, copied, skipped }
  } catch (err) {
    return {
      success: false,
      copied,
      skipped,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export const sdService = { listVolumes, prepareSD, pushOverUsb }
