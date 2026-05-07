/// <reference types="vite/client" />

declare module '*.png' {
  const src: string
  export default src
}
declare module '*.svg' {
  const src: string
  export default src
}
declare module '*.jpg' {
  const src: string
  export default src
}
declare module '*.webp' {
  const src: string
  export default src
}

// Electron context bridge exposed by main/preload.ts
interface Window {
  ipc: {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    send: (channel: string, ...args: unknown[]) => void
    on: (channel: string, listener: (...args: unknown[]) => void) => void
    off: (channel: string, listener: (...args: unknown[]) => void) => void
    channels: typeof import('../main/ipc/ipc-channels').IpcChannels
  }
}
