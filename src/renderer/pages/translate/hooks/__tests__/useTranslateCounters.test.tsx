import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { countTranslateWords, useTranslateCounters } from '../useTranslateCounters'

type CounterProps = Parameters<typeof useTranslateCounters>[0]

describe('useTranslateCounters', () => {
  it.each([
    ['Hello world!', 2],
    ['你好，世界！', 2],
    ['Hello，世界 123', 3],
    ['  ...  ', 0]
  ] as const)('counts word-like segments in %s', (text, expected) => {
    expect(countTranslateWords(text)).toBe(expected)
  })

  it('includes the active directional prompt and optional polish prompt in token estimation', () => {
    const { result, rerender } = renderHook((props: CounterProps) => useTranslateCounters(props), {
      initialProps: {
        input: 'hello',
        nativeLanguage: 'zh-cn' as TranslateLangCode,
        nativeToOtherPrompt: 'short prompt',
        otherToNativePrompt: 'a much longer prompt with several extra words',
        polishEnabled: false,
        polishPrompt: 'polish with extra context',
        targetLanguage: 'en-us' as TranslateLangCode
      }
    })
    const nativeToOtherTokens = result.current.tokenCount

    rerender({
      input: 'hello',
      nativeLanguage: 'zh-cn',
      nativeToOtherPrompt: 'short prompt',
      otherToNativePrompt: 'a much longer prompt with several extra words',
      polishEnabled: false,
      polishPrompt: 'polish with extra context',
      targetLanguage: 'zh-cn'
    })
    expect(result.current.tokenCount).toBeGreaterThan(nativeToOtherTokens)

    const withoutPolish = result.current.tokenCount
    rerender({
      input: 'hello',
      nativeLanguage: 'zh-cn',
      nativeToOtherPrompt: 'short prompt',
      otherToNativePrompt: 'a much longer prompt with several extra words',
      polishEnabled: true,
      polishPrompt: 'polish with extra context',
      targetLanguage: 'zh-cn'
    })
    expect(result.current.tokenCount).toBeGreaterThan(withoutPolish)
  })
})
