import { sql } from 'drizzle-orm'

import type { DbType } from './types'

/**
 * Repair schemas created by retired personal V2 preview migrations.
 *
 * Keep this compatibility policy outside the shared migration runner so the
 * downstream migration history has one explicit ownership boundary.
 */
export function applyForkMigrationCompatibility(db: DbType): void {
  // Personal V2 previews created this schema before it was regenerated after upstream migration 0018.
  // Keep the appended migration replayable; reconcile SQLite's conditional column additions here.
  ensureColumn(db, 'translate_history', 'model_id', 'text')
  ensureColumn(db, 'translate_history', 'cache_key', 'text')
  db.run(sql.raw('CREATE INDEX IF NOT EXISTS `translate_history_cache_key_idx` ON `translate_history` (`cache_key`)'))
  db.run(sql.raw('CREATE INDEX IF NOT EXISTS `translate_history_model_id_idx` ON `translate_history` (`model_id`)'))

  // Earlier fork builds used migration 0021 before upstream assigned it to paired devices.
  if (hasForkMigration0021(db)) {
    db.run(
      sql.raw(`CREATE TABLE IF NOT EXISTS \`api_gateway_paired_device\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`platform\` text NOT NULL,
      \`token_hash\` text NOT NULL,
      \`created_at\` integer NOT NULL,
      \`updated_at\` integer NOT NULL
    )`)
    )
    db.run(
      sql.raw(
        'CREATE UNIQUE INDEX IF NOT EXISTS `api_gateway_paired_device_token_hash_unique_idx` ON `api_gateway_paired_device` (`token_hash`)'
      )
    )
  }

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

function hasForkMigration0021(db: DbType): boolean {
  const rows = db.all(sql.raw('SELECT 1 FROM `__drizzle_migrations` WHERE `created_at` = 1788397124856 LIMIT 1'))
  return rows.length > 0
}
