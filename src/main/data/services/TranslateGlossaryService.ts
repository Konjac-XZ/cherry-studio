import { and, desc, eq, ne, type SQL, sql } from 'drizzle-orm'

import { application } from '@application'
import { translateGlossaryTable } from '@data/db/schemas/translateGlossary'
import { loggerService } from '@logger'
import { DataApiErrorFactory } from '@shared/data/api/errors'
import type {
  CreateTranslateGlossaryEntryDto,
  TranslateGlossaryQuery,
  UpdateTranslateGlossaryEntryDto
} from '@shared/data/api/schemas/translate'
import type { TranslateGlossaryEntry } from '@shared/data/types/translate'

import { timestampToISO } from './utils/rowMappers'

const logger = loggerService.withContext('DataApi:TranslateGlossaryService')

function rowToEntry(row: typeof translateGlossaryTable.$inferSelect): TranslateGlossaryEntry {
  return {
    id: row.id,
    sourcePhrase: row.sourcePhrase,
    targetPhrase: row.targetPhrase,
    targetLanguage: row.targetLanguage as TranslateGlossaryEntry['targetLanguage'],
    enabled: row.enabled,
    createdAt: timestampToISO(row.createdAt),
    updatedAt: timestampToISO(row.updatedAt)
  }
}

export function buildCustomizedDictionary(entries: readonly TranslateGlossaryEntry[], inputText: string): string {
  const lowerInput = inputText.toLocaleLowerCase()
  const matched = entries.filter(
    (entry) => entry.enabled && lowerInput.includes(entry.sourcePhrase.toLocaleLowerCase())
  )
  return matched.length > 0
    ? matched.map((entry) => `${entry.sourcePhrase} -> ${entry.targetPhrase}`).join('\n')
    : '[No glossary requiring specified translations was found in the original text]'
}

export class TranslateGlossaryService {
  list(query: TranslateGlossaryQuery = {}): TranslateGlossaryEntry[] {
    const db = application.get('DbService').getDb()
    const filters: SQL[] = []
    if (query.targetLanguage !== undefined)
      filters.push(eq(translateGlossaryTable.targetLanguage, query.targetLanguage))
    if (query.enabled !== undefined) filters.push(eq(translateGlossaryTable.enabled, query.enabled))
    return db
      .select()
      .from(translateGlossaryTable)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(translateGlossaryTable.createdAt))
      .all()
      .map(rowToEntry)
  }

  getById(id: string): TranslateGlossaryEntry {
    const db = application.get('DbService').getDb()
    const row = db.select().from(translateGlossaryTable).where(eq(translateGlossaryTable.id, id)).get()
    if (!row) throw DataApiErrorFactory.notFound('TranslateGlossaryEntry', id)
    return rowToEntry(row)
  }

  create(dto: CreateTranslateGlossaryEntryDto): TranslateGlossaryEntry {
    this.assertUnique(dto.sourcePhrase, dto.targetLanguage)
    const db = application.get('DbService').getDb()
    const row = db.insert(translateGlossaryTable).values(dto).returning().get()
    if (!row) throw DataApiErrorFactory.database(new Error('Insert did not return a row'), 'create glossary entry')
    logger.info('Created translate glossary entry', { id: row.id, targetLanguage: row.targetLanguage })
    return rowToEntry(row)
  }

  update(id: string, dto: UpdateTranslateGlossaryEntryDto): TranslateGlossaryEntry {
    const db = application.get('DbService').getDb()
    return db.transaction((tx) => {
      const current = tx.select().from(translateGlossaryTable).where(eq(translateGlossaryTable.id, id)).get()
      if (!current) throw DataApiErrorFactory.notFound('TranslateGlossaryEntry', id)
      const sourcePhrase = dto.sourcePhrase ?? current.sourcePhrase
      const targetLanguage = dto.targetLanguage ?? current.targetLanguage
      this.assertUnique(sourcePhrase, targetLanguage, id)
      if (Object.keys(dto).length === 0) return rowToEntry(current)
      const row = tx
        .update(translateGlossaryTable)
        .set({ ...dto, updatedAt: Date.now() })
        .where(eq(translateGlossaryTable.id, id))
        .returning()
        .get()
      if (!row) throw DataApiErrorFactory.notFound('TranslateGlossaryEntry', id)
      return rowToEntry(row)
    })
  }

  delete(id: string): void {
    const db = application.get('DbService').getDb()
    const result = db.delete(translateGlossaryTable).where(eq(translateGlossaryTable.id, id)).run()
    if (result.changes === 0) throw DataApiErrorFactory.notFound('TranslateGlossaryEntry', id)
  }

  private assertUnique(sourcePhrase: string, targetLanguage: string, excludeId?: string): void {
    const db = application.get('DbService').getDb()
    const conditions = [
      eq(translateGlossaryTable.targetLanguage, targetLanguage),
      sql`lower(${translateGlossaryTable.sourcePhrase}) = lower(${sourcePhrase})`
    ]
    if (excludeId) conditions.push(ne(translateGlossaryTable.id, excludeId))
    const duplicate = db
      .select({ id: translateGlossaryTable.id })
      .from(translateGlossaryTable)
      .where(and(...conditions))
      .get()
    if (duplicate) {
      throw DataApiErrorFactory.conflict(
        'A glossary entry with the same source phrase and target language already exists',
        'TranslateGlossaryEntry'
      )
    }
  }
}

export const translateGlossaryService = new TranslateGlossaryService()
