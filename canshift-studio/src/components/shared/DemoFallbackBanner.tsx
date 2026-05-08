// DemoFallbackBanner.tsx — Non-blocking banner shown after a post-recovery
// device probe returns a real config while the editor is still showing the
// auto-loaded demo (issue #418). Two actions:
//   - Load device config: replaces the demo with the staged config.
//   - Keep demo:          discards the staged config; user keeps editing.
//
// The banner stays out of the modal stack so the user can keep working in
// the editor while it sits docked at the bottom-left.

import { useDashboardStore } from '../../stores/dashboard.store'
import { useLogStore } from '../../stores/log.store'

export default function DemoFallbackBanner() {
  const pendingDeviceConfig = useDashboardStore((s) => s.pendingDeviceConfig)
  const loadedFromDemoFallback = useDashboardStore((s) => s.loadedFromDemoFallback)
  const acceptPendingDeviceConfig = useDashboardStore((s) => s.acceptPendingDeviceConfig)
  const dismissPendingDeviceConfig = useDashboardStore((s) => s.dismissPendingDeviceConfig)
  const log = useLogStore((s) => s.push)

  if (!pendingDeviceConfig || !loadedFromDemoFallback) return null

  const handleAccept = () => {
    acceptPendingDeviceConfig()
    log('success', 'Loaded dashboard config from device SD')
  }

  const handleDismiss = () => {
    dismissPendingDeviceConfig()
    log('info', 'Kept the demo dashboard — device config ignored for this session')
  }

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
