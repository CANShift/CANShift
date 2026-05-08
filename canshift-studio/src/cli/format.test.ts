// src/cli/format.test.ts — Render rules for log → ANSI line conversion.

import { describe, expect, it } from 'vitest'
import { formatLogEntry } from './format'
import type { LogEntry } from '../stores/log.store'

const FIXED_DATE = new Date(2026, 4, 8, 9, 5, 7) // 09:05:07 local

function entry(partial: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    level: 'info',
    message: 'hello',
    timestamp: FIXED_DATE,
    ...partial,
  }
}

describe('formatLogEntry', () => {
  it('formats the timestamp as zero-padded HH:MM:SS', () => {
    const out = formatLogEntry(entry())
    expect(out).toContain('09:05:07')
  })

  it('uses an explicit scope when provided', () => {
    const out = formatLogEntry(entry({ scope: 'usb', level: 'info' }))
    expect(out).toContain('[usb]')
  })

  it('extracts a leading [scope] prefix from the message when no explicit scope', () => {
    const out = formatLogEntry(entry({ message: '[burn] writing 32 KB' }))
    expect(out).toContain('[burn]')
    expect(out).toContain('writing 32 KB')
    // The original prefix is stripped from the rendered message segment.
    expect(out.split('[burn]')[1]).not.toContain('[burn]')
  })

  it('renders error lines entirely in red', () => {
    const out = formatLogEntry(entry({ level: 'error', message: 'boom' }))
    expect(out).toContain('\x1b[31mboom\x1b[0m')
  })

  it('uses level colours for scope tags', () => {
    const warn = formatLogEntry(entry({ level: 'warn', scope: 'sd' }))
    const success = formatLogEntry(entry({ level: 'success', scope: 'sd' }))
    expect(warn).toContain('\x1b[33m[sd]')
    expect(success).toContain('\x1b[32m[sd]')
  })

  it('terminates each line with CRLF for raw xterm output', () => {
    const out = formatLogEntry(entry())
    expect(out.endsWith('\r\n')).toBe(true)
  })
})
