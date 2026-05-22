# docs/

`docs/` — CANShift architecture documentation. Start here for system understanding.

---

## Reading Order

1. `overall-architecture.md` — system overview, project boundaries, data flow
2. `roadmap.md` — phase breakdown and delivery milestones
3. `usb-first-strategy.md` — why USB came first and how Phase 1 works
4. `config-contract.md` — JSON config schema and how it flows end-to-end
5. `can-integration-notes.md` — CAN wiring and signal mapping
6. `future-wireless-strategy.md` — Wi-Fi and BLE plans for Phase 2+

**Before first hardware power-up:** read `FIRST_FLASH.md` — pre-flight checklist for pin verification, CAN frame ID confirmation, and CAN Pal wiring.

---

## Document Index

| File | Purpose |
|------|---------|
| `overall-architecture.md` | Multi-project system architecture and data flow |
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

---

## Cross-Links

- Repo root: [`../README.md`](../README.md)
- Firmware: [`../canshift-firmware/README.md`](../canshift-firmware/README.md)
- Studio: [`../canshift-studio/README.md`](../canshift-studio/README.md)
- Mobile: [`../canshift-mobile/README.md`](../canshift-mobile/README.md)
- Core: [`../canshift-core/README.md`](../canshift-core/README.md)
