# Handoff: CANShift — brand, Tuner web app, dash UI, mobile app

## Overview

Full restyle of CANShift: the logo, the Tuner web app (canshift.tmbk.ch), the dash UI that runs on the device panel, and the mobile companion app. This bundle documents the visual system and every view, so it can be rebuilt in the real codebase (`github.com/tburkhalterr/CANShift`).

## About the design files

The `.dc.html` files in this bundle are **design references written in HTML** — prototypes showing the intended look and behaviour. They are **not production code to copy**. The task is to recreate them inside the existing CANShift codebase (React + TypeScript for the Tuner, React Native for mobile, LVGL/C++ for the firmware dash), using its established patterns.

## Fidelity

**High fidelity.** Colours, type, spacing, rules and states are final. Layout measurements are exact at the stated design widths.

---

## 1. Design tokens

### Brand (Tuner chrome, documents, marketing)

| Role                | Hex       |
| ------------------- | --------- |
| Accent              | `#EC3013` |
| Ink                 | `#201E1D` |
| Ground              | `#F3F2F2` |
| Surface             | `#EAE9E9` |
| Rule                | `#D7D3D3` |
| Dark chrome bg      | `#151313` |
| Dark chrome surface | `#1F1D1D` |

Dark theme of the Tuner overrides the neutral ramp: `100 #1C1A1A`, `200 #262323`, `300 #383434`, `400 #4D4949`, `500 #7D7979`, `600 #9B9797`, `700 #C2BFBF`, `800 #E2DFDF`, `900 #F5F4F4`; text `#F3F2F2`; divider `color-mix(in srgb, #F3F2F2 24%, transparent)`.

### Device (dash panel + mobile app)

Existing repo tokens, kept as-is: bg `#121212`, bgInset `#080808`, surface `#1F1F1F`, surface2 `#292929`, border `#333333`, primary `#FF4747`, accent `#FF8800`, destructive `#FF0000`, text `#FFFFFF`, dim `#BABABA`, muted `#8F8F8F`, success `#00CC2A`, selection `#6CB6FF`. Widget zones: ok `#00CC44`, warning `#FF8800`, danger `#FF4444`, arc track `#222222`. Day theme: bg `#DDDDDD`, surface `#F0F0F0`, primary/danger `#CC0000`, accent `#E06000`, text `#000000`.

**The two reds are not interchangeable.** `#EC3013` is the brand red (screens read through glass, print). `#FF4747` is the device red (read through a plastic lens in daylight).

### Type

- Headings and UI labels: **Archivo 800**. Body: **Archivo 400**.
- All values produced by the car are **monospace, tabular figures** (`font-variant-numeric: tabular-nums`).
- Label style: 9–11 px, weight 800, letter-spacing `0.18em`–`0.22em`, uppercase, above the value — never beside it.
- Units: about a quarter of the value size, in `dim`.
- Minimum on the panel: value 30 px at 2× (15 px real), label 10 px.

### Geometry

- **Radius 0 everywhere.** No rounded corners in the Tuner chrome or the dash.
- Rules: 2 px for structure (`--color-divider`), 1 px for rows inside a block.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32.
- Active nav / tab indicator: 3 px accent bar, `inset` (left for vertical nav, bottom for tabs).
- Focus: `outline: 2px solid var(--color-accent); outline-offset: 2px`.

---

## 2. Logo

Direction **2a "Bracket"**, drawn geometrically — not set type.

- Monogram: two paths on a 116 × 100 box, group transform `translate(10,0) skewX(-11)`.
  - C: `M46 26 H22 V74 H46`, stroke 13, butt caps, ink.
  - S: `M96 26 H66 V50 H96 V74 H66`, stroke 13, butt caps, accent.
- Wordmark: Archivo 800, `skewX(-11deg)`, letter-spacing `-0.045em`; `CAN` in ink, `SHIFT` in accent.
- Optional bus rule under the wordmark: 5 px tall bars, 3 px gaps, flex weights `3 1 2 1 4 1 2`, red on the 3rd and 6th.
- Baseline lockup: `DASH CANBUS FIRMWARE`, Archivo 600, 9 px, letter-spacing `0.34em`.
- App icon: monogram on ink `#201E1D`, C in `#F3F2F2`, S in accent. Alternate: accent field, C white, S white at 55 % opacity.
- Below 96 px wide, monogram only. Clear space on all sides = the C's stroke width.
- Never: gradient, bevel, shadow, outline version, rounded terminals, second red, another typeface, unsheared wordmark.

---

## 3. Tuner — web app (design width 1440 × 940)

### Shell

- Header 56 px: brand lockup (32 px monogram + wordmark + `TUNER`), project name, unsaved-changes pill, `SIMULATION` state pill, theme toggle, `SAVE`, `BURN TO DEVICE` (accent fill). Bottom border 2 px.
- Sidebar 236 px, background `--color-neutral-100`, right border 2 px. Group labels (9 px / 800 / `0.22em`), items 13 px, active item gets the 3 px accent bar + `--color-neutral-200` background + weight 800. Footer block: target panel, flash %, 4 px progress bar.
- Main area fills the rest. Each view opens with a 48 px toolbar with a 2 px bottom rule.
- Inspector 320 px on the right of the editor, left border 2 px, three tabs: `PROPERTIES` / `WIDGETS` / `LIBRARY`.

### Views (12)

| Group       | View            | Contents                                                                                                                                                                  |
| ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard   | Pages & widgets | Toolbar (Design/Simulate, zoom, grid, out-of-bounds flag, Rev limit), 100 px page strip of 6 thumbnails, canvas with the 320 × 240 device preview at 2×, inspector        |
| Dashboard   | Themes          | Theme cards (Night, Day, Endurance, Rally, Drag, Circuit, Ice, Paper) with live preview + ramp; token list and auto day/night switching on the right                      |
| Vehicle     | CAN bus         | Start/Reset, sort segmented control, frame counters, table: ID / DLC / DATA / RATE / COUNT / MAPPED TO                                                                    |
| Vehicle     | ECU profile     | Profile list (MaxxECU, Link G4X, Haltech, MoTeC, Emtron, Speeduino, custom), signal table: SIGNAL / CAN ID / BYTES / SCALE / UNIT / BOUND TO                              |
| Vehicle     | OBD-II          | Mode 01 PID grid (4 columns), DTC panel with clear action                                                                                                                 |
| Diagnostics | Live data       | 4 × 3 grid of signal cells: label, 46 px mono value, unit, 4 px bar                                                                                                       |
| Diagnostics | Logs            | Session list, four session stats, lap table with delta                                                                                                                    |
| Diagnostics | CLI             | Terminal on `#0B0A0A`, accent prompt, command reference panel                                                                                                             |
| Device      | Firmware        | Port bar, three key figures, build chooser (stable / rollback / nightly / local file), "what gets written" + pre-flight columns, actions, changelog + flash history panel |
| Device      | Boot & update   | Four 320 × 240 screens at 528 × 396: boot mark, boot self-test, update progress, complete / failed                                                                        |
| Device      | States & alerts | Six animated takeover screens at 400 × 300 + motion spec panel                                                                                                            |
| Device      | About           | Lockup, version table, credits                                                                                                                                            |

### Components

- **Primary button**: accent fill, white, Archivo 800, 12–13 px, letter-spacing `0.09em`, label flush left, hover `--color-accent-600`.
- **Secondary**: 1 px `--color-neutral-400` border, transparent, hover border accent.
- **Destructive/ghost accent**: 1 px accent border, accent text, hover `color-mix(in srgb, accent 14%, transparent)`.
- **Segmented control**: 1 px border, active segment = ink fill with ground text.
- **Field**: 1 px `--color-neutral-400`, 7–9 px padding, mono 12 px. Warning field: accent border + accent text.
- **Checkbox**: 15 × 15, 2 px border; checked = accent border + accent fill. No radius.
- **Table**: header row 800 / 10 px / `0.18em` / neutral-600, 2 px bottom rule; body rows 1 px rule, mono 13 px; IDs in accent.
- **Flag**: 7 × 7 square + 11 px mono text; accent when there is a problem, neutral-600 + neutral-500 square when fine.

---

## 4. Dash (device, 320 × 240)

### Widget grammar

Widgets sit on a **12-column grid, 12 px gutter**, inside a 16 px padded frame. A widget declares a column span, never a pixel width.

| Kind            | Rendering                                                                                |
| --------------- | ---------------------------------------------------------------------------------------- |
| Primary value   | 2 px ink top rule, label 10 px dim, value 64–104 px mono, tabular, `-0.045em`            |
| Secondary value | 1 px track top rule, value 30–48 px, optional 3 px bar under it                          |
| Danger          | 2 px red top rule, label and value in `#FF4444`                                          |
| Button (off)    | 2 px white border, min-height 96 px at 2× (48 px real), label 10 px dim + state 26–30 px |
| Button (on)     | 2 px `#FF4747` border + `#FF4747` fill, white text                                       |
| Shift light     | Full-width strip, 12 segments, 3 px gaps: white → red → unlit track                      |
| Arc gauge       | 270° sweep, rotation 135°, stroke 0.3 × r (min 5 px), track `#222222`                    |

Touch targets never below 48 × 50 px real. Anything outside 320 × 240 is flagged in the Tuner, never auto-scaled.

### The six default pages

1. **Street** — speed, gear, rpm, water, fuel, batt, odo, page button
2. **Track** — shift light, rpm, gear, speed, oil press (danger), water, oil temp, boost, batt
3. **Engine** — water, oil temp, oil press, fuel press, gearbox, diff, batt
4. **Tuning** — boost + target, lambda, throttle, IAT, EGT, knock
5. **Timing** — lap, delta, best, last, laps, timer / reset buttons
6. **Controls** — launch rpm, clutch, launch, anti-lag, ECU map, pit limit, cruise

### System screens

- **Boot** — monogram + wordmark, then self-test list (display, CAN, ECU link, pages) with a progress bar and `fw x.y.z`.
- **Update** — `UPDATING FIRMWARE`, percentage at ~56 px real, `0.1.0 → 0.1.1`, progress bar, byte counter, `DO NOT UNPLUG` in `#FF8800`.
- **Update complete / failed** — green `UPDATE COMPLETE` + restart countdown, or red `UPDATE FAILED` + error address + "kept 0.1.0".
- **Rev limit** — shift strip and the rpm value flash together, hard on/off at 6 Hz.
- **Anti-lag armed** — `#FF8800` band pulsing at 1 s, rpm + EGT below.
- **Launch armed** — pulsing title, held rpm, bar sweeping to target.
- **Critical (oil pressure)** — whole screen `#FF4444`, pulsing 0.9 s, value fixed, `STOP THE ENGINE`.
- **Overheat** — `#FF8800` header band, water value in warning.
- **No CAN** — `CAN BUS OFF`, values replaced by `- -` in muted after 500 ms.

### Motion

- Rev limit / shift: hard on-off, 6 Hz, no easing.
- Armed states: 1 s ease-in-out pulse, opacity 1 → 0.35.
- Critical alarm: whole screen pulses; the value never moves.
- Values snap — never tween a number the ECU sent.
- Bars and arcs: 120 ms linear catch-up.
- Stale data: grey + `- -` after 500 ms without a frame.
- Page change: instant cut, no slide.

---

## 5. Mobile app (390 × 844, iOS + Android, same layout)

Four root tabs: **Dash / Graph / Console / Device**, 84 px tab bar, 2 px top rule, active tab in `#FF4747`.

| #   | Screen         | Contents                                                                                                                         |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Connect        | Centred mark + wordmark + baseline, `SCAN FOR DEVICES` (64 px accent bar), `DEMO — SIMULATION`                                   |
| 02  | Devices        | Scanning state, device rows (name, RSSI, fw, last paired), connect + rescan                                                      |
| 03  | Dashboard      | Header with device name and bus rate, `SIM` pill, shift strip, 12-column widget grid mirroring the panel, page selector, tab bar |
| 04  | Pages          | The six dash pages as rows, current one marked `on screen`, `SHOW PAGE … ON THE DASH`                                            |
| 05  | Graph          | Three rolling 30 s traces (rpm, boost, lambda) with current values, pick signals / export                                        |
| 06  | Console        | CAN / LOG / SEND tabs, frame list with accent IDs, pause + filter                                                                |
| 07  | Critical alert | Full `#FF4444` takeover, pulsing, value + context + `ACKNOWLEDGE` / `MUTE FOR THIS SESSION`                                      |
| 08  | Device         | Device facts, dash theme picker, settings rows, `DISCONNECT`                                                                     |
| 09  | OTA update     | Percentage, progress, notes, changelog, cancel                                                                                   |

Rules: header carries the device name and live bus state, never a logo. Primary action is a 64 px accent bar with a flush-left label at the bottom of the content. Minimum interactive height 56 px.

---

## 6. Files in this bundle

| File                          | What it is                                                      |
| ----------------------------- | --------------------------------------------------------------- |
| `CANShift Brand Book.dc.html` | The brand book: logo, colour, type, and the three surfaces      |
| `CANShift Logo.dc.html`       | Logo explorations; direction **2a — Bracket** is the chosen one |
| `CANShift Tuner.dc.html`      | The web app, all 12 views, light and dark                       |
| `CANShift Mobile.dc.html`     | The mobile app, 9 screens                                       |
| `CLAUDE_CODE_PROMPT.md`       | Paste-ready prompt to have Claude Code open the GitHub issues   |

Open any of them directly in a browser. They need the `_ds/` folder next to them (included).

## Assets

No bitmaps. The logo is drawn in SVG paths (given above). Icons: [Lucide](https://lucide.dev). Type: Archivo (Google Fonts).
