// ota-cache.ts — Pure-logic helper for validating a cached OTA flow entry.
// Checks file existence on disk and enforces a 24-hour TTL.
// Release version matching is the caller's responsibility (call-site concern).

import * as FileSystem from 'expo-file-system'
import type { OtaFlowState } from '../stores/ota-flow.store'

const TTL_MS = 24 * 60 * 60 * 1000 // 24 h

/**
 * Returns true when the cached entry is safe to reuse:
 *   - stage is 'verified'
 *   - verified within the last 24 hours
 *   - local file still exists on disk
 *
 * Does NOT check release version — callers must compare
 * `entry.release?.version` against the selected release before calling.
 */
export async function isStillValid(entry: OtaFlowState): Promise<boolean> {
  if (entry.stage !== 'verified' || !entry.release || !entry.localPath || !entry.verifiedAt) {
    return false
  }
  if (Date.now() - entry.verifiedAt > TTL_MS) {
    return false
  }
  const info = await FileSystem.getInfoAsync(entry.localPath)
  return info.exists
}
