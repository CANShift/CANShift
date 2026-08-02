# canshift-core

`canshift-core` — pure TypeScript contract layer for the CANShift ecosystem.

---

## Purpose

`canshift-core` is the single source of truth for:

- **Configuration types** — `DashboardConfig`, `Widget` discriminated union, `PageConfig`, `TopBarConfig`, `ButtonAction`, `DeviceConfig`, `SignalConfig`, `InputBindingsConfig`
- **Validation** — runtime checks on dashboard, signal, and device configs
- **Schema migrations** — versioned chain that brings older configs forward to `CURRENT_SCHEMA_VERSION`
- **Design tokens** — `DARK_TOKENS` palette + `tokensToCssVars` consumed by `canshift-studio-web/` (dash-hosted Studio) via its generated `src/styles/tokens.generated.css`. Recently extended in #1097 with `statusDanger`, `statusDangerDim`, and `scrim` for danger-state widget surfaces and dialog backdrops — exposed as `--status-danger`, `--status-danger-dim`, `--scrim` CSS variables.
- **Wire-format schemas** — `DeviceConfigWireSchema`, `InputBindingsConfigWireSchema`, `TrackTelemetrySchema`, `ScreenSettingsSchema`, ECU profiles, hardware profiles

It is pure TypeScript with no Node.js, browser, or React Native APIs. Today
it is consumed by `canshift-studio-web` (dash-hosted Studio, #1077) and
`canshift-mobile`. Transport-shape types live in
`canshift-studio-web/src/transport/` so core can stay browser/Node-neutral.

It does **not** contain:

- Firmware C++ code (lives in `canshift-firmware/`)
- UI components (live in `canshift-studio-web/src/`)
- Electron, Node, or React Native specific APIs

---

## Folder Structure

```
canshift-core/
├── package.json
├── tsconfig.json
├── jest.config.ts
└── src/
    ├── index.ts                          # Public API barrel — only import from here
    ├── constants/
    │   └── firmware-caps.ts              # FIRMWARE_CAPS, CANVAS, REV_LIMIT_RPM, HEX_COLOR_REGEX
    ├── schemas/                          # Single home for every contract (#914)
    │   ├── common.ts                     # HexColor, WidgetType, WidgetLayout, WidgetStyle, SemVer
    │   ├── dashboard.ts                  # DashboardConfig, Widget union, PageConfig, TopBar, ButtonAction
    │   ├── device.ts                     # DeviceConfig + wire schema, Esp32{Input,Output}GpioSchema
    │   ├── signal.ts                     # SignalConfig, SignalDef, ColorRamp, CanSpeedKbps
    │   ├── ble-status.ts                 # BLE STATUS characteristic (firmware → mobile, #887)
    │   ├── input-bindings.ts             # Physical GPIO button bindings (#833)
    │   ├── screen-settings.ts            # CMD_SCREEN_SETTINGS / BLE SETTINGS payload (S-H-1)
    │   ├── track-telemetry.ts            # Track-mode BLE telemetry contract (#843)
    │   └── hardware-profile.ts           # HARDWARE_PROFILES per-board pin tables (#831)
    ├── migrations/
    │   └── migration-runner.ts           # BUILTIN_MIGRATIONS, migrateConfig, validateMigrationChain
    ├── validation/
    │   ├── validate-dashboard.ts         # Bounds, hex colors, signal refs, duplicate IDs, firmware caps
    │   ├── validate-signal-config.ts     # SignalConfig structural sanity
    │   └── validate-signal.ts            # validateSignalCatalog (color-ramp anchored)
    ├── ecu-profiles/                     # Built-in ECU presets (MaxxECU, …) — #570
    ├── can-xml/                          # CAN XML import (parseCanXml, #609)
    ├── types/
    │   └── releases.ts                   # GitHub ReleaseInfo / LatestReleaseResult (#571)
    ├── design-tokens.ts                  # DARK_TOKENS, tokensToCssVars (#526)
    ├── day-theme-defaults.ts             # DAY_PALETTE_DEFAULT / DAY_BG_DEFAULT (#901)
    ├── sensor-defaults.ts                # SENSOR_DEFAULT_RAMPS + resolveDefaultRamp (#430)
    ├── sensor-palette.ts                 # Two-zone semantic palette (#954)
    ├── topbar-metrics.ts                 # TopBar proportion table (mirrored in firmware)
    ├── topbar-colors.ts                  # TopBar status palette (mirrored in firmware)
    └── __tests__/                        # Jest specs pinning behaviour
```

The previously-published `types/{common,dashboard,device,ipc,signal}.ts`
barrels were collapsed into the corresponding `schemas/*.ts` files in #914 —
every contract now has exactly one home.

---

## Public API

All exports live behind the `src/index.ts` barrel — consumers must not reach into sub-paths.

**Types**

- Dashboard: `DashboardConfig`, `PageConfig`, `PagePalette`, `Widget`, `WidgetConfig` (discriminated union on `type`), `GaugeWidgetConfig`, `GaugeDisplayStyle`, `GaugeArcFillStyle`, `WarningWidgetConfig`, `ButtonWidgetConfig`, `TimerWidgetConfig`, `BarWidgetConfig`, `GearWidgetConfig`, `ImageWidgetConfig`, `SensorIconName`, `WidgetLabelPosition`, `ThemePreset`, `TopBarConfig`, `TopBarItem`, `TopBarItemPosition`
- Button actions: `ButtonAction`, `DashboardButtonAction`, `EcuButtonAction`, `NavigateAction`, `MapSwitchAction`, `CanRawAction`, `CruiseControlAction`, `CruiseControlOp`
- Common primitives: `HexColor`, `WidgetType`, `WidgetLayout`, `WidgetStyle`, `SemVer`
- Signals: `SignalConfig`, `SignalDef`, `ColorRamp`, `ColorRampStop`, `RampInterpolation`
- Device: `DeviceConfig`, `DeviceConfigWire`, `CanSpeedKbps`
- Input bindings (#833): `InputBinding`, `InputBindingWire`, `InputBindingsConfig`, `InputBindingsConfigWire`, `InputActiveLevel`, `InputPressKind`
- Track telemetry (#843): `TrackTelemetry`
- Screen settings (S-H-1): `ScreenSettings`
- BLE STATUS (#887): `BleStatusWire`, `BleStatus`, `BleStatusResult`
- Releases (#571): `ReleaseAsset`, `ReleaseInfo`, `LatestReleaseResult`
- Design tokens (#526): `DesignTokens`
- Hardware profiles (#831): `HardwareProfileId`, `HardwareProfile`
- ECU profiles (#570): `EcuProfile`
- CAN XML import (#609): `ParseCanXmlResult`
- TopBar mirror types: `TopBarMetricsRatios`, `TopBarColorPalette`
- Sensors: `SensorKind`, `SensorPaletteEntry`

**Runtime values**

- Dashboard: `DEFAULT_PAGE_PALETTE`, `DEFAULT_TOP_BAR_LAYOUT`, `CRUISE_CONTROL_OPS`
- Device: `DEFAULT_DEVICE_CONFIG`, `CAN_SPEED_OPTIONS`, `deviceConfigFromWire`, `deviceConfigToWire`
- Input bindings: `InputBindingsConfigSchema`, `InputBindingsConfigWireSchema`, `inputBindingsFromWire`, `inputBindingsToWire`, `MAX_INPUT_BINDINGS`, `INPUT_BINDING_ID_MAX_LEN`
- Schemas (boundary parsing): `DashboardConfigSchema`, `SignalConfigSchema`, `DeviceConfigSchema`, `DeviceConfigWireSchema`, `Esp32OutputGpioSchema`, `Esp32InputGpioSchema`, `TrackTelemetrySchema`, `ScreenSettingsSchema`
- BLE STATUS helpers: `BLE_STATUS_MAX_STRING_LEN`, `SCREEN_SETTINGS_BOUNDS`, `parseBleStatus`
- Sensors: `SENSOR_DEFAULT_RAMPS`, `SENSOR_PALETTE`, `resolveDefaultRamp`, `resolveSensorKind`, `colorAtValue`, `sensorOkColor`, `sensorWarningColor`
- Design tokens: `COLOR_KEY_TO_CSS_VAR`, `DARK_TOKENS`, `tokensToCssVars`, `DAY_PALETTE_DEFAULT`, `DAY_BG_DEFAULT`, `DAY_THEME_PRESET`
- Hardware / ECU: `HARDWARE_PROFILES`, `isPinAvailableForBoard`, `ECU_PROFILES`, `DEFAULT_PROFILE_ID`, `MAXXECU_SIGNAL_UNITS`
- CAN XML: `parseCanXml`
- TopBar mirrors: `TopBarMetrics`, `TopBarColors`
- Firmware caps: `FIRMWARE_CAPS`, `CANVAS`, `TOPBAR_HEIGHT`, `REV_LIMIT_RPM`, `DECIMAL_PLACES`, `HEX_COLOR_REGEX`, `MAX_RAMP_STOPS`

**Validators** — all return `{ valid: boolean, errors: string[], warnings: string[], config?: T }`

- `validateDashboard(config, options?)` plus types `ValidationResult`, `ValidateDashboardOptions`
- `validateSignalConfig(config)`
- `validateSignalCatalog(signals)`

**Migrations**

- `BUILTIN_MIGRATIONS` (read-only registry), `migrateConfig`, `validateMigrationChain`
- Types: `Migration`, `MigrationFn`, `MigrationRegistry`, `MigrationResult`

**Version**

- `CURRENT_SCHEMA_VERSION` — currently `1.23.0`
- `PRODUCT_NAME` — `'CANShift'`

---

## Schema Versioning & Migrations

Every config file carries a `"version"` field at the root:

```json
{ "version": "1.23.0", ... }
```

`CURRENT_SCHEMA_VERSION` (`src/index.ts`) is the version this code reads and writes. It follows semver:

- **MAJOR** — breaking schema change, migration required
- **MINOR** — additive change, backwards compatible
- **PATCH** — documentation or comment change only

When loading a config, consumers must:

1. Read `version`
2. If `version === CURRENT_SCHEMA_VERSION` → load normally
3. If `version < CURRENT_SCHEMA_VERSION` → run `migrateConfig(config, CURRENT_SCHEMA_VERSION)`
4. If `version > CURRENT_SCHEMA_VERSION` → ask the user to update the app

The migration chain is anchored to `CURRENT_SCHEMA_VERSION` (issue #282) — `validateMigrationChain` proves at test time that a complete path exists from every legacy version to the current one.

### Migration chain (terminates at `CURRENT_SCHEMA_VERSION`)

| From → To       | Change                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0 → 1.1.0   | `ButtonWidgetConfig.targetPageId` replaced by `actions[]` (single `navigate` action)                                                                                                          |
| 1.1.0 → 1.2.0   | `LabelWidgetConfig` removed and folded into `GaugeWidgetConfig` (`displayStyle: 'numeric'`); gauges without `displayStyle` default to `'arc'`                                                 |
| 1.2.0 → 1.3.0   | `PageConfig.palette` added; missing palettes filled with the default CANShift palette                                                                                                         |
| 1.3.0 → 1.4.0   | `DashboardConfig.dayTheme` added (optional, no transform)                                                                                                                                     |
| 1.4.0 → 1.5.0   | `TopBarConfig.layout` added (optional, no transform)                                                                                                                                          |
| 1.5.0 → 1.6.0   | XS/S/M widget sizes dropped (#131) — legacy 80×28 / 80×56 / 80×112 standard widgets collapse to L (160×56)                                                                                    |
| 1.6.0 → 1.7.0   | Drop unused `PageConfig.name`, `TopBarConfig.showMapName`, `TopBarConfig.showMapProfile` (#142)                                                                                               |
| 1.7.0 → 1.8.0   | Button colors move into `ButtonWidgetConfig.colors` (#146); `iconName` removed from gauge/bar configs                                                                                         |
| 1.8.0 → 1.9.0   | H-FULL bar gauge token doubled from 320×28 to 320×56 (#134) — existing horizontal bars are upgraded                                                                                           |
| 1.9.0 → 1.10.0  | Optional `alertThreshold` field added to gauge / bar widgets (#133)                                                                                                                           |
| 1.10.0 → 1.11.0 | Arc gauges gain optional `arcFillStyle` field (#175); undefined defaults to `'zones'` — no data transform needed                                                                              |
| 1.11.0 → 1.12.0 | Default `topBar.height` bumped from 24 → 30 (#379); configs persisting the old default are rewritten, custom values are left untouched                                                        |
| 1.12.0 → 1.13.0 | `SignalDef` gains optional `colorRamp` field (#430); firmware resolves a default ramp from the signal name when none is configured                                                            |
| 1.13.0 → 1.14.0 | `signals.json` `protocol` rewritten from the MaxxECU-specific `"maxxecu_v1.2"` to the ECU-agnostic `"custom_v1.0"` (#639); no-op for dashboard configs (no `protocol` field)                  |
| 1.14.0 → 1.15.0 | `WidgetStyle` gains optional `respectDayMode` field (#191); undefined treated as `true` to preserve the v0.7.0 day/night text-colour contract — no data transform                             |
| 1.15.0 → 1.16.0 | `GaugeWidgetConfig` and `BarWidgetConfig` gain optional `iconName` field (#954); existing configs leave the field undefined and keep the legacy `style.primaryColor` path — no data transform |
| 1.16.0 → 1.17.0 | Gauge / bar `warningLevel` dropped (#965); `dangerLevel` becomes the sole threshold above which a gauge turns red — `warningLevel` is discarded, `dangerLevel` preserved as-is                |
| 1.17.0 → 1.18.0 | `DashboardConfig` gains optional `targetProfile` (#548); undefined resolves to `DEFAULT_SCREEN_PROFILE_ID` ("crowpanel-28") — no data transform                                               |
| 1.18.0 → 1.19.0 | `BarWidgetConfig` gains optional `barOrientation` (#1232 flag); undefined keeps the legacy horizontal layout — no data transform                                                              |
| 1.19.0 → 1.20.0 | `hideWhenInvalid` removed from every widget config; firmware now renders a stale state in-place rather than hiding the widget                                                                 |
| 1.20.0 → 1.21.0 | `bar` widget type removed; legacy `bar` widgets are filtered out, gauges shed any leftover `barOrientation` field                                                                             |
| 1.21.0 → 1.22.0 | `label` and `labelPosition` removed from non-button widget configs (labels now live on the widget frame, not the config body)                                                                 |
| 1.22.0 → 1.23.0 | `ButtonWidgetConfig` becomes a `mode`-discriminated union (#1232); existing button configs without `mode` are tagged `mode: 'single'` to preserve behavior — the `cycle` mode is opt-in       |

`migrateConfig` deep-clones the input before any migration runs (#282) so individual migrations can mutate freely without aliasing the caller's object.

---

## Validation

Validation is **Zod-backed** (Zod is `canshift-core`'s only runtime
dependency). Each validator returns:

```ts
{ valid: boolean; errors: string[]; warnings: string[]; config?: T }
```

`config` is only present on the success branch and is the validated
`DashboardConfig` (or equivalent) ready to consume.

`validateDashboard` covers:

- Layout bounds against `CANVAS` and `TOPBAR_HEIGHT`
- Hex colors against `HEX_COLOR_REGEX`
- Signal-catalog references (every bound signal exists)
- Duplicate widget IDs
- Firmware caps from `FIRMWARE_CAPS` (max widgets per page, max pages, etc.)
- Discriminated `WidgetConfig.type` exhaustiveness

`validateSignals` and `validateDevice` enforce structural sanity on their respective domains. The Jest suite pins behaviour against the bundled `dashboard.json` fixture (#287) so regressions surface immediately when shape changes are introduced without a paired migration.

---

## Firmware Sync Requirement

`config_types.h` in `canshift-firmware/src/config/` mirrors these TypeScript types in C++. When changing `DashboardConfig`, `PageConfig`, `WidgetConfig`, or `SignalDef`:

1. Update the TypeScript type here
2. Bump `CURRENT_SCHEMA_VERSION` if the change is not purely additive
3. Add a migration in `migrations/migration-runner.ts` and a corresponding test
4. Update `config_types.h` in firmware to match
5. Update `config_loader.cpp` in firmware to read the new field

Schema mismatches between firmware and core are detected at runtime so a
stale firmware paired with a newer config logs a clear error rather than
silently misreading bytes (#259). The firmware **does not run the migration
chain** — only Studio migrates configs forward. Issue #1019 (A-COMPAT-1)
tracks the firmware-side preflight that will reject mismatched pushes
instead of degrading silently.

---

## Installation In Consuming Projects

Within the monorepo, link by relative path:

```json
"dependencies": {
  "@tmbk/canshift-core": "file:../canshift-core"
}
```

Always build before linking — consumers resolve the compiled `dist/`:

```bash
cd canshift-core && npm install && npm run build
```

---

## Build & Test

```bash
npm run build         # tsc → dist/
npm run lint          # eslint src
npm run format:check  # prettier --check src/**/*.ts
npm test              # Jest (ESM via --experimental-vm-modules)
```

The Jest suite under `src/__tests__/` covers migrations, dashboard validation (full and end-to-end), signal validation, device validation, and the bundled fixture.

---

## Conventions & Rules

- **Pure TypeScript** — no Node, browser, or React Native APIs
- **Strict typing** — no `any`; narrow `unknown` with type guards before use
- **Barrel-only imports** — consumers must import from `@tmbk/canshift-core` (which resolves to `src/index.ts`); never reach into sub-paths
- **Bump `CURRENT_SCHEMA_VERSION`** whenever the `DashboardConfig` shape changes, and ship a paired migration in the same PR
- **Discriminated unions** — `WidgetConfig` uses `type` as the discriminant; new widget kinds extend the union and the validator's exhaustive switch
- **Mirror C++** — every change here must be reflected in firmware `config_types.h`

---

## Connections To Other Projects

- **canshift-studio-web** (dash-hosted Studio, #1077) — canonical Studio since the Electron package was decommissioned; imports types, validators, migrations, design tokens
- **canshift-firmware** — `config_types.h` mirrors these types in C++; loaders read the same JSON shapes. The firmware also consumes `DARK_TOKENS` indirectly through the embedded dash-hosted Studio SPA (#1077 phase 4)
- **canshift-mobile** — consumes the same package directly when it needs config or telemetry types (BLE STATUS schema, screen-settings bounds, design tokens)
