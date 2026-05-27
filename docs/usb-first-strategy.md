# USB-First Strategy — Decision Record

> **Status:** Historical. USB serial was the original bench/config transport
> between the now-decommissioned `canshift-studio` Electron app and the ESP32
> firmware. BLE + WiFi-OTA shipped later for the in-car path via
> `canshift-mobile`, and the dash-hosted Studio (`canshift-studio-web`) took
> over bench config via WebSocket on port 81 (#1077). The USB serial dispatcher
> in `usb_comm.cpp` is still the canonical command surface — WS shares it.
>
> This document is preserved as a record of *why* USB was the first transport
> and what the protocol looks like today. For the canonical command list, see
> `canshift-firmware/src/hal/usb/usb_comm.h`.

## Why USB First (Historical Rationale)

When the project started, USB was chosen as the sole desktop ↔ firmware
transport for these reasons:

1. **Wi-Fi and BLE add complexity.** Wireless requires a driver stack, an HTTP
   or GATT server, security (auth tokens / pairing), more RAM, and brings
   interference risk. USB is simpler, faster, and more deterministic.

2. **USB is always available.** The CrowPanel ESP32 USB-to-serial bridge
   (CP210x/CH340) is always present for flashing and debugging. Reusing it for
   config sync required zero extra hardware.

3. **Config changes are infrequent.** Bench-time changes don't need wireless.
   Configure at the bench, drive, come back, reconfigure. USB is fine.

4. **Wireless adds attack surface.** An open Wi-Fi AP in the car is a potential
   attack surface; USB requires physical access.

5. **One protocol, real tested code, before adding a second transport.**
   Implementing the JSON command set over USB first gave us a stable contract
   to reuse later over BLE/WiFi for the mobile app.

---

## What Shipped

### Transport
- USB serial via UART0 (CP210x/CH340 bridge)
- Baud: 115200
- Framing: JSON lines (`\n` delimited)

### Command Set (current)

The firmware command set has grown beyond the original `cmd 1/2/16/240`. The
authoritative list lives in
[`canshift-firmware/src/hal/usb/usb_comm.h`](../canshift-firmware/src/hal/usb/usb_comm.h)
and currently includes:

| Code | Name | Purpose |
|------|------|---------|
| 0x01 | `CMD_GET_CONFIG` | Read current `dashboard.json` from SPIFFS |
| 0x02 | `CMD_PUT_CONFIG` | Push new `dashboard.json`, write + reload |
| 0x05 | `CMD_SCREEN_SETTINGS` | Push screen-level settings |
| 0x06 | `CMD_PUT_FILE` | Chunked binary upload (assets, images) |
| 0x07 | `CMD_TOGGLE_DAY_NIGHT` | Toggle theme mode |
| 0x08 | `CMD_CALIBRATE_TOUCH` | Trigger touch calibration |
| 0x09 | `CMD_SET_DAY_NIGHT` | Set theme mode explicitly |
| 0x0A | `CMD_RESET_TOUCH_CAL` | Reset stored touch calibration |
| 0x10 | `CMD_GET_STATUS` | Firmware version, uptime, signal counts |
| 0x20 | `CMD_CAN_SCAN_START` | Start CAN frame scan diagnostic |
| 0x21 | `CMD_CAN_SCAN_STOP` | Stop CAN frame scan diagnostic |

### Config push flow

```
Desktop app                     Firmware
    │                               │
    │ {"cmd":2,"payload":{...}}\n   │
    │ ─────────────────────────────▶│
    │                               │ write to SPIFFS
    │                               │ ConfigLoader::reloadAll()
    │ {"rsp":128,"msg":"ok"}\n      │
    │ ◀─────────────────────────────│
    │                               │
```

### Studio side (historical)

The Electron Studio (`canshift-studio/`, now decommissioned) implemented the
desktop side via the `serialport` Node module: `SerialPort.list()` to enumerate
ports, `SerialPort.open(path)` at 115200 baud, `ReadlineParser` for `\n`-delimited
JSON responses, and `pushConfig` / `getStatus` / `toggleDayNight` etc. dispatching
the commands above. The same module also handled firmware flashing over USB.

The canonical Studio today (`canshift-studio-web/`) talks to the firmware over
WebSocket on port 81 instead — the firmware-side dispatcher (`UsbComm::handleLine`)
is shared between USB and WS, so the command shapes carried over.

### Firmware side

Implemented in
[`canshift-firmware/src/hal/usb/usb_comm.cpp`](../canshift-firmware/src/hal/usb/usb_comm.cpp):
- `UsbComm::tick()` reads from `Serial`, accumulates until `\n`
- Parses with ArduinoJson, dispatches on `cmd` field
- `CMD_PUT_CONFIG` writes payload to SPIFFS and triggers
  `ConfigLoader::reloadAll()` from the UI thread on the next LVGL tick
- Responses are JSON lines back to the desktop

---

## Implementation Status (final)

| Component | Status |
|-----------|--------|
| Desktop `UsbService.listPorts()` | Shipped — real `SerialPort.list()` |
| Desktop `UsbService.connect()` | Shipped — real port open with parser |
| Desktop `UsbService.pushConfig()` | Shipped — `CMD_PUT_CONFIG` end-to-end |
| Firmware `UsbComm::tick()` | Shipped — line buffer + dispatch |
| Firmware command dispatch | Shipped — 11 commands listed above |
| Firmware SPIFFS write on `PUT_CONFIG` | Shipped |
| Firmware `reloadAll()` trigger | Shipped — deferred to UI thread |
| Response ACK from firmware | Shipped — JSON `rsp` frames |
| Studio firmware flashing over USB | Shipped — `firmware.service.ts` |

---

## What Came After

USB serial in the firmware (`UsbComm`) was *not* removed when wireless landed.
It is still:

- A fallback transport for the WS dispatcher (same `handleLine()` entry point)
- The diag/log monitoring path (`pio device monitor`)
- The flashing path used by `esptool` and `canshift-flasher`

BLE + WiFi shipped as **parallel** transports:
- **WS port 81** for the dash-hosted Studio (`canshift-studio-web`) — JSON
  frame per WebSocket text message, routed through the same dispatcher as USB.
- **BLE GATT** for live telemetry and quick settings from mobile (`ble.service.ts`)
- **WiFi AP + HMAC-signed OTA** for mobile firmware updates (`ota.service.ts`)

The JSON command shapes were reused where it made sense; the BLE service uses
GATT characteristics rather than line-delimited JSON, but the underlying
operations (get status, push config, toggle day/night, etc.) map 1:1.

See `overall-architecture.md` for the current end-to-end picture and
`future-wireless-strategy.md` for the original wireless plan.
