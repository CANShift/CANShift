# Troubleshooting

Common issues when running CANShift Tuner, and how to recover from them.
If your problem is not listed, open an issue on the
[CANShift repo](https://github.com/tburkhalterr/CANShift/issues) with the
browser, OS, and the contents of the browser DevTools console.

## "Connect device" button does nothing

Click the button → nothing happens, no permission prompt.

- **Check the browser.** Firefox and Safari do **not** ship WebSerial. Use
  Chrome 89+, Edge 89+, Brave, or Opera. The Welcome screen detects this
  and replaces the button with a banner — if you still see the button on
  an unsupported browser, hard-refresh (Cmd-Shift-R / Ctrl-Shift-R).
- **Check the URL scheme.** WebSerial requires HTTPS in production. The
  Vercel deployment is HTTPS by default; `localhost` works under plain
  HTTP for dev. Any other origin must be HTTPS.
- **Pop-up blocker.** Some pop-up blockers swallow the port-picker
  permission prompt silently. Disable the blocker for the Tuner origin
  and retry.

## Port appears in the picker but `connect()` rejects

The user picked a port, the prompt closed, but the status flips to
`Disconnected` again with an error pill.

- **Port already open.** Another tab, Arduino IDE, PlatformIO Monitor,
  `screen`, or `pio device monitor` may hold the port exclusive. Close
  them and retry.
- **Driver missing.** CrowPanel-28 ships with a CH340. macOS 11+ has the
  driver built in; Windows 11 picks it up over Windows Update. If your
  port doesn't appear in the picker at all, install the driver from
  [WCH](https://www.wch-ic.com/downloads/CH341SER_ZIP.html) (Windows) or
  reboot after a fresh macOS install.
- **Cable is power-only.** Some USB-C cables ship with only the power
  pins wired. Try another cable — preferably the one that came with the
  board.

## Connected but firmware version stays at `fw —`

The header connection dot is green but the firmware version slot stays
blank.

Version-query (`CMD_QUERY_VERSION` 0x10) is wired in a follow-up PR
(#1340 sub-c). Until then the slot stays as a placeholder. The Editor
and other transport-backed surfaces still work — only the cosmetic
version label is missing.

## Device disconnects randomly during use

Status flips from `Connected` to `Reconnecting` repeatedly, sometimes
within seconds.

- **Cable / hub power.** USB hubs and laptop ports under load can drop
  the rail below the brownout threshold. Plug straight into a laptop USB
  port (preferably USB-A); avoid passive USB-C dongles.
- **Watchdog reset on the firmware side.** If a CAN bus is connected
  and floods the device, the TWAI driver can starve the UI task; the
  task WDT fires and resets the chip. Disconnect the CAN bus to confirm.
  Logs in the firmware print the reset reason on every boot.
- **Browser tab backgrounded.** Some browsers throttle background-tab
  serial streams. Keep the Tuner tab focused while editing.

## "Permission denied" after granting access once

You authorized a port previously but the auto-reconnect on next visit
fails with `Permission denied`.

WebSerial permissions are scoped per origin + per device VID/PID + per
machine USB port. If any of those change (different cable that re-numbers
the port, browser cleared site data, you connected via a different USB
port on the laptop), the previous grant doesn't apply. Click `Connect
device` again — the picker now shows the device with `(permission
granted)` and one click reopens it.

## The editor opens but stays blank

Likely path: `vite dev` running and you're not connected.

The Tuner auto-enters **simulation mode** in development (`vite dev`)
when no device is connected. It seeds the editor with `DEFAULT_SIM_CONFIG`
(a demo dashboard). If the editor still looks empty:

- Check the browser console for the `[ws]` or `[serial]` warnings — a
  schema parse error on the seed config silently leaves the store empty
  (a known sharp edge).
- Open `useDashboardStore.getState().config` in the DevTools console
  (Zustand stores are not exposed by default; use the React DevTools to
  inspect the App component's state).

In **production** mode (Vercel deploy) the simulation bootstrap is
intentionally off — the only way to populate the editor is to connect a
real device.

## CSP / "Failed to fetch" errors in the console

The Tuner doesn't currently set a strict CSP (canshift-flasher does, for
its esptool proxy). If you see `Failed to fetch` for a `@tmbk/canshift-core`
module path during dev:

- **Token regeneration missed.** Run `npm run tokens:gen` in
  `canshift-tuner/` to regenerate `src/styles/tokens.generated.css`.
- **Stale `node_modules`.** Remove `canshift-tuner/node_modules` and
  re-run `npm install`.

## Browser flag: enabling WebSerial in older Chrome

Chrome shipped WebSerial stable in 89. If you're on an older corporate
build:

```
chrome://flags/#enable-experimental-web-platform-features
```

Enable it, restart the browser, retry. Long-term: ask IT to update.
