// CliTerminal.tsx — xterm-backed CLI panel (issue #378, PR 1).
//
// The whole component is loaded via `React.lazy` from App.tsx, so `@xterm/xterm`
// and its addons stay out of the main renderer chunk. The classic
// `ConsolePanel` is still rendered while this module fetches.
//
// Scope of PR 1: render the xterm host, stream the log store, support a
// minimal keystroke loop (Enter / Backspace / Ctrl+C / Ctrl+L). History,
// autocomplete, and full command set land in PR 2; resize + detach in PR 3.

import { useEffect, useRef } from 'react'
import { useLogStore, type LogEntry } from '../../stores/log.store'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useDeviceStore } from '../../stores/device.store'
import { useCliSettingsStore } from '../../stores/cliSettings.store'
import { dispatch } from '../../cli/commands'
import { formatLogEntry } from '../../cli/format'
import { parse, ParseError } from '../../cli/parse'
import { buildPrompt } from '../../cli/prompt'
import { CLI_FONT_FAMILY, CLI_FONT_SIZE, CLI_LINE_HEIGHT, CLI_THEME } from '../../cli/theme'
import { useCliRuntime } from '../../cli/useCliRuntime'
import type { CliTerminalHandle } from '../../cli/types'

const PANEL_HEIGHT = 240

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

export default function CliTerminal() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<XtermTerminal | null>(null)
  const handleRef = useRef<CliTerminalHandle | null>(null)
  const inputBufferRef = useRef<string>('')
  const lastExitOkRef = useRef<boolean>(true)
  const lastWrittenIdRef = useRef<number>(0)
  const setEnabled = useCliSettingsStore((s) => s.setEnabled)

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

    function writePrompt(): void {
      if (term === null) return
      const state = useDeviceStore.getState()
      const config = useDashboardStore.getState().config
      term.write(
        buildPrompt({
          connected: state.connected,
          configName: config?.name ?? null,
          lastExitOk: lastExitOkRef.current,
        })
      )
    }

    function clearInputLine(): void {
      if (term === null) return
      // \r → carriage return, \x1b[K → erase to end of line.
      term.write('\r\x1b[K')
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
        // Ctrl+C → cancel current input.
        if (data === '\x03') {
          instance.write('^C\r\n')
          inputBufferRef.current = ''
          writePrompt()
          return
        }
        // Ctrl+L → clear screen and redraw.
        if (data === '\x0c') {
          instance.clear()
          writePrompt()
          instance.write(inputBufferRef.current)
          return
        }
        // Enter
        if (data === '\r') {
          const line = inputBufferRef.current
          inputBufferRef.current = ''
          void dispatchInput(line).then(() => {
            writePrompt()
          })
          return
        }
        // Backspace (DEL = 0x7F, BS = 0x08)
        if (data === '\x7f' || data === '\x08') {
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1)
            instance.write('\b \b')
          }
          return
        }
        // Other control sequences (history, cursor, Tab) — left for PR 2.
        if (data.length === 1) {
          const code = data.charCodeAt(0)
          if (code < 0x20 || code === 0x7f) return
        } else if (data.startsWith('\x1b')) {
          return
        }
        inputBufferRef.current += data
        instance.write(data)
        // Reference clearInputLine so it isn't tree-shaken away — reserved
        // for upcoming Ctrl+U handling in PR 2.
        void clearInputLine
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
    }
  }, [ctxRef])

  return (
    <div
      style={{
        height: PANEL_HEIGHT,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0A0A',
        borderTop: '1px solid #222222',
        overflow: 'hidden',
      }}
    >
      {/* Header — mirrors ConsolePanel layout for visual continuity. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: 24,
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
          onClick={() => {
            setEnabled(false)
          }}
          title="Switch back to the classic console"
          style={{
            background: 'none',
            border: 'none',
            color: '#3A3A3A',
            cursor: 'pointer',
            fontSize: 10,
            padding: '0 2px',
          }}
        >
          Classic console ←
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
