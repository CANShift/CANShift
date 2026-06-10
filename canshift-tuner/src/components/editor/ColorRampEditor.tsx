import { useCallback, useMemo } from 'react'
import {
  HexColorSchema,
  MAX_RAMP_STOPS,
  SENSOR_DEFAULT_RAMPS,
  colorAtValue,
} from '@tmbk/canshift-core'
import type { ColorRamp, ColorRampStop, HexColor, SensorKind } from '@tmbk/canshift-core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { newId, rampStopKey } from '../../utils/listKeys'

const PREVIEW_SAMPLES = 80
const ROW_LABEL_CLASS =
  'text-[10px] font-normal uppercase tracking-[0.06em] text-text-muted leading-none'

export interface ColorRampEditorProps {
  ramp: ColorRamp | undefined
  sensorKind: SensorKind | undefined
  min: number
  max: number
  onChange: (next: ColorRamp | undefined) => void
}

const RAMP_FALLBACK_OK = HexColorSchema.parse('#44CC66')
const RAMP_FALLBACK_DANGER = HexColorSchema.parse('#CC3333')
const RAMP_FALLBACK_BLACK = HexColorSchema.parse('#000000')

const fallbackRamp = (min: number, max: number): ColorRamp => {
  const lo = Number.isFinite(min) ? min : 0
  const hi = Number.isFinite(max) && max > lo ? max : lo + 1
  return {
    interpolate: 'linear',
    stops: [
      { value: lo, color: RAMP_FALLBACK_OK },
      { value: hi, color: RAMP_FALLBACK_DANGER },
    ],
  }
}

const clampHex = (value: string): HexColor => {
  const parsed = HexColorSchema.safeParse(value)
  return parsed.success ? parsed.data : RAMP_FALLBACK_BLACK
}

export default function ColorRampEditor({
  ramp,
  sensorKind,
  min,
  max,
  onChange,
}: ColorRampEditorProps): React.ReactElement {
  const effective = ramp ?? fallbackRamp(min, max)

  const update = useCallback(
    (next: ColorRamp): void => {
      onChange(next)
    },
    [onChange]
  )

  const handleStopValue = useCallback(
    (idx: number, raw: string): void => {
      const parsed = Number.parseFloat(raw)
      if (!Number.isFinite(parsed)) return
      const stops = effective.stops.map((s, i) => (i === idx ? { ...s, value: parsed } : s))
      update({ ...effective, stops })
    },
    [effective, update]
  )

  const handleStopColor = useCallback(
    (idx: number, raw: string): void => {
      const stops = effective.stops.map((s, i) => (i === idx ? { ...s, color: clampHex(raw) } : s))
      update({ ...effective, stops })
    },
    [effective, update]
  )

  const handleAddStop = useCallback((): void => {
    if (effective.stops.length >= MAX_RAMP_STOPS) return
    const last = effective.stops[effective.stops.length - 1]
    const second = effective.stops[effective.stops.length - 2]
    const span = last && second ? last.value - second.value : 1
    const insertValue = (last?.value ?? 0) + (span > 0 ? span : 1)
    const next: ColorRampStop = {
      id: newId(),
      value: insertValue,
      color: last?.color ?? RAMP_FALLBACK_OK,
    }
    update({ ...effective, stops: [...effective.stops, next] })
  }, [effective, update])

  const handleRemoveStop = useCallback(
    (idx: number): void => {
      if (effective.stops.length <= 2) return
      const stops = effective.stops.filter((_, i) => i !== idx)
      update({ ...effective, stops })
    },
    [effective, update]
  )

  const handleInterpolate = useCallback(
    (mode: 'linear' | 'step'): void => {
      update({ ...effective, interpolate: mode })
    },
    [effective, update]
  )

  const handleReset = useCallback((): void => {
    if (!sensorKind) {
      onChange(undefined)
      return
    }
    update(SENSOR_DEFAULT_RAMPS[sensorKind])
  }, [sensorKind, onChange, update])

  const handleClear = useCallback((): void => {
    onChange(undefined)
  }, [onChange])

  const gradient = useMemo(() => {
    const lo = Number.isFinite(min) ? min : (effective.stops[0]?.value ?? 0)
    const hi = Number.isFinite(max) && max > lo ? max : lo + 1
    const stops: string[] = []
    for (let i = 0; i < PREVIEW_SAMPLES; i++) {
      const t = i / (PREVIEW_SAMPLES - 1)
      const v = lo + (hi - lo) * t
      stops.push(`${colorAtValue(effective, v)} ${(t * 100).toFixed(1)}%`)
    }
    return `linear-gradient(to right, ${stops.join(', ')})`
  }, [effective, min, max])

  const stopCount = effective.stops.length
  const canAdd = stopCount < MAX_RAMP_STOPS
  const canRemove = stopCount > 2

  return (
    <div data-testid="color-ramp-editor" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className={ROW_LABEL_CLASS}>Color ramp</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            data-testid="ramp-reset"
          >
            {sensorKind ? 'Reset to defaults' : 'Clear'}
          </Button>
          {ramp !== undefined && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              data-testid="ramp-clear"
            >
              Use defaults
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-text-muted">
        <span>Interpolate</span>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="ramp-interpolate"
            value="linear"
            checked={effective.interpolate === 'linear'}
            onChange={() => {
              handleInterpolate('linear')
            }}
          />
          Linear
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="ramp-interpolate"
            value="step"
            checked={effective.interpolate === 'step'}
            onChange={() => {
              handleInterpolate('step')
            }}
          />
          Step
        </label>
      </div>

      <div className="flex flex-col gap-1">
        {effective.stops.map((stop, idx) => (
          <div
            key={rampStopKey(stop)}
            className="flex items-center gap-2"
            data-testid={`ramp-stop-${idx.toString()}`}
          >
            <Input
              className="h-7 w-24 text-xs"
              type="number"
              step="any"
              value={stop.value}
              aria-label={`Stop ${(idx + 1).toString()} value`}
              onChange={(e) => {
                handleStopValue(idx, e.target.value)
              }}
            />
            <input
              type="color"
              value={stop.color}
              aria-label={`Stop ${(idx + 1).toString()} color`}
              className="h-7 w-10 cursor-pointer rounded border border-input bg-bg p-0.5"
              onChange={(e) => {
                handleStopColor(idx, e.target.value)
              }}
            />
            <span className="font-mono text-[10px] text-text-muted">{stop.color}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canRemove}
              onClick={() => {
                handleRemoveStop(idx)
              }}
              data-testid={`ramp-remove-${idx.toString()}`}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canAdd}
        onClick={handleAddStop}
        data-testid="ramp-add"
      >
        Add stop ({stopCount.toString()} / {MAX_RAMP_STOPS.toString()})
      </Button>

      <div
        data-testid="ramp-preview"
        aria-label="Color ramp preview"
        className="h-4 w-full rounded border border-input"
        style={{ background: gradient }}
      />
    </div>
  )
}
