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
