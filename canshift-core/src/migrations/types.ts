export type MigrationFn = (config: Record<string, unknown>) => Record<string, unknown>

export interface Migration {
  fromVersion: string
  toVersion: string
  migrate: MigrationFn
}

export type MigrationRegistry = Migration[]

export interface MigrationResult {
  config: Record<string, unknown>
  applied: string[]
}
