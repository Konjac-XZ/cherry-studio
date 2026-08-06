/**
 * Translate entity types
 *
 * Defines Zod schemas and inferred types for translate history and language entities.
 * DTO/Query/API schemas live in `@shared/data/api/schemas/translate`.
 */

import * as z from 'zod'

import { PersistedLangCodeSchema } from '../preference/preferenceTypes'
import { UniqueModelIdSchema } from './model'

export const TranslateOperationSchema = z.enum(['translate', 'polish'])
export type TranslateOperation = z.infer<typeof TranslateOperationSchema>

// ============================================================================
// Translate History
// ============================================================================

export const TranslateHistorySchema = z.strictObject({
  /** UUIDv7 (time-ordered), auto-generated */
  id: z.uuidv7(),
  /** Original text, non-empty */
  sourceText: z.string().min(1),
  /** Translated text, non-empty */
  targetText: z.string().min(1),
  /** FK to translate_language.langCode, nullable (SET NULL on language delete).
   *  Uses `PersistedLangCodeSchema` (strict) to match the write-side DTOs —
   *  the `'unknown'` UI sentinel is never written and must not appear here. */
  sourceLanguage: PersistedLangCodeSchema.nullable(),
  /** FK to translate_language.langCode, nullable (SET NULL on language delete).
   *  Uses `PersistedLangCodeSchema` (strict) to match the write-side DTOs —
   *  the `'unknown'` UI sentinel is never written and must not appear here. */
  targetLanguage: PersistedLangCodeSchema.nullable(),
  /** Provider-qualified model identity used to produce this result. */
  modelId: UniqueModelIdSchema.nullable(),
  /** Canonical direction/model/text cache identity; nullable for unsafe legacy rows. */
  cacheKey: z.string().min(1).nullable(),
  /** Whether the record is starred */
  star: z.boolean(),
  /** ISO 8601 datetime */
  createdAt: z.iso.datetime(),
  /** ISO 8601 datetime */
  updatedAt: z.iso.datetime()
})
/** Translate history entity. */
export type TranslateHistory = z.infer<typeof TranslateHistorySchema>

// ============================================================================
// Translate Language
// ============================================================================

export const TranslateLanguageSchema = z.strictObject({
  /** PK, immutable, must match PersistedLangCodeSchema (`/^[a-z]{2,3}(-[a-z]{2,4})?$/`).
   *  Persistence-only schema — the `'unknown'` UI sentinel never has a row here. */
  langCode: PersistedLangCodeSchema,
  /** Display name, non-empty (e.g. "English", "Chinese (Simplified)") */
  value: z.string().min(1),
  /** Flag emoji (e.g. "🇬🇧", "🇨🇳") */
  emoji: z.emoji(),
  /** ISO 8601 datetime */
  createdAt: z.iso.datetime(),
  /** ISO 8601 datetime */
  updatedAt: z.iso.datetime()
})
/** Translate language entity. Both builtin and user-created languages share this schema. */
export type TranslateLanguage = z.infer<typeof TranslateLanguageSchema>

// ============================================================================
// Translate Glossary
// ============================================================================

export const TranslateGlossaryEntrySchema = z.strictObject({
  /** UUIDv7 (time-ordered), auto-generated. */
  id: z.uuidv7(),
  /** Source phrase matched case-insensitively against the input text. */
  sourcePhrase: z.string().trim().min(1).max(500),
  /** Required target rendering for the source phrase. */
  targetPhrase: z.string().trim().min(1).max(500),
  /** Only inject this entry when translating to this language. */
  targetLanguage: PersistedLangCodeSchema,
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
})
export type TranslateGlossaryEntry = z.infer<typeof TranslateGlossaryEntrySchema>
