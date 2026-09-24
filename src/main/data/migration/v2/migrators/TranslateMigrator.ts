/**
 * Translate Migrator - Migrates translate history, custom languages, and glossary from Dexie to SQLite
 *
 * Handles three tables in a single migrator since they belong to the same feature domain:
 *
 * 1. translate_history → translateHistoryTable
 *    - `createdAt`: ISO string → integer timestamp (fallback to Date.now() if parse fails)
 *    - `star`: preserved as boolean
 *    - `updatedAt`: generated as same value as createdAt (not present in old data)
 *
 * 2. translate_languages → translateLanguageTable
 *    - `createdAt` / `updatedAt`: generated as Date.now() (not present in old data)
 *    - All other fields preserved as-is
 *
 * 3. translate_glossary → translateGlossaryTable
 *    - Preserves phrases, target language, enabled state, and timestamps
 *    - Runs after builtin/custom languages exist so every retained FK resolves
 */

import { sql } from 'drizzle-orm'

import { translateGlossaryTable } from '@data/db/schemas/translateGlossary'
import { translateHistoryTable } from '@data/db/schemas/translateHistory'
import { translateLanguageTable } from '@data/db/schemas/translateLanguage'
import { TranslateLanguageSeeder } from '@data/db/seeding/seeders/translateLanguageSeeder'
import { loggerService } from '@logger'
import type { ExecuteResult, PrepareResult, ValidateResult, ValidationError } from '@shared/data/migration/v2/types'

import type { MigrationContext } from '../core/MigrationContext'
import { BaseMigrator } from './BaseMigrator'
import {
  type LegacyTranslateHistoryRecord,
  type MigratedTranslateHistoryRecord,
  transformTranslateHistoryRecord
} from './transformers/TranslateTransformers'

const logger = loggerService.withContext('TranslateMigrator')

const HISTORY_BATCH_SIZE = 100

// ─── Old data interfaces ────────────────────────────────────────────

interface OldCustomTranslateLanguage {
  id: string
  langCode: string
  value: string
  emoji: string
}

interface OldGlossaryEntry {
  id: string
  sourcePhrase: string
  targetPhrase: string
  targetLanguage: string
  enabled?: boolean
  createdAt: number
  updatedAt: number
}

// ─── New data interfaces ────────────────────────────────────────────

interface NewTranslateLanguage {
  langCode: string
  value: string
  emoji: string
  createdAt: number
  updatedAt: number
}

// ─── Transform functions ────────────────────────────────────────────

function transformLanguageRecord(old: OldCustomTranslateLanguage, now: number): NewTranslateLanguage {
  return {
    langCode: old.langCode,
    value: old.value,
    emoji: old.emoji,
    createdAt: now,
    updatedAt: now
  }
}

// ─── Migrator ───────────────────────────────────────────────────────

export class TranslateMigrator extends BaseMigrator {
  readonly id = 'translate'
  readonly name = 'Translate'
  readonly description = 'Migrate translate history, custom languages, and glossary'
  readonly order = 5

  private historySourceCount = 0
  private historySkippedCount = 0
  private cachedHistoryRecords: LegacyTranslateHistoryRecord[] = []

  private languageSourceCount = 0
  private languageSkippedCount = 0
  private cachedLanguageRecords: OldCustomTranslateLanguage[] = []

  private glossarySourceCount = 0
  private glossarySkippedCount = 0
  private cachedGlossaryRecords: OldGlossaryEntry[] = []

  override reset(): void {
    this.historySourceCount = 0
    this.historySkippedCount = 0
    this.cachedHistoryRecords = []
    this.languageSourceCount = 0
    this.languageSkippedCount = 0
    this.cachedLanguageRecords = []
    this.glossarySourceCount = 0
    this.glossarySkippedCount = 0
    this.cachedGlossaryRecords = []
  }

  async prepare(ctx: MigrationContext): Promise<PrepareResult> {
    const warnings: string[] = []

    try {
      // Prepare translate history
      const historyExists = await ctx.sources.dexieExport.tableExists('translate_history')
      if (!historyExists) {
        logger.warn('translate_history.json not found, skipping')
        warnings.push('translate_history.json not found - no translate history to migrate')
      } else {
        this.cachedHistoryRecords =
          await ctx.sources.dexieExport.readTable<LegacyTranslateHistoryRecord>('translate_history')
        this.historySourceCount = this.cachedHistoryRecords.length
        logger.info(`Found ${this.historySourceCount} translate history records to migrate`)
      }

      // Prepare translate languages
      const languageExists = await ctx.sources.dexieExport.tableExists('translate_languages')
      if (!languageExists) {
        logger.warn('translate_languages.json not found, skipping')
        warnings.push('translate_languages.json not found - no custom languages to migrate')
      } else {
        this.cachedLanguageRecords =
          await ctx.sources.dexieExport.readTable<OldCustomTranslateLanguage>('translate_languages')
        this.languageSourceCount = this.cachedLanguageRecords.length
        logger.info(`Found ${this.languageSourceCount} custom translate languages to migrate`)
      }

      const glossaryExists = await ctx.sources.dexieExport.tableExists('translate_glossary')
      if (!glossaryExists) {
        warnings.push('translate_glossary.json not found - no glossary entries to migrate')
      } else {
        this.cachedGlossaryRecords = await ctx.sources.dexieExport.readTable<OldGlossaryEntry>('translate_glossary')
        this.glossarySourceCount = this.cachedGlossaryRecords.length
        logger.info(`Found ${this.glossarySourceCount} translate glossary entries to migrate`)
      }

      return {
        success: true,
        itemCount: this.historySourceCount + this.languageSourceCount + this.glossarySourceCount,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    } catch (error) {
      logger.error('Prepare failed', error as Error)
      return {
        success: false,
        itemCount: 0,
        warnings: [error instanceof Error ? error.message : String(error)]
      }
    }
  }

  async execute(ctx: MigrationContext): Promise<ExecuteResult> {
    const totalCount = this.historySourceCount + this.languageSourceCount + this.glossarySourceCount
    if (totalCount === 0) {
      return { success: true, processedCount: 0 }
    }

    try {
      const db = ctx.db
      let processedCount = 0

      // ── Migrate translate languages first (history has FK references) ──
      if (this.languageSourceCount > 0) {
        const now = Date.now()
        const newLanguageRecords: NewTranslateLanguage[] = []
        for (const old of this.cachedLanguageRecords) {
          if (!old.id || !old.langCode || !old.value || !old.emoji) {
            logger.warn(`Skipping invalid translate language record: ${old.id}`)
            this.languageSkippedCount++
            continue
          }
          newLanguageRecords.push(transformLanguageRecord(old, now))
        }

        if (newLanguageRecords.length > 0) {
          db.transaction((tx) => {
            tx.insert(translateLanguageTable).values(newLanguageRecords).run()
          })
          processedCount += newLanguageRecords.length
        }

        const langProgress = Math.round((processedCount / totalCount) * 100)
        this.reportProgress(langProgress, `Migrated ${newLanguageRecords.length} custom translate languages`, {
          key: 'migration.progress.migrated_translate_languages',
          params: { processed: newLanguageRecords.length, total: newLanguageRecords.length }
        })

        logger.info('Translate language migration completed', {
          processedCount: newLanguageRecords.length,
          skipped: this.languageSkippedCount
        })
      }

      // ── Seed builtin languages (history FK requires them to exist) ──
      new TranslateLanguageSeeder().run(db)

      // ── Migrate glossary (target language FK requires seeded languages) ──
      if (this.glossarySourceCount > 0) {
        const existingLangs = db
          .select({ langCode: translateLanguageTable.langCode })
          .from(translateLanguageTable)
          .all()
        const validLangCodes = new Set(existingLangs.map((row) => row.langCode))
        const records: Array<typeof translateGlossaryTable.$inferInsert> = []
        for (const old of this.cachedGlossaryRecords) {
          if (
            !old.id ||
            !old.sourcePhrase?.trim() ||
            !old.targetPhrase?.trim() ||
            !validLangCodes.has(old.targetLanguage)
          ) {
            logger.warn(`Skipping invalid translate glossary record: ${old.id}`)
            this.glossarySkippedCount++
            continue
          }
          records.push({
            id: old.id,
            sourcePhrase: old.sourcePhrase.trim(),
            targetPhrase: old.targetPhrase.trim(),
            targetLanguage: old.targetLanguage,
            enabled: old.enabled !== false,
            createdAt: Number.isFinite(old.createdAt) ? old.createdAt : Date.now(),
            updatedAt: Number.isFinite(old.updatedAt) ? old.updatedAt : Date.now()
          })
        }
        if (records.length > 0) db.insert(translateGlossaryTable).values(records).run()
        processedCount += records.length
      }

      // ── Migrate translate history (batched) ──
      if (this.historySourceCount > 0) {
        // Query all valid language codes to null-out dangling FK references
        const existingLangs = await db
          .select({ langCode: translateLanguageTable.langCode })
          .from(translateLanguageTable)
        const validLangCodes = new Set(existingLangs.map((r) => r.langCode))

        const newHistoryRecords: MigratedTranslateHistoryRecord[] = []
        for (const old of this.cachedHistoryRecords) {
          if (!old.id || !old.sourceText || !old.targetText) {
            logger.warn(`Skipping invalid translate history record: ${old.id}`)
            this.historySkippedCount++
            continue
          }
          newHistoryRecords.push(transformTranslateHistoryRecord(old, validLangCodes))
        }

        db.transaction((tx) => {
          for (let i = 0; i < newHistoryRecords.length; i += HISTORY_BATCH_SIZE) {
            const batch = newHistoryRecords.slice(i, i + HISTORY_BATCH_SIZE)
            tx.insert(translateHistoryTable).values(batch).run()

            const historyProcessed = Math.min(i + HISTORY_BATCH_SIZE, newHistoryRecords.length)
            const progress = Math.round(((processedCount + historyProcessed) / totalCount) * 100)
            this.reportProgress(
              progress,
              `Migrated ${historyProcessed}/${newHistoryRecords.length} translate history records`,
              {
                key: 'migration.progress.migrated_translate_history',
                params: { processed: historyProcessed, total: newHistoryRecords.length }
              }
            )
          }
        })

        processedCount += newHistoryRecords.length
        logger.info('Translate history migration completed', {
          processedCount: newHistoryRecords.length,
          skipped: this.historySkippedCount
        })
      }

      return { success: true, processedCount }
    } catch (error) {
      logger.error('Execute failed', error as Error)
      return {
        success: false,
        processedCount: 0,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async validate(ctx: MigrationContext): Promise<ValidateResult> {
    const errors: ValidationError[] = []
    const db = ctx.db

    try {
      // Validate translate history
      const historyResult = db
        .select({ count: sql<number>`count(*)` })
        .from(translateHistoryTable)
        .get()
      const historyTargetCount = historyResult?.count ?? 0
      const expectedHistoryCount = this.historySourceCount - this.historySkippedCount

      if (historyTargetCount < expectedHistoryCount) {
        errors.push({
          key: 'history_count_mismatch',
          message: `Expected ${expectedHistoryCount} history records, got ${historyTargetCount}`
        })
      }

      // Validate translate languages
      const languageResult = db
        .select({ count: sql<number>`count(*)` })
        .from(translateLanguageTable)
        .get()
      const languageTargetCount = languageResult?.count ?? 0
      const expectedLanguageCount = this.languageSourceCount - this.languageSkippedCount

      if (languageTargetCount < expectedLanguageCount) {
        errors.push({
          key: 'language_count_mismatch',
          message: `Expected ${expectedLanguageCount} language records, got ${languageTargetCount}`
        })
      }

      const glossaryResult = db
        .select({ count: sql<number>`count(*)` })
        .from(translateGlossaryTable)
        .get()
      const glossaryTargetCount = glossaryResult?.count ?? 0
      const expectedGlossaryCount = this.glossarySourceCount - this.glossarySkippedCount
      if (glossaryTargetCount < expectedGlossaryCount) {
        errors.push({
          key: 'glossary_count_mismatch',
          message: `Expected ${expectedGlossaryCount} glossary records, got ${glossaryTargetCount}`
        })
      }

      logger.info('Validation completed', {
        historySourceCount: this.historySourceCount,
        historyTargetCount,
        historySkippedCount: this.historySkippedCount,
        languageSourceCount: this.languageSourceCount,
        languageTargetCount,
        languageSkippedCount: this.languageSkippedCount
      })

      return {
        success: errors.length === 0,
        errors,
        stats: {
          sourceCount: this.historySourceCount + this.languageSourceCount + this.glossarySourceCount,
          targetCount: historyTargetCount + languageTargetCount + glossaryTargetCount,
          skippedCount: this.historySkippedCount + this.languageSkippedCount + this.glossarySkippedCount
        }
      }
    } catch (error) {
      logger.error('Validation failed', error as Error)
      return {
        success: false,
        errors: [{ key: 'validation', message: error instanceof Error ? error.message : String(error) }],
        stats: {
          sourceCount: this.historySourceCount + this.languageSourceCount,
          targetCount: 0,
          skippedCount: this.historySkippedCount + this.languageSkippedCount
        }
      }
    }
  }
}
