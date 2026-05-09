// CliTerminal.tsx — xterm-backed CLI panel (issue #378).
//
// The whole component is loaded via `React.lazy` from App.tsx, so `@xterm/xterm`
// and its addons stay out of the main renderer chunk. A lightweight loading
// placeholder keeps the layout stable while the chunk fetches.
//
// PR 3 scope: top-edge drag handle to resize the panel (persisted in
// localStorage via `useCliPanelHeight`) and removal of the legacy "Try new
// CLI" feature flag — the terminal is now the default surface. Detach into a
// separate Electron `BrowserWindow` is tracked separately and lands in a
// follow-up PR; the IPC + window plumbing are too invasive to bundle here.

import { useCallback, useEffect, useRef, type ReactElement } from 'react'
import { useLogStore, type LogEntry } from '../../stores/log.store'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useDeviceStore } from '../../stores/device.store'
import { complete, dispatch, longestCommonPrefix } from '../../cli/commands'
import { formatLogEntry } from '../../cli/format'
import { parse, ParseError } from '../../cli/parse'
import { buildPrompt } from '../../cli/prompt'
import { CLI_FONT_FAMILY, CLI_FONT_SIZE, CLI_LINE_HEIGHT, CLI_THEME } from '../../cli/theme'
import { useCliRuntime } from '../../cli/useCliRuntime'
import { useCliDetach } from '../../cli/useCliDetach'
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
  type LineEditorState,
} from '../../cli/lineEditor'
import type { CliTerminalHandle } from '../../cli/types'
import { useCliPanelHeight } from './useCliPanelHeight'

const RESIZE_HANDLE_HEIGHT = 4
const HEADER_HEIGHT = 24

interface XtermModule {
  Terminal: new (options: object) => XtermTerminal
}

interface XtermTerminal {
  open: (el: HTMLElement) => void
  write: (data: string) => void
  writeln: (data: string) => void
  clear: () => void
  dispose: () => void
  loadAddon: (addon: object) => void
  onData: (cb: (data: string) => void) => { dispose: () => void }
  focus: () => void
}

interface FitAddonModule {
  FitAddon: new () => { fit: () => void }
}

interface WebLinksAddonModule {
  WebLinksAddon: new () => object
}

// Control byte / escape sequence map for the keystroke handler. Centralised
// here so the dispatch table stays exhaustive and readable.
const KEY_ENTER = '\r'
const KEY_BACKSPACE_DEL = '\x7f'
const KEY_BACKSPACE_BS = '\x08'
const KEY_CTRL_A = '\x01'
const KEY_CTRL_C = '\x03'
const KEY_CTRL_E = '\x05'
const KEY_CTRL_L = '\x0c'
const KEY_CTRL_U = '\x15'
const KEY_CTRL_W = '\x17'
const KEY_TAB = '\t'
const ESC_ARROW_UP = '\x1b[A'
const ESC_ARROW_DOWN = '\x1b[B'
const ESC_ARROW_RIGHT = '\x1b[C'
const ESC_ARROW_LEFT = '\x1b[D'
const ESC_HOME = '\x1b[H'
const ESC_END = '\x1b[F'
const ESC_DELETE = '\x1b[3~'

interface CliTerminalProps {
  /**
   * Renders in standalone mode: the resize handle is hidden, the panel
   * stretches to 100% height, and the header button switches to "Re-attach"
   * (issue #433). Defaults to the embedded in-app surface.
   */
  detached?: boolean
}

export default function CliTerminal({ detached = false }: CliTerminalProps = {}): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<XtermTerminal | null>(null)
  const handleRef = useRef<CliTerminalHandle | null>(null)
  const editorRef = useRef<LineEditorState>(makeLineEditor())
  const lastExitOkRef = useRef<boolean>(true)
  const lastWrittenIdRef = useRef<number>(0)
  const fitRef = useRef<{ fit: () => void } | null>(null)
  const { height, beginDrag, isDragging } = useCliPanelHeight()
  const { state: cliState, detach, reattach } = useCliDetach()
  const isDetachedSurface = detached
  const isDetachedState = cliState.kind === 'detached'

  const handleToggleDetach = useCallback((): void => {
    if (isDetachedSurface || isDetachedState) {
      void reattach()
    } else {
      void detach()
    }
  }, [detach, reattach, isDetachedSurface, isDetachedState])

  // The runtime hook is mounted unconditionally so it can subscribe to the
  // stores; it will start emitting useful values once `terminal` is set on
  // the handle ref. The handle is a thin wrapper so we can construct the
  // CommandContext before xterm has finished loading.
  const handleProxy = useRef<CliTerminalHandle>({
    // No-op until xterm boots; rebound from `boot()` below.
    write: () => undefined,
    writeln: () => undefined,
    clear: () => undefined,
  })
  const { ctxRef } = useCliRuntime(handleProxy.current)

  // ------------------------------------------------------------------
  // Stream log store entries → xterm
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleEntries = (entries: LogEntry[]): void => {
      const term = terminalRef.current
      if (term === null) return
      for (const entry of entries) {
        if (entry.id <= lastWrittenIdRef.current) continue
        term.write(formatLogEntry(entry))
        lastWrittenIdRef.current = entry.id
      }
    }

    const unsubscribe = useLogStore.subscribe((state) => {
      handleEntries(state.entries)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // ------------------------------------------------------------------
  // Boot xterm
  // ------------------------------------------------------------------
  useEffect(() => {
    let disposed = false
    let term: XtermTerminal | null = null
    let onDataDisposable: { dispose: () => void } | null = null

    function currentPrompt(): string {
      const state = useDeviceStore.getState()
      const config = useDashboardStore.getState().config
      return buildPrompt({
        connected: state.connected,
        configName: config?.name ?? null,
        lastExitOk: lastExitOkRef.current,
      })
    }

    function writePrompt(): void {
      if (term === null) return
      term.write(currentPrompt())
    }

    function redrawActive(): void {
      if (term === null) return
      term.write(renderActiveLine(currentPrompt(), editorRef.current))
    }

    async function dispatchInput(line: string): Promise<void> {
      if (term === null) return
      term.write('\r\n')
      let parsed
      try {
        parsed = parse(line)
      } catch (err) {
        if (err instanceof ParseError) {
          term.write(`zsh: parse error: ${err.message}\r\n`)
          lastExitOkRef.current = false
          return
        }
        throw err
      }
      if (parsed === null) {
        // Empty line — preserve previous exit status.
        return
      }
      const result = await dispatch(parsed.name, parsed.rawArgs, ctxRef.current)
      lastExitOkRef.current = result.ok
    }

    async function handleTab(): Promise<void> {
      if (term === null) return
      const editor = editorRef.current
      // Tab only meaningfully completes when the cursor is at end-of-buffer;
      // mid-buffer completion is a power-user nicety we can defer.
      if (editor.cursor !== editor.buffer.length) return
      // Tokenise current buffer using the same parser semantics. Trailing
      // whitespace means the user has moved on to a fresh arg slot.
      const trailingSpace = /\s$/.test(editor.buffer)
      let tokens: string[]
      try {
        const parsed = parse(editor.buffer)
        tokens = parsed === null ? [] : [parsed.name, ...parsed.rawArgs]
      } catch {
        return
      }
      const candidates = await complete(tokens, trailingSpace, ctxRef.current)
      if (candidates.length === 0) return
      const partial = trailingSpace ? '' : (tokens[tokens.length - 1] ?? '')
      const shared = longestCommonPrefix(candidates)
      if (candidates.length === 1) {
        const completion = (candidates[0] ?? '').slice(partial.length) + ' '
        editorRef.current = insert(editor, completion)
        redrawActive()
        return
      }
      // Multiple matches — extend by the unambiguous prefix if any, else
      // print the candidates and re-render the prompt + active buffer.
      if (shared.length > partial.length) {
        const completion = shared.slice(partial.length)
        editorRef.current = insert(editor, completion)
        redrawActive()
        return
      }
      term.write('\r\n' + candidates.join('  ') + '\r\n')
      writePrompt()
      term.write(editorRef.current.buffer)
    }

    async function boot(): Promise<void> {
      const [xtermModule, fitModule, linksModule] = (await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
        import('@xterm/addon-web-links'),
        // Side-effect import — xterm ships its own CSS and won't render
        // selection/scrollbar without it.
        import('@xterm/xterm/css/xterm.css'),
      ])) as [XtermModule, FitAddonModule, WebLinksAddonModule, unknown]

      if (disposed || containerRef.current === null) return

      const instance = new xtermModule.Terminal({
        theme: CLI_THEME,
        fontFamily: CLI_FONT_FAMILY,
        fontSize: CLI_FONT_SIZE,
        lineHeight: CLI_LINE_HEIGHT,
        cursorBlink: true,
        convertEol: false,
        scrollback: 2000,
      })
      const fit = new fitModule.FitAddon()
      const links = new linksModule.WebLinksAddon()
      instance.loadAddon(fit)
      instance.loadAddon(links)
      instance.open(containerRef.current)
      fitRef.current = fit
      try {
        fit.fit()
      } catch {
        // FitAddon throws if the container has zero size at mount; ignored.
      }

      term = instance
      terminalRef.current = instance

      const handle: CliTerminalHandle = {
        write: (data) => {
          instance.write(data)
        },
        writeln: (data) => {
          instance.writeln(data)
        },
        clear: () => {
          instance.clear()
        },
      }
      handleRef.current = handle
      // Re-point the proxy used by useCliRuntime so commands can reach xterm.
      handleProxy.current.write = handle.write
      handleProxy.current.writeln = handle.writeln
      handleProxy.current.clear = handle.clear

      // Replay all log entries that arrived before we booted.
      for (const entry of useLogStore.getState().entries) {
        if (entry.id <= lastWrittenIdRef.current) continue
        instance.write(formatLogEntry(entry))
        lastWrittenIdRef.current = entry.id
      }

      writePrompt()
      instance.focus()

      onDataDisposable = instance.onData((data) => {
        if (term === null) return
        // Ctrl+C — cancel current input.
        if (data === KEY_CTRL_C) {
          instance.write('^C\r\n')
          editorRef.current = makeLineEditor() // resets historyIndex too
          // Preserve history across cancels.
          editorRef.current = { ...editorRef.current, history: editorRef.current.history }
          writePrompt()
          return
        }
        if (data === KEY_CTRL_L) {
          instance.clear()
          writePrompt()
          instance.write(editorRef.current.buffer)
          return
        }
        if (data === KEY_ENTER) {
          const line = editorRef.current.buffer
          editorRef.current = pushHistory(editorRef.current, line)
          editorRef.current = { ...editorRef.current, buffer: '', cursor: 0 }
          void dispatchInput(line).then(() => {
            writePrompt()
          })
          return
        }
        if (data === KEY_TAB) {
          void handleTab()
          return
        }
        if (data === KEY_BACKSPACE_DEL || data === KEY_BACKSPACE_BS) {
          const next = backspace(editorRef.current)
          if (next === editorRef.current) return
          editorRef.current = next
          redrawActive()
          return
        }
        if (data === KEY_CTRL_A || data === ESC_HOME) {
          editorRef.current = moveHome(editorRef.current)
          redrawActive()
          return
        }
        if (data === KEY_CTRL_E || data === ESC_END) {
          editorRef.current = moveEnd(editorRef.current)
          redrawActive()
          return
        }
        if (data === KEY_CTRL_U) {
          editorRef.current = clearLine(editorRef.current)
          redrawActive()
          return
        }
        if (data === KEY_CTRL_W) {
          editorRef.current = deleteWordBack(editorRef.current)
          redrawActive()
          return
        }
        if (data === ESC_ARROW_UP) {
          editorRef.current = historyPrev(editorRef.current)
          redrawActive()
          return
        }
        if (data === ESC_ARROW_DOWN) {
          editorRef.current = historyNext(editorRef.current)
          redrawActive()
          return
        }
        if (data === ESC_ARROW_LEFT) {
          editorRef.current = moveLeft(editorRef.current)
          redrawActive()
          return
        }
        if (data === ESC_ARROW_RIGHT) {
          editorRef.current = moveRight(editorRef.current)
          redrawActive()
          return
        }
        if (data === ESC_DELETE) {
          editorRef.current = deleteForward(editorRef.current)
          redrawActive()
          return
        }
        // Drop other control sequences (function keys, mouse, paste-bracket
        // markers, …) — letting them through would leak escape bytes into the
        // buffer and corrupt the rendered line.
        if (data.length === 1) {
          const code = data.charCodeAt(0)
          if (code < 0x20 || code === 0x7f) return
        } else if (data.startsWith('\x1b')) {
          return
        }
        editorRef.current = insert(editorRef.current, data)
        redrawActive()
      })
    }

    void boot()

    return () => {
      disposed = true
      if (onDataDisposable !== null) {
        onDataDisposable.dispose()
      }
      if (term !== null) {
        term.dispose()
      }
      terminalRef.current = null
      handleRef.current = null
      fitRef.current = null
    }
  }, [ctxRef])

  // Re-fit xterm whenever the panel height changes so character grid stays in
  // sync with the visible area. Skipping while a drag is in progress keeps
  // the rapid mousemove updates cheap; the final fit on `mouseup` is what
  // actually matters visually.
  useEffect(() => {
    if (isDragging) return
    const fit = fitRef.current
    if (fit === null) return
    try {
      fit.fit()
    } catch {
      // Container may not have a measurable size yet; ignore.
    }
  }, [height, isDragging])

  // The detached surface fills its own BrowserWindow viewport — no need to
  // honour the in-app panel height, and the resize handle has no purpose.
  const containerHeight: number | string = isDetachedSurface ? '100%' : height
  const showResizeHandle = !isDetachedSurface
  // The Detach button doubles as Re-attach when the user has already
  // detached. Disabled while a detach is mid-flight to keep clicks idempotent.
  const detachLabel = isDetachedSurface || isDetachedState ? 'Re-attach' : 'Detach'
  const detachDisabled = !isDetachedSurface && isDetachedState

  return (
    <div
      style={{
        height: containerHeight,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0A0A',
        borderTop: '1px solid #222222',
        overflow: 'hidden',
      }}
    >
      {showResizeHandle && (
        // Resize handle — drag the top edge to grow/shrink the panel.
        <div
          role="separator"
          aria-label="Resize CLI panel"
          aria-orientation="horizontal"
          onMouseDown={beginDrag}
          style={{
            height: RESIZE_HANDLE_HEIGHT,
            flexShrink: 0,
            cursor: 'row-resize',
            background: isDragging ? '#2A2A2A' : 'transparent',
            transition: isDragging ? 'none' : 'background 0.15s ease',
          }}
        />
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: HEADER_HEIGHT,
          borderBottom: '1px solid #1A1A1A',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: '#AAAAAA',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          CLI
        </span>
        <button
          type="button"
          onClick={handleToggleDetach}
          disabled={detachDisabled}
          aria-label={detachLabel}
          style={{
            background: 'transparent',
            color: detachDisabled ? '#444444' : '#AAAAAA',
            border: '1px solid #333333',
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: detachDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {detachLabel}
        </button>
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: 6,
          overflow: 'hidden',
        }}
      />
    </div>
  )
}
