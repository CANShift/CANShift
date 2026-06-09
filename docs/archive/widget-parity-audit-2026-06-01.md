# Widget parity audit — 2026-06-01

Phase 1 of issue #1183 (firmware widget rendering must match Studio preview).
This document is an **audit only** — no firmware or studio code is changed.

Studio is the design authority. For each of the 8 widget types and 3 shared
surfaces this audit compares the Studio preview renderer
(`canshift-studio-web/src/components/editor/widget-previews/*.tsx` +
`canshift-core/src/design-tokens.ts`) against the firmware implementation
(`canshift-firmware/src/ui/widgets/*.cpp` + the surrounding `ui/*` bridge
files) and lists every concrete divergence with a file:line reference.

Severity legend:

- **high** — visible to the user, breaks the WYSIWYG promise.
- **med** — subtle, only obvious side-by-side.
- **low** — cosmetic, sub-pixel or edge-case only.

> Studio coverage caveat (load-bearing for this audit): the dispatcher
> `canshift-studio-web/src/components/editor/WidgetPreview.tsx:115-124` maps
> `bar`, `warning`, `timer`, `image` to `() => null`. Those four widget types
> have **no Studio preview at all** — the device renders something, the
> canvas renders an empty box. That is treated as the highest-severity drift
> for those four widgets.

---

## 1. Gauge widget

Two display sub-styles share the gauge schema: `arc` and `numeric` (the
legacy `bar` sub-style was dropped from Studio per
`WidgetPreview.tsx:95-98`).

### 1.1 Gauge — arc sub-style

Studio: `canshift-studio-web/src/components/editor/widget-previews/GaugeArc.tsx`
+ `widget-previews/gauge-math.ts`.
Firmware: `canshift-firmware/src/ui/widgets/gauge_widget.cpp`.

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| Arc sweep angle | `SWEEP_DEG = 270` (`gauge-math.ts:138`) | `kArcSweep = 280.0f` with `lv_arc_set_rotation(arc, 140)` (`gauge_widget.cpp:38, 105, 132`) | high | 10° wider trace on device — the value position at any given pct lands at a different angle |
| Arc start angle | `START_DEG = 135` SVG (lower-left, `gauge-math.ts:137`) | `lv_arc_set_rotation(arc, 140)` (`gauge_widget.cpp:105, 131`) | high | 5° offset of the entire arc origin |
| Background track colour (no threshold) | hardcoded `#252525` (`GaugeArc.tsx:101`) | hardcoded `kColorBgDim = 0x222222` (`gauge_widget.cpp:30, 250`) | low | 3 levels apart — invisible at most viewing distances but a real value drift |
| Background track colour (gradient / palette mode) | same `#252525` (`GaugeArc.tsx:101`) | hardcoded `kColorGradientBg = 0x2A2A2A` (`gauge_widget.cpp:34, 247`) | med | Studio uses one bg track colour across all modes, firmware uses two (dim/bright) |
| Value-arc stroke width | `strokeW = Math.max(5, r * 0.24)` (`GaugeArc.tsx:69`) | `kBgWidth = 14` (gradient/palette) or `kIndWidth = 7` (zones) (`gauge_widget.cpp:41-42, 265`) | high | Studio scales stroke with arc radius; firmware uses a fixed 14 / 7 — at h=80 they roughly agree, at h≥110 firmware looks thin |
| Arc stroke caps | `strokeLinecap="butt"` everywhere (`GaugeArc.tsx:103, 113`) | `lv_obj_set_style_arc_rounded(arc, false, …)` (`gauge_widget.cpp:112, 117, 142`) | low | Aligned — listed only to confirm |
| Value text font weight | `fontWeight="900"` (Orbitron Black) (`GaugeArc.tsx:132`) | `resolveValueFont`: Black @ ≥110 px, Bold @ ≥80 px, Bold @ <80 (`gauge_widget.cpp:285-297`) | med | At h<110 studio shows Black, firmware shows Bold — visible weight drift on small arcs |
| Value text size | `Math.max(11, Math.min(r*0.55, h*0.3, 42))` (`GaugeArc.tsx:77`) | Tiered 20 / 24 / 32 by `cfg.layout.h` thresholds 80 / 110 (`gauge_widget.cpp:285-297`) | high | Different formulas → different absolute pixel sizes at almost every widget height |
| Value text colour (no palette, no ramp) | threshold-tinted: `st.primaryColor` below danger, `st.criticalColor` above (`GaugeArc.tsx:51-56`) | white `kColorValue 0xFFFFFF` below danger, `kZoneDangerRgb 0xFF4444` above (`gauge_widget.cpp:582-584, 611`) | high | Firmware ignores `widget.style.primaryColor` and `criticalColor` for the value text — every gauge reads white/red regardless of user-chosen style |
| Unit suffix colour | `st.textColor + '77'` (alpha) (`GaugeArc.tsx:155`) | `textRgb & 0x888888` (bitwise mask) (`gauge_widget.cpp:357`) | med | Studio alpha-blends the textColor; firmware masks it down. For pure white text both yield ~#888 but for any tinted text the firmware produces an unrelated colour |
| Unit suffix font size | `Math.max(7, r * 0.2)` (`GaugeArc.tsx:78`) | `FontManager::label(12)` fixed (`gauge_widget.cpp:358`) | med | Studio shrinks the unit with the arc, firmware always uses 12 px Medium |
| Unit suffix Y offset | `cy + r * 0.32` (`GaugeArc.tsx:152`) | `lv_obj_align(unitLabel, LV_ALIGN_CENTER, 0, 12)` fixed +12 px (`gauge_widget.cpp:356`) | med | Studio scales offset with radius, firmware uses a constant 12-px push |
| Value row vertical offset (when unit present) | not applied (value sits at true `cy`) (`GaugeArc.tsx:126-128`) | `lv_obj_align(valueRow, LV_ALIGN_CENTER, 0, -8)` when unit present (`gauge_widget.cpp:305`) | high | Firmware nudges the value up 8 px to make room for the unit; studio doesn't, so the value sits visibly lower on Studio |
| Rev-flash indicator ring | dashed gray ring at idle, solid red at active (`GaugeArc.tsx:85-96`) | no equivalent — rev-flash drives a full-cell overlay via `AlertFlash::attach` (`gauge_widget.cpp:511`) | high | Studio renders a ring + red-tint rect, firmware just blinks the AlertFlash overlay — completely different visual cue |
| Background sectors when `hasDanger` (no palette/gradient) | not rendered — studio dropped legacy zones (`GaugeArc.tsx:106-107` comment) | green sector `[0, dangerAngle]` + red sector `[dangerAngle, 280]` (`gauge_widget.cpp:252-255`) | high | Configs without palette/gradient and with a dangerLevel show two-colour zones on device, plain dark track in Studio |
| Bottom-left widget label | drawn inline by GaugeArcPreview, dim caps at `(4, h-4)` font `max(6, min(9, w*0.1))` (`GaugeArc.tsx:165-180`) | drawn by `WidgetLabelOverlay::apply` at user's labelPosition with fixed Orbitron Medium 12 (`gauge_widget.cpp:431`, `widget_label.cpp:18-19,52-61`) | high | Studio hard-pins arc label to bottom-left; firmware honours `cfg.gauge.labelPosition` — different positions and different font sizes |
| Fractional-digit scale | `FRAC_FONT_SCALE = 0.7` (`gauge-math.ts:113`, applied at `GaugeArc.tsx:141`) | `(intFontSize * 7) / 10` floored at 12 (`gauge_widget.cpp:339-341`) | med | Same nominal ratio, but firmware applies a min-clamp at 12 px while studio doesn't — divergence at small gauges |
| Decimal point in fractional run | included in `frac` via `splitDecimal` (`gauge-math.ts:102-106`) | included via `splitDecimal` strchr (`gauge_widget.cpp:154-168`) | — | Aligned — listed for cross-check |

### 1.2 Gauge — numeric sub-style

Studio: `widget-previews/GaugeNumeric.tsx`.
Firmware: also rendered via `gauge_widget.cpp` (single create path, no
display-style switch on device — the legacy fallback) — but the widget
factory in `widget_factory.cpp` routes `gauge` widgets through
`GaugeWidget::create` regardless of `displayStyle`, so this is **already a
high-severity discrepancy** by itself.

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| `displayStyle: 'numeric'` rendering path | `WidgetPreview.tsx:99` picks `GaugeNumericPreview` — no arc, headline-numeric layout matching `LabelWidget` | `widget_factory` always calls `GaugeWidget::create` for `type === 'gauge'`, which draws an arc | high | Studio's numeric gauge is a clean number-on-top layout; firmware renders the same config as an arc gauge — totally different widget visually |
| Signal auto-header position | absolute `top:1, left:4`, font 11 px Medium 500, `#888888` (`GaugeNumeric.tsx:94-115`) | n/a (arc renders, no header) | high | Follows the same path mismatch as the row above |
| Wide-integer split (4+ digits) | last 3 digits drop to `FRAC_FONT_SCALE` so "5200" reads "5.200" (`GaugeNumeric.tsx:160-186`) | not applied — gauge value uses the full font (`gauge_widget.cpp:626-628`) | high | RPM at 5200, mileage, fuel-pressure kPa all render differently |
| Value text colour | `st.textColor` unconditionally (`GaugeNumeric.tsx:36`) | white / `kZoneDangerRgb` / palette / ramp depending on mode (`gauge_widget.cpp:575-589`) | high | Studio promises a stable text colour, firmware tints it dynamically |
| Unit colour | hardcoded `#888888` (`GaugeNumeric.tsx:193`) | `textRgb & 0x888888` (`gauge_widget.cpp:357`) | low | Same colour in the default white-text case, drift for tinted text |
| Unit font size | `Math.max(8, Math.min(fontSize * 0.32, 14))` (`GaugeNumeric.tsx:194`) | `FontManager::label(12)` fixed (`gauge_widget.cpp:358`) | med | Studio scales with the value font, firmware uses constant 12 |
| Reserved top band for auto-header | `sigHeaderH = 14` px when no user label (`GaugeNumeric.tsx:46-47`) | n/a in arc path | high | Follows the path mismatch — would need to match `label_widget.cpp:104` (`sigHeaderH = 14`) once firmware grows the numeric path |

> Cross-reference: `LabelWidget` (firmware `label_widget.cpp`) is what
> would be the closest analog for a numeric gauge today — see § 6 below.

---

## 2. Bar widget

Studio: **no renderer** — `WidgetPreview.tsx:116` returns `null`.
Firmware: `canshift-firmware/src/ui/widgets/bar_widget.cpp` (full
implementation, 543 lines).

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| Whole widget | not rendered (`WidgetPreview.tsx:116`) | full horizontal + vertical bar with track, danger zone, fill, signal+value+suffix+user labels (`bar_widget.cpp`) | high | Every shipped bar widget is invisible in Studio — author cannot preview at all |
| Track height ratio (horizontal) | unspecified — no renderer | `TRACK_H_RATIO = 0.35f` of widget height (`bar_widget.cpp:29`) | high | No studio spec to compare against; "unspecified" → firmware default in effect |
| Track width ratio (vertical) | unspecified | `TRACK_W_RATIO = 0.60f` of widget width (`bar_widget.cpp:30`) | high | Same |
| Horizontal track padding | unspecified | `HORIZ_PAD_X = 6` px (`bar_widget.cpp:31`) | high | Same |
| Horizontal label band | unspecified | 25 % of widget height, clamped `[14, 24]` px (`bar_widget.cpp:80-82, 183-187`) | high | Same |
| Track background colour | unspecified | `TRACK_BG_RGB = 0x1C1C1C` (`bar_widget.cpp:71`) | high | No studio spec — using firmware default |
| Signal label colour | unspecified | `SIGNAL_LABEL_RGB = 0x888888` (`bar_widget.cpp:70`) | high | Same |
| Value text colour | unspecified | `VALUE_TEXT_RGB = 0xFFFFFF` (`bar_widget.cpp:73`) | high | Same |
| Danger-zone opacity | unspecified | `ZONE_OPA = 0x35` (`bar_widget.cpp:74`) | high | Same |
| Fill colour (no palette/ramp) | unspecified | `kZoneNormalRgb 0x00CC44` until `dangerLevel`, then `kZoneDangerRgb 0xFF4444` (`bar_widget.cpp:507-521`) | high | Same |
| Suffix resolution | unspecified | per-widget `cfg.bar.suffix` wins, else signals.json `unit` (`bar_widget.cpp:122-124` via `WidgetHelpers::resolveDisplayUnit`) | high | Same |
| Vertical layout font sizes | unspecified | `sigLabelH = 14/12`, `valLabelH = 16/14`, `suffixH = 12/10` split at h≥80 (`bar_widget.cpp:354-356`) | high | Same |

**Net:** any user editing a bar widget in Studio sees nothing — the firmware
renderer is the sole spec, which inverts the design-authority direction
required by issue #1183.

---

## 3. Button widget

Studio: `widget-previews/Button.tsx`.
Firmware: `canshift-firmware/src/ui/widgets/button_widget.cpp`.

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| Layout direction | column: icon on top, label below (`Button.tsx:60-66, 81-106`) | row: icon left, label right (`button_widget.cpp:206-210`) | high | Direct visual mismatch — every button with icon+label reads differently |
| Icon size | `Math.max(18, Math.min(h*0.75, h-14, w*0.7, 56))` (`Button.tsx:27`) | inherited from `lv_img` source size — no programmatic scaling (`button_widget.cpp:250-253`) | high | Studio scales icon to widget, firmware uses raw asset pixel dims |
| Label font weight | `fontWeight: 500` (Orbitron Medium) (`Button.tsx:91`) | `FontManager::label(…)` Medium for size <20, `secondary` Bold for ≥20 (`button_widget.cpp:29-39`) | med | Above ~h=40 firmware switches to Bold while Studio keeps Medium |
| Label font size | `Math.max(8, Math.min(verticalBudget, labelBudget * 0.22))` (`Button.tsx:30`) | tiered 12 / 14 / 16 / 20 / 24 by widget height (`button_widget.cpp:29-39`) | high | Studio scales by width, firmware by height — wide narrow buttons drift heavily |
| Idle background | `normalColor + '18'` (alpha 0x18 ≈ 9 %) (`Button.tsx:54`) | full opacity `bgNormal` (`button_widget.cpp:192-194`) | high | Studio shows a translucent tint, firmware shows the full colour fill — looks like a totally different button state |
| Active background | `activeColor + '55'` (alpha 0x55 ≈ 33 %) (`Button.tsx:54`) | full opacity `bgActive` (`button_widget.cpp:196`) | high | Same translucency drift on the active state |
| Border (idle) | `1px solid st.secondaryColor` (`Button.tsx:71`) | no border (`button_widget.cpp:131-133` only sets border on derived-active toggle) | high | Studio always shows a 1-px outline, firmware shows none unless toggle with derived colours |
| Border (active toggle, no explicit colors) | `1px solid activeColor` (`Button.tsx:71`) | `1px solid TOGGLE_DERIVED_BORDER = 0xFFFFFF` (`button_widget.cpp:91, 128-129`) | med | Different colour (active vs white) |
| Border radius | `0` (`Button.tsx:72`) | `0` (`button_widget.cpp:198`) | — | Aligned |
| Map-switch badge | not rendered (`Button.tsx` ignores `map_switch` actions) | green dot Ø 7 px top-right with offset `(-2, 2)`, `MAP_BADGE_COLOR = 0x33CC44` (`button_widget.cpp:41-42, 274-287`) | high | Map-switch button shows an active-map indicator on device only |
| Icon recolour | dynamic — `textColor + 'CC'` per-state (`Button.tsx:83`) | static — `cfg.style.textColor.rgb` at create time, never updated (`button_widget.cpp:252`) | med | Icon colour doesn't track active/idle on device |
| Label colour (active state) | switches to `stateColor` (`Button.tsx:57, 89`) | stays `cfg.style.textColor.rgb` (`button_widget.cpp:269`) | high | Active button label colour changes in Studio, not on device |
| Internal padding | `4px 6px` (`Button.tsx:68`) | none explicit; LVGL default for `lv_btn` (`button_widget.cpp` doesn't set pad) | low | Visible inset difference on small buttons |

---

## 4. Gear widget

Studio: `widget-previews/Gear.tsx`.
Firmware: `canshift-firmware/src/ui/widgets/gear_widget.cpp`.

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| Auto signal-name header | drawn at top-centre, dim caps, hidden when user label set (`Gear.tsx:38-57`) | not drawn — `gear_widget.cpp:93` only renders the explicit `cfg.label.label` via `WidgetLabelOverlay::apply` | high | "GEAR" header visible in studio, missing on device |
| Header position | top-centre, `left:0 right:0 textAlign:center` (`Gear.tsx:41-49`) | n/a (header absent) | high | Follows from row above |
| Header font size | `Math.max(5, Math.min(sigHeaderH*0.72, w*0.12))` where `sigHeaderH=Math.max(8, Math.min(h*0.16, 13))` (`Gear.tsx:14, 17`) | n/a | high | Same |
| Digit font size | `Math.min(w * 0.72, (h - sigHeaderH) * 0.85)` (`Gear.tsx:16`) | `min(h*0.85, w*0.72)` clamped `[12, 48]` (`gear_widget.cpp:46-58`) | low | Same formula intent, but studio subtracts header band first while firmware doesn't — firmware digit is bigger on the same widget |
| Digit font tier | `fontWeight: 900` (Orbitron Black) always (`Gear.tsx:78`) | tiered: `FontManager::primary` ≥32, `secondary` ≥20, `label` <20 (`gear_widget.cpp:55-59`) | high | Below h≈24 firmware uses Medium, studio always shows Black |
| Digit colour (running) | `st.primaryColor` always (`Gear.tsx:74`) | `textRgb` (theme-effective text colour) (`gear_widget.cpp:73, 124`) | high | Studio honours `widget.style.primaryColor`, firmware uses the theme text colour. A gauge styled red shows red in studio, white on device |
| Reverse colour | n/a (preview always shows "3") | `cfg.style.warningColor.rgb` (`gear_widget.cpp:117`) | low | Reverse state untestable in studio |
| Neutral / invalid digit | n/a (preview always shows "3") | "N" (`gear_widget.cpp:110`) | low | Studio preview hardcodes `'3'` — not parameterisable in current preview |
| Width-centering wrapper | extra full-width flex row around digit to fight Orbitron side bearings (`Gear.tsx:63-71` per issue #513) | LVGL's `lv_obj_align(label, LV_ALIGN_CENTER, 0, 0)` only (`gear_widget.cpp:75`) | med | Sub-pixel horizontal drift on single-digit gears |
| User label position | from `cfg.labelPosition`, default `'bottom-left'` (`Gear.tsx:21`) | `cfg.label.labelPosition` via `WidgetLabelOverlay::apply` (`gear_widget.cpp:93`) | low | Default position differs — studio defaults to bottom-left for gears, firmware honours the schema-level default (which may differ) |

---

## 5. Image widget

Studio: **no renderer** — `WidgetPreview.tsx:123` returns `null`.
Firmware: `canshift-firmware/src/ui/widgets/image_widget.cpp`.

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| Whole widget | not rendered (`WidgetPreview.tsx:123`) | SPIFFS BMP loaded via `lv_img_set_src("S:/images/…")`, centred in container (`image_widget.cpp:60-72`) | high | Background / logo images are invisible in Studio |
| Image scaling | unspecified | none — image renders at native pixel dims (`image_widget.cpp:74-75` comment only) | med | A 200×100 BMP on an 80×60 widget overflows in firmware; studio can't even surface the problem |
| User label overlay | n/a | `WidgetLabelOverlay::apply` at `cfg.image.labelPosition` (`image_widget.cpp:80-82`) | high | Corner label is firmware-only |
| Asset existence probe | n/a | LVGL silently no-ops on missing files — no explicit existence check in the image path (vs the button path's `IconAssets::exists` guard) | low | Latent failure mode invisible to author |

---

## 6. Label widget (numeric/text headline)

Studio: rendered via `GaugeNumericPreview` when `displayStyle: 'numeric'` —
there is **no dedicated label-widget renderer** in the preview tree (only
the gauge renderer with `numeric` style; see § 1.2).
Firmware: `canshift-firmware/src/ui/widgets/label_widget.cpp` (its own
`WidgetFactory` branch, separate from gauge).

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| Dispatcher mapping | a config with `type: 'label'` would route to whatever the preview map exposes — but the schema only emits `label` widgets through `WidgetFactory` (label widgets are not in the Studio `WidgetConfig` union; see `WidgetPreview.tsx:74-90`) | `WidgetFactory` has a `LabelWidget::create` branch (`label_widget.cpp:90`) | high | The widget exists on device but cannot be authored in Studio at all |
| Value font picker | n/a in Studio | `pickValueFontSize`: `min(h*0.65, w*0.52)` clamped `[12, 48]` (`label_widget.cpp:40-49`) | high | No studio counterpart to validate against |
| Font tier routing | n/a | Black ≥32 / Bold ≥20 / Medium <20 (`label_widget.cpp:54-60`) | high | Same |
| Auto signal header band | for the numeric-gauge analog, `sigHeaderH = 14` px (`GaugeNumeric.tsx:46`) | `sigHeaderH = 14` px when no user label (`label_widget.cpp:104`) | — | Aligned at 14 px — listed for cross-check |
| Header font size | studio uses fixed `fontSize: 11` (`GaugeNumeric.tsx:99`) | header uses `FontManager::label(12)` via `WidgetLabelOverlay::apply` (`widget_label.cpp:61`) | low | 1-px font drift on the auto header |
| Header padding | studio: `top:1 left:4` (`GaugeNumeric.tsx:98-99`) | firmware: `kEdgeInsetX=4, kEdgeInsetY=1` (`widget_label.cpp:18-19`) | — | Aligned — listed for cross-check |
| Decimal split scale | studio `FRAC_FONT_SCALE = 0.7` (`gauge-math.ts:113`) | `(intSize * 7) / 10` floored at 12 (`label_widget.cpp:172-176`) | med | Same nominal ratio, but firmware clamps to 12 px min; studio doesn't |
| Unit colour | studio hardcodes `#888888` (`GaugeNumeric.tsx:193`) | hardcodes `0x888888` (`label_widget.cpp:195`) | — | Aligned |
| Unit font | studio `Math.max(8, Math.min(fontSize*0.32, 14))` (`GaugeNumeric.tsx:194`) | `FontManager::label(12)` fixed (`label_widget.cpp:196`) | med | Studio scales, firmware uses constant 12 |
| Row vertical centering | studio centres in column flex with `padding: ${sigHeaderH+2}px 4px 2px` (`GaugeNumeric.tsx:85`) | `lv_obj_align(valueRow, LV_ALIGN_CENTER, 0, sigHeaderH/2)` — biases down by 7 px (`label_widget.cpp:144-145`) | low | Different math but both keep the value in the lower half of the cell |
| Color-ramp tinting | not applied in `GaugeNumericPreview` (`GaugeNumeric.tsx:36` uses `st.textColor`) | applied per-tick when `signals.json` provides a ramp (`label_widget.cpp:298-308`) | high | Studio can't preview the dynamic colour ramp at all |

---

## 7. Timer widget

Studio: **no renderer** — `WidgetPreview.tsx:122` returns `null`.
Firmware: `canshift-firmware/src/ui/widgets/timer_widget.cpp`.

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| Whole widget | not rendered (`WidgetPreview.tsx:122`) | full reset/running/paused states with border accents + blinking colon (`timer_widget.cpp`) | high | Timer widget invisible in Studio |
| Running border colour | unspecified | `kRunningBorderRgb = WidgetHelpers::kZoneNormalRgb (0x00CC44)`, 2 px (`timer_widget.cpp:59, 61`) | high | No studio spec |
| Paused border colour | unspecified | `kPausedBorderRgb = WidgetHelpers::kZoneWarningRgb (0xFF8800)`, 2 px (`timer_widget.cpp:60-61`) | high | No studio spec |
| Reset-state text opacity | unspecified | `LV_OPA_60` (`timer_widget.cpp:64`) | high | No studio spec |
| Font tiers | unspecified | Bold 20 / Bold 24 / Black 32 split at h≥80 / h≥110 (`timer_widget.cpp:172-177`) | high | Hard-coded to v1 320×240 canvas, see #18 TODO at `timer_widget.cpp:168` |
| Paused-state blinking colon | unspecified | 1 Hz toggle of `:` ↔ ` ` (`timer_widget.cpp:244-248`) | high | Studio doesn't preview this — author cannot know paused widgets blink |
| Long-press reset | unspecified | 600 ms hold triggers `TimerService::reset()` (`timer_widget.cpp:54`) | — | Interaction, not a visual drift — listed for completeness |

---

## 8. Warning widget

Studio: **no renderer** — `WidgetPreview.tsx:117` returns `null`.
Firmware: `canshift-firmware/src/ui/widgets/warning_widget.cpp`.

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| Whole widget | not rendered (`WidgetPreview.tsx:117`) | translucent `criticalColor` background, blinking when active, icon + signal label centred (`warning_widget.cpp`) | high | Author cannot preview a warning widget at all |
| Idle bg opacity | unspecified | `0x18` (`warning_widget.cpp:74, 59`) | high | No studio spec |
| Active blink range | unspecified | `0x00` ↔ `0xCC` step (`warning_widget.cpp:47-50`) | high | No studio spec |
| Blink period | unspecified | 1000 ms total (`warning_widget.cpp:22`) | high | No studio spec |
| Icon recolour | unspecified | `cfg.style.criticalColor.rgb` (`warning_widget.cpp:92`) | high | No studio spec |
| Signal label dim formula | the file comment at `warning_widget.cpp:110-114` admits LVGL can't alpha-blend text and uses a bespoke mask `((critRgb >> 1) & 0x7F7F7F) \| 0x404040` instead of the studio `+ '99'` alpha | n/a | high | Even the firmware author flagged this as a known studio↔firmware gap |
| Signal label font size | unspecified | 14 px ≥56, else 12 (`warning_widget.cpp:108`) | high | No studio spec |
| Render order on canvas | `Canvas.tsx:597-599` already orders warnings last (top of z-order) | LVGL render order follows creation order, no enforced "warnings last" | low | Studio enforces a z-order rule the firmware doesn't — but since warnings cover their whole cell either way the user-visible effect is small |

---

## 9. Shared surface — layout offsets

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| Widget origin | (0,0) is the top-left of the widget area, which sits flush below the top bar (`Canvas.tsx:84, 509-523`) | `cfg.layout.x/y` are design-space coords; `initContainer` adds `yOffset = TopBar::getHeight()` to `y` (`widget_helpers.cpp:118-122`, `page_manager.cpp:215`) | — | Aligned at the design-space level — listed for cross-check |
| Top-bar height range | schema-enforced `[16, 60]` px (`canshift-core/src/constants/firmware-caps.ts:29`, `dashboard.ts:514`) | `s_height = cfg.height > 0 ? cfg.height : 30` (`top_bar.cpp:86, 419`) | — | Aligned |
| Screen-profile scale (X/Y) | identity on v1 (`crowpanel-28`, 320×240) — `Canvas.tsx:32` uses fixed `SCALE = 1.5` for display only | `ScreenProfile::scaleXVal/scaleYVal` identity on v1, factor-scales on future profiles (`widget_helpers.cpp:118-122`) | — | Aligned today; firmware is ready for non-identity scales, studio isn't (any future profile change will need studio to mirror the scale helpers) |
| Widget container border-radius | `borderRadius: 3` on every widget box (`WidgetBox.tsx:86`) | `radius=0` everywhere (`widget_styles.cpp:29, 37, 45`; `button_widget.cpp:198`; `warning_widget.cpp:76`) | med | Studio shows 3-px rounded corners on every widget chrome; device shows square corners — visible at small widget sizes |
| Widget container background | `WidgetBox.tsx:56-64` paints black / red-tint / orange-tint / blue-tint based on selection / overlap / overflow | firmware paints transparent (`widget_styles.cpp:10` `LV_OPA_TRANSP`) — page background shows through | — | Studio chrome is editor-only; aligned in render output |
| Off-canvas widget detection | `Canvas.tsx:187-197` lights an orange chrome on widgets that overflow `screenProfile.width / widgetAreaH` | no clamp on device; widget renders past the screen and clips at LVGL display bounds | — | Editor-only surface |
| Overlap detection | `Canvas.tsx:157-181` flags overlapping non-warning widgets | none on device | — | Editor-only |
| Top-bar dot diameter | `Math.round(h * 0.30)` (`Canvas.tsx`/`DashTopBar.tsx:57`, `topbar-metrics.ts:38`) | `lroundf(h * 0.30)` (`top_bar.cpp:44, 57-58`) | — | Aligned |
| Top-bar status-dot OK colour | hardcoded `#44CC44` (`DashTopBar.tsx:91`) | `COLOR_DOT_OK = 0x33CC44` (`top_bar.cpp:128`, mirrors `topbar-colors.ts:39 dotOk: 0x33cc44`) | high | Studio's preview dot does not match the core SoT or the firmware constant |
| Top-bar separator colour | hardcoded `#2A2A2A` (`DashTopBar.tsx:113`) | `COLOR_MUTED = 0x666666` (`top_bar.cpp:138`) | high | Different greys — separator visibly darker in Studio |
| Top-bar label colour | uses `topBar.textColor` from the user config (`DashTopBar.tsx:103`) | `COLOR_LABEL = 0xCCCCCC` hardcoded — does **not** read `cfg.textColor` (`top_bar.cpp:137`, only used as a literal in `makeBarLabel`) | high | Studio responds to the user's `topBar.textColor`; firmware ignores it for labels |

---

## 10. Shared surface — day/night theme colour resolution

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| Source of palette in night mode | `nightTheme?.palette ?? page.palette ?? DEFAULT_PAGE_PALETTE` (`Canvas.tsx:122-127`) | derived from per-page `palette` / `backgroundColor` — no explicit `nightTheme` reader (firmware comment at `night-theme-defaults.ts:6-7`) | high | Studio honours `nightTheme` if set, firmware doesn't read the field at all yet |
| Source of palette in day mode | `dayTheme?.palette ?? DAY_PALETTE_DEFAULT` (`Canvas.tsx:122-127`) | `ConfigLoader::getDashboardConfig().dayTheme` palette via `ThemeManager::getEffectiveBgColor` (`theme_manager.cpp:96-102`) | — | Aligned for bg colour; firmware does not pull `palette` per-widget the way studio does |
| Day-mode background default | `DAY_BG_DEFAULT = '#DDDDDD'` (`canshift-core/src/day-theme-defaults.ts:28`) | reads `dash.dayTheme.bgColor` — same source if dashboards initialise from `DAY_THEME_PRESET` | — | Aligned via shared core constant |
| Day-mode palette default | `DAY_PALETTE_DEFAULT` (`day-theme-defaults.ts:16-25`) | not consumed by firmware widgets — only `bgColor` is pulled (`theme_manager.cpp:96-102`) | high | Studio paints widget palettes from day defaults; firmware leaves widget styles untouched in day mode |
| Per-widget palette override (palette propagation) | `applyPalette` in `WidgetPreview.tsx:40-48` only overrides `textColor` ("preserve per-widget primary/warning/critical … per issue #963") | `ThemeManager::getEffectiveTextColor(styleTextColor, respectDayMode)` collapses to black/white (`theme_manager.cpp:104-116`) | high | Studio preserves the user's `textColor`; firmware overrides it to black/white. So a config with `textColor: '#FF6600'` shows orange in Studio, white on device (night) or black (day) |
| Day/night bg precedence | `effectiveBgColor` flows from active day mode → `dayTheme?.bgColor ?? DAY_BG_DEFAULT` else `nightTheme?.bgColor ?? page.backgroundColor` (`Canvas.tsx:129-131`) | `applyPageBackground(p.screen, cfg, ThemeManager::getEffectiveBgColor(cfg.bgColor))` (`page_manager.cpp:210-212`) | — | Aligned for the bg layer (single-colour fall-through) |
| Day mode toggle source | `useDeviceStore.isDayMode` snapshot from BLE / fallback to `false` (`Canvas.tsx:114`) | NVS-backed `s_isDayMode`, toggleable from settings (`theme_manager.cpp:21-95`) | — | Independent state machines; studio displays a snapshot |
| Dark / light token mapping | `LIGHT_TOKENS = DARK_TOKENS` placeholder until the theme editor lands (`design-tokens.ts:99-100`) | n/a — firmware doesn't consume `design-tokens.ts` | — | Both sides agree LIGHT is currently aliased to DARK; flagged only because future drift here propagates everywhere |

---

## 11. Shared surface — font fallback chain

| Aspect | Studio (spec) | Firmware (actual) | Severity | Notes |
|---|---|---|---|---|
| Font family declaration | `FONT_FAMILY = 'Orbitron, sans-serif'` (`widgetPreview.styles.ts:19`) | three baked Orbitron tiers (Black 32/48, Bold 20/24, Medium 12/14/16) via `FontManager` (`font_manager.cpp:50-52`) | — | Studio relies on browser font loading; firmware relies on baked .bin / in-flash fonts |
| Browser fallback | falls through to `sans-serif` when Orbitron CSS load fails (`widgetPreview.styles.ts:19`) | falls back to `lv_font_orbitron_medium_14_nk` (in-flash 14-px Medium) when SPIFFS load fails (`font_manager.cpp:162-167`) | high | Studio fallback is the OS sans-serif (~Helvetica/Arial), firmware fallback is always 14-px Medium Orbitron. A device that boots with a missing font tier shrinks every value to 14 px, while studio just changes typeface |
| Available weights | only one (`fontWeight` per element: 500 or 900) (every widget-previews file) | three weights: Black (primary), Bold (secondary), Medium (label) (`font_manager.cpp:50-52`) | high | Studio "Bold" (700) is unreachable — every Bold size on device (20, 24) renders as Black 900 in Studio because the family only fans out to Black via fontWeight |
| Size snapping | continuous CSS pixel sizes via `Math.min/Math.max` formulas (e.g. `GaugeArc.tsx:77`) | snaps DOWN to the nearest available tier — `snapIndex` (`font_manager.cpp:64-74`) | high | Studio shows a smoothly scaling number; device shows a step-function. A 28-px target snaps to 24-px Bold on device (since 28 was dropped — see `font_manager.cpp:48-49` comment) but renders at 28 px in Studio |
| 28-px Bold tier | available — any continuous CSS px is fine (`Button.tsx:30`) | **dropped** to keep the LVGL pool below ceiling (`font_manager.cpp:46-49, 51`) | high | Studio's continuous-size renderer happily uses 28 px Bold for buttons / value labels; firmware snaps to 24-px Bold. Up to ~14 % size drift in this band |
| Black tier sizes | continuous via CSS `fontSize` (e.g. `GaugeArc.tsx:77` clamps to 42) | only 32 and 48 px available (`font_manager.cpp:50`) | high | Any continuous value between 32 and 48 snaps DOWN on device → glyphs shrink. Same below 32: snaps to 32 (the smallest), so a 22-px Black request reads 32 px on device |
| In-flash vs SPIFFS provenance | n/a in Studio | Black 32/48 + Medium 14 in flash; Bold 20/24 + Medium 12/16 from SPIFFS (`font_manager.cpp:177-194`) | low | A SPIFFS-load failure for Bold sizes silently falls through to Medium 14 — Studio has no analog visual to convey this |
| Curated short-label dictionary | `signalLabels.ts` (17 entries) (`canshift-studio-web/src/utils/signalLabels.ts:11-28`) | `displayLabelForSignal` 17 entries (`widget_label.cpp:73-110`) | — | Aligned — listed for cross-check |
| Empty signal placeholder | studio returns `'—'` (em-dash) (`signalLabels.ts:32`) | firmware returns `"-"` (ASCII hyphen) (`widget_helpers.cpp:33-35`) | low | Single-character drift on disconnected widgets |

---

## Summary

**Total concrete drifts found: 88** (counting every row whose Severity is
`high`, `med`, or `low` — rows marked `—` are alignment confirmations).

Breakdown by severity:

| Severity | Count |
|---|---:|
| high | 60 |
| med  | 18 |
| low  | 10 |
| **Total** | **88** |

Distribution by section (high / med / low):

| Section | high | med | low |
|---|---:|---:|---:|
| 1.1 Gauge (arc)              | 8 | 5 | 1 |
| 1.2 Gauge (numeric)          | 6 | 1 | 1 |
| 2.  Bar                      | 11 | 0 | 0 |
| 3.  Button                   | 6 | 3 | 2 |
| 4.  Gear                     | 4 | 1 | 3 |
| 5.  Image                    | 2 | 1 | 1 |
| 6.  Label                    | 4 | 2 | 1 |
| 7.  Timer                    | 6 | 0 | 0 |
| 8.  Warning                  | 6 | 0 | 1 |
| 9.  Layout offsets           | 3 | 1 | 0 |
| 10. Day/night theme          | 3 | 0 | 0 |
| 11. Font fallback chain      | 5 | 1 | 2 |

### Recommended fix order

The umbrella issue suggests gauge → bar → button → gear → label → timer →
warning → image. The audit suggests **reordering** based on the type of
work each fix needs:

1. **Bar** (11 high / 0 med / 0 low). No Studio renderer at all. Cheapest
   biggest win: ship a `BarPreview` mirroring `bar_widget.cpp`'s existing
   layout constants (track ratios, danger band, labels). Every author hits
   this immediately.
2. **Warning** (6 high). Same problem as bar — no renderer. Authors
   designing safety-critical alert dashboards have zero feedback today.
3. **Timer** (6 high). Same problem as bar.
4. **Image** (2 high / 1 med / 1 low). Same problem; cheaper to ship
   because it's a static `<img>` element.
5. **Gauge — numeric** (6 high / 1 med / 1 low) **and** the firmware
   `WidgetFactory` dispatch fix that routes `displayStyle: 'numeric'`
   through `LabelWidget` (or a new `NumericGauge`). Today firmware silently
   ignores `displayStyle` and renders every gauge as an arc — that single
   bug invalidates half the gauge section.
6. **Gauge — arc** (8 high / 5 med / 1 low). The 270° vs 280° sweep, the
   palette/zone value-text colour drift, and the rev-flash visual gap are
   the user-visible items.
7. **Button** (6 high / 3 med / 2 low). Layout flip (column vs row),
   alpha-tint vs solid bg, border presence are visible at-a-glance drifts.
8. **Gear** (4 high). Auto-header missing on device, `primaryColor` vs
   `textColor` divergence on the digit.
9. **Label** (4 high / 2 med / 1 low). Lower priority because it's
   currently authored as a numeric-style gauge — solve once §1.2 lands.
10. **Shared font fallback chain** (5 high / 1 med / 2 low). The dropped
    28-px Bold tier, the size-snapping mismatch, and the 3-weight vs
    2-weight reality need a unified resolver. Likely lands as a small
    `canshift-core` util consumed by both renderers (issue #18 already
    flags this).
11. **Shared day/night theme** (3 high). Firmware needs to read `nightTheme`
    and stop collapsing per-widget `textColor` to mono — both are policy
    decisions tracked under #21 v2, so likely a separate umbrella anyway.
12. **Shared layout offsets** (3 high / 1 med). The top-bar status-dot
    `#44CC44` ↔ `0x33CC44`, separator grey, and label-colour override are
    quick wins — single-file fixes in `DashTopBar.tsx` against the
    `topbar-colors.ts` SoT.

Suggested PR shape per row above: one PR per widget type, plus three
follow-up PRs for the shared surfaces. Section §1 splits into two PRs
because the numeric dispatch fix touches firmware while the arc fixes
touch the studio renderer.
