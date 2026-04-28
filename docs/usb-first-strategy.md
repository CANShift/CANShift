# USB-First Strategy — Phase 1

## Rationale

Phase 1 uses USB as the sole communication channel between the desktop configuration
tool and the ESP32 firmware. This is deliberate:

1. **Wi-Fi and BLE add complexity.** Adding wireless requires: Wi-Fi driver stack,
   HTTP server, security (auth tokens), more RAM usage, potential interference.
   USB is simpler, faster, and more reliable for initial development.

2. **USB is always available.** The ESP32 USB-to-serial bridge (CP210x or CH340)
   is always present for flashing and debugging. Reusing it for config sync
   requires zero additional hardware.

3. **Config changes are infrequent.** You don't need wireless config in a moving car.
   You configure at the bench, go drive, come back, reconfigure. USB is fine.

4. **Wireless adds security requirements.** An open Wi-Fi AP in the car is a
   potential attack surface. USB requires physical access.

---

## Phase 1 Protocol

### Transport
- USB serial (UART0 via CP210x/CH340 bridge)
- Baud: 115200
- Framing: JSON lines (`\n` delimited)

### Commands (desktop → firmware)

```json
{ "cmd": 1 }                        // GET_CONFIG — request current dashboard.json
{ "cmd": 2, "payload": { ... } }    // PUT_CONFIG — push new dashboard.json
{ "cmd": 3, "payload": { ... } }    // PUT_SIGNALS — push new signals.json
{ "cmd": 4, "payload": { ... } }    // PUT_THEME — push new theme.json
{ "cmd": 16 }                       // GET_STATUS — firmware version, uptime, signals
{ "cmd": 240 }                      // REBOOT — soft reset
```

### Responses (firmware → desktop)

```json
{ "rsp": 128, "msg": "ok" }                    // OK
{ "rsp": 129, "msg": "parse error" }           // Error
{ "rsp": 130, "data": { ... } }                // Data response
```

### Config push flow

```
Desktop app                     Firmware
    │                               │
    │ {"cmd":2,"payload":{...}}\n   │
    │ ─────────────────────────────>│
    │                               │ write to SPIFFS
    │                               │ ConfigLoader::reloadAll()
    │ {"rsp":128,"msg":"ok"}\n      │
    │ <─────────────────────────────│
    │                               │
```

---

## Desktop App USB Flow

1. **DeviceRoute** — user selects serial port from list
2. `UsbService.connect(portPath)` — opens SerialPort at 115200 baud
3. User clicks "Push Config" — serializes current `DashboardConfig` to JSON
4. `UsbService.pushConfig(config)` — writes `{"cmd":2,"payload":{...}}\n` to serial
5. Wait for `{"rsp":128,...}` response
6. Show success or error to user

---

## Firmware USB Flow

1. `UsbComm::tick()` reads bytes from `Serial` (UART0)
2. Accumulates bytes until `\n` delimiter
3. Parses JSON with ArduinoJson
4. Dispatches to handler based on `cmd` field
5. For PUT_CONFIG: writes payload to SPIFFS, calls `ConfigLoader::reloadAll()`
6. Sends JSON response line

---

## Implementation Status

| Component | Status |
|-----------|--------|
| Desktop `UsbService.listPorts()` | Stub — needs real SerialPort call |
| Desktop `UsbService.connect()` | Stub — basic SerialPort open |
| Desktop `UsbService.pushConfig()` | Stub — writes JSON line |
| Firmware `UsbComm::tick()` | Stub — reads lines, logs receipt |
| Firmware command dispatch | TODO |
| Firmware SPIFFS write on PUT_CONFIG | TODO |
| Firmware reloadAll() trigger | TODO |
| Response ACK from firmware | TODO |

**Both sides need to be implemented together and tested end-to-end.**
The stubs define the structure; the actual protocol implementation comes in Phase 1D.

---

## Future: Replace or Extend

When moving to Phase 2 (wireless), this USB protocol does NOT need to be removed.
USB remains useful for:
- Initial firmware flashing
- Bench-side config work
- Debug monitoring
- Fallback if wireless fails

Phase 2 adds Wi-Fi/BLE as a **parallel** transport, not a replacement.
The same JSON command set can be used over Wi-Fi HTTP or BLE GATT.
