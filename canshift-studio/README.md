# CANShift Studio
<p align="center">
  <img src="../logo/CANShift_studio_logo.png" alt="Studio logo" width="600">
</p>

Desktop configuration and management application for the CANShift dashboard.

**Stack:** Electron 32 + React 18 + TypeScript 5
**Communication:** USB serial (JSON lines, 115200 baud)
**Platforms:** macOS · Windows · Linux

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
| Live telemetry display (LIVE / SIM / NO DATA badge) | Working |
| Flash Latest (fetch from GitHub + flash via esptool) | Working |
| Manual firmware flash from local .bin file | Working |
| Screen settings (brightness, contrast, sleep, rotation) | Working |
| Studio auto-update (electron-updater) | Working |
| Simulation mode (no hardware required) | Working |

---

## Getting Started

### Prerequisites
- Node.js 20+
- `canshift-core` built: `cd ../canshift-core && npm install && npm run build`
- `esptool` installed (for firmware flashing): `pip install esptool`
  - Or install PlatformIO — Studio will find esptool in `~/.platformio/packages/tool-esptoolpy/`

### Install and run
```bash
cd canshift-studio
npm install
npm run dev          # Dev mode with hot reload
npm run build        # Production build
npm run dist         # Package (.dmg / .exe / .AppImage)
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
    │   └── UpdateRoute.tsx      # Firmware update UI (Flash Latest + manual)
    ├── components/
    │   ├── editor/
    │   │   ├── DiagnosticsPanel.tsx     # Live signal overlay (LIVE / SIM / NO DATA)
    │   │   └── ScreenSettingsPanel.tsx  # In-canvas display settings panel
    │   └── shared/
    │       ├── TopBar.tsx           # Top navigation bar
    │       ├── SideRail.tsx         # Tab navigation
    │       ├── StatusBar.tsx        # Bottom bar (connection, CAN health, dirty state)
    │       ├── ConnectScreen.tsx    # USB port selector
    │       ├── ConsolePanel.tsx     # Collapsible log console
    │       ├── UpdateBanner.tsx     # Auto-update notification banner
    │       └── PushDiffDialog.tsx   # Config diff confirmation before burn
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
    │   ├── device.store.ts      # USB connection state, firmware version, sim mode
    │   ├── canScanner.store.ts  # CAN frame table with rate tracking
    │   ├── canHealth.store.ts   # CAN health stats (fps, errors)
    │   ├── pushDiff.store.ts    # Push diff dialog state
    │   ├── signal.store.ts      # Signal definitions for diagnostics panel
    │   └── log.store.ts         # Console log entries
    └── services/
        └── ipc.service.ts       # Type-safe wrappers for all IPC calls
```

---

## IPC Channel Convention

All renderer ↔ main communication goes through `main/ipc/ipc-channels.ts`.
This file is the **single source of truth** for channel names — never hardcode strings in components or handlers.

---

## State Management

Each concern has its own Zustand store:

| Store | What it holds |
|-------|---------------|
| `dashboard.store` | Current `DashboardConfig`, dirty flag, file path |
| `device.store` | Connection status, port path, firmware version, simulation mode |
| `canScanner.store` | Live CAN frame table (id → entry with rate, count, data) |
| `canHealth.store` | Latest fps / error count from the firmware |
| `pushDiff.store` | Pending burn callback + configs for the diff dialog |
| `signal.store` | Signal definitions displayed in the diagnostics overlay |
| `log.store` | Console log entries (info, success, warn, error) |

---

## USB Protocol

Communication with the firmware uses **JSON lines over USB serial at 115200 baud**.

### Desktop → Device (commands)

| Command | JSON | Description |
|---------|------|-------------|
| `CMD_PUT_CONFIG` (0x02) | `{"cmd":2,"payload":{...}}` | Push new `dashboard.json` — device reboots after ack |
| `CMD_SCREEN_SETTINGS` (0x05) | `{"cmd":5,"brightness":80,...}` | Push display settings |
| `CMD_GET_STATUS` (0x10) | `{"cmd":16}` | Query firmware version |
| `CMD_CAN_SCAN_START` (0x20) | `{"cmd":32}` | Start forwarding raw CAN frames |
| `CMD_CAN_SCAN_STOP` (0x21) | `{"cmd":33}` | Stop CAN scan |
| `CMD_REBOOT` (0xF0) | `{"cmd":240}` | Soft reboot |

### Device → Desktop (unsolicited)

| Packet | JSON | Description |
|--------|------|-------------|
| Telemetry | `{"tele":1,"v":{"rpm":3500,"coolant_temp_c":89.2,...}}` | All live signal values, every ~200 ms |
| CAN frame | `{"can":1,"id":888,"len":8,"d":[0,1,2,3,4,5,6,7]}` | Raw frame in scan mode |
| CAN health | `{"can_stat":1,"fps":125.0,"errors":0}` | Frame rate and error count, every ~2 s |

---

## Firmware Update Flow

Studio flashes firmware via **esptool** running as a child process in the Electron main process.
This requires `esptool` to be installed — either via `pip install esptool` or via PlatformIO (auto-detected at `~/.platformio/packages/tool-esptoolpy/esptool.py`).

### Flash Latest
1. User opens **Firmware Update** tab, selects stable or beta channel
2. Studio fetches the release list from the GitHub API (`firmware.service.ts`)
3. User clicks **Flash Latest**
4. Main process downloads the `.bin` asset to a temp directory using `net.fetch`
5. USB serial is disconnected (esptool needs exclusive port access)
6. esptool flashes the merged binary at address `0x1000` (bootloader + partition table + app)
7. Progress events (`{ pct, phase }`) are streamed to the renderer via `FIRMWARE_PROGRESS`
8. On success, the device reboots automatically

### Manual flash
Same esptool flow, but the user provides a local `.bin` file. Flashed at `0x10000` (app-only binary).

---

## canshift-core Dependency

```json
"@tmbk/canshift-core": "file:../canshift-core"
```

All config types (`DashboardConfig`, `Widget`, `PageConfig`, …) come from `canshift-core`.
Always run `npm run build` in `canshift-core/` before starting Studio in development.

---

## Cutting a Release

```bash
# 1. Bump version in package.json
# 2. Commit, tag, push
git commit -am "chore(studio): bump version to X.Y.Z"
git tag vX.Y.Z
git push origin main && git push origin vX.Y.Z
```

GitHub Actions builds:
- macOS: `CS-Studio-X.Y.Z-arm64.dmg` + `CS-Studio-X.Y.Z-x64.dmg`
- Windows: `CS-Studio-X.Y.Z-x64-setup.exe`
- Linux: `CS-Studio-X.Y.Z-x64.AppImage`
- Firmware: `canshift-firmware-vX.Y.Z-crowpanel_28-merged.bin`

All artifacts are attached to a **draft** GitHub Release. Add notes and publish.

> If the tag was pushed before a CI fix, delete and recreate it:
> ```bash
> git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z
> git tag vX.Y.Z && git push origin vX.Y.Z
> ```
