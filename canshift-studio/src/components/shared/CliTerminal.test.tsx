// CliTerminal.test.tsx — Smoke test for the lazy-loaded xterm host.
//
// We mock `@xterm/xterm` and its addons so the test stays in jsdom and
// doesn't try to render a real terminal. The test asserts:
//   1. The component mounts without throwing.
//   2. After boot, log store entries are forwarded to terminal.write.
//
// The repo intentionally avoids @testing-library/react (see SafeMarkdown.test);
// we drive the React tree through a raw `react-dom/client` root and let act()
// flush effects.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { useLogStore } from '../../stores/log.store'

const writes: string[] = []
const clearMock = vi.fn()

vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

vi.mock('@xterm/xterm', () => {
  function createTerminal(): unknown {
    return {
      open: () => undefined,
      write: (data: string) => {
        writes.push(data)
      },
      writeln: (data: string) => {
        writes.push(`${data}\r\n`)
      },
      clear: () => {
        clearMock()
      },
      dispose: () => undefined,
      loadAddon: () => undefined,
      onData: () => ({ dispose: () => undefined }),
      focus: () => undefined,
    }
  }
  return {
    Terminal: function Terminal(this: unknown) {
      Object.assign(this as object, createTerminal())
    },
  }
})

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: function FitAddon(this: unknown) {
    Object.assign(this as object, { fit: () => undefined })
  },
}))

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: function WebLinksAddon(this: unknown) {
    Object.assign(this as object, {})
  },
}))

vi.mock('../../services/ipc.service', () => ({
  appIpc: {
    version: () => Promise.resolve('0.7.1'),
  },
  sessionIpc: {
    getLastPortPath: () => Promise.resolve(null),
  },
  usbService: {
    listPorts: () => Promise.resolve([]),
    connect: () => Promise.resolve({ success: true }),
    disconnect: () => Promise.resolve({ success: true }),
    pushConfig: () => Promise.resolve({ success: true }),
    reboot: () => Promise.resolve({ success: true }),
  },
}))

import CliTerminal from './CliTerminal'

let container: HTMLDivElement | null = null
let root: Root | null = null

afterEach(() => {
  if (root !== null) {
    act(() => {
      root?.unmount()
    })
    root = null
  }
  if (container !== null) {
    container.remove()
    container = null
  }
  writes.length = 0
  clearMock.mockReset()
  useLogStore.setState({ entries: [] })
})

async function mount(): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <MemoryRouter>
        <CliTerminal />
      </MemoryRouter>
    )
    await Promise.resolve()
  })
  // Allow the chained dynamic imports + log replay to resolve.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

describe('CliTerminal', () => {
  it('mounts without throwing and writes the prompt', async () => {
    await mount()
    const out = writes.join('')
    expect(out).toContain('canshift@')
  })

  it('forwards new log store entries to terminal.write', async () => {
    await mount()
    writes.length = 0

    await act(async () => {
      useLogStore.getState().push('info', 'hello from test', 'usb')
      await Promise.resolve()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const out = writes.join('')
    expect(out).toContain('hello from test')
    expect(out).toContain('[usb]')
  })
})
