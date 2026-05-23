// ConnectModal.tsx — Transport picker popup triggered from the TopBar button.
//
// Lets the user choose USB or WiFi (issue #1071). USB tab mirrors the original
// modal exactly; WiFi tab runs mDNS discovery via `_canshift._tcp` and falls
// back to a manual host/port entry when the dash is on a network where mDNS
// is firewalled.

import { useEffect, useState } from 'react'
import { useDeviceStore, type ConnectionStatus } from '../../stores/device.store'
import { useUsbConnection } from '../../hooks/useUsbConnection'
import { DEFAULT_WIFI_PORT, useWifiConnection } from '../../hooks/useWifiConnection'
import { IconRefresh, IconDisconnect, IconUsb, IconWifi } from '../icons/Icon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ConnectModalProps {
  onClose: () => void
}

type TransportTab = 'usb' | 'wifi'

export default function ConnectModal({ onClose }: ConnectModalProps) {
  const status = useDeviceStore((s) => s.status)
  const portPath = useDeviceStore((s) => s.portPath)
  const transport = useDeviceStore((s) => s.transport)
  const wifiHost = useDeviceStore((s) => s.wifiHost)
  const errorMessage = useDeviceStore((s) => s.errorMessage)
  const clearError = useDeviceStore((s) => s.clearError)

  // Default the active tab to whichever transport is currently connected so
  // re-opening the modal mid-session lands on the relevant Disconnect button.
  const [tab, setTab] = useState<TransportTab>(transport === 'wifi' ? 'wifi' : 'usb')

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className={cn(
          'left-auto right-3 top-[52px] translate-x-0 translate-y-0 w-[320px] max-w-[320px]',
          'gap-0 rounded-lg border border-border bg-surface p-0 shadow-[0_8px_32px_#00000099] sm:rounded-lg'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <DialogTitle className="text-xs font-normal uppercase tracking-[0.06em] text-text-muted">
            Connect device
          </DialogTitle>
        </div>

        <DialogDescription className="sr-only">
          Pick USB or WiFi and connect to a CANShift device.
        </DialogDescription>

        <div className="px-3.5 pb-4 pt-3.5">
          {/* Status row */}
          <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-2">
            <StatusDot status={status} />
            <div>
              <div className={cn('text-xs', statusColorClass(status))}>
                {statusLabel(status, transport, portPath, wifiHost)}
              </div>
              {errorMessage && (
                <div className="mt-0.5 text-[10px] text-destructive">{errorMessage}</div>
              )}
            </div>
            {status === 'error' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearError()
                }}
                className="ml-auto h-6 px-2 text-[10px]"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Transport picker — segmented control */}
          <div
            role="tablist"
            aria-label="Transport"
            className="mb-3 flex gap-1 rounded-md border border-border bg-bg p-1"
          >
            <TransportTabButton
              active={tab === 'usb'}
              onClick={() => {
                setTab('usb')
              }}
              label="USB"
              icon={<IconUsb size={12} color="currentColor" />}
            />
            <TransportTabButton
              active={tab === 'wifi'}
              onClick={() => {
                setTab('wifi')
              }}
              label="WiFi"
              icon={<IconWifi size={12} color="currentColor" />}
            />
          </div>

          {tab === 'usb' ? <UsbTab onClose={onClose} /> : <WifiTab onClose={onClose} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// USB tab — preserves the pre-#1071 behaviour byte-for-byte.
// ---------------------------------------------------------------------------

function UsbTab({ onClose }: { onClose: () => void }) {
  const transport = useDeviceStore((s) => s.transport)
  const {
    ports,
    selectedPort,
    setSelectedPort,
    loading,
    connected,
    refreshPorts,
    connect,
    disconnect,
  } = useUsbConnection()

  // Refresh ports when the modal opens AND when the user switches to the USB tab.
  useEffect(() => {
    if (!connected) void refreshPorts()
  }, [connected, refreshPorts])

  // Only show the USB Disconnect button when USB is the active transport —
  // a WiFi session must be disconnected from its own tab.
  const showUsbDisconnect = connected && transport === 'usb'

  if (showUsbDisconnect) {
    return (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            disconnect()
            onClose()
          }}
          className="h-7 flex-1 text-xs"
        >
          <IconDisconnect size={12} color="currentColor" />
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.06em] text-text-muted">
        Serial port
      </div>
      <div className="mb-3 flex gap-1.5">
        <select
          value={selectedPort}
          onChange={(e) => {
            setSelectedPort(e.target.value)
          }}
          className="flex-1 rounded border border-border bg-bg px-2 py-1 text-xs text-text"
          aria-label="Serial port"
        >
          {ports.length === 0 ? (
            <option value="">No ports found</option>
          ) : (
            <>
              <option value="">Select port…</option>
              {ports.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.path}
                  {p.manufacturer ? ` — ${p.manufacturer}` : ''}
                </option>
              ))}
            </>
          )}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshPorts}
          disabled={loading}
          aria-label="Refresh ports"
          className="h-7 px-2"
        >
          <IconRefresh size={12} color="currentColor" />
        </Button>
      </div>

      <Button
        variant={selectedPort && !loading ? 'destructive' : 'outline'}
        onClick={connect}
        disabled={!selectedPort || loading || connected}
        className="h-8 w-full text-xs"
      >
        <IconUsb size={13} color="currentColor" />
        {loading ? 'Connecting…' : 'Connect'}
      </Button>
    </>
  )
}

// ---------------------------------------------------------------------------
// WiFi tab — mDNS discovery + manual host/port fallback.
// ---------------------------------------------------------------------------

function WifiTab({ onClose }: { onClose: () => void }) {
  const transport = useDeviceStore((s) => s.transport)
  const { devices, discovering, connecting, connected, discover, connect, disconnect } =
    useWifiConnection()

  const [selectedHost, setSelectedHost] = useState('')
  const [manualHost, setManualHost] = useState('')
  const [manualPort, setManualPort] = useState(String(DEFAULT_WIFI_PORT))

  const showWifiDisconnect = connected && transport === 'wifi'

  if (showWifiDisconnect) {
    return (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            disconnect()
            onClose()
          }}
          className="h-7 flex-1 text-xs"
        >
          <IconDisconnect size={12} color="currentColor" />
          Disconnect
        </Button>
      </div>
    )
  }

  const handleConnectDiscovered = (): void => {
    const device = devices.find((d) => `${d.host}:${String(d.port)}` === selectedHost)
    if (!device) return
    connect(device.host, device.port)
  }

  const handleConnectManual = (): void => {
    const host = manualHost.trim()
    const port = Number.parseInt(manualPort, 10)
    if (!host || !Number.isFinite(port) || port <= 0 || port > 65_535) return
    connect(host, port)
  }

  return (
    <>
      {/* Discovered devices */}
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.06em] text-text-muted">
          mDNS · _canshift._tcp
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={discover}
          disabled={discovering || connecting}
          aria-label="Scan for devices"
          className="h-6 px-2 text-[10px]"
        >
          <IconRefresh size={10} color="currentColor" />
          {discovering ? 'Scanning…' : 'Scan'}
        </Button>
      </div>

      <div className="mb-3 flex gap-1.5">
        <select
          value={selectedHost}
          onChange={(e) => {
            setSelectedHost(e.target.value)
          }}
          className="flex-1 rounded border border-border bg-bg px-2 py-1 text-xs text-text"
          aria-label="Discovered device"
          disabled={devices.length === 0}
        >
          {devices.length === 0 ? (
            <option value="">{discovering ? 'Scanning…' : 'No devices found yet'}</option>
          ) : (
            <>
              <option value="">Select device…</option>
              {devices.map((d) => {
                const key = `${d.host}:${String(d.port)}`
                return (
                  <option key={key} value={key}>
                    {d.name} — {d.host}:{d.port}
                  </option>
                )
              })}
            </>
          )}
        </select>
      </div>

      <Button
        variant={selectedHost && !connecting ? 'destructive' : 'outline'}
        onClick={handleConnectDiscovered}
        disabled={!selectedHost || connecting || connected}
        className="mb-4 h-8 w-full text-xs"
      >
        <IconWifi size={13} color="currentColor" />
        {connecting ? 'Connecting…' : 'Connect'}
      </Button>

      {/* Manual host/port — used when mDNS doesn't surface the dash */}
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.06em] text-text-muted">
        Manual entry
      </div>
      <div className="mb-3 flex gap-1.5">
        <input
          type="text"
          value={manualHost}
          onChange={(e) => {
            setManualHost(e.target.value)
          }}
          placeholder="192.168.4.1"
          aria-label="Host or IP"
          className="flex-1 rounded border border-border bg-bg px-2 py-1 text-xs text-text placeholder:text-text-muted"
          autoComplete="off"
          spellCheck={false}
        />
        <input
          type="number"
          value={manualPort}
          onChange={(e) => {
            setManualPort(e.target.value)
          }}
          aria-label="Port"
          min={1}
          max={65535}
          className="w-16 rounded border border-border bg-bg px-2 py-1 text-xs text-text"
        />
      </div>

      <Button
        variant={manualHost.trim() && !connecting ? 'destructive' : 'outline'}
        onClick={handleConnectManual}
        disabled={!manualHost.trim() || connecting || connected}
        className="h-8 w-full text-xs"
      >
        <IconWifi size={13} color="currentColor" />
        {connecting ? 'Connecting…' : 'Connect manually'}
      </Button>
    </>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function TransportTabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
        active
          ? 'bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]'
          : 'text-text-muted hover:text-text'
      )}
      type="button"
    >
      {icon}
      {label}
    </button>
  )
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const colorClass =
    status === 'connected'
      ? 'bg-success'
      : status === 'burning'
        ? 'bg-warning'
        : status === 'error'
          ? 'bg-destructive'
          : 'bg-text-muted'

  const glow = status !== 'disconnected' ? 'shadow-[0_0_6px_currentColor]' : ''

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        colorClass,
        glow && `text-current ${glow}`
      )}
    />
  )
}

function statusColorClass(status: ConnectionStatus): string {
  if (status === 'connected') return 'text-success'
  if (status === 'burning') return 'text-warning'
  if (status === 'error') return 'text-destructive'
  return 'text-text-muted'
}

function statusLabel(
  status: ConnectionStatus,
  transport: 'usb' | 'wifi' | null,
  portPath: string | null,
  wifiHost: string | null
): string {
  if (status === 'connected') {
    if (transport === 'wifi' && wifiHost) return `Connected · WiFi · ${wifiHost}`
    if (transport === 'usb' && portPath) return `Connected · USB · ${portPath}`
    return 'Connected'
  }
  if (status === 'burning') return 'Syncing config…'
  if (status === 'error') return 'Error'
  return 'Not connected'
}
