// dayNightToggle.ts — Pure day/night toggle policy for the canvas preview.
//
// Factored out of Canvas.tsx so the contract can be unit-tested without
// rendering the editor surface. Mirrors the firmware behaviour: a click on
// the top-bar theme icon must repaint the preview in the new mode the same
// way `ThemeManager::toggleDayMode()` + `PageManager::requestRebuild()` do
// on-device. The bug fixed in issue #957 was that the studio used to send
// the USB command but never updated the local mirror, leaving the preview
// frozen on the previous mode until a manual reconnect probe.

/**
 * Outcome describing what the caller should do after invoking the toggle.
 * `connected` triggers a USB round-trip + optimistic device-store mirror.
 * `offline` flips the studio-only preview flag.
 */
export type DayNightToggleAction = { kind: 'connected'; next: boolean } | { kind: 'offline' }

/**
 * Decide which side of the day/night fork to take.
 * - `deviceIsDayMode === null` → no live device → toggle the local preview.
 * - otherwise → flip the device's current mode and round-trip it via USB.
 */
export function decideDayNightAction(deviceIsDayMode: boolean | null): DayNightToggleAction {
  if (deviceIsDayMode === null) return { kind: 'offline' }
  return { kind: 'connected', next: !deviceIsDayMode }
}
