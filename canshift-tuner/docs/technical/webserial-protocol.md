# WebSerial protocol

The Tuner ↔ firmware wire format. Lives at the UART layer (CH340 on the
CrowPanel-28); the browser side uses `navigator.serial` with a
`baudRate: 115200` open and the standard `8N1` framing.

## Direction conventions

Both directions are **newline-terminated JSON objects**. One frame per line.
Empty lines are ignored. The firmware's `Serial.print` path in
`canshift-firmware/src/hal/usb/usb_comm.cpp` is the canonical reference.

## Outbound (Tuner → dash)

```json
{"cmd":2,"payload":{ ... full dashboard JSON ... }}
```

- `cmd` is the one-byte opcode. See the opcode table below.
- Additional fields can be inlined alongside `payload` for small commands
  (e.g. `{"cmd":5,"brightness":80}` for `CMD_SCREEN_SETTINGS`).

Every outbound frame is terminated with `\n`.

## Inbound (dash → Tuner)

Acks for command frames:

```json
{"status":"ok"}
{"status":"ok","rebooting":true}
{"status":"ok","config":{ ... }}
{"status":"error","message":"missing_payload"}
```

Unsolicited frames (telemetry, logs, CAN frames, CAN stats):

```json
{"log":1,"lvl":"E","tag":"USB","msg":"…"}
{"tele":1,"rpm":3500.0,"oil_temp_c":95.0, ...}
{"can":1,"id":"7E8","data":[...]}
{"can_stat":1,"fps":12.5,"errors":0}
```

The Tuner's `WebSerialClient` distinguishes:

- An object with a `status` field → ack for the in-flight `send()`.
- An object with one of the unsolicited discriminators (`log`, `tele`,
  `can`, `can_stat`) → routed to whichever `subscribe(discriminator, …)`
  handler is registered.

## Opcode table (current)

Sourced from `canshift-tuner/src/transport/index.ts` (kept in sync with
`canshift-firmware/src/hal/usb/usb_comm.h` — the firmware header is
canonical; if you edit one, edit the other).

| Opcode | Symbol | Direction | Purpose |
|---|---|---|---|
| `0x01` | `CMD_GET_CONFIG` | T→D | Read dashboard JSON from device |
| `0x02` | `CMD_PUSH_CONFIG` | T→D | Write dashboard JSON to device (reboots on ack) |
| `0x03` | `CMD_GET_DEVICE_CONFIG` | T→D | Read hardware device config |
| `0x04` | `CMD_PUT_DEVICE_CONFIG` | T→D | Write hardware device config |
| `0x05` | `CMD_SCREEN_SETTINGS` | T→D | Brightness, rotation |
| `0x07` | `CMD_TOGGLE_DAY_NIGHT` | T→D | Toggle day/night theme |
| `0x08` | `CMD_CALIBRATE_TOUCH` | T→D | Enter touch calibration |
| `0x09` | `CMD_SET_DAY_NIGHT` | T→D | Set day/night theme explicitly |
| `0x0B` | `CMD_GET_INPUT_BINDINGS` | T→D | Read input bindings |
| `0x0C` | `CMD_PUT_INPUT_BINDINGS` | T→D | Write input bindings |
| `0x10` | `CMD_QUERY_VERSION` | T→D | Firmware version handshake *(wired in follow-up — #1340 sub-c)* |
| `0x20` | `CMD_CAN_SCAN_START` | T→D | Start CAN scan (frames stream as `can` discriminator) |
| `0x21` | `CMD_CAN_SCAN_STOP` | T→D | Stop CAN scan |
| `0xF0` | `CMD_REBOOT` | T→D | Reboot the dash |

## Ack semantics

- The client tracks one pending `send()` at a time, draining as acks
  arrive. Excess concurrent sends queue up to 8; the 9th resolves with
  `queue_full`.
- Ack timeout is 5 s by default. `CMD_PUSH_CONFIG` scales by payload size
  (`+50 ms / KB`, capped at 60 s) — large configs take longer to flash to
  internal storage.
- A reboot-causing command (e.g. `CMD_REBOOT`, `CMD_PUSH_CONFIG`) closes
  the port before an ack lands. The client treats the resulting close as
  `success` rather than `ack_timeout` for those opcodes.

## Reconnect

- Unexpected close → exponential backoff retry: 500 ms, 1 s, 2 s, 4 s,
  8 s, 16 s, 30 s max. Resets to 500 ms once the connection stays open
  for `STABLE_UPTIME_MS` (10 s).
- User-initiated `disconnect()` cancels any in-flight retry and parks the
  state at `disconnected`.
- `navigator.serial.getPorts()` is queried on app load; if the user
  previously authorized a port that's currently plugged in, the client
  auto-reconnects without showing the permission picker.
