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
┌──────────────────────────────────────────────────────────────────┐
│                      CANShift Workspace                          │
│                                                                  │
│  ┌──────────────────────────────┐                               │
│  │       canshift-firmware       │  ← Runs on ESP32 (standalone)│
│  │  C++ / PlatformIO / LVGL 8.3 │                               │
│  │  - CAN bus data ingestion    │                               │
│  │  - Real-time UI (LVGL 8.3)   │                               │
│  │  - Config loaded from SPIFFS │                               │
│  │  - USB serial command bus    │                               │
│  │  - BLE GATT (telemetry/cfg)  │                               │
│  │  - WiFi AP for OTA           │                               │
│  └──────────────────────────────┘                               │
│        ↑ USB (115200 JSON)  ↑ CAN bus (live ECU)                │
│        ↑ BLE GATT           ↑ WiFi AP (OTA only)                │
│  ┌──────────────────────────────┐                               │
│  │       canshift-studio        │  ← Runs on macOS / Windows   │
│  │  Electron + React 18 + TS    │                               │
│  │  - Visual dashboard editor   │                               │
│  │  - JSON import/export        │                               │
│  │  - USB device sync           │                               │
│  │  - Firmware flashing         │                               │
│  └──────────────────────────────┘                               │
│           ↑ imports                                              │
│  ┌──────────────────────────────┐                               │
│  │       canshift-core          │  ← TypeScript library        │
│  │  - Config types              │                               │
│  │  - JSON schemas              │                               │
│  │  - Validation                │                               │
│  │  - Migration utilities       │                               │
│  └──────────────────────────────┘                               │
│           ↑ imports                                              │
│  ┌──────────────────────────────┐                               │
│  │       canshift-mobile        │  ← iOS (Expo SDK 52)         │
│  │  React Native + TypeScript   │                               │
│  │  - BLE telemetry + settings  │                               │
│  │  - WiFi OTA firmware update  │                               │
│  │  - Dashboard / Graph / Logs  │                               │
│  └──────────────────────────────┘                               │
└──────────────────────────────────────────────────────────────────┘
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

### Bench configuration workflow (USB)

```
Developer / User
    │
    │ opens/edits
    ▼
canshift-studio
    │ saves JSON
    ▼
dashboard.json / signals.json / theme.json
    │
    │ USB serial (115200 baud, JSON framing)
    ▼
ESP32 (UsbComm task)
    │
    ▼
StorageDriver → writes to SPIFFS
    │
    ▼
ConfigLoader::reloadAll()
    │
    ▼
PageManager / WidgetFactory rebuild UI
```

### In-car workflow (BLE + WiFi)

```
iPhone (canshift-mobile)
    │
    ├── BLE GATT  ─────────▶  ESP32 BLE task
    │   live telemetry,           │
    │   settings, quick           ▼
    │   commands              SignalStore / ConfigLoader
    │
    └── WiFi (AP, on demand) ─▶  ESP32 WiFi/OTA
        firmware OTA upload         │
        (HMAC-signed)               ▼
                                Flash partition → reboot
```

---

## Shared-Core as Contract Layer

`canshift-core` defines what a valid config looks like.
Both the desktop app and the firmware must agree on the schema.

```
canshift-core (TypeScript)
    │ defines schema
    ├── consumed by canshift-studio (type safety, validation)
    └── mirrored in canshift-firmware/src/config/config_types.h (C++ structs)

When schema changes:
  1. Update canshift-core types and bump version
  2. Add migration in canshift-core/src/migrations/
  3. Update config_types.h in firmware to match
  4. Both desktop and firmware can now handle old and new configs
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

### Why Electron for the desktop app?
- Native filesystem access (open/save config files)
- Direct USB serial via `node-serialport` (no browser sandbox issues)
- Cross-platform (macOS, Windows) from a single codebase
- React + TypeScript development experience
- No compromises on USB serial reliability

### Why not a web app?
Browser WebSerial API exists but has inconsistent support, requires HTTPS,
and would complicate the USB framing implementation. Electron is the right
tool for a developer-focused desktop application that needs native USB access.

### Why data-driven UI?
Hardcoded screens would require recompiling firmware for every layout change.
Data-driven pages from JSON config means:
- Layout changes via the desktop app, no recompile needed
- Multiple profiles can be stored and switched
- Future OTA config updates possible
- Desktop app can preview layouts before pushing to device

---

## Memory Budget (approximate, ESP32 no PSRAM)

| Component | RAM usage |
|-----------|-----------|
| LVGL frame buffer (2 × 40 lines × 320 × 2) | ~51 KB |
| LVGL heap (LV_MEM_SIZE) | 48 KB |
| ArduinoJson doc (max 8KB) | ~8 KB |
| CAN RX queue (32 frames × ~16B) | ~0.5 KB |
| Signal store (64 signals × 24B) | ~1.5 KB |
| FreeRTOS task stacks (4 tasks) | ~20 KB |
| **Total** | **~129 KB** |

ESP32 available SRAM: ~320 KB heap (varies by framework).
This leaves ~190 KB for other allocations. Monitor with `ESP.getFreeHeap()`.

If memory pressure occurs:
1. Reduce LVGL_BUF_LINE_COUNT (accept slower scroll)
2. Reduce LV_MEM_SIZE
3. Disable unused LVGL widgets in lv_conf.h
4. Consider ESP32-WROVER with 4MB PSRAM for buffer allocation
