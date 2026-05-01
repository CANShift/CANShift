# CANShift Studio
<p align="center">
  <img src="../logo/CANShift_studio_logo.png" alt="Studio logo" width="600">
</p>

Desktop configuration and management application for the CANShift dashboard.

**Stack:** Electron 32 + React 18 + TypeScript 5
**Communication:** USB serial (JSON lines, 115200 baud)

---

## What It Does

| Feature | Status |
|---------|--------|
| Visual dashboard editor (pages, widgets, layout, styles) | Working |
| Signal binding editor | Working |
| USB device connection (list ports, connect, disconnect) | Working |
| Push config to device with diff preview | Working |
| Session restore (reopens last file on launch) | Working |
| CAN bus scanner (live frame table with fps) | Working |
| CAN health indicator in status bar | Working |
| Live telemetry display | Working |
| Firmware update via esptool-js (Web Serial) | Working |
| Studio auto-update (electron-updater) | Working |
| Simulation mode (no hardware required) | Working |

---

## Getting Started

### Prerequisites
- Node.js 20+
- `canshift-core` built (`cd ../canshift-core && npm install && npm run build`)

### Install and run
```bash
cd canshift-studio
npm install
npm run dev          # Dev mode with hot reload
npm run build        # Production build
npm run dist         # Package (creates .dmg / .exe)
```

### Pre-commit checks (must all pass before committing)
```bash
npm run lint          # ESLint (zero errors)
npm run format:check  # Prettier
npm run typecheck     # tsc --noEmit (both tsconfig.json and tsconfig.main.json)
```

---

## Architecture

```
canshift-studio/
├── main/                        # Electron main process (Node.js)
│   ├── index.ts                 # Entry point, window creation, auto-update
│   ├── menu.ts                  # Application menu
│   ├── preload.ts               # Context bridge (exposes window.ipc)
│   ├── ipc/
│   │   ├── ipc-channels.ts      # Channel name constants (single source of truth)
│   │   └── ipc-handlers.ts      # All IPC handler registrations
│   └── services/
│       ├── config-file.service.ts   # Open / save config JSON (with dialog)
│       ├── usb.service.ts           # USB serial — connect, push config, CAN scan
│       ├── firmware.service.ts      # GitHub release fetching, flash port management
│       ├── session.service.ts       # Persist last opened file path across sessions
│       └── updater.service.ts       # electron-updater auto-update
└── src/                         # Renderer process (React 18 + Vite)
    ├── App.tsx                  # Root component, routes, global hooks
    ├── routes/
    │   ├── EditorRoute.tsx      # Dashboard layout editor
    │   ├── SignalRoute.tsx      # Signal binding editor
    │   ├── CanScannerRoute.tsx  # Live CAN frame scanner
    │   └── UpdateRoute.tsx      # Firmware update UI
    ├── components/shared/
    │   ├── TopBar.tsx           # Top navigation bar
    │   ├── SideRail.tsx         # Tab navigation (editor / signals / scanner / update)
    │   ├── StatusBar.tsx        # Bottom bar (connection, CAN health, dirty state)
    │   ├── ConnectScreen.tsx    # USB port selector shown when disconnected
    │   ├── ConsolePanel.tsx     # Collapsible log console
    │   ├── UpdateBanner.tsx     # Auto-update notification banner
    │   ├── FirmwareDialog.tsx   # Firmware flash / update modal
    │   └── PushDiffDialog.tsx   # Config diff confirmation before burn
    ├── hooks/
    │   ├── useConfigActions.ts  # open / save / burn with diff
    │   ├── useMenuEvents.ts     # Electron menu event bridge
    │   ├── useUsbConnection.ts  # USB connect / disconnect, CAN health listener
    │   ├── useSessionRestore.ts # Restore last file on app launch
    │   ├── useLiveSignals.ts    # Telemetry subscription
    │   ├── useFirmwareCheck.ts  # Version check on connect
    │   └── useUpdater.ts        # App auto-update
    ├── stores/
    │   ├── dashboard.store.ts   # Config state (current config, dirty flag, file path)
    │   ├── device.store.ts      # USB connection state, last pushed config
    │   ├── canScanner.store.ts  # CAN scanner frame table with rate tracking
    │   ├── canHealth.store.ts   # CAN health stats (fps, errors)
    │   ├── pushDiff.store.ts    # Push diff dialog state
    │   └── log.store.ts         # Console log entries
    └── services/
        └── ipc.service.ts       # Type-safe wrappers for all IPC calls
```

---

## USB Protocol

Communication with the firmware uses **JSON lines over USB serial at 115200 baud**.
Each message is one JSON object followed by `\n`.

### Desktop → Device (commands)

| Command | JSON | Description |
|---------|------|-------------|
| `CMD_PUT_CONFIG` (0x02) | `{"cmd":2,"payload":{...}}` | Push new `dashboard.json` content — device reboots after ack |
| `CMD_SCREEN_SETTINGS` (0x05) | `{"cmd":5,"brightness":80,...}` | Push display settings |
| `CMD_GET_STATUS` (0x10) | `{"cmd":16}` | Query firmware version |
| `CMD_CAN_SCAN_START` (0x20) | `{"cmd":32}` | Start forwarding raw CAN frames |
| `CMD_CAN_SCAN_STOP` (0x21) | `{"cmd":33}` | Stop CAN scan |
| `CMD_REBOOT` (0xF0) | `{"cmd":240}` | Soft reboot |

### Device → Desktop (unsolicited)

| Packet | JSON | Description |
|--------|------|-------------|
| Telemetry | `{"tele":1,"v":{"rpm":3500,"coolant_temp_c":89.2,...}}` | All live signal values, every ~200 ms |
| CAN frame | `{"can":1,"id":888,"len":8,"d":[0,1,2,3,4,5,6,7]}` | Raw frame when scan mode active |
| CAN health | `{"can_stat":1,"fps":125.0,"errors":0}` | Frame rate and error count, every ~2 s |

### Device → Desktop (command responses)

```json
{"status":"ok"}
{"status":"error","message":"reason"}
```

---

## IPC Channel Convention

All renderer ↔ main communication goes through `main/ipc/ipc-channels.ts`.
This file is the single source of truth for channel names — never hardcode strings.

---

## State Management

Each concern has its own Zustand store:

| Store | What it holds |
|-------|---------------|
| `dashboard.store` | Current `DashboardConfig`, dirty flag, file path |
| `device.store` | Connection status, port path, firmware version, last pushed config |
| `canScanner.store` | Live CAN frame table (id → entry with rate, count, data) |
| `canHealth.store` | Latest fps / error count from the firmware |
| `pushDiff.store` | Pending burn callback + configs for the diff dialog |
| `log.store` | Console log entries (info, success, warn, error) |

---

## Firmware Update Flow

1. User clicks "Check for updates" in the Update tab
2. Studio fetches releases from the GitHub API via `firmware.service.ts`
3. User selects a release — firmware `.bin` is downloaded in the renderer
4. Studio calls `FIRMWARE_ENTER_FLASH` → main process disconnects the Node.js serial port
5. Renderer opens the same port via the **Web Serial API** (browser API available in Electron)
6. `esptool-js` flashes the binary at 921600 baud with progress reporting
7. Device reboots, Studio reconnects and queries the new version

---

## canshift-core Dependency

```json
"@tmbk/canshift-core": "file:../canshift-core"
```

All config types (`DashboardConfig`, `Widget`, `PageConfig`, …) and the `validateDashboard()` function come from `canshift-core`. Always run `npm run build` in `canshift-core/` before starting the studio in development.
