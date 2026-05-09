// export-sensor-defaults.ts — emit SENSOR_DEFAULT_RAMPS as canonical JSON.
//
// One-shot script run by `npm run export:sensor-defaults`. Output is the
// fixture consumed by the firmware native test (parity guard between TS and
// C++ tables, issue #430). The JSON is sorted by SensorKind name so a diff
// line up cleanly.

import { SENSOR_DEFAULT_RAMPS } from '../dist/sensorDefaults.js'

const sorted = Object.fromEntries(
  Object.entries(SENSOR_DEFAULT_RAMPS).sort(([a], [b]) => a.localeCompare(b))
)

process.stdout.write(JSON.stringify(sorted, null, 2) + '\n')
