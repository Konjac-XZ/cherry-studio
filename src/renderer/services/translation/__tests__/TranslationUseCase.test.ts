import { describe, expect, it, vi } from 'vitest'

import { determineTargetLanguage } from '@renderer/utils/translate'
import { parsePersistedLangCode, type TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import type { UniqueModelId } from '@shared/data/types/model'
import type { TranslateHistory } from '@shared/data/types/translate'

import { executePreparedTranslation, prepareTranslation, type TranslationPreparationPorts } from '../TranslationUseCase'

const modelId = 'openai:gpt-5' as UniqueModelId
const polishModelId = 'anthropic:claude-sonnet-4' as UniqueModelId

const history = (overrides: Partial<TranslateHistory> = {}): TranslateHistory => ({
  id: '01988f5c-b9f0-7000-8000-000000000001',
  sourceText: 'hello',
  targetText: '你好',
  sourceLanguage: parsePersistedLangCode('en-us'),
  targetLanguage: parsePersistedLangCode('zh-cn'),
  modelId,
  cacheKey: 'translate:openai:gpt-5:en-us:zh-cn:hello',
  star: false,
  createdAt: '2026-08-06T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z',
  ...overrides,
  kind: overrides.kind ?? 'text'
})

const ports = (overrides: Partial<TranslationPreparationPorts> = {}): TranslationPreparationPorts => ({
  detectLanguage: vi.fn(async () => 'en-us'),
  determineTargetLanguage: vi.fn((source, target, bidirectional, pair, nativeLanguage) => {
    if (bidirectional) {
      if (nativeLanguage) return { success: true as const, language: nativeLanguage }
      if (source === pair[0]) return { success: true as const, language: pair[1] }
      if (source === pair[1]) return { success: true as const, language: pair[0] }
    }
    return source === target ? { success: false as const } : { success: true as const, language: target }
  }),
  findBySourceText: vi.fn(async () => []),
  findCached: vi.fn(async () => undefined),
  plan: vi.fn(async (_target, operation) => (operation === 'polish' ? polishModelId : modelId)),
  ...overrides
})

const command = {
  bidirectionalPair: ['en-us', 'zh-cn'] as [TranslateLangCode, TranslateLangCode],
  isBidirectional: true,
  mode: 'translate' as const,
  nativeLanguage: 'zh-cn' as const,
  sourceLanguage: 'auto' as const,
  sourceText: 'hello',
  targetLanguage: 'en-us' as const
}

describe('TranslationUseCase', () => {
  it('restores compatible language decisions from history before detection', async () => {
    const compatible = history()
    const adapter = ports({ findBySourceText: vi.fn(async () => [compatible]) })

    const result = await prepareTranslation(command, adapter)

    expect(result).toMatchObject({
      status: 'cache_hit',
      history: compatible,
      value: { sourceLanguage: 'en-us', targetLanguage: 'zh-cn', translateModelId: modelId }
    })
    expect(adapter.detectLanguage).not.toHaveBeenCalled()
    expect(adapter.findCached).not.toHaveBeenCalled()
  })

  it('skips stale history identities and detects normally', async () => {
    const adapter = ports({
      findBySourceText: vi.fn(async () => [history({ cacheKey: 'translate:old-model:en-us:zh-cn:hello' })])
    })

    const result = await prepareTranslation(command, adapter)

    expect(result).toMatchObject({ status: 'ready', value: { sourceLanguage: 'en-us', targetLanguage: 'zh-cn' } })
    expect(adapter.detectLanguage).toHaveBeenCalledWith('hello', undefined)
  })

  it('freezes independent polish and translate plans in the cache identity', async () => {
    const adapter = ports()
    const result = await prepareTranslation({ ...command, mode: 'polish_then_translate' }, adapter)

    expect(result).toMatchObject({
      status: 'ready',
      value: {
        translateModelId: modelId,
        polishModelId,
        cacheKey: `polish-translate:${modelId}:${polishModelId}:en-us:zh-cn:hello`
      }
    })
  })

  it('uses preprocessed source text consistently across preparation', async () => {
    const adapter = ports()
    const result = await prepareTranslation({ ...command, sourceText: 'hello normalized' }, adapter)

    expect(result).toMatchObject({
      status: 'ready',
      value: {
        sourceText: 'hello normalized',
        cacheKey: `translate:${modelId}:en-us:zh-cn:hello normalized`
      }
    })
    expect(adapter.detectLanguage).toHaveBeenCalledWith('hello normalized', undefined)
  })

  it('prepares outside-pair detected text for translation to the configured native language', async () => {
    const adapter = ports({
      detectLanguage: vi.fn(async () => 'ja-jp'),
      determineTargetLanguage
    })

    const result = await prepareTranslation({ ...command, sourceText: '日本語の文章' }, adapter)

    expect(result).toMatchObject({
      status: 'ready',
      value: {
        sourceLanguage: 'ja-jp',
        targetLanguage: 'zh-cn',
        cacheKey: `translate:${modelId}:ja-jp:zh-cn:日本語の文章`
      }
    })
    expect(adapter.plan).toHaveBeenCalledWith('zh-cn', 'translate')
  })

  it('keeps same-language and outside-pair decisions distinct', async () => {
    await expect(
      prepareTranslation(
        command,
        ports({
          determineTargetLanguage: vi.fn(() => ({ success: false as const, errorType: 'not_in_pair' as const }))
        })
      )
    ).resolves.toEqual({ status: 'not_in_pair', sourceLanguage: 'en-us' })

    await expect(
      prepareTranslation(
        command,
        ports({
          determineTargetLanguage: vi.fn(() => ({ success: false as const, errorType: 'same_language' as const }))
        })
      )
    ).resolves.toEqual({ status: 'same_language', sourceLanguage: 'en-us' })
  })

  it('executes polish, translation, display processing, and raw history in order', async () => {
    const events: string[] = []
    const result = await executePreparedTranslation(
      {
        cacheKey: `polish-translate:${modelId}:${polishModelId}:en-us:zh-cn:hello`,
        mode: 'polish_then_translate',
        polishModelId,
        sourceLanguage: 'en-us',
        sourceText: 'normalized hello',
        targetLanguage: 'zh-cn',
        translateModelId: modelId
      },
      {
        postProcess: (text) => {
          events.push('process')
          return `processed:${text}`
        },
        saveHistory: vi.fn(async (input) => {
          events.push(`save:${input.targetText}`)
        }),
        translate: vi.fn(async ({ operation, text, onUpdate }) => {
          events.push(`${operation}:${text}`)
          const output = operation === 'polish' ? 'polished' : 'raw translation'
          onUpdate?.(output)
          return output
        })
      }
    )

    expect(result).toMatchObject({
      polishedText: 'polished',
      rawText: 'raw translation',
      displayText: 'processed:raw translation'
    })
    expect(events).toEqual(['polish:normalized hello', 'translate:polished', 'process', 'save:raw translation'])
  })

  it('returns the translated result when history persistence fails', async () => {
    const persistenceError = new Error('db unavailable')
    const result = await executePreparedTranslation(
      {
        cacheKey: `translate:${modelId}:en-us:zh-cn:hello`,
        mode: 'translate',
        sourceLanguage: 'en-us',
        sourceText: 'hello',
        targetLanguage: 'zh-cn',
        translateModelId: modelId
      },
      {
        postProcess: (text) => text,
        saveHistory: vi.fn(async () => {
          throw persistenceError
        }),
        translate: vi.fn(async () => 'raw translation')
      }
    )

    expect(result).toMatchObject({ rawText: 'raw translation', historyError: persistenceError })
  })

  it('threads one signal through polish and translation and suppresses completion effects after abort', async () => {
    const controller = new AbortController()
    const postProcess = vi.fn((text: string) => text)
    const saveHistory = vi.fn(async () => undefined)
    const translate = vi.fn(async ({ operation, signal }: { operation: string; signal?: AbortSignal }) => {
      expect(signal).toBe(controller.signal)
      if (operation === 'polish') return 'polished'
      controller.abort()
      return 'late translation'
    })

    await expect(
      executePreparedTranslation(
        {
          cacheKey: `polish-translate:${modelId}:${polishModelId}:en-us:zh-cn:hello`,
          mode: 'polish_then_translate',
          polishModelId,
          sourceLanguage: 'en-us',
          sourceText: 'hello',
          targetLanguage: 'zh-cn',
          translateModelId: modelId
        },
        { postProcess, saveHistory, translate },
        { signal: controller.signal }
      )
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(translate).toHaveBeenCalledTimes(2)
    expect(postProcess).not.toHaveBeenCalled()
    expect(saveHistory).not.toHaveBeenCalled()
  })
})
