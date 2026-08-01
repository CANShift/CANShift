# CANShift

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo/brand/canshift-lockup-baseline-outlined-onblack.svg">
    <img src="logo/brand/canshift-lockup-baseline-outlined.svg" alt="CANShift logo" width="480">
  </picture>
</p>

<p align="center"><em>Configurable real-time automotive dashboard for ESP32 — design your cluster, bind CAN signals, and push it from your desktop or phone.</em></p>

---

## Status

- **Active development** across firmware, tuner, mobile, and core
- **Full visual restyle in progress** — new "Bracket" brand identity, restyled Tuner, dash and mobile surfaces. Tracked in [#1838](https://github.com/tburkhalterr/CANShift/issues/1838), design reference in [`docs/design/restyle-handoff.md`](docs/design/restyle-handoff.md), brand assets in [`logo/brand/`](logo/brand/)
- **Main branch is protected** — every change ships through a pull request
- **Releases are firmware-only** since the dash-hosted-Studio cutover (#1077) — the workflow tags + builds the merged firmware binary + SPIFFS image. Studio installer artifacts and mobile artifacts are no longer published.
- Latest release: [github.com/tburkhalterr/CANShift/releases](https://github.com/tburkhalterr/CANShift/releases)

---

## Release v0.11.0 — dash-hosted Studio v1 (in flight)

First release after the firmware-only pipeline cutover (#1077). The Electron Studio installer is no longer published; the dash-hosted Studio SPA ships embedded in the firmware OTA payload and is served from the on-device WebServer.

**Highlights**

- Dash-hosted Studio reaches v1 — Vite + React SPA served from the firmware over WiFi AP, live data on WebSocket port 81 (#1104 / #1107 / #1108 / #1114 / #1117).
- On-device WiFi AP trigger for phone-less Studio users — toggle from the dash without going through the mobile app (#1119).
- 4 MB flash repartition to unblock the `_wifi` build env (`ota_4mb_wifi.csv`, SPIFFS moved to `0x370000`, 1856 KB app slots) (#1117 / #1120 / #1126).
- Dispatcher handlers for `device-config` and `input-bindings` WS commands, with `CMD_GET_CONFIG` routed through `sendLine` for WS/TCP parity (#1123 / #1124).
- Target screen profile selector + per-profile dashboard layouts (#1128).
- Visual theme editor scaffold in studio-web (#1131).
- User-selectable dashboard font scaffold (#1132).
- Optional cruise-control screen template (#1133).
- Secure-boot v2 rollout — partition + CI + docs (#1134).
- Firmware: BarWidget / taskUI split into orchestrator + phase helpers (#1014 — #1127 / #1129).
- Firmware: clang-tidy promoted to gating + UBSan on sim (#936 Phase 0 — #1130).
- Docs: README sweep for dash-hosted Studio architecture (#1113 / #1122).

**Pipeline change** — `release.yml` now contains only `check-version` + `firmware-release`. The `studio-release` matrix job (electron-builder for DMG / NSIS / AppImage) is gone. Release artifacts are limited to the merged firmware binary, the OTA partition image, and the SPIFFS image.

**Mobile** — tracks separately and is deferred while firmware + tuner stabilise; `canshift-mobile/package.json` is intentionally not bumped with this release.

---

## What Is CANShift

CANShift is a custom instrument cluster you design yourself. The ESP32 reads CAN frames from your ECU and renders live gauges, bars, and warnings on a small touchscreen. Three companion surfaces let you configure, update, and inspect the dash without recompiling firmware:

- **Tuner** (`canshift-tuner/`) — Vercel-hosted Betaflight-style configurator. Talks to the dash over **WebSerial** via the CH340 UART. Open the Vercel URL in Chrome / Edge / Brave / Opera, click `Connect device`, edit pages and bind signals live. No install, no on-device WiFi (#1351).
- **USB flasher** (Tuner → **Firmware** tab) — built-in browser-based esptool (`esptool-js`) that flashes the merged firmware image over Web Serial. Used for first-flash, recovery, and partition-layout migration (#1351).
- **Mobile app** (`canshift-mobile/`) — iPhone-first, BLE telemetry + settings. Independent of the Tuner; pairs directly with the dash over BLE.

```
                       ECU ──CAN──► ESP32 (CrowPanel 2.8") ──► 320×240 display
                                              │
                                              │
                       ┌──────────────────────┼──────────────────────┐
                       │                      │                      │
                  WiFi AP (dash)         WiFi AP (dash)             BLE
                  HTTP :80 / WS :81      POST /update                 │
                       │                      │                      │
                       ▼                      ▼                      ▼
                 Dash-hosted Studio       Mobile OTA           Mobile (iPhone)
                 (browser SPA served      (firmware upload     (BLE telemetry +
                  from firmware           over HMAC-signed     settings, AP trigger)
                  SPIFFS, live data       payload)
                  on WS port 81)
```

Plus, for first-flash / recovery: the Tuner's **Firmware** tab writes the merged firmware + SPIFFS image over Web Serial.

The firmware is **autonomous** — it runs without any app connected. The surfaces above are used to configure and update it.

---

## Hardware

| Component | Part |
|-----------|------|
| Display / MCU | Elecrow CrowPanel 2.8" (ESP32, ILI9341, XPT2046 touch) |
| ECU | Any CAN-enabled ECU |
| CAN transceiver | [Adafruit CAN Pal (TJA1051T/3)](https://www.digikey.ch/fr/products/detail/adafruit-industries-llc/5708/18716420) |

**CAN wiring** (default — pins are configurable from Studio → Device Config and persisted in `device.json`):

```
CAN Pal CANH ── ECU CAN H
CAN Pal CANL ── ECU CAN L
CAN Pal CTX  ── ESP32 GPIO 25 (TWAI TX)
CAN Pal CRX  ── ESP32 GPIO 32 (TWAI RX)
CAN Pal VCC  ── 5 V
CAN Pal GND  ── GND
```

Check your ECU's datasheet for CAN termination — some ECUs have internal termination, some require an external 120 Ω resistor.

---

## Quickstart — First flash + connect

1. **Flash the firmware over USB.** Open the Tuner at [canshift.tmbk.ch](https://canshift.tmbk.ch) in a Chromium-based browser, plug in the CrowPanel, and use the **Firmware** tab to flash the latest release. The flasher reads the merged firmware + SPIFFS images from the latest GitHub release and writes them via Web Serial (`esptool-js`). No installer to download.
2. **Bring the dash's WiFi AP up.** On a fresh device the AP is dormant. Swipe the on-screen top bar down, open Settings, toggle **WIFI AP → ON**. The setting persists in NVS so subsequent boots auto-start the AP. The mobile app can also trigger the AP via BLE.
3. **Connect to the dash-hosted Studio.** Join the `CANShift-XXXX` SSID with the password shown on the dash, then navigate any browser to `http://canshift.local` (or the AP IP). The dash serves the Studio SPA from port 80; live data flows over WebSocket on port 81 (#1108).

---

## Quickstart — Flash Firmware Manually

If the Tuner's built-in USB flasher is unavailable, flash the release artifacts directly with `esptool`:

```bash
pip install esptool

PORT=/dev/tty.usbserial-XXX
TAG=vX.Y.Z

esptool.py --chip esp32 -p "$PORT" -b 460800 \
  --before default_reset --after hard_reset write_flash \
  --flash_mode keep --flash_size keep --flash_freq keep \
  0x0      "canshift-firmware-${TAG}-crowpanel_28-merged.bin" \
  0x370000 "canshift-spiffs-${TAG}-crowpanel_28.bin"
```

The merged firmware binary (`*-merged.bin`) already embeds the bootloader at its internal `0x1000` offset and **must be flashed at `0x0`** — writing it at `0x1000` shifts every component and bricks the boot. The SPIFFS image (`*-spiffs-*.bin`) goes at `0x370000` to match the post-#1117 / #1120 layout in `partitions/ota_4mb_wifi.csv` (512 KB SPIFFS, 1856 KB app slots). Dashes flashed before #1117 still expect `0x310000` and must be re-flashed via USB to migrate — OTA across the partition-table change is unsafe.

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

### Tuner (`canshift-tuner/`)

```bash
# canshift-core must be built before the tuner can resolve it
cd canshift-core && npm install && npm run build

cd ../canshift-tuner && npm install && npm run dev
# http://localhost:5173 — `vite dev` drops into simulation mode when no device
# is connected; plug in a CrowPanel and click `Connect device` for live WebSerial.
```

### Mobile

iOS-first React Native + Expo SDK 52 app. Setup commands and the `expo prebuild` flow are documented in [`canshift-mobile/README.md`](canshift-mobile/README.md) — they are not duplicated here to avoid drift.

---

## Workspace Structure

```
canshift-firmware/    ESP32 firmware — C++, PlatformIO, LVGL 8.3
canshift-tuner/       Vercel-hosted Tuner — Betaflight-style configurator, WebSerial transport (#1351)
canshift-mobile/      iPhone app — React Native, Expo SDK 52
canshift-core/        Shared config types — pure TypeScript
docs/                 Architecture documentation
```

| Sub-project | README |
|-------------|--------|
| Firmware | [canshift-firmware/README.md](canshift-firmware/README.md) — build, flash, pin assignments, FreeRTOS layout, USB protocol |
| Tuner | [canshift-tuner/README.md](canshift-tuner/README.md) — Betaflight-style configurator, WebSerial transport |
| Mobile | [canshift-mobile/README.md](canshift-mobile/README.md) — Expo setup, BLE service |
| Core | [canshift-core/README.md](canshift-core/README.md) — config schema, validation, migrations, design tokens |
| Docs | [docs/README.md](docs/README.md) — architecture documentation index |

---

## Feature Matrix

### Firmware

- LVGL 8.3 UI — gauge, bar, warning, button, gear, image, timer widgets
- Gauge `revFlash` pulse on rev-limit (#294) and button `isToggle` + icon latch (#295)
- Explicit `set_day_night` USB command for theme toggling (#288)
- ESP32 TWAI CAN reception, configurable speed and TX/RX pins via `device.json`
- Dynamic CAN signal loading from `signals.json` at boot
- Default `dashboard.json` / `signals.json` / `device.json` written to SPIFFS on first boot when missing (#302)
- Storage probe before every `lv_img_set_src` call to keep the UI alive on missing assets (#303)
- Boot continues without halting when SPIFFS fails to mount (#254)
- Atomic `dashboard.json` writes via temp file + rename (#256)
- Burn-in overlay surfaces storage I/O failures on-screen (#297)
- Touch calibration with NVS persistence
- Day/night theme toggle
- USB serial protocol — push config, screen settings, version query, CAN scan, reboot
- CAN scan mode forwards raw frames to Studio in real time
- CAN health stats (fps, error count) every 2 s
- Simulation mode (`[env:sim]`) — realistic engine data without a live ECU

### Studio

- First-run onboarding modal walks new users through device pairing (#299)
- Firmware update flow redesign — clearer progress, rollback, and version surfacing (#304)
- Visual dashboard editor — pages, widgets, positions, sizes, styles, signal bindings
- Signal editor — bind widgets to CAN signals
- USB device connection — list ports, connect, push config with diff preview
- Live telemetry display with LIVE / SIM / NO DATA indicator
- CAN bus scanner — live table of all frame IDs, data, count, fps
- CAN health indicator in the status bar
- IPC return shapes deduplicated into `canshift-core/src/types/ipc.ts` (#292)
- Strict CSP and renderer sandboxing (#241)
- Manual firmware flash from a local `.bin` file
- Screen settings — brightness, sleep timeout
- Device config tab — CAN bus speed and TWAI GPIO pins, written to `device.json` on SPIFFS
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
- CAN frame IDs in `signals.json` are examples — map them to your ECU's actual output before driving
- All GPIO assignments live in [`canshift-firmware/include/board_config.h`](canshift-firmware/include/board_config.h) — verify against your CrowPanel 2.8" schematic
- Config storage: SPIFFS (configs, fonts, and bundled defaults)
- First-flash checklist: [`docs/FIRST_FLASH.md`](docs/FIRST_FLASH.md)

---

## Releases

A release is triggered automatically when a PR merging to `main` contains a new version in `canshift-firmware/package.json`. **No manual tagging required.**

To ship a release:

1. Bump `canshift-firmware/package.json` version on your feature branch
2. Commit: `chore(firmware): bump version to X.Y.Z`
3. Open the PR, get CI green, and merge
4. The release workflow tags `vX.Y.Z` and publishes the **firmware-only** artifacts:
   - `canshift-firmware-vX.Y.Z-crowpanel_28-merged.bin` (merged firmware — includes bootloader, partition table, the embedded dash-hosted Studio SPA, and OTA HMAC trailer)
   - `canshift-spiffs-vX.Y.Z-crowpanel_28.bin` (SPIFFS image — default configs, fonts, sensor icons)

Studio installer artifacts (DMG / NSIS / AppImage) and mobile binaries are **no longer published** — the dash-hosted Studio ships inside the firmware payload, the USB flasher is built into the Tuner, and mobile distributes through TestFlight / Play Store separately.

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
| `ARCHITECTURE.md` | C4-style architecture — system context, containers, components, data flow, invariants |
| `overall-architecture.md` | System overview and data flow (narrative companion) |
| `RELEASE.md` | Release process — cadence, artifacts, validation, rollback |
| `roadmap.md` | Phase breakdown and milestones |
| `FIRST_FLASH.md` | Pre-flight checklist for first hardware power-up |
| `config-contract.md` | JSON config schema specification |
| `can-integration-notes.md` | CAN wiring and ECU integration |

---

## Roadmap & Vision

CANShift is designed to work with **any CAN-enabled ECU and any vehicle**. The signal mapping is fully configurable via `signals.json` — map your ECU's frame IDs and byte positions, push the config from Studio, and the dashboard adapts without recompiling firmware.

- **Multi-board support** — flash on any ESP32 with any SPI LCD + touch (configurable display driver, resolution, pins)
- **Multi-screen-size support** — responsive LVGL layouts for 2.4", 3.5", 4.3", 7" panels
- **Multi-ECU / multi-car** — swappable signal profiles (Haltech, MegaSquirt, stock OBD-II, custom)
- **Open source release** — public repo, documented build process, community signal profiles
- **Theme editor** — visual color palette and widget style editor in Studio, exported as a theme file to the device

---

## License & Security

- License: see [`LICENSE`](LICENSE)
- Security policy and disclosure process: see [`SECURITY.md`](SECURITY.md)
