// src/cli/actions.ts — Concrete `CliActions` implementation.
//
// Each method calls existing IPC services + Zustand store actions, never the
// React-only hooks (`useConfigActions`, `useFirmwareFlash` …). That keeps the
// CLI free of render-phase coupling: command handlers can be unit-tested with
// a mocked `CliActions` object in `commands.test.ts`, while production wiring
// runs through this file.
//
// All operations log to `useLogStore` with a stable `[scope]` so the terminal
// renders the same prefix used by the toolbar code paths.

import type { NavigateFunction } from 'react-router-dom'
import { validateDashboard } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { sessionIpc, usbService } from '../services/ipc.service'
import type { CliActions, CliResult } from './types'

const okResult: CliResult = { ok: true }
function failResult(reason: string): CliResult {
  return { ok: false, reason }
}

// ---------------------------------------------------------------------------
// Port discovery
// ---------------------------------------------------------------------------

const CANSHIFT_MANUFACTURER_HINTS = ['silicon labs', 'cp210', 'wch.cn', 'ch340', 'ch9102']

function isCanShiftManufacturer(manufacturer: string | undefined): boolean {
  if (manufacturer === undefined) return false
  const lower = manufacturer.toLowerCase()
  return CANSHIFT_MANUFACTURER_HINTS.some((hint) => lower.includes(hint))
}

async function pickAutoPort(): Promise<{ path: string } | { error: string }> {
  const [ports, lastPortPath] = await Promise.all([
    usbService.listPorts(),
    sessionIpc.getLastPortPath(),
  ])
  if (lastPortPath !== null) {
    const remembered = ports.find((p) => p.path === lastPortPath)
    if (remembered !== undefined) return { path: remembered.path }
  }
  const matches = ports.filter((p) => isCanShiftManufacturer(p.manufacturer))
  if (matches.length === 1) {
    const only = matches[0]
    if (only !== undefined) return { path: only.path }
  }
  if (matches.length === 0) return { error: 'no CANShift port detected' }
  return {
    error: `multiple CANShift ports found — pass one explicitly: ${matches.map((p) => p.path).join(', ')}`,
  }
}

// ---------------------------------------------------------------------------
// Action implementations
// ---------------------------------------------------------------------------

async function burnConfig(): Promise<CliResult> {
  const log = useLogStore.getState().push
  const dashboard = useDashboardStore.getState()
  const device = useDeviceStore.getState()
  const config = dashboard.config

  if (config === null) {
    log('error', 'no config loaded', 'burn')
    return failResult('no config loaded')
  }
  if (!device.connected || device.simulationMode) {
    const reason = device.simulationMode ? 'simulation mode' : 'not connected'
    log('error', `aborted — ${reason}`, 'burn')
    return failResult(reason)
  }

  const validation = validateDashboard(config)
  if (!validation.valid) {
    for (const err of validation.errors) {
      log('error', `validation: ${err}`, 'burn')
    }
    return failResult(`${String(validation.errors.length)} validation error(s)`)
  }
  for (const w of validation.warnings) {
    log('warn', `validation: ${w}`, 'burn')
  }

  const payloadBytes = new TextEncoder().encode(JSON.stringify(config)).length
  const payloadKb = (payloadBytes / 1024).toFixed(1)

  device.setSyncing(true)
  device.setBurnPhase('pushing')
  log('info', `started — schema v${config.version}, ${payloadKb} KB`, 'burn')

  const startedAt = performance.now()
  try {
    const result = await usbService.pushConfig(config)
    const elapsedMs = Math.round(performance.now() - startedAt)
    if (result.success) {
      device.setSyncComplete(new Date())
      device.setLastPushedConfig(config)
      device.setBurnPhase('rebooting')
      log('success', `ok — wrote ${payloadKb} KB in ${String(elapsedMs)} ms`, 'burn')
      return okResult
    }
    const msg = result.error ?? 'burn failed'
    device.setError(msg)
    device.setBurnPhase('idle')
    log('error', `failed: ${msg} (after ${String(elapsedMs)} ms)`, 'burn')
    return failResult(msg)
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - startedAt)
    const msg = err instanceof Error ? err.message : 'burn error'
    device.setError(msg)
    device.setBurnPhase('idle')
    log('error', `failed: ${msg} (after ${String(elapsedMs)} ms)`, 'burn')
    return failResult(msg)
  }
}

async function connectAction(portPath: string | undefined): Promise<CliResult> {
  const log = useLogStore.getState().push

  let target: string
  if (portPath === undefined) {
    const picked = await pickAutoPort()
    if ('error' in picked) {
      log('error', `connect: ${picked.error}`, 'usb')
      return failResult(picked.error)
    }
    target = picked.path
  } else {
    target = portPath
  }

  try {
    const result = await usbService.connect(target)
    if (result.success) {
      // Store update happens via the USB_CONNECTION_CHANGED IPC event —
      // `useUsbEvents` is the single source of truth (#696).
      log('success', `connected on ${target}`, 'usb')
      return okResult
    }
    const msg = result.error ?? 'connect failed'
    log('error', `connect: ${msg}`, 'usb')
    return failResult(msg)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'connect error'
    log('error', `connect: ${msg}`, 'usb')
    return failResult(msg)
  }
}

async function disconnectAction(): Promise<CliResult> {
  const log = useLogStore.getState().push
  try {
    // Store update happens via the USB_CONNECTION_CHANGED IPC event —
    // `useUsbEvents` is the single source of truth (#696).
    const result = await usbService.disconnect()
    if (!result.success && result.error !== undefined) {
      log('warn', `disconnect: ${result.error}`, 'usb')
    } else {
      log('info', 'disconnected', 'usb')
    }
    return okResult
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'disconnect error'
    log('error', `disconnect: ${msg}`, 'usb')
    return failResult(msg)
  }
}

async function rebootAction(): Promise<CliResult> {
  const log = useLogStore.getState().push
  try {
    const result = await usbService.reboot()
    if (result.success) {
      log('info', 'reboot requested', 'usb')
      return okResult
    }
    const msg = result.error ?? 'reboot failed'
    log('error', `reboot: ${msg}`, 'usb')
    return failResult(msg)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'reboot error'
    log('error', `reboot: ${msg}`, 'usb')
    return failResult(msg)
  }
}

async function listPortsAction(): Promise<string[]> {
  const ports = await usbService.listPorts()
  return ports.map((p) => p.path)
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Build a `CliActions` bag bound to the live stores + IPC services. The
 * returned object is stable across the hook's lifetime and safe to memoise.
 */
export function buildActions(navigate: NavigateFunction): CliActions {
  return {
    burnConfig,
    connect: connectAction,
    disconnect: disconnectAction,
    reboot: rebootAction,
    listPorts: listPortsAction,
    openFlashRoute: () => {
      navigate('/update')
      return okResult
    },
  }
}
