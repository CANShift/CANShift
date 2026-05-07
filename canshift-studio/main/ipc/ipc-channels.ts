// ipc-channels.ts — IPC channel name constants
//
// Keep all channel names in one place to avoid typo bugs.
// These strings are the contracts between main and renderer processes.

export const IpcChannels = {
  // Config file operations
  CONFIG_OPEN: 'config:open',
  CONFIG_SAVE: 'config:save',
  CONFIG_SAVE_AS: 'config:save-as',

  // USB device operations
  USB_LIST_PORTS: 'usb:list-ports',
  USB_CONNECT: 'usb:connect',
  USB_DISCONNECT: 'usb:disconnect',
  USB_PUSH_CONFIG: 'usb:push-config',
  USB_SCREEN_SETTINGS: 'usb:screen-settings',
  USB_GET_STATUS: 'usb:get-status',
  USB_REBOOT: 'usb:reboot',
  USB_TOGGLE_DAY_NIGHT: 'usb:toggle-day-night',
  USB_CALIBRATE_TOUCH: 'usb:calibrate-touch',

  // USB events (main → renderer)
  USB_CONNECTION_CHANGED: 'usb:connection-changed',
  USB_DATA_RECEIVED: 'usb:data-received',
  USB_ERROR: 'usb:error',

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
  FIRMWARE_DOWNLOAD: 'firmware:download',
  // Main → renderer (download progress events for FIRMWARE_DOWNLOAD)
  FIRMWARE_DOWNLOAD_PROGRESS: 'firmware:download-progress',

  // Read the current dashboard.json from the connected device's SD card.
  DEVICE_GET_CONFIG: 'device:get-config',

  // Edit history (main → renderer)
  HISTORY_UNDO: 'history:undo',
  HISTORY_REDO: 'history:redo',
  // Duplicate the current widget selection (main → renderer, Cmd+D)
  EDIT_DUPLICATE: 'edit:duplicate',
  // Renderer → main: latest dirty flag — used to prompt before close
  WINDOW_SET_DIRTY: 'window:set-dirty',

  // Signal mapping
  SIGNAL_EXPORT: 'signal:export',

  // Session persistence
  SESSION_GET_LAST_FILE: 'session:get-last-file',
  SESSION_GET_LAST_PORT: 'session:get-last-port',

  // Config file — open by path (no dialog)
  CONFIG_OPEN_PATH: 'config:open-path',

  // CAN health (main → renderer)
  CAN_HEALTH_UPDATE: 'can:health-update',

  // App info
  APP_VERSION: 'app:version',

  // Main process log forwarding (main → renderer)
  APP_LOG: 'app:log',

  // Auto-update (main → renderer)
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_ERROR: 'update:error',
  // Auto-update (renderer → main)
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',

  // SD card preparation (renderer → main)
  SD_LIST_VOLUMES: 'sd:list-volumes',
  SD_PREPARE: 'sd:prepare',
  // Stream sd_contents/ to the connected board over USB (no card removal needed)
  SD_PUSH_OVER_USB: 'sd:push-over-usb',
  // Main → renderer: per-file progress while SD_PUSH_OVER_USB runs
  SD_PUSH_PROGRESS: 'sd:push-progress',

  // Device hardware config (renderer → main)
  DEVICE_CONFIG_READ: 'device:read',
  DEVICE_CONFIG_WRITE: 'device:write',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
