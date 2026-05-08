// sdState.test.ts — Locks the writability + warning copy policy for the
// CMD_GET_STATUS SD-state field (issue #252).

import { describe, expect, it } from 'vitest'
import { isSdWritable, sdBurnDisabledTooltip, sdStateWarning } from './sdState'

describe('isSdWritable', () => {
  it('allows persistent writes when SD is mounted', () => {
    expect(isSdWritable('ok')).toBe(true)
  })

  it('allows writes when the firmware is too old to advertise SD state', () => {
    // 'unknown' covers pre-#201 firmware. We don't gate the UI on a missing
    // field so devices we haven't reflashed yet still behave normally.
    expect(isSdWritable('unknown')).toBe(true)
  })

  it('blocks writes when no card is inserted', () => {
    expect(isSdWritable('no_card')).toBe(false)
  })

  it('blocks writes when the SD card mount failed', () => {
    expect(isSdWritable('mount_failed')).toBe(false)
  })
})

describe('sdStateWarning', () => {
  it('returns null while the device is healthy', () => {
    expect(sdStateWarning('ok')).toBeNull()
    expect(sdStateWarning('unknown')).toBeNull()
  })

  it('mentions the missing card for no_card', () => {
    const text = sdStateWarning('no_card')
    expect(text).toMatch(/no sd card/i)
    expect(text).toMatch(/writes will fail/i)
  })

  it('mentions the mount failure for mount_failed', () => {
    const text = sdStateWarning('mount_failed')
    expect(text).toMatch(/mount failed/i)
    expect(text).toMatch(/writes will fail/i)
  })
})

describe('sdBurnDisabledTooltip', () => {
  it('returns null when burn is allowed', () => {
    expect(sdBurnDisabledTooltip('ok')).toBeNull()
    expect(sdBurnDisabledTooltip('unknown')).toBeNull()
  })

  it('returns actionable copy when SD is missing', () => {
    expect(sdBurnDisabledTooltip('no_card')).toMatch(/insert/i)
  })

  it('returns actionable copy when SD mount failed', () => {
    expect(sdBurnDisabledTooltip('mount_failed')).toMatch(/re-?seat|reformat/i)
  })
})
