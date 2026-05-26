# canshift-studio-web

Dash-hosted Studio renderer for the architectural shift described in #1077.

Phase 1 spike (#1104) shipped the scaffold and bundle-size verdict.
Phase 3 (#1105 / #1108) — current — replaces the stub transport with a real
WebSocket client against the firmware's `/ws` endpoint on port 81.

---

## Verdict — **GO**

| Metric | Result | Ceiling |
|---|---|---|
| Entry chunk (`index-*.js`, gzipped) | **24 KB** | 500 KB |
| Initial graph (entry + `vendor-react` + `vendor-state` + CSS, gzipped) | **~86 KB** | 500 KB |
| All chunks ever shipped (gzipped) | **151 KB** | n/a |

Even counting every chunk Vite produces, the gzipped payload stays at roughly 30 percent of the 500 KB ceiling. The two largest contributors (`vendor-react`, `EditorRoute`) are already split out; Radix lives in `vendor-radix` and is fetched lazily alongside the editor.

### Why the headroom is real, not artificial

The Electron Studio's heavy dependencies — xterm, esptool-js, react-markdown + sanitize, electron-updater — were dropped per the scope frozen 2026-05-25 (see PR body). The bulk of what remains is the editor surface itself (Canvas, WidgetPalette, PropertyPanel, property-panel/*), which lazy-loads behind a `Suspense` boundary.

---

## Dev loop

```bash
npm install
npm run dev          # http://localhost:5173
```

The connect screen offers three paths:

1. Connect to a real dash over WebSocket (default `canshift.local:81`, with a
   manual host/port input for environments where mDNS doesn't resolve).
2. Boot the in-repo **mock WS server** in a second terminal and connect to it:

   ```bash
   npm run dev:mock     # ws://127.0.0.1:8181/
   ```

   Then point the renderer at `127.0.0.1` port `8181`. The mock replies to
   every command with canned data and streams telemetry on a 200 ms timer so
   the editor's live-signal hooks light up.
3. Click "enter simulation mode" — same shortcut as the phase-1 spike, seeds
   the dashboard store with `DEFAULT_SIM_CONFIG` so the editor renders
   without any backend.

> **Phone-less first connect** — on a fresh device the WiFi AP is dormant
> (only the BLE mobile app or a manual toggle can bring it up). If the laptop
> can't see the `CANShift-XXXX` SSID, walk to the dash, swipe the top bar
> down to open Settings, and toggle **WIFI AP → ON**. The setting is
> persisted in NVS so subsequent boots bring the AP up automatically and the
> laptop browser can hit `http://canshift.local` (or the AP IP) without
> another dash trip. See `canshift-firmware/src/hal/wifi/wifi_ap.cpp` for the
> auto-start mechanics.

## Build

```bash
npm run build        # → dist/, plain Vite SPA
npm run preview      # serves dist/ for sanity checks
```

`prebuild` rebuilds `canshift-core` and regenerates `src/styles/tokens.generated.css` from `DARK_TOKENS`. Identical generator to `canshift-studio/scripts/generate-tokens.css.mjs`; phase 3 may collapse the two if no drift surfaces.

## Bundle measurement

The bundle-size script is the canonical source for go/no-go numbers:

```bash
npm run build
npm run size:report
```

It walks `dist/assets/*.js`, computes gzip sizes via `node:zlib`, and prints a sorted table. To gzip a single file (e.g. only the entry chunk):

```bash
gzip -c dist/assets/index-*.js | wc -c
```

Numbers measured at HEAD of `spike/studio-web-phase-1-1104`:

```
vendor-react       172.07 KB raw  /  56.69 KB gzip
EditorRoute        126.31 KB raw  /  37.22 KB gzip   (lazy)
vendor-radix        73.40 KB raw  /  25.09 KB gzip   (lazy, with EditorRoute)
index               93.88 KB raw  /  23.91 KB gzip
vendor-state         8.68 KB raw  /   3.44 KB gzip
index.css           23.04 KB raw  /   4.79 KB gzip
─────────────────────────────────────────────────
TOTAL              497.38 KB raw  / 151.14 KB gzip
```

---

## What's in / what's out

### Kept

- React + Zustand + Tailwind + Radix + react-router-dom (hash router)
- `@tmbk/canshift-core` (schemas, design tokens)
- Editor surfaces: `Canvas`, `WidgetPalette`, `WidgetPreview`, `PropertyPanel`, `property-panel/*`, `TestValuesPanel`, `ScreenSettingsPanel`, `DiagnosticsPanel`, `ColorRampEditor`
- Stores the editor reads from: `dashboard.store`, `signal.store`, `screenSettings.store`, `testMode.store`, `log.store`, `device.store`, `signalMapper.store`, `error.store`
- Shells (minimal rewrites, not copies): `TopBar`, `SideRail`, `StatusBar`, `ConnectScreen` — see the dedicated files for why each one was rewritten rather than copied.
- Transport stub: `src/transport/index.ts` exposes the same surface as `canshift-studio/src/services/ipc.service.ts` so call sites in `Canvas`, `ScreenSettingsPanel`, etc. didn't need restructuring.

### Dropped

- **CLI panel** (~415 KB) — xterm, xterm addons, all `cli/` and `useCliDetach`/`useCliLogBridge` hooks, `CliTerminal`, detached-window plumbing.
- **UpdateRoute / OTA flow** — `UpdateRoute`, `useUpdater`, `useFirmwareCheck`, `useFirmwareFlash`, `electron-updater`. Moves to dash internally in phase 3; flasher work lives in the separate `canshift-flasher` repo (#1081).
- **SafeMarkdown** (~390 KB) — `react-markdown` + `rehype-sanitize` + `remark-gfm`. Release-notes UX moves out of Studio.
- **esptool-js / Web Serial** — entire flashing surface owned by #1081.
- **Electron leftovers** — all `main/`, `preload/`, `shared/ipc-*`, `electron-builder`, `electron-updater`, `asarIntegrity`, `security.service` CSP wiring.
- **Renderer-shaped wrong-place deps** — `serialport`, `bonjour-service`, `fast-deep-equal`, `spark-md5`.

### Real transport (phase 3)

- **`src/transport/ws-client.ts`** — `WsClient` owns the native browser
  `WebSocket`. Exposes `connect`/`disconnect`/`send(cmd, fields)`/`subscribe`
  with exponential reconnect (cap 30 s) and single-client refusal handling
  (firmware sends a `single-client only` text frame then closes — surfaced as
  the `single_client` error so the connect screen can show a meaningful
  message).
- **`src/transport/index.ts`** — same surface as the phase-1 stub, but
  command methods now route through `WsClient.send()` and the event
  subscribers route through discriminator dispatch (`tele`, `can_stat`,
  `can`, `log`). Stubbed surfaces (file dialogs, release feed, native menus)
  stay stubbed — they're out of scope for the dash-hosted renderer per the
  #1077 architectural freeze.
- **`src/stores/connection.store.ts`** — owns the host/port pair, the live
  `WsStatus`, and the connect/disconnect actions. Mirrors successful opens
  into `device.store` so the editor's `connected` flag stays the single
  source of truth.

### Still stubbed

- `configService.{open,save,saveAs,import,export}` — browser has no native
  file dialogs. The dash-hosted import/export endpoint is a follow-up.
- `releasesIpc.getLatest` — release feed moves to a dash-hosted endpoint in
  phase 4.
- `deviceConfigIpc` / `inputBindingsIpc` — these are dash-side payloads that
  don't have dedicated WS commands yet.

---

## Open questions surfaced by the spike

- **Session persistence** — `sessionIpc.{getLastFilePath, getLastPortPath, getFirstRunCompleted, …}` is stubbed. The architectural call is "no browser localStorage for config", so phase 3 needs a tiny dash-side store (NVS-backed?) for first-run + last-connection bookkeeping. Worth a separate sub-issue under #1077.
- **Config file open/save** — `configService.{open, save, saveAs, import, export}` previously used Electron's native file dialogs. Browser path is `<input type="file">` + `Blob` download. Phase 3 design decision: do we keep file-based import/export as a power-user feature, or is "everything lives on the dash" strict?
- **Menu events** — the Electron menu fired `dashboard.undo`, `dashboard.save`, etc. The web build has none of that — add keyboard shortcuts (the editor already wires `Ctrl/Cmd-Z` etc. into the dashboard store, but only when the canvas has focus). Worth a small UX pass in phase 3.
- **Toast / sonner** — currently mounted by nothing; tests didn't expose any user-visible regression but worth a sanity check after phase 3 wires the real transport. Could be dropped if no caller surfaces it.

## Constraints respected

- **No changes to `canshift-studio/`** — the Electron package is read-only here.
- **No changes to `canshift-firmware/`, `canshift-mobile/`, `canshift-core/src/`** — read-only references only.
- **Not added to the root workspace `package.json`** — the package is isolated until the verdict is in. Adding it to the workspace happens as part of phase 3 once the path is committed to.
