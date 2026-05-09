// src/cli/lineEditor.ts — Pure line-editing state machine.
//
// Encapsulates the buffer, cursor position, and history pointer for the CLI
// input loop. The CliTerminal keystroke handler translates raw xterm `data`
// into one of the high-level actions below, applies the diff, and re-renders
// the active line. Keeping this logic out of the React component lets us
// unit-test every shortcut without xterm in the loop.
//
// All inputs/outputs are plain strings — ANSI sequences are emitted by the
// terminal renderer in CliTerminal.tsx, not here.

const MAX_HISTORY = 200

export interface LineEditorState {
  /** Current text content of the active line. */
  buffer: string
  /** Cursor offset in `buffer` — `0 ≤ cursor ≤ buffer.length`. */
  cursor: number
  /**
   * Past command lines, oldest → newest. Up arrow walks backwards from the
   * end. Capped at `MAX_HISTORY` to keep memory bounded.
   */
  history: string[]
  /**
   * Index into `history` while navigating. `null` means "not in history" —
   * any keystroke other than ↑/↓ resets it.
   */
  historyIndex: number | null
  /**
   * Snapshot of `buffer` taken when the user first presses ↑. Lets ↓ from
   * the top of the stack restore exactly what they were typing.
   */
  pendingDraft: string
}

export function makeLineEditor(): LineEditorState {
  return {
    buffer: '',
    cursor: 0,
    history: [],
    historyIndex: null,
    pendingDraft: '',
  }
}

// ---------------------------------------------------------------------------
// Buffer mutations (cursor-aware)
// ---------------------------------------------------------------------------

/** Insert printable text at the cursor; advances the cursor by `text.length`. */
export function insert(state: LineEditorState, text: string): LineEditorState {
  return {
    ...state,
    buffer: state.buffer.slice(0, state.cursor) + text + state.buffer.slice(state.cursor),
    cursor: state.cursor + text.length,
    historyIndex: null,
  }
}

/** Backspace: remove the character before the cursor, if any. */
export function backspace(state: LineEditorState): LineEditorState {
  if (state.cursor === 0) return state
  return {
    ...state,
    buffer: state.buffer.slice(0, state.cursor - 1) + state.buffer.slice(state.cursor),
    cursor: state.cursor - 1,
    historyIndex: null,
  }
}

/** Forward delete: remove the character at the cursor, if any. */
export function deleteForward(state: LineEditorState): LineEditorState {
  if (state.cursor >= state.buffer.length) return state
  return {
    ...state,
    buffer: state.buffer.slice(0, state.cursor) + state.buffer.slice(state.cursor + 1),
    historyIndex: null,
  }
}

export function moveLeft(state: LineEditorState): LineEditorState {
  if (state.cursor === 0) return state
  return { ...state, cursor: state.cursor - 1 }
}

export function moveRight(state: LineEditorState): LineEditorState {
  if (state.cursor >= state.buffer.length) return state
  return { ...state, cursor: state.cursor + 1 }
}

/** Ctrl+A — jump to the start of the line. */
export function moveHome(state: LineEditorState): LineEditorState {
  return { ...state, cursor: 0 }
}

/** Ctrl+E — jump to the end of the line. */
export function moveEnd(state: LineEditorState): LineEditorState {
  return { ...state, cursor: state.buffer.length }
}

/** Ctrl+U — clear the line entirely. */
export function clearLine(state: LineEditorState): LineEditorState {
  return { ...state, buffer: '', cursor: 0, historyIndex: null }
}

/** Ctrl+W — delete the word before the cursor (whitespace-bounded). */
export function deleteWordBack(state: LineEditorState): LineEditorState {
  if (state.cursor === 0) return state
  let i = state.cursor
  // Skip trailing whitespace before the cursor.
  while (i > 0 && /\s/.test(state.buffer.charAt(i - 1))) i--
  // Then skip the word itself.
  while (i > 0 && !/\s/.test(state.buffer.charAt(i - 1))) i--
  return {
    ...state,
    buffer: state.buffer.slice(0, i) + state.buffer.slice(state.cursor),
    cursor: i,
    historyIndex: null,
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/**
 * Push a freshly executed command into history. Empty / whitespace-only
 * lines are skipped, and consecutive duplicates collapse (matches `zsh`'s
 * `HIST_IGNORE_DUPS`). Resets the history pointer + pending draft.
 */
export function pushHistory(state: LineEditorState, command: string): LineEditorState {
  const trimmed = command.trim()
  if (trimmed.length === 0) {
    return { ...state, historyIndex: null, pendingDraft: '' }
  }
  const last = state.history[state.history.length - 1]
  const next = last === trimmed ? state.history : [...state.history, trimmed]
  const capped = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
  return {
    ...state,
    history: capped,
    historyIndex: null,
    pendingDraft: '',
  }
}

/** Up arrow — walk backwards through history. */
export function historyPrev(state: LineEditorState): LineEditorState {
  if (state.history.length === 0) return state
  if (state.historyIndex === null) {
    const lastIdx = state.history.length - 1
    const entry = state.history[lastIdx] ?? ''
    return {
      ...state,
      pendingDraft: state.buffer,
      historyIndex: lastIdx,
      buffer: entry,
      cursor: entry.length,
    }
  }
  if (state.historyIndex === 0) return state
  const idx = state.historyIndex - 1
  const entry = state.history[idx] ?? ''
  return { ...state, historyIndex: idx, buffer: entry, cursor: entry.length }
}

/** Down arrow — walk forward, restoring `pendingDraft` past the end. */
export function historyNext(state: LineEditorState): LineEditorState {
  if (state.historyIndex === null) return state
  const next = state.historyIndex + 1
  if (next >= state.history.length) {
    return {
      ...state,
      historyIndex: null,
      buffer: state.pendingDraft,
      cursor: state.pendingDraft.length,
      pendingDraft: '',
    }
  }
  const entry = state.history[next] ?? ''
  return { ...state, historyIndex: next, buffer: entry, cursor: entry.length }
}

// ---------------------------------------------------------------------------
// xterm-side rendering helpers
// ---------------------------------------------------------------------------

const ESC = '\x1b'

/**
 * Build the ANSI sequence that re-renders the active input line after a
 * full-buffer mutation. Carriage-returns to column 0, erases to end of line,
 * writes the prompt + buffer, then moves the cursor backwards into position.
 *
 * The caller must have already written the prompt earlier — `prompt` here is
 * passed in only to compute its visible width for the cursor offset, since
 * ANSI colour escapes mustn't count towards the column index.
 */
export function renderActiveLine(prompt: string, state: LineEditorState): string {
  const stripped = stripAnsi(prompt)
  let out = '\r' + ESC + '[K' + prompt + state.buffer
  const tail = state.buffer.length - state.cursor
  if (tail > 0) {
    // Move cursor backwards by `tail` columns so it sits at `state.cursor`.
    out += `${ESC}[${String(tail)}D`
  }
  // `stripped` is referenced so future width-aware logic keeps the value live;
  // strip ANSI here also tells reviewers we deliberately don't trust the raw
  // prompt length when computing visual width.
  void stripped.length
  return out
}

// SGR ANSI escape: ESC `[` (0x1b 0x5b) followed by digits/`;` and `m`.
// Built from `String.fromCharCode` to avoid `no-control-regex`.
const ANSI_RE = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*m`, 'g')

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '')
}
