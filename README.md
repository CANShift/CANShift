# CANShift

<p align="center">
  <img src="logo/CANShift_logo.png" alt="CANShift logo" width="600">
</p>

<p align="center"><em>Configurable real-time automotive dashboard for ESP32 — design your cluster, bind CAN signals, and push it from your desktop or phone.</em></p>

---

## Status

- **Active development** across firmware, studio, mobile, and core
- **Main branch is protected** — every change ships through a pull request
- **Releases auto-tag** from `canshift-studio/package.json` — bump the version, merge to main, and the workflow tags + builds artifacts
- Latest release: [github.com/tburkhalterr/CANShift/releases](https://github.com/tburkhalterr/CANShift/releases)

---

## What Is CANShift

CANShift is a custom instrument cluster you design yourself. The ESP32 reads CAN frames from your ECU and renders live gauges, bars, and warnings on a small touchscreen. The desktop studio and the iPhone app let you edit the layout, map signals, scan the CAN bus, and push firmware updates.

```
MaxxECU ──CAN 500 kbps──► ESP32 (CrowPanel 2.8") ──► 320×240 display
                                  │
                             USB serial (115200 baud, JSON lines)
                                  │
                             CANShift Studio (desktop)
                       (config editor · CAN scanner ·
                        live telemetry · firmware update)

                             BLE (iPhone app)
                       (live telemetry · screen settings ·
                        console · firmware OTA over Wi-Fi*)
```

\* The mobile app uses BLE for telemetry and settings. **Wi-Fi is used only when the firmware exposes its OTA access point** — the device hosts an AP, the phone connects to it, and the new firmware bundle is uploaded over HTTP. No live telemetry crosses Wi-Fi.

The firmware is **autonomous** — it runs without any app connected. Studio and the mobile app are used to configure and update it.

---

## Hardware

| Component | Part |
|-----------|------|
| Display / MCU | Elecrow CrowPanel 2.8" (ESP32, ILI9341, XPT2046 touch) |
| ECU | MaxxECU Street |
| Engine | VW VR6 2.9 |
| CAN transceiver | Adafruit CAN Pal (TJA1051T/3) |

**CAN wiring** (default — pins are configurable from Studio → Device Config and persisted in `device.json`):

```
CAN Pal CANH ── MaxxECU CAN H
CAN Pal CANL ── MaxxECU CAN L
CAN Pal CTX  ── ESP32 GPIO 25 (TWAI TX)
CAN Pal CRX  ── ESP32 GPIO 32 (TWAI RX)
CAN Pal VCC  ── 5 V
CAN Pal GND  ── GND
```

MaxxECU has internal CAN termination — do not add a second 120 Ω terminator on the ECU end.

---

## Quickstart — Install CANShift Studio

Download the latest release from [github.com/tburkhalterr/CANShift/releases](https://github.com/tburkhalterr/CANShift/releases):

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `CS-Studio-X.Y.Z-arm64.dmg` |
| macOS (Intel) | `CS-Studio-X.Y.Z-x64.dmg` |
| Windows | `CS-Studio-X.Y.Z-x64-setup.exe` |
| Linux | `CS-Studio-X.Y.Z-x64.AppImage` |

Connect your CrowPanel via USB, open Studio, and walk through the **Firmware Update** flow — Studio downloads the matching release artifacts and flashes them with progress reporting and rollback. See [`canshift-studio/README.md`](canshift-studio/README.md) for the full UI walk-through.

---

## Quickstart — Flash Firmware Manually

If Studio's updater is unavailable, flash the release artifacts directly with `esptool`:

```bash
pip install esptool

PORT=/dev/tty.usbserial-XXX
TAG=vX.Y.Z

esptool.py --chip esp32 -p "$PORT" -b 460800 \
  --before default_reset --after hard_reset write_flash \
  --flash_mode keep --flash_size keep --flash_freq keep \
  0x0      "canshift-firmware-${TAG}-crowpanel_28-merged.bin" \
  0x310000 "canshift-spiffs-${TAG}-crowpanel_28.bin"
```

The merged firmware binary (`*-merged.bin`) already embeds the bootloader at its internal `0x1000` offset and **must be flashed at `0x0`** — writing it at `0x1000` shifts every component and bricks the boot. The SPIFFS image (`*-spiffs-*.bin`) goes at `0x310000` to match `partitions/ota_4mb.csv`.

Full procedure and troubleshooting in [`canshift-firmware/README.md`](canshift-firmware/README.md).

---

## Quickstart — Development Setup

### Firmware

```bash
cd canshift-firmware

pio run --target upload         # Build and flash
pio run --target uploadfs       # Upload SPIFFS (fonts + default config)
pio device monitor              # Serial monitor at 115200 baud
pio run -e sim --target upload  # Simulation mode (no hardware required)
```

Verify pin assignments in `include/board_config.h` before first flash. See [`docs/FIRST_FLASH.md`](docs/FIRST_FLASH.md) for the full pre-flight checklist.

### Studio

```bash
# canshift-core must be built before the studio can resolve it
cd canshift-core && npm install && npm run build

cd ../canshift-studio && npm install && npm run dev
```

### Mobile

iOS-first React Native + Expo SDK 52 app. Setup commands and the `expo prebuild` flow are documented in [`canshift-mobile/README.md`](canshift-mobile/README.md) — they are not duplicated here to avoid drift.

---

## Workspace Structure

```
canshift-firmware/   ESP32 firmware — C++, PlatformIO, LVGL 8.3
canshift-studio/     Desktop app — Electron + React 18 + TypeScript
canshift-mobile/     iPhone app — React Native, Expo SDK 52
canshift-core/       Shared config types — pure TypeScript
docs/                Architecture documentation
```

| Sub-project | README |
|-------------|--------|
| Firmware | [canshift-firmware/README.md](canshift-firmware/README.md) — build, flash, pin assignments, FreeRTOS layout, USB protocol |
| Studio | [canshift-studio/README.md](canshift-studio/README.md) — dev setup, IPC, state stores, firmware update flow |
| Mobile | [canshift-mobile/README.md](canshift-mobile/README.md) — Expo setup, BLE service, OTA flow |
| Core | [canshift-core/README.md](canshift-core/README.md) — config schema, validation, migrations |
| Docs | [docs/README.md](docs/README.md) — architecture documentation index |

---

## Feature Matrix

### Firmware

- LVGL 8.3 UI — gauge, bar, warning, button, gear, image, timer widgets
- Gauge `revFlash` pulse on rev-limit (#294) and button `isToggle` + icon latch (#295)
- Explicit `set_day_night` USB command for theme toggling (#288)
- ESP32 TWAI CAN reception, configurable speed and TX/RX pins via `device.json`
- Dynamic CAN signal loading from `signals.json` at boot
- Default `dashboard.json` / `signals.json` / `device.json` written to SD on first boot when missing (#302)
- SD probe before every `lv_img_set_src` call to keep the UI alive on degraded media (#303)
- Boot continues without halting when the SD card is missing or unreadable (#254)
- Atomic `dashboard.json` writes via temp file + rename (#256)
- SD diagnostics burn-in overlay surfaces I/O failures on-screen (#297)
- Touch calibration with NVS persistence
- Day/night theme toggle
- USB serial protocol — push config, screen settings, version query, CAN scan, reboot
- CAN scan mode forwards raw frames to Studio in real time
- CAN health stats (fps, error count) every 2 s
- Simulation mode (`[env:sim]`) — realistic VR6 data without a live ECU

### Studio

- First-run onboarding modal walks new users through device pairing (#299)
- Firmware update flow redesign — clearer progress, rollback, and version surfacing (#304)
- Visual dashboard editor — pages, widgets, positions, sizes, styles, signal bindings
- Signal editor — bind widgets to MaxxECU CAN signals
- USB device connection — list ports, connect, push config with diff preview
- Live telemetry display with LIVE / SIM / NO DATA indicator
- CAN bus scanner — live table of all frame IDs, data, count, fps
- CAN health indicator in the status bar
- Degraded SD state surfaced from the firmware (#293)
- IPC return shapes deduplicated into `canshift-core/src/types/ipc.ts` (#292)
- Strict CSP and renderer sandboxing (#241)
- Manual firmware flash from a local `.bin` file
- Screen settings — brightness, sleep timeout
- Device config tab — CAN bus speed and TWAI GPIO pins, written to `device.json` on the SD card
- Studio auto-update via electron-updater
- Simulation mode — work without physical hardware

### Mobile

- BLE device scan and connect
- BLE auto-reconnect with exponential backoff and last-device persistence (#284)
- Dedicated `BleService` class encapsulates all BLE state machine logic (#301)
- Android 12+ runtime BLE permission flow (#296)
- iOS local-network entitlement + ATS exception for the firmware OTA AP (#258)
- Branching error UX for BLE failures (permissions, off, out-of-range) (#276)
- Live telemetry dashboard — RPM, speed, gear, temps, pressures
- Signal graph view
- Console tab — app and device event log
- Screen settings — brightness, sleep timeout, day/night theme toggle, touch calibration
- Firmware OTA update — fetch releases, download, flash over the firmware's Wi-Fi AP
- Simulation mode

---

## Configuration & Assumptions To Verify

- CAN speed: 500 kbps default, configurable in Studio → Device Config
- MaxxECU CAN frame IDs in `signals.json` are **unverified** — confirm in MaxxECU software before driving
- All GPIO assignments live in [`canshift-firmware/include/board_config.h`](canshift-firmware/include/board_config.h) — verify against your CrowPanel 2.8" schematic
- Config storage: SD card (user configs) + SPIFFS (fonts and bundled defaults)
- First-flash checklist: [`docs/FIRST_FLASH.md`](docs/FIRST_FLASH.md)

---

## Releases

A release is triggered automatically when a PR merging to `main` contains a new version in `canshift-studio/package.json`. **No manual tagging required.**

To ship a release:

1. Bump `canshift-studio/package.json` version on your feature branch
2. Commit: `chore(studio): bump version to X.Y.Z`
3. Open the PR, get CI green, and merge
4. The release workflow tags `vX.Y.Z` and publishes artifacts:
   - `CS-Studio-X.Y.Z-arm64.dmg` / `-x64.dmg` (macOS)
   - `CS-Studio-X.Y.Z-x64-setup.exe` (Windows)
   - `CS-Studio-X.Y.Z-x64.AppImage` (Linux)
   - `canshift-firmware-vX.Y.Z-crowpanel_28-merged.bin` (firmware)
   - `canshift-spiffs-vX.Y.Z-crowpanel_28.bin` (SPIFFS image)

---

## Contributing

The repo is public but `main` is protected — only the owner can merge. To contribute:

1. **Open an issue** describing the bug or proposal — discuss before writing code
2. **Branch** as `type/short-description` (e.g. `feat/firmware-gauge`, `fix/mobile-landscape`)
3. **Commit** in [Conventional Commits](https://www.conventionalcommits.org/) form: `feat/fix/chore/docs/ci/refactor(scope): subject`
4. **Open a PR** targeting `main` — CI runs lint, typecheck, and build on every push
5. **Wait for CI green** before requesting a merge

GitHub issues: [github.com/tburkhalterr/CANShift/issues](https://github.com/tburkhalterr/CANShift/issues)

---

## Documentation

Full architecture docs in [`docs/`](docs/):

| File | Content |
|------|---------|
| `overall-architecture.md` | System overview and data flow |
| `roadmap.md` | Phase breakdown and milestones |
| `FIRST_FLASH.md` | Pre-flight checklist for first hardware power-up |
| `usb-first-strategy.md` | Phase 1 USB communication design |
| `config-contract.md` | JSON config schema specification |
| `can-integration-notes.md` | CAN wiring and MaxxECU protocol |
| `future-wireless-strategy.md` | Phase 2 Wi-Fi and BLE plans |

---

## Roadmap & Vision

The current build targets a specific hardware stack (Elecrow CrowPanel 2.8", MaxxECU, VW VR6). The long-term goal is to make CANShift **fully open source and hardware-agnostic**:

- **Multi-board support** — flash on any ESP32 with any SPI LCD + touch (configurable display driver, resolution, pins)
- **Multi-screen-size support** — responsive LVGL layouts for 2.4", 3.5", 4.3", 7" panels
- **Multi-ECU / multi-car** — swappable signal profiles (MaxxECU, Haltech, MegaSquirt, stock OBD-II)
- **Open source release** — public repo, documented build process, community signal profiles
- **Theme editor** — visual color palette and widget style editor in Studio, exported as a theme file to the device

---

## License & Security

- License: see [`LICENSE`](LICENSE)
- Security policy and disclosure process: see [`SECURITY.md`](SECURITY.md)
