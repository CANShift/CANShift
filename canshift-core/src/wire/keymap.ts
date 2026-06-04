// wire/keymap.ts — Generic snake↔camel key renamer for boundary mappers.
//
// `DeviceConfig`, `InputBindingsConfig`, and `BleStatus` all reshape a
// flat object at the file/IPC/BLE boundary by renaming a handful of keys
// (e.g. `can_speed_kbps` ↔ `canSpeedKbps`). Before this helper each
// mapper hand-wrote the same pattern: spread the input, look at each
// optional field, set the renamed key on the output. Audit follow-up to
// #1207.
//
// The helper is intentionally narrow:
//   - Pure key rename only (no value transforms — `BleStatus` numeric
//     0/1 → boolean still happens at the call site, by design).
//   - Optional keys are dropped from the output if undefined, so the
//     existing strict-Zod schemas don't reject explicit `undefined`.
//   - Type-checked: `keyMap` must be exhaustive over the source keys
//     the caller wants to remap; unmapped keys are passed through
//     untouched.

/**
 * Rename a fixed set of keys on a flat object. Pure; preserves values
 * by reference. Keys absent on `source` are absent on the result —
 * matching the existing manual mappers (no `undefined` leakage into
 * the strict schemas).
 *
 * The `keyMap` lists every key on `source` that should land under a new
 * name on the result. Keys on `source` that are absent from `keyMap` are
 * passed through unchanged.
 */
export function mapObjectKeys<Source extends Record<string, unknown>>(
  source: Source,
  keyMap: Partial<Record<keyof Source, string>>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(source)) {
    const value = source[key]
    if (value === undefined) continue
    const renamed = (keyMap as Record<string, string | undefined>)[key]
    out[renamed ?? key] = value
  }
  return out
}
