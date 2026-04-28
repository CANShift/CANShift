// ipc-channels.ts — IPC channel name constants
//
// Keep all channel names in one place to avoid typo bugs.
// These strings are the contracts between main and renderer processes.

export const IpcChannels = {
  // Config file operations
  CONFIG_OPEN: 'config:open',
  CONFIG_SAVE: 'config:save',
  CONFIG_SAVE_AS: 'config:save-as',
  CONFIG_RECENT: 'config:recent',

  // USB device operations
  USB_LIST_PORTS: 'usb:list-ports',
  USB_CONNECT: 'usb:connect',
  USB_DISCONNECT: 'usb:disconnect',
  USB_PUSH_CONFIG: 'usb:push-config',
  USB_GET_STATUS: 'usb:get-status',
  USB_REBOOT: 'usb:reboot',

  // USB events (main → renderer)
  USB_CONNECTION_CHANGED: 'usb:connection-changed',
  USB_DATA_RECEIVED: 'usb:data-received',
  USB_ERROR: 'usb:error',

  // Asset management
  ASSET_IMPORT_IMAGE: 'asset:import-image',
  ASSET_LIST: 'asset:list',
  ASSET_DELETE: 'asset:delete',

  // App info
  APP_VERSION: 'app:version',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
