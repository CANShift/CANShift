# canshift-studio-web

Dash-hosted Studio renderer — **phase-1 spike for issue #1104**, part of the architectural shift described in #1077.

The package is intentionally isolated from the root workspace until the phase-1 go/no-go gate is signed off. Once green, phase 3 (#1105) wires the firmware WebServer/WS endpoints and decommissioning of `canshift-studio/` begins.

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
npm run dev          # http://localhost:5173, stubbed transport
```

The dev server boots against `src/transport/index.ts`, which returns canned data for every device action so the renderer mounts with no firmware in the loop. Click "Enter simulation" on the connect screen to seed the dashboard store with `DEFAULT_SIM_CONFIG` and render the editor against that.

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

### Stubbed

- **`src/transport/index.ts`** — every method returns a benign canned response so the renderer mounts and renders. Phase 3 (#1105) replaces the bodies with `fetch` + a single WS subscription against the firmware's `/ws` endpoint. The function signatures are deliberately preserved so the swap is mechanical.
- **`src/hooks/useLiveSignals.ts`** — simulation path is intact (rAF oscillator over `signal.store`); connected path subscribes through the transport stub instead of the Electron IPC channel.

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
