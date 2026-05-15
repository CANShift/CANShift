// cli-log-bus.test.ts — Contract coverage for the cross-window log bus
// (#433, #484, #575).
//
// The bus is intentionally module-scoped — there is exactly one ring buffer
// and one subscriber set per main process. These tests exercise the parts
// that proved fragile in #484 and #575:
//
//   • Sender dedup by `webContents.id` so a renderer never receives its own
//     forwarded log back as a broadcast (would create a feedback loop with
//     `pushFromBridge`).
//   • Backlog ordering and ring-buffer trimming so a late-joining detached
//     window sees the most recent entries.
//   • Destroyed subscribers get pruned on the next publish so the bus
//     doesn't leak references across window lifetimes.
//
// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __flushForTests,
  __resetForTests,
  getBacklog,
  publish,
  subscribe,
  unsubscribe,
} from './cli-log-bus'
import type { CliLogPayload } from '../../shared/cli-detach.types'

interface FakeWebContents {
  id: number
  __destroyed: boolean
  __sends: { channel: string; payload: unknown }[]
  send: (channel: string, payload: unknown) => void
  isDestroyed: () => boolean
}

function makeWc(id: number): FakeWebContents {
  const wc: FakeWebContents = {
    id,
    __destroyed: false,
    __sends: [],
    send: (channel, payload) => {
      wc.__sends.push({ channel, payload })
    },
    isDestroyed: () => wc.__destroyed,
  }
  return wc
}

function payload(id: number, message: string): CliLogPayload {
  return { id, level: 'info', message, timestampMs: id * 1000 }
}

beforeEach(() => {
  __resetForTests()
})

afterEach(() => {
  __resetForTests()
})

describe('cli-log-bus — subscribe / publish fan-out', () => {
  it('broadcasts to every subscriber EXCEPT the sender (matched by id)', () => {
    const main = makeWc(10)
    const detached = makeWc(20)
    // Realistic cast — the bus only consumes `id`, `send`, and `isDestroyed`.
    subscribe(main as unknown as Electron.WebContents)
    subscribe(detached as unknown as Electron.WebContents)

    publish(payload(1, 'from main'), main.id)
    __flushForTests()

    expect(main.__sends).toHaveLength(0)
    expect(detached.__sends).toHaveLength(1)
    expect(detached.__sends[0]?.payload).toEqual([payload(1, 'from main')])
  })

  it('coalesces multiple publishes in the same tick into one batched send', () => {
    const main = makeWc(10)
    const detached = makeWc(20)
    subscribe(main as unknown as Electron.WebContents)
    subscribe(detached as unknown as Electron.WebContents)

    publish(payload(1, 'a'), main.id)
    publish(payload(2, 'b'), main.id)
    publish(payload(3, 'c'), main.id)
    __flushForTests()

    expect(detached.__sends).toHaveLength(1)
    expect(detached.__sends[0]?.payload).toEqual([
      payload(1, 'a'),
      payload(2, 'b'),
      payload(3, 'c'),
    ])
  })

  it('still publishes to the backlog for sender-suppressed entries', () => {
    // This is the property the detached window's seed relies on: even when
    // the bus skips broadcasting to the sender, the entry MUST land in the
    // ring buffer so a future `CLI_GET_STATE` returns it.
    const main = makeWc(10)
    subscribe(main as unknown as Electron.WebContents)

    publish(payload(1, 'first'), main.id)
    publish(payload(2, 'second'), main.id)
    __flushForTests()

    expect(getBacklog()).toEqual([payload(1, 'first'), payload(2, 'second')])
    expect(main.__sends).toHaveLength(0)
  })

  it('prunes destroyed subscribers on the next publish (no leak)', () => {
    const main = makeWc(10)
    const stale = makeWc(20)
    subscribe(main as unknown as Electron.WebContents)
    subscribe(stale as unknown as Electron.WebContents)

    stale.__destroyed = true

    publish(payload(1, 'after stale died'), main.id)
    __flushForTests()

    // Stale wc must NOT receive the broadcast, and a second publish must
    // not even attempt it.
    expect(stale.__sends).toHaveLength(0)
    publish(payload(2, 'second pass'), main.id)
    __flushForTests()
    expect(stale.__sends).toHaveLength(0)
  })

  it('honours explicit unsubscribe', () => {
    const wc = makeWc(42)
    subscribe(wc as unknown as Electron.WebContents)
    unsubscribe(wc as unknown as Electron.WebContents)

    // Sender id intentionally different — no skip applies here.
    publish(payload(1, 'after unsub'), 999)
    __flushForTests()
    expect(wc.__sends).toHaveLength(0)
  })
})

describe('cli-log-bus — ring buffer', () => {
  it('caps the backlog and returns a defensive copy', () => {
    for (let i = 1; i <= 2010; i++) {
      publish(payload(i, `entry ${i.toString()}`), 999)
    }
    const backlog = getBacklog()
    expect(backlog).toHaveLength(2000)
    // The oldest entries are evicted first.
    expect(backlog[0]).toMatchObject({ id: 11 })
    expect(backlog[backlog.length - 1]).toMatchObject({ id: 2010 })

    // Defensive copy — mutating the returned array must not affect the bus.
    const mutable = backlog as CliLogPayload[]
    mutable.push(payload(99999, 'spurious'))
    expect(getBacklog()).toHaveLength(2000)
  })
})
