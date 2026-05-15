// preload.ts — Electron preload script
// Runs in the renderer context but with access to Node.js APIs.
// Exposes a safe, typed IPC bridge to the renderer via contextBridge.
//
// The bridge enforces per-direction channel allowlists (see ipc-allowlist.ts)
// so a compromised renderer cannot reach arbitrary internal channels.

import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/ipc-channels'
import { assertInvokeAllowed, assertListenAllowed, assertSendAllowed } from './ipc/ipc-allowlist'

// Track wrapper functions so off() can remove the correct ipcRenderer listener
// Map<listener, Map<channel, wrapper>>
type IpcWrapper = (event: Electron.IpcRendererEvent, ...args: unknown[]) => void

const wrapperRegistry = new WeakMap<(...args: unknown[]) => void, Map<string, IpcWrapper>>()

// Type-safe IPC bridge exposed as window.ipc
const ipc = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    assertInvokeAllowed(channel)
    return ipcRenderer.invoke(channel, ...args)
  },
  send: (channel: string, ...args: unknown[]): void => {
    assertSendAllowed(channel)
    ipcRenderer.send(channel, ...args)
  },
  on: (channel: string, listener: (...args: unknown[]) => void): void => {
    assertListenAllowed(channel)
    const wrapper: IpcWrapper = (_event, ...args) => {
      listener(...args)
    }
    let channelMap = wrapperRegistry.get(listener)
    if (!channelMap) {
      channelMap = new Map()
      wrapperRegistry.set(listener, channelMap)
    }
    channelMap.set(channel, wrapper)
    ipcRenderer.on(channel, wrapper)
  },
  off: (channel: string, listener: (...args: unknown[]) => void): void => {
    assertListenAllowed(channel)
    const channelMap = wrapperRegistry.get(listener)
    const wrapper = channelMap?.get(channel)
    if (wrapper && channelMap) {
      ipcRenderer.removeListener(channel, wrapper)
      channelMap.delete(channel)
    }
  },
  channels: IpcChannels,
}

contextBridge.exposeInMainWorld('ipc', ipc)
