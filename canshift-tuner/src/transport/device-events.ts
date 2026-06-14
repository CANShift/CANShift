import {
  CanFrameSchema,
  HeapStatsFrameWireSchema,
  LogFrameSchema,
  TeleFrameSchema,
  heapStatsFromWire,
} from '@tmbk/canshift-core'

import type { Handler, Unsubscribe } from './types'
import { isRecord } from './types'
import { getSerialClient } from './webserial-client'

const SEEN_SCHEMA_ERRORS_CAP = 100
const seenSchemaErrors = new Set<string>()

const warnFrameDrop = (discriminator: string, code: string, sample: string): void => {
  const key = `${discriminator}:${code}`
  if (seenSchemaErrors.has(key)) return
  if (seenSchemaErrors.size >= SEEN_SCHEMA_ERRORS_CAP) {
    const oldest = seenSchemaErrors.values().next().value
    if (oldest !== undefined) seenSchemaErrors.delete(oldest)
  }
  seenSchemaErrors.add(key)
  console.warn(`[serial] dropping ${discriminator} frame — ${code} (${sample})`)
}

export const deviceEvents = {
  onLogLine: (handler: Handler<{ level: string; tag: string; message: string }>): Unsubscribe => {
    return getSerialClient().subscribe('log', (frame) => {
      const parsed = LogFrameSchema.safeParse(frame)
      if (!parsed.success) {
        warnFrameDrop('log', parsed.error.issues[0]?.code ?? 'unknown', JSON.stringify(frame))
        return
      }
      handler({
        level: parsed.data.lvl,
        tag: parsed.data.tag,
        message: parsed.data.msg,
      })
    })
  },

  onCanFrame: (handler: Handler<{ id: number; len: number; data: number[] }>): Unsubscribe => {
    return getSerialClient().subscribe('can', (frame) => {
      const parsed = CanFrameSchema.safeParse(frame)
      if (!parsed.success) {
        warnFrameDrop('can', parsed.error.issues[0]?.code ?? 'unknown', JSON.stringify(frame))
        return
      }
      if (!isRecord(frame)) return
      const id = typeof frame.id === 'number' ? frame.id : null
      const len = typeof frame.len === 'number' ? frame.len : null
      const raw = Array.isArray(frame.d) ? frame.d : null
      if (id === null || len === null || raw === null) return
      const data = raw.filter((b): b is number => typeof b === 'number')
      handler({ id, len, data })
    })
  },

  onSignal: (handler: Handler<Record<string, number>>): Unsubscribe => {
    return getSerialClient().subscribe('tele', (frame) => {
      const parsed = TeleFrameSchema.safeParse(frame)
      if (!parsed.success) {
        warnFrameDrop('tele', parsed.error.issues[0]?.code ?? 'unknown', JSON.stringify(frame))
        return
      }
      const flat: Record<string, number> = {}
      for (const [k, v] of Object.entries(parsed.data.v)) {
        if (typeof v === 'number') flat[k] = v
      }
      handler(flat)
    })
  },

  onHeapStats: (
    handler: Handler<{
      tsMs: number
      freeInternal: number
      largestInternal: number
      freePsram: number | null
      largestPsram: number | null
    }>
  ): Unsubscribe => {
    return getSerialClient().subscribe('heap_stats', (frame) => {
      const parsed = HeapStatsFrameWireSchema.safeParse(frame)
      if (!parsed.success) {
        warnFrameDrop(
          'heap_stats',
          parsed.error.issues[0]?.code ?? 'unknown',
          JSON.stringify(frame)
        )
        return
      }
      handler(heapStatsFromWire(parsed.data))
    })
  },

  onCanHealth: (handler: Handler<{ fps: number; errors: number }>): Unsubscribe => {
    return getSerialClient().subscribe('can_stat', (frame) => {
      if (!isRecord(frame)) return
      handler({
        fps: typeof frame.fps === 'number' ? frame.fps : 0,
        errors: typeof frame.errors === 'number' ? frame.errors : 0,
      })
    })
  },

  onConnectionChange: (handler: Handler<{ connected: boolean; reason?: string }>): Unsubscribe => {
    return getSerialClient().onStatus((status, error) => {
      if (status === 'connected') {
        handler({ connected: true })
      } else if (error !== undefined) {
        handler({ connected: false, reason: error })
      } else {
        handler({ connected: false })
      }
    })
  },

  onActivity: (handler: Handler<'rx' | 'tx'>): Unsubscribe => {
    return getSerialClient().onActivity(handler)
  },
}
