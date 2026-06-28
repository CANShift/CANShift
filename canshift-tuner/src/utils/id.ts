let fallbackCounter = 0

export const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  fallbackCounter += 1
  return `id_${Date.now().toString(36)}_${fallbackCounter.toString(36)}`
}

export const createId = (prefix: string): string => `${prefix}_${newId()}`
