// CliReattachStub.tsx — Collapsed in-app placeholder shown while the CLI is
// detached into its own window (issue #433). A single "Re-attach" button
// closes the detached window, which broadcasts `CLI_STATE_CHANGED` and flips
// the surface back to `<CliTerminal />` automatically.

import { useCallback, type ReactElement } from 'react'

interface CliReattachStubProps {
  onReattach: () => Promise<void>
}

export default function CliReattachStub({ onReattach }: CliReattachStubProps): ReactElement {
  const handleClick = useCallback((): void => {
    void onReattach()
  }, [onReattach])

  return (
    <div
      role="region"
      aria-label="CLI panel — detached"
      style={{
        height: 36,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        background: '#0A0A0A',
        borderTop: '1px solid #222222',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: '#666666',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        CLI detached
      </span>
      <button
        type="button"
        onClick={handleClick}
        style={{
          background: 'transparent',
          color: '#AAAAAA',
          border: '1px solid #333333',
          borderRadius: 3,
          padding: '3px 10px',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Re-attach
      </button>
    </div>
  )
}
