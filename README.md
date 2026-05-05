# CANShift
<p align="center">
  <img src="logo/CANShift_logo.png" alt="CANShift logo" width="600">
</p>

Configurable real-time automotive dashboard. Currently built for the VW VR6 2.9 / MaxxECU Street on an Elecrow CrowPanel 2.8" (ESP32, 320×240), with a roadmap toward open-source multi-board, multi-car, multi-screen-size support.

---

## What Is This

CANShift is a custom instrument cluster you design yourself. The ESP32 reads CAN frames from your ECU and renders live gauges, bars, and warnings on a small touchscreen. The desktop app and iPhone app let you edit the layout, map signals, scan the CAN bus, and push firmware updates.

```
MaxxECU ──CAN 500kbps──► ESP32 (CrowPanel 2.8") ──► 320×240 display
                               │
                          USB serial (115200 baud, JSON lines)
                               │
                          CANShift Studio (desktop)
                    (config editor · CAN scanner
                     live telemetry · firmware update)

                          BLE (iPhone app)
                    (live telemetry · screen settings
                     console · firmware OTA)
```

The firmware is **autonomous** — it runs without any app connected. Studio and the mobile app are used to configure and update it.

---

## Installing CANShift Studio

Download the latest release from [github.com/tburkhalterr/CANShift/releases](https://github.com/tburkhalterr/CANShift/releases):

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `CS-Studio-X.Y.Z-arm64.dmg` |
| macOS (Intel) | `CS-Studio-X.Y.Z-x64.dmg` |
| Windows | `CS-Studio-X.Y.Z-x64-setup.exe` |
| Linux | `CS-Studio-X.Y.Z-x64.AppImage` |

Once installed, connect your CrowPanel via USB and go to **Firmware Update → Flash Latest** to install the firmware and SPIFFS filesystem automatically.

---

## Flashing Firmware Manually

Without Studio, use esptool directly:

```bash
pip install esptool

esptool --chip esp32 --port /dev/tty.usbserial-XXX --baud 460800 \
  write_flash --flash_mode dio --flash_freq 40m --flash_size detect \
  0x1000 canshift-firmware-vX.Y.Z-crowpanel_28-merged.bin
```

The merged binary (released as `*-crowpanel_28-merged.bin`) includes the bootloader, partition table, and application — flash it at `0x1000`. The SPIFFS image (`*-spiffs-*.bin`) must be flashed at `0x310000`.

---

## Getting Started (development)

### Firmware
```bash
cd canshift-firmware

pio run --target upload      # Build and flash
pio run --target uploadfs    # Upload SPIFFS (fonts + config)
pio device monitor           # Serial monitor at 115200 baud
pio run -e sim --target upload  # Simulation mode (no hardware required)
```

Verify pin assignments in `include/board_config.h` before first flash.

### Studio
```bash
# Build canshift-core first (required by studio)
cd canshift-core && npm install && npm run build

cd canshift-studio && npm install && npm run dev
```

---

## Workspace Structure

```
canshift-firmware/   ESP32 firmware — C++, PlatformIO, LVGL 8.3
canshift-studio/     Desktop app — Electron + React 18 + TypeScript
canshift-core/       Shared config types — pure TypeScript
canshift-mobile/     iPhone app — React Native, Expo SDK 52
docs/                Architecture documentation
```

| Sub-project | README |
|-------------|--------|
| Firmware | [canshift-firmware/README.md](canshift-firmware/README.md) — build, flash, pin assignments, FreeRTOS layout, USB protocol |
| Studio | [canshift-studio/README.md](canshift-studio/README.md) — dev setup, architecture, IPC, state management, release process |
| Core | [canshift-core/README.md](canshift-core/README.md) — config schema, types, versioning |

---

## Feature Status

### Firmware
- LVGL 8.3 UI — gauge, bar, warning, button, gear, image, timer widgets
- ESP32 TWAI CAN reception, configurable speed via `device.json`
- Dynamic CAN signal loading from `signals.json` at boot
- Config loaded from SD card (`dashboard.json`, `signals.json`, `device.json`)
- Montserrat fonts loaded from SPIFFS — 7 sizes, ~76 KB, no flash bloat
- Touch calibration with NVS persistence
- Day/night theme toggle
- USB serial protocol — push config, screen settings, version query, CAN scan, reboot
- CAN scan mode — forwards raw frames to Studio in real time
- CAN health stats — fps and error count every 2 s
- Simulation mode (`[env:sim]`) — realistic VR6 data without live ECU

### Studio
- Visual dashboard editor — pages, widgets, positions, sizes, styles, signal bindings
- Signal editor — bind widgets to CAN signals
- USB device connection — list ports, connect, push config with diff preview
- Live telemetry display with LIVE / SIM / NO DATA indicator
- CAN bus scanner — live table of all frame IDs, data, count, fps
- CAN health indicator in the status bar
- **Flash Latest** — fetch latest release from GitHub, flash firmware + SPIFFS in one click (no PlatformIO needed)
- Manual firmware flash from a local `.bin` file
- Screen settings — brightness, contrast, sleep timeout, rotation
- Device config tab — configure CAN bus speed and TWAI GPIO pins, write `device.json` to SD
- Studio auto-update (electron-updater)
- Simulation mode — work without physical hardware

### Mobile (iPhone)
- BLE device scan and connect
- Live telemetry dashboard — RPM, speed, gear, temps, pressures
- Signal graph view
- Screen settings push via BLE
- Console tab — app and device event log
- Firmware OTA update — fetch releases, download, flash over Wi-Fi AP
- Simulation mode

---

## Hardware

| Component | Part |
|-----------|------|
| Display / MCU | Elecrow CrowPanel 2.8" (ESP32, ILI9341, XPT2046 touch) |
| ECU | MaxxECU Street |
| Engine | VW VR6 2.9 |
| CAN transceiver | Adafruit CAN Pal (TJA1051T/3) |

**CAN wiring:**
```
CAN Pal CANH ── MaxxECU CAN H
CAN Pal CANL ── MaxxECU CAN L
CAN Pal CTX  ── ESP32 GPIO 22 (TWAI TX)  ← configurable in Studio
CAN Pal CRX  ── ESP32 GPIO 21 (TWAI RX)  ← configurable in Studio
CAN Pal VCC  ── 5 V
CAN Pal GND  ── GND
```

MaxxECU has internal CAN termination — do not add a second 120 Ω terminator.

---

## Key Assumptions (verify before first flash)

- CAN speed: 500 kbps default — configurable in Studio → Device Config
- MaxxECU CAN frame IDs in `signals.json` are **unverified** — confirm in MaxxECU software
- All GPIO assignments in `board_config.h` are assumed — verify against CrowPanel 2.8" schematic
- Config storage: SD card + SPIFFS (fonts and defaults)

---

## Cutting a Release

> **Internal note** — the repo is public but main is protected. Only the owner can approve and merge pull requests. Never push directly to main.

To ship a new version:

1. Create a branch and bump `canshift-studio/package.json` version
2. Commit: `chore(studio): bump version to X.Y.Z`
3. Open a PR targeting `main` — CI runs automatically
4. Merge the PR — the Release workflow fires automatically

GitHub Actions builds macOS (.dmg), Windows (.exe), Linux (.AppImage) installers, the merged firmware binary, and the SPIFFS image, then creates a GitHub Release tagged `vX.Y.Z`.

**No manual tagging required.** The workflow detects a new version in `package.json` and creates the tag automatically.

---

## Roadmap & Vision

The current build targets a specific hardware stack (Elecrow CrowPanel 2.8", MaxxECU, VW VR6). The long-term goal is to make CANShift **fully open source and hardware-agnostic**:

- **Multi-board support** — flash on any ESP32 with any SPI LCD + touch (configurable display driver, resolution, pins)
- **Multi-screen-size support** — responsive LVGL layouts for 2.4", 3.5", 4.3", 7" panels
- **Multi-ECU / multi-car** — swappable signal profiles (MaxxECU, Haltech, MegaSquirt, stock OBD-II)
- **Open source release** — public repo, documented build process, community signal profiles
- **Theme editor** — visual color palette and widget style editor in Studio, exported as a theme file to the device

---

## Documentation

Full architecture docs in [`docs/`](docs/):

| File | Content |
|------|---------|
| `overall-architecture.md` | System overview and data flow |
| `roadmap.md` | Phase breakdown and milestones |
| `usb-first-strategy.md` | Phase 1 USB communication design |
| `config-contract.md` | JSON config schema specification |
| `can-integration-notes.md` | CAN wiring and MaxxECU protocol |
| `future-wireless-strategy.md` | Phase 2 Wi-Fi and BLE plans |
