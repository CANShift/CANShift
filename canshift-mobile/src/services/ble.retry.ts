// canshift-mobile/src/services/ble.retry.ts — transient GATT retry helper

const TRANSIENT_HINTS = ['GATT', 'busy', 'timed out', 'cancelled']

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return TRANSIENT_HINTS.some((hint) => msg.includes(hint))
}

/**
 * Retry a GATT operation up to `retries` times (default 1) with `backoffMs`
 * delay (default 500 ms) between attempts. Only transient errors (GATT busy /
 * timeout / cancelled) trigger a retry — non-transient errors throw immediately.
 */
export async function withGattRetry<T>(
  op: () => Promise<T>,
  { retries = 1, backoffMs = 500 }: { retries?: number; backoffMs?: number } = {}
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await op()
    } catch (err) {
      lastErr = err
      if (!isTransient(err) || attempt === retries) throw err
      await new Promise<void>((resolve) => setTimeout(resolve, backoffMs))
    }
  }
  // Unreachable — the loop always returns or throws, but TypeScript needs this.
  throw lastErr
}
