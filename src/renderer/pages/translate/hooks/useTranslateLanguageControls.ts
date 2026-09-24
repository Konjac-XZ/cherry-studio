import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { toast } from '@renderer/services/toast'
import { isEquivalentBidirectionalLanguage } from '@renderer/utils/translate'
import type { TranslateLangCode, TranslateSourceLanguage } from '@shared/data/preference/preferenceTypes'
import type { TranslateBidirectionalPair } from '@shared/data/preference/preferenceTypes'

import type { TranslationRunOverride } from './useTranslationFlowRunner'

type Params = {
  busy: boolean
  bidirectionalPair: TranslateBidirectionalPair
  detectedLanguage: TranslateLangCode | null
  input: string
  isBidirectional: boolean
  nativeLanguage: TranslateLangCode | null
  output: string
  runTranslation: (
    forceRefresh?: boolean,
    sourceTextOverride?: string,
    modeOverride?: undefined,
    runOverride?: TranslationRunOverride
  ) => Promise<void>
  setDetectedLanguage: (language: TranslateLangCode | null) => void
  setInput: (text: string) => void
  setOutput: (text: string) => void
  setOutputTargetLanguage: (language: TranslateLangCode) => void
  setRawOutput: (text: string) => void
  sourceLanguage: TranslateSourceLanguage
  targetLanguage: TranslateLangCode
  persistLanguages: (sourceLanguage: TranslateSourceLanguage, targetLanguage: TranslateLangCode) => void
  persistTargetLanguage: (targetLanguage: TranslateLangCode) => void
}

const isKnown = (language: TranslateLangCode | null): language is TranslateLangCode =>
  language !== null && language !== 'unknown'

export const determineFlippedBidirectionalLanguages = (
  detectedLanguage: TranslateLangCode,
  currentTarget: TranslateLangCode,
  pair: TranslateBidirectionalPair
) => {
  const detectedIndex = pair.findIndex((language) => isEquivalentBidirectionalLanguage(detectedLanguage, language))
  if (detectedIndex >= 0) {
    return {
      sourceLanguage: pair[1 - detectedIndex],
      targetLanguage: pair[detectedIndex]
    }
  }

  const matchedIndex = pair.findIndex((language) => isEquivalentBidirectionalLanguage(currentTarget, language))
  const sourceLanguage = matchedIndex >= 0 ? currentTarget : pair[0]
  const targetLanguage = matchedIndex <= 0 ? pair[1] : pair[0]
  return { sourceLanguage, targetLanguage }
}

export const useTranslateLanguageControls = ({
  bidirectionalPair,
  busy,
  detectedLanguage,
  input,
  isBidirectional,
  nativeLanguage,
  output,
  persistLanguages,
  persistTargetLanguage,
  runTranslation,
  setDetectedLanguage,
  setInput,
  setOutput,
  setOutputTargetLanguage,
  setRawOutput,
  sourceLanguage,
  targetLanguage
}: Params) => {
  const { t } = useTranslation()

  const couldExchange = sourceLanguage !== 'auto' && sourceLanguage !== targetLanguage && !busy
  const couldFlip = sourceLanguage === 'auto' && isBidirectional && isKnown(detectedLanguage) && input.trim().length > 0

  const handleExchange = useCallback(() => {
    if (!couldExchange || sourceLanguage === 'auto') return
    const nextSource = targetLanguage
    const nextTarget = sourceLanguage
    persistLanguages(nextSource, nextTarget)
    setInput(output)
    setRawOutput(input)
    setOutputTargetLanguage(nextTarget)
    setOutput(input)
    setDetectedLanguage(null)
  }, [
    couldExchange,
    input,
    output,
    persistLanguages,
    setDetectedLanguage,
    setInput,
    setOutput,
    setOutputTargetLanguage,
    setRawOutput,
    sourceLanguage,
    targetLanguage
  ])

  const handleFlip = useCallback(async () => {
    if (!couldFlip || !isKnown(detectedLanguage)) return
    if (nativeLanguage && !bidirectionalPair.includes(nativeLanguage)) {
      toast.warning(t('translate.flip.native_language_not_in_pair'))
    }

    const flipped = determineFlippedBidirectionalLanguages(detectedLanguage, targetLanguage, bidirectionalPair)
    setDetectedLanguage(flipped.sourceLanguage)
    persistTargetLanguage(flipped.targetLanguage)
    setRawOutput('')
    setOutput('')
    toast.success(t('translate.flip.success'))
    await runTranslation(true, input, undefined, {
      isBidirectional: false,
      replaceActive: true,
      sourceLanguage: flipped.sourceLanguage,
      targetLanguage: flipped.targetLanguage
    })
  }, [
    bidirectionalPair,
    couldFlip,
    detectedLanguage,
    input,
    nativeLanguage,
    persistTargetLanguage,
    runTranslation,
    setDetectedLanguage,
    setOutput,
    setRawOutput,
    t,
    targetLanguage
  ])

  return useMemo(
    () => ({ couldExchange, couldFlip, handleExchange, handleFlip }),
    [couldExchange, couldFlip, handleExchange, handleFlip]
  )
}
