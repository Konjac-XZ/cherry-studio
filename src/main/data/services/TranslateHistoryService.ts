/**
 * Translate History Service - handles translate history CRUD
 */

import { application } from '@application'
import { translateHistoryTable } from '@data/db/schemas/translateHistory'
import { loggerService } from '@logger'
import { DataApiErrorFactory } from '@shared/data/api/errors'
import type {
  CreateTranslateHistoryDto,
  TranslateHistoryListResponse,
  TranslateHistoryQuery,
  UpdateTranslateHistoryDto
} from '@shared/data/api/schemas/translate'
import { parsePersistedLangCode } from '@shared/data/preference/preferenceTypes'
import type { TranslateHistory } from '@shared/data/types/translate'
import { createTranslateHistoryCacheKey } from '@shared/utils/translateHistory'
import type { SQL } from 'drizzle-orm'
import { and, eq, inArray, or, sql } from 'drizzle-orm'

import { asNumericKey, decodeListCursor, encodeCursor, keysetOrdering } from './utils/keysetCursor'
import { timestampToISO } from './utils/rowMappers'

const logger = loggerService.withContext('DataApi:TranslateHistoryService')

function rowToTranslateHistory(row: typeof translateHistoryTable.$inferSelect): TranslateHistory {
  return {
    id: row.id,
    sourceText: row.sourceText,
    targetText: row.targetText,
    sourceLanguage: row.sourceLanguage === null ? null : parsePersistedLangCode(row.sourceLanguage),
    targetLanguage: row.targetLanguage === null ? null : parsePersistedLangCode(row.targetLanguage),
    modelId: row.modelId as TranslateHistory['modelId'],
    cacheKey: row.cacheKey,
    star: row.star,
    createdAt: timestampToISO(row.createdAt),
    updatedAt: timestampToISO(row.updatedAt)
  }
}

export class TranslateHistoryService {
  list(query: TranslateHistoryQuery): TranslateHistoryListResponse {
    const db = application.get('DbService').getDb()
    const { limit } = query

    const filterConditions: SQL[] = []

    if (query?.star !== undefined) {
      filterConditions.push(eq(translateHistoryTable.star, query.star))
    }

    if (query?.search) {
      const escaped = query.search.replace(/[%_\\]/g, '\\$&')
      const pattern = `%${escaped}%`
      const searchConditions: SQL[] = [
        sql`${translateHistoryTable.sourceText} LIKE ${pattern} ESCAPE '\\'`,
        sql`${translateHistoryTable.targetText} LIKE ${pattern} ESCAPE '\\'`,
        sql`strftime('%m/%d %H:%M', ${translateHistoryTable.createdAt} / 1000, 'unixepoch', 'localtime') LIKE ${pattern} ESCAPE '\\'`
      ]
      if (query.languageCodes?.length) {
        searchConditions.push(
          inArray(translateHistoryTable.sourceLanguage, query.languageCodes),
          inArray(translateHistoryTable.targetLanguage, query.languageCodes)
        )
      }
      const searchCondition = or(...searchConditions)
      if (searchCondition) {
        filterConditions.push(searchCondition)
      }
    }

    if (query.cacheKey) {
      filterConditions.push(eq(translateHistoryTable.cacheKey, query.cacheKey))
    }

    if (query.sourceText) {
      filterConditions.push(eq(translateHistoryTable.sourceText, query.sourceText))
    }

    const ordering = keysetOrdering(translateHistoryTable.createdAt, translateHistoryTable.id, {
      major: 'desc',
      tie: 'asc'
    })
    const conditions = [...filterConditions]
    const cursor = decodeListCursor(query.cursor, asNumericKey, 'translate-history')
    if (cursor) {
      conditions.push(ordering.where(cursor))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const rows = db
      .select()
      .from(translateHistoryTable)
      .where(where)
      .orderBy(...ordering.orderBy)
      .limit(limit + 1)
      .all()
    const [{ count }] = db
      .select({ count: sql<number>`count(*)` })
      .from(translateHistoryTable)
      .where(filterConditions.length > 0 ? and(...filterConditions) : undefined)
      .all()
    const pageRows = rows.slice(0, limit)

    return {
      items: pageRows.map(rowToTranslateHistory),
      total: count,
      nextCursor:
        rows.length > limit
          ? encodeCursor(pageRows[pageRows.length - 1].createdAt, pageRows[pageRows.length - 1].id)
          : undefined
    }
  }

  getById(id: string): TranslateHistory {
    const db = application.get('DbService').getDb()
    const [row] = db.select().from(translateHistoryTable).where(eq(translateHistoryTable.id, id)).limit(1).all()

    if (!row) {
      throw DataApiErrorFactory.notFound('TranslateHistory', id)
    }

    return rowToTranslateHistory(row)
  }

  create(dto: CreateTranslateHistoryDto): TranslateHistory {
    const db = application.get('DbService').getDb()
    const cacheKey =
      dto.cacheKey ??
      (dto.sourceLanguage && dto.targetLanguage
        ? createTranslateHistoryCacheKey({
            sourceText: dto.sourceText,
            sourceLanguage: dto.sourceLanguage,
            targetLanguage: dto.targetLanguage,
            modelId: dto.modelId
          })
        : null)

    const [row] = db
      .insert(translateHistoryTable)
      .values({
        sourceText: dto.sourceText,
        targetText: dto.targetText,
        sourceLanguage: dto.sourceLanguage,
        targetLanguage: dto.targetLanguage,
        modelId: dto.modelId ?? null,
        cacheKey
      })
      .returning()
      .all()

    if (!row) {
      throw DataApiErrorFactory.database(new Error('Insert did not return a row'), 'create translate history')
    }

    logger.info('Created translate history', { id: row.id })
    return rowToTranslateHistory(row)
  }

  update(id: string, dto: UpdateTranslateHistoryDto): TranslateHistory {
    const db = application.get('DbService').getDb()

    return db.transaction((tx) => {
      const [current] = tx.select().from(translateHistoryTable).where(eq(translateHistoryTable.id, id)).limit(1).all()

      if (!current) {
        throw DataApiErrorFactory.notFound('TranslateHistory', id)
      }

      const updates: Partial<typeof translateHistoryTable.$inferInsert> = {}
      if (dto.sourceText !== undefined) updates.sourceText = dto.sourceText
      if (dto.targetText !== undefined) updates.targetText = dto.targetText
      if (dto.sourceLanguage !== undefined) updates.sourceLanguage = dto.sourceLanguage
      if (dto.targetLanguage !== undefined) updates.targetLanguage = dto.targetLanguage
      if (dto.modelId !== undefined) updates.modelId = dto.modelId
      if (dto.star !== undefined) updates.star = dto.star

      if (
        dto.sourceText !== undefined ||
        dto.sourceLanguage !== undefined ||
        dto.targetLanguage !== undefined ||
        dto.modelId !== undefined
      ) {
        const sourceText = dto.sourceText ?? current.sourceText
        const sourceLanguage = dto.sourceLanguage === undefined ? current.sourceLanguage : dto.sourceLanguage
        const targetLanguage = dto.targetLanguage === undefined ? current.targetLanguage : dto.targetLanguage
        const modelId = dto.modelId === undefined ? current.modelId : dto.modelId
        updates.cacheKey =
          sourceLanguage && targetLanguage
            ? createTranslateHistoryCacheKey({
                sourceText,
                sourceLanguage,
                targetLanguage,
                modelId: modelId as TranslateHistory['modelId']
              })
            : null
      }

      if (Object.keys(updates).length === 0) {
        return rowToTranslateHistory(current)
      }

      const [row] = tx
        .update(translateHistoryTable)
        .set(updates)
        .where(eq(translateHistoryTable.id, id))
        .returning()
        .all()

      if (!row) {
        throw DataApiErrorFactory.notFound('TranslateHistory', id)
      }

      logger.info('Updated translate history', { id, changes: Object.keys(dto) })
      return rowToTranslateHistory(row)
    })
  }

  delete(id: string): void {
    const db = application.get('DbService').getDb()

    db.transaction((tx) => {
      const [row] = tx.select().from(translateHistoryTable).where(eq(translateHistoryTable.id, id)).limit(1).all()

      if (!row) {
        throw DataApiErrorFactory.notFound('TranslateHistory', id)
      }

      tx.delete(translateHistoryTable).where(eq(translateHistoryTable.id, id)).run()
    })

    logger.info('Deleted translate history', { id })
  }

  clearAll(): void {
    const db = application.get('DbService').getDb()
    db.delete(translateHistoryTable).run()
    logger.info('Cleared all translate histories')
  }
}

export const translateHistoryService = new TranslateHistoryService()
