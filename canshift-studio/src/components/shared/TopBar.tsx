// TopBar.tsx — Application top bar

import { useState } from 'react'
import logoUrl from '../../../assets/CANShift_studio_logo.png'
import { useDeviceStore } from '../../stores/device.store'
import { useConfigActions } from '../../hooks/useConfigActions'
import ConnectModal from './ConnectModal'
import { useLogStore } from '../../stores/log.store'
import { IconLoad, IconExport, IconBurn, IconExit, IconUsb } from '../icons/Icon'

const STATUS_COLOR: Record<string, string> = {
  connected: '#3DB86B',
  burning: '#E08030',
  error: '#E03030',
  disconnected: '#3A3A3A',
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
          border: `1px solid ${accent ? '#3A1A1A' : '#202020'}`,
          borderRadius: 5,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 12,
          color: disabled ? '#3A3A3A' : accent ? '#E03030' : '#777777',
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

  const { openConfig, saveConfig, burnConfig, config, connected, syncing } = useConfigActions()

  const canSave = config !== null
  const canBurn = config !== null && connected && !syncing

  const statusColor = simulationMode ? '#8844FF' : (STATUS_COLOR[status] ?? '#3A3A3A')
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
            background: '#0A0A0A',
            borderBottom: '1px solid #1A1A1A',
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

          <ToolBtn
            onClick={burnConfig}
            disabled={!canBurn}
            title="Push config to device"
            accent={canBurn}
          >
            <IconBurn size={12} color={canBurn ? '#E03030' : '#3A3A3A'} />
            {syncing ? 'Burning…' : 'Burn'}
          </ToolBtn>

          <div style={{ width: 1, height: 18, background: '#1E1E1E', margin: '0 4px' }} />

          {/* Exit simulation */}
          {simulationMode && (
            <ToolBtn
              onClick={() => {
                exitSimulation()
                log('info', 'Simulation mode exited')
              }}
              title="Exit simulation"
            >
              <IconExit size={12} color="#7744CC" />
              <span style={{ color: '#7744CC' }}>Exit sim</span>
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
                background: modalOpen ? '#141414' : 'transparent',
                border: `1px solid ${modalOpen ? '#282828' : '#202020'}`,
                borderRadius: 5,
                cursor: simulationMode ? 'default' : 'pointer',
                fontSize: 12,
                color: status === 'disconnected' && !simulationMode ? '#444444' : '#888888',
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
