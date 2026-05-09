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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { useLogStore } from '../../stores/log.store'
import { IpcChannels } from '../../../main/ipc/ipc-channels'

const writes: string[] = []
const clearMock = vi.fn()
const ipcInvoke = vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>()
const ipcSend = vi.fn<(channel: string, ...args: unknown[]) => void>()
const ipcOn = vi.fn<(channel: string, listener: (...args: unknown[]) => void) => void>()
const ipcOff = vi.fn<(channel: string, listener: (...args: unknown[]) => void) => void>()

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

beforeEach(() => {
  ipcInvoke.mockReset()
  ipcSend.mockReset()
  ipcOn.mockReset()
  ipcOff.mockReset()
  ipcInvoke.mockResolvedValue({ state: { kind: 'inApp' }, backlog: [] })
  Object.defineProperty(window, 'ipc', {
    configurable: true,
    writable: true,
    value: {
      invoke: ipcInvoke,
      send: ipcSend,
      on: ipcOn,
      off: ipcOff,
      channels: IpcChannels,
    },
  })
})

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

async function mount(detached = false): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <MemoryRouter>{detached ? <CliTerminal detached /> : <CliTerminal />}</MemoryRouter>
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

  it('clicking the Detach button invokes CLI_DETACH', async () => {
    await mount()
    const button = container?.querySelector(
      'button[aria-label="Detach"]'
    ) as HTMLButtonElement | null
    expect(button).toBeTruthy()

    await act(async () => {
      button?.click()
      await Promise.resolve()
    })

    expect(ipcInvoke).toHaveBeenCalledWith(IpcChannels.CLI_DETACH)
  })

  it('hides the resize handle when rendered in detached mode', async () => {
    await mount(true)
    const handle = container?.querySelector('div[aria-label="Resize CLI panel"]')
    expect(handle).toBeNull()

    // Header button reads "Re-attach" in detached mode.
    const reattachBtn = container?.querySelector('button[aria-label="Re-attach"]')
    expect(reattachBtn).toBeTruthy()
  })
})
