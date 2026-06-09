# Firmware production build size audit — 2026-06-01

Cross-package audit of what fills the production firmware image (`[env:crowpanel_28]`) and what can be reclaimed at the **firmware**, **canshift-core**, and **canshift-studio-web** layers. Mobile is excluded — it never ends up on the dash.

## Baseline (this audit)

Built from `main` @ `dd6aa58` with the current production env.

| Artifact | Bytes | % of slot |
|---|---:|---:|
| `firmware.bin` (app0 slot = 1728 KB) | 1 715 296 | **96.9 %** |
| `spiffs.bin` (spiffs slot = 512 KB) | 524 288 | n/a (full image) |
| `data/` actual content | ~376 KB | 73 % of 512 KB |
| **App margin** | **54 176 B** | **3.1 %** |

ELF section breakdown (`xtensa-esp32-elf-size -A`):

| Section | Bytes | What it holds |
|---|---:|---|
| `.flash.text` | 1 217 527 | code |
| `.flash.rodata` | 346 616 | constants + strings + embedded blobs |
| `.iram0.text` | 116 907 | ISR + perf-critical code |
| `.dram0.bss` | 75 000 | zero-init RAM (incl. static buffers) |
| `.dram0.data` | 27 452 | init'd RAM |
| `.flash.rodata_noload` | 15 082 | linker housekeeping |

Top symbols by size (top 10 of `nm --size-sort -r`):

| Bytes | Symbol | Source |
|---:|---|---|
| 42 862 | `glyph_bitmap` | `lv_font_orbitron_black_48_nk.c` |
| 25 228 | `s_dashboard` (BSS) | `boot/default_config.cpp` (parsed-config snapshot) |
| 19 896 | `glyph_bitmap` | `lv_font_orbitron_black_32_nk.c` |
| 12 546 | `loadDashboard()` | `boot/default_config.cpp` |
| 9 226 | `__ssvfscanf_r` | newlib float scanf |
| 8 759 | `ArduinoJson::JsonDeserializer<Reader<fs::File>>::parseVariant` | `config_loader.cpp` |
| 8 314 | `_vfiprintf_r` | newlib integer printf (already optimised — see F-DONE) |
| 8 316 | `ArduinoJson::JsonDeserializer<BoundedReader<const char*>>::parseVariant` | `config_loader.cpp` (embedded JSON path) |
| 8 098 | `handleCommand` | `usb_comm.cpp` |
| 7 910 | `_svfiprintf_r` | newlib |
| 7 590 | `ArduinoJson::JsonDeserializer<BoundedReader<const char*>>::parseVariant (filtered)` | `config_loader.cpp` |
| 6 836 | `loadSignals` | `boot/default_config.cpp` |

Total embedded font glyph bitmaps in flash: **~66.7 KB** across Black 48 / Black 32 / Medium 14. The Medium-14 fallback (`lv_font_orbitron_medium_14_nk`) adds another ~3.9 KB of glyph_bitmap.

---

## Reclaimable budget — by package

### canshift-firmware

#### F-1 — Move Orbitron Black 48 out of flash (**~43 KB reclaim**)

`src/ui/font_manager.cpp` ships Black 48 as a compiled C array because the comment says the 80 KB LVGL pool "cannot host the 43 KB 48 px Black on top of the draw buffers". The rationale dates from before `LVGL_BUF_LINE_COUNT=20` and the WROVER PSRAM detection landed. Re-measure: with current draw buffer (~25 KB DMA) the pool has ~55 KB free; Black 48 fits, with the trade-off that pool churn on theme reloads increases.

Mitigation if pool too tight: use SPIFFS-loaded `.bin` form (the file is already shipped — `orbitron_black_48.bin` would join the existing four `data/fonts/orbitron_*.bin`). One-time pool alloc at boot, no churn.

**Action:** A/B measure pool usage with Black 48 loaded from SPIFFS vs C array. If passes, drop `lv_font_orbitron_black_48_nk.c` from the build.

#### F-2 — Consolidate ArduinoJson template instantiations (**~15–20 KB**)

Four distinct `JsonDeserializer<…>` instantiations are emitted, each ~7–9 KB:

| Reader type | Filter | Site | Bytes |
|---|---|---|---:|
| `Reader<fs::File>` | `AllowAllFilter` | SPIFFS config load | 8 759 |
| `BoundedReader<const char*>` | `AllowAllFilter` | embedded default config | 8 316 |
| `BoundedReader<const char*>` | `Filter` (subtree) | embedded default config (filtered) | 7 590 |
| `BoundedReader<const char*>` | `Filter` (parseObject) | embedded default config (object-only) | 5 307 |

Standardising on a single read strategy (read whole file into a `String`/buffer, deserialise via `BoundedReader<const char*>`) collapses (1) into (2)/(3). Filtered + unfiltered probably can't dedupe without giving up the SPIFFS filter, but the file-vs-buffer split should.

**Action:** rewrite `ConfigLoader::loadFromSpiffs` to slurp the file into a heap buffer first, then call the existing buffer-path deserialiser. Saves ~9 KB.

#### F-3 — Add no_float_scanf override (**~12 KB**)

`no_float_printf.cpp` correctly drops `_dtoa_r`/float `printf`. The scanf side was missed: `__ssvfscanf_r` (9 226 B) + `_strtod_l` (3 312 B) are still linked. The same strong-symbol trick (delegate `__ssvfscanf_r` → `__ssvfiscanf_r`) works.

The firmware **does not** scanf floats anywhere — `grep -rn "%[0-9.]*[fge]" canshift-firmware/src` against scanf turns up nothing. Pure newlib dead weight.

**Action:** add `src/util/no_float_scanf.cpp` mirroring `no_float_printf.cpp`.

#### F-4 — Re-evaluate `s_dashboard` 25 KB BSS

`s_dashboard` is a parsed snapshot kept resident for hot-reload. 25 KB is significant against the 73 KB total `.dram0.bss`. If the parser can re-run from the JSON source on config swap (which is rare and not latency-critical), the buffer can drop to ~4 KB scratch.

This is **RAM not flash** — doesn't change the 96.9 % number, but improves heap headroom that the SPA + WiFi + NimBLE all compete for.

**Action:** profile whether `loadAll()` rerun cost is acceptable on USB `PUT_CONFIG` (which already takes hundreds of ms). If yes, free `s_dashboard` after `applySnapshot()` and re-parse on next swap.

#### F-5 — Drop mDNS if dash IP is known to clients (**~7 KB**)

`mdns_parse_packet` (5 743 B) + `_mdns_service_task` (2 540 B) + `MDNS.begin`/`addService`/`addServiceTxt` wiring. Used to advertise `canshift.local` for Studio discovery.

The flasher + Studio already know the dash IP via the AP itself (192.168.4.1 when joined). The only consumer of mDNS is a user who wants `canshift.local` instead of the IP. If that's a soft requirement, gate behind `APP_MDNS_ENABLED=0` and document the IP in the AP join screen.

**Action:** propose `APP_MDNS_ENABLED` build flag. Default ON (no behaviour change). Production builds set it OFF after one release of soak testing.

#### F-6 — Audit unused sensor icons (**~30–60 KB SPIFFS**)

`src/ui/icon_assets.cpp` defines 24 sensor icons (4 KB each = 96 KB). Only icons referenced by a widget's `style.icon` field are actually loaded at runtime; the rest sit on SPIFFS unused.

Current bundled `dashboard.json` uses a handful (rpm, speed, coolant, oil_pressure, oil_temp, fuel). The remaining ~18 icons are either user-config-time choices (legit to ship) or unused.

**Action:** poll user-set widget icons across the field once Studio analytics exist (#TBD). Until then, ship all 24 — but mark this as a SPIFFS slack reservoir for if **F-S-1** Studio bundle size grows.

#### F-7 — WebSockets vs raw TCP — pick one (**~8–12 KB**)

`wifi_tcp.cpp` (JSON-lines on port 5050) and `wifi_ws.cpp` (WebSockets on port 81) carry identical payloads per the source comments. The history is #1071 introduced TCP, #1105 added WS for Studio compatibility.

If browser-based Studio is the canonical client and WebSockets are non-negotiable (browsers can't open raw TCP), drop the TCP server. Likely save: WebServer's `_parseForm` + `_parseRequest` (~8 KB) stays because the SPA HTTP server needs it, but `wifi_tcp.cpp` plus tcp-specific log paths come out.

**Action:** confirm with phase-3 plan whether TCP-on-5050 is still a planned client surface. If no, gate `wifi_tcp.cpp` behind a build flag, default OFF.

#### F-8 — Already in place (don't regress)

- `-DCORE_DEBUG_LEVEL=1` strips framework `log_i/log_w` format strings (`platformio.ini`).
- `no_float_printf.cpp` drops float printf — confirmed by absence of `_dtoa_r` in the symbol dump.
- `-DCONFIG_BT_NIMBLE_ROLE_*=0` trims NimBLE central/observer/broadcaster/mesh.
- `-DWEBSOCKETS_SERVER_CLIENT_MAX=2` trims WS client array.
- Five SPIFFS-resident Orbitron fonts are loaded from SPIFFS, not in-flash (only Black 32 + Black 48 + Medium 14 fallback are in flash).
- `-O2` chosen explicitly over `-Os` because `-Os` breaks the link with arduino-esp32 5.4.0 (`fs::FileImpl` vtable elimination). Documented.

### canshift-core

#### C-1 — Delete stale `sensorDefaults.*` dist artifacts

`dist/sensorDefaults.{js,d.ts,...}` are leftover from the kebab-case rename to `sensor-defaults.ts`. Source no longer has the camelCase file. The build output keeps both because TypeScript incremental builds don't prune renamed-away outputs.

```
canshift-core/dist/sensorDefaults.js          # stale
canshift-core/dist/sensorDefaults.d.ts        # stale
canshift-core/dist/sensorDefaults.js.map      # stale
canshift-core/dist/sensorDefaults.d.ts.map    # stale
canshift-core/dist/sensor-defaults.*          # actual
```

No source references the camelCase name (`grep -r "sensorDefaults" canshift-{studio-web,mobile}/src` → 0 matches). Vite tree-shakes them out of the SPA, so no impact on firmware-side SPIFFS image — but the npm/file: dep ships them. Pure hygiene.

**Action:** rm + add `prepublishOnly: rimraf dist && tsc` so renames don't leave fossils.

#### C-2 — ECU profiles size is justified

20 KB source / 56 KB dist for `ecu-profiles/`. Mostly the OBD2 mode 01 PID catalogue. Not on the firmware. Not lazy-loaded in Studio either, but **Studio is on SPIFFS** so any unused-by-default core surface that gets pulled into Studio's bundle does cost firmware bytes.

`grep -rn "ecu-profiles\|EcuProfiles" canshift-studio-web/src` → 0 matches at present. So tree-shaken out of the studio bundle. Confirmed safe; no action needed unless Studio starts importing it.

### canshift-studio-web

Current SPIFFS-resident SPA bundle (`canshift-firmware/data/web/`):

| File | Bytes |
|---|---:|
| `vendor-react.js.gz` | 56 819 |
| `EditorRoute.js.gz` | 37 829 |
| `index.js.gz` | 27 395 |
| `vendor-radix.js.gz` | 9 615 |
| `index.css.gz` | 4 218 |
| `vendor-state.js.gz` | 3 517 |
| `index.html.gz` | 287 |
| `Orbitron-Bold.woff2` | 9 224 |
| `Orbitron-Black.woff2` | 9 000 |
| `Orbitron-Medium.woff2` | 9 292 |
| **Total** | **167 196** |

#### S-1 — Lazy-split editor sub-tree (**~10–15 KB gz reclaim from initial paint**)

`EditorRoute` is already lazy. Inside it, `Canvas` / `PropertyPanel` / `WidgetPalette` load eagerly. The audit doc #1207 flagged this. Wrapping them in `React.lazy()` doesn't reduce **total** SPIFFS size, but it reduces the index.js bundle the browser has to receive before the dashboard shows — which on the dash's HTTP server matters because each route fetch is round-tripped over WiFi.

**Action:** split `Canvas` and `PropertyPanel` into lazy chunks behind a route-level boundary. Buys split bundle, not raw byte savings.

#### S-2 — Font subsetting (**confirm or trim**)

Three `.woff2` files at 9 000 / 9 224 / 9 292 bytes. If already subset to `[0-9A-Z]` plus a few glyphs, ~9 KB is the floor. Worth confirming via `fonttools` — if a maintainer regen'd them without `--unicodes`, they're 50–100 KB each and the gzip is hiding it.

**Action:** run `pyftsubset Orbitron-Black.ttf --unicodes='U+0020-007F,U+00B0,U+2022'` (same range as the LVGL bitmaps per `--no-prefilter -r 0x20-0x7F,0xB0,0x2022` flag in the `.c` font header). Re-measure.

#### S-3 — Fix Orbitron filename length (**bug fix, 0 KB reclaim**)

Issue **#1240**: `Orbitron-Black.woff2` (32 chars) > SPIFFS path limit (31 chars), `Orbitron-Medium.woff2` (33 chars) ditto. Files silently drop from `spiffs.bin` and the SPA loads without webfonts.

**Action:** rename Vite output to `b.woff2` / `m.woff2` / `bk.woff2` (or under `/a/` instead of `/assets/`), update `wifi_ap.cpp` route table, update `sync_studio_web.py`. Tracked separately in #1240.

---

## Suggested PR sequencing

Order by impact / risk:

1. **F-3 — no_float_scanf** — single new file, no behaviour change, ~12 KB save. Easiest test.
2. **F-1 — Black 48 out of flash** — needs hardware A/B (pool free-bytes log diff). Highest single reclaim (~43 KB).
3. **F-2 — ArduinoJson dedup (file → buffer path)** — `ConfigLoader::loadFromSpiffs` rewrite. ~9 KB. Modest test surface.
4. **F-5 — mDNS flag** — one flag + AP-IP doc update. ~7 KB. Behaviour change visible to one user-facing surface, so gate behind a flag.
5. **C-1** — stale dist files (hygiene, 0 firmware impact, low risk).
6. **F-4 — `s_dashboard` heap-alloc** — RAM not flash; do once F-1/F-2 land.
7. **F-7 — TCP-on-5050 decision** — depends on phase-3 transport plan.
8. **S-3** — covered by #1240.
9. **S-1** — covered by #1207.

## Expected envelope post-Phase-1 (F-1 + F-2 + F-3)

| Metric | Now | After |
|---|---:|---:|
| `firmware.bin` | 1 715 296 B | ~1 651 000 B |
| App slot usage | 96.9 % | ~93 % |
| App margin | 54 KB | ~118 KB |

Enough headroom to flip one or two `USE_RUST_*` flags (#1191) without re-partitioning (#1192), or to absorb the remaining widget parity work (#1183) without budget pressure.
