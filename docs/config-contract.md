# Config Contract — CANShift Configuration Schema

The configuration contract defines what valid config files look like and how they flow through the system.

## Config Files

The CANShift dashboard is configured by these JSON files stored on the device:

| File | Purpose | Where to edit |
|------|---------|---------------|
| `dashboard.json` | Pages, widgets, layout, signal bindings, day theme | Desktop config studio |
| `signals.json` | CAN frame IDs, signal byte positions, scaling | Desktop config studio |
| `device.json` | TWAI pins, CAN speed, optional hardware overrides | Desktop config studio |
| `input_bindings.json` | Physical GPIO button → action map (issue #833) | Desktop config studio |

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

### PageConfig
```json
{
  "id": "string",           // unique identifier
  "name": "string",
  "backgroundImage": null | "string",  // path in SPIFFS assets/
  "backgroundColor": "#RRGGBB",
  "showTopBar": boolean,
  "widgets": [Widget]
}
```

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
      "timeoutMs": number
    }
  ]
}
```

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

### Write path (desktop → device)

```
User edits layout in canshift-studio
    │
    ▼
Desktop validates config using canshift-core validators
    │
    ▼
Desktop saves dashboard.json, signals.json (and device.json on demand)
    │
    │ USB serial (CMD_PUT_CONFIG)
    ▼
Firmware UsbComm task receives JSON
    │
    ▼
StorageDriver writes to SPIFFS
    │
    ▼
ConfigLoader::reloadAll() is called
    │
    ▼
PageManager rebuilds UI from new config
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
