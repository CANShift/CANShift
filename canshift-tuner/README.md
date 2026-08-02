# canshift-tuner

Betaflight-style web configurator for CANShift dashes. Hosted on Vercel, talks
to the firmware via **WebSerial** over the CH340 UART that already serves as
the upload / serial port.

## Why this package

`canshift-tuner` is the configurator surface for CANShift dashes.

- Hosted on Vercel — tuner updates ship without touching the device.
- WebSerial transport — works on any Chromium browser, talks to the
  Arduino `Serial` (UART) the firmware speaks. No on-device WiFi stack, no
  SPA-on-SPIFFS coupling between configurator and firmware partitions.
- Betaflight-style sidebar UX — Welcome, Dashboard editor, Themes, CAN bus,
  ECU profile, OBD-II, Live data, Logs, CLI, Firmware (flasher), About.

## Editor highlights

- Drag-to-bind: the Signals panel (inspector) is fed by the live CAN scan —
  drag a signal onto the canvas to create a bound widget, onto an existing
  widget to rebind it, or a Library widget onto a signal row.
- 100-step undo/redo (`⌘Z` / `⇧⌘Z`) with a labelled History panel; autosave
  to local storage restores the exact canvas (selection included) on reload.
- Multi-project model — pages + widgets + ECU profile + theme + target panel
  switch as one unit; the CAN scan and Learn mode keep running across views.
- Burn gate — unbound widgets render the device's `--` placeholder, are
  counted in the toolbar, and prompt once before burning.
- Observability with a visible opt-out (About view): Sentry crash reports and
  PostHog flow events; payloads, frame ids and names are scrubbed client-side.

## Dev

```bash
# canshift-core must be built first — the tuner resolves its dist/
cd ../canshift-core && npm install && npm run build && cd ../canshift-tuner

npm install
npm run dev          # vite — http://localhost:5173 (simulation mode without a device)
npm run typecheck
npm run test         # vitest
npm run lint
npm run format:check # enforced in CI
npm run build
```

Optional env: `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` (analytics) and
`VITE_SENTRY_DSN` (crash reports) — both no-op when unset.

WebSerial requires Chrome / Edge / Brave / Opera. Firefox + Safari users get
a friendly fallback message.

## Browser requirements

- WebSerial: Chromium 89+ (`navigator.serial`).
- Served over HTTPS in production (Vercel default). `localhost` works under
  plain HTTP for dev.
