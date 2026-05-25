// DemoFallbackBanner.tsx — Two states:
//
//  1. Initial demo (loadedFromDemoFallback && !pendingDeviceConfig):
//     Device had no config → studio auto-loaded the default. Banner tells the
//     user to edit and burn to deploy. Dismissible for the session.
//
//  2. Post-recovery swap (loadedFromDemoFallback && pendingDeviceConfig):
//     A later device probe returned a real config while the editor still shows
//     the auto-loaded demo (issue #418). Offer to swap in or keep editing.

import { useDashboardStore } from '../../stores/dashboard.store'
import { useLogStore } from '../../stores/log.store'

// Success-chrome palette — `--success` (#00CC2A) is too saturated for a
// sustained banner background. Hoisted as MIRROR consts per audit S-H-5
// (umbrella #1015) so a future token promotion is a single-line swap.
const OK_BG = '#0F1A14' // MIRROR: deep green banner background
const OK_BORDER = '#2A6A3F' // MIRROR: dim green border + accept button bg
const OK_TEXT = '#A8D0B5' // MIRROR: green body text
const OK_BTN_BORDER = '#355541' // MIRROR: darker green for dismiss button border
const OK_BTN_TEXT = '#88AA99' // MIRROR: dismiss button label
const BANNER_SHADOW = '0 4px 16px rgba(0,0,0,0.6)' // MIRROR: drop shadow overlay (no alpha token yet)

export default function DemoFallbackBanner() {
  const pendingDeviceConfig = useDashboardStore((s) => s.pendingDeviceConfig)
  const loadedFromDemoFallback = useDashboardStore((s) => s.loadedFromDemoFallback)
  const acceptPendingDeviceConfig = useDashboardStore((s) => s.acceptPendingDeviceConfig)
  const dismissPendingDeviceConfig = useDashboardStore((s) => s.dismissPendingDeviceConfig)
  const clearDemoFallback = useDashboardStore((s) => s.clearDemoFallback)
  const log = useLogStore((s) => s.push)

  if (!loadedFromDemoFallback) return null

  const handleAccept = () => {
    acceptPendingDeviceConfig()
    log('success', 'Loaded dashboard config from device SD')
  }

  const handleDismiss = () => {
    dismissPendingDeviceConfig()
    log('info', 'Kept the demo dashboard — device config ignored for this session')
  }

  const handleClear = () => {
    clearDemoFallback()
  }

  // State 1 — initial demo, no real config available yet
  if (!pendingDeviceConfig) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 32,
          left: 16,
          zIndex: 9997,
          background: OK_BG,
          border: `1px solid ${OK_BORDER}`,
          borderRadius: 6,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          color: OK_TEXT,
          maxWidth: 460,
          boxShadow: BANNER_SHADOW,
        }}
      >
        <span>No config on device — showing default. Edit and burn to deploy.</span>
        <button
          onClick={handleClear}
          style={{
            padding: '3px 8px',
            background: 'transparent',
            border: `1px solid ${OK_BTN_BORDER}`,
            borderRadius: 3,
            color: OK_BTN_TEXT,
            fontSize: 11,
            cursor: 'pointer',
          }}
          title="Dismiss this notice"
        >
          Dismiss
        </button>
      </div>
    )
  }

  // State 2 — real config staged behind the demo fallback prompt
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 32,
        left: 16,
        zIndex: 9997,
        background: OK_BG,
        border: `1px solid ${OK_BORDER}`,
        borderRadius: 6,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        color: OK_TEXT,
        maxWidth: 460,
        boxShadow: BANNER_SHADOW,
      }}
    >
      <span>Device has a saved config — swap it in and replace the demo?</span>
      <button
        onClick={handleAccept}
        style={{
          padding: '4px 10px',
          background: OK_BORDER,
          border: `1px solid ${OK_BORDER}`,
          borderRadius: 3,
          color: 'hsl(var(--text))',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        Load device config
      </button>
      <button
        onClick={handleDismiss}
        style={{
          padding: '3px 8px',
          background: 'transparent',
          border: `1px solid ${OK_BTN_BORDER}`,
          borderRadius: 3,
          color: OK_BTN_TEXT,
          fontSize: 11,
          cursor: 'pointer',
        }}
        title="Keep editing the demo"
      >
        Keep demo
      </button>
    </div>
  )
}
