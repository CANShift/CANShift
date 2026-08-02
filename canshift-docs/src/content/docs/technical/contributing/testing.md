---
title: 'Testing'
description: 'Unity (firmware C++), cargo test (Rust ports), Vitest (TS packages).'
sidebar:
  order: 2
---

CANShift has three test harnesses, one per language. CI runs all three on
every PR; locally you can run them independently.

## Firmware C++ — Unity on native

The firmware test suite uses PlatformIO's Unity integration with the `native`
env. Tests live under `canshift-firmware/test/<suite>/test_main.cpp`.

```bash
cd canshift-firmware
pio test -e native
```

Filter to a single suite:

```bash
pio test -e native -f test_can_parser
```

What's covered:

- `test_can_parser` / `test_can_parser_signed` — `CanParser::detail::decodeBytes`
- `test_signal_map` — name → SignalId lookup
- `test_signal_store` — push / read / timeout invalidation
- `test_error_store` / `test_error_store_wrap` — ring buffer push / dismiss
- `test_format_float` — `FloatFormat` parity gate (mirrors the Rust crate)
- `test_screen_profile` — design-space scaling
- `test_sensor_color_ramp` / `test_sensor_palette`
- `test_usb_envelope` — payload-slice brace walk
- `test_config_loader` — schema version + JSON parse
- `test_logger` — UART lock + envelope framing
- `test_parse_u32_strict` — config parse helper

The `test/native/shim/` directory holds host-side fakes for HAL surfaces
(StorageDriver, etc.) so tests can run without an ESP32.

## Rust crates — cargo test

Each crate under `canshift-firmware/rust/` carries its own tests.

```bash
cd canshift-firmware/rust/can-parser
cargo test
```

Run every Rust suite from the workspace:

```bash
cd canshift-firmware/rust
cargo test --workspace
```

Each crate has parity tests that exercise the same fixtures as the matching
C++ Unity suite — flipping `USE_RUST_*=1` keeps observable behaviour.

## TypeScript packages — Vitest

```bash
cd canshift-core && npm test
cd canshift-tuner && npm test
```

`canshift-core` is the schema source of truth; bumping a Zod schema usually
breaks at least one schema-version test in `canshift-core` and a
roundtrip test in `canshift-tuner`. Fix both in the same PR.

## CI gates

| Package  | Gate                             | Where                                              |
| -------- | -------------------------------- | -------------------------------------------------- |
| firmware | clang-format pass                | GitHub Actions workflow                            |
| firmware | `pio test -e native`             | GitHub Actions                                     |
| firmware | Boot smoke (`[BOOT] Ready` line) | `.github/workflows/firmware-boot-smoke.yml` (#486) |
| rust     | `cargo test --workspace`         | GitHub Actions                                     |
| TS       | `typecheck` + `lint` + `test`    | GitHub Actions                                     |

All gates must pass before merge.

## Adding a new test

For firmware C++: add `canshift-firmware/test/test_<name>/test_main.cpp` plus
a one-line entry in `platformio.ini`'s `[env:native]` section if the test
needs extra includes.

For Rust: add tests in `#[cfg(test)] mod tests { … }` blocks inside the
relevant `lib.rs` or `ffi.rs`. The workspace `cargo test` picks them up
automatically.
