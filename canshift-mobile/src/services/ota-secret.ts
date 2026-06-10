import Constants from 'expo-constants'
import { Buffer } from 'buffer'

export const DEV_INSECURE_OTA_SECRET = 'DEV_INSECURE_REPLACE_BEFORE_PROD'

const readConfiguredSecret = (): string => {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>
  const candidate = extra.otaHmacSecret
  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate
  }
  return DEV_INSECURE_OTA_SECRET
}

export const getOtaHmacSecretBytes = (): Uint8Array => {
  return new Uint8Array(Buffer.from(readConfiguredSecret(), 'utf8'))
}
