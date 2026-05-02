# canshift-core

Shared configuration domain logic for the CANShift ecosystem.

**Language:** TypeScript (pure — no Node.js or browser APIs)
**Consumed by:** `canshift-studio`, future `canshift-mobile`

---

## Purpose

`canshift-core` is the **single source of truth** for the CANShift configuration data model.

It provides:
- TypeScript interfaces and types for all configuration entities
- JSON schema definitions for validation
- Configuration validation utilities
- Schema versioning and migration strategy

It does NOT contain:
- Firmware-specific C++ code (that lives in `canshift-firmware/`)
- UI components (those live in `canshift-studio/src/`)
- Electron or Node.js specific APIs — must run in any JS runtime
- Mobile-specific code (React Native compatible via pure TypeScript)

---

## Folder Structure

```
canshift-core/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Public API — all exports go through here
│   ├── types/
│   │   ├── dashboard.ts      # DashboardConfig, PageConfig, WidgetConfig
│   │   ├── signal.ts         # SignalConfig, SignalDef, CAN signal types
│   │   └── common.ts         # Shared primitives (Color, Layout, etc.)
│   └── validation/
│       └── validate-dashboard.ts  # Runtime config validation
└── dist/                     # Compiled output (gitignored — built by CI)
```

---

## Installation (in consuming projects)

Development (local workspace — current setup):
```json
"dependencies": {
  "@tmbk/canshift-core": "file:../canshift-core"
}
```

**Always build before linking:**
```bash
cd canshift-core && npm install && npm run build
```

---

## Schema Versioning

Every config file has a `"version"` field at the root:

```json
{ "version": "1.0.0", ... }
```

The `CURRENT_SCHEMA_VERSION` constant in `src/index.ts` is the version the current code knows how to write and read.

Version follows semantic versioning:
- **MAJOR** — breaking schema change, migration required
- **MINOR** — additive change, backwards compatible
- **PATCH** — documentation or comment change only

When loading a config file, consumers must:
1. Read the `version` field
2. If `version === CURRENT_SCHEMA_VERSION` → load normally
3. If `version < CURRENT_SCHEMA_VERSION` → run migration chain
4. If `version > CURRENT_SCHEMA_VERSION` → warn user to update the app

---

## Firmware Sync Requirement

`config_types.h` in `canshift-firmware/src/config/` mirrors the TypeScript types here in C++.

When adding or changing fields in `DashboardConfig`, `PageConfig`, `WidgetConfig`, or `SignalDef`:
1. Update the TypeScript type in `canshift-core`
2. Bump `CURRENT_SCHEMA_VERSION` if the change is breaking
3. Update `config_types.h` in firmware to match
4. Update `config_loader.cpp` in firmware to read the new field

---

## Connections to Other Projects

- **canshift-studio** — primary consumer; imports all types and validators
- **canshift-firmware** — uses `config_types.h` which mirrors these types in C++
- **canshift-mobile** (future) — will import the same types
