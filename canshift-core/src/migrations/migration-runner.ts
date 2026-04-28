// migration-runner.ts — Schema version migration framework
//
// When a config file has an older schema version, apply the migration chain
// to bring it up to the current version.
//
// Migration strategy:
//   - Each migration is a pure function: (oldConfig) => newConfig
//   - Migrations are chained: 1.0.0 → 1.1.0 → 1.2.0 etc.
//   - The runner applies all migrations between the file version and current version
//
// TODO: Add actual migration implementations as schema evolves.

export type MigrationFn = (config: Record<string, unknown>) => Record<string, unknown>

interface Migration {
  fromVersion: string
  toVersion:   string
  migrate:     MigrationFn
}

// ---------------------------------------------------------------------------
// Registered migrations (add new migrations here as schema evolves)
// ---------------------------------------------------------------------------
const MIGRATIONS: Migration[] = [
  // Example (not needed yet):
  // {
  //   fromVersion: '1.0.0',
  //   toVersion:   '1.1.0',
  //   migrate: (config) => ({
  //     ...config,
  //     version: '1.1.0',
  //     newField: 'defaultValue',
  //   }),
  // },
]

export interface MigrationResult {
  config:  Record<string, unknown>
  applied: string[]   // List of migration steps applied
}

/**
 * Apply all migrations to bring config from its current version to targetVersion.
 * Returns the migrated config and the list of migrations applied.
 */
export function migrateConfig(
  config: Record<string, unknown>,
  targetVersion: string
): MigrationResult {
  const currentVersion = (config.version as string | undefined) ?? '0.0.0'
  let current = { ...config }
  const applied: string[] = []

  if (currentVersion === targetVersion) {
    return { config: current, applied }
  }

  // Find applicable migrations in order
  const chain = buildMigrationChain(currentVersion, targetVersion)

  for (const migration of chain) {
    current = migration.migrate(current)
    applied.push(`${migration.fromVersion} → ${migration.toVersion}`)
  }

  return { config: current, applied }
}

function buildMigrationChain(fromVersion: string, toVersion: string): Migration[] {
  // Simple linear chain — find migrations that connect fromVersion to toVersion
  const chain: Migration[] = []
  let current = fromVersion

  while (current !== toVersion) {
    const next = MIGRATIONS.find((m) => m.fromVersion === current)
    if (!next) {
      throw new Error(
        `No migration path from ${current} to ${toVersion}. ` +
        `Available migrations: ${MIGRATIONS.map((m) => `${m.fromVersion}→${m.toVersion}`).join(', ')}`
      )
    }
    chain.push(next)
    current = next.toVersion
  }

  return chain
}
