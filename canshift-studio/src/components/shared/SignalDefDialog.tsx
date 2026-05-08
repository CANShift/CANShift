// SignalDefDialog.tsx — Modal for defining a CAN signal from a scanner frame.
//
// Opened when the user clicks "Define" on a byte or byte-pair in ByteInterpreter.
// Pre-fills canFrameId, startByte, byteLength, bigEndian, signed from the click context.
// Shows a live decoded preview using the current frame data.

import { useState, useCallback } from 'react'
import type { SignalDef } from '@tmbk/canshift-core'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ---------------------------------------------------------------------------
// Partial pre-fill shape from ByteInterpreter
// ---------------------------------------------------------------------------

export interface SignalDefPreFill {
  canFrameId: string // e.g. "0x370"
  startByte: number
  byteLength: 1 | 2 | 4
  bigEndian: boolean
  signed: boolean
  frameData: number[] // Raw frame bytes for live preview
}

interface Props {
  prefill: SignalDefPreFill
  onSave: (signal: SignalDef) => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readRaw(
  data: number[],
  startByte: number,
  byteLength: 1 | 2 | 4,
  bigEndian: boolean
): number {
  const buf = new ArrayBuffer(4)
  const view = new DataView(buf)
  for (let i = 0; i < byteLength; i++) {
    view.setUint8(i, data[startByte + i] ?? 0)
  }
  if (byteLength === 1) return view.getUint8(0)
  if (byteLength === 2) return bigEndian ? view.getUint16(0, false) : view.getUint16(0, true)
  return bigEndian ? view.getUint32(0, false) : view.getUint32(0, true)
}

function applySignedness(raw: number, byteLength: 1 | 2 | 4, signed: boolean): number {
  if (!signed) return raw
  const bits = byteLength * 8
  const threshold = 1 << (bits - 1)
  return raw >= threshold ? raw - (1 << bits) : raw
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

const FIELD_LABEL_CLASS =
  'text-[10px] font-normal uppercase tracking-[0.06em] text-text-muted leading-none'
const FIELD_INPUT_CLASS = 'h-8 text-xs'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <Label className={FIELD_LABEL_CLASS}>{label}</Label>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}): React.ReactElement {
  return (
    <Input
      className={FIELD_INPUT_CLASS}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value)
      }}
    />
  )
}

function NumberInput({
  value,
  onChange,
  step,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
}): React.ReactElement {
  return (
    <Input
      className={FIELD_INPUT_CLASS}
      type="number"
      step={step ?? 'any'}
      value={value}
      onChange={(e) => {
        const n = parseFloat(e.target.value)
        if (!isNaN(n)) onChange(n)
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignalDefDialog({ prefill, onSave, onClose }: Props): React.ReactElement {
  const [name, setName] = useState('')
  const [canFrameId] = useState(prefill.canFrameId)
  const [startByte, setStartByte] = useState(prefill.startByte)
  const [byteLength, setByteLength] = useState<1 | 2 | 4>(prefill.byteLength)
  const [bigEndian, setBigEndian] = useState(prefill.bigEndian)
  const [signed, setSigned] = useState(prefill.signed)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState(0)
  const [unit, setUnit] = useState('')
  const [min, setMin] = useState(0)
  const [max, setMax] = useState(65535)
  const [warningLevel, setWarningLevel] = useState('')
  const [dangerLevel, setDangerLevel] = useState('')
  const [timeoutMs, setTimeoutMs] = useState(500)

  const rawValue = readRaw(prefill.frameData, startByte, byteLength, bigEndian)
  const signedValue = applySignedness(rawValue, byteLength, signed)
  const scaledValue = signedValue * scale + offset

  const handleSave = useCallback(() => {
    if (!name.trim()) return
    const signal: SignalDef = {
      name: name.trim(),
      canFrameId,
      startByte,
      byteLength,
      bigEndian,
      signed,
      scale,
      offset,
      unit,
      min,
      max,
      timeoutMs,
      ...(warningLevel !== '' ? { warningLevel: parseFloat(warningLevel) } : {}),
      ...(dangerLevel !== '' ? { dangerLevel: parseFloat(dangerLevel) } : {}),
    }
    onSave(signal)
  }, [
    name,
    canFrameId,
    startByte,
    byteLength,
    bigEndian,
    signed,
    scale,
    offset,
    unit,
    min,
    max,
    timeoutMs,
    warningLevel,
    dangerLevel,
    onSave,
  ])

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="flex max-h-[80vh] flex-col gap-3.5 overflow-y-auto sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Define signal</DialogTitle>
        </DialogHeader>

        <Field label="Signal name">
          <TextInput value={name} onChange={setName} placeholder="e.g. rpm" />
        </Field>

        {/* Read-only frame info */}
        <div className="grid grid-cols-3 gap-2.5">
          <Field label="Frame ID">
            <div
              className="flex h-8 w-full cursor-default items-center rounded-md border border-input bg-background px-3 font-mono text-xs text-primary"
              aria-readonly="true"
            >
              {canFrameId}
            </div>
          </Field>
          <Field label="Start byte">
            <NumberInput
              value={startByte}
              onChange={(v) => {
                setStartByte(Math.max(0, Math.floor(v)))
              }}
            />
          </Field>
          <Field label="Byte length">
            <Select
              value={String(byteLength)}
              onValueChange={(v) => {
                setByteLength(parseInt(v, 10) as 1 | 2 | 4)
              }}
            >
              <SelectTrigger className={FIELD_INPUT_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Byte order">
            <Select
              value={bigEndian ? 'be' : 'le'}
              onValueChange={(v) => {
                setBigEndian(v === 'be')
              }}
            >
              <SelectTrigger className={FIELD_INPUT_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="be">Big-endian</SelectItem>
                <SelectItem value="le">Little-endian</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Signed">
            <Select
              value={signed ? 'yes' : 'no'}
              onValueChange={(v) => {
                setSigned(v === 'yes')
              }}
            >
              <SelectTrigger className={FIELD_INPUT_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Unsigned</SelectItem>
                <SelectItem value="yes">Signed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Field label="Scale">
            <NumberInput value={scale} onChange={setScale} step={0.001} />
          </Field>
          <Field label="Offset">
            <NumberInput value={offset} onChange={setOffset} step={0.1} />
          </Field>
          <Field label="Unit">
            <TextInput value={unit} onChange={setUnit} placeholder="rpm, °C…" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Min">
            <NumberInput value={min} onChange={setMin} />
          </Field>
          <Field label="Max">
            <NumberInput value={max} onChange={setMax} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Field label="Warning level">
            <TextInput value={warningLevel} onChange={setWarningLevel} placeholder="optional" />
          </Field>
          <Field label="Danger level">
            <TextInput value={dangerLevel} onChange={setDangerLevel} placeholder="optional" />
          </Field>
          <Field label="Timeout (ms)">
            <NumberInput
              value={timeoutMs}
              onChange={(v) => {
                setTimeoutMs(Math.max(0, Math.floor(v)))
              }}
            />
          </Field>
        </div>

        {/* Live preview */}
        <div className="flex items-center gap-4 rounded-md border border-border bg-bg px-3 py-2 text-[11px]">
          <span className="text-[9px] uppercase tracking-[0.06em] text-text-muted">Preview</span>
          <span className="font-mono text-text-dim">raw: {rawValue}</span>
          {signed && rawValue !== signedValue && (
            <span className="font-mono text-text-dim">signed: {signedValue}</span>
          )}
          <span className="font-mono font-bold text-accent">
            {scaledValue.toFixed(scale < 1 ? 3 : 1)} {unit}
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
            Add signal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
