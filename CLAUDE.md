# CANShift — Claude workspace instructions

## Project

CANShift is a configurable real-time automotive dashboard.
- **Hardware:** Elecrow CrowPanel 2.8" (ESP32, 320×240), MaxxECU Street ECU, VW VR6 2.9, Adafruit CAN Pal
- **Repo:** `git@github.com:tburkhalterr/CANShift.git` (monorepo)

## Workspace structure

```
canshift-firmware/   C++ / PlatformIO / LVGL 8.3 — ESP32 firmware
canshift-studio/     Electron + React 18 + TypeScript — desktop config editor
canshift-mobile/     React Native (iPhone) — PLANNED, docs only for now
canshift-core/       TypeScript — shared types, schemas, validation
docs/                Architecture docs
```

## Current phase

**Phase 1 — USB first.**
Priority: firmware + desktop studio + shared core.
`canshift-mobile` = documentation only, no implementation.

## Commits

You MAY create conventional commits autonomously when a logical unit of work is complete.
No need to ask for permission every time.

Format: `type(scope): short description`

Scopes: `firmware`, `studio`, `core`, `mobile`, `docs`, `workspace`

Examples:
```
feat(firmware): add gauge widget arc rendering
fix(studio): correct USB port listing on macOS
chore(workspace): add per-project .gitignore files
docs(firmware): document TWAI pin assumptions
```

Rules:
- Subject line only — no body, no co-author
- English only
- Imperative mood ("add", not "added")

## Key conventions

### Firmware (canshift-firmware)
- PlatformIO + Arduino framework
- All hardware pins → `include/board_config.h` (all assumptions, must be verified on real board)
- Feature flags → `include/app_config.h`
- Simulation mode: `APP_SIMULATION_MODE=1` in platformio.ini `[env:sim]`
- LVGL must be called only while holding `g_lvglMutex`
- CAN frame IDs in `signals.json` are unverified assumptions — always note this

### Desktop studio (canshift-studio)
- Electron main process in `main/`, renderer in `src/`
- IPC channel names → `main/ipc/ipc-channels.ts` (single source of truth)
- State management: Zustand stores in `src/stores/`
- `canshift-core` imported as `file:../canshift-core`

### Shared core (canshift-core)
- Pure TypeScript, no Node.js or browser APIs
- All config types exported from `src/index.ts`
- Schema version constant: `CURRENT_SCHEMA_VERSION` in `src/index.ts`
- Mirrors C++ `config_types.h` in firmware — keep in sync

## Important files

| File | Purpose |
|------|---------|
| `canshift-firmware/include/board_config.h` | All hardware pin assignments (verify before flash) |
| `canshift-firmware/include/app_config.h` | Feature flags, task sizes, thresholds |
| `canshift-firmware/data/config/dashboard.json` | Example dashboard config |
| `canshift-firmware/data/config/signals.json` | MaxxECU CAN signal mapping (unverified) |
| `canshift-core/src/index.ts` | Public API of shared-core |
| `canshift-studio/main/ipc/ipc-channels.ts` | IPC channel constants |
| `docs/overall-architecture.md` | Full system architecture |
| `docs/roadmap.md` | Phase breakdown |

## Pre-commit checks

Before every commit that touches `canshift-core` or `canshift-studio`, run:
```bash
# canshift-core
cd canshift-core && npm run lint && npm run format:check && npm run build

# canshift-studio
cd canshift-studio && npm run lint && npm run format:check && npm run typecheck
```
Do not commit if any check fails. Fix the errors first.

## Releases

Releases are version-tagged (`vX.Y.Z`) and trigger the GitHub Actions release workflow.
The workflow builds the Electron app for macOS + Windows and creates a **draft** GitHub Release.

To cut a release:
1. Bump the version in `canshift-studio/package.json`
2. Commit: `chore(studio): bump version to X.Y.Z`
3. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
4. The GitHub Actions release workflow fires automatically
5. Review the draft release on GitHub, add notes, publish

## .claude directories

`.claude/` directories are local only (gitignored). Do not add `.gitkeep` to them.
