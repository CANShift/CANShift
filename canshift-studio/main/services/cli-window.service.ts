// cli-window.service.ts — Persisted bounds for the detached CLI BrowserWindow
// (issue #433).
//
// Storage layout mirrors session.service.ts: a small JSON file written to
// `app.getPath('userData')`. Errors are best-effort — losing the bounds is a
// UX downgrade, never a crash.
//
// Validation rules:
//   • If the persisted rectangle does not overlap any of the currently
//     attached displays (e.g. user disconnected the monitor it lived on),
//     fall back to a default rectangle centered on the primary display.
//   • Width / height below `CLI_WINDOW_MIN_WIDTH` / `CLI_WINDOW_MIN_HEIGHT`
//     are clamped — we never want to spawn a 50 px terminal because of a
//     bogus saved value.

import { app, screen } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface CliWindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export const CLI_WINDOW_MIN_WIDTH = 480
export const CLI_WINDOW_MIN_HEIGHT = 240
const DEFAULT_WIDTH = 720
const DEFAULT_HEIGHT = 360
const STORAGE_FILE = 'cli-window.json'

function storagePath(): string {
  return path.join(app.getPath('userData'), STORAGE_FILE)
}

function clampSize(bounds: CliWindowBounds): CliWindowBounds {
  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(CLI_WINDOW_MIN_WIDTH, Math.floor(bounds.width)),
    height: Math.max(CLI_WINDOW_MIN_HEIGHT, Math.floor(bounds.height)),
  }
}

function rectsOverlap(a: CliWindowBounds, b: Electron.Rectangle): boolean {
  return !(
    a.x + a.width <= b.x ||
    a.x >= b.x + b.width ||
    a.y + a.height <= b.y ||
    a.y >= b.y + b.height
  )
}

function isOnAnyDisplay(bounds: CliWindowBounds): boolean {
  const displays = screen.getAllDisplays()
  return displays.some((d) => rectsOverlap(bounds, d.workArea))
}

function defaultBounds(): CliWindowBounds {
  // `screen.getPrimaryDisplay()` is unavailable before app `ready`; the caller
  // (BrowserWindow construction in `cli-window.ts`) only runs post-ready, so
  // this is safe.
  const primary = screen.getPrimaryDisplay()
  const wa = primary.workArea
  const width = Math.min(DEFAULT_WIDTH, wa.width)
  const height = Math.min(DEFAULT_HEIGHT, wa.height)
  return {
    x: wa.x + Math.floor((wa.width - width) / 2),
    y: wa.y + Math.floor((wa.height - height) / 2),
    width,
    height,
  }
}

function parseBounds(raw: unknown): CliWindowBounds | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.x !== 'number' ||
    typeof r.y !== 'number' ||
    typeof r.width !== 'number' ||
    typeof r.height !== 'number'
  ) {
    return null
  }
  if (
    !Number.isFinite(r.x) ||
    !Number.isFinite(r.y) ||
    !Number.isFinite(r.width) ||
    !Number.isFinite(r.height)
  ) {
    return null
  }
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}

/**
 * Reads the persisted bounds, applying min-size clamping and an off-screen
 * fallback to default.
 */
export function loadCliWindowBounds(): CliWindowBounds {
  let parsed: CliWindowBounds | null = null
  try {
    const raw = fs.readFileSync(storagePath(), 'utf-8')
    parsed = parseBounds(JSON.parse(raw))
  } catch {
    // Missing or unparseable — fall through to default.
  }
  if (parsed === null) return defaultBounds()
  const clamped = clampSize(parsed)
  if (!isOnAnyDisplay(clamped)) return defaultBounds()
  return clamped
}

/** Writes the supplied bounds (after min-size clamp). */
export function saveCliWindowBounds(bounds: CliWindowBounds): void {
  const clamped = clampSize(bounds)
  try {
    fs.writeFileSync(storagePath(), JSON.stringify(clamped), 'utf-8')
  } catch {
    // Best-effort — disk full / read-only userData / etc.
  }
}

// Exported for tests — the normal path is `loadCliWindowBounds` which combines
// the two.
export const __testing = { clampSize, defaultBounds, isOnAnyDisplay, parseBounds }
