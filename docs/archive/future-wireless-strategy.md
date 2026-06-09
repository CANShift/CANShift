# Future Wireless Strategy — Phase 2+

## Overview

Phase 2 adds wireless configuration capability to CANShift.
The ESP32 has built-in Wi-Fi and BLE — both are currently disabled in `hardware_profile.h`.

---

## Wi-Fi Strategy (Phase 2A — recommended first)

### Mode: Access Point (AP)

The ESP32 creates its own Wi-Fi network in the car.
No router required. The phone connects directly to the ESP32.

```
iPhone / Laptop
    │ Wi-Fi
    ▼
ESP32 AP (SSID: "CANShift-XXXX", no password or WPA2-PSK)
    │ HTTP on port 80 (or 8080)
    ▼
REST API / WebSocket server
    │
    ▼
Config files on SPIFFS
```

### API Endpoints (planned)

```
GET  /status               — firmware version, uptime, signal count
GET  /config/dashboard     — download dashboard.json
PUT  /config/dashboard     — upload new dashboard.json
GET  /config/signals       — download signals.json
PUT  /config/signals       — upload new signals.json
GET  /config/theme         — download theme.json
PUT  /config/theme         — upload new theme.json
POST /reboot               — soft reset
GET  /signals/live         — WebSocket: stream live signal values
```

### Security
- No security: acceptable for workshop/garage use (short range, no internet)
- WPA2-PSK: recommended if used at events where other people are nearby
- Simple token: `X-CANShift-Token: <token>` header for the iPhone app

### Implementation Hooks (already in firmware)

```cpp
// hardware_profile.h
#define HW_WIFI_PRESENT  1   // ESP32 has Wi-Fi
#define HW_WIFI_ENABLED  0   // Set 1 in Phase 2

// hal/wifi/wifi_manager.h (TODO: create in Phase 2)
namespace WifiManager {
    void init();   // Start AP mode
    void tick();   // Handle HTTP requests
}
```

---

## BLE Strategy (Phase 2B — supplementary)

BLE is useful for quick commands that don't require large data transfer.

### Use cases for BLE (not config file transfer)
- Page navigation (next/prev)
- Theme toggle (day/night)
- Brightness adjustment
- Get live signal snapshot (one-shot, not streaming)
- Map/profile selection

### GATT Service Design (planned)

```
Service: CANShift Control (UUID: custom)
  Characteristic: Page Control (write)
    - Value: { action: "next" | "prev" | "goto", pageId?: string }
  Characteristic: Theme Mode (read/write)
    - Value: 0 = dark, 1 = light
  Characteristic: Signal Snapshot (read/notify)
    - Value: JSON-encoded snapshot of key signals
  Characteristic: Map Number (read)
    - Value: uint8_t current map number
```

### Implementation Hooks (firmware)

```cpp
// hardware_profile.h
#define HW_BLE_PRESENT  1   // ESP32 has BLE
#define HW_BLE_ENABLED  0   // Set 1 in Phase 2

// hal/ble/ble_manager.h (TODO: create in Phase 2)
namespace BleManager {
    void init();
    void tick();
}
```

---

## iPhone App Integration

When the iPhone app is built (Phase 3):

1. App connects to ESP32 Wi-Fi AP
2. Downloads current `dashboard.json` → shows current config
3. User makes quick changes (profile, page, theme)
4. App pushes updated config via HTTP PUT
5. Firmware reloads config

For large config edits (layout redesign), use the desktop app.
The iPhone app is a field tool for quick adjustments.

---

## Why Not Wi-Fi Station Mode?

Station mode (ESP32 connects to your home Wi-Fi) has issues in a car:
- No home router in the car
- Network roaming issues when driving away
- Security exposure (ESP32 exposed to your home network)

AP mode (ESP32 is the router) is simpler and always works.

---

## Memory Impact

Enabling Wi-Fi on ESP32 uses approximately:
- ~90 KB RAM for the Wi-Fi stack
- This is significant and may require:
  1. Using ESP32-WROVER (4MB PSRAM) to move LVGL buffers to PSRAM
  2. Reducing LVGL buffer sizes
  3. Disabling features to free heap

**Do not enable Wi-Fi until Phase 1 is stable and memory budget is understood.**
Monitor heap with `ESP.getFreeHeap()` and `ESP.getMinFreeHeap()`.

BLE has a similar memory footprint (~90 KB).
Running both Wi-Fi and BLE simultaneously may not be feasible without PSRAM.
