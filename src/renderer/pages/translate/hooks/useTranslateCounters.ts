import { useMemo } from 'react'
import { estimateTokenCount } from 'tokenx'

import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' })

export const countTranslateWords = (text: string) => {
  let count = 0
  for (const segment of wordSegmenter.segment(text)) {
    if (segment.isWordLike) count += 1
  }
  return count
}

type Params = {
  input: string
  nativeLanguage: TranslateLangCode | null
  nativeToOtherPrompt: string
  otherToNativePrompt: string
  polishEnabled: boolean
  polishPrompt: string
  targetLanguage: TranslateLangCode
}

export const useTranslateCounters = ({
  input,
  nativeLanguage,
  nativeToOtherPrompt,
  otherToNativePrompt,
  polishEnabled,
  polishPrompt,
  targetLanguage
}: Params) => {
  const activePrompt = nativeLanguage === targetLanguage ? otherToNativePrompt : nativeToOtherPrompt
  return useMemo(
    () => ({
      wordCount: countTranslateWords(input),
      tokenCount: estimateTokenCount(`${input}${activePrompt}${polishEnabled ? polishPrompt : ''}`)
    }),
    [activePrompt, input, polishEnabled, polishPrompt]
  )
}

export const useTranslateOutputCounters = (output: string, reportedOutputTokens?: number) =>
  useMemo(
    () => ({
      wordCount: countTranslateWords(output),
      tokenCount: output ? (reportedOutputTokens ?? estimateTokenCount(output)) : 0
    }),
    [output, reportedOutputTokens]
  )
