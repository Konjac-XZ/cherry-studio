import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toast } from '@renderer/services/toast'
import type { TranslateLangCode, TranslateSourceLanguage } from '@shared/data/preference/preferenceTypes'

import { determineFlippedBidirectionalLanguages, useTranslateLanguageControls } from '../useTranslateLanguageControls'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const pair = ['en-us', 'zh-cn'] as [TranslateLangCode, TranslateLangCode]

const createParams = (overrides: Record<string, unknown> = {}) => ({
  bidirectionalPair: pair,
  busy: false,
  detectedLanguage: 'en-us' as TranslateLangCode,
  input: 'source text',
  isBidirectional: false,
  nativeLanguage: 'zh-cn' as TranslateLangCode,
  output: 'translated text',
  persistLanguages: vi.fn<(source: TranslateSourceLanguage, target: TranslateLangCode) => void>(),
  persistTargetLanguage: vi.fn<(target: TranslateLangCode) => void>(),
  runTranslation: vi.fn(async () => undefined),
  setDetectedLanguage: vi.fn(),
  setInput: vi.fn(),
  setOutput: vi.fn(),
  setOutputTargetLanguage: vi.fn(),
  setRawOutput: vi.fn(),
  sourceLanguage: 'en-us' as TranslateSourceLanguage,
  targetLanguage: 'zh-cn' as TranslateLangCode,
  ...overrides
})

describe('useTranslateLanguageControls', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exchanges languages and synchronizes raw/display content state', () => {
    const params = createParams()
    const { result } = renderHook(() => useTranslateLanguageControls(params))

    act(() => result.current.handleExchange())

    expect(params.persistLanguages).toHaveBeenCalledWith('zh-cn', 'en-us')
    expect(params.setInput).toHaveBeenCalledWith('translated text')
    expect(params.setRawOutput).toHaveBeenCalledWith('source text')
    expect(params.setOutput).toHaveBeenCalledWith('source text')
    expect(params.setOutputTargetLanguage).toHaveBeenCalledWith('en-us')
    expect(params.setDetectedLanguage).toHaveBeenCalledWith(null)
  })

  it('flips a wrong bidirectional detection by replacing the active run with explicit direction', async () => {
    const params = createParams({
      busy: true,
      detectedLanguage: 'zh-cn',
      isBidirectional: true,
      sourceLanguage: 'auto',
      targetLanguage: 'zh-cn'
    })
    const { result } = renderHook(() => useTranslateLanguageControls(params))

    await act(async () => result.current.handleFlip())

    expect(params.setDetectedLanguage).toHaveBeenCalledWith('en-us')
    expect(params.persistTargetLanguage).toHaveBeenCalledWith('zh-cn')
    expect(params.runTranslation).toHaveBeenCalledWith(true, 'source text', undefined, {
      isBidirectional: false,
      replaceActive: true,
      sourceLanguage: 'en-us',
      targetLanguage: 'zh-cn'
    })
    expect(toast.success).toHaveBeenCalledWith('translate.flip.success')
  })

  it('warns when the configured native language is outside the active pair but still flips', async () => {
    const params = createParams({
      isBidirectional: true,
      nativeLanguage: 'ja-jp',
      sourceLanguage: 'auto'
    })
    const { result } = renderHook(() => useTranslateLanguageControls(params))

    await act(async () => result.current.handleFlip())

    expect(toast.warning).toHaveBeenCalledWith('translate.flip.native_language_not_in_pair')
    expect(params.runTranslation).toHaveBeenCalledOnce()
  })

  it('uses the detected language to choose the opposite direction', () => {
    expect(determineFlippedBidirectionalLanguages('zh-cn', 'zh-cn', pair)).toEqual({
      sourceLanguage: 'en-us',
      targetLanguage: 'zh-cn'
    })
    expect(determineFlippedBidirectionalLanguages('en-us', 'zh-cn', pair)).toEqual({
      sourceLanguage: 'zh-cn',
      targetLanguage: 'en-us'
    })
    expect(determineFlippedBidirectionalLanguages('zh-tw', 'en-us', pair)).toEqual({
      sourceLanguage: 'en-us',
      targetLanguage: 'zh-cn'
    })
  })

  it('preserves the saved-target fallback when detection is outside the pair', () => {
    expect(determineFlippedBidirectionalLanguages('ja-jp', 'zh-cn', pair)).toEqual({
      sourceLanguage: 'zh-cn',
      targetLanguage: 'en-us'
    })
  })
})
