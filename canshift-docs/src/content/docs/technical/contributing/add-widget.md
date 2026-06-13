---
title: "Add a new dashboard widget"
description: "Implement a new LVGL widget end-to-end — config schema, renderer, factory wiring."
sidebar:
  order: 6
---

> 🚨 **Pre-#1351.** "studio editor surface" below means [`canshift-tuner`](../canshift-tuner/) now — the file paths under `canshift-studio-web/` should be read as the matching files in `canshift-tuner/src/components/editor/`. The schema + firmware steps are unchanged. See [`#1351`](https://github.com/tburkhalterr/CANShift/issues/1351).

How to introduce a brand-new widget type (e.g. `tacho_arc`, `lap_delta`,
`bar_graph_dual`) across the three packages it has to land in: schema,
firmware renderer, and studio editor surface.

Follow-up of [#1020](https://github.com/tburkhalterr/CANShift/issues/1020).
Defer to the existing 8 implementations as primary reference — this doc only
spells out the contract between packages and the touch-points each new
widget must hit.

---

## 0. Overview

A "widget" in CANShift is a single piece of on-screen data: a gauge, a
warning lamp, a tap button, a numeric label, a bar. It exists in three
places at once:

1. **`canshift-core`** owns the Zod schema for its config block. Every
   consumer reads the same shape (firmware, studio-web, mobile).
2. **`canshift-firmware`** has the LVGL renderer that turns the config
   block into pixels on the dash, plus the per-frame update tick.
3. **`canshift-studio-web`** has the editor UI (palette tile + property
   panel) and the canvas preview rendering.

Adding a new type means visiting all three packages plus their tests. None
of the steps are optional — TypeScript exhaustiveness checks (the
`RENDERERS` map in `WidgetPreview.tsx`) and the firmware factory switch
will catch most misses, but the schema is the gating contract.

The existing 8 widgets are the reference catalogue:

| Type | Firmware files | Schema | Studio fields |
|---|---|---|---|
| `gauge` (3 sub-styles) | `gauge_widget.{h,cpp}` | `GaugeWidgetConfigSchema` | `gauge-fields.tsx` |
| `bar` | `bar_widget.{h,cpp}` | `BarWidgetConfigSchema` | `bar-fields.tsx` |
| `warning` | `warning_widget.{h,cpp}` | `WarningWidgetConfigSchema` | `warning-fields.tsx` |
| `button` | `button_widget.{h,cpp}` | `ButtonWidgetConfigSchema` | `button-fields.tsx` |
| `timer` | `timer_widget.{h,cpp}` | `TimerWidgetConfigSchema` | `timer-fields.tsx` |
| `gear` | `gear_widget.{h,cpp}` | `GearWidgetConfigSchema` | `gear-fields.tsx` |
| `image` | `image_widget.{h,cpp}` | `ImageWidgetConfigSchema` | `image-fields.tsx` |
| `label` | `label_widget.{h,cpp}` | — (legacy, no studio editor) | — |

Pick the closest existing implementation and mirror it. `bar` is the
canonical "numeric signal with min/max + threshold" widget; `warning` is
the canonical "binary signal" widget; `button` is the canonical "no
signal, runs an action" widget.

---

## Step 1 — Schema (`canshift-core`)

The discriminated union lives in
[`canshift-core/src/schemas/dashboard.ts`](../canshift-core/src/schemas/dashboard.ts).

### 1.1 Add the per-type config schema

Define a strict `z.object({...}).strict()` with a `type: z.literal('<name>')`
discriminant and every widget-specific field. Reuse the shared helpers
already in the file:

- `WidgetLabelPositionSchema` for `labelPosition` (top/bottom × left/center/right)
- `SensorIconNameSchema` for `iconName` (drives the two-zone palette, [#954](https://github.com/tburkhalterr/CANShift/issues/954))
- `DECIMAL_PLACES.MIN`/`.MAX` for `decimalPlaces`
- `ColorRampSchema` if the widget needs a per-signal gradient ([#430](https://github.com/tburkhalterr/CANShift/issues/430))

Keep field names in `camelCase` — the wire-format JSON snake_case
conversion lives at the boundary, not in the schema.

### 1.2 Wire it into the union

Add the schema to `WidgetConfigSchema` in `dashboard.ts` (see the array
literal around line 294). The derived `WidgetTypeSchema` enum updates
automatically — it reads from `WidgetConfigSchema.options`, so the
discriminant string only needs to be declared once.

Export the inferred type alongside the schema:

```ts
export type FooWidgetConfig = ExactOptional<z.infer<typeof FooWidgetConfigSchema>>
```

and add it to the `WidgetConfig` union type alias near the bottom of the
file.

### 1.3 Cross-field invariants (optional)

If the widget has relationships between fields (e.g. gauge's
`minValue < maxValue`), add them in the `.superRefine()` block on
`WidgetSchema` — see the existing branches for the pattern. Schema-level
checks beat runtime checks in every consumer.

### 1.4 Schema tests

Add tests to `canshift-core/src/__tests__/schemas.test.ts`. Cover:

- Valid config parses
- Missing required fields rejected
- Extra fields rejected (`.strict()` enforces this)
- Cross-field invariants rejected

Run with `npm test` inside `canshift-core/`.

### 1.5 Migrations

If you renamed or removed a field on an existing widget, write a migration
in `canshift-core/src/migrations/`. New widget types do not need a
migration — old configs simply do not contain them. See
[`migration-runner.ts`](../canshift-core/src/migrations/migration-runner.ts)
and the `migrations/v*.ts` files for the pattern.

---

## Step 2 — Firmware renderer (`canshift-firmware`)

The firmware lives in `canshift-firmware/src/ui/widgets/`. Every widget
has the same 6-touch-point layout:

1. New files `<name>_widget.h` + `<name>_widget.cpp` under `src/ui/widgets/`
2. Enum entry in `WidgetType` (`src/config/config_types.h`)
3. String → enum row in `parseWidgetType()` (`src/config/config_loader.cpp`)
4. Config struct + parser if the widget needs typed runtime state (`config_types.h` + `config_loader.cpp`)
5. Dispatch entry in `widget_factory.cpp` (both `create()` and `updateWidget()`)
6. `pio run -t format` before committing — clang-format CI gate is enforced

### 2.1 Header

Mirror [`bar_widget.h`](../canshift-firmware/src/ui/widgets/bar_widget.h):

```cpp
namespace FooWidget {
lv_obj_t *create(lv_obj_t *parent, const CfgWidget &cfg, int16_t yOffset);
void update(lv_obj_t *obj, float value, bool valid, const CfgWidget &cfg);
} // namespace FooWidget
```

Static-only namespace, no classes. Stateless from the outside — per-widget
state lives in the Tag struct attached via `lv_obj_set_user_data`.

### 2.2 Implementation

Mirror [`bar_widget.cpp`](../canshift-firmware/src/ui/widgets/bar_widget.cpp).
The non-negotiable pieces:

- **Tag struct** in an anonymous namespace, holding every nullable child
  LVGL pointer, every cached layout value, and every "last painted"
  guard variable. Keep it under 192 bytes (`WidgetTagPool::kSlotBytes` —
  see [§ pitfalls](#common-pitfalls)).
- **Allocate the Tag** via `WidgetTagPool::alloc<FooTag>()`. Never `new`,
  never `malloc`. Pool exhaustion returns `nullptr`; log and bail.
- **Attach the deleter** so the slot is released on widget teardown:
  ```cpp
  lv_obj_add_event_cb(cont, WidgetTagPool::deleteHandler<FooTag>,
                      LV_EVENT_DELETE, tag);
  ```
- **`WidgetHelpers::initContainer()`** creates the outer container with
  the right size/position/border. Use it.
- **No string class.** Fixed `char[N]` + `snprintf`/`strlcpy` only —
  CLAUDE.md rule.
- **No magic numbers.** Promote pixel ratios to `static constexpr` at the
  top of the anonymous namespace. See the `TRACK_H_RATIO` block in
  `bar_widget.cpp` for the convention.
- **Function length cap ~40 lines.** If `create()` grows past that, split
  into phase helpers like `bar_widget.cpp` did in
  [#1125](https://github.com/tburkhalterr/CANShift/issues/1125).
- **`update()` must be cheap.** Guard against redundant LVGL calls by
  caching the last value / last fill colour on the Tag — every widget
  re-renders once per frame and every redundant `lv_obj_set_style_*` is
  a UI mutex round-trip. See `BarWidget::update` for the cache-then-paint
  pattern.

### 2.3 Enum + parser

Add the new entry to `WidgetType` in
[`config_types.h`](../canshift-firmware/src/config/config_types.h) (around
line 61) and the matching `strcmp` arm in
[`parseWidgetType`](../canshift-firmware/src/config/config_loader.cpp)
(around line 514). The string must match the Zod literal exactly.

### 2.4 Factory dispatch

In [`widget_factory.cpp`](../canshift-firmware/src/ui/widget_factory.cpp):

- Add a `case WidgetType::FOO:` to the `switch` in `WidgetFactory::create()`
  that calls a thin `createFoo()` adapter.
- Add a `case WidgetType::FOO:` to `updateWidget()` that calls
  `FooWidget::update(...)`. If the widget has no per-tick value (static
  image, button badge driven by a different signal), follow `IMAGE` or
  `BUTTON`'s pattern instead.

### 2.5 Native tests (optional)

`canshift-firmware/test/native/` runs pure-C++ tests via the PlatformIO
native runner. Widgets that touch LVGL are hard to unit-test, but pure
helpers (value scaling, range clamping, label formatting) can be
exercised here. See `test_can_parser/` for the layout. If you don't add
tests, document the manual on-device verification steps in the PR body.

---

## Step 3 — Studio editor surface (`canshift-studio-web`)

Three files; all under `canshift-studio-web/src/components/editor/`.

### 3.1 Palette tile

[`WidgetPalette.tsx`](../canshift-studio-web/src/components/editor/WidgetPalette.tsx) —
add an entry to `PALETTE_ITEMS` (around line 33) with default size token,
icon, and default signal. Add a matching `case '<name>':` to the
`baseConfig` builder around line 106 that returns the initial config
block. The `type` literal must match the Zod discriminant.

### 3.2 Property-panel fields

Create `property-panel/<name>-fields.tsx` mirroring
[`bar-fields.tsx`](../canshift-studio-web/src/components/editor/property-panel/bar-fields.tsx).
The contract:

- Export a component with the `ConfigFieldsProps` signature from
  `./shared`.
- Narrow `widget.config.type === '<name>'` once at the top, bail with
  `return null` otherwise — TypeScript narrows the rest of the function.
- Mutate config by spreading `cfg`, applying the change, and calling
  `onChange({ config: next })`. Never mutate the live store value.
- Reuse `Field`, `Row`, `inputStyle`, `IconPicker`, `ALL_UNITS` from
  `./shared` — do not import direct hex literals.

Then wire the component into
[`PropertyPanel.tsx`](../canshift-studio-web/src/components/editor/PropertyPanel.tsx)
by adding it to `CONFIG_FIELDS` (around line 52). The map is typed
against `WidgetType`, so a missing key fails typecheck.

### 3.3 Canvas preview

[`WidgetPreview.tsx`](../canshift-studio-web/src/components/editor/WidgetPreview.tsx)
holds the SVG/HTML renderer for the canvas. Add a `memo`'d
`FooPreview` component (mirror `BarWidgetPreview` for a numeric widget or
`WarningPreview` for a binary one). Then add the renderer to the
`RENDERERS` map (around line 1449). The map is typed as
`Record<WidgetTypeKey, ...>` — TypeScript will refuse to compile if any
type is missing.

If the preview reads `cfg.suffix` as a manual unit override, also extend
`useResolvedSignalUnit` (around line 1517) so the new type's suffix
participates in the resolution.

### 3.4 Preview tests

`canshift-studio-web` uses Vitest. Add a small render-without-crash test
under the same colocation pattern as
`src/transport/__tests__/ws-client.test.ts` — supply a minimal `Widget`
and assert the renderer returns a non-null element across valid +
invalid signal states.

---

## Step 4 — Documentation

If the widget is user-facing (most are), surface it in:

- `docs/README.md` index (only when it changes top-level capability — a
  new gauge sub-style does not need a mention; a new "lap delta" widget
  does).
- Studio user-facing copy in `canshift-studio-web/src/copy/` if you have
  any hint text or empty-state strings to add.

Do not duplicate code snippets in docs — link to the schema and the
reference widget instead. Snippets rot.

---

## Common pitfalls

### LVGL mutex contract

Every `lv_*` call must run on the UI task or under `lv_lock()`/`lv_unlock()`.
The factory `create()` and `update()` paths already run from the LVGL
task, so widgets do not lock themselves — but if you spawn a FreeRTOS
task that mutates a widget you must take the lock.

### Tag pool budget

`WidgetTagPool::kSlotBytes` (currently 192) caps every Tag struct.
`static_assert(sizeof(T) <= kSlotBytes)` inside `alloc<T>()` will fail
the build if you cross the line. Either trim fields (most cached values
are `uint8_t`/`int16_t`, not `int`/`float` — pack accordingly) or bump
the constant in
[`widget_tag_pool.h`](../canshift-firmware/src/ui/widgets/widget_tag_pool.h)
and accept the BSS cost.

### Never `new`/`delete`

CLAUDE.md is explicit: no dynamic allocation in hot paths. The Tag pool
exists specifically to satisfy this rule for widgets. If you find
yourself reaching for `new` to allocate per-widget state, the answer is
"add a field to the Tag struct" or "extend the pool". The previous
per-type pool approach traded ~8 KB of BSS for the convenience and was
rolled back in [#1031](https://github.com/tburkhalterr/CANShift/issues/1031).

### Discriminated union exhaustiveness

Every consumer of `WidgetConfig` narrows on `config.type`. If you forget
one, TypeScript may still pass — the `unknown`-case branch silently
discards the new variant. Search the repo for the existing 7 variant
strings (`'gauge'`, `'bar'`, `'warning'`, `'button'`, `'timer'`, `'gear'`,
`'image'`) and confirm every site has been updated. The
`useResolvedSignalUnit` hook is the most-frequently-missed touchpoint.

### Firmware string ↔ schema literal must match

Zod literal, palette `case`, `parseWidgetType` strcmp, and the firmware
`WidgetType` enum must all use the same exact string. Mismatch = silent
`WidgetType::UNKNOWN` and a missing widget on the dash with only a
`LOG_WARN` to debug from.

### Suffix / unit resolution

Numeric widgets follow a two-stage unit resolution: the widget config's
`suffix` (manual override) wins, otherwise the bound signal's `unit`
field (signals.json) is used. Both firmware
(`WidgetHelpers::resolveDisplayUnit`) and studio
(`useResolvedSignalUnit`) implement this. If your widget shows a unit
string, route through these helpers — do not invent a new lookup path.

---

## Reference implementations

In order of complexity:

- **Simplest**: `image_widget.{h,cpp}` + `image-fields.tsx` — no signal
  binding, no per-frame update, no thresholds.
- **Binary signal**: `warning_widget.{h,cpp}` + `warning-fields.tsx` —
  one signal, one threshold, blink-on-active.
- **Numeric with thresholds**: `bar_widget.{h,cpp}` + `bar-fields.tsx` —
  full template for any new "show this signal as a shape" widget.
- **Action widget (no signal)**: `button_widget.{h,cpp}` +
  `button-fields.tsx` — discriminated `ButtonAction` union; mirror this
  when adding a widget that runs commands rather than reading values.
- **Multi-sub-style**: `gauge_widget.{h,cpp}` + `gauge-fields.tsx` — when
  a single Zod variant has multiple visual modes (arc / bar / numeric),
  use the inner `displayStyle` enum pattern instead of three schema
  variants.

---

## Related

- [`docs/config-contract.md`](config-contract.md) — JSON config shape
- [`docs/overall-architecture.md`](overall-architecture.md) — package boundaries
- [`canshift-firmware/README.md`](../canshift-firmware/README.md) — firmware package overview
- [`canshift-core/README.md`](../canshift-core/README.md) — core package overview
