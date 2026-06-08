# Getting started

CANShift Tuner is a browser-based configurator for the CANShift dash. It runs
fully client-side, talks to the dash over a USB-C cable using WebSerial, and
needs no install.

## What you need

- A CANShift dash (CrowPanel-28 or compatible).
- A **USB-C data cable** — power-only cables won't enumerate.
- One of these browsers: **Chrome 89+**, **Edge 89+**, **Brave**, **Opera**.
  Firefox and Safari don't ship WebSerial.

## First connect

1. Open the Tuner: <https://tuner.canshift.tmbk.ch> *(deploy target — replace with the live URL)*.
2. Plug the dash into your computer.
3. Click **Connect device** on the Welcome screen.
4. The browser shows a port picker — pick the entry that matches your dash.
   On macOS it usually appears as `usbserial-XXXX`; on Windows as
   `USB-SERIAL CH340 (COMx)`.
5. The Header's status dot turns green and you land on the **Dashboard**
   section.

The Tuner remembers the port you authorized. On your next visit, it
auto-reconnects without showing the picker — provided the same physical USB
port + cable + machine + browser.

## Navigation

| Section | What you do here |
|---|---|
| **Welcome** | Connect / reconnect, see device info |
| **Dashboard** | Page layout editor — drop widgets, arrange them, set colours |
| **CAN Bus** | *Coming soon* — bind incoming CAN signals to widget data sources |
| **OBD-II** | *Coming soon* — configure mode/PID polling slots |
| **Themes** | *Coming soon* — day/night palette, top-bar layout |
| **Live Data** | *Coming soon* — live signal values, scopes |
| **Logs** | *Coming soon* — CLI panel, structured firmware log filter/export |
| **CLI** | *Coming soon* — raw command terminal |
| **Firmware** | *Coming soon* — in-browser flasher |
| **About** | Version, links, credits |

Sections marked *Coming soon* are placeholders today — they'll be wired
incrementally. See [the umbrella issue (#1351)](https://github.com/tburkhalterr/CANShift/issues/1351)
for the roadmap.

## Simulation mode (dev only)

If you're running `npm run dev` locally without a device plugged in, the
Tuner drops you straight into **simulation mode** — a built-in demo dashboard
loads so you can edit and preview widgets without hardware on the desk. The
Header shows `Simulation` in the status slot.

This is **off in the production deploy**. Real users always go through
Welcome → Connect.

## Saving changes

The **Save** button in the Header is currently a placeholder. The wired
save flow (push edits back to the device over WebSerial) lands in a
follow-up PR. In the meantime, edits live in the browser's Zustand store
and survive in-tab navigation but **not** a page reload.

When in doubt, hit **Connect device** again — it's idempotent and clears
any stale transport state.
