import { setupTestDatabase } from '@test-helpers/db'
import { describe, expect, it } from 'vitest'

import { translateGlossaryTable } from '@data/db/schemas/translateGlossary'

import { TranslateMigrator } from '../TranslateMigrator'

function createMigrationInput(db: unknown, tables: Record<string, unknown[]>) {
  return {
    db,
    sources: {
      dexieExport: {
        tableExists: async (name: string) => Object.hasOwn(tables, name),
        readTable: async (name: string) => tables[name] ?? []
      }
    },
    sharedData: new Map(),
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    paths: {}
  } as any
}

describe('TranslateMigrator glossary', () => {
  const dbh = setupTestDatabase()

  it('preserves valid legacy glossary entries and validates their count', async () => {
    const migrator = new TranslateMigrator()
    const migrationInput = createMigrationInput(dbh.db, {
      translate_glossary: [
        {
          id: 'legacy-glossary-1',
          sourcePhrase: 'OpenAI',
          targetPhrase: '开放人工智能',
          targetLanguage: 'zh-cn',
          enabled: false,
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_001_000
        }
      ]
    })

    await expect(migrator.prepare(migrationInput)).resolves.toMatchObject({ success: true, itemCount: 1 })
    await expect(migrator.execute(migrationInput)).resolves.toMatchObject({ success: true, processedCount: 1 })
    await expect(migrator.validate(migrationInput)).resolves.toMatchObject({ success: true })

    expect(dbh.db.select().from(translateGlossaryTable).all()).toEqual([
      expect.objectContaining({
        id: 'legacy-glossary-1',
        sourcePhrase: 'OpenAI',
        targetPhrase: '开放人工智能',
        targetLanguage: 'zh-cn',
        enabled: false,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_001_000
      })
    ])
  })

  it('skips glossary entries with dangling target languages', async () => {
    const migrator = new TranslateMigrator()
    const migrationInput = createMigrationInput(dbh.db, {
      translate_glossary: [
        {
          id: 'legacy-glossary-invalid',
          sourcePhrase: 'Term',
          targetPhrase: 'Target',
          targetLanguage: 'xx-invalid',
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]
    })

    await migrator.prepare(migrationInput)
    await expect(migrator.execute(migrationInput)).resolves.toMatchObject({ success: true, processedCount: 0 })
    await expect(migrator.validate(migrationInput)).resolves.toMatchObject({ success: true })
    expect(dbh.db.select().from(translateGlossaryTable).all()).toHaveLength(0)
  })
})
