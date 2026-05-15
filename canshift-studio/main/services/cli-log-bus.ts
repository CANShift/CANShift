// cli-log-bus.ts — Cross-window log bridge for the detached CLI BrowserWindow
// (issue #433).
//
// When the user detaches the CLI panel into its own window, log entries that
// are produced in one renderer (e.g. USB telemetry events arriving in the
// main app window) need to reach the other renderer too. The bus:
//
//   • keeps a bounded ring buffer of the most recent payloads, so a window
//     that subscribes after a long delay can replay the backlog;
//   • tracks subscribed `WebContents` and rebroadcasts each push to every
//     subscriber EXCEPT the original sender (matched by `webContents.id`).
//
// IPC fan-out is coalesced on a microtask: every `publish()` queues into a
// per-subscriber pending list, and the very next event-loop turn flushes the
// queue as a single `webContents.send` per subscriber. Under burst load (a
// firmware flash session can emit hundreds of log entries per second) this
// cuts the IPC round-trip count by 1-2 orders of magnitude (#712).

import type { WebContents } from 'electron'
import { IpcChannels } from '../ipc/ipc-channels'
import type { CliLogPayload } from '../ipc/cli-detach.types'

const RING_SIZE = 2000

const buffer: CliLogPayload[] = []
const subscribers = new Set<WebContents>()
// Per-subscriber pending entries waiting for the next coalesced flush.
const pending = new Map<WebContents, CliLogPayload[]>()
let flushScheduled = false

function pushToBuffer(entry: CliLogPayload): void {
  buffer.push(entry)
  if (buffer.length > RING_SIZE) {
    buffer.splice(0, buffer.length - RING_SIZE)
  }
}

function scheduleFlush(): void {
  if (flushScheduled) return
  flushScheduled = true
  // queueMicrotask coalesces every `publish()` made in the current event-loop
  // turn into a single send per subscriber. Tighter than setImmediate (which
  // would yield to I/O first) and bounded by the runtime, so we don't risk
  // unbounded queuing under sustained pressure.
  queueMicrotask(flush)
}

function flush(): void {
  flushScheduled = false
  for (const [wc, entries] of pending) {
    pending.delete(wc)
    if (entries.length === 0) continue
    if (wc.isDestroyed()) {
      subscribers.delete(wc)
      continue
    }
    wc.send(IpcChannels.CLI_LOG_BROADCAST_BATCH, entries)
  }
}

/** Returns a defensive copy of the current backlog. */
export function getBacklog(): readonly CliLogPayload[] {
  return buffer.slice()
}

/**
 * Registers `wc` as a subscriber. The same `WebContents` registering twice is
 * deduplicated by the underlying `Set`. The caller is expected to invoke
 * `unsubscribe()` from a `'destroyed'` listener to avoid leaking refs across
 * window lifetimes.
 */
export function subscribe(wc: WebContents): void {
  subscribers.add(wc)
}

export function unsubscribe(wc: WebContents): void {
  subscribers.delete(wc)
  pending.delete(wc)
}

/**
 * Records `entry` in the backlog and queues it for rebroadcast to every
 * subscriber other than the sender. The actual `webContents.send` is
 * coalesced via `queueMicrotask` so a burst of `publish()` calls in the same
 * tick results in a single batched send per subscriber.
 */
export function publish(entry: CliLogPayload, senderId: number): void {
  pushToBuffer(entry)
  for (const wc of subscribers) {
    if (wc.id === senderId) continue
    if (wc.isDestroyed()) {
      subscribers.delete(wc)
      pending.delete(wc)
      continue
    }
    let queue = pending.get(wc)
    if (queue === undefined) {
      queue = []
      pending.set(wc, queue)
    }
    queue.push(entry)
  }
  if (pending.size > 0) scheduleFlush()
}

/** Test-only — clears state between cases. */
export function __resetForTests(): void {
  buffer.length = 0
  subscribers.clear()
  pending.clear()
  flushScheduled = false
}

/** Test-only — synchronously drain any queued broadcasts. */
export function __flushForTests(): void {
  flush()
}
