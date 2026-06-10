const CURATED_LABELS: Record<string, string> = {
  rpm: 'RPM',
  speed_kph: 'SPEED',
  coolant_temp_c: 'COOLANT',
  oil_temp_c: 'OIL',
  oil_press_bar: 'OIL',
  fuel_press_bar: 'FUEL',
  map_kpa: 'MAP',
  boost_bar: 'BOOST',
  throttle_pos: 'TPS',
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

export const displayLabelForSignal = (signal: string): string => {
  if (!signal) return '—'
  return CURATED_LABELS[signal] ?? signal.replace(/_+/g, ' ').toUpperCase().trim()
}
