const TRANSIENT_HINTS = ['GATT', 'busy', 'timed out', 'cancelled']

const isTransient = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err)
  return TRANSIENT_HINTS.some((hint) => msg.includes(hint))
}

export const withGattRetry = async <T>(
  op: () => Promise<T>,
  { retries = 1, backoffMs = 500 }: { retries?: number; backoffMs?: number } = {}
): Promise<T> => {
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
  throw lastErr
}
