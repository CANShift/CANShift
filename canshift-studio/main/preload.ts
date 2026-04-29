// preload.ts — Electron preload script
// Runs in the renderer context but with access to Node.js APIs.
// Exposes a safe, typed IPC bridge to the renderer via contextBridge.

import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from './ipc/ipc-channels'

// Track wrapper functions so off() can remove the correct ipcRenderer listener
// Map<listener, Map<channel, wrapper>>
type IpcWrapper = (event: Electron.IpcRendererEvent, ...args: unknown[]) => void

const wrapperRegistry = new WeakMap<(...args: unknown[]) => void, Map<string, IpcWrapper>>()

// Type-safe IPC bridge exposed as window.ipc
const ipc = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, listener: (...args: unknown[]) => void): void => {
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
