import { isAbortError } from '@renderer/utils/error'
import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'

export interface ComposerInputTranslationCoordinatorOptions {
  text: string
  targetLanguage: TranslateLangCode
  signal: AbortSignal
  translate: (text: string, targetLanguage: TranslateLangCode, signal: AbortSignal) => Promise<string>
  isCurrent: () => boolean
  onTranslated: (translatedText: string) => void
  onError: (error: unknown) => void
  onSettledFocus: () => void
}

/**
 * Reusable completion policy for in-place composer translation.
 *
 * The caller owns the concrete composer surface and scope identity. This coordinator deliberately
 * applies neither stale results nor stale focus after a topic/tab switch, while still restoring
 * focus for success, cancellation, and failure in the active surface.
 */
export async function coordinateComposerInputTranslation({
  text,
  targetLanguage,
  signal,
  translate,
  isCurrent,
  onTranslated,
  onError,
  onSettledFocus
}: ComposerInputTranslationCoordinatorOptions): Promise<void> {
  try {
    const translatedText = await translate(text, targetLanguage, signal)
    if (isCurrent()) onTranslated(translatedText)
  } catch (error) {
    if (!isAbortError(error) && isCurrent()) onError(error)
  } finally {
    if (isCurrent()) onSettledFocus()
  }
}
