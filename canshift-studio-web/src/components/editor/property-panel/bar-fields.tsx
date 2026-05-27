// property-panel/bar-fields.tsx — Editor for `bar` widgets.
//
// All per-widget chrome (label, unit, prefix, decimals, sensor icon picker)
// was dropped — the widget reads its unit from the bound signal definition,
// renders the signal name as an auto-header, and the palette resolves
// through the signal's `type` field (signalTypeOkColor in canshift-core).
// Nothing widget-specific remains to edit on bar widgets at the moment.

export function BarFields() {
  return null
}
