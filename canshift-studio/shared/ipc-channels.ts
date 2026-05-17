// ipc-channels.ts — IPC channel name constants
//
// Keep all channel names in one place to avoid typo bugs.
// These strings are the contracts between main and renderer processes.

export const IpcChannels = {
  // Config file operations
  CONFIG_OPEN: 'config:open',
  CONFIG_SAVE: 'config:save',
  CONFIG_SAVE_AS: 'config:save-as',
  // Import = load a foreign JSON without binding it as the working file path.
  // Export = write a snapshot copy without changing the working file path.
  CONFIG_IMPORT: 'config:import',
  CONFIG_EXPORT: 'config:export',

  // USB device operations
  USB_LIST_PORTS: 'usb:list-ports',
  USB_CONNECT: 'usb:connect',
  USB_DISCONNECT: 'usb:disconnect',
  USB_PUSH_CONFIG: 'usb:push-config',
  USB_SCREEN_SETTINGS: 'usb:screen-settings',
  USB_GET_STATUS: 'usb:get-status',
  USB_REBOOT: 'usb:reboot',
  USB_TOGGLE_DAY_NIGHT: 'usb:toggle-day-night',
  USB_SET_DAY_NIGHT: 'usb:set-day-night',
  USB_CALIBRATE_TOUCH: 'usb:calibrate-touch',

  // USB events (main → renderer)
  USB_CONNECTION_CHANGED: 'usb:connection-changed',
  USB_DATA_RECEIVED: 'usb:data-received',
  USB_ERROR: 'usb:error',
  // Structured firmware log line — payload: { level, tag, message }
  USB_DEVICE_LOG: 'usb:device-log',

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
  FIRMWARE_RETRY_RESET: 'firmware:retry-reset',
  FIRMWARE_DOWNLOAD: 'firmware:download',
  // Main → renderer (download progress events for FIRMWARE_DOWNLOAD)
  FIRMWARE_DOWNLOAD_PROGRESS: 'firmware:download-progress',
  // Download a small text sibling (e.g. .sha256). Same host allowlist as
  // FIRMWARE_DOWNLOAD, capped server-side at FIRMWARE_TEXT_MAX_BYTES so a
  // hostile mirror can't stream an unbounded body through main.
  FIRMWARE_DOWNLOAD_TEXT: 'firmware:download-text',

  // Read the current dashboard.json from the connected device's storage.
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
  SESSION_GET_FIRST_RUN_COMPLETED: 'session:get-first-run-completed',
  SESSION_MARK_FIRST_RUN_COMPLETED: 'session:mark-first-run-completed',
  SESSION_RESET_FIRST_RUN: 'session:reset-first-run',

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

  // Device hardware config (renderer → main)
  DEVICE_CONFIG_READ: 'device:read',
  DEVICE_CONFIG_WRITE: 'device:write',

  // Physical GPIO button bindings (issue #833)
  INPUT_BINDINGS_READ: 'inputs:read',
  INPUT_BINDINGS_WRITE: 'inputs:write',

  // GitHub releases info card (issue #571)
  // Renderer → main: fetch latest stable + pre-release info, cached.
  RELEASES_GET_LATEST: 'releases:get-latest',

  // CLI panel detach (issue #433)
  // Renderer → main: spawn / close the detached BrowserWindow, query state.
  CLI_DETACH: 'cli:detach',
  CLI_REATTACH: 'cli:reattach',
  CLI_GET_STATE: 'cli:get-state',
  // Main → renderer: state changes broadcast to every CLI surface.
  CLI_STATE_CHANGED: 'cli:state-changed',
  // Main → renderer: rebroadcast a batch of log entries to other CLI surfaces.
  // Payload is `CliLogPayload[]` — coalesced from one or more `publish()`
  // calls made in the same event-loop turn (#712).
  CLI_LOG_BROADCAST_BATCH: 'cli:log-broadcast-batch',
  // Renderer → main (fire-and-forget): forward a freshly-pushed log entry.
  CLI_LOG_PUSH: 'cli:log-push',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
