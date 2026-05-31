// widget-previews/shared.ts — Types and helpers shared across the extracted
// widget renderers in this folder. The shared surface is intentionally tiny:
// every renderer narrows its own `widget.config` discriminator and pulls only
// what it needs from `../widgetPreview.styles`.

import type { Widget } from '@tmbk/canshift-core'
import { displayLabelForSignal } from '../../../utils/signalLabels'

/**
 * Base props every widget renderer accepts. Renderers extend this with the
 * variant flags they care about (e.g. `active` for buttons, `danger` for
 * gauges). `widget.config.type` is narrowed inside each renderer body.
 */
export interface BaseRendererProps {
  widget: Widget
  w: number
  h: number
}

/**
 * Delegated to the shared dictionary so curated short labels (e.g. COOLANT
 * rather than COOLANT TEMP C) are used everywhere — keeps studio in sync
 * with firmware's `displayLabelForSignal()`.
 */
export function formatSignalLabel(signal: string): string {
  return displayLabelForSignal(signal)
}
