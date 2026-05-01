# CANShift
<p align="center">
  <img src="logo/CANShift_logo.png" alt="CANShift logo" width="600">
</p>

Configurable real-time automotive dashboard for the VW VR6 2.9 / MaxxECU Street.
Built on an Elecrow CrowPanel 2.8" (ESP32, 320×240).

---

## Workspace Layout

```
CANshift/
├── canshift-firmware/   # ESP32 firmware — PlatformIO / C++ / LVGL 8.3
├── canshift-studio/     # Desktop config editor — Electron + React 18 + TypeScript
├── canshift-core/       # Shared types, schemas, validation — TypeScript
├── canshift-mobile/     # iPhone app — PLANNED, docs only
└── docs/                # Architecture, roadmap, CAN notes
```

---

## Phase Status

| Project             | Status              |
|---------------------|---------------------|
| `canshift-firmware` | Working             |
| `canshift-studio`   | Working             |
| `canshift-core`     | Working             |
| `canshift-mobile`   | Not started — docs only |

**Current phase: USB first.**
All config editing and device communication goes through the desktop app over USB serial.
Wi-Fi, BLE, and the mobile app are Phase 2+.

---

## How It Works

```
MaxxECU ──CAN 500kbps──► ESP32 TWAI ──► CAN parser ──► Signal store ──► LVGL UI
                              │
                         USB serial (115200 baud, JSON lines)
                              │
                         canshift-studio
                    (config editor, CAN scanner,
                     firmware updater, live telemetry)
```

The firmware is **autonomous** — it runs without any laptop connected.
The desktop app is used to push a new config, scan the CAN bus, update firmware, and watch live telemetry.

---

## What Is Working

### Firmware
- LVGL 8.3 UI — gauge, bar, warning, button, gear, image, timer widgets
- ESP32 TWAI CAN reception at 500 kbps
- MaxxECU CAN frame parsing (RPM, throttle, temps, pressures, lambda, speed, gear, …)
- Config loaded from SPIFFS JSON (`dashboard.json`, `signals.json`) at boot
- USB serial protocol — push config, query version, screen settings, CAN scan, reboot
- CAN scan mode — forwards raw frames to the desktop app in real time
- CAN health stats — emits fps and error count every 2 s over USB
- Simulation mode — generates realistic VR6 data without live ECU (`[env:sim]`)
- DMA-heap LVGL draw buffers — avoids DRAM overflow on PSRAM-equipped boards

### Studio
- Visual dashboard editor — pages, widgets, positions, sizes, styles, signal bindings
- Signal editor — bind widgets to MaxxECU CAN signals
- USB device connection — list ports, connect, push config, reboot
- Config diff before push — shows added / removed / modified widgets
- Session restore — reopens last file on launch
- CAN bus scanner — live table of all frame IDs, data, count, fps
- CAN health indicator — live fps and error count in the status bar
- Firmware update — download release from GitHub and flash via esptool-js (Web Serial)
- Auto-update for the Studio app itself (electron-updater)
- Simulation mode — work without physical hardware

---

## Toolchain

| Tool              | Purpose                         |
|-------------------|---------------------------------|
| PlatformIO        | ESP32 build and flash           |
| C++ / Arduino     | Firmware language               |
| LVGL 8.3          | Embedded UI framework           |
| ArduinoJson 7     | JSON parsing on ESP32           |
| FreeRTOS          | Task scheduling (4 tasks)       |
| Electron 32       | Desktop app shell               |
| React 18          | Desktop app UI                  |
| TypeScript 5      | Desktop + core language         |
| Zustand           | Renderer state management       |
| electron-vite     | Dev server + bundler            |
| node-serialport   | USB serial in Electron main     |
| esptool-js        | Web Serial API firmware flash   |

---

## Getting Started

### Firmware
```bash
cd canshift-firmware

# Build and flash
pio run --target upload

# Upload SPIFFS filesystem (config JSON)
pio run --target uploadfs

# Serial monitor
pio device monitor

# Simulation mode (no hardware required)
pio run -e sim --target upload
```

Verify pin assignments in `include/board_config.h` before first flash.

### Studio
```bash
# Build canshift-core first (required by studio)
cd canshift-core && npm install && npm run build

# Then start the studio
cd canshift-studio && npm install && npm run dev
```

1. Launch the app — it restores the last opened config automatically
2. File → Open Config to load a `dashboard.json`
3. Edit pages and widgets in the editor
4. Connect the device (USB) → push config
5. Use the CAN Scanner tab to inspect live bus traffic

---

## Hardware

| Component          | Part                                  |
|--------------------|---------------------------------------|
| Display / MCU      | Elecrow CrowPanel 2.8" (ESP32-S3)     |
| ECU                | MaxxECU Street                        |
| Engine             | VW VR6 2.9                            |
| CAN transceiver    | Adafruit CAN Pal (TJA1051T/3)         |

**CAN wiring:**
```
CAN Pal CANH ── MaxxECU CAN H
CAN Pal CANL ── MaxxECU CAN L
CAN Pal CTX  ── ESP32 GPIO 22 (TWAI TX)
CAN Pal CRX  ── ESP32 GPIO 21 (TWAI RX)
CAN Pal VCC  ── 5 V
CAN Pal GND  ── GND
```

MaxxECU has internal termination — do not add a second 120 Ω terminator.

See `canshift-firmware/include/board_config.h` for all GPIO assignments.

---

## Key Assumptions (verify before first flash)

- CAN speed: 500 kbps (must match MaxxECU CAN output settings)
- MaxxECU CAN frame IDs in `signals.json` are unverified — confirm in MaxxECU software
- All GPIO assignments are assumed — verify against CrowPanel 2.8" schematic
- Config storage: SPIFFS (no SD card support yet)

---

## Releases

Tagged releases (`vX.Y.Z`) trigger a GitHub Actions workflow that builds the Studio as `.dmg` (macOS) and `.exe` (Windows) and creates a draft GitHub Release. See `CLAUDE.md` for the release process.
