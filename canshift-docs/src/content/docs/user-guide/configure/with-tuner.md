---
title: "Configure with the Tuner"
description: "Edit the dashboard from canshift-tuner over Web Serial."
sidebar:
  order: 1
---

The **Tuner** is a web SPA hosted on Vercel. It talks to the dash over Web
Serial. You change a colour, move a widget, add a page, then click **Burn** —
the dash reloads the new config without re-flashing.

## Connect

1. Plug the dash in via USB.
2. Open [canshift-tuner.vercel.app](https://canshift-tuner.vercel.app) in a
   Chromium browser.
3. Click **Connect** in the top-right and pick the serial port.

The tuner lists the signals it sees, the CAN status, and lets you edit pages
live.

## Burn = write the config

When you click **Burn**, the tuner ships the full JSON envelope to the dash.
The dash:

1. Shows the "Saving config…" overlay.
2. Writes the file to SPIFFS atomically (the previous file is renamed `.bak`).
3. Reloads the config in memory.
4. Rebuilds the pages.

If the overlay flips red, see [Burn errors](/user-guide/configure/burn-errors/).

## Schema vs firmware version

The firmware checks at boot that `dashboard.json` matches the schema it was
compiled against. If you re-flash to a newer firmware but SPIFFS still holds an
older `dashboard.json`, the ErrorBar will surface `SCHEMA_MISMATCH` and the
dash will fall back to the built-in default config.

Fix: re-edit and burn from the tuner. The tuner reads the current schema from
`canshift-core`, so a burn from a freshly-loaded tuner will always match the
current firmware.
