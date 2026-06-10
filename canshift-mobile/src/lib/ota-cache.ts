import * as FileSystem from 'expo-file-system'
import type { OtaFlowState } from '../stores/ota-flow.store'

const TTL_MS = 24 * 60 * 60 * 1000

export const isStillValid = async (entry: OtaFlowState): Promise<boolean> => {
  if (entry.stage !== 'verified' || !entry.release || !entry.localPath || !entry.verifiedAt) {
    return false
  }
  if (Date.now() - entry.verifiedAt > TTL_MS) {
    return false
  }
  const info = await FileSystem.getInfoAsync(entry.localPath)
  return info.exists
}
