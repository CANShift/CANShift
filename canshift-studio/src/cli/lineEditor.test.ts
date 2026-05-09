// src/cli/lineEditor.test.ts — Cursor, history, and shortcut behaviour for
// the pure line-editor state machine.

import { describe, expect, it } from 'vitest'
import {
  backspace,
  clearLine,
  deleteForward,
  deleteWordBack,
  historyNext,
  historyPrev,
  insert,
  makeLineEditor,
  moveEnd,
  moveHome,
  moveLeft,
  moveRight,
  pushHistory,
  renderActiveLine,
  stripAnsi,
} from './lineEditor'

describe('insert', () => {
  it('appends text at the cursor when at the end', () => {
    const s = insert(makeLineEditor(), 'abc')
    expect(s.buffer).toBe('abc')
    expect(s.cursor).toBe(3)
  })

  it('inserts text mid-buffer at the cursor', () => {
    let s = insert(makeLineEditor(), 'hello')
    s = moveLeft(s)
    s = moveLeft(s)
    s = insert(s, 'X')
    expect(s.buffer).toBe('helXlo')
    expect(s.cursor).toBe(4)
  })

  it('resets historyIndex when the user types', () => {
    let s = pushHistory(makeLineEditor(), 'first')
    s = historyPrev(s)
    expect(s.historyIndex).toBe(0)
    s = insert(s, 'X')
    expect(s.historyIndex).toBeNull()
  })
})

describe('backspace and deleteForward', () => {
  it('backspace removes the char before the cursor', () => {
    let s = insert(makeLineEditor(), 'abc')
    s = backspace(s)
    expect(s.buffer).toBe('ab')
    expect(s.cursor).toBe(2)
  })

  it('backspace at column 0 is a no-op', () => {
    const s = backspace(makeLineEditor())
    expect(s.buffer).toBe('')
    expect(s.cursor).toBe(0)
  })

  it('deleteForward removes the char at the cursor', () => {
    let s = insert(makeLineEditor(), 'abc')
    s = moveLeft(s)
    s = deleteForward(s)
    expect(s.buffer).toBe('ab')
    expect(s.cursor).toBe(2)
  })

  it('deleteForward at end is a no-op', () => {
    let s = insert(makeLineEditor(), 'abc')
    s = deleteForward(s)
    expect(s.buffer).toBe('abc')
    expect(s.cursor).toBe(3)
  })
})

describe('cursor moves', () => {
  it('moveHome jumps to column 0; moveEnd to length', () => {
    let s = insert(makeLineEditor(), 'hello world')
    s = moveHome(s)
    expect(s.cursor).toBe(0)
    s = moveEnd(s)
    expect(s.cursor).toBe(11)
  })

  it('moveLeft / moveRight clamp at the edges', () => {
    let s = insert(makeLineEditor(), 'ab')
    s = moveRight(s)
    expect(s.cursor).toBe(2)
    s = moveLeft(s)
    s = moveLeft(s)
    s = moveLeft(s)
    expect(s.cursor).toBe(0)
  })
})

describe('clearLine and deleteWordBack', () => {
  it('clearLine empties the buffer and zeroes the cursor', () => {
    let s = insert(makeLineEditor(), 'hello world')
    s = clearLine(s)
    expect(s.buffer).toBe('')
    expect(s.cursor).toBe(0)
  })

  it('deleteWordBack removes the word ending at the cursor', () => {
    let s = insert(makeLineEditor(), 'connect /dev/tty.usb')
    s = deleteWordBack(s)
    expect(s.buffer).toBe('connect ')
    expect(s.cursor).toBe(8)
  })

  it('deleteWordBack handles trailing spaces by skipping them first', () => {
    let s = insert(makeLineEditor(), 'one two   ')
    s = deleteWordBack(s)
    expect(s.buffer).toBe('one ')
    expect(s.cursor).toBe(4)
  })

  it('deleteWordBack at column 0 is a no-op', () => {
    const s = deleteWordBack(makeLineEditor())
    expect(s.buffer).toBe('')
  })
})

describe('history', () => {
  it('pushHistory appends non-empty trimmed lines and resets the pointer', () => {
    let s = makeLineEditor()
    s = pushHistory(s, 'help')
    s = pushHistory(s, 'status')
    expect(s.history).toEqual(['help', 'status'])
    expect(s.historyIndex).toBeNull()
  })

  it('pushHistory drops empty / whitespace-only commands', () => {
    let s = pushHistory(makeLineEditor(), '   ')
    s = pushHistory(s, 'help')
    s = pushHistory(s, '')
    expect(s.history).toEqual(['help'])
  })

  it('pushHistory collapses consecutive duplicates', () => {
    let s = pushHistory(makeLineEditor(), 'help')
    s = pushHistory(s, 'help')
    expect(s.history).toEqual(['help'])
  })

  it('historyPrev walks backwards from the end and saves the draft', () => {
    let s = pushHistory(makeLineEditor(), 'a')
    s = pushHistory(s, 'b')
    s = insert(s, 'draft')
    s = historyPrev(s)
    expect(s.buffer).toBe('b')
    expect(s.cursor).toBe(1)
    expect(s.pendingDraft).toBe('draft')
    s = historyPrev(s)
    expect(s.buffer).toBe('a')
  })

  it('historyPrev clamps at the oldest entry', () => {
    let s = pushHistory(makeLineEditor(), 'only')
    s = historyPrev(s)
    s = historyPrev(s)
    expect(s.buffer).toBe('only')
    expect(s.historyIndex).toBe(0)
  })

  it('historyNext walks forward and restores the pending draft past the end', () => {
    let s = pushHistory(makeLineEditor(), 'a')
    s = pushHistory(s, 'b')
    s = insert(s, 'draft')
    s = historyPrev(s)
    s = historyPrev(s)
    s = historyNext(s)
    expect(s.buffer).toBe('b')
    s = historyNext(s)
    expect(s.buffer).toBe('draft')
    expect(s.historyIndex).toBeNull()
  })

  it('historyNext is a no-op when not browsing history', () => {
    let s = insert(makeLineEditor(), 'typing')
    s = historyNext(s)
    expect(s.buffer).toBe('typing')
  })
})

describe('renderActiveLine and stripAnsi', () => {
  it('stripAnsi removes SGR escape sequences', () => {
    expect(stripAnsi('\x1b[32mhello\x1b[0m')).toBe('hello')
  })

  it('renderActiveLine starts with CR + erase-to-EOL and writes the prompt + buffer', () => {
    const s = insert(makeLineEditor(), 'help')
    const out = renderActiveLine('> ', s)
    expect(out.startsWith('\r\x1b[K')).toBe(true)
    expect(out).toContain('> help')
  })

  it('renderActiveLine appends a backwards-cursor sequence when the cursor is mid-buffer', () => {
    let s = insert(makeLineEditor(), 'help')
    s = moveLeft(s)
    s = moveLeft(s)
    const out = renderActiveLine('> ', s)
    expect(out).toContain('\x1b[2D')
  })
})
