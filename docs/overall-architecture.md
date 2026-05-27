# Overall Architecture — CANShift

## System Purpose

CANShift is a configurable real-time automotive dashboard that works with any CAN-enabled ECU and vehicle. Signal mapping is fully runtime-configurable via `signals.json` — no firmware recompile needed to adapt to a different ECU or car.

Hardware context:
- ECU: any CAN-enabled ECU
- Display: Elecrow CrowPanel 2.8" ESP32 (320×240, ILI9341 + XPT2046)
- CAN transceiver: Adafruit CAN Pal (TJA1051T/3)

---

## Project Boundaries

```
                            canshift-firmware (ESP32, standalone)
                            ─────────────────────────────────────
                            C++ / PlatformIO / LVGL 8.3
                            - CAN bus ingestion (TWAI)
                            - Real-time UI (LVGL 8.3)
                            - Config loaded from SPIFFS
                            - USB JSON-lines on UART0
                            - BLE GATT (TELE/STATUS/SETTINGS/CMD)
                            - WiFi AP — HTTP on 80, WS on 81 (#1108)
                            - Serves canshift-studio-web SPA from
                              SPIFFS data partition (#1077 phase 4 / #1123)
                                          │
              ┌───────────────────────────┼─────────────────────────┐
              ▼                           ▼                         ▼
        CAN bus (ECU)                BLE GATT                   WiFi AP
                                                          ┌────────┴─────────┐
                                                          ▼                  ▼
                                                       HTTP/WS          POST /ota
                                                          ▲                  ▲
                                                          │                  │
                                                ┌─────────┴────────┐         │
                                                │canshift-studio-web│         │
                                                │(dash-hosted, the │         │
                                                │ canonical Studio │         │
                                                │ since #1077)     │         │
                                                │- Browser SPA     │         │
                                                │  served from the │         │
                                                │  firmware itself │         │
                                                │- Live data via   │         │
                                                │  WS on port 81   │         │
                                                └──────────────────┘         │
                                                                             │
              ┌──────────────────────┐                                       │
              │  canshift-flasher    │                                       │
              │  (separate repo,     │                                       │
              │  #1081 — browser     │                                       │
              │  esptool hosted at   │                                       │
              │  canshift.tmbk.ch)   │                                       │
              │  - First-flash       │                                       │
              │  - Recovery          │                                       │
              │  - Partition migrate │                                       │
              └──────────────────────┘                                       │
                                                                             │
                                                                  ┌──────────┴──────┐
                                                                  │ canshift-mobile │
                                                                  │ (iOS / Android) │
                                                                  │ - BLE telemetry │
                                                                  │ - Settings push │
                                                                  │ - Triggers AP   │
                                                                  │ - Wi-Fi OTA via │
                                                                  │   POST /ota on  │
                                                                  │   192.168.4.1   │
                                                                  │   with HMAC     │
                                                                  └─────────────────┘

                            canshift-core (TypeScript library)
                            ──────────────────────────────────
                            Config types · Zod schemas · validation · migration chain
                            Design tokens (DARK_TOKENS, statusDanger, scrim, …)
                            Consumed by studio-web and mobile;
                            mirrored in firmware src/config/config_types.h
```

---

## Data Flow

### Real-time operation (no PC connected)

```
Your ECU
    │
    │ CAN bus (configurable speed)
    ▼
Adafruit CAN Pal (TJA1051T/3)
    │ TWAI
    ▼
ESP32 TWAI controller
    │
    ▼
CanManager (FreeRTOS task, core 0)
    │ raw CAN frames
    ▼
CanParser → SignalStore (thread-safe)
                    │
                    ├── AlertEngine (rev limiter, warnings)
                    │       │
                    │       ▼
                    │   UI overlays (LVGL, core 1)
                    │
                    └── WidgetFactory (reads at render tick)
                            │
                            ▼
                        LVGL display (ILI9341 via SPI)
```

### Bench configuration workflow — dash-hosted Studio (canonical, #1077)

```
Developer / User
    │
    │ joins dash WiFi AP (CANShift-XXXX), navigates a browser to
    │ http://canshift.local (or AP IP)
    ▼
ESP32 WebServer (port 80) serves canshift-studio-web SPA from
                              board_build.embed_files
    │
    │ opens/edits in the browser-based Studio
    ▼
canshift-studio-web (browser SPA)
    │ validates with canshift-core schemas / migrates if needed
    │
    │ WebSocket on port 81 (JSON object per text frame, #1108)
    ▼
ESP32 wifi_ws.cpp → same UsbComm::handleLine() dispatcher as USB
    │
    ▼
StorageDriver → atomic writes to SPIFFS
    │
    ▼
ConfigLoader::reloadAll() → PageManager / WidgetFactory rebuild UI
```

### First-flash / recovery — USB flasher (canshift.tmbk.ch, #1081)

```
User / Maintainer
    │
    │ navigates to https://canshift.tmbk.ch in a Chromium-based browser
    ▼
canshift-flasher SPA (separate repo: tburkhalterr/canshift-flasher)
    │ requests Web Serial port; downloads merged firmware + SPIFFS image
    │ from the GitHub release feed
    ▼
esptool-js writes:
    0x0       canshift-firmware-vX.Y.Z-crowpanel_28-merged.bin
    0x370000  canshift-spiffs-vX.Y.Z-crowpanel_28.bin   (post-#1117 layout)
    │
    ▼
ESP32 reboots → first-boot SPIFFS provisioning → ready for AP+Studio
```

### In-car workflow — mobile (BLE + WiFi)

```
iPhone (canshift-mobile)
    │
    ├── BLE GATT  ─────────▶  ESP32 BLE task
    │   live telemetry,           │
    │   settings, quick           ▼
    │   commands              SignalStore / ConfigLoader
    │
    └── WiFi (AP, on demand) ─▶  ESP32 WiFi/OTA (POST /ota)
        firmware OTA upload         │
        (HMAC-signed, per-device    ▼
         bearer token)          Flash partition → reboot
```

Mobile, the dash-hosted Studio, and the USB flasher are **independent
install / update paths**. The dash-hosted Studio is for laptop / tablet
configuration over WiFi; the USB flasher is for first-flash and recovery;
mobile retains the in-car OTA path. None of the three needs the others.

---

## Shared-Core as Contract Layer

`canshift-core` defines what a valid config looks like.
Both the desktop app and the firmware must agree on the schema.

```
canshift-core (TypeScript)
    │ defines schema, validators, migrations, design tokens
    ├── consumed by canshift-studio-web (dash-hosted Studio, #1077)
    ├── consumed by canshift-mobile    (BLE STATUS, screen-settings bounds, tokens)
    └── mirrored in canshift-firmware/src/config/config_types.h (C++ structs)

When schema changes:
  1. Update canshift-core types and bump version
  2. Add migration in canshift-core/src/migrations/
  3. Update config_types.h in firmware to match
  4. Studio runs the migration chain on load; firmware does NOT migrate
     — it logs VER_MISMATCH and reads what it can. Push pre-migrated
     configs.
```

---

## Key Architectural Decisions

### Why ESP32 TWAI (not a CAN shield)?
The ESP32 has a built-in TWAI (Two-Wire Automotive Interface) controller.
Using it with the Adafruit CAN Pal transceiver is the simplest, most reliable approach.
No additional MCU or external CAN controller required.

### Why LVGL 8.3 (not 9.x)?
LVGL 9 introduced significant API breaking changes. Version 8.3 is the latest stable
release with mature ESP32 support, a large library of examples, and TFT_eSPI integration.
Migration to LVGL 9 is a future option, not a current priority.

### Why Electron for the original desktop app (historical, retiring)?
- Native filesystem access (open/save config files)
- Direct USB serial via `node-serialport` (no browser sandbox issues)
- Cross-platform (macOS, Windows) from a single codebase
- React + TypeScript development experience
- No compromises on USB serial reliability

### Why move to a dash-hosted browser SPA (#1077)?
- **No install step.** The user joins the dash AP and points a browser at
  `http://canshift.local` — zero downloads, zero permissions prompt.
- **Atomic version pairing.** The Studio SPA ships inside the firmware OTA
  payload (`board_build.embed_files`, #1077 phase 4), so Studio and
  firmware are always on the same schema version. No "Studio newer than
  firmware" or vice-versa drift.
- **Web Serial limits are now scoped.** First-flash and recovery move to
  the standalone `canshift-flasher` repo (#1081) hosted at
  [canshift.tmbk.ch](https://canshift.tmbk.ch) — a focused esptool-js
  surface — instead of being smeared across the editor application.
- **Cross-platform without packaging.** Same SPA on macOS, Windows, Linux,
  ChromeOS, even iPad.

### Why not a web app served from a public CDN?
The dash itself serves it. The firmware embeds the gzipped SPA via
`board_build.embed_files` and registers one HTTP handler per asset in
`wifi_ap.cpp` on AP start. Net benefits:

- **Offline by design.** The garage / track environment doesn't always
  have internet; the dash always has its own AP.
- **No cross-origin / no CSP gymnastics.** The browser thinks the SPA and
  the WS endpoint are on the same host.
- **Atomic with the firmware.** Cache-busting via content hash buys nothing
  here — the SPA rotates with the firmware OTA.

### Why data-driven UI?
Hardcoded screens would require recompiling firmware for every layout change.
Data-driven pages from JSON config means:
- Layout changes via the desktop app, no recompile needed
- Multiple profiles can be stored and switched
- Future OTA config updates possible
- Desktop app can preview layouts before pushing to device

---

## Memory Budget (approximate, ESP32 no PSRAM)

Source of truth: `canshift-firmware/include/app_config.h` and
`include/lv_conf.h`. Run `pio run -v` and parse the linker report for the
authoritative DRAM split.

| Component | RAM usage |
|-----------|-----------|
| LVGL frame buffer (2 × 20 lines × 320 × 2) | ~25.6 KB |
| LVGL heap (LV_MEM_SIZE, bumped in #555) | 80 KB |
| ArduinoJson doc (max 8 KB) | ~8 KB |
| CAN RX queue (32 frames × ~16B) | ~0.5 KB |
| Signal store (~64 signals × 24B) | ~1.5 KB |
| FreeRTOS task stacks (UI/CAN/USB/BLE/Input/Sim, see firmware CLAUDE.md table) | ~26 KB |
| NimBLE DRAM overhead (peripheral-only) | ~30 KB |
| **Total** | **~170 KB** |

ESP32 available SRAM: ~320 KB heap (varies by framework). On the
`crowpanel_28` build, `ESP.getFreeHeap()` after `[BOOT] Ready` should sit
around 120–140 KB — anything materially lower indicates a leak.

If memory pressure occurs:
1. Reduce LVGL_BUF_LINE_COUNT (accept slower scroll)
2. Reduce LV_MEM_SIZE
3. Disable unused LVGL widgets in lv_conf.h
4. Consider ESP32-WROVER with 4MB PSRAM for buffer allocation
