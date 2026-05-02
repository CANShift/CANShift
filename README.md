# CANShift
<p align="center">
  <img src="logo/CANShift_logo.png" alt="CANShift logo" width="600">
</p>

Configurable real-time automotive dashboard for the VW VR6 2.9 / MaxxECU Street.
Built on an Elecrow CrowPanel 2.8" (ESP32, 320×240).

---

## What Is This

CANShift is a custom instrument cluster you design yourself. The ESP32 reads CAN frames from your ECU and renders live gauges, bars, and warnings on a small touchscreen. The desktop app lets you edit the layout, map signals, scan the CAN bus, and push firmware updates — all over USB.

```
MaxxECU ──CAN 500kbps──► ESP32 (CrowPanel 2.8") ──► 320×240 display
                               │
                          USB serial (115200 baud, JSON lines)
                               │
                          CANShift Studio
                    (config editor · CAN scanner
                     live telemetry · firmware update)
```

The firmware is **autonomous** — it runs without any laptop connected. The desktop app is used to configure and update it.

---

## Installing CANShift Studio

Download the latest release from [github.com/tburkhalterr/CANShift/releases](https://github.com/tburkhalterr/CANShift/releases):

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `CS-Studio-X.Y.Z-arm64.dmg` |
| macOS (Intel) | `CS-Studio-X.Y.Z-x64.dmg` |
| Windows | `CS-Studio-X.Y.Z-x64-setup.exe` |
| Linux | `CS-Studio-X.Y.Z-x64.AppImage` |

Once installed, connect your CrowPanel via USB and go to **Firmware Update → Flash Latest** to install the firmware automatically.

---

## Flashing Firmware Manually

Without Studio, use esptool directly:

```bash
pip install esptool

esptool --chip esp32 --port /dev/tty.usbserial-XXX --baud 460800 \
  write_flash --flash_mode dio --flash_freq 40m --flash_size detect \
  0x1000 canshift-firmware-vX.Y.Z-crowpanel_28-merged.bin
```

The merged binary (released as `*-crowpanel_28-merged.bin`) includes the bootloader, partition table, and application — flash it at `0x1000`.

---

## Getting Started (development)

### Firmware
```bash
cd canshift-firmware

pio run --target upload      # Build and flash
pio run --target uploadfs    # Upload SPIFFS config files
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
canshift-mobile/     iPhone app — PLANNED (docs only)
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
- ESP32 TWAI CAN reception at 500 kbps
- Dynamic CAN signal loading from `signals.json` at boot
- Config loaded from SPIFFS JSON (`dashboard.json`, `signals.json`)
- Touch calibration with NVS persistence
- Day/night theme toggle with full page rebuild
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
- **Flash Latest** — fetch latest release from GitHub and flash via esptool (no PlatformIO needed)
- Manual firmware flash from a local `.bin` file
- Screen settings — brightness, contrast, sleep timeout, rotation
- Studio auto-update (electron-updater)
- Simulation mode — work without physical hardware

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
CAN Pal CTX  ── ESP32 GPIO 22 (TWAI TX)
CAN Pal CRX  ── ESP32 GPIO 21 (TWAI RX)
CAN Pal VCC  ── 5 V
CAN Pal GND  ── GND
```

MaxxECU has internal CAN termination — do not add a second 120 Ω terminator.

---

## Key Assumptions (verify before first flash)

- CAN speed: 500 kbps — must match MaxxECU CAN output settings
- MaxxECU CAN frame IDs in `signals.json` are **unverified** — confirm in MaxxECU software
- All GPIO assignments in `board_config.h` are assumed — verify against CrowPanel 2.8" schematic
- Config storage: SPIFFS (no SD card support)

---

## Cutting a Release

```bash
# 1. Bump version in canshift-studio/package.json
git commit -am "chore(studio): bump version to X.Y.Z"
git tag vX.Y.Z
git push origin main && git push origin vX.Y.Z
```

GitHub Actions builds macOS (dmg), Windows (exe), Linux (AppImage) installers and the firmware merged binary, then creates a draft GitHub Release. Add release notes and publish.

> If the tag was pushed before a workflow fix, delete and recreate it:
> ```bash
> git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z
> git tag vX.Y.Z && git push origin vX.Y.Z
> ```

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
