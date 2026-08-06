import { describe, expect, it } from 'vitest'

import { parseLegacyTranslateModelId, transformTranslateHistoryRecord } from '../TranslateTransformers'

describe('TranslateTransformers', () => {
  it('normalizes the final V1 JSON model identity to a V2 UniqueModelId', () => {
    expect(parseLegacyTranslateModelId(JSON.stringify({ provider: 'anthropic', id: 'claude-sonnet-5' }))).toBe(
      'anthropic::claude-sonnet-5'
    )
  })

  it('accepts an already-normalized V2 model identity', () => {
    expect(parseLegacyTranslateModelId('openai::gpt-5')).toBe('openai::gpt-5')
  })

  it.each([undefined, '', 'not-json', '{}', '{"provider":"","id":"gpt-5"}'])(
    'does not invent an identity for %j',
    (value) => {
      expect(parseLegacyTranslateModelId(value)).toBeNull()
    }
  )

  it('preserves cache semantics while converting the provider-qualified identity', () => {
    const result = transformTranslateHistoryRecord(
      {
        id: 'history-1',
        sourceText: '  Hello\n  world  ',
        targetText: '你好，世界',
        sourceLanguage: 'en-us',
        targetLanguage: 'zh-cn',
        modelId: JSON.stringify({ provider: 'anthropic', id: 'claude-sonnet-5' }),
        cacheKey: 'legacy-key',
        createdAt: '2026-08-05T00:00:00.000Z',
        star: true
      },
      new Set(['en-us', 'zh-cn'])
    )

    expect(result).toMatchObject({
      modelId: 'anthropic::claude-sonnet-5',
      cacheKey: 'translate:anthropic::claude-sonnet-5:en-us:zh-cn:Hello world',
      sourceLanguage: 'en-us',
      targetLanguage: 'zh-cn',
      star: true
    })
    expect(result.updatedAt).toBe(result.createdAt)
  })

  it('disables cache reuse when a referenced language is dangling', () => {
    const result = transformTranslateHistoryRecord(
      {
        id: 'history-2',
        sourceText: 'Hello',
        targetText: 'Bonjour',
        sourceLanguage: 'en-us',
        targetLanguage: 'deleted-language',
        modelId: JSON.stringify({ provider: 'openai', id: 'gpt-5' }),
        cacheKey: 'legacy-key',
        createdAt: '2026-08-05T00:00:00.000Z'
      },
      new Set(['en-us'])
    )

    expect(result.targetLanguage).toBeNull()
    expect(result.cacheKey).toBeNull()
  })

  it('retains an old cache key as evidence when a legacy model identity is malformed', () => {
    const result = transformTranslateHistoryRecord(
      {
        id: 'history-3',
        sourceText: 'Hello',
        targetText: '你好',
        sourceLanguage: 'en-us',
        targetLanguage: 'zh-cn',
        modelId: 'malformed',
        cacheKey: 'legacy-key',
        createdAt: '2026-08-05T00:00:00.000Z'
      },
      new Set(['en-us', 'zh-cn'])
    )

    expect(result.modelId).toBeNull()
    expect(result.cacheKey).toBe('legacy-key')
  })
})
