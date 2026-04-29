// TopBar.tsx — Application top navigation bar

import { useState } from 'react'
import logoUrl from '../../../assets/CANShift_studio_logo.png'
import { useDeviceStore } from '../../stores/device.store'
import { useConfigActions } from '../../hooks/useConfigActions'
import ConnectModal from './ConnectModal'
import { useLogStore } from '../../stores/log.store'
import { IconLoad, IconExport, IconBurn, IconExit } from '../icons/Icon'

const DOT_COLOR: Record<string, string> = {
  connected: '#44CC44',
  burning: '#FF8800',
  error: '#CC3333',
  disconnected: '#444444',
}

const LABEL: Record<string, string> = {
  connected: 'Connected',
  burning: 'Burning…',
  error: 'Error',
  disconnected: 'No Device',
}

const toolbarBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 10px',
  background: 'transparent',
  border: '1px solid #2A2A2A',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: 12,
  color: '#888888',
  transition: 'all 0.1s',
  WebkitAppRegion: 'no-drag',
} as React.CSSProperties

export default function TopBar() {
  const [modalOpen, setModalOpen] = useState(false)
  const status = useDeviceStore((s) => s.status)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const exitSimulation = useDeviceStore((s) => s.exitSimulation)
  const log = useLogStore((s) => s.push)

  const { openConfig, saveConfig, burnConfig, config, connected, syncing } = useConfigActions()

  const dotColor = simulationMode ? '#8844FF' : (DOT_COLOR[status] ?? '#444444')
  const label = simulationMode ? 'Simulation' : (LABEL[status] ?? 'No Device')

  const canSave = config !== null
  const canBurn = config !== null && connected && !syncing

  return (
    <>
      <header
        style={
          {
            display: 'flex',
            alignItems: 'center',
            height: 48,
            background: '#0D0D0D',
            borderBottom: '1px solid #2A2A2A',
            padding: '0 16px 0 80px',
            gap: 8,
            WebkitAppRegion: 'drag',
            flexShrink: 0,
          } as React.CSSProperties
        }
      >
        {/* App logo */}
        <img
          src={logoUrl}
          alt="CANShift Studio"
          style={
            {
              height: 40,
              marginRight: 24,
              WebkitAppRegion: 'no-drag',
              display: 'block',
            } as React.CSSProperties
          }
        />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Toolbar actions */}
        <div
          style={
            {
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties
          }
        >
          {/* Load */}
          <button onClick={openConfig} style={toolbarBtn} title="Open config file">
            <IconLoad size={13} />
            Load
          </button>

          {/* Export */}
          <button
            onClick={saveConfig}
            disabled={!canSave}
            style={{ ...toolbarBtn, opacity: canSave ? 1 : 0.35 }}
            title="Save config file"
          >
            <IconExport size={13} />
            Export
          </button>

          {/* Burn */}
          <button
            onClick={burnConfig}
            disabled={!canBurn}
            style={{
              ...toolbarBtn,
              opacity: canBurn ? 1 : 0.35,
              color: canBurn ? '#FF8800' : '#888888',
              borderColor: canBurn ? '#3A2200' : '#2A2A2A',
            }}
            title="Push config to device"
          >
            <IconBurn size={13} color={canBurn ? '#FF8800' : '#888888'} />
            {syncing ? 'Burning…' : 'Burn'}
          </button>

          {/* Separator */}
          <div style={{ width: 1, height: 20, background: '#2A2A2A' }} />

          {/* Exit simulation */}
          {simulationMode && (
            <button
              onClick={() => {
                exitSimulation()
                log('info', 'Simulation mode exited')
              }}
              style={{ ...toolbarBtn, color: '#663399', borderColor: '#2A1A44' }}
              title="Exit simulation mode"
            >
              <IconExit size={13} color="#663399" />
              Exit Sim
            </button>
          )}

          {/* Connect / status */}
          <button
            onClick={() => {
              if (!simulationMode) setModalOpen((o) => !o)
            }}
            style={{
              ...toolbarBtn,
              background: modalOpen ? '#2A2A2A' : 'transparent',
              borderColor: simulationMode ? '#2A1A44' : modalOpen ? '#3A3A3A' : '#2A2A2A',
              cursor: simulationMode ? 'default' : 'pointer',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: dotColor,
                boxShadow: status !== 'disconnected' ? `0 0 5px ${dotColor}99` : 'none',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: status === 'disconnected' && !simulationMode ? '#555555' : '#CCCCCC',
              }}
            >
              {label}
            </span>
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
