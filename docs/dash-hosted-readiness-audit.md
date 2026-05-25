# Dash-hosted Readiness Audit — 2026-05-26

> Pre-flight audit of every component the end-user crosses between **plugging
> a virgin ESP32 into USB** and **editing a dashboard from a browser tab over
> the dash's WiFi AP**. Scope is "everything Studio Electron does today, but
> served by the dash itself". The Electron `canshift-studio` package stays
> read-only as the reference implementation until the dash-hosted path is
> validated end-to-end.

## TL;DR

| Component | Status |
|---|---|
| `canshift-flasher` (web flasher) | 🚧 in flight — code shipped, deploy & firmware artifact not wired |
| `canshift-firmware` — WS endpoint on `_wifi` env | 🚧 in flight — code shipped, env doesn't fit OTA partition |
| `canshift-firmware` — production `crowpanel_28` env | ❌ blocker — WS/AP code excluded by `APP_WIFI_OTA_ENABLED=0` |
| `canshift-firmware` — SPA hosting from flash | 🚧 in flight — phase 4 on branch `feat/firmware/serve-spa-1077-phase-4`, not yet on `main` / no open PR |
| `canshift-firmware` — AP trigger from on-device UX | ❌ blocker — AP only starts via mobile BLE cmd |
| `canshift-firmware` — mDNS `canshift.local` | ✅ ready (gated on AP being up) |
| `canshift-firmware` — mobile OTA path | ✅ ready, intact |
| `canshift-studio-web` — phase 3 transport | ✅ ready (mock + real WS client wired) |
| `canshift-studio-web` — config import/export, release feed, deviceConfigIpc | 🚧 in flight — stubs await dash-side endpoints |
| `canshift-studio` (Electron, legacy) | ⏸ reference only — do not touch |
| `canshift-core` | ✅ stable, no gap |
| `canshift-mobile` | ⏸ deferred from dash-hosted scope |
| CI — studio-web job | ✅ ready (#1112 merged) |
| CI — `crowpanel_28_wifi` env gate | ❌ blocker — not in CI, doesn't link |
| Docs — README sweep (#1113) | 🚧 in flight, gated on phase 4 |

**Totals.** 4 blockers, 7 in-flight, 2 deferred, 6 ready.

**Flashable today: NO.** Flash will work (the flasher code is sound), but
the freshly-flashed image won't host a dash-hosted Studio. After flash the
user gets:
- A working dashboard on the on-device LVGL UI.
- Mobile OTA still works (mobile starts the AP via BLE → POST `/update`).
- **No browser-reachable Studio at `canshift.local`** — production firmware
  is built with `APP_WIFI_OTA_ENABLED=0`, so the AP / WS / mDNS code is
  compiled out, and even if it were enabled there is no HTTP route serving
  the SPA from the dash.

The bootstrap flasher step itself (USB-flash via `canshift.tmbk.ch`) is
runtime-ready as soon as a `latest.bin` artifact is published to that
origin and `VITE_FIRMWARE_URL` points there.

---

## Per-component audit

### canshift-flasher

> Local clone: `/Users/thomas/Developer/TMBK/CANShift/canshift-flasher`.
> Currently on branch `feat/branding-align-with-studio` (= the PR #1 the
> user mentioned). Branch is up to date with origin.

**État.**
- Vite + React 19 + esptool-js 0.6.0. Single-page UI, four screens
  (idle / ready / flashing / success / failed) in `src/components/Flasher.tsx`.
- Web Serial gated to CH340 / CH9102 / CP210x (matches studio allowlist —
  `src/constants.ts:SUPPORTED_USB_FILTERS`).
- Firmware download path streams the binary from `VITE_FIRMWARE_URL`
  (default `https://canshift.tmbk.ch/firmware/latest.bin`) and writes it
  at offset `0x10000` with esptool-js (`src/lib/firmware.ts`, `src/lib/esptool.ts`).
- Success screen already tells the user: "Your dash now hosts Studio at
  `canshift.local`. Connect to the CANShift WiFi access point and open that
  URL in your browser." — so the flasher is written assuming the
  dash-hosted Studio works end-to-end.

**Gaps.**
1. **No Vercel deploy in evidence.** Branch `feat/branding-align-with-studio`
   is not merged into the flasher repo's main yet; the deploy pipeline
   is also user-owned (`README.md`: "This project does not include any
   deploy automation"). Verify the static `dist/` is reachable at
   `https://canshift.tmbk.ch/` with TLS, and that the host is configured
   to serve `/firmware/latest.bin` (separate static asset, not bundled
   with the SPA).
2. **No firmware artifact upload pipeline.** The README explicitly says
   "the firmware binary is **not** stored in this repo — the maintainer
   uploads it to the hosting origin on each firmware release." There is
   no GitHub Action or script that takes `crowpanel_28/firmware.bin`
   and ships it to `canshift.tmbk.ch/firmware/latest.bin`. Without
   that, the flasher will land on idle → connect → flash → 404 from the
   fetch and show the failure screen.
3. **No HMAC pre-flash verification.** Acknowledged in `README.md`
   threat model + tracked as #1081 v2 follow-up. Acceptable for v1
   (trusted USB link).
4. **No success-side instructions about how to trigger the AP.** The
   success screen sends the user to "join the CANShift WiFi AP"
   — but the AP only starts on demand via the mobile BLE cmd
   `start_wifi_ap` (see firmware section below). This is not a flasher
   gap per se; it is a downstream firmware gap that the flasher's
   success-state copy currently papers over.
5. **No browser detector for Safari/Firefox on iOS/Android.** The Chromium
   check (`isWebSerialSupported`) catches the dev-laptop case but the
   product surface "tablet on the AP" is silently broken if the tablet
   is iPad / Safari. Not blocking flash itself; documentation gap.

**Criticité.** Haute (#1, #2). Without the deploy + firmware artifact
upload the URL the dash success card brags about is a dead link.

---

### canshift-firmware

#### WebSocket endpoint (`port 81`, `wifi_ws.cpp`)

**État.** Shipped in #1108 and gated behind `APP_WIFI_OTA_ENABLED`. Single
client, dispatch-through-`UsbComm::handleLine`, aux-sink fan-out for
telemetry shared cleanly with the TCP server, WDT-subscribed task. Code
is sound and reviewed.

#### SPA hosting (phase 4 #1077)

**État.** Not on `main`. In flight on local branch
`feat/firmware/serve-spa-1077-phase-4` (3 commits ahead of `main`):
- `chore(studio-web): switch vite to stable asset filenames (no hash)`
- `chore(studio-web): emit gzipped artifacts in dist/`
- `chore(firmware): embed studio-web SPA via board_build.embed_files`

The first two commits prep the SPA artifact (stable filenames + gzipped
output) so the firmware can `embed_files` it deterministically. The third
adds `board_build.embed_files` entries + a `scripts/sync_studio_web.py`
helper to mirror `canshift-studio-web/dist/` into
`canshift-firmware/data/web/`. The branch also has uncommitted working-
tree edits in `wifi_ap.cpp` adding an `APP_SPA_SERVE`-gated `EMBED_BLOB`
declaration table and `registerSpaRoutes()` for `/`, `/assets/*.js.gz`,
`/assets/*.css.gz`, and the three Orbitron `.woff2` font assets — sending
`Content-Encoding: gzip` for the compressed artifacts. No PR opened
against `main` at audit time.

On `main`, `canshift-firmware/src/hal/wifi/wifi_ap.cpp:430-446` still
shows the WebServer on port 80 only registering `/status` and `/ota`.
There is no `s_server.on("/")` handler. Once the in-flight branch lands
a PR and merges, the route table becomes the source of truth for SPA
delivery, and the flow #2 SPA load step becomes unblocked.

**Gaps.**
1. **Code does not exist** to serve the SPA. Needs a phase-4 PR that:
   - Embeds the `canshift-studio-web/dist/` bundle (via
     `board_build.embed_files` or a SPIFFS partition), and
   - Registers HTTP routes (`/`, `/assets/*`, fallback for hash-router)
     against `s_server` so a browser request to `http://canshift.local`
     returns the SPA.
2. **Flash budget.** Studio-web ships ~497 KB raw / 151 KB gzip across all
   chunks (per `canshift-studio-web/README.md`). The dash partition layout
   today (`ota_4mb.csv`) gives each app slot 1536 KB. The production env
   currently uses 75.9% (1.19 MB) per #1108's table; adding ~500 KB raw
   of SPA bytes via `embed_files` (no per-file gzip in flash) would push
   the image to ~1.69 MB, **over** the partition. SPIFFS option leaves
   the app slot alone but SPIFFS is currently 832 KB (`ota_4mb.csv`) and
   already host the default config + fonts. Either: (a) gzip-serve from
   SPIFFS with a custom handler that sets `Content-Encoding: gzip`, or
   (b) repartition.
3. **Hash-router fallback.** `canshift-studio-web` uses a hash router
   (per its README "react-router-dom (hash router)"), so a single
   `GET /` returning `index.html` is sufficient — no SPA fallback for
   deep links needed. Reduces complexity; record as a known constraint.

**Criticité.** Bloquant.

#### Production env `crowpanel_28` — WS code compiled out

**État.** `include/app_config.h:340-341` defaults `APP_WIFI_OTA_ENABLED 0`.
The production env `[env:crowpanel_28]` in `platformio.ini` does not
override the flag — only `[env:crowpanel_28_wifi]` does. The bracket
gate `#if APP_BLE_ENABLED && APP_WIFI_OTA_ENABLED` in `wifi_ws.cpp:15`
and `wifi_ap.cpp:13` means a `crowpanel_28` build links neither file.

**Consequence.** A user flashed with the production binary today gets no
softAP, no WebSocket, no mDNS — dash-hosted Studio is functionally absent.
Only the on-device LVGL UI, USB JSON-lines, and (via BLE → WifiAp::start
inside a `_wifi` build) mobile OTA exist.

**Gaps.**
1. The release pipeline / flasher artifact must be sourced from a build
   that has `APP_WIFI_OTA_ENABLED=1`. Either:
   - Promote `crowpanel_28_wifi` to default once the flash budget gate
     passes, or
   - Keep two SKUs and have the flasher pick the WiFi variant.
2. Today `crowpanel_28_wifi` doesn't link cleanly (post-#1115 DRAM is
   fixed; `checkprogsize` still reports 107.7% — over the 1.5 MB OTA
   slot, per #1115 body). Resolving the flash overflow is a prerequisite
   for ever shipping a dash-hosted firmware artifact.

**Criticité.** Bloquant.

#### Flash budget (`crowpanel_28_wifi`)

**État.** Per #1115: image is 1 694 385 B vs 1 572 864 B partition slot
(107.7%). Adding the SPA embed on top makes it worse. The dependency
chain "phase 4 SPA embed needs `_wifi` env to be flashable" → "`_wifi`
env needs flash trim or repartition" is the most material work item
between today and a dash-hosted firmware artifact.

**Possible knobs.**
- Trim NimBLE further (already trimmed in `crowpanel_28` — diminishing
  returns).
- Drop mbedTLS code paths not on the OTA HMAC critical path (the AP
  password derivation is already SHA-256, low cost).
- Repartition to give app slots ~1.7 MB each (forfeit SPIFFS room
  symmetrically). Risk: every existing fielded device needs reflash
  not OTA to accept the new partition table — non-trivial migration.
- Compress assets in flash (e.g. miniz the SPA, decompress to PSRAM
  on AP-up).

**Criticité.** Bloquant.

#### DRAM budget

**État.** Post-#1115, `crowpanel_28_wifi` links cleanly against
`dram0_0_seg` (30.8% RAM, 101 076 B). Production `crowpanel_28` dropped
to 24.5% (was 32.2%). CI DRAM gate (`fail >70%, warn >65%`) passes.
No action needed.

**Criticité.** Aucune (sain).

#### mDNS `canshift.local`

**État.** Shipped in #1071 + extended in #1108. `MDNS.begin("canshift")`
+ `_canshift._tcp:5050` (TCP) + `_canshift_ws._tcp:81 path=/` (WS), per
`wifi_ap.cpp:403-411`. mDNS only runs while the AP is up — see next
section.

**Criticité.** Aucune (gated on AP).

#### AP lifecycle — the unscoped bloqueur

**État.** `WifiAp::start()` has exactly two call sites:
- `src/hal/ble/ble_server.cpp:360` — `start_wifi_ap` BLE command.
- (None on-device — no Settings button, no boot auto-start.)

The AP runs for `BLE_WIFI_AP_TIMEOUT_MS = 5 minutes` then self-stops
(`wifi_ap.cpp:449`). After timeout, mDNS, WS and TCP all tear down.

**Consequence pour dash-hosted Studio.** To open `canshift.local` from a
laptop the user must:
1. Have already paired the mobile app to the dash (BLE bonding flow),
   AND
2. Issue `start_wifi_ap` from the mobile app, AND
3. Connect the laptop to the AP and open the browser within 5 minutes.

This is **not** the user flow described in the audit's "User flow #2 —
daily use". For dash-hosted Studio without a phone, the firmware needs
one or more of:
- On-device Settings page entry to start the AP indefinitely (or for a
  user-chosen duration).
- A boot-time auto-start on first boot (and a UI toggle to disable).
- A long-press / chord on a physical button to launch the AP.

**Gaps.**
1. No on-device trigger to start the AP — bloqueur for the "browser-only"
   user flow.
2. 5-minute auto-stop is too short for an editing session — needs a
   "keep alive while a Studio client is connected" extension or a
   user-controlled timeout.

**Criticité.** Bloquant.

#### Mobile OTA path (`/ota` POST on port 80)

**État.** `wifi_ap.cpp:445` keeps `s_server.on("/ota", HTTP_POST, ...)`.
HMAC-verifies, bearer-token-gates, runs `Update.begin/write/end`.
Unchanged by #1108 and unchanged by any phase-4 work that adds `/` or
`/assets/*` routes — they coexist on port 80 alongside `/status` and
`/ota`. Behaviour intact for mobile.

**Criticité.** Aucune (verified intact).

---

### canshift-studio-web

**État.** Phase 1 spike (#1107) + phase 3 transport (#1114) merged.
Source tree at `canshift-studio-web/`:
- `src/transport/ws-client.ts` — native browser WebSocket, exponential
  backoff capped at 30 s, single-client refusal handling.
- `src/transport/index.ts` — preserves the Electron `services/ipc.service.ts`
  surface so editor call sites compile without change. Commands route to
  `WsClient.send()`; events route via discriminator subscriptions
  (`tele`, `can_stat`, `can`, `log`).
- `src/stores/connection.store.ts` — host/port pair, status, lastError.
  Persists last host/port in `localStorage`.
- `src/components/shared/ConnectScreen.tsx` — manual host/port form,
  default `canshift.local:81`, "Use canshift.local" reset, sim-mode link.
- `scripts/mock-ws.mjs` — dev-time mock WS server (`npm run dev:mock`).
- Bundle: 27 KB entry / 149 KB total gzipped — under the 500 KB ceiling.

**Gaps (per #1114 follow-up + observed).**
1. `configService.{open,save,saveAs,import,export}` stubbed — browser
   has no native file dialogs. The README flags this as a phase-4
   open question. Decision needed: drop file-based export, or wire
   `<input type="file">` + `Blob` download.
2. `releasesIpc.getLatest` stubbed — returns `offline`. Phase 4 dash-side
   `/release-feed` endpoint to wire.
3. `deviceConfigIpc.read/write` + `inputBindingsIpc.read/write` stubbed —
   no WS commands defined on the firmware for these payloads.
4. `appIpc.version()` hardcoded `'0.0.0-web'` — should query the dash for
   firmware version + report studio-web build version.
5. **mDNS from browser impossible.** ConnectScreen accepts both
   `canshift.local` and raw IP. The default works on most desktops
   (mDNS responder bundled with macOS, Windows 10+, modern Linux).
   Mobile browsers (Android Chrome, iOS Safari) often fail mDNS
   resolution — user must type the AP gateway IP. Not blocking but
   needs UX docs.
6. **Bundle artifact has no consumer yet.** `npm run build` produces
   `dist/` and gzips it (`gzip:dist` script from the recent
   `package.json` modification). Nothing in the firmware build pulls
   that artifact. Phase 4 wiring is the missing link.

**Criticité.** Haute pour blocker #6 (artifact pipeline). Moyenne pour
the rest of the stubbed surfaces — the editor mounts and edits / pushes
config without them.

---

### canshift-studio (Electron, legacy)

**État.** Reference implementation only. Do not modify per user
instruction. Stays the official Studio until the dash-hosted path
validates end-to-end.

**Plan de décommissionnement (suggested order).**
1. Dash-hosted firmware artifact ships and is reachable at
   `http://canshift.local` from a freshly-flashed device.
2. canshift-studio-web reaches feature parity for the "edit + push +
   live telemetry" loop (the only loop the audit covers).
3. Release pipeline drops the Electron `studio-release` matrix job from
   `release.yml` (see CI section).
4. canshift-studio package is moved into a `legacy/` subdir or its
   own branch, README marked end-of-life.

**Criticité.** Aucune en l'état (stays inert).

---

### canshift-core

**État.** Stable. Schemas + design tokens consumed by every other package.
Recent activity (`#1097` token additions, `#1051` palette freeze)
is sustaining work, no breaking changes. canshift-studio-web depends on
`@tmbk/canshift-core` via `file:` link and rebuilds it in `prebuild` (per
`package.json`).

**Criticité.** Aucune.

---

### canshift-mobile

**État.** Deferred from dash-hosted scope per project priorities (mobile
is in simulator only). Continues to drive OTA via WiFi:
1. Pair via BLE (`expo-secure-store` holds the AP password from the
   `AP_PWD` encrypted characteristic).
2. Send `start_wifi_ap` over BLE → dash brings up AP.
3. POST firmware blob to `http://<dash-ip>/update` with
   `Authorization: Bearer <token>` (where token = first 16 B of
   SHA-256(ap_password || "ota-bearer-v1"), per `wifi_ap.cpp:65-69`).

This path is byte-for-byte the same after phase 4 — `s_server.on("/ota",
HTTP_POST, ...)` is unchanged and the SPA routes will be additive
(`/`, `/assets/*`). Verified intact.

**Criticité.** Aucune (out of scope, path intact).

---

### CI / Infra

**État.**
- `core — lint + build` ✅
- `studio-web — typecheck + build` ✅ (added by #1112, path detection
  in `ci.yml:32, 60`)
- `firmware — PlatformIO build` builds **only** `crowpanel_28` and `sim`
  (`ci.yml:421` + `ci.yml:451`). `crowpanel_28_wifi` is **not** in CI.
- Flash budget gate (fail >85%) — runs on `crowpanel_28` only (the env
  that excludes WS code). Wifi env has its own overflow issue that no
  CI job catches.
- DRAM budget gate (fail >70%) — same: `crowpanel_28` only.
- iOS native build job — Electron-only artifact; unrelated to
  dash-hosted.
- Release workflow (`release.yml`) — still triggers the
  `Studio — build & release (matrix)` job. Will need decommissioning
  once Electron is retired (per #1109 follow-up).

**Gaps.**
1. `crowpanel_28_wifi` env never compiles in CI → regressions in
   `wifi_ws.cpp` / `wifi_ap.cpp` / `wifi_tcp.cpp` won't be caught at
   PR time. Tracked in #1109 ("add as warn-only until trim lands, then
   gating").
2. No CI for the SPA-embedded firmware artifact (phase 4 doesn't exist).
3. canshift-flasher repo has its own CI (per its README), out of
   monorepo scope — not audited here.

**Criticité.** Moyenne pour la CI gap (#1) — bloque la détection précoce
de régressions; haute pour la phase-4 artifact pipeline (downstream of
the missing code).

---

### Documentation

**État.** `docs/dash-hosted-readiness-audit.md` (this file) added. Existing
docs cover:
- `docs/overall-architecture.md` — pre-dash-hosted shape.
- `docs/architecture-roadmap-2026.md` — themes, no dash-hosted phase yet.
- `docs/usb-first-strategy.md` — phase 1 USB design.
- `docs/future-wireless-strategy.md` — phase 2+ wireless plans (likely
  superseded by #1077).

**Gaps.**
1. #1113 tracker open — README sweep gated on phase 4 landing. Per
   #1113 the sequencing is "wait until phase 3 (renderer refactor)
   lands then sweep all in one PR". Phase 3 has now landed (#1114), so
   #1113 is the next doc work to action — but the body still says
   "wait until phase 3"; needs an update.
2. No `docs/dash-hosted-architecture.md` or equivalent capturing the
   final end-to-end flow.
3. canshift-flasher repo README is accurate.

**Criticité.** Basse (docs follow code, not vice versa).

---

## User flow walkthrough

### Flow #1 — First flash via `canshift.tmbk.ch`

1. User plugs ESP32 into laptop USB on a Chromium browser.
2. Opens `https://canshift.tmbk.ch/`.
3. Flasher detects Web Serial, shows "Connect".
4. Click → port picker (filtered CH340 / CH9102 / CP210x).
5. Click "Flash latest" → `fetch(VITE_FIRMWARE_URL)` → esptool stream-erase + write at `0x10000`.
6. Reboot → on-device LVGL UI comes up.

**Bloquant si.**
- `canshift.tmbk.ch` not deployed / TLS misconfigured → flasher cannot
  load (HTTPS required for Web Serial).
- `VITE_FIRMWARE_URL` returns 404 → flasher fetch fails, user sees
  failure screen.
- The firmware artifact at that URL was built from the production
  `crowpanel_28` env (no WiFi) → flash succeeds but downstream flow #2
  is broken.

### Flow #2 — Daily use via `canshift.local`

1. User joins the `CANShift-XXXX` WiFi AP from laptop / tablet.
2. Opens `http://canshift.local/` in any browser.
3. Browser receives `index.html` + JS + CSS from the dash's port 80
   HTTP server.
4. SPA boots, ConnectScreen renders.
5. User clicks Connect (default `canshift.local:81`) → WS upgrade →
   `WsClient` opens.
6. App sends `cmd:0x01 GET_CONFIG` → dash replies with `DashboardConfig` JSON.
7. Editor mounts, telemetry streams.
8. Edit → click "Push to device" → `cmd:0x02 PUSH_CONFIG` → ack → dash
   reboots into the new config.

**Bloquant si.**
- AP not running. Today this means the mobile app has not issued
  `start_wifi_ap` in the last 5 minutes — **bloquant per default for
  the browser-only flow** (no on-device trigger).
- Firmware built without `APP_WIFI_OTA_ENABLED=1` → no AP code at all.
- `/` route not registered on `s_server` → 404 on the SPA fetch.
- SPA bytes not embedded / hosted → 404 on `index.html` or any asset.
- Browser doesn't resolve `.local` → user must enter the AP gateway IP.
- Concurrent Electron Studio over TCP holds the aux sink → browser sees
  command acks but no proactive telemetry. Documented; acceptable until
  multi-aux-sink fan-out lands.

### Flow #3 — Recovery flash

Identical to Flow #1. The flasher's idle-screen copy already says
"Same flow for first flash, update and recovery" and the success-screen
copy is identical. Documentation covers the case.

**Bloquant si.** Same as Flow #1.

### Flow #4 — Mobile OTA (legacy / parallel path)

1. Mobile app paired with dash via BLE.
2. User taps "Update firmware" → BLE write `{"cmd":"start_wifi_ap"}` →
   dash brings up AP.
3. Mobile joins AP (password fetched from `AP_PWD` BLE characteristic).
4. POST firmware `.bin` to `http://<dash-ip>/update` with
   `Authorization: Bearer <token>` (HMAC-verified, then `Update.end()` →
   reboot into the new slot).

**Bloquant si.**
- Mobile-side BLE pairing broken (out of scope here).
- Firmware compiled without `APP_BLE_ENABLED=1` (default `1`, fine).
- Firmware compiled without `APP_WIFI_OTA_ENABLED=1` → BLE cmd lands on
  the no-op stub (`wifi_ap.cpp:530`) → AP never comes up → mobile
  cannot reach `/update`. **Same `_wifi` env gate as Flow #2** — once
  the dash-hosted artifact is shipped, mobile OTA also rides that build.

---

## Blockers ordered by priority

1. **[BLOQUANT]** `crowpanel_28_wifi` env exceeds OTA app partition
   (107.7% per #1115). No flashable dash-hosted build until this is
   resolved. Options: flash trim (NimBLE / mbedTLS / SPI/lvgl), or
   repartition (forfeit SPIFFS, migration story for fielded devices).
2. **[BLOQUANT]** Phase 4 SPA hosting (#1077 phase 4) not on `main`.
   In flight on `feat/firmware/serve-spa-1077-phase-4`: SPA artifact
   prep + `embed_files` wired; HTTP route handlers in `wifi_ap.cpp` are
   the missing next step. PR needs to be opened.
3. **[BLOQUANT]** No on-device trigger to start the WiFi AP. Today only
   the mobile BLE `start_wifi_ap` command brings it up; 5-minute
   timeout. The "browser-only, no phone" user flow cannot start.
4. **[BLOQUANT]** Production env `crowpanel_28` excludes the WS / AP
   code via `APP_WIFI_OTA_ENABLED=0`. Once blocker #1 is resolved, the
   release pipeline must source the artifact from the `_wifi` env (or
   promote `_wifi` to default).
5. **[BLOQUANT]** Flasher hosting + firmware artifact upload pipeline.
   `canshift.tmbk.ch` deploy not verified, no automation to publish
   `latest.bin` to `/firmware/latest.bin`.
6. **[HAUTE]** `crowpanel_28_wifi` env not gated in CI → regressions
   shipped to `wifi_ws.cpp` / `wifi_ap.cpp` won't trip a build until a
   maintainer runs the env locally. Add as warn-only first per #1109.
7. **[HAUTE]** Studio-web build artifact has no consumer in the
   firmware build. Once #2 is in scope, wire the firmware CI step to
   `cd canshift-studio-web && npm run build` before `pio run`.
8. **[MOYENNE]** Studio-web stubbed surfaces (configService, releasesIpc,
   deviceConfigIpc, inputBindingsIpc). Editor mounts and edits, so this
   is "feature parity" debt, not bring-up debt. Sequenced per #1077
   phase 4 follow-ups.
9. **[MOYENNE]** AP 5-min timeout too short for editing — needs a
   "stay up while a Studio client is connected" extension.
10. **[BASSE]** Docs sweep #1113 — gated on phase 4; ready to action
    once the code lands.
11. **[BASSE]** Browser detector + tablet UX on canshift-flasher (Safari
    redirect copy).

---

## Roadmap recommandée

Ordered for fastest path to "user can flash a virgin ESP32 and reach
dash-hosted Studio from a browser without a phone".

1. **Decide partition / trim strategy** for `crowpanel_28_wifi` flash
   budget. (One day of triage.)
2. **Trim the `_wifi` image** to fit the 1.5 MB OTA slot (or
   repartition + migration plan). Verified by green
   `pio run -e crowpanel_28_wifi`.
3. **Add on-device AP trigger** (Settings page button + indefinite-or-
   user-set duration). Acceptance: laptop can join AP without a phone
   in the loop.
4. **Ship phase 4 SPA hosting** in firmware: register `/` + `/assets/*`
   on port 80, embed `canshift-studio-web/dist/` via SPIFFS (gzip with
   `Content-Encoding: gzip`). Acceptance: `curl http://canshift.local/`
   returns the SPA `index.html` byte-for-byte.
5. **Promote `_wifi` env to default release artifact** (or rename, gate
   `crowpanel_28` behind a board variant). Update `release.yml` and the
   firmware-artifact uploader to publish from `_wifi`.
6. **Wire flasher artifact pipeline.** GitHub Action on
   `tburkhalterr/CANShift` release → upload `firmware.bin` to
   `canshift.tmbk.ch/firmware/latest.bin` (and any
   ETag / cache rules).
7. **Verify `canshift.tmbk.ch` deploy** end-to-end. Merge
   `feat/branding-align-with-studio` PR (#1 on flasher repo).
8. **Add `crowpanel_28_wifi` to CI** as warn-only first, then gating
   after the trim from step 2 settles.
9. **Action #1113** — README sweep, now that phase 4 has shipped.
10. **Tackle studio-web feature-parity stubs** (configService,
    releasesIpc, deviceConfigIpc, inputBindingsIpc) in dedicated
    follow-up PRs.
11. **End-to-end manual validation** — flash a freshly-erased ESP32 via
    `canshift.tmbk.ch`, connect to AP, edit a widget, push config,
    observe telemetry. Sign off the audit.
12. **Decommission `canshift-studio` (Electron)** — only after step 11
    is green and Studio-web stubs are filled in.

---

## Open issues to track this audit

**Existing.**
- `#1077` — Studio dash-hosted umbrella (phase 4 SPA hosting still owed).
- `#1081` — bootstrap web flasher umbrella.
- `#1108` — WS endpoint (merged).
- `#1109` — CI follow-ups (`_wifi` env gating, `release.yml` cleanup).
- `#1113` — README sweep (gated on phase 4).
- `#1114` — phase 3 transport (merged).
- `#1115` — DRAM relocation to PSRAM (PR open, unblocks `_wifi` DRAM only).

**Recommended new issues.**
- `chore(firmware): trim crowpanel_28_wifi image to fit OTA slot
  (#1077 phase 4 prerequisite)` — addresses blocker #1.
- `feat(firmware): on-device WiFi AP trigger from Settings page
  (#1077 phase 4)` — addresses blocker #3.
- `feat(firmware): keep WiFi AP up while a Studio client is connected
  (#1077 phase 4)` — addresses blocker #9.
- `feat(firmware): phase 4 — serve canshift-studio-web SPA from
  /index.html on port 80 (#1077)` — addresses blocker #2.
- `chore(release): wire firmware-artifact upload to canshift.tmbk.ch
  (#1081 follow-up)` — addresses blocker #5.
- `chore(ci): add crowpanel_28_wifi env as warn-only (#1109)` —
  addresses blocker #6.
