---
title: "Config contract"
description: "Shared JSON contract between firmware, tuner, and mobile — schema versions, validation rules."
sidebar:
  order: 11
---

> 🚨 **Pre-#1351.** Sections mentioning `canshift-studio-web` should be read as `canshift-tuner`; the JSON schema itself (in `canshift-core`) is unchanged. WiFi-coupled flow descriptions are historical. See [`#1351`](https://github.com/tburkhalterr/CANShift/issues/1351).

The configuration contract defines what valid config files look like and how they flow through the system.

## Config Files

The CANShift dashboard is configured by these JSON files stored on the device:

| File | Purpose | Where to edit |
|------|---------|---------------|
| `dashboard.json` | Pages, widgets, layout, signal bindings, day theme | Dash-hosted Studio (`canshift-studio-web/`) or legacy Electron Studio (`canshift-studio/`) until cutover |
| `signals.json` | CAN frame IDs, signal byte positions, scaling | Same |
| `device.json` | TWAI pins, CAN speed, optional hardware overrides | Same — wired host-side in studio-web (#1118) via `CMD_GET_DEVICE_CONFIG` (0x03) / `CMD_PUT_DEVICE_CONFIG` (0x04) |
| `input_bindings.json` | Physical GPIO button → action map (issue #833) | Same — wired host-side via `CMD_GET_INPUT_BINDINGS` (0x0B) / `CMD_PUT_INPUT_BINDINGS` (0x0C) |

The standalone `theme.json` file was folded into `dashboard.json.dayTheme` in
schema 1.13 → 1.14 (issue #901). Older configs are migrated transparently by
`migrateConfig`; new firmware images no longer read `theme.json`.

`dashboard.json` and `signals.json` share the same `"version"` field at the
root. Schema version is defined in `canshift-core/src/index.ts` as
`CURRENT_SCHEMA_VERSION` (currently `1.17.0`).

---

## dashboard.json Schema

```json
{
  "version": "1.0.0",       // schema version
  "name": "string",          // display name
  "defaultPageId": "string", // id of first page to show
  "revLimitRpm": number,     // for alert engine
  "targetProfile": "crowpanel-28",  // optional — see Target screen profile below
  "topBar": {
    "height": number,        // pixels (default 24)
    "showMapName": boolean,
    "showMapProfile": boolean,
    "bgColor": "#RRGGBB",
    "textColor": "#RRGGBB"
  },
  "pages": [PageConfig]
}
```

### Target screen profile (`targetProfile`) — issue #548

The optional `targetProfile` field declares which LCD the dashboard was
authored against. Today CANShift ships a single profile (`crowpanel-28` →
320×240, the only panel firmware v1 supports), so the field is omitted from
most configs and the studio + firmware default to `crowpanel-28` via
`resolveScreenProfile` (`canshift-core/src/schemas/screen-profile.ts`).

- **Studio**: the editor canvas uses the resolved profile's `width` × `height`
  to size the preview. The picker lives in the Page settings panel
  (`canshift-studio-web/src/components/editor/PropertyPanel.tsx`).
- **Firmware v1**: reads but ignores the field — there is only one panel.
- **Phase 2 (#17, multi-board)**: branches off `targetProfile` to pick the
  board hardware config.
- **Phase 3 (#18, multi-screen LVGL)**: scales widgets based on the resolved
  profile's dimensions.

Backward compatibility: dashboards predating this field continue to parse —
`migrateConfig` does NOT add `targetProfile` to existing configs; the
default-resolution rule applies at the read side.

### PageConfig
```json
{
  "id": "string",           // unique identifier
  "name": "string",
  "backgroundImage": null | "string",  // path in SPIFFS assets/
  "backgroundColor": "#RRGGBB",
  "showTopBar": boolean,
  "template": "custom" | "cruise_control",  // optional — see Page templates below
  "widgets": [Widget]
}
```

### Page templates (`template`) — issue #451

The optional `template` field selects how the firmware draws a page.

| Value | Behaviour |
|-------|-----------|
| absent / `"custom"` | Default. Firmware renders `widgets[]` as a free-form grid (legacy behaviour). |
| `"cruise_control"` | Firmware draws a fixed 2×2 grid of touch-targets (`+`, `SET`, `−`, `OFF`) and **ignores `widgets[]`**. Each button dispatches the matching `cruise_control` action op via `ActionDispatcher`. |

Notes:

- The two-zone palette (#954) and day/night theming apply to template-rendered
  pages — they re-use the regular `ButtonWidget` create path.
- The studio editor surfaces the template picker under **Page settings →
  Template**. When a non-`custom` template is active, the canvas displays a
  read-only preview placeholder and the widget palette is locked out — this
  mirrors what the firmware will render on-device.
- Studio keeps any previously authored `widgets[]` content even while a
  template is active so flipping back to `custom` doesn't lose work.
- Backward compatibility: the field is optional. Pages predating this feature
  parse cleanly and default to `custom`; no migration is required.

Adding a new template requires three coordinated edits:

1. `canshift-core/src/schemas/dashboard.ts` — add the literal to
   `PAGE_TEMPLATES` and document the new branch.
2. `canshift-studio-web/src/components/editor/PropertyPanel.tsx` — extend
   `PAGE_TEMPLATE_LABELS` and provide a canvas preview.
3. `canshift-firmware/src/ui/page_manager.cpp` — add a procedural builder
   alongside `buildCruiseControlTemplate` and route to it from `buildPage`.

### Widget
```json
{
  "id": "string",          // unique identifier within page
  "type": "gauge|label|warning|button|timer|bar|gear|image",
  "signal": "string",      // signal name from signals.json
  "layout": {
    "x": number,           // pixels from left
    "y": number,           // pixels from top (content area, below top bar)
    "w": number,
    "h": number,
    "zOrder": number       // 0 = bottom
  },
  "style": {
    "primaryColor": "#RRGGBB",
    "secondaryColor": "#RRGGBB",
    "warningColor": "#RRGGBB",
    "criticalColor": "#RRGGBB",
    "textColor": "#RRGGBB",
    "fontSize": number
  },
  "config": { ... }        // type-specific config object
}
```

---

## signals.json Schema

```json
{
  "version": "1.0.0",
  "protocol": "custom_v1.0",
  "canSpeedKbps": 500,
  "signals": [
    {
      "name": "string",     // key used in Widget.signal
      "canFrameId": "0x370",
      "startByte": number,
      "byteLength": 1|2|4,
      "bigEndian": boolean,
      "signed": boolean,
      "bitMask": "0x01",    // optional, for flag signals
      "scale": number,
      "offset": number,
      "unit": "string",
      "min": number,
      "max": number,
      "timeoutMs": number,
      "polling": {          // optional — see "OBD-II polling" below
        "mode": 0x01,
        "pid": 0x0C,
        "intervalMs": 1000
      }
    }
  ]
}
```

### OBD-II polling — `signals[].polling` (issue #841)

Default behaviour is **passive broadcast**: the firmware listens to whatever
the ECU sends on its own. MaxxECU / Haltech / MegaSquirt and most race ECUs
publish their telemetry this way — leave `polling` absent.

OBD-II ECUs are different: they speak request/response, so the dash must SEND
a query frame (`0x7DF`, mode `0x01`, PID byte) and decode the response
(`0x7E8`). When a signal carries a `polling` block, the firmware's
`Obd2Poller` schedules requests at `intervalMs` and writes the matched
response into the signal — `canFrameId` should be set to the response ID
(`0x7E8`) so the byte-decode path mirrors the broadcast contract.

| Field        | Type        | Notes                                                     |
|--------------|-------------|-----------------------------------------------------------|
| `mode`       | `0x01`      | Mode 01 only in v1 (current data PIDs).                   |
| `pid`        | `0x00..0xFF`| SAE J1979 PID byte. The studio editor surfaces a catalog. |
| `intervalMs` | 100..60000  | Poll interval. ≥100 ms keeps the bus polite.              |

Constraints — **v1 scope (#841)**:

- Mode 01 only. Modes 02..09 (freeze frame, O2 sensor monitors, VIN, …) are
  deferred. Out-of-range modes are rejected by the studio validator and
  silently dropped at firmware parse time with a WARN log.
- Single ECU at `0x7DF / 0x7E8`. Multi-ECU vehicles emit additional
  responses at `0x7E9..0x7EF` — not consumed in v1.
- One PID = one signal. ISO-TP multi-frame responses (length > 7) are out
  of scope.

The default `signals.json` shipped with the firmware (MaxxECU-style) does
**not** include any polling blocks. To use OBD-II, push a custom
`signals.json` via Studio with the polling fields populated. See
`canshift-firmware/data/signals_obd2_mode01.json.example` for a starter
catalog targeting the J1979 standard PIDs (RPM, speed, coolant, throttle).

---

## Day theme — embedded in `dashboard.json`

Since schema 1.14 (issue #901), the day-mode palette and background live on
the dashboard itself under `dayTheme`. No separate file is shipped.

```json
{
  "version": "1.17.0",
  "dayTheme": {
    "palette": {
      "background": "#RRGGBB",
      "surface": "#RRGGBB",
      "primary": "#RRGGBB",
      "accent": "#RRGGBB",
      "text": "#RRGGBB",
      "textDim": "#RRGGBB",
      "warning": "#RRGGBB",
      "danger": "#RRGGBB",
      "success": "#RRGGBB"
    },
    "background": "#RRGGBB"
  }
}
```

Dark-mode tokens are baked into the firmware (`DARK_TOKENS` in
`canshift-core/src/design-tokens.ts`) and are not user-configurable today.

---

## How Config Flows Through the System

### Write path (Studio → device)

```
User edits layout in canshift-studio-web (dash-hosted, browser SPA)
    │
    ▼
Studio validates config using canshift-core validators (+ migrations
                              chain if loading an older file)
    │
    ▼
Studio sends dashboard.json, signals.json (and device.json /
              input_bindings.json on demand) via the chosen transport:
    │
    ├── WebSocket on port 81 (#1108, same dispatcher as USB on firmware)
    └── Wire-format mapping (snake_case) via deviceConfigToWire /
        inputBindingsToWire from canshift-core for the device /
        input-bindings cmds (0x03 / 0x04 / 0x0B / 0x0C)
    │
    ▼
Firmware UsbComm::handleLine() — shared dispatcher across USB / TCP / WS
    │
    ▼
StorageDriver writes to SPIFFS atomically (with .bak companion)
    │
    ▼
ConfigLoader::reloadAll() → PageManager rebuilds UI from new config
```

### Read path (device boot)

```
ESP32 power on
    │
    ▼
BootSequence calls StorageDriver::init()
    │
    ▼
ConfigLoader::loadAll() reads each canonical config
    │
    ├── Parses dashboard.json → CfgDashboard struct (incl. dayTheme)
    ├── Parses signals.json → CfgSignalConfig struct
    └── Parses device.json → CfgDevice struct (TWAI pins, CAN speed)
    │
    ▼
ThemeManager::apply() → styles LVGL from dashboard.dayTheme + DARK_TOKENS
PageManager::init() → creates all LVGL page screens
CanParser::loadSignalDefinitions() → configures CAN parser
```

---

## Schema Migration

When the schema version changes:

1. Bump `CURRENT_SCHEMA_VERSION` in `canshift-core/src/index.ts`
2. Add a migration function in `canshift-core/src/migrations/`
3. Update `config_types.h` in firmware to match new fields
4. Desktop app runs migration on load if version mismatch detected
5. Firmware falls back gracefully on unknown fields (ArduinoJson ignores extra keys)

> Important — the firmware **does not run the migration chain**. It only logs
> a `VER_MISMATCH` and continues with whatever fields it can read. Studio is
> the canonical migration boundary; do not push a config with `version >
> firmware schema` and expect it to be normalized on the device. Issue #1019
> (A-COMPAT-1) tracks the firmware-side preflight that will gate this.

---

## UI Design Constraints (320×240 display)

The canvas coordinate system in `dashboard.json`:
- Origin `(0, 0)` = top-left of content area (below top bar)
- Top bar occupies `y = 0 to topBar.height` of the physical screen
- Content area: `x = 0..319`, `y = 0..(239 - topBar.height)`
- Widget layout coordinates are in content area coordinates
- The desktop editor shows the canvas at the same coordinates

### Recommended Widget Sizes (320×240 minus 24px top bar = 320×216 content)

| Widget | Recommended size | Notes |
|--------|-----------------|-------|
| Main RPM gauge | 160×140 | Half-width, fills left side |
| Speed label | 158×80 | Half-width right, large font |
| Gear indicator | 80×48 | Right side, large font |
| Secondary gauge | 100×100 | Quarter screen |
| Temperature label | 80×40 | 4 fit in a row |
| Warning indicator | 20×20 | Small LED dots in a row |
| Nav button | 60×32 | Bottom corner |
