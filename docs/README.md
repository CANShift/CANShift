# docs/

`docs/` — CANShift architecture documentation. Start here for system understanding.

---

## Reading Order

1. `ARCHITECTURE.md` — C4-style architecture (system context, containers, components, data flow, invariants)
2. `overall-architecture.md` — narrative + ASCII diagrams companion to `ARCHITECTURE.md`
3. `roadmap.md` — phase breakdown and delivery milestones
4. `usb-first-strategy.md` — why USB came first and how Phase 1 works
5. `config-contract.md` — JSON config schema and how it flows end-to-end
6. `can-integration-notes.md` — CAN wiring and signal mapping
7. `future-wireless-strategy.md` — Wi-Fi and BLE plans for Phase 2+
8. `RELEASE.md` — release cadence, what ships, manual validation, rollback

**Before first hardware power-up:** read `FIRST_FLASH.md` — pre-flight checklist for pin verification, CAN frame ID confirmation, and CAN Pal wiring.

---

## Document Index

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | C4-style architecture — context, containers, components, data flow, invariants (closes #1020) |
| `overall-architecture.md` | Multi-project system architecture and data flow (narrative companion to `ARCHITECTURE.md`) |
| `RELEASE.md` | Release process — cadence, artifacts, validation, rollback (closes #1020) |
| `roadmap.md` | Phased delivery plan and milestones |
| `architecture-roadmap-2026.md` | Themed roadmap synthesized from the 2026-05-20 audit (closes #1019) |
| `audit-2026-05-20.md` | Source audit transcript — feeds the roadmap above |
| `FIRST_FLASH.md` | Pre-flight checklist for first hardware power-up |
| `usb-first-strategy.md` | Phase 1 USB communication design |
| `config-contract.md` | JSON config schema specification |
| `can-integration-notes.md` | CAN bus wiring and signal mapping |
| `future-wireless-strategy.md` | Phase 2+ Wi-Fi and BLE design |
| `ecu-integration.md` | ECU integration notes — validator + naming conventions |
| `secure-boot-setup.md` | Secure-boot first-flash + key management |
| `mobile-sdk-upgrade.md` | Mobile SDK upgrade decisions |
| `dash-hosted-readiness-audit.md` | Pre-flight audit (2026-05-26) — what blocks first-flash → dash-hosted Studio end-to-end |

---

## Cross-Links

- Repo root: [`../README.md`](../README.md)
- Firmware: [`../canshift-firmware/README.md`](../canshift-firmware/README.md)
- Studio: [`../canshift-studio/README.md`](../canshift-studio/README.md)
- Mobile: [`../canshift-mobile/README.md`](../canshift-mobile/README.md)
- Core: [`../canshift-core/README.md`](../canshift-core/README.md)
