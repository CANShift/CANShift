// ipc-handlers.ts — Register all IPC handlers for the main process

import { ipcMain, app, BrowserWindow, dialog, net } from 'electron'
import { writeFile, readdir, unlink, copyFile, mkdir, access } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { spawn } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { IpcChannels } from './ipc-channels'
import { ConfigFileService } from '../services/config-file.service'
import { UsbService } from '../services/usb.service'
import { checkForUpdates, installUpdate } from '../services/updater.service'
import { firmwareService } from '../services/firmware.service'
import { sessionService } from '../services/session.service'
import type { FirmwareRelease } from '../services/firmware.service'
import type { CanFrame } from '../services/usb.service'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  const configService = new ConfigFileService()
  const usbService = new UsbService()

  // Batch CAN frames: accumulate for 100ms then push to renderer in one IPC call.
  // Avoids per-frame IPC overhead on busy CAN buses.
  let canFrameBatch: CanFrame[] = []
  const flushCanBatch = (): void => {
    if (canFrameBatch.length === 0) return
    getWindow()?.webContents.send(IpcChannels.CAN_FRAME_BATCH, canFrameBatch)
    canFrameBatch = []
  }
  setInterval(flushCanBatch, 100)

  // Wire USB device events to the renderer window
  usbService.setEventHandlers({
    onConnectionChanged: (status) => {
      getWindow()?.webContents.send(IpcChannels.USB_CONNECTION_CHANGED, status)
    },
    onError: (message) => {
      getWindow()?.webContents.send(IpcChannels.USB_ERROR, message)
    },
    onTelemetry: (values) => {
      getWindow()?.webContents.send(IpcChannels.USB_DATA_RECEIVED, values)
    },
    onCanFrame: (frame) => {
      canFrameBatch.push(frame)
    },
    onCanHealth: (health) => {
      getWindow()?.webContents.send(IpcChannels.CAN_HEALTH_UPDATE, health)
    },
  })

  // ---------------------------------------------------------------------------
  // Config file operations
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.CONFIG_OPEN, async () => {
    const result = await configService.openFile()
    if (result.success && result.filePath) sessionService.setLastFilePath(result.filePath)
    return result
  })

  ipcMain.handle(IpcChannels.CONFIG_OPEN_PATH, async (_event, filePath: string) => {
    const result = await configService.openFilePath(filePath)
    if (result.success && result.filePath) sessionService.setLastFilePath(result.filePath)
    return result
  })

  ipcMain.handle(IpcChannels.CONFIG_SAVE, async (_event, config: unknown) => {
    const result = await configService.saveFile(config)
    if (result.success && result.filePath) sessionService.setLastFilePath(result.filePath)
    return result
  })

  ipcMain.handle(IpcChannels.CONFIG_SAVE_AS, async (_event, config: unknown) => {
    const result = await configService.saveFileAs(config)
    if (result.success && result.filePath) sessionService.setLastFilePath(result.filePath)
    return result
  })

  ipcMain.handle(IpcChannels.SESSION_GET_LAST_FILE, () => {
    return sessionService.getLastFilePath()
  })

  // ---------------------------------------------------------------------------
  // USB operations
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.USB_LIST_PORTS, async () => {
    return usbService.listPorts()
  })

  ipcMain.handle(IpcChannels.USB_CONNECT, async (_event, portPath: string) => {
    return usbService.connect(portPath)
  })

  ipcMain.handle(IpcChannels.USB_DISCONNECT, async () => {
    return usbService.disconnect()
  })

  ipcMain.handle(IpcChannels.USB_PUSH_CONFIG, async (_event, config: unknown) => {
    return usbService.pushConfig(config)
  })

  ipcMain.handle(IpcChannels.USB_SCREEN_SETTINGS, async (_event, settings: unknown) => {
    return usbService.pushScreenSettings(
      settings as { brightness: number; contrast: number; sleep: number; rotation: number }
    )
  })

  ipcMain.handle(IpcChannels.USB_GET_STATUS, () => {
    return usbService.getStatus()
  })

  ipcMain.handle(IpcChannels.USB_REBOOT, async () => {
    return usbService.rebootDevice()
  })

  // ---------------------------------------------------------------------------
  // CAN scanner
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.CAN_SCAN_START, async () => {
    return usbService.startCanScan()
  })

  ipcMain.handle(IpcChannels.CAN_SCAN_STOP, async () => {
    return usbService.stopCanScan()
  })

  // ---------------------------------------------------------------------------
  // Firmware management
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.FIRMWARE_QUERY_VERSION, async () => {
    return usbService.queryVersion()
  })

  ipcMain.handle(IpcChannels.FIRMWARE_LIST_RELEASES, async (_event, channel: 'stable' | 'beta') => {
    const releases: FirmwareRelease[] = await firmwareService.listReleases(channel)
    return releases
  })

  ipcMain.handle(IpcChannels.FIRMWARE_ENTER_FLASH, async (_event, portPath: string) => {
    // Disconnect the Node.js serial port so the renderer can use Web Serial API on the same port
    await usbService.disconnect()
    firmwareService.setFlashPort(portPath)
    return { success: true }
  })

  ipcMain.handle(IpcChannels.FIRMWARE_EXIT_FLASH, () => {
    firmwareService.setFlashPort(null)
    return { success: true }
  })

  // ---------------------------------------------------------------------------
  // USB firmware flash via esptool
  //
  // Resolves esptool from PlatformIO's bundled copy or system PATH.
  // Disconnects USB serial before flashing and reconnects after.
  // Progress events are sent as { pct: number } via FIRMWARE_PROGRESS.
  // ---------------------------------------------------------------------------

  async function findEsptool(): Promise<{ cmd: string; args: string[] } | null> {
    // PlatformIO bundles esptool.py — check the standard install path first
    const platformioPath = join(
      homedir(),
      '.platformio',
      'packages',
      'tool-esptoolpy',
      'esptool.py'
    )
    try {
      await access(platformioPath)
      return { cmd: 'python3', args: [platformioPath] }
    } catch {
      // Not found — try system PATH variants
      for (const candidate of ['esptool.py', 'esptool']) {
        try {
          // spawn a --version probe to check if the command exists
          await new Promise<void>((resolve, reject) => {
            const probe = spawn(candidate, ['version'], { stdio: 'ignore' })
            probe.on('close', (code) => {
              if (code === 0) resolve()
              else reject(new Error(`exit code ${String(code)}`))
            })
            probe.on('error', (err) => {
              reject(err)
            })
          })
          return { cmd: candidate, args: [] }
        } catch {
          // try next
        }
      }
    }
    return null
  }

  // Shared helper — run esptool against a local .bin file and stream progress events.
  async function runEsptoolFlash(
    portPath: string,
    filePath: string
  ): Promise<{ success: boolean; error?: string }> {
    const win = getWindow()

    const tool = await findEsptool()
    if (!tool) {
      return {
        success: false,
        error:
          'esptool not found. Install PlatformIO or run: pip install esptool. ' +
          'PlatformIO path checked: ~/.platformio/packages/tool-esptoolpy/esptool.py',
      }
    }

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const args = [
        ...tool.args,
        '--chip',
        'esp32',
        '--port',
        portPath,
        '--baud',
        '460800',
        'write_flash',
        '--flash_mode',
        'dio',
        '--flash_freq',
        '40m',
        '--flash_size',
        'detect',
        '0x10000',
        filePath,
      ]

      const proc = spawn(tool.cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      const progressRe = /\((\d+)\s*%\)/
      let stdout = ''
      let stderr = ''

      const onLine = (line: string): void => {
        const m = progressRe.exec(line)
        if (m) {
          const pct = parseInt(m[1] ?? '0', 10)
          win?.webContents.send(IpcChannels.FIRMWARE_PROGRESS, { pct })
        }
      }

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
        for (const line of stdout.split('\n')) onLine(line)
      })

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
        for (const line of stderr.split('\n')) onLine(line)
      })

      proc.on('close', (code) => {
        if (code === 0) {
          win?.webContents.send(IpcChannels.FIRMWARE_PROGRESS, { pct: 100 })
          resolve({ success: true })
        } else {
          const errLine =
            stderr.split('\n').find((l) => l.includes('error') || l.includes('Error')) ??
            'Flash failed'
          resolve({ success: false, error: errLine.trim() })
        }
      })

      proc.on('error', (err: Error) => {
        resolve({ success: false, error: err.message })
      })
    })
  }

  ipcMain.handle(
    IpcChannels.FIRMWARE_UPDATE_USB,
    async (_event, portPath: string, filePath: string) => {
      // Disconnect serial — esptool needs exclusive port access
      await usbService.disconnect()
      return runEsptoolFlash(portPath, filePath)
    }
  )

  // ---------------------------------------------------------------------------
  // Download latest firmware release from GitHub and flash via esptool.
  //
  // Steps:
  //   1. Fetch release list (stable or beta channel)
  //   2. Download the .bin asset to a temp file
  //   3. Disconnect serial and run esptool — same flow as FIRMWARE_UPDATE_USB
  //
  // Progress events: { pct: number, phase: 'downloading' | 'flashing' }
  // pct 0–100 for download, then 0–100 again for flash.
  // ---------------------------------------------------------------------------

  ipcMain.handle(
    IpcChannels.FIRMWARE_FLASH_LATEST,
    async (_event, channel: 'stable' | 'beta', portPath: string) => {
      const win = getWindow()

      // 1. Fetch release list
      let releases: Awaited<ReturnType<typeof firmwareService.listReleases>>
      try {
        releases = await firmwareService.listReleases(channel)
      } catch (err) {
        return {
          success: false,
          error: `Failed to fetch releases: ${err instanceof Error ? err.message : String(err)}`,
        }
      }

      const latest = releases[0]
      if (!latest) {
        return { success: false, error: 'No releases found for this channel' }
      }

      // 2. Download binary to a temp file
      win?.webContents.send(IpcChannels.FIRMWARE_PROGRESS, { pct: 0, phase: 'downloading' })

      let binData: Buffer
      try {
        const response = await net.fetch(latest.downloadUrl, {
          headers: { 'User-Agent': 'CANShift-Studio' },
        })
        if (!response.ok) {
          return {
            success: false,
            error: `Download failed: HTTP ${String(response.status)}`,
          }
        }
        const arrayBuffer = await response.arrayBuffer()
        binData = Buffer.from(arrayBuffer)
      } catch (err) {
        return {
          success: false,
          error: `Download error: ${err instanceof Error ? err.message : String(err)}`,
        }
      }

      const tmpPath = join(tmpdir(), `canshift-${latest.tag}.bin`)
      await writeFile(tmpPath, binData)

      win?.webContents.send(IpcChannels.FIRMWARE_PROGRESS, { pct: 100, phase: 'downloading' })

      // 3. Disconnect serial and flash
      await usbService.disconnect()
      const result = await runEsptoolFlash(portPath, tmpPath)
      return { ...result, version: latest.version }
    }
  )

  // ---------------------------------------------------------------------------
  // Asset management (local image library → SPIFFS via pio uploadfs)
  // ---------------------------------------------------------------------------

  // Assets are stored in <userData>/assets/ and referenced by SPIFFS path
  // (e.g. "/images/bg.bmp"). The user uploads them to the device via PlatformIO.
  const assetsDir = join(app.getPath('userData'), 'assets')

  // Ensure the assets directory exists on first use
  ipcMain.handle(IpcChannels.ASSET_LIST, async () => {
    try {
      await mkdir(assetsDir, { recursive: true })
      const files = await readdir(assetsDir)
      const images = files.filter((f) => ['.bmp', '.bin'].includes(extname(f).toLowerCase()))
      return { success: true, files: images.map((f) => ({ name: f, spiffsPath: `/images/${f}` })) }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), files: [] }
    }
  })

  ipcMain.handle(IpcChannels.ASSET_IMPORT_IMAGE, async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Import image (BMP)',
      filters: [{ name: 'BMP Images', extensions: ['bmp'] }],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return { success: false }
    const src = filePaths[0] ?? ''
    const name = basename(src)
    try {
      await mkdir(assetsDir, { recursive: true })
      const dest = join(assetsDir, name)
      await copyFile(src, dest)
      return { success: true, name, spiffsPath: `/images/${name}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IpcChannels.ASSET_DELETE, async (_event, name: string) => {
    try {
      await unlink(join(assetsDir, name))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ---------------------------------------------------------------------------
  // Signal export
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.SIGNAL_EXPORT, async (_event, config: unknown) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export signals.json',
      defaultPath: 'signals.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return { success: false }
    try {
      await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ---------------------------------------------------------------------------
  // App info
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.APP_VERSION, () => app.getVersion())

  // ---------------------------------------------------------------------------
  // Auto-update
  // ---------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.UPDATE_CHECK, () => {
    checkForUpdates()
  })

  ipcMain.handle(IpcChannels.UPDATE_INSTALL, () => {
    installUpdate()
  })
}
