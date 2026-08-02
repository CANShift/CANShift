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

- **Active development** across firmware, tuner, docs, and core; mobile is deferred while firmware + tuner stabilise
- **"Bracket" visual identity shipped** — firmware dash, Tuner and docs surfaces restyled ([#1838](https://github.com/tburkhalterr/CANShift/issues/1838) complete); design reference in [`docs/design/restyle-handoff.md`](docs/design/restyle-handoff.md), brand assets in [`logo/brand/`](logo/brand/)
- **Tuner UX flows in progress** — drag-to-bind signals, undo/autosave, multi-project model ([`docs/design/tuner-flows.md`](docs/design/tuner-flows.md))
- **Main branch is protected** — every change ships through a pull request
- **Releases are firmware-only** — the workflow tags + builds the merged firmware binary + SPIFFS image. The Tuner deploys continuously from `main`; mobile distributes separately.
- Latest release: [github.com/tburkhalterr/CANShift/releases](https://github.com/tburkhalterr/CANShift/releases)

---

## What Is CANShift

CANShift is a custom instrument cluster you design yourself. The ESP32 reads CAN frames from your ECU and renders live gauges, bars, and warnings on a small touchscreen. Three companion surfaces let you configure, update, and inspect the dash without recompiling firmware:

- **Tuner** (`canshift-tuner/`) — Vercel-hosted Betaflight-style configurator. Talks to the dash over **WebSerial** via the CH340 UART. Open the Vercel URL in Chrome / Edge / Brave / Opera, click `Connect device`, edit pages and bind signals live. No install, no on-device WiFi (#1351).
- **USB flasher** (Tuner → **Firmware** tab) — built-in browser-based esptool (`esptool-js`) that flashes the merged firmware image over Web Serial. Used for first-flash, recovery, and partition-layout migration (#1351).
- **Mobile app** (`canshift-mobile/`) — iPhone-first, BLE telemetry + settings. Independent of the Tuner; pairs directly with the dash over BLE.

```
                       ECU ──CAN──► ESP32 (CrowPanel 2.8") ──► 320×240 display
                                              │
                              ┌───────────────┴───────────────┐
                              │                               │
                        USB (WebSerial)                      BLE
                        CH340 UART                            │
                              │                               │
                              ▼                               ▼
                       Tuner (browser)                 Mobile (iPhone)
                       (editor, flasher,               (BLE telemetry +
                        CAN scan, live                  settings)
                        data, CLI)
```

The firmware is **autonomous** — it runs without any app connected. The surfaces above are used to configure and update it.

---

## Hardware

| Component       | Part                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Display / MCU   | Elecrow CrowPanel 2.8" (ESP32, ILI9341, XPT2046 touch)                                                           |
| ECU             | Any CAN-enabled ECU                                                                                              |
| CAN transceiver | [Adafruit CAN Pal (TJA1051T/3)](https://www.digikey.ch/fr/products/detail/adafruit-industries-llc/5708/18716420) |

**CAN wiring** (default — pins are configurable from the Tuner and persisted in `device.json`):

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
2. **Connect the Tuner.** Still at [canshift.tmbk.ch](https://canshift.tmbk.ch), click **Connect device** — the Tuner talks WebSerial over the same USB cable. Edit pages, bind CAN signals from the live scan, then **Burn to device**.
3. **(Optional) Pair the mobile app.** The iPhone app pairs over BLE for live telemetry and settings.

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

Verify pin assignments in `include/board_config.h` before first flash. Full pre-flight checklist on the docs site: [docs.canshift.tmbk.ch](https://docs.canshift.tmbk.ch) → User guide → Install.

### Tuner (`canshift-tuner/`)

```bash
# canshift-core must be built before the tuner can resolve it
cd canshift-core && npm install && npm run build

cd ../canshift-tuner && npm install && npm run dev
# http://localhost:5173 — `vite dev` drops into simulation mode when no device
# is connected; plug in a CrowPanel and click `Connect device` for live WebSerial.
```

### Mobile

iOS-first React Native + Expo SDK 54 app. Setup commands and the `expo prebuild` flow are documented in [`canshift-mobile/README.md`](canshift-mobile/README.md) — they are not duplicated here to avoid drift.

---

## Workspace Structure

```
canshift-firmware/    ESP32 firmware — C++ (+ Rust modules), PlatformIO, LVGL 8.3
canshift-tuner/       Vercel-hosted Tuner — Betaflight-style configurator, WebSerial transport
canshift-mobile/      iPhone app — React Native, Expo SDK 54 (deferred)
canshift-core/        Shared config schemas, migrations, widget metrics — pure TypeScript + Zod
canshift-docs/        Documentation site — Astro + Starlight → docs.canshift.tmbk.ch
docs/design/          Design references — restyle handoff, tuner flows, brand mockups
logo/                 Brand assets
```

One-time after cloning: `npm install` at the repo root arms the husky pre-commit hooks (prettier + per-package eslint + clang-format on staged files).

| Sub-project | README                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Firmware    | [canshift-firmware/README.md](canshift-firmware/README.md) — build, flash, pin assignments, FreeRTOS layout, USB protocol |
| Tuner       | [canshift-tuner/README.md](canshift-tuner/README.md) — Betaflight-style configurator, WebSerial transport                 |
| Mobile      | [canshift-mobile/README.md](canshift-mobile/README.md) — Expo setup, BLE service                                          |
| Core        | [canshift-core/README.md](canshift-core/README.md) — config schema, validation, migrations, design tokens                 |
| Docs        | [canshift-docs/README.md](canshift-docs/README.md) — Astro + Starlight site, user guide + technical docs                  |

---

## Feature Matrix

### Firmware

- LVGL 8.3 UI — gauge, warning, button, gear, image, timer, shift-light widgets
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
- CAN scan mode forwards raw frames to the Tuner in real time
- CAN health stats (fps, error count) every 2 s
- Simulation mode (`[env:sim]`) — realistic engine data without a live ECU

### Tuner

- Visual dashboard editor — pages, widgets, drag/resize on a 12-column grid, multi-select, align tools
- 100-step undo/redo with labelled history panel; autosave to local storage restores the exact canvas on reload
- Signals panel fed by the live CAN scan — drag a signal onto the canvas to create a bound widget, onto a widget to rebind it
- CAN bus scanner with byte histograms, promote-to-signal, and a **Learn** mode that ranks frame IDs by how much they changed
- Multi-project model — pages + widgets + ECU profile + theme + target panel switch as one unit
- Theme presets (8) applied dash-wide; day/night handling
- ECU profiles (MaxxECU, …) and OBD-II Mode 01 polling
- Built-in USB flasher (`esptool-js`) — first flash, recovery, releases from GitHub
- Live data grid, logs, CLI view with opcode reference
- Burn with post-reboot verification; unbound-widget gate before burning
- Crash reporting (Sentry) and product analytics (PostHog) with a visible opt-out — payloads, frame IDs and names are scrubbed
- Simulation mode — full editor without hardware

### Mobile

- BLE device scan and connect
- BLE auto-reconnect with exponential backoff and last-device persistence (#284)
- Dedicated `BleService` class encapsulates all BLE state machine logic (#301)
- Android 12+ runtime BLE permission flow (#296)
- Branching error UX for BLE failures (permissions, off, out-of-range) (#276)
- Live telemetry dashboard — RPM, speed, gear, temps, pressures
- Signal graph view
- Console tab — app and device event log
- Screen settings — brightness, sleep timeout, day/night theme toggle, touch calibration
- Simulation mode

Note — mobile is deferred; firmware updates go through the Tuner's USB flasher since the WiFi stack removal (#1351).

---

## Configuration & Assumptions To Verify

- CAN speed: 500 kbps default, configurable in the Tuner
- CAN frame IDs in `signals.json` are examples — map them to your ECU's actual output before driving
- All GPIO assignments live in [`canshift-firmware/include/board_config.h`](canshift-firmware/include/board_config.h) — verify against your CrowPanel 2.8" schematic
- Config storage: SPIFFS (configs, fonts, and bundled defaults)
- First-flash checklist: [docs.canshift.tmbk.ch](https://docs.canshift.tmbk.ch) → User guide → Install

---

## Releases

A release is triggered automatically when a PR merging to `main` contains a new version in `canshift-firmware/package.json`. **No manual tagging required.**

To ship a release:

1. Bump `canshift-firmware/package.json` version on your feature branch
2. Commit: `chore(firmware): bump version to X.Y.Z`
3. Open the PR, get CI green, and merge
4. The release workflow tags `vX.Y.Z` and publishes the **firmware-only** artifacts:
   - `canshift-firmware-vX.Y.Z-crowpanel_28-merged.bin` (merged firmware — includes bootloader, partition table, and OTA HMAC trailer)
   - `canshift-spiffs-vX.Y.Z-crowpanel_28.bin` (SPIFFS image — default configs, fonts, sensor icons)

Only firmware artifacts are published — the Tuner deploys continuously from `main` (Vercel), the USB flasher is built into the Tuner, and mobile distributes through TestFlight / Play Store separately.

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

- **User + technical docs**: [docs.canshift.tmbk.ch](https://docs.canshift.tmbk.ch) — getting started, install/first flash, configuration, firmware architecture, reference, contributing. Source in [`canshift-docs/`](canshift-docs/); the changelog renders GitHub Releases at build time.
- **Design references**: [`docs/design/`](docs/design/) — restyle handoff, tuner UX flows, brand mockups.

---

## Roadmap & Vision

CANShift is designed to work with **any CAN-enabled ECU and any vehicle**. The signal mapping is fully configurable via `signals.json` — map your ECU's frame IDs and byte positions, push the config from Studio, and the dashboard adapts without recompiling firmware.

- **Multi-board support** — flash on any ESP32 with any SPI LCD + touch (configurable display driver, resolution, pins)
- **Multi-screen-size support** — responsive LVGL layouts for 2.4", 3.5", 4.3", 7" panels
- **Multi-ECU / multi-car** — swappable signal profiles (Haltech, MegaSquirt, stock OBD-II, custom)
- **Open source release** — public repo, documented build process, community signal profiles

---

## License & Security

- License: see [`LICENSE`](LICENSE)
- Security policy and disclosure process: see [`SECURITY.md`](SECURITY.md)
