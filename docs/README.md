# docs/

CANShift architecture documentation. Start here for system understanding.

---

## Reading order

1. **`ARCHITECTURE.md`** — C4-style architecture (system context, containers, components, data flow, invariants)
2. **`overall-architecture.md`** — narrative + ASCII diagrams companion to `ARCHITECTURE.md`
3. **`roadmap.md`** — phase breakdown and delivery milestones
4. **`config-contract.md`** — JSON config schema and how it flows end-to-end
5. **`can-integration-notes.md`** — CAN wiring and signal mapping
6. **`RELEASE.md`** — release cadence, what ships, manual validation, rollback

**Before first hardware power-up:** read `FIRST_FLASH.md` — pre-flight checklist for pin verification, CAN frame ID confirmation, and CAN Pal wiring.

**Contributing a new widget or ECU:** read the matching `HOW_TO_*.md` walkthrough below.

---

## Current docs

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | C4-style architecture — context, containers, components, data flow, invariants |
| `overall-architecture.md` | Multi-project system architecture and data flow (narrative companion to `ARCHITECTURE.md`) |
| `roadmap.md` | Phased delivery plan and milestones |
| `RELEASE.md` | Release process — cadence, artifacts, validation, rollback |
| `FIRST_FLASH.md` | Pre-flight checklist for first hardware power-up |
| `config-contract.md` | JSON config schema specification |
| `can-integration-notes.md` | CAN bus wiring and signal mapping |
| `ecu-integration.md` | ECU integration notes — validator + naming conventions |
| `HOW_TO_ADD_A_WIDGET.md` | Contributor walkthrough — add a new widget type across firmware + tuner + core |
| `HOW_TO_ADD_AN_ECU.md` | Contributor walkthrough — add support for a new ECU's CAN protocol |
| `secure-boot-setup.md` | Secure-boot first-flash + key management |

> The forward-looking docs above predate the **#1351 refactor** (WiFi+SPA removal, `canshift-tuner` introduction, `canshift-studio-web` retirement). They still describe the right system shape directionally — the deeper rewrite to mention `canshift-tuner` by name and drop WiFi-coupled language is tracked as a follow-up.

---

## Archived docs

`archive/` — point-in-time audits, snapshot roadmaps, and strategy notes that drove past decisions but no longer describe the current system. Kept for context. Don't read these for current-state understanding.

| File | What it was |
|------|-------------|
| `archive/audit-2026-05-20.md` | Multi-agent cross-package audit (May 2026) that fed the early roadmap |
| `archive/architecture-roadmap-2026.md` | Themed roadmap synthesized from the May 2026 audit |
| `archive/dash-hosted-readiness-audit.md` | Pre-flight audit (May 2026) of the dash-hosted Studio path that #1351 retired |
| `archive/firmware-size-audit-2026-06-01.md` | Snapshot of what filled the firmware image before the #1353 WiFi removal |
| `archive/widget-parity-audit-2026-06-01.md` | Snapshot of firmware ↔ studio widget parity per #1183 |
| `archive/usb-first-strategy.md` | Phase 1 USB design — predates the WebSerial-everywhere posture in `canshift-tuner` |
| `archive/future-wireless-strategy.md` | WiFi/BLE plan superseded by #1351 (WiFi removed; BLE remains for mobile) |
| `archive/mobile-sdk-upgrade.md` | Expo SDK 52 → 53 tracker — mobile is deferred while the firmware/tuner pair stabilises |
| `archive/mobile-sdk-upgrade-decisions/` | Per-decision notes from the mobile upgrade work |

---

## Cross-links

- Repo root: [`../README.md`](../README.md)
- Firmware: [`../canshift-firmware/README.md`](../canshift-firmware/README.md)
- Tuner: [`../canshift-tuner/README.md`](../canshift-tuner/README.md) — current configurator (Vercel-hosted, WebSerial). See also `canshift-tuner/docs/` for the user-facing + technical reference on the tuner itself.
- Mobile: [`../canshift-mobile/README.md`](../canshift-mobile/README.md)
- Core: [`../canshift-core/README.md`](../canshift-core/README.md)
