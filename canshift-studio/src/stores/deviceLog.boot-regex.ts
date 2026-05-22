// deviceLog.boot-regex.ts — Shared regex for the firmware boot banner.
//
// Pulled into its own module so `deviceLog.store` and `useFirmwareCheck` can
// both consume the canonical pattern without a circular import (the hook used
// to own it and now imports the store; the store needs to parse the same
// banner line on ingest to keep `bootLogVersion` derived).
//
// Pattern matches the formatted device-log entry the renderer ingests —
// firmware emits `LOG_INFO("BOOT", "CANShift v" APP_VERSION_STR " starting")`
// which arrives here as `{ tag: 'BOOT', message: 'CANShift vX.Y.Z starting' }`.

export const BOOT_VERSION_RE = /\bCANShift v(\d+\.\d+\.\d+)\b/
