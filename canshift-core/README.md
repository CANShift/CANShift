# canshift-core

`canshift-core` — pure TypeScript contract layer for the CANShift ecosystem.

---

## Purpose

`canshift-core` is the single source of truth for:

- **Configuration types** — `DashboardConfig`, `Widget` discriminated union, `PageConfig`, `TopBarConfig`, `ButtonAction`, `DeviceConfig`, `SignalConfig`
- **Validation** — runtime checks on dashboard, signal, and device configs
- **Schema migrations** — versioned chain that brings older configs forward to `CURRENT_SCHEMA_VERSION`
- **IPC return-shape contracts** — types describing what the studio's main process returns to the renderer

It is pure TypeScript with no Node.js, browser, or React Native APIs. Today it is consumed by `canshift-studio`. `canshift-mobile` consumes the same package as needed.

It does **not** contain:

- Firmware C++ code (lives in `canshift-firmware/`)
- UI components (live in `canshift-studio/src/`)
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
    ├── migrations/
    │   └── migration-runner.ts           # BUILTIN_MIGRATIONS, migrateConfig, validateMigrationChain
    ├── types/
    │   ├── common.ts                     # HexColor, WidgetType, WidgetLayout, WidgetStyle, SemVer
    │   ├── dashboard.ts                  # DashboardConfig, Widget union, PageConfig, TopBar, ButtonAction
    │   ├── device.ts                     # DeviceConfig, CanSpeedKbps, DEFAULT_DEVICE_CONFIG
    │   ├── ipc.ts                        # PortInfo, ConnectionStatus, UsbResult, OpenResult, SaveResult
    │   └── signal.ts                     # SignalConfig, SignalDef
    ├── validation/
    │   ├── validate-dashboard.ts         # Bounds, hex colors, signal refs, duplicate IDs, firmware caps
    │   ├── validate-device.ts            # CAN speed and pin sanity
    │   └── validate-signals.ts           # Signal catalog structure
    └── __tests__/                        # Jest specs pinning behaviour
```

---

## Public API

All exports live behind the `src/index.ts` barrel — consumers must not reach into sub-paths.

**Types**

- Dashboard: `DashboardConfig`, `PageConfig`, `PagePalette`, `Widget`, `WidgetConfig` (discriminated union on `type`), `GaugeWidgetConfig`, `GaugeDisplayStyle`, `WarningWidgetConfig`, `ButtonWidgetConfig`, `TimerWidgetConfig`, `BarWidgetConfig`, `GearWidgetConfig`, `ImageWidgetConfig`, `SensorIconName`, `WidgetLabelPosition`, `ThemePreset`, `TopBarConfig`, `TopBarItem`, `TopBarItemPosition`
- Button actions: `ButtonAction`, `DashboardButtonAction`, `EcuButtonAction`, `NavigateAction`, `MapSwitchAction`, `CanRawAction`
- Common primitives: `HexColor`, `WidgetType`, `WidgetLayout`, `WidgetStyle`, `SemVer`
- Signals: `SignalConfig`, `SignalDef`
- Device: `DeviceConfig`, `CanSpeedKbps`
- IPC: `PortInfo`, `ConnectionStatus`, `UsbResult`, `OpenResult`, `SaveResult`

**Runtime constants**

- `DEFAULT_PAGE_PALETTE`, `DEFAULT_TOP_BAR_LAYOUT` — dashboard defaults
- `DEFAULT_DEVICE_CONFIG`, `CAN_SPEED_OPTIONS` — device defaults
- `FIRMWARE_CAPS`, `CANVAS`, `TOPBAR_HEIGHT`, `REV_LIMIT_RPM`, `DECIMAL_PLACES`, `HEX_COLOR_REGEX` — firmware caps and validation primitives

**Validators** — all return `{ ok: boolean, errors: string[] }`

- `validateDashboard(config, options?)` plus types `ValidationResult`, `ValidateDashboardOptions`
- `validateSignals(signals)`
- `validateDevice(device)`

**Migrations**

- `BUILTIN_MIGRATIONS` (read-only registry), `migrateConfig`, `validateMigrationChain`
- Types: `Migration`, `MigrationFn`, `MigrationRegistry`, `MigrationResult`

**Version**

- `CURRENT_SCHEMA_VERSION` — currently `1.17.0`
- `PRODUCT_NAME` — `'CANShift'`

---

## Schema Versioning & Migrations

Every config file carries a `"version"` field at the root:

```json
{ "version": "1.17.0", ... }
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

| From → To | Change |
|-----------|--------|
| 1.0.0 → 1.1.0 | `ButtonWidgetConfig.targetPageId` replaced by `actions[]` (single `navigate` action) |
| 1.1.0 → 1.2.0 | `LabelWidgetConfig` removed and folded into `GaugeWidgetConfig` (`displayStyle: 'numeric'`); gauges without `displayStyle` default to `'arc'` |
| 1.2.0 → 1.3.0 | `PageConfig.palette` added; missing palettes filled with the default CANShift palette |
| 1.3.0 → 1.4.0 | `DashboardConfig.dayTheme` added (optional, no transform) |
| 1.4.0 → 1.5.0 | `TopBarConfig.layout` added (optional, no transform) |
| 1.5.0 → 1.6.0 | XS/S/M widget sizes dropped (#131) — legacy 80×28 / 80×56 / 80×112 standard widgets collapse to L (160×56) |
| 1.6.0 → 1.7.0 | Drop unused `PageConfig.name`, `TopBarConfig.showMapName`, `TopBarConfig.showMapProfile` (#142) |
| 1.7.0 → 1.8.0 | Button colors move into `ButtonWidgetConfig.colors` (#146); `iconName` removed from gauge/bar configs |
| 1.8.0 → 1.9.0 | H-FULL bar gauge token doubled from 320×28 to 320×56 (#134) — existing horizontal bars are upgraded |
| 1.9.0 → 1.10.0 | Optional `alertThreshold` field added to gauge / bar widgets (#133) |
| 1.10.0 → 1.11.0 | Arc gauges gain optional `arcFillStyle` field (#175); undefined defaults to `'zones'` — no data transform needed |
| 1.11.0 → 1.12.0 | Default `topBar.height` bumped from 24 → 30 (#379); configs persisting the old default are rewritten, custom values are left untouched |
| 1.12.0 → 1.13.0 | `SignalDef` gains optional `colorRamp` field (#430); firmware resolves a default ramp from the signal name when none is configured |
| 1.13.0 → 1.14.0 | `signals.json` `protocol` rewritten from the MaxxECU-specific `"maxxecu_v1.2"` to the ECU-agnostic `"custom_v1.0"` (#639); no-op for dashboard configs (no `protocol` field) |
| 1.14.0 → 1.15.0 | `WidgetStyle` gains optional `respectDayMode` field (#191); undefined treated as `true` to preserve the v0.7.0 day/night text-colour contract — no data transform |
| 1.15.0 → 1.16.0 | `GaugeWidgetConfig` and `BarWidgetConfig` gain optional `iconName` field (#954); existing configs leave the field undefined and keep the legacy `style.primaryColor` path — no data transform |
| 1.16.0 → 1.17.0 | Gauge / bar `warningLevel` dropped (#965); `dangerLevel` becomes the sole threshold above which a gauge turns red — `warningLevel` is discarded, `dangerLevel` preserved as-is |

`migrateConfig` deep-clones the input before any migration runs (#282) so individual migrations can mutate freely without aliasing the caller's object.

---

## Validation

Validation is **custom TypeScript code, not JSON Schema**. Each validator returns:

```ts
{ ok: boolean; errors: string[] }
```

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

Schema mismatches between firmware and core are detected at runtime so a stale firmware paired with a newer config logs a clear error rather than silently misreading bytes (#259).

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

- **canshift-studio** — primary consumer; imports types, validators, migrations, and IPC return shapes
- **canshift-firmware** — `config_types.h` mirrors these types in C++; loaders read the same JSON shapes
- **canshift-mobile** — consumes the same package directly when it needs config or telemetry types
