# canshift-studio

Desktop configuration studio for the automotive dashboard.

**This is the primary configuration tool in Phase 1.**

**Stack:** Electron + React 18 + TypeScript
**Phase 1 focus:** USB-first config editing and sync to the ESP32 dashboard

---

## Phase 1 Strategy: USB First

The desktop application is the **only** configuration tool in Phase 1.
The iPhone mobile app is not being built now.

The configuration workflow in Phase 1:
1. Open the dashboard config JSON in the desktop editor
2. Edit pages, widgets, signal bindings, themes visually
3. Connect the ESP32 via USB
4. Push the updated config to the device over USB serial
5. The dashboard firmware reloads the config

There is no OTA, no Wi-Fi, no Bluetooth in Phase 1.
All configuration changes go through this desktop application.

---

## Current Status

Foundation scaffolded. The following is in place:
- Electron + React + TypeScript project structure
- Main process (`main/`) and renderer process (`renderer/`) separation
- IPC bridge for main ↔ renderer communication
- USB communication service stub (`src/usb/`)
- Config file service stub (open/save JSON)
- React app shell with routing placeholders
- `canshift-core` integration plan (via local path dependency)
- Component placeholders for editor, preview, signal binding
- `package.json` with all key dependencies declared

**Not yet implemented:**
- Actual visual drag-drop widget editor
- Real USB serial protocol (pending firmware USB protocol spec)
- Asset import UI
- Live preview rendering

---

## Folder Structure

```
canshift-studio/
├── package.json
├── tsconfig.json
├── tsconfig.main.json          # TypeScript config for Electron main process
├── electron.vite.config.ts     # Vite + electron-vite build config
├── .eslintrc.json
├── main/                       # Electron main process (Node.js context)
│   ├── index.ts                # Main process entry point
│   ├── ipc/
│   │   ├── ipc-handlers.ts     # IPC handler registration
│   │   └── ipc-channels.ts     # Channel name constants
│   ├── services/
│   │   ├── config-file.service.ts  # Open/save config JSON files
│   │   ├── usb.service.ts          # USB serial communication (node-serialport)
│   │   └── asset.service.ts        # Asset file management
│   └── menu.ts                 # Application menu
├── src/                        # Renderer process (React)
│   ├── main.tsx                # React entry point
│   ├── App.tsx                 # Root component, router
│   ├── routes/
│   │   ├── EditorRoute.tsx     # Dashboard layout editor
│   │   ├── SignalRoute.tsx     # Signal binding editor
│   │   ├── ThemeRoute.tsx      # Theme editor
│   │   └── DeviceRoute.tsx     # USB device connection and sync
│   ├── components/
│   │   ├── editor/
│   │   │   ├── Canvas.tsx      # Widget drag-drop canvas (320×240 preview)
│   │   │   ├── WidgetPalette.tsx# Widget type selector
│   │   │   ├── PropertyPanel.tsx# Widget property editor
│   │   │   └── PageNav.tsx     # Page list and add/remove
│   │   ├── signal/
│   │   │   ├── SignalList.tsx  # List of defined CAN signals
│   │   │   ├── FrameEditor.tsx # CAN frame definition editor
│   │   │   └── SignalBinder.tsx# Bind widget → signal
│   │   ├── theme/
│   │   │   ├── ThemeEditor.tsx # Color/style theme editor
│   │   │   └── ColorPicker.tsx # Color selection component
│   │   ├── device/
│   │   │   ├── DevicePanel.tsx # USB connection status and controls
│   │   │   └── SyncControls.tsx# Push config to device
│   │   └── shared/
│   │       ├── TopBar.tsx      # App top bar
│   │       └── StatusBar.tsx   # Bottom status (connection, save state)
│   ├── stores/                 # Zustand state stores
│   │   ├── dashboard.store.ts  # Dashboard config state
│   │   ├── device.store.ts     # USB device connection state
│   │   └── ui.store.ts         # Editor UI state (selection, etc.)
│   ├── services/               # Renderer-side services
│   │   ├── ipc.service.ts      # Type-safe IPC bridge calls
│   │   └── validation.service.ts# Config validation (uses canshift-core)
│   ├── hooks/
│   │   ├── useDashboard.ts     # Dashboard state access
│   │   └── useDevice.ts        # USB device state access
│   └── types/
│       └── ipc.types.ts        # IPC message type definitions
├── shared/                     # Code shared between main and renderer
│   └── constants.ts            # Shared constants
└── assets/                     # App-level static assets
    └── icons/
```

---

## Technology Choices

### Why Electron?
- Cross-platform (macOS, Windows, Linux) from a single codebase
- Direct access to USB serial via `node-serialport` in the main process
- Full filesystem access for opening/saving config files and assets
- Long-lived tooling choice — no vendor lock-in
- Large ecosystem, well-documented, actively maintained

### Why not Tauri?
Tauri is a valid alternative (smaller bundle, Rust backend).
Chosen Electron because:
- `node-serialport` has excellent Node.js support
- React + TypeScript familiarity
- Easier onboarding for JS/TS developers

### Why Vite + electron-vite?
- Fast HMR in development
- Clean separation of main/renderer bundles
- TypeScript everywhere

### State: Zustand
- Lightweight, no boilerplate
- React 18 compatible
- Easy to split stores by concern

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- (macOS) Xcode Command Line Tools for native modules

### Install and Run
```bash
cd canshift-studio
npm install
npm run dev          # Development mode (hot reload)
npm run build        # Production build
npm run dist         # Package for distribution
```

### First Run
1. `npm install` — installs all dependencies
2. `npm run dev` — opens the Electron app in dev mode
3. Use File → Open Config to load a `dashboard.json` from `canshift-firmware/data/config/`
4. Edit pages and widgets in the canvas view
5. File → Save Config to write changes back

---

## USB Communication (Phase 1)

The USB communication protocol between the desktop app and the ESP32 firmware is defined in:
- `docs/usb-first-strategy.md` (architecture)
- Firmware side: `canshift-firmware/src/hal/usb/usb_comm.h`
- Desktop side: `main/services/usb.service.ts`

**Current status:** Both sides have stubs. The wire protocol needs to be finalized
once the firmware's USB serial task is implemented.

Planned protocol:
- USB serial at 115200 baud
- JSON-framed messages (length-prefixed or newline-delimited)
- Commands: GET_CONFIG, PUT_CONFIG, GET_STATUS, REBOOT
- The firmware acknowledges each command

---

## canshift-core Integration

`canshift-core` is the source of truth for config schemas and TypeScript types.
It is consumed here as a local npm dependency:

```json
// package.json
"dependencies": {
  "@tmbk/canshift-core": "file:../canshift-core"
}
```

When `canshift-core` is published to npm, this reference is updated to a version range.
This is the only coupling between this project and any other project in the workspace.

---

## Connections to Other Projects

- **canshift-core** → source of config types and validation used in this app
- **canshift-firmware** → target device; config is pushed to it over USB
- **canshift-mobile** (future) → will share the same `canshift-core` types

---

## Immediate Next Steps (Phase 1)

1. [ ] Implement `main/services/usb.service.ts` — list ports, connect, send/receive
2. [ ] Finalize USB wire protocol with firmware team
3. [ ] Implement canvas drag-drop with 320×240 viewport constraints
4. [ ] Implement `PropertyPanel.tsx` — edit widget position, size, style, signal
5. [ ] Implement `SignalList.tsx` and `FrameEditor.tsx` for CAN signal definitions
6. [ ] Implement `SyncControls.tsx` — push config to device and confirm receipt
7. [ ] Add config validation feedback using `canshift-core` validators

---

## Resume Work From Here

1. `cd canshift-studio && npm install && npm run dev`
2. The app should open; an empty editor canvas should be visible
3. Load `canshift-firmware/data/config/dashboard.json` via File → Open
4. Focus first on the USB service — this is the critical Phase 1 deliverable
5. Then focus on the canvas editor and widget property panel
