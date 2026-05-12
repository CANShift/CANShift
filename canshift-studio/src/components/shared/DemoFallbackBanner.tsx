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
          background: '#0F1A14',
          border: '1px solid #2A6A3F',
          borderRadius: 6,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          color: '#A8D0B5',
          maxWidth: 460,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}
      >
        <span>No config on device — showing default. Edit and burn to deploy.</span>
        <button
          onClick={handleClear}
          style={{
            padding: '3px 8px',
            background: 'transparent',
            border: '1px solid #355541',
            borderRadius: 3,
            color: '#88AA99',
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
        background: '#0F1A14',
        border: '1px solid #2A6A3F',
        borderRadius: 6,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        color: '#A8D0B5',
        maxWidth: 460,
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
      }}
    >
      <span>Device has a saved config — swap it in and replace the demo?</span>
      <button
        onClick={handleAccept}
        style={{
          padding: '4px 10px',
          background: '#2A6A3F',
          border: '1px solid #2A6A3F',
          borderRadius: 3,
          color: '#FFFFFF',
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
          border: '1px solid #355541',
          borderRadius: 3,
          color: '#88AA99',
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
