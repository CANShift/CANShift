// ConnectModal.tsx — USB connection popup triggered from the TopBar button

import { useEffect } from 'react'
import { useDeviceStore, type ConnectionStatus } from '../../stores/device.store'
import { useUsbConnection } from '../../hooks/useUsbConnection'
import { IconRefresh, IconDisconnect, IconUsb } from '../icons/Icon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ConnectModalProps {
  onClose: () => void
}

export default function ConnectModal({ onClose }: ConnectModalProps) {
  const status = useDeviceStore((s) => s.status)
  const portPath = useDeviceStore((s) => s.portPath)
  const errorMessage = useDeviceStore((s) => s.errorMessage)
  const clearError = useDeviceStore((s) => s.clearError)

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

  // Refresh ports when the modal opens
  useEffect(() => {
    if (!connected) refreshPorts()
  }, [connected, refreshPorts])

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className={cn(
          // Anchor to the top-right corner instead of the default centered layout.
          'left-auto right-3 top-[52px] translate-x-0 translate-y-0 w-[300px] max-w-[300px]',
          'gap-0 rounded-lg border border-border bg-surface p-0 shadow-[0_8px_32px_#00000099] sm:rounded-lg'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <DialogTitle className="text-xs font-normal uppercase tracking-[0.06em] text-text-muted">
            USB Device
          </DialogTitle>
        </div>

        <DialogDescription className="sr-only">
          Pick a serial port and connect to a CANShift device over USB.
        </DialogDescription>

        <div className="px-3.5 pb-4 pt-3.5">
          {/* Status row */}
          <div className="mb-3.5 flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-2">
            <StatusDot status={status} />
            <div>
              <div className={cn('text-xs', statusColorClass(status))}>
                {statusLabel(status, portPath)}
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

          {/* Port selector — only when disconnected / error */}
          {!connected && (
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
                disabled={!selectedPort || loading}
                className="h-8 w-full text-xs"
              >
                <IconUsb size={13} color="currentColor" />
                {loading ? 'Connecting…' : 'Connect'}
              </Button>
            </>
          )}

          {/* Connected actions */}
          {connected && (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function statusLabel(status: ConnectionStatus, portPath: string | null): string {
  if (status === 'connected') return `Connected${portPath ? ` · ${portPath}` : ''}`
  if (status === 'burning') return 'Syncing config…'
  if (status === 'error') return 'Error'
  return 'Not connected'
}
