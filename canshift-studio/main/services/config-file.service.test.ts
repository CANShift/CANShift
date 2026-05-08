// config-file.service.test.ts — coverage for the path allowlist guarding
// CONFIG_OPEN_PATH (#214). A compromised renderer must not be able to read
// arbitrary files by passing a fabricated filePath.
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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

describe('ConfigFileService.openFile — dialog success and error surfaces', () => {
  it('returns the parsed content on a successful open', async () => {
    const target = join(workDir, 'dashboard.json')
    const payload = { schemaVersion: 7, pages: [] }
    await writeJson(target, payload)

    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [target],
    })

    const service = new ConfigFileService(() => [])
    const result = await service.openFile()

    expect(result).toEqual({ success: true, filePath: target, content: payload })
  })

  it('returns success:false on dialog cancel — no error key', async () => {
    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    })

    const service = new ConfigFileService(() => [])
    const result = await service.openFile()

    expect(result).toEqual({ success: false })
  })

  it('returns success:false when dialog returns an empty filePaths array', async () => {
    // Some platforms can resolve canceled:false with an empty array — guard
    // against that branch landing as "open undefined".
    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [],
    })

    const service = new ConfigFileService(() => [])
    const result = await service.openFile()

    expect(result).toEqual({ success: false })
  })

  it('surfaces a descriptive error on malformed JSON', async () => {
    const target = join(workDir, 'broken.json')
    await writeFile(target, '{ this is not JSON', 'utf-8')

    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [target],
    })

    const service = new ConfigFileService(() => [])
    const result = await service.openFile()

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Failed to read config:/)
  })

  it('surfaces an error when the user-selected file disappears between dialog and read', async () => {
    const target = join(workDir, 'ghost.json')
    // File never created — readFile will ENOENT.

    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [target],
    })

    const service = new ConfigFileService(() => [])
    const result = await service.openFile()

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Failed to read config:/)
  })
})

describe('ConfigFileService.saveFile — currentFilePath persistence', () => {
  it('falls back to saveFileAs when no working file is set', async () => {
    const target = join(workDir, 'first-save.json')
    dialogMock.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: target,
    })

    const service = new ConfigFileService(() => [])
    const result = await service.saveFile({ schemaVersion: 1 })

    expect(result).toEqual({ success: true, filePath: target })
    expect(dialogMock.showSaveDialog).toHaveBeenCalledTimes(1)
  })

  it('reuses the working file path on subsequent saveFile() calls', async () => {
    const target = join(workDir, 'sticky.json')
    await writeJson(target, { schemaVersion: 1 })

    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [target],
    })

    const service = new ConfigFileService(() => [])
    await service.openFile()

    // After openFile, the second save should write to `target` without prompting.
    const result = await service.saveFile({ schemaVersion: 2 })
    expect(result).toEqual({ success: true, filePath: target })
    expect(dialogMock.showSaveDialog).not.toHaveBeenCalled()
  })

  it('writes the JSON payload pretty-printed with two-space indent', async () => {
    const target = join(workDir, 'pretty.json')
    await writeJson(target, { schemaVersion: 1 })
    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [target],
    })

    const service = new ConfigFileService(() => [])
    await service.openFile()

    await service.saveFile({ schemaVersion: 9, name: 'check' })

    const { readFile: readFs } = await import('node:fs/promises')
    const written = await readFs(target, 'utf-8')
    expect(written).toBe(JSON.stringify({ schemaVersion: 9, name: 'check' }, null, 2))
  })

  it('surfaces a descriptive error when the write fails', async () => {
    // Pointing at a directory makes writeFile fail with EISDIR.
    const service = new ConfigFileService(() => [])
    const result = await service.saveFile({ schemaVersion: 1 }, workDir)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Failed to save config:/)
  })

  it('honours an explicit filePath argument over the working file path', async () => {
    const working = join(workDir, 'working.json')
    const explicit = join(workDir, 'explicit.json')
    await writeJson(working, { schemaVersion: 1 })

    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [working],
    })

    const service = new ConfigFileService(() => [])
    await service.openFile()

    const result = await service.saveFile({ schemaVersion: 5 }, explicit)
    expect(result).toEqual({ success: true, filePath: explicit })
    // saveFileAs dialog must not have been touched — explicit path wins.
    expect(dialogMock.showSaveDialog).not.toHaveBeenCalled()
  })
})

describe('ConfigFileService.saveFileAs — dialog cancel and error surfaces', () => {
  it('returns success:false on dialog cancel without writing anything', async () => {
    dialogMock.showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: undefined })

    const service = new ConfigFileService(() => [])
    const result = await service.saveFileAs({ schemaVersion: 1 })
    expect(result).toEqual({ success: false })
  })

  it('returns success:false when dialog yields a missing filePath', async () => {
    // Edge case: canceled=false but filePath undefined (rare on Linux).
    dialogMock.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: undefined })

    const service = new ConfigFileService(() => [])
    const result = await service.saveFileAs({ schemaVersion: 1 })
    expect(result).toEqual({ success: false })
  })

  it('updates the working file path so the next saveFile() reuses it', async () => {
    const target = join(workDir, 'as.json')
    dialogMock.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: target })

    const service = new ConfigFileService(() => [])
    await service.saveFileAs({ schemaVersion: 1 })

    // Subsequent saveFile must not prompt again — the dialog mock would throw
    // if called a second time without another mockResolvedValueOnce.
    const second = await service.saveFile({ schemaVersion: 2 })
    expect(second).toEqual({ success: true, filePath: target })
    expect(dialogMock.showSaveDialog).toHaveBeenCalledTimes(1)
  })
})

describe('ConfigFileService.importFile — does not bind the working file', () => {
  it('returns the parsed content but does NOT set currentFilePath', async () => {
    const importTarget = join(workDir, 'foreign.json')
    const payload = { schemaVersion: 4, name: 'foreign' }
    await writeJson(importTarget, payload)

    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [importTarget],
    })

    const service = new ConfigFileService(() => [])
    const imported = await service.importFile()
    expect(imported).toEqual({ success: true, filePath: importTarget, content: payload })

    // A subsequent saveFile() must still prompt — import did not bind.
    const saveTarget = join(workDir, 'after-import.json')
    dialogMock.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: saveTarget })
    const saved = await service.saveFile({ schemaVersion: 5 })
    expect(saved).toEqual({ success: true, filePath: saveTarget })
    expect(dialogMock.showSaveDialog).toHaveBeenCalledTimes(1)
  })

  it('returns success:false on cancel', async () => {
    dialogMock.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] })

    const service = new ConfigFileService(() => [])
    const result = await service.importFile()
    expect(result).toEqual({ success: false })
  })

  it('surfaces malformed JSON errors without binding the path', async () => {
    const target = join(workDir, 'malformed-import.json')
    await writeFile(target, 'not json', 'utf-8')

    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [target],
    })

    const service = new ConfigFileService(() => [])
    const result = await service.importFile()
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Failed to read config:/)
  })
})

describe('ConfigFileService.exportFile — does not bind the working file', () => {
  it('writes the file and returns success without changing currentFilePath', async () => {
    const exportTarget = join(workDir, 'export.json')
    dialogMock.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: exportTarget,
    })

    const service = new ConfigFileService(() => [])
    const exported = await service.exportFile({ schemaVersion: 1 })
    expect(exported).toEqual({ success: true, filePath: exportTarget })

    // Subsequent saveFile must still prompt — export did not bind.
    const saveTarget = join(workDir, 'after-export.json')
    dialogMock.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: saveTarget })
    const saved = await service.saveFile({ schemaVersion: 2 })
    expect(saved.filePath).toBe(saveTarget)
  })

  it('returns success:false on dialog cancel', async () => {
    dialogMock.showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: undefined })

    const service = new ConfigFileService(() => [])
    const result = await service.exportFile({ schemaVersion: 1 })
    expect(result).toEqual({ success: false })
  })

  it('surfaces a descriptive error when the write fails (target is a directory)', async () => {
    dialogMock.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: workDir })

    const service = new ConfigFileService(() => [])
    const result = await service.exportFile({ schemaVersion: 1 })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Failed to export config:/)
  })
})
