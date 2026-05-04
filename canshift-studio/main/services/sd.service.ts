// sd.service.ts — SD card volume detection and content preparation
//
// Detects removable volumes on macOS (/Volumes/) and Windows (drive letters).
// Copies sd_contents/ to the selected volume:
//   - fonts/   → always overwrite (app assets, must stay current)
//   - config/  → skip if the file already exists (preserve user customisation)

import { readdir, copyFile, access, mkdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { platform } from 'node:os'
import { app } from 'electron'

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

const MACOS_SYSTEM_VOLUMES = new Set([
  'Macintosh HD',
  'Macintosh HD - Data',
  'Recovery',
  'VM',
  'Preboot',
  'Update',
])

function getSdContentsPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'sd_contents')
  }
  // Dev: app.getAppPath() is canshift-studio/ — go up one level to workspace root
  return join(app.getAppPath(), '../canshift-firmware/sd_contents')
}

async function listVolumes(): Promise<SdVolume[]> {
  const os = platform()

  if (os === 'darwin') {
    try {
      const entries = await readdir('/Volumes')
      return entries
        .filter((e) => !MACOS_SYSTEM_VOLUMES.has(e) && !e.startsWith('.'))
        .map((e) => ({ path: join('/Volumes', e), label: e }))
    } catch {
      return []
    }
  }

  if (os === 'win32') {
    const volumes: SdVolume[] = []
    for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZ') {
      const drivePath = `${letter}:\\`
      try {
        await access(drivePath)
        volumes.push({ path: drivePath, label: `${letter}:` })
      } catch {
        // not accessible — skip
      }
    }
    return volumes
  }

  return []
}

async function collectFiles(srcDir: string): Promise<{ src: string; rel: string }[]> {
  const srcStat = await stat(srcDir).catch(() => null)
  if (!srcStat?.isDirectory()) return []

  const files: { src: string; rel: string }[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else {
        const rel = full.slice(srcDir.length + 1).replace(/\\/g, '/')
        files.push({ src: full, rel })
      }
    }
  }

  await walk(srcDir)
  return files
}

async function prepareSD(volumePath: string): Promise<SdPrepareResult> {
  const srcDir = getSdContentsPath()
  const copied: string[] = []
  const skipped: string[] = []

  try {
    const files = await collectFiles(srcDir)

    for (const { src, rel } of files) {
      const dest = join(volumePath, rel)
      await mkdir(dirname(dest), { recursive: true })

      // Config files are skipped if they already exist (preserve user data).
      // Everything else (fonts) always overwrites to keep assets current.
      if (rel.startsWith('config/')) {
        try {
          await access(dest)
          skipped.push(rel)
          continue
        } catch {
          // file absent — fall through to copy
        }
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

export const sdService = { listVolumes, prepareSD }
