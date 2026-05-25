// TopBar.tsx — Application top bar

import { useState } from 'react'
import logoUrl from '../../../assets/CANShift_studio_logo.png'
import { useDeviceStore } from '../../stores/device.store'
import { useConfigActions } from '../../hooks/useConfigActions'
import ConnectModal from './ConnectModal'
import { useLogStore } from '../../stores/log.store'
import { IconLoad, IconExport, IconBurn, IconExit, IconUsb } from '../icons/Icon'

// Chrome / brand shades not yet mapped to a core token. Hoisted to constants
// so the planned token promotion (audit S-H-5, umbrella #1015) only swaps one
// place per shade. See PR body for the proposed follow-up token additions.
const CHROME_BG = '#0A0A0A' // MIRROR: darker than --bg (#121212)
const CHROME_BORDER = '#1A1A1A' // MIRROR: between --bg and --surface
const CHROME_DIVIDER = '#1E1E1E' // MIRROR: ≈ --surface (#1F1F1F)
const CHROME_BUTTON_BORDER = '#202020' // MIRROR: subtle button outline
const CHROME_BUTTON_HOVER_BG = '#141414' // MIRROR: button pressed state
const CHROME_BUTTON_HOVER_BORDER = '#282828' // MIRROR: button pressed state border
const BRAND_ORANGE = '#E08030' // MIRROR: darker variant of --warning (#FF8800)
const STATUS_GREEN = '#3DB86B' // MIRROR: darker variant of --success (#00CC2A)
const SIM_PURPLE = '#8844FF' // MIRROR: simulation badge (no token)
const SIM_PURPLE_TEXT = '#7744CC' // MIRROR: simulation badge text (no token)
const TEXT_DISABLED = '#3A3A3A' // MIRROR: disabled text shade
const TEXT_DIM_2 = '#444444' // MIRROR: deeper dim than --text-muted
const TEXT_DIM_4 = '#777777' // MIRROR
const TEXT_DIM_5 = '#888888' // MIRROR
// `--status-danger` / `--status-danger-dim` are the canonical tokens since #1097.
const BRAND_RED = 'hsl(var(--status-danger))'
const BRAND_RED_BORDER = 'hsl(var(--status-danger-dim))'

const STATUS_COLOR: Record<string, string> = {
  connected: STATUS_GREEN,
  burning: BRAND_ORANGE,
  error: BRAND_RED,
  disconnected: TEXT_DISABLED,
}

const STATUS_LABEL: Record<string, string> = {
  connected: 'Connected',
  burning: 'Burning…',
  error: 'Error',
  disconnected: 'No device',
}

function ToolBtn({
  onClick,
  disabled,
  title,
  children,
  accent,
}: {
  onClick: () => void
  disabled?: boolean
  title?: string
  children: React.ReactNode
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={
        {
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 11px',
          background: 'transparent',
          border: `1px solid ${accent ? BRAND_RED_BORDER : CHROME_BUTTON_BORDER}`,
          borderRadius: 5,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 12,
          color: disabled ? TEXT_DISABLED : accent ? BRAND_RED : TEXT_DIM_4,
          transition: 'border-color 0.1s, color 0.1s',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties
      }
    >
      {children}
    </button>
  )
}

export default function TopBar() {
  const [modalOpen, setModalOpen] = useState(false)
  const status = useDeviceStore((s) => s.status)
  const portPath = useDeviceStore((s) => s.portPath)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const exitSimulation = useDeviceStore((s) => s.exitSimulation)
  const log = useLogStore((s) => s.push)

  const {
    openConfig,
    saveConfig,
    burnConfig,
    config,
    connected,
    syncing,
    canBurn: deviceCanBurn,
  } = useConfigActions()

  const canSave = config !== null
  const canBurn = config !== null && deviceCanBurn

  const burnBlockedReason = !connected
    ? 'Connect a device first'
    : simulationMode
      ? 'Exit simulation to burn to real hardware'
      : syncing
        ? 'Burn already in progress'
        : null
  const burnTooltip = canBurn
    ? 'Push config to device'
    : (burnBlockedReason ?? 'Push config to device')

  const statusColor = simulationMode ? SIM_PURPLE : (STATUS_COLOR[status] ?? TEXT_DISABLED)
  const statusLabel = simulationMode
    ? 'Simulation'
    : `${STATUS_LABEL[status] ?? 'No device'}${status === 'connected' && portPath ? ` · ${portPath}` : ''}`

  return (
    <>
      <header
        style={
          {
            display: 'flex',
            alignItems: 'center',
            height: 52,
            background: CHROME_BG,
            borderBottom: `1px solid ${CHROME_BORDER}`,
            padding: '0 14px 0 72px',
            gap: 10,
            WebkitAppRegion: 'drag',
            flexShrink: 0,
          } as React.CSSProperties
        }
      >
        {/* Logo */}
        <img
          src={logoUrl}
          alt="CANShift Studio"
          style={
            {
              height: 42,
              flexShrink: 0,
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties
          }
        />

        <div style={{ flex: 1 }} />

        {/* Tool actions */}
        <div
          style={
            {
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties
          }
        >
          <ToolBtn onClick={openConfig} title="Open config file">
            <IconLoad size={12} />
            Load
          </ToolBtn>

          <ToolBtn onClick={saveConfig} disabled={!canSave} title="Save config file">
            <IconExport size={12} />
            Export
          </ToolBtn>

          <ToolBtn onClick={burnConfig} disabled={!canBurn} title={burnTooltip} accent={canBurn}>
            <IconBurn size={12} color={canBurn ? BRAND_RED : TEXT_DISABLED} />
            {syncing ? 'Burning…' : 'Burn'}
          </ToolBtn>

          <div style={{ width: 1, height: 18, background: CHROME_DIVIDER, margin: '0 4px' }} />

          {/* Exit simulation */}
          {simulationMode && (
            <ToolBtn
              onClick={() => {
                exitSimulation()
                log('info', 'Simulation mode exited')
              }}
              title="Exit simulation"
            >
              <IconExit size={12} color={SIM_PURPLE_TEXT} />
              <span style={{ color: SIM_PURPLE_TEXT }}>Exit sim</span>
            </ToolBtn>
          )}

          {/* Connection status / modal trigger */}
          <button
            onClick={() => {
              if (!simulationMode) setModalOpen((o) => !o)
            }}
            title={simulationMode ? undefined : 'USB connection'}
            style={
              {
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: modalOpen ? CHROME_BUTTON_HOVER_BG : 'transparent',
                border: `1px solid ${modalOpen ? CHROME_BUTTON_HOVER_BORDER : CHROME_BUTTON_BORDER}`,
                borderRadius: 5,
                cursor: simulationMode ? 'default' : 'pointer',
                fontSize: 12,
                color: status === 'disconnected' && !simulationMode ? TEXT_DIM_2 : TEXT_DIM_5,
                transition: 'background 0.1s',
                WebkitAppRegion: 'no-drag',
              } as React.CSSProperties
            }
          >
            <IconUsb
              size={13}
              color={statusColor}
              style={{
                filter:
                  status !== 'disconnected' || simulationMode
                    ? `drop-shadow(0 0 3px ${statusColor})`
                    : undefined,
              }}
            />
            {statusLabel}
          </button>
        </div>
      </header>

      {modalOpen && (
        <ConnectModal
          onClose={() => {
            setModalOpen(false)
          }}
        />
      )}
    </>
  )
}
