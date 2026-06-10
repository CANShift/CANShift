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
