// config-file.service.test.ts — coverage for the path allowlist guarding
// CONFIG_OPEN_PATH (#214). A compromised renderer must not be able to read
// arbitrary files by passing a fabricated filePath.
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const dialogMock = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
}))

vi.mock('electron', () => ({ dialog: dialogMock }))

vi.mock('./session.service', () => ({
  sessionService: {
    getRecentFiles: (): string[] => [],
  },
}))

import { ConfigFileService } from './config-file.service'

let workDir: string

beforeEach(async () => {
  dialogMock.showOpenDialog.mockReset()
  dialogMock.showSaveDialog.mockReset()
  workDir = await mkdtemp(join(tmpdir(), 'cs-config-test-'))
})

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
})

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(payload), 'utf-8')
}

describe('ConfigFileService — openFilePath path allowlist (#214)', () => {
  it('rejects a renderer-supplied path that was never surfaced', async () => {
    const service = new ConfigFileService(() => [])
    const target = join(workDir, 'attack.json')
    await writeJson(target, { stolen: true })

    const result = await service.openFilePath(target)

    expect(result).toEqual({
      success: false,
      error: 'blocked: path not previously surfaced',
    })
  })

  it('rejects a path-traversal attempt against an allowlisted file', async () => {
    // Allow only one specific file. A `..` sibling resolves elsewhere and must
    // not slip through path normalisation.
    const allowed = join(workDir, 'allowed.json')
    await writeJson(allowed, { ok: true })
    const sibling = join(workDir, 'allowed.json', '..', 'sibling.json')
    await writeJson(resolve(sibling), { stolen: true })

    const service = new ConfigFileService(() => [allowed])

    const result = await service.openFilePath(sibling)

    expect(result.success).toBe(false)
    expect(result.error).toBe('blocked: path not previously surfaced')
  })

  it('accepts a path that was just surfaced through openFile()', async () => {
    const target = join(workDir, 'dashboard.json')
    await writeJson(target, { schemaVersion: 1 })

    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [target],
    })

    const service = new ConfigFileService(() => [])
    const opened = await service.openFile()
    expect(opened.success).toBe(true)

    const reopened = await service.openFilePath(target)
    expect(reopened.success).toBe(true)
    expect(reopened.filePath).toBe(target)
  })

  it('accepts a path that was just surfaced through saveFileAs()', async () => {
    const target = join(workDir, 'fresh.json')

    dialogMock.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: target,
    })

    const service = new ConfigFileService(() => [])
    const saved = await service.saveFileAs({ schemaVersion: 1 })
    expect(saved.success).toBe(true)

    const reopened = await service.openFilePath(target)
    expect(reopened.success).toBe(true)
  })

  it('accepts a path seeded from persisted recent files', async () => {
    const target = join(workDir, 'recent.json')
    await writeJson(target, { schemaVersion: 1 })

    const service = new ConfigFileService(() => [target])

    const result = await service.openFilePath(target)
    expect(result.success).toBe(true)
    expect(result.filePath).toBe(target)
  })

  it('accepts a path surfaced through exportFile()', async () => {
    const target = join(workDir, 'export.json')

    dialogMock.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: target,
    })

    const service = new ConfigFileService(() => [])
    const exported = await service.exportFile({ schemaVersion: 1 })
    expect(exported.success).toBe(true)

    const reopened = await service.openFilePath(target)
    expect(reopened.success).toBe(true)
  })

  it('treats equivalent paths (with and without "./") as the same entry', async () => {
    const target = join(workDir, 'same.json')
    await writeJson(target, { schemaVersion: 1 })

    const service = new ConfigFileService(() => [target])

    // Adding "./" components should normalise to the same resolved path.
    const equivalent = join(workDir, '.', 'same.json')
    const result = await service.openFilePath(equivalent)
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Issue #219 — openFile / saveFile error-path coverage
// ---------------------------------------------------------------------------
//
// The renderer's session-restore flow swallows errors silently, so without
// these tests a regression where `openFile` returns the wrong shape (e.g. a
// thrown exception instead of `{ success: false, error }`) would only surface
// as a confused empty editor at runtime.

describe('ConfigFileService.openFile — dialog and FS error paths (#219)', () => {
  it('resolves with success:false when the user cancels the open dialog', async () => {
    dialogMock.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    const service = new ConfigFileService(() => [])

    const result = await service.openFile()

    expect(result).toEqual({ success: false })
  })

  it('resolves with success:false when the dialog returns an empty filePaths array', async () => {
    // Some platforms return canceled:false but no path (rare, but observed).
    dialogMock.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [] })
    const service = new ConfigFileService(() => [])

    const result = await service.openFile()

    expect(result).toEqual({ success: false })
  })

  it('parses the JSON content and surfaces it on success', async () => {
    const target = join(workDir, 'dashboard.json')
    await writeJson(target, { schemaVersion: 5, name: 'test' })

    dialogMock.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [target] })
    const service = new ConfigFileService(() => [])

    const result = await service.openFile()

    expect(result.success).toBe(true)
    expect(result.filePath).toBe(target)
    expect(result.content).toEqual({ schemaVersion: 5, name: 'test' })
  })

  it('reports a parse error for malformed JSON without throwing', async () => {
    const target = join(workDir, 'broken.json')
    await writeFile(target, '{ not valid json', 'utf-8')

    dialogMock.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [target] })
    const service = new ConfigFileService(() => [])

    const result = await service.openFile()

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Failed to read config:/)
  })

  it('reports a missing-file error without throwing', async () => {
    const missing = join(workDir, 'does-not-exist.json')

    dialogMock.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [missing] })
    const service = new ConfigFileService(() => [])

    const result = await service.openFile()

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Failed to read config:/)
  })

  it('persists currentFilePath so a subsequent saveFile reuses it (no dialog)', async () => {
    const target = join(workDir, 'live.json')
    await writeJson(target, { schemaVersion: 1 })

    dialogMock.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [target] })

    const service = new ConfigFileService(() => [])
    await service.openFile()

    // After openFile, save should write to `target` without showing a dialog.
    const saved = await service.saveFile({ schemaVersion: 1, updated: true })

    expect(saved).toEqual({ success: true, filePath: target })
    expect(dialogMock.showSaveDialog).not.toHaveBeenCalled()

    const written = await readFile(target, 'utf-8')
    expect(JSON.parse(written)).toEqual({ schemaVersion: 1, updated: true })
  })

  it('saveFile with no currentFilePath delegates to saveFileAs (shows save dialog)', async () => {
    const target = join(workDir, 'fresh-save.json')
    dialogMock.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: target })

    const service = new ConfigFileService(() => [])
    const result = await service.saveFile({ schemaVersion: 1 })

    expect(result.success).toBe(true)
    expect(dialogMock.showSaveDialog).toHaveBeenCalledOnce()
  })

  it('saveFileAs reports an error when the destination cannot be written', async () => {
    // Picking a path under a non-existent directory triggers ENOENT on write.
    const unwritable = join(workDir, 'no-such-dir', 'out.json')
    dialogMock.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: unwritable })

    const service = new ConfigFileService(() => [])
    const result = await service.saveFileAs({ schemaVersion: 1 })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Failed to save config:/)
  })

  it('saveFileAs returns success:false on dialog cancel', async () => {
    dialogMock.showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: undefined })

    const service = new ConfigFileService(() => [])
    const result = await service.saveFileAs({ schemaVersion: 1 })

    expect(result).toEqual({ success: false })
  })
})
