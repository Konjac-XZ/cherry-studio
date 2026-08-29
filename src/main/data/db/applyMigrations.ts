import { loggerService } from '@logger'
import { sql } from 'drizzle-orm'
// The one sanctioned call site: this module is what wraps migrate() in the foreign-key
// handling that the ban points every other caller to.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import { CUSTOM_SQL_STATEMENTS } from './customSqls'
import type { DbType } from './types'

const logger = loggerService.withContext('applyMigrations')

/**
 * Apply drizzle migrations, then the custom SQL drizzle cannot manage
 * (FTS5 virtual tables, triggers — all idempotent, see customSqls.ts).
 *
 * Pure function over an injected connection so all three consumers share one
 * migration path: DbService.onInit (live DB), the test harness (throwaway DB),
 * and the backup restore pipeline (detached work.sqlite migrate-forward).
 */
export function applyMigrations(db: DbType, migrationsFolder: string): void {
  // SQLite cannot alter a table constraint in place, so drizzle-kit compiles any
  // constraint / column-type change into a table recreate (CREATE __new_x →
  // INSERT SELECT → DROP x → RENAME) guarded by its own `PRAGMA foreign_keys=OFF`.
  // That guard never takes effect: drizzle-orm's migrator wraps every statement in
  // one transaction, and SQLite documents the pragma as a no-op inside one — so the
  // DROP fires every child's ON DELETE action and silently takes their rows with it.
  // Toggling enforcement here, outside the migrator's transaction, is the only place
  // it actually applies.
  const enforced = isForeignKeysEnforced(db)
  db.run(sql.raw('PRAGMA foreign_keys = OFF'))
  try {
    migrate(db, { migrationsFolder })
  } finally {
    db.run(sql.raw(`PRAGMA foreign_keys = ${enforced ? 'ON' : 'OFF'}`))
  }

  // Personal V2 previews created this schema before it was regenerated after upstream migration 0018.
  // Keep the appended migration replayable; reconcile SQLite's conditional column additions here.
  ensureColumn(db, 'translate_history', 'model_id', 'text')
  ensureColumn(db, 'translate_history', 'cache_key', 'text')
  db.run(sql.raw('CREATE INDEX IF NOT EXISTS `translate_history_cache_key_idx` ON `translate_history` (`cache_key`)'))
  db.run(sql.raw('CREATE INDEX IF NOT EXISTS `translate_history_model_id_idx` ON `translate_history` (`model_id`)'))

  if (hasRetiredPersonalMigrationCollision(db)) {
    ensureColumn(db, 'user_model', 'input_modalities_explicit', 'integer DEFAULT false NOT NULL')
    ensureColumn(
      db,
      'prompt',
      'visibility',
      "text DEFAULT 'global' NOT NULL CHECK (`visibility` IN ('global', 'restricted'))"
    )
    db.run(
      sql.raw(`CREATE TABLE IF NOT EXISTS \`prompt_binding\` (
        \`prompt_id\` text NOT NULL,
        \`target_type\` text NOT NULL,
        \`target_id\` text NOT NULL,
        \`order_key\` text NOT NULL,
        \`created_at\` integer NOT NULL,
        \`updated_at\` integer NOT NULL,
        PRIMARY KEY(\`prompt_id\`, \`target_type\`, \`target_id\`),
        FOREIGN KEY (\`prompt_id\`) REFERENCES \`prompt\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        CONSTRAINT "prompt_binding_target_type_check" CHECK(\`target_type\` IN ('assistant', 'agent'))
      )`)
    )
    db.run(
      sql.raw(
        'CREATE INDEX IF NOT EXISTS `prompt_binding_target_idx` ON `prompt_binding` (`target_type`,`target_id`,`prompt_id`)'
      )
    )
    db.run(
      sql.raw(
        'CREATE INDEX IF NOT EXISTS `prompt_binding_target_order_key_idx` ON `prompt_binding` (`target_type`,`target_id`,`order_key`)'
      )
    )
  }

  // Enforcement was on before the call, so anything reported now is a dangling
  // reference the migration itself introduced. Boot must not be blocked over it —
  // applyMigrations is also the restore and test-harness path, and a hard failure
  // would be unrecoverable for the user — but it must never pass unremarked.
  if (enforced) {
    const violations = db.all(sql.raw('PRAGMA foreign_key_check'))
    if (violations.length > 0) {
      logger.error('Migration left dangling foreign key references', { violations })
    }
  }

  for (const statement of CUSTOM_SQL_STATEMENTS) {
    db.run(sql.raw(statement))
  }
}

function isForeignKeysEnforced(db: DbType): boolean {
  const rows = db.all(sql.raw('PRAGMA foreign_keys')) as Array<{ foreign_keys?: number }>
  return Number(rows[0]?.foreign_keys ?? 0) === 1
}

function ensureColumn(db: DbType, table: string, column: string, definition: string): void {
  const columns = db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`)) as Array<{ name?: string }>
  if (!columns.some((candidate) => candidate.name === column)) {
    db.run(sql.raw(`ALTER TABLE \`${table}\` ADD \`${column}\` ${definition}`))
  }
}

function hasRetiredPersonalMigrationCollision(db: DbType): boolean {
  const rows = db.all(sql.raw('SELECT 1 FROM `__drizzle_migrations` WHERE `created_at` = 1787479168062 LIMIT 1'))
  return rows.length > 0
}
