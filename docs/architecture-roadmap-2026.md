# Architecture Roadmap — 2026

> Synthesizes the architecture findings from the cross-package audit
> (`docs/audit-2026-05-20.md` §6 + §8) and the open issues filed against it
> (#1007–#1018) into a navigable map. Closes #1019.

This is a **plan**, not a backlog. Each theme bundles issues that share a
boundary, calls out the unblocking order, and gives a non-binding effort
estimate (S = days, M = weeks, L = months). No new design questions are
opened here — only ordering of work the audit already surfaced.

---

## Theme 1 — Wire contract & cross-package compatibility

The single highest-leverage area. Today firmware degrades silently on a
schema mismatch and there is no enforced cross-package wire-format rule.

| Issue | Scope | Effort |
|-------|-------|--------|
| #1019 A-COMPAT-1 | Firmware preflight: `firmware:query-schema-version` IPC + studio gate on `usb:push-config` | S |
| #1019 A-COMPAT-2 | Settle the camelCase / snake_case rule in `docs/ARCHITECTURE.md` (do not flip `dashboard.json`) | S |
| #1019 A-COMPAT-3 | Codegen `include/cfg_caps_generated.h` from `canshift-core/src/constants/firmware-caps.ts`, fail-on-diff CI | M |
| #1019 A-COMPAT-4 | Canonical signal-label dictionary in core, embedded into firmware via fixture anchor | M |
| #1019 A-COMPAT-5 | `BleTelemetrySchema` in core + `'b:caps'` GATT so mobile drives layout from device truth | M |
| #1019 A-MISS-1 | Downgrade migrations or `stripToVersion(config, target)` helper — required by A-COMPAT-1 | M |
| #1019 A-MISS-2 | Schema field manifest + firmware parser anchor test | S |

**Order of operations.** A-COMPAT-2 (write the doc) must land first — every
other item references the rule. A-COMPAT-1 + A-MISS-1 form a pair: the
preflight is only safe once Studio can downgrade. A-COMPAT-3 is independent
and can run in parallel. A-COMPAT-4 / A-COMPAT-5 build on the codegen
machinery from A-COMPAT-3 so wait until that lands.

---

## Theme 2 — Firmware lifecycle hardening

Critical-path safety items that touch the device's runtime behaviour:
allocator policy, semantic rollback, error visibility, reproducible builds.

| Issue | Scope | Effort |
|-------|-------|--------|
| #1014 F-HI-2 | Eliminate `new`/`delete` in widget create paths — pool-tag fixed slots | M |
| #1014 F-HI-3 | Replace `malloc`/`free` snapshot rollback with static BSS snapshot (~5 KB per `CfgSignalConfig`) | M |
| #1014 F-HI-6 | `Logger::emit` — recursive mutex or stack buffers (#1037 closed the recursive-mutex contract; remaining buffer work tracked here) | S |
| #1014 F-HI-7 | Push `xQueueCreate` failures into `ErrorStore` so the error screen actually renders in prod | S |
| #1019 A-MISS-3 | Dry-run mode for firmware `loadDashboard` / `loadSignals` — semantic rollback on top of file-level `.bak` | S |
| #1019 A-MISS-5 | Structured device→host diagnostics export (`usb:export-diag`) — boot log, error store, schema version, heap history | M |
| #1019 A-MISS-7 | Reproducible firmware builds — pin lib versions, vendor platform install, build-twice-and-diff CI job | S |
| #1019 (low-prio) | CAN scan mode max-runtime cap (5 min) so a forgotten scan can't DoS the USB task | S |

**Order of operations.** F-HI-7 and F-HI-6 are independent quick wins —
land first. F-HI-2 / F-HI-3 / A-MISS-3 form an allocator-policy bundle and
should land together to avoid mixed-state behaviour. A-MISS-5 (diagnostics
export) unlocks remote debugging for everything else in this theme; bump
its priority once the bundle merges. A-MISS-7 is a CI-only change and can
run any time.

---

## Theme 3 — Studio state & token consolidation

The studio is the integration surface — the audit found duplicated subscribers,
hand-rolled dialogs, scattered tokens, and one too-large preview component.

| Issue | Scope | Effort |
|-------|-------|--------|
| #1015 S-H-3 | Extend #905 — six remaining `useEffect` data-fetch sites (UpdateRoute, StatusBar, InputBindingsSection, ConnectModal, useFirstRunCheck, useCliDetach) | S |
| #1015 S-H-4 | Migrate `PushDiffDialog` + `ConnectModal` to Radix `Dialog` (focus-trap, role, Escape, aria-label) | S |
| #1015 S-M-2 | Funnel three independent `USB_DEVICE_LOG` subscribers through a `deviceLog.store` | S |
| #1015 S-M-1 | Lazy-load `EditorRoute` so the route bundle matches the other four | S |
| #1015 S-H-2 | Plan + execute `style-src-attr 'none'` — kill the remaining 573 `style={{}}` sites in the renderer (depends on #906) | M |
| #1015 / WidgetPreview | `WidgetPreview.tsx` (1577 lines) split — partially absorbed by Theme 6 below; if Theme 6 ships first this becomes a no-op | M |
| #1019 A-MISS-6 | `features.json` + studio toggles UI — shared kill-switch table between firmware and studio | M |

**Order of operations.** S-M-2 first (it removes coupling that makes
everything else harder to refactor). Then S-H-3 + S-M-1 in parallel. S-H-4
is independent. S-H-2 must wait for Tailwind token migration (#906) to
make material progress.

---

## Theme 4 — Mobile resilience & secrets hygiene

Mobile is in deferred / simulator-only scope — listed here for sequencing
when active development resumes. No new mobile-only chores are scheduled.

| Issue | Scope | Effort |
|-------|-------|--------|
| #1012 | Unify the two parallel GitHub-releases fetchers (`OtaService` vs `ReleasesService`) — single source via `ReleasesService` adapter (M-CR-1) | S |
| #1013 | Allowlist URL schemes in `Linking.openURL` for release-notes markdown (SEC-H-1) | S |
| #1017 M-HI-1 | Move BLE code from `src/services/` to `src/lib/ble/` (or update CLAUDE.md — already partially done) | S |
| #1017 M-HI-2 / M-HI-3 | Inline-style + NativeWind/StyleSheet split cleanup across 9 affected screens | M |
| #1017 M-HI-4 | `Platform.OS` branches → `.ios.ts`/`.android.ts` carve-outs in BLE services | S |
| #1018 SEC-M-1 | OTA HMAC secret hardening — out of `Constants.expoConfig.extra` (blocker for rotation #521) | M |

**Order of operations.** #1012 and #1013 are the only items to do before
mobile development resumes — both are safety net work that catches issues
already in production. Everything else waits on mobile active scope
returning.

---

## Theme 5 — Cross-package CI & release-line gates

Plumbing that makes every other theme verifiable.

| Issue | Scope | Effort |
|-------|-------|--------|
| #1019 (suggested) | End-to-end contract test: studio export → firmware native parse on a `dashboard.json` corpus | M |
| #1019 (suggested) | Compatibility matrix CI + `docs/COMPATIBILITY.md` table | S |
| #1019 (suggested) | GitHub issue / PR templates under `.github/ISSUE_TEMPLATE/` | S |
| #1019 (suggested) | Per-package perf budgets — mobile bundle, firmware flash %, core dist size | S |
| #1019 (suggested) | `git-cliff` per-package CHANGELOG auto-publish | S |
| #1019 (suggested) | `simple-git-hooks` + `lint-staged` pre-commit | S |
| #1020 (this issue's sibling) | New cross-package docs: `docs/ARCHITECTURE.md`, `HOW_TO_ADD_A_WIDGET.md`, `HOW_TO_ADD_AN_ECU.md`, `RELEASE.md` | M |

**Order of operations.** Templates + pre-commit hooks first (zero risk,
high signal). The compatibility matrix CI is the natural follow-up to
A-COMPAT-3 (Theme 1) — same machinery, different gate. End-to-end
contract test waits on A-COMPAT-3 land first because it needs the
generated caps header to anchor expectations.

---

## Theme 6 — Headless firmware renderer (the "if we could only do one thing")

Single largest-leverage change in the audit. Out of band from the other
themes because it collapses every visual contract — preview accuracy,
theme editor, font support, ECU-agnostic widgets — into one golden-image
test surface.

| Issue | Scope | Effort |
|-------|-------|--------|
| #1019 A-COMPAT-6 | LVGL SDL backend, render PNG, golden-image diff in CI. Closes #957 structurally and unblocks #21 (theme editor), #971 (custom fonts), #526 (token migration). | L |
| #1019 SPIFFS asset manifest | Asset manifest enables #971 (font) and #21 (theme) once Theme 6 lands | M |
| #1019 `TrackSession` first-class in core | For #815 — natural follow-up once the renderer can verify the track-mode UI variants | S |

**Order of operations.** Standalone L-class effort. Recommended to land
after Theme 1's A-COMPAT-3 (codegen caps) so the SDL build doesn't drift
from the real device caps. SPIFFS asset manifest is a follow-up that only
becomes useful once the renderer exists.

---

## Cross-theme dependency graph

```
  Theme 1 (wire contract) ──────────► Theme 5 (CI gates depend on codegen)
        │                                  │
        │                                  ▼
        │                            Theme 6 (renderer uses caps)
        ▼
  Theme 2 (firmware hardening) ─► standalone, ship in parallel
        │
        ▼
  Theme 3 (studio consolidation) ─► standalone
        │
        ▼
  Theme 4 (mobile resilience)    ─► gated on mobile active scope returning
```

Pick **A-COMPAT-2** + **A-COMPAT-1** + **F-HI-7** as the first three
landings. That validates the wire-contract approach end-to-end and gives
the firmware a real error screen for the failure modes the rest of the
work will surface.
