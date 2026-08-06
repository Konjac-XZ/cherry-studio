import type { UniqueModelId } from '@shared/data/types/model'

export interface TranslateHistoryCacheIdentity {
  sourceText: string
  sourceLanguage: string
  targetLanguage: string
  modelId?: UniqueModelId | null
}

/** Keep cache identity compatible with the final V1 whitespace-normalization contract. */
export function normalizeTranslateHistoryText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/**
 * Build the canonical V2 cache identity from a provider-qualified model ID and
 * the effective language direction.
 */
export function createTranslateHistoryCacheKey({
  sourceText,
  sourceLanguage,
  targetLanguage,
  modelId
}: TranslateHistoryCacheIdentity): string {
  return `translate:${modelId ?? ''}:${sourceLanguage}:${targetLanguage}:${normalizeTranslateHistoryText(sourceText)}`
}

export function createPolishTranslateHistoryCacheKey(
  input: TranslateHistoryCacheIdentity & {
    polishModelId: UniqueModelId
  }
): string {
  return `polish-translate:${input.modelId ?? ''}:${input.polishModelId}:${input.sourceLanguage}:${input.targetLanguage}:${normalizeTranslateHistoryText(input.sourceText)}`
}
