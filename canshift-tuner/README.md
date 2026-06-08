# canshift-tuner

Betaflight-style web configurator for CANShift dashes. Hosted on Vercel, talks
to the firmware via **WebSerial** over the CH340 UART that already serves as
the upload / serial port.

## Why this package

The previous in-browser configurator (`canshift-studio-web`) was an SPA
embedded in the firmware and served from SPIFFS over a WiFi AP the device
brought up. That coupled every Studio change to a firmware reflash, tied the
studio's CI to the firmware partition layout, and on WROOM boards without
PSRAM the WiFi stack fought the USB receive buffer for the ~80 KB of contiguous
DRAM that just isn't there at boot. Both packages have been retired (#1351);
`canshift-tuner` is the single configurator surface going forward.

- Hosted on Vercel — Studio updates ship without touching the device.
- WebSerial transport — works on any Chromium browser, talks to the
  Arduino `Serial` (UART) the firmware speaks. No WiFi stack, no SPA-on-SPIFFS.
- Betaflight-style sidebar UX — sections for Welcome, Dashboard editor,
  CAN bus, OBD-II, Themes, Live data, Logs, CLI, Firmware (flasher), About.

## Dev

```bash
npm install
npm run dev          # vite — http://localhost:5173
npm run typecheck
npm run test
npm run build
```

WebSerial requires Chrome / Edge / Brave / Opera. Firefox + Safari users get
a friendly fallback message.

## Browser requirements

- WebSerial: Chromium 89+ (`navigator.serial`).
- Served over HTTPS in production (Vercel default). `localhost` works under
  plain HTTP for dev.
