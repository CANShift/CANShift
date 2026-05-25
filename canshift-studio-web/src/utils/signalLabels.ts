// signalLabels.ts — Curated short display labels for known signals.
//
// Used by the widget previews to label widgets that don't have a custom
// `cfg.label` set. Keeps the 80-px-wide small numeric cells from clipping
// (auto-formatted "COOLANT TEMP C" overflows; the curated "COOLANT" fits).
//
// Keep in sync with the firmware copy in
// `canshift-firmware/src/ui/widget_label.h` (`displayLabelForSignal`).

const CURATED_LABELS: Record<string, string> = {
  rpm: 'RPM',
  speed_kph: 'SPEED',
  coolant_temp_c: 'COOLANT',
  oil_temp_c: 'OIL TEMP',
  oil_press_bar: 'OIL PRESS',
  boost_bar: 'BOOST',
  throttle_pos: 'THROTTLE',
  gear: 'GEAR',
  afr_1: 'AFR',
  lambda_1: 'LAMBDA',
  iat_c: 'IAT',
  battery_volts: 'BATT',
  flag_mil: 'MIL',
  flag_anti_lag: 'ALS',
  flag_launch_ctrl: 'LAUNCH',
  flag_traction_cut: 'TC',
  flag_flat_shift: 'FLAT SHIFT',
}

/**
 * Returns a short, dashboard-friendly label for `signal`.
 * Falls back to a simple uppercase / underscore-to-space transform when the
 * signal is not in the curated dictionary.
 */
export function displayLabelForSignal(signal: string): string {
  if (!signal) return '—'
  const curated = CURATED_LABELS[signal]
  if (curated) return curated
  return signal.replace(/_+/g, ' ').toUpperCase().trim()
}
