import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { countTranslateWords, useTranslateCounters, useTranslateOutputCounters } from '../useTranslateCounters'

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
        nativeLanguage: 'zh-cn',
        nativeToOtherPrompt: 'short prompt',
        otherToNativePrompt: 'a much longer prompt with several extra words',
        polishEnabled: false,
        polishPrompt: 'polish with extra context',
        targetLanguage: 'en-us'
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

  it('prefers reported output tokens and falls back to estimating the translated text', () => {
    const { result, rerender } = renderHook(
      ({ output, reportedOutputTokens }: { output: string; reportedOutputTokens?: number }) =>
        useTranslateOutputCounters(output, reportedOutputTokens),
      {
        initialProps: {
          output: 'Hello translated world',
          reportedOutputTokens: undefined as number | undefined
        }
      }
    )
    const estimatedTokens = result.current.tokenCount

    rerender({ output: 'Hello translated world', reportedOutputTokens: 17 })

    expect(result.current).toEqual({ wordCount: 3, tokenCount: 17 })
    expect(estimatedTokens).toBeGreaterThan(0)
  })
})
