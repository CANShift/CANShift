---
title: "Add a new ECU profile"
description: "Wire a new ECU's CAN signals into the firmware + studio config schema."
sidebar:
  order: 5
---

How to add CANShift support for a new ECU's CAN protocol — from finding
the documentation through to shipping the catalog entry.

Follow-up of [#1020](https://github.com/tburkhalterr/CANShift/issues/1020).
The companion document [`docs/ecu-integration.md`](ecu-integration.md) is
the deep field-by-field schema reference; this doc is the
phased-walkthrough that points at it.

---

## 0. Overview

CANShift is **ECU-agnostic by design**. The firmware does not know what a
"MaxxECU" is — it loads `signals.json` at boot and decodes every CAN frame
that matches a configured entry. Adding a new ECU is overwhelmingly a
data-authoring task: write the right rows in `signals.json`, no firmware
changes.

There are two integration paths depending on how the ECU talks:

1. **Broadcast ECU** — the ECU continuously sends frames on its own. This
   is the default mode for aftermarket ECUs: MaxxECU, Haltech, Link,
   AEM, MegaSquirt, Adaptronic. Authoring is "translate the CAN protocol
   PDF into JSON". No firmware code path beyond the regular passive
   decoder. ~95 % of ECUs.
2. **Request/response (OBD-II Mode 01)** — the ECU only answers when
   polled. CANShift sends a query frame on `0x7DF` and decodes the
   response from `0x7E8`. Added in
   [#1135](https://github.com/tburkhalterr/CANShift/issues/1135) /
   [#841](https://github.com/tburkhalterr/CANShift/issues/841). Mode 01
   only in v1; multi-ECU + ISO-TP deferred to OBD-II v2.

If your ECU is already a built-in preset
([`ecu-profiles/index.ts`](../canshift-core/src/ecu-profiles/index.ts) —
currently `maxxecu-street` and `obd2-j1979`), skip straight to step 3 —
pick it in Studio and flash.

---

## Step 1 — Identify the ECU's wire format

You need, for every signal you want on the dash:

- **CAN frame ID** — the 11-bit (or 29-bit) arbitration ID the ECU sends
  the signal on. Hex string `0x123` in the schema.
- **Byte offset** — 0-based position within the 8-byte payload.
- **Byte length** — 1, 2, or 4 bytes (the only values the schema accepts).
- **Byte order** — big-endian (MSB first, most ECUs) or little-endian.
- **Signedness** — does the ECU use two's complement?
- **Scale + offset** — `real_value = raw * scale + offset`. Temperature
  signals commonly use `offset: -40` so they fit unsigned bytes.
- **Unit** — free text, displayed by widgets when no manual override is
  set.

Where to find this:

1. **Vendor CAN protocol document.** Best source. MaxxECU ships theirs in
   the PC software install. Haltech, Link, AEM, etc. publish PDFs on
   their websites.
2. **Community DBC file.** For mass-market and OEM ECUs:
   `commaai/opendbc`, `JulianWgs/python-can-decoder`. A DBC is the
   canonical encoding; every field above is already there.
3. **RealDash CAN XML.** RealDash ships custom XMLs for ~hundreds of
   ECUs. CANShift can import them directly via
   [`parseRealDashXML`](../canshift-core/src/realdash/parse-realdash-xml.ts) —
   the studio importer surfaces this. Less reverse-engineering than
   reading a PDF.
4. **Live scanner.** As a last resort, use CANShift's USB scanner mode
   (`CMD_CAN_SCAN_START = 0x20` —
   [`usb_comm.h`](../canshift-firmware/src/hal/usb/usb_comm.h) line 107).
   Studio's CAN Scanner tab decodes the raw stream as JSON
   `{ "can_frame": { "id": "0x370", "data": "..." } }`. Move pedals,
   change loads, watch which bytes move.

Even with vendor docs, run the scanner for 30 seconds once. Vendors miss
frames or list the wrong cadence; the bus tells the truth.

---

## Step 2 — Author `signals.json`

The schema is
[`SignalDefSchema`](../canshift-core/src/schemas/signal.ts) (around line
125). The full annotated field reference is in
[`docs/ecu-integration.md § 2`](ecu-integration.md#2-translate-the-protocol-doc-into-a-signals-catalog) —
do not duplicate it here.

The default broadcast template lives at
[`canshift-firmware/data/config/signals.json`](../canshift-firmware/data/config/signals.json)
(currently the MaxxECU 4-frame group at `0x370-0x375`). Copy it and edit.

### 2.1 Broadcast ECU

One entry per signal in the `signals` array. Required fields per signal:
`name`, `canFrameId`, `startByte`, `byteLength`, `bigEndian`, `signed`,
`scale`, `offset`, `unit`, `min`, `max`, `timeoutMs`. Optional:
`warningLevel`, `dangerLevel`, `highWarningLevel`, `highDangerLevel`,
`bitMask`, `colorRamp`. See `MAXXECU_SIGNALS` in
[`ecu-profiles/index.ts`](../canshift-core/src/ecu-profiles/index.ts) for
a fully fleshed-out template, including bit-packed flag signals
(`flag_mil`, `flag_launch_ctrl`, …) sharing a status byte through
`bitMask`.

Set `canSpeedKbps` at the top of the file to match the ECU's bus speed
(usually 500). The schema rejects values outside the supported enum.

### 2.2 Request/response ECU (OBD-II)

OBD-II signals add a `polling` block:

```jsonc
{
  "name": "rpm",
  "canFrameId": "0x7E8",
  "startByte": 3,
  "byteLength": 2,
  "bigEndian": true,
  "signed": false,
  "scale": 0.25,
  "offset": 0.0,
  "unit": "rpm",
  "min": 0,
  "max": 8000,
  "timeoutMs": 2000,
  "polling": {
    "mode": 1,
    "pid": 12,
    "intervalMs": 250
  }
}
```

The polling schema lives in
[`canshift-core/src/schemas/obd2.ts`](../canshift-core/src/schemas/obd2.ts).
v1 constraints (enforced at parse time):

- `mode` must be `0x01` (Mode 01, current data). Other modes return a
  Zod error.
- `pid` is `0..0xff`. Use the standard catalog in
  [`OBD2_MODE01_PIDS`](../canshift-core/src/ecu-profiles/obd2-mode01-pids.ts)
  — every common PID is already listed with the J1979 scale/offset
  pre-decoded.
- `intervalMs` is `100..60000`. Below 100 ms a single signal saturates a
  500 kbps bus accounting for response latency; above 60 s should be a
  one-shot diagnostic instead.

Frame IDs are fixed in v1: request on `0x7DF`, response on `0x7E8`.
Multi-ECU (`0x7E9..0x7EF`) is deferred to OBD-II v2.

The `OBDII_SIGNALS` array in
[`ecu-profiles/index.ts`](../canshift-core/src/ecu-profiles/index.ts)
(around line 324) is the reference — six standard PIDs (RPM, speed,
coolant, throttle, IAT, battery) with the J1979 scale/offset formulas
worked out in the comments at the top of `obd2-mode01-pids.ts`.

### 2.3 Validate locally

```bash
cd canshift-core
npm test -- validate-signal-config
```

The validator
[`validateSignalConfig`](../canshift-core/src/validation/validate-signal-config.ts)
runs the same `SignalConfigSchema.safeParse` the studio + mobile IPC
boundaries use. Catches: malformed `canFrameId` hex, `byteLength`
outside `{1,2,4}`, threshold ordering violations
([#1010](https://github.com/tburkhalterr/CANShift/issues/1010)),
`min >= max`, bad `bitMask` hex, unsupported `canSpeedKbps`.

For the RealDash import path, `parseRealDashXML` runs every emitted
signal through the same schema and diverts malformed rows to
`warnings[]` rather than coercing them.

---

## Step 3 — Bench-test against a real ECU (or a recorded log)

The studio CAN Scanner is the most efficient verification tool.

### 3.1 Wire-up

Follow [`docs/can-integration-notes.md`](can-integration-notes.md) — CAN
H/L from the ECU to the CAN Pal, dash powered, USB to the workstation.
[`docs/FIRST_FLASH.md`](FIRST_FLASH.md) is the pre-flight checklist if
this is the first power-up of new hardware.

### 3.2 Raw frame dump

In Studio, open the CAN Scanner tab. Confirm you see the frame IDs you
expect at the expected cadence. If the ECU broadcasts `0x370` at 10 Hz
you should see ~10 lines per second for that ID. Frames you do not
expect are either documentation gaps or a busmate (gauge cluster, ABS,
TCU, BCM) — log them, do not panic.

### 3.3 Decoded value check

Flash a config that has at least one widget per signal you authored
(simplest: a numeric label on every signal name). Verify on the dash:

- Static values match the ECU's PC software readout (RPM at idle,
  coolant temp warm).
- Sweeping values track in lockstep (throttle pedal → TPS, RPM rev).
- Sign is correct (negative coolant in the cold; pressures positive).
- No signal sits at `0` or `min`/`max` permanently — that means `scale`,
  `offset`, or `byteLength` is wrong, or you picked the wrong frame ID.

### 3.4 OBD-II specifics

After flashing, watch the scanner: a Mode 01 query frame should appear
on `0x7DF` at the configured `intervalMs`, followed within a few
milliseconds by the `0x7E8` response. If no response appears:

- Some OBD-II ECUs only answer when the engine is running (key on alone
  is not enough).
- ISO 15765-4 11-bit at 500 kbps is the assumed framing. 29-bit ID or
  250 kbps buses need the v2 work to land first.
- Validate the PID actually exists on the ECU — PID `0x00` returns a
  bitmap of supported PIDs. The OBD-II spec calls this the
  "PIDs supported [01..20]" query.

---

## Step 4 — Ship the catalog entry

If the ECU is unique to your setup, keep `signals.json` in your local
config and stop here. If you want it available to other users:

1. Add a new `EcuProfile` entry to
   [`canshift-core/src/ecu-profiles/index.ts`](../canshift-core/src/ecu-profiles/index.ts).
   Required fields: `id` (kebab-case, e.g. `haltech-elite-2500`),
   `name`, `description`, `protocol` (free-form version string written
   to `SignalConfig.protocol` on export), `signals: SignalDef[]`. See
   `maxxecu-street` and `obd2-j1979` for the format.
2. The new preset appears automatically in Studio's signal-config
   dropdown (`SignalRoute.tsx` reads the registry).
3. If the ECU also publishes a RealDash XML, contributing one to the
   RealDash community catalog gets you the importer path for free — the
   parser is content-agnostic.
4. Open a PR titled `feat(core): add <ecu name> preset`. Include in the
   description: the vendor doc reference, bench-test confirmation (per
   step 3), and any open-question signals you couldn't verify.

The MaxxECU preset is also mirrored as the firmware's default
`signals.json` so new boards boot with a useful baseline. New presets do
not need to claim the default — the user picks in Studio.

---

## OBD-II v1 — known limits

Spelled out so contributors don't write code against assumptions that
won't hold:

- **Mode 01 only.** Mode 02 (freeze frame), Mode 09 (vehicle info), and
  diagnostic services land later.
- **Single ECU.** Response frame is hard-pinned to `0x7E8`. Multi-ECU
  vehicles (`0x7E9..0x7EF`) need the dispatcher work.
- **No ISO-TP reassembly.** Multi-frame responses (long PIDs, VIN read)
  are dropped. v1 is single-frame replies only.
- **11-bit IDs.** 29-bit OBD-II (`0x18DA F1 xx`) is not parsed.
- **500 kbps.** 250 kbps OBD-II buses (some medium-duty) are not
  supported.
- **Minimum interval 100 ms.** Below that a single signal saturates a
  500 kbps bus once you account for response latency. The schema
  rejects lower values rather than letting the user lock the bus by
  mistake.

These are tracked under
[#841](https://github.com/tburkhalterr/CANShift/issues/841) (umbrella)
and will land in the OBD-II v2 phase.

---

## Validation checklist

Run through this before submitting a preset PR:

- [ ] `npm test -- validate-signal-config` passes in `canshift-core/`
- [ ] CAN Scanner shows the expected frame IDs at the documented cadence
- [ ] Every signal in the preset has a sane idle reading on the dash
- [ ] Sweeping each input (throttle, brake, RPM) moves the right signal
      and only that signal
- [ ] No widget sits stuck at `min` / `max` / `0` — that means a scale
      or offset bug
- [ ] `timeoutMs` is set per signal — values that update every 5 s need
      `timeoutMs: 10000`, not the default 500 ms, or they will flicker
      to the "invalid" state on the dash
- [ ] If `warningLevel`/`dangerLevel` are set, they obey the monotonic
      ramp invariant (high-side: `warningLevel <= dangerLevel`;
      low-side: `dangerLevel <= warningLevel`) —
      [#1010](https://github.com/tburkhalterr/CANShift/issues/1010)
- [ ] For OBD-II: the polling block has `mode: 1`, a PID from the
      standard catalog, and `intervalMs >= 100`
- [ ] Outbound frame IDs in the `out` block (map switch, cruise) match
      the ECU's expected input IDs — these are NOT auto-discovered

---

## Reference implementations

- **Broadcast (MaxxECU)** —
  [`canshift-firmware/data/config/signals.json`](../canshift-firmware/data/config/signals.json)
  is the firmware default. `MAXXECU_SIGNALS` in
  [`ecu-profiles/index.ts`](../canshift-core/src/ecu-profiles/index.ts)
  is the same data exposed to Studio. Mirror its shape, including the
  bit-packed flag signals sharing a single status byte.
- **OBD-II (J1979 standard PIDs)** — `OBDII_SIGNALS` in
  [`ecu-profiles/index.ts`](../canshift-core/src/ecu-profiles/index.ts)
  (line 324) and the PID catalog in
  [`obd2-mode01-pids.ts`](../canshift-core/src/ecu-profiles/obd2-mode01-pids.ts)
  with worked-out scale/offset comments at the top.
- **RealDash importer** —
  [`canshift-core/src/realdash/parse-realdash-xml.ts`](../canshift-core/src/realdash/parse-realdash-xml.ts).
  Pure regex parser, no XML dependency, validates every emitted signal
  through `SignalDefSchema`. Good cross-reference when reverse-engineering
  a CAN protocol from a XML.

---

## Related

- [`docs/ecu-integration.md`](ecu-integration.md) — full annotated field reference
- [`docs/can-integration-notes.md`](can-integration-notes.md) — CAN Pal wiring + bus health
- [`docs/FIRST_FLASH.md`](FIRST_FLASH.md) — pre-flight checklist for new hardware
- [`docs/config-contract.md`](config-contract.md) — overall config JSON contract
