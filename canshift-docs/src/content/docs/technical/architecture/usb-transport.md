---
title: "USB transport"
description: "Sinks, locks, and the PUT_CONFIG burn flow."
sidebar:
  order: 40
---

USB CDC is the dash's primary host link to canshift-tuner: command/response
JSON lines + 10 Hz telemetry. Sources: `src/hal/usb/usb_comm.cpp`,
`src/hal/usb/usb_dispatch.cpp`, `src/hal/usb/usb_envelope.cpp`,
`src/hal/usb/usb_config_sync.cpp`.

## Wire protocol

- **Baud**: 115200 over the CH340 UART0 bridge (GPIO 1 = TX, GPIO 3 = RX).
- **Framing**: newline-delimited JSON lines, no other framing.
- **Command shape**: `{"cmd":<int>, …}`. Replies are command-specific JSON.
- **Telemetry**: `{"tele":1,"v":{…signals…}}` emitted at ~10 Hz.
- **Logs**: `{"log":1,"lvl":"…","tag":"…","msg":"…"}` (protocol v2).

`USB_PROTOCOL_VERSION = 2` reflects that LOG_* macros emit envelopes
instead of plain `[I][TAG]` text and that UART0 writes from the logger
and the wire protocol are serialised under the shared sink mutex (#199).

## Sinks and the per-task dispatch shortcut (#1286)

The send path has three layers:

1. **Global `s_sink`** (`serialSink`) writes to the UART. Set once at
   init.
2. **Global `s_auxSink`** is an optional second writer — used by the
   WebSocket / TCP transports to mirror telemetry to a browser client
   when WiFi is active.
3. **`thread_local t_dispatchSink`** — set by `handleLine()` for the
   duration of the command body. When `sendLine()` runs *inside* a
   command dispatch on the current task, it routes the reply to
   `t_dispatchSink` directly without taking the sink mutex.

The thread_local exists because PUT_CONFIG holds the LVGL mutex for
~100–200 ms while the burn writes to SPIFFS. Before #1286, the dispatch
held the sink mutex for that whole window — every other task's
`sendLine()` blocked behind it, including the 10 Hz telemetry, which
caused visible drops on the host. The thread_local lets sendLine route
replies without taking the global lock for the command body.

`sendLine()` still snapshots `s_sink` / `s_auxSink` under the sink mutex,
then invokes them after releasing — so a slow sink (e.g. a TCP write to
a saturated client) cannot block another task's logger output. On lock
timeout the message is dropped rather than reading `s_sink` /
`s_auxSink` unprotected; a concurrent `setAuxSink()` could otherwise
expose a torn pointer.

## Sink mutex is recursive

A handler that calls `sendLine()` while a caller already holds the lock
(nested error paths inside an aux-sink registration window) never
self-deadlocks. The lock is no longer held across `handleCommand()` since
#1286 — see `t_dispatchSink` above — but the recursive semantics stay so
future call paths remain safe by construction.

## RX buffer reservation

`UsbComm::reserveRxBuf()` is called from `setup()` **before** `lv_init`
(see `boot-sequence.md`). The PSRAM allocator is tried first
(`MALLOC_CAP_SPIRAM`), then DRAM fallback (`MALLOC_CAP_8BIT |
MALLOC_CAP_INTERNAL`). On a no-PSRAM WROOM the DRAM path is the live
one. Used to halt on alloc failure, but on heap-starved boots the BLE
realloc fails afterwards anyway. Logging + leaving `rxBuf` NULL lets the
rest of the system boot; `init()` and `tick()` degrade the USB receive
path silently so the user can still reach Settings via BLE and recover.
Should not trip post-#1351 (WiFi stack removed → ~80 KB more heap).

## PUT_CONFIG burn flow

```
host -> dash:  {"cmd":2,"payload":{<entire dashboard.json>}}
dash:          parse envelope (heap-free brace walk in usb_envelope.cpp)
dash:          BurnOverlay::show()        // user feedback, sync flush
dash:          xSemaphoreTake(g_lvglMutex)
dash:          StorageDriver::writeFileAtomic("/config/dashboard.json", ...)
dash:          ConfigLoader::reloadAll()
dash:          PageManager::requestReload() → reload on next updateWidgets()
dash:          xSemaphoreGive(g_lvglMutex)
dash:          BurnOverlay::hide() (or showError on failure)
dash -> host:  {"status":"ok"} | {"status":"error","reason":"…"}
```

### Why a custom brace walk

ArduinoJson's `JsonDocument` is heap-backed. A naive `deserializeJson`
on the 12 KB envelope grew the pool to ~21 KB, which couldn't be
satisfied after the LV_MEM_SIZE bump in #555. The custom
`UsbEnvelope::findPayloadSlice` walks the envelope as raw bytes,
honouring JSON string state + escapes, and returns the byte range of
the `"payload"` value. The slice is then handed directly to
`StorageDriver::writeFileAtomic` — no copy, no allocation (#576, #912).

The `findNeedle` helper exists because `strstr` short-circuits on
embedded NUL bytes (#884). `findNeedle` walks length-bounded.

### Why hold the LVGL mutex for the burn

`BurnOverlay::show()` paints once on entry. The storage write blocks
the calling task for the SPIFFS commit (~100 ms). During that window
taskUI must NOT acquire the mutex — otherwise it would race with the
burn and the partial config might be parsed. Holding the mutex makes
the burn atomic vs the UI's frame loop.

## CAN scan drain

`drainCanScanQueue` reads at most 32 frames per `tick()` to keep
telemetry from being starved on a busy bus. Each frame is serialized
as `{"can":1,"id":<id>,"len":<n>,"d":[b0,...,bn]}`. The queue is
allocated lazily on first `CMD_CAN_SCAN_START` so the device doesn't
carry ~1 KB of DRAM for a feature that's rarely used (#976).

## Logger interleave guard

`serialSink` takes `Logger::lockUart` with a 50 ms timeout before
writing. On lock failure the write goes through unprotected — drop-
through preserves the "degrade don't drop" policy of the legacy
`Logger::lockUart` path. A busy logger never loses a command ack.

## Typed config GET/PUT split

`usb_config_sync.cpp` handles `device.json` and `input_bindings.json`:

- `CMD_GET_DEVICE_CONFIG` / `CMD_GET_INPUT_BINDINGS` → `sendTypedConfigGet`
- `CMD_PUT_DEVICE_CONFIG` → `handlePutDeviceConfig`
- `CMD_PUT_INPUT_BINDINGS` → `handlePutInputBindings`

These typed handlers heap-allocate their staging buffer per request and
free it before returning. The BSS staging pool from #1320 was reverted
in #1332 because its 8 KB allocation pushed WROOM boot heap past the
budget needed for NimBLE / USB CDC / FreeRTOS object inits. See #1335
for re-attempt options (smaller pool or PSRAM-only).

`input_bindings.json` is wrapped on disk as `{"input_bindings":[...]}`
but the wire envelope expects the bare array under the same key so the
studio-side wire schema (`InputBindingsConfigWireSchema`) parses
cleanly. `unwrapKey` in `sendTypedConfigGet` lifts the body out.
device.json is already flat on disk and passes `unwrapKey=nullptr`.
