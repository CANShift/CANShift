// ipc-allowlist.test.ts — coverage for the preload IPC channel allowlists (#213).
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { IpcChannels } from './ipc-channels'
import {
  INVOKE_ALLOWED,
  LISTEN_ALLOWED,
  SEND_ALLOWED,
  assertInvokeAllowed,
  assertListenAllowed,
  assertSendAllowed,
  findUnclassifiedChannels,
} from './ipc-allowlist'

describe('ipc-allowlist — every IpcChannels entry is classified', () => {
  it('has no unclassified channels', () => {
    expect(findUnclassifiedChannels()).toEqual([])
  })
})

describe('assertInvokeAllowed', () => {
  it('accepts a known invoke channel', () => {
    expect(() => {
      assertInvokeAllowed(IpcChannels.USB_LIST_PORTS)
    }).not.toThrow()
  })

  it('rejects an unknown channel', () => {
    expect(() => {
      assertInvokeAllowed('attacker:steal-secrets')
    }).toThrow(/blocked IPC invoke channel/)
  })

  it('rejects a listen-only channel (USB_DATA_RECEIVED)', () => {
    expect(() => {
      assertInvokeAllowed(IpcChannels.USB_DATA_RECEIVED)
    }).toThrow(/blocked IPC invoke channel/)
  })

  it('rejects the send-only WINDOW_SET_DIRTY channel', () => {
    expect(() => {
      assertInvokeAllowed(IpcChannels.WINDOW_SET_DIRTY)
    }).toThrow(/blocked IPC invoke channel/)
  })
})

describe('assertSendAllowed', () => {
  it('accepts WINDOW_SET_DIRTY', () => {
    expect(() => {
      assertSendAllowed(IpcChannels.WINDOW_SET_DIRTY)
    }).not.toThrow()
  })

  it('rejects an invoke-only channel', () => {
    expect(() => {
      assertSendAllowed(IpcChannels.USB_LIST_PORTS)
    }).toThrow(/blocked IPC send channel/)
  })

  it('rejects an unknown channel', () => {
    expect(() => {
      assertSendAllowed('renderer:exfiltrate')
    }).toThrow(/blocked IPC send channel/)
  })
})

describe('assertListenAllowed', () => {
  it('accepts a known event channel', () => {
    expect(() => {
      assertListenAllowed(IpcChannels.USB_DATA_RECEIVED)
    }).not.toThrow()
  })

  it('accepts the menu-driven CONFIG_OPEN event', () => {
    expect(() => {
      assertListenAllowed(IpcChannels.CONFIG_OPEN)
    }).not.toThrow()
  })

  it('rejects an unknown channel', () => {
    expect(() => {
      assertListenAllowed('attacker:listen')
    }).toThrow(/blocked IPC listen channel/)
  })

  it('rejects an invoke-only channel that is not pushed to the renderer', () => {
    expect(() => {
      assertListenAllowed(IpcChannels.USB_LIST_PORTS)
    }).toThrow(/blocked IPC listen channel/)
  })
})

describe('allowlist sets are non-empty', () => {
  it('INVOKE_ALLOWED has entries', () => {
    expect(INVOKE_ALLOWED.size).toBeGreaterThan(0)
  })

  it('SEND_ALLOWED has entries', () => {
    expect(SEND_ALLOWED.size).toBeGreaterThan(0)
  })

  it('LISTEN_ALLOWED has entries', () => {
    expect(LISTEN_ALLOWED.size).toBeGreaterThan(0)
  })
})
