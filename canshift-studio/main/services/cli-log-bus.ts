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
// All operations are synchronous — the actual IPC fan-out is a single
// `webContents.send` per subscriber, which is itself non-blocking.

import type { WebContents } from 'electron'
import { IpcChannels } from '../ipc/ipc-channels'
import type { CliLogPayload } from '../ipc/cli-detach.types'

const RING_SIZE = 2000

const buffer: CliLogPayload[] = []
const subscribers = new Set<WebContents>()

function pushToBuffer(entry: CliLogPayload): void {
  buffer.push(entry)
  if (buffer.length > RING_SIZE) {
    buffer.splice(0, buffer.length - RING_SIZE)
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
}

/**
 * Records `entry` in the backlog and rebroadcasts it to every subscriber
 * other than the sender.
 */
export function publish(entry: CliLogPayload, senderId: number): void {
  pushToBuffer(entry)
  for (const wc of subscribers) {
    if (wc.id === senderId) continue
    if (wc.isDestroyed()) {
      subscribers.delete(wc)
      continue
    }
    wc.send(IpcChannels.CLI_LOG_BROADCAST, entry)
  }
}

/** Test-only — clears state between cases. */
export function __resetForTests(): void {
  buffer.length = 0
  subscribers.clear()
}
