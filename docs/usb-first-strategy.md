# USB-First Strategy — Decision Record

> **Status:** Shipped. USB serial is the live bench/config transport between
> `canshift-studio` and the ESP32 firmware. BLE + WiFi-OTA shipped later for the
> in-car path via `canshift-mobile` (see `overall-architecture.md`).
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

### Studio side

Implemented in
[`canshift-studio/main/services/usb.service.ts`](../canshift-studio/main/services/usb.service.ts):
- `SerialPort.list()` enumerates real ports via the `serialport` Node module
- `connect(path)` opens a real `SerialPort` at 115200 baud
- `ReadlineParser` parses `\n`-delimited JSON responses
- `pushConfig`, `getStatus`, `toggleDayNight`, etc. dispatch the commands above

Firmware flashing reuses the same module via
[`firmware.service.ts`](../canshift-studio/main/services/firmware.service.ts).

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

USB was *not* removed when wireless landed. It is still:

- The flashing path (used by Studio and `esptool`)
- The primary bench-side config path
- The diag/log monitoring path
- A fallback if BLE/WiFi fails

BLE + WiFi shipped as a **parallel** transport in `canshift-mobile`:
- **BLE GATT** for live telemetry and quick settings (`ble.service.ts`)
- **WiFi AP + HMAC-signed OTA** for firmware updates (`ota.service.ts`)

The JSON command shapes were reused where it made sense; the BLE service uses
GATT characteristics rather than line-delimited JSON, but the underlying
operations (get status, push config, toggle day/night, etc.) map 1:1.

See `overall-architecture.md` for the current end-to-end picture and
`future-wireless-strategy.md` for the original wireless plan.
