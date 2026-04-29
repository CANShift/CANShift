// preload.ts — Electron preload script
// Runs in the renderer context but with access to Node.js APIs.
// Exposes a safe, typed IPC bridge to the renderer via contextBridge.

import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from './ipc/ipc-channels'

// Type-safe IPC bridge exposed as window.ipc
const ipc = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, listener: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => {
      listener(...(args as unknown[]))
    })
  },
  off: (channel: string, listener: (...args: unknown[]) => void): void => {
    ipcRenderer.removeListener(channel, listener)
  },
  channels: IpcChannels,
}

contextBridge.exposeInMainWorld('ipc', ipc)
