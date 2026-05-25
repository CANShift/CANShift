// WelcomeModal.tsx — First-run onboarding modal.
//
// Shown once on the very first launch (or after Help → Reset First-Run
// Onboarding). Three local steps:
//   1. Welcome blurb + Get Started / Skip.
//   2. Connect the device (mounts <ConnectModal />) with an "I don't have a
//      device yet" simulation escape hatch.
//   3. Once connected, offer to burn the demo dashboard.
//
// Never auto-burns; never clobbers a connected device's editor — the modal
// stays on top of the regular UI but only nudges, never mutates without an
// explicit click.

import { useState } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useLogStore } from '../../stores/log.store'
import { useConfigActions } from '../../hooks/useConfigActions'
import ConnectModal from './ConnectModal'

// Modal chrome shades not yet mapped to core design tokens. Hoisted as MIRROR
// consts per audit S-H-5 (umbrella #1015) so a future token promotion is a
// single-line swap. `--text`, `--text-dim` and `--scrim` (since #1097) are
// already adopted inline below — these mirrors cover the remaining gap.
const DIALOG_BG = '#161616' // MIRROR: between --bg (#121212) and --surface (#1F1F1F)
const DIALOG_BORDER = '#2A2A2A' // MIRROR: ≈ --surface-2 (#292929)
const HEADER_BORDER = '#222222' // MIRROR: chrome divider, between --surface and --border
const TEXT_DIM_5 = '#888888' // MIRROR: header / ghost label
const TEXT_DIM_3 = '#AAAAAA' // MIRROR: close button (matches UpdateBanner BANNER_TEXT)
const TEXT_LIST = '#999999' // MIRROR: between --text-muted (#8F8F8F) and TEXT_DIM_3
const TEXT_SECONDARY = '#CCCCCC' // MIRROR: secondary button label
const PRIMARY_BTN_BG = '#CC3333' // MIRROR: dimmer red than --primary (#FF4747); matches ErrorBar ERR_ACCENT
const PRIMARY_BTN_BG_DISABLED = '#3A1818' // MIRROR: disabled red (≈ status-danger-dim #3A1A1A, kept distinct)
const SECONDARY_BTN_BORDER = '#333333' // MIRROR: deeper than --border (#333333 ≈ --border but stays explicit)

type Step = 'welcome' | 'connect' | 'burn'

interface WelcomeModalProps {
  /** Called when the user dismisses the modal — also persists firstRunCompleted. */
  onDismiss: () => void
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9500,
  background: 'hsl(var(--scrim) / 0.78)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const dialog: React.CSSProperties = {
  width: 460,
  background: DIALOG_BG,
  border: `1px solid ${DIALOG_BORDER}`,
  borderRadius: 10,
  boxShadow: '0 24px 64px hsl(var(--scrim) / 0.6)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: `1px solid ${HEADER_BORDER}`,
}

const headerLabel: React.CSSProperties = {
  fontSize: 11,
  color: TEXT_DIM_5,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: TEXT_DIM_3,
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  padding: 0,
}

const body: React.CSSProperties = {
  padding: '20px 24px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const title: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: 'hsl(var(--text))',
  margin: 0,
}

const paragraph: React.CSSProperties = {
  fontSize: 13,
  color: 'hsl(var(--text-dim))',
  lineHeight: 1.55,
  margin: 0,
}

const list: React.CSSProperties = {
  margin: '4px 0 0',
  padding: '0 0 0 18px',
  fontSize: 13,
  color: TEXT_LIST,
  lineHeight: 1.7,
}

const buttonRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 10,
  alignItems: 'center',
}

const primaryBtn: React.CSSProperties = {
  flex: 1,
  padding: '9px 14px',
  background: PRIMARY_BTN_BG,
  border: 'none',
  borderRadius: 6,
  color: 'hsl(var(--text))',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  flex: 1,
  padding: '9px 14px',
  background: 'transparent',
  border: `1px solid ${SECONDARY_BTN_BORDER}`,
  borderRadius: 6,
  color: TEXT_SECONDARY,
  fontSize: 13,
  cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: TEXT_DIM_5,
  fontSize: 12,
  cursor: 'pointer',
  padding: '6px 0',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
}

interface ContainerProps {
  step: Step
  onClose: () => void
  children: React.ReactNode
}

function ModalShell({ step, onClose, children }: ContainerProps) {
  const labelByStep: Record<Step, string> = {
    welcome: 'Step 1 of 3 — Welcome',
    connect: 'Step 2 of 3 — Connect',
    burn: 'Step 3 of 3 — Try the demo',
  }
  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="Welcome to CANShift Studio">
      <div
        style={dialog}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div style={header}>
          <span style={headerLabel}>{labelByStep[step]}</span>
          <button onClick={onClose} style={closeBtn} aria-label="Dismiss welcome">
            ×
          </button>
        </div>
        <div style={body}>{children}</div>
      </div>
    </div>
  )
}

export default function WelcomeModal({ onDismiss }: WelcomeModalProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [connectOpen, setConnectOpen] = useState(false)

  const enterSimulation = useDeviceStore((s) => s.enterSimulation)
  const connected = useDeviceStore((s) => s.connected)
  const status = useDeviceStore((s) => s.status)

  const loadFromDeviceOrDemo = useDashboardStore((s) => s.loadFromDeviceOrDemo)
  const config = useDashboardStore((s) => s.config)

  const log = useLogStore((s) => s.push)
  const { burnConfig, canBurn } = useConfigActions()

  const handleSimulation = () => {
    // Never call loadFromDeviceOrDemo while a device is connected — atomic
    // setter respects in-progress edits when the editor is non-empty.
    if (!connected) {
      const outcome = loadFromDeviceOrDemo(null)
      if (outcome === 'demo') {
        log('info', 'Simulation mode — default config loaded from welcome')
      } else {
        log('info', 'Simulation mode — using current config from welcome')
      }
    }
    enterSimulation()
    onDismiss()
  }

  const handleConnect = () => {
    setStep('connect')
    setConnectOpen(true)
  }

  const handleConnectClosed = () => {
    setConnectOpen(false)
    // If the user successfully connected, advance to the burn step.
    if (connected) {
      setStep('burn')
    } else {
      setStep('welcome')
    }
  }

  const handleBurnDemo = () => {
    if (!canBurn) return
    if (!config) {
      // Editor empty (e.g. user opted into welcome before any config loaded) —
      // seed the demo so burnConfig has something to push.
      loadFromDeviceOrDemo(null)
    }
    burnConfig()
    onDismiss()
  }

  // Step transition: if the user is already connected when we enter step 2,
  // jump straight to the burn step.
  const effectiveStep: Step = step === 'connect' && connected && !connectOpen ? 'burn' : step

  return (
    <>
      <ModalShell step={effectiveStep} onClose={onDismiss}>
        {effectiveStep === 'welcome' && (
          <>
            <h2 style={title}>Welcome to CANShift Studio</h2>
            <p style={paragraph}>
              Design the dashboard your CANShift screen runs in the car. From here you can:
            </p>
            <ul style={list}>
              <li>Lay out gauges, bar meters, and status widgets across multiple pages.</li>
              <li>Map ECU signals onto every widget with live preview.</li>
              <li>Push the config to the device over USB whenever you&apos;re ready.</li>
            </ul>
            <div style={buttonRow}>
              <button onClick={handleConnect} style={primaryBtn}>
                Get Started
              </button>
              <button onClick={onDismiss} style={secondaryBtn}>
                Skip
              </button>
            </div>
          </>
        )}

        {effectiveStep === 'connect' && (
          <>
            <h2 style={title}>Connect your device</h2>
            <p style={paragraph}>
              Plug a CANShift screen into USB and pick the serial port. We&apos;ll wait here while
              you connect.
            </p>
            <p style={paragraph}>
              Don&apos;t have hardware yet? You can preview the dashboard in simulation mode.
            </p>
            <div style={buttonRow}>
              <button
                onClick={() => {
                  setConnectOpen(true)
                }}
                style={primaryBtn}
              >
                Open USB Picker
              </button>
              <button onClick={handleSimulation} style={secondaryBtn}>
                I don&apos;t have a device yet
              </button>
            </div>
            <button
              onClick={() => {
                setStep('welcome')
              }}
              style={ghostBtn}
            >
              Back
            </button>
          </>
        )}

        {effectiveStep === 'burn' && (
          <>
            <h2 style={title}>Try the demo dashboard</h2>
            <p style={paragraph}>
              You&apos;re connected. Burn the bundled demo config to your device so you can see what
              a CANShift dashboard looks like end-to-end.
            </p>
            <p style={paragraph}>
              You can swap it for your own design any time — Studio keeps your local copy safe.
            </p>
            <div style={buttonRow}>
              <button
                onClick={handleBurnDemo}
                disabled={!canBurn || status === 'burning'}
                style={{
                  ...primaryBtn,
                  background:
                    canBurn && status !== 'burning' ? PRIMARY_BTN_BG : PRIMARY_BTN_BG_DISABLED,
                  cursor: canBurn && status !== 'burning' ? 'pointer' : 'not-allowed',
                }}
              >
                {status === 'burning' ? 'Burning…' : 'Burn demo dashboard'}
              </button>
              <button onClick={onDismiss} style={secondaryBtn}>
                Maybe later
              </button>
            </div>
          </>
        )}
      </ModalShell>

      {connectOpen && <ConnectModal onClose={handleConnectClosed} />}
    </>
  )
}
