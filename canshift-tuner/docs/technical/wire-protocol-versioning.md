# Wire protocol versioning

The compatibility contract between the Tuner build and the firmware build it connects to over WebSerial. Codifies the rule the connect-time handshake (`CMD_QUERY_VERSION`, issue #1365) enforces.

## Versions in play

| Where | What | Source |
|---|---|---|
| Tuner build | Expected firmware **major** | Vite `define: __EXPECTED_FIRMWARE_MAJOR__` — read from `canshift-firmware/package.json` at build time |
| Firmware build | Reported `version` | `APP_VERSION_STR` injected from `canshift-firmware/package.json` |
| Firmware build | Reported `protocol` | `USB_PROTOCOL_VERSION` constant in `canshift-firmware/include/app_config.h` |

The firmware answers `CMD_QUERY_VERSION` (opcode `0x10`) with:

```json
{"status":"ok","version":"0.12.0","protocol":2,"is_day":0}
```

## Rule

**Major must match.** Minor and patch may differ.

- `0.12.0` (firmware) vs tuner expecting `0.x` → compatible.
- `0.12.0` vs tuner expecting `1.x` → mismatch.
- `1.4.2` vs tuner expecting `1.x` → compatible.

The major version is the only field the handshake gates on. Bumping it is the explicit signal to firmware authors that the typed envelope (`CMD_PUT_DEVICE_CONFIG`, `CMD_PUT_INPUT_BINDINGS`, `CMD_PUSH_CONFIG`) shape has changed in a way the old tuner cannot encode.

## What happens on mismatch

The tuner sets `useDeviceStore.firmwareCompat = { kind: 'mismatch', ... }`. Two things follow:

1. **Burn is disabled.** `useBurnDashboard` reads `firmwareCompat` and refuses to push a config — pushing against a wrong-major firmware can silently corrupt persistent state because the typed envelope drifts.
2. **A banner is rendered** above the route outlet explaining the expected vs reported major. The Header's firmware slot also flips to a red `fw vX.Y.Z · mismatch` pill.

The user is expected to flash a matching firmware build (via the Flasher route, follow-up to #1351) before continuing.

## What happens on protocol drift without a major bump

If the tuner sends an opcode the firmware doesn't know — usually because tuner is ahead of firmware on a minor — the firmware now responds with:

```json
{"status":"error","message":"unknown_command"}
```

(Previously the default branch in `usb_dispatch.cpp` returned `{"status":"ok"}`, which masked the drift. #1365 tightened that.)

This is a soft signal: the tuner surface that issued the unknown command sees an error result and can decide how to recover (e.g. degrade the feature instead of pretending it succeeded). No banner, no Burn block — only the originating call sees the error.

## When to bump what

| Change | Bump major? | Bump protocol? |
|---|---|---|
| Add a new opcode | No | Optional |
| Add a new optional field to an existing payload | No | No |
| Add a new **required** field to an existing payload | Yes | Yes |
| Change an existing field's type or semantics | Yes | Yes |
| Rename an opcode without changing wire shape | No | No |

The protocol number (`USB_PROTOCOL_VERSION`) is informational today — the handshake reports it but doesn't gate on it. It's there so a future tuner can refine the compatibility check (e.g. "major match AND protocol ≥ N").

## Related

- [`webserial-protocol.md`](./webserial-protocol.md) — full wire format reference.
- Issue #1365 — original handshake spec.
- Issue #1340 — original gate triple (split: this skill is the salvageable piece).
