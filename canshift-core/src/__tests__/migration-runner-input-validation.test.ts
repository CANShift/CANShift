import { migrateConfig } from '../migrations/migration-runner.js'

describe('migrateConfig — input validation', () => {
  it('throws when input is null', () => {
    expect(() => migrateConfig(null as unknown as Record<string, unknown>, '1.17.0')).toThrow(
      /input must be a non-null object/
    )
  })

  it('throws when input is undefined', () => {
    expect(() => migrateConfig(undefined as unknown as Record<string, unknown>, '1.17.0')).toThrow(
      /input must be a non-null object/
    )
  })

  it('throws when input is an array (not a plain object)', () => {
    expect(() => migrateConfig([] as unknown as Record<string, unknown>, '1.17.0')).toThrow(
      /input must be a non-null object/
    )
  })

  it('throws when input is missing a version field', () => {
    expect(() => migrateConfig({}, '1.17.0')).toThrow(
      /input\.version is not a string \(got undefined\)/
    )
  })

  it('throws when input.version is a number', () => {
    expect(() => migrateConfig({ version: 42 }, '1.17.0')).toThrow(
      /input\.version is not a string \(got number\)/
    )
  })

  it('throws when input.version is null', () => {
    expect(() => migrateConfig({ version: null }, '1.17.0')).toThrow(
      /input\.version is not a string \(got null\)/
    )
  })

  it('throws when input.version is a boolean', () => {
    expect(() => migrateConfig({ version: true }, '1.17.0')).toThrow(
      /input\.version is not a string \(got boolean\)/
    )
  })

  it('throws when input.version is an empty string', () => {
    expect(() => migrateConfig({ version: '' }, '1.17.0')).toThrow(
      /input\.version is an empty string/
    )
  })

  it('throws when input.version is not a semver triple ("not-semver")', () => {
    expect(() => migrateConfig({ version: 'not-semver' }, '1.17.0')).toThrow(
      /input\.version "not-semver" does not match semver pattern "MAJOR\.MINOR\.PATCH"/
    )
  })

  it('throws when input.version is a 2-part version ("1.0")', () => {
    expect(() => migrateConfig({ version: '1.0' }, '1.17.0')).toThrow(
      /does not match semver pattern/
    )
  })

  it('throws when input.version has a leading "v" prefix', () => {
    expect(() => migrateConfig({ version: 'v1.0.0' }, '1.17.0')).toThrow(
      /does not match semver pattern/
    )
  })

  it('accepts a well-formed semver string (no-op when already at target)', () => {
    expect(() => migrateConfig({ version: '1.17.0' }, '1.17.0')).not.toThrow()
  })
})
