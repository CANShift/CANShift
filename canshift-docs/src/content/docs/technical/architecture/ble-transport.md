---
title: 'BLE transport'
description: 'NimBLE topology, GATT layout, and the stop-race snapshot pattern.'
sidebar:
  order: 50
---

The BLE stack is the optional secondary transport (USB is primary).
Phone-side `canshift-mobile` reads telemetry over GATT notify and writes
config / commands over GATT write. Sources: `src/hal/ble/ble_server.cpp`,
`src/hal/ble/ble_status.cpp`, `src/hal/ble/ble_telemetry.cpp`.

## GATT layout

Single primary service. Four characteristics:

| Characteristic | Direction    | Notify | Payload                                                |
| -------------- | ------------ | ------ | ------------------------------------------------------ |
| STATUS         | dash → phone | yes    | `{"ver","can","is_day"}` JSON, 2 s cadence             |
| TELE           | dash → phone | yes    | `{"r","tps","map",…}` JSON, 10 Hz                      |
| CMD            | phone → dash | no     | `{"cmd":<int>,…}` JSON, fed into `UsbComm::handleLine` |
| PASSKEY        | dash → phone | yes    | 6-digit pairing code on bond start                     |

The phone uses the same JSON wire shape as USB so `UsbComm::handleLine`
can dispatch BLE writes through the existing command table without a
parallel handler chain.

## Early init (#909)

`BleServer::earlyInit()` runs from `BootSequence::run` **before**
`DisplayDriver::init`. NimBLE needs ~50 KB contiguous DRAM; LovyanGFX
init shrinks the largest free block to ~16 KB. Initialising the stack
first guarantees the allocation succeeds while the heap is still large.

The heap floor for early init is `BLE_MIN_HEAP_BYTES = 50 KB`. Below it
NimBLE silently fails to initialize and the dash boots BLE-less.
`BLE_GATT_MIN_HEAP_BYTES = 24 KB` covers `createServer` + 4
characteristics + `start()` so the GATT phase has its own gate.

The empirically-tuned values come from the CrowPanel 2.8" reference
board; per-env override via `build_flags` for boards with a different
DRAM budget.

## BLE + WiFi AP mutual exclusion

`BleServer::earlyInit()` checks `WifiAp::isAutoStartEnabled()` and
skips BLE when WiFi is opted in. The two never compete for ESP32
DRAM / radio (#878). The security note from #878 still applies: the
GATT surface is unauthenticated until #873 lands; pairing is short-
window via the MOBILE PAIRING toggle to limit exposure.

## Telemetry payload — stack-only serializer

`buildTelemetryPayload(char *buf, size_t bufSize)` writes the TELE JSON
directly to a stack buffer. The previous implementation built a
`JsonDocument` every 100 ms then serialized to a stack buffer —
ArduinoJson v7's `JsonDocument` is heap-backed despite the name, so the
BLE task was running a small malloc/free cycle 10× per second against
the same post-LVGL heap that #555/#576/#664 work so hard to keep
unfragmented (#891). Mirrors the heap-free pattern in
`usb_comm.cpp::sendTelemetry`.

The signal table the telemetry emits is `BLE_TELE_SIGNALS[]` — 14
entries. Updating it requires editing the mobile app's parser too.

## Race against `stop()` (#1035, #1283)

`updateStatus()` and `emitTelemetry()` both snapshot the file-scope
characteristic pointer (`s_pStatus`, `s_pTele`) to a local at the start
of the function. `BleServer::stop()` can null those pointers on a
different task between the entry check and the `setValue` / `notify`
call. The `earlyInit()` GATT-preserved path keeps the underlying
characteristic object alive for the lifetime of the process, so the
snapshot remains valid even if the global is cleared mid-call.

## Truncated payload guard (#936)

`ArduinoJson` silently truncates when the output buffer is too small.
A truncated STATUS payload is invalid JSON and crashes the mobile
parser. `updateStatus()` detects truncation
(`len == 0 || len >= sizeof(buf)`) and skips the notify rather than
pushing junk over the wire.

## STATUS refresh divider

The 2 s STATUS refresh is implemented as a module-static
`s_statusDiv` counter incremented per `emitTelemetry()` call. At 10 Hz
telemetry, the divider hits 20 → STATUS refresh. The counter
intentionally persists across `stop()`/`start()` cycles so the divider
behaviour matches the pre-split `tick()`'s function-local static
exactly.

## Passkey overlay

`PasskeyOverlay::show(passkey)` renders the pairing code as a 6-digit
zero-padded number ("001234" not "1234") so trailing zeros are
preserved on screen. The mobile pairing UI also enters six digits;
visual symmetry helps the user transcribe.

## taskBLE stack

`TASK_STACK_BLE = 5120`. Covers NimBLE callbacks + the
`buildTelemetryPayload` stack frame (768 B static buffer + locals).
Bump only if a future TELE payload field pushes the stack past the
fail-safe.
