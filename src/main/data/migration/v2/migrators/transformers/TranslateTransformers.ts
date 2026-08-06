import { type UniqueModelId, UniqueModelIdSchema } from '@shared/data/types/model'
import { createTranslateHistoryCacheKey } from '@shared/utils/translateHistory'

import { legacyChatModelToUniqueId, type LegacyModelRef } from './ModelTransformers'

export interface LegacyTranslateHistoryRecord {
  id: string
  sourceText: string
  targetText: string
  sourceLanguage: string
  targetLanguage: string
  createdAt: string
  star?: boolean
  /** Final V1 stores a JSON-encoded `{ provider, id }` model reference. */
  modelId?: string
  /** Final V1 cache key. Rebuilt after model identity normalization when possible. */
  cacheKey?: string
}

export interface MigratedTranslateHistoryRecord {
  id: string
  sourceText: string
  targetText: string
  sourceLanguage: string | null
  targetLanguage: string | null
  star: boolean
  modelId: UniqueModelId | null
  cacheKey: string | null
  createdAt: number
  updatedAt: number
}

export function parseLegacyTranslateModelId(value: unknown): UniqueModelId | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const direct = UniqueModelIdSchema.safeParse(trimmed)
  if (direct.success) return direct.data

  try {
    const parsed = JSON.parse(trimmed) as LegacyModelRef
    return legacyChatModelToUniqueId(parsed)
  } catch {
    return null
  }
}

export function parseLegacyTranslateTimestamp(value: string): number {
  if (!value) return Date.now()
  const parsed = new Date(value).getTime()
  return !parsed || Number.isNaN(parsed) ? Date.now() : parsed
}

export function transformTranslateHistoryRecord(
  old: LegacyTranslateHistoryRecord,
  validLangCodes: ReadonlySet<string>
): MigratedTranslateHistoryRecord {
  const createdAt = parseLegacyTranslateTimestamp(old.createdAt)
  const sourceLanguage = validLangCodes.has(old.sourceLanguage) ? old.sourceLanguage : null
  const targetLanguage = validLangCodes.has(old.targetLanguage) ? old.targetLanguage : null
  const modelId = parseLegacyTranslateModelId(old.modelId)

  // A dangling language makes the old cache entry unsafe to reuse. Otherwise
  // rebuild the key with V2's canonical model identity. For an unparseable
  // legacy model reference, retain the old key as evidence but leave modelId
  // null so runtime lookup cannot mistake it for a current model.
  const cacheKey =
    sourceLanguage && targetLanguage
      ? modelId || !old.modelId
        ? createTranslateHistoryCacheKey({ sourceText: old.sourceText, sourceLanguage, targetLanguage, modelId })
        : old.cacheKey?.trim() || null
      : null

  return {
    id: old.id,
    sourceText: old.sourceText,
    targetText: old.targetText,
    sourceLanguage,
    targetLanguage,
    star: old.star ?? false,
    modelId,
    cacheKey,
    createdAt,
    updatedAt: createdAt
  }
}
