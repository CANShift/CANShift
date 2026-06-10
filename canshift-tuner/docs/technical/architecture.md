# Architecture

High-level map of how the Tuner is wired and where it sits relative to the
rest of the CANShift monorepo.

## One-line summary

The Tuner is a **standalone SPA**. It owns no firmware code, no embedded
assets, and no on-device storage. It connects to a CANShift dash over
**WebSerial** (USB-C, CH340 UART), sends the same JSON command envelope the
firmware has always spoken, and surfaces the device state back to the user.

```
┌─────────────────┐         WebSerial          ┌─────────────────┐
│  Browser tab    │ ────────────────────────►  │  CANShift dash  │
│  Tuner SPA      │   USB-C (CH340 UART)       │  ESP32 firmware │
│  (Vercel)       │ ◄────────────────────────  │  + LVGL UI      │
└─────────────────┘    JSON lines (newline-     └─────────────────┘
                       framed both directions)
```

## Repo location

`canshift-tuner/` is a sibling package of `canshift-firmware/` (the ESP32
firmware). It depends on `@tmbk/canshift-core` for the shared Zod schemas +
design tokens. See the top-level [README](../../../README.md) for the full
monorepo layout.

## Section / route map

| Route | Component | Status |
|---|---|---|
| `/` | `WelcomeRoute` | Wired |
| `/dashboard` | `EditorRoute` (lazy) | Wired |
| `/can`, `/obd2`, `/themes`, `/live`, `/logs`, `/cli`, `/firmware`, `/about` | `PlaceholderRoute` | Stubs, filled by follow-up PRs |

## State management

Zustand stores under `src/stores/`:

- `dashboard.store.ts` — current dashboard config (pages, widgets, palettes)
- `device.store.ts` — connection state (`connected`, `simulationMode`,
  `transport`, etc.)
- `connection.store.ts` — WebSerial port handle + status (`disconnected`,
  `connecting`, `connected`, `reconnecting`) + `connect/disconnect/tryAutoReconnect`
- `signal.store.ts` — live signal values
- `device-config.store.ts` — device hardware config (TWAI pins, brightness, etc.)
- `input-bindings.store.ts` — input → command mappings
- `log.store.ts` — structured log entries
- `screen-settings.store.ts` — display preferences

## Transport layer

`src/transport/webserial-client.ts` owns the singleton WebSerial client.
It frames outbound commands as `{"cmd":<op>,"payload":...}\n` and parses
inbound `\n`-terminated JSON. The first non-discriminated frame after a
`send()` is treated as the ack; frames carrying `log`, `tele`, `can`, or
`can_stat` discriminators route to `subscribe()` listeners.

`src/transport/index.ts` re-exports a stable surface (`usbService`,
`deviceIpc`, `deviceEvents`, `canScannerIpc`, `deviceConfigIpc`,
`inputBindingsIpc`) — kept stable so the Editor (ported in #1352) compiles
unchanged on top.

See [webserial-protocol.md](webserial-protocol.md) for the wire details.

## Where things explicitly do NOT live

- **Flashing.** Not in this package yet — see the placeholder `/firmware`
  route. The current standalone is `tburkhalterr/canshift-flasher`; it
  will be absorbed (#1351).
- **Firmware OTA.** Will follow the flasher work.
- **WiFi.** Intentionally not supported. The Tuner is USB-only by design;
  the firmware's WiFi stack is being removed in parallel (#1351).
- **Cloud storage.** No backend — everything is browser-local. Save flows
  push directly to the dash over WebSerial.
