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
  USB_SCREEN_SETTINGS: 'usb:screen-settings',
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

  // CAN scanner
  CAN_SCAN_START: 'can:scan-start',
  CAN_SCAN_STOP: 'can:scan-stop',
  // Main → renderer (batched frame array)
  CAN_FRAME_BATCH: 'can:frame-batch',

  // Firmware management
  FIRMWARE_QUERY_VERSION: 'firmware:query-version',
  FIRMWARE_LIST_RELEASES: 'firmware:list-releases',
  FIRMWARE_ENTER_FLASH: 'firmware:enter-flash',
  FIRMWARE_EXIT_FLASH: 'firmware:exit-flash',
  FIRMWARE_UPDATE_WIFI: 'firmware:update-wifi',
  // Main → renderer
  FIRMWARE_PROGRESS: 'firmware:progress',

  // Edit history (main → renderer)
  HISTORY_UNDO: 'history:undo',
  HISTORY_REDO: 'history:redo',

  // Signal mapping
  SIGNAL_EXPORT: 'signal:export',

  // Session persistence
  SESSION_GET_LAST_FILE: 'session:get-last-file',

  // Config file — open by path (no dialog)
  CONFIG_OPEN_PATH: 'config:open-path',

  // CAN health (main → renderer)
  CAN_HEALTH_UPDATE: 'can:health-update',

  // App info
  APP_VERSION: 'app:version',

  // Auto-update (main → renderer)
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_ERROR: 'update:error',
  // Auto-update (renderer → main)
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
