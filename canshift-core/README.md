# canshift-core

Shared configuration domain logic for the CANShift ecosystem.

**Language:** TypeScript
**Usage:** Consumed by `canshift-studio` and (future) `canshift-mobile`

---

## Purpose

`canshift-core` is the **single source of truth** for the CANShift configuration data model.

It provides:
- TypeScript interfaces and types for all configuration entities
- JSON schema definitions for validation
- Configuration validation utilities
- Schema versioning strategy
- Migration utilities for schema upgrades

It does NOT contain:
- Firmware-specific C++ code (that lives in `canshift-firmware/src/`)
- UI components (those live in `canshift-studio/src/`)
- Electron or Node.js specific APIs (must run in any JS runtime)
- Mobile-specific code (React Native compatibility via pure TS only)

---

## Current Status

Foundation scaffolded:
- TypeScript types for all config entities
- Basic validation utilities
- Schema version strategy
- `package.json` configured for consumption as local npm dependency

Not yet implemented:
- Full JSON Schema (Ajv) validation
- Schema migration runner
- Unit tests

---

## Folder Structure

```
canshift-core/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Public API barrel export
│   ├── types/
│   │   ├── dashboard.ts      # DashboardConfig, PageConfig, WidgetConfig
│   │   ├── signal.ts         # SignalMapping, SignalDef, CanFrame
│   │   ├── theme.ts          # ThemeConfig, Palette
│   │   └── common.ts         # Shared primitives (Color, Layout, Style)
│   ├── schemas/
│   │   ├── dashboard.schema.json  # JSON Schema for dashboard.json
│   │   ├── signals.schema.json    # JSON Schema for signals.json
│   │   └── theme.schema.json      # JSON Schema for theme.json
│   ├── validation/
│   │   ├── validate-dashboard.ts  # Validate a DashboardConfig object
│   │   ├── validate-signals.ts    # Validate a SignalConfig object
│   │   └── validate-theme.ts      # Validate a ThemeConfig object
│   └── migrations/
│       ├── migration-runner.ts    # Apply migrations from version A to B
│       └── migrations/
│           └── 1.0.0-to-1.1.0.ts # Example future migration
└── dist/                         # Compiled output (gitignored)
```

---

## Installation (in consuming projects)

During development (local workspace):
```json
// package.json of canshift-studio
"dependencies": {
  "@tmbk/canshift-core": "file:../canshift-core"
}
```

After publishing to npm:
```json
"dependencies": {
  "@tmbk/canshift-core": "^1.0.0"
}
```

---

## Schema Versioning Strategy

Every config file has a `"version"` field at the root:

```json
{ "version": "1.0.0", ... }
```

Version follows semantic versioning:
- **MAJOR**: Breaking schema change — migration required
- **MINOR**: Additive change — backwards compatible
- **PATCH**: Documentation or comment change only

The `CURRENT_SCHEMA_VERSION` constant in `src/index.ts` is the version that
the current code knows how to write and read.

When loading a config file, the firmware and desktop app must:
1. Read the `version` field
2. If version === CURRENT_SCHEMA_VERSION: load normally
3. If version < CURRENT_SCHEMA_VERSION: run migration chain to upgrade
4. If version > CURRENT_SCHEMA_VERSION: warn user to update the app

---

## Connections to Other Projects

- **canshift-studio** — primary consumer; imports types and validators
- **canshift-firmware** — uses config_types.h which mirrors these types in C++
- **canshift-mobile** (future) — will import the same types

---

## Resume Work From Here

1. `cd canshift-core && npm install && npm run build`
2. Confirm types compile without errors
3. In `canshift-studio`: run `npm install` to link canshift-core
4. Implement Ajv-based validators in `src/validation/`
5. Add unit tests for validators with valid and invalid config examples
