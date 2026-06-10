import {
  describeOtaError,
  describeOtaErrorForUser,
  mapOtaError,
  OtaServiceError,
  type OtaError,
} from './ota.errors'

const allVariants: OtaError[] = [
  { kind: 'releases-fetch-failed' },
  { kind: 'releases-fetch-failed', status: 502 },
  { kind: 'no-binary-asset', version: '0.7.1' },
  { kind: 'download-failed', reason: 'connection reset' },
  { kind: 'size-mismatch', expected: 1_352_544, actual: 1_352_000 },
  {
    kind: 'checksum-mismatch',
    expected: 'a'.repeat(64),
    actual: 'b'.repeat(64),
  },
  { kind: 'hmac-prepare-failed', reason: 'disk full' },
  { kind: 'network-dropped' },
  { kind: 'device-unreachable' },
  { kind: 'device-rejected', status: 500 },
  { kind: 'unknown', message: 'something went wrong' },
]

describe('mapOtaError', () => {
  it('unwraps OtaServiceError to the underlying cause', () => {
    const cause: OtaError = { kind: 'network-dropped' }
    const wrapped = new OtaServiceError(cause)
    expect(mapOtaError(wrapped)).toEqual(cause)
  })

  it('falls back to { kind: "unknown" } for plain Errors', () => {
    expect(mapOtaError(new Error('boom'))).toEqual({
      kind: 'unknown',
      message: 'boom',
    })
  })

  it('falls back to { kind: "unknown" } for raw strings', () => {
    expect(mapOtaError('boom')).toEqual({
      kind: 'unknown',
      message: 'boom',
    })
  })

  it('falls back to a stable message for non-Error objects', () => {
    expect(mapOtaError({ weird: true })).toEqual({
      kind: 'unknown',
      message: 'Unknown OTA error',
    })
  })
})

describe('describeOtaErrorForUser', () => {
  it.each(allVariants)('produces a non-empty user-facing string for %s', (v) => {
    const msg = describeOtaErrorForUser(v)
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  it('mentions HTTP status for releases-fetch-failed when known', () => {
    expect(describeOtaErrorForUser({ kind: 'releases-fetch-failed', status: 502 })).toMatch(
      /HTTP 502/
    )
  })

  it('omits HTTP status for releases-fetch-failed when unknown', () => {
    expect(describeOtaErrorForUser({ kind: 'releases-fetch-failed' })).not.toMatch(/HTTP/)
  })

  it('points the user to the Wi-Fi step for device-unreachable', () => {
    expect(describeOtaErrorForUser({ kind: 'device-unreachable' })).toMatch(/canshift-XXXX/i)
  })

  it('reports both expected and actual sizes for size-mismatch', () => {
    const msg = describeOtaErrorForUser({
      kind: 'size-mismatch',
      expected: 100,
      actual: 90,
    })
    expect(msg).toMatch(/100/)
    expect(msg).toMatch(/90/)
  })
})

describe('describeOtaError (log copy)', () => {
  it.each(allVariants)('produces a non-empty log string for %s', (v) => {
    expect(describeOtaError(v).length).toBeGreaterThan(0)
  })
})

describe('OtaServiceError', () => {
  it('exposes the cause and a human message', () => {
    const e = new OtaServiceError({ kind: 'network-dropped' })
    expect(e.cause.kind).toBe('network-dropped')
    expect(e.message).toMatch(/network/i)
    expect(e.name).toBe('OtaServiceError')
  })
})
