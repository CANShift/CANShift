// canshift-core-shim.ts — Jest-only re-export for @tmbk/canshift-core.
//
// Mobile tests cannot import the full barrel because Zod's CJS interop
// path requires @babel/runtime helpers that aren't resolvable from outside
// the mobile node_modules tree. Instead this shim hand-picks the symbols
// the mobile unit tests actually exercise — DesignTokens + the sensor
// default ramps used by signal-colors.ts (#907).
//
// Update this when a mobile module starts importing something new from
// canshift-core; runtime production code keeps reading from the real
// barrel.

export * from '../../canshift-core/src/design-tokens'
export * from '../../canshift-core/src/sensor-defaults'
export * from '../../canshift-core/src/widget-metrics'
export * from '../../canshift-core/src/schemas/ble-status'
export * from '../../canshift-core/src/schemas/ble-timer'
export * from '../../canshift-core/src/schemas/track-telemetry'
export * from '../../canshift-core/src/types/releases'
