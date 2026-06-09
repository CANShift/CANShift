# NativeWind v4 pin vs v5 migration — decision for SDK 53

Tracking issue: [#438](https://github.com/tburkhalterr/CANShift/issues/438).
Parent umbrella: [#390](https://github.com/tburkhalterr/CANShift/issues/390) /
`docs/mobile-sdk-upgrade.md`.

Status: **decided**. See [§4 Recommendation](#4-recommendation).

This document supersedes the soft v5 lean recorded in `mobile-sdk-upgrade.md`
§3 (which explicitly defers the final call to this sub-issue).

## 1. Current state

`canshift-mobile` on Expo SDK 52:

| Item | Value |
|---|---|
| `nativewind` | `^4.1.23` |
| `tailwindcss` | `^3.4.19` (dev) |
| `tailwindcss-animate` | `^1.0.7` (dev) |
| `react-native-reanimated` | `~3.16.1` |
| `react-native` | `0.76.9` |
| `react` | `18.3.1` |
| `expo` | `~52.0.0` |

Wiring that v5 would have to replace:

- `canshift-mobile/babel.config.js` — presets are
  `[babel-preset-expo, { jsxImportSource: 'nativewind' }]` + `nativewind/babel`.
- `canshift-mobile/metro.config.js` — wraps the Expo config with
  `withNativeWind(config, { input: './global.css' })` from `nativewind/metro`.
- `canshift-mobile/tailwind.config.ts` — extends `nativewind/preset` and pulls
  19 design-token colors from `src/theme` plus `tailwindcss-animate` plugin.
- `canshift-mobile/global.css` — three `@tailwind` directives only.

Surface that must keep working after the migration:

- **16 files** in `src/` import `cva(` from `class-variance-authority`.
- **13 files** call `cn(` (the `clsx + twMerge` helper in `src/lib/utils.ts`).
- **~61 `className=` occurrences** spread across the screens, navigation
  shell, and the `src/components/ui/*` shadcn-style primitives
  (`button`, `card`, `input`, `sheet`, plus 10+ others).

Build is green on SDK 52 with this setup. No first-party Reanimated 4
dependency is in flight or planned in the next 6 months (umbrella plan §3
already records this and pins `react-native-reanimated@3.17.4` for the SDK 53
umbrella PR via sub-issue [#437](https://github.com/tburkhalterr/CANShift/issues/437)).

## 2. The two paths

### Path A — pin `nativewind@4.1.23`

- Keep babel, metro, tailwind, and global.css exactly as they are.
- Move the `nativewind` entry in `canshift-mobile/package.json` from
  `^4.1.23` to an exact pin (`4.1.23`, no caret) so npm/yarn cannot float
  forward to the broken `4.2.0` on the next install.
- No source-code changes anywhere in `src/`.
- All 16 `cva` consumers and all 61 `className` sites keep working as-is.

**Known limitation**: blocks moving to Reanimated 4 (v4.1.x targets
Reanimated 3's worklets runtime). Likely needs to be revisited before SDK 54
removes the `react-native-worklets/plugin` shim from the default template.

### Path B — migrate to `nativewind@^5`

- Bump `nativewind` to the latest 5.x.
- Babel: drop `nativewind/babel` from `presets` (v5 no longer ships a
  babel plugin; the JSX import source still comes from `babel-preset-expo`'s
  `jsxImportSource` option, but the wiring is different — see the
  expo-tailwind-setup skill notes).
- Metro: `withNativeWind` API changes (v5 expects `react-native-css` to be
  paired with it; the `input` option semantics shift toward a CSS-first
  config instead of `tailwind.config.ts`).
- Tailwind config: v5 prefers Tailwind v4 + CSS variables. Our current
  `tailwind.config.ts` with `nativewind/preset` and the 19 color tokens
  from `src/theme` would need to either move to a Tailwind v4 CSS-first
  config or be retained via a compatibility path (uncertain — needs spike).
- TypeScript: `className` typing on RN components changes; the
  ambient declaration shape is different. Existing typed components
  (`button.tsx` et al.) and the `cn()` helper must be re-verified.
- `cva` + `tailwind-merge` patterns are documented as still working on v5,
  but the only way to confirm zero-regression on our 16 `cva` files plus
  61 `className` sites is a real spike against a SDK 53 prebuild.

**Known upside**: forward-compatible with Reanimated 4, aligned with the
trajectory the Expo team and `react-native-css` author are recommending for
SDK 53+, and survives SDK 54 without another migration.

## 3. Trade-off table

| Axis | Path A (pin v4.1.23) | Path B (migrate to v5) |
|---|---|---|
| **Effort now** | ~15 minutes (one `package.json` edit + lockfile) | 1–2 days (babel + metro + tailwind config + typing + verify 16 cva + 61 className sites) |
| **Source diff** | Zero changes in `src/` | Probable changes to typing, possibly to `cn()` helper, and to any `cva` call using a v4-only utility |
| **Risk of visual regression** | None | Real — only catchable by manual smoke on every screen |
| **Runtime cost** | Same as today (Reanimated 3 worklets) | Same target runtime — v5 doesn't add overhead, but the migration spike could surface a perf regression |
| **Reanimated 4 compat** | Blocked | Unblocked |
| **Reanimated 4 actually needed in next 6 months?** | No (umbrella plan §3) | No (same) |
| **Survives SDK 54?** | Unlikely — v4.1.x dead-end is real | Yes |
| **Blast radius if it goes wrong** | Zero — same code as SDK 52 | Whole styling surface of the app |
| **Coupling with the SDK 53 umbrella PR** | Independent — pin can land before, with, or after the umbrella PR | Must land *before* the umbrella PR per `mobile-sdk-upgrade.md` §5 step 3 |
| **Decision reversibility** | Easy — bump to v5 later as its own PR | Hard — rolling back means another full migration sweep |

## 4. Recommendation

**Pick Path A — pin `nativewind` to exactly `4.1.23` for the SDK 53 release,
and file a follow-up to migrate to v5 before SDK 54.**

Rationale, in order of weight:

1. **No Reanimated 4 need in the next 6 months.** The umbrella plan §3
   states this explicitly. The single concrete benefit of v5 today
   (Reanimated 4 readiness) does not buy us anything in the current
   roadmap window.
2. **Smaller blast radius for the SDK 53 release.** The SDK 53 umbrella PR
   already carries: React 19, RN 0.79, the New Architecture decision
   ([#441](https://github.com/tburkhalterr/CANShift/issues/441), default-off),
   a hardware-gated BLE spike ([#440](https://github.com/tburkhalterr/CANShift/issues/440)),
   an `expo-file-system` re-validation (#386 / #401 postmortem), and the
   `withGlogFmtFix` re-evaluation ([#439](https://github.com/tburkhalterr/CANShift/issues/439)).
   Adding a same-PR styling-engine migration on top of that — touching
   13 files and 61 call sites — multiplies the failure modes of an already
   tense release. A pin-only change has zero source-code surface and zero
   styling regression risk.
3. **v4.1.23 is known-good on SDK 53.** The umbrella plan §3 calls out that
   only `4.2.0` is broken (missing `react-native-worklets/plugin`). Pinning
   below the break is a real, documented, reversible workaround.
4. **The migration cost is "one-time" — but the cost doesn't change if we
   defer.** Postponing v5 by one SDK cycle costs us nothing because
   Reanimated 3 baggage doesn't accumulate from our side (we don't author
   Reanimated worklets directly; usage is transitive through React
   Navigation). The umbrella plan §3 worry about "incompatible Reanimated 3
   baggage" applies to projects that ship custom worklets — we don't.
5. **Decoupling improves SDK 53 schedule confidence.** Path A lets the
   umbrella PR land without waiting on a separate v5 PR. Path B's
   sequencing (v5 sub-PR *before* the umbrella) adds a serialization point
   that costs calendar time if anything regresses in the v5 migration.

This call deliberately overrides the soft v5 lean in
`mobile-sdk-upgrade.md` §3. That section explicitly defers the final call
to issue #438; this is that call. The umbrella plan §3 wording should be
updated in a follow-up edit to point at this doc as the authoritative
decision.

## 5. Concrete next steps (Path A)

In the SDK 53 umbrella PR (sub-issue [#436](https://github.com/tburkhalterr/CANShift/issues/436)),
not in a standalone PR:

1. Edit `canshift-mobile/package.json` — change `"nativewind": "^4.1.23"`
   to `"nativewind": "4.1.23"` (drop the caret, exact pin only).
2. Refresh the lockfile so the resolved version is `4.1.23` exactly.
   Confirm with `npm ls nativewind` post-install.
3. Confirm `nativewind/preset`, `nativewind/babel`, and
   `nativewind/metro` imports in `tailwind.config.ts`, `babel.config.js`,
   and `metro.config.js` still resolve against `4.1.23` after the SDK 53
   `expo install --fix` pass.
4. Smoke test on a real iPhone build: verify the home screen, BLE settings
   form, OTA screen, and at least one screen using each `cva` primitive
   (`Button`, `Card`, `Input`, `Sheet`) render with no visible drift from
   the SDK 52 build.
5. Add a short comment above the `nativewind` line in `package.json` noting
   that `4.2.0` is intentionally avoided on SDK 53 (missing
   `react-native-worklets/plugin`) and pointing at this doc.

### Follow-up — file a new sub-issue for the v5 migration

Title: *chore(mobile): migrate NativeWind v4 → v5 before SDK 54*.

Body should require:

- Standalone PR, **not** combined with any other dep upgrade.
- Spike first: green prebuild against SDK 53 + v5 on a feature branch
  before opening the PR — confirms babel, metro, tailwind, and typing
  changes are scoped.
- Visual smoke pass on every screen using a `cva` primitive.
- Lands **before** the SDK 54 umbrella PR opens so the v5 migration is
  never bundled with another major SDK bump.

This follow-up is the explicit hedge against v4.1.x dead-ending on SDK 54.

## 6. What this decision does *not* commit to

- It does not block a future v5 migration — Path A is explicitly reversible.
- It does not say "v5 is bad" — v5 is the right destination, just not in
  the same PR as the SDK 53 runtime bump.
- It does not change the Reanimated 3.17.4 pin from
  [#437](https://github.com/tburkhalterr/CANShift/issues/437); that pin
  stands.
- It does not affect the New Architecture default from
  [#441](https://github.com/tburkhalterr/CANShift/issues/441); NA-off
  remains the recommendation regardless of which NativeWind version ships.
