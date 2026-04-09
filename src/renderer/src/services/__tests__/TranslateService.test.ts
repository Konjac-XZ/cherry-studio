import type { TranslateHistory } from '@renderer/types'
import { ChunkType } from '@renderer/types/chunk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const last = vi.fn()
  const equals = vi.fn(() => ({ last }))
  const where = vi.fn(() => ({ equals }))
  const settingsGet = vi.fn()

  return {
    translateHistory: {
      add: vi.fn(),
      put: vi.fn(),
      where,
      equals,
      last
    },
    settings: {
      get: settingsGet
    },
    uuid: vi.fn(() => 'history-1'),
    readyToAbort: vi.fn(),
    trackTokenUsage: vi.fn(),
    fetchChatCompletion: vi.fn(),
    getDefaultTranslateAssistant: vi.fn(),
    t: vi.fn((key: string) => key)
  }
})

vi.mock('@renderer/databases', () => ({
  db: {
    translate_history: mocks.translateHistory,
    settings: mocks.settings
  }
}))

vi.mock('@renderer/utils', () => ({
  uuid: mocks.uuid
}))

vi.mock('@renderer/utils/abortController', () => ({
  readyToAbort: mocks.readyToAbort
}))

vi.mock('@renderer/utils/analytics', () => ({
  trackTokenUsage: mocks.trackTokenUsage
}))

vi.mock('../ApiService', () => ({
  fetchChatCompletion: mocks.fetchChatCompletion
}))

vi.mock('../AssistantService', () => ({
  getDefaultTranslateAssistant: mocks.getDefaultTranslateAssistant
}))

vi.mock('../GlossaryService', () => ({
  GlossaryService: {
    getByTargetLanguage: vi.fn().mockResolvedValue([])
  },
  buildCustomizedDictionary: vi.fn().mockReturnValue('')
}))

vi.mock('i18next', () => ({
  t: mocks.t
}))

import {
  createTranslateHistoryCacheKey,
  findReusableTranslateHistory,
  saveTranslateHistory,
  translateText
} from '../TranslateService'

describe('TranslateService reusable history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.uuid.mockReturnValue('history-1')
    mocks.settings.get.mockResolvedValue({ value: true })
  })

  it('normalizes whitespace and includes model in the cache key', () => {
    const key = createTranslateHistoryCacheKey({
      sourceText: '  hello   world  ',
      sourceLanguage: 'en-us',
      targetLanguage: 'zh-cn',
      modelId: 'model-a'
    })

    expect(key).toBe('translate:model-a:en-us:zh-cn:hello world')
  })

  it('looks up reusable history by indexed cache key', async () => {
    const history = {
      id: 'history-2',
      sourceText: 'hello',
      targetText: '你好',
      sourceLanguage: 'en-us',
      targetLanguage: 'zh-cn',
      modelId: 'model-a',
      cacheKey: 'translate:model-a:en-us:zh-cn:hello',
      createdAt: new Date().toISOString()
    } satisfies TranslateHistory
    mocks.translateHistory.last.mockResolvedValue(history)

    const result = await findReusableTranslateHistory({
      sourceText: 'hello',
      sourceLanguage: 'en-us',
      targetLanguage: 'zh-cn',
      modelId: 'model-a'
    })

    expect(mocks.translateHistory.where).toHaveBeenCalledWith('cacheKey')
    expect(mocks.translateHistory.equals).toHaveBeenCalledWith('translate:model-a:en-us:zh-cn:hello')
    expect(result).toBe(history)
  })

  it('saves cache metadata for new history rows', async () => {
    mocks.translateHistory.last.mockResolvedValue(undefined)

    await saveTranslateHistory('hello', '你好', 'en-us', 'zh-cn', { modelId: 'model-a' })

    expect(mocks.translateHistory.add).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'history-1',
        sourceText: 'hello',
        targetText: '你好',
        sourceLanguage: 'en-us',
        targetLanguage: 'zh-cn',
        modelId: 'model-a',
        cacheKey: 'translate:model-a:en-us:zh-cn:hello'
      })
    )
  })

  it('overwrites the existing reusable row on forced refresh', async () => {
    const existing = {
      id: 'history-existing',
      sourceText: 'hello',
      targetText: '旧翻译',
      sourceLanguage: 'en-us',
      targetLanguage: 'zh-cn',
      modelId: 'model-a',
      cacheKey: 'translate:model-a:en-us:zh-cn:hello',
      createdAt: '2024-01-01T00:00:00.000Z',
      star: true
    } satisfies TranslateHistory
    mocks.translateHistory.last.mockResolvedValue(existing)

    await saveTranslateHistory('hello', '新翻译', 'en-us', 'zh-cn', {
      modelId: 'model-a',
      overwriteExisting: true
    })

    expect(mocks.translateHistory.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'history-existing',
        sourceText: 'hello',
        targetText: '新翻译',
        sourceLanguage: 'en-us',
        targetLanguage: 'zh-cn',
        modelId: 'model-a',
        cacheKey: 'translate:model-a:en-us:zh-cn:hello',
        star: true
      })
    )
    expect(mocks.translateHistory.add).not.toHaveBeenCalled()
  })

  it('forwards explicit reasoning effort overrides to translate assistant creation', async () => {
    const targetLanguage = { langCode: 'zh-cn', value: 'Chinese' } as any
    mocks.getDefaultTranslateAssistant.mockReturnValue({
      content: 'Translate hello',
      model: { id: 'model-a' },
      settings: {}
    })
    mocks.fetchChatCompletion.mockImplementation(async ({ onChunkReceived }) => {
      onChunkReceived?.({ type: ChunkType.TEXT_DELTA, text: '你好' })
      onChunkReceived?.({ type: ChunkType.TEXT_COMPLETE, text: '你好' })
    })

    const result = await translateText('hello', targetLanguage, undefined, undefined, {
      reasoningEffort: 'default'
    })

    expect(mocks.getDefaultTranslateAssistant).toHaveBeenCalledWith(
      targetLanguage,
      'hello',
      {
        reasoning_effort: 'default'
      },
      ''
    )
    expect(result).toBe('你好')
  })

  it('uses minimize-thinking setting when no explicit reasoning effort is provided', async () => {
    const targetLanguage = { langCode: 'zh-cn', value: 'Chinese' } as any
    mocks.settings.get.mockResolvedValue({ value: false })
    mocks.getDefaultTranslateAssistant.mockReturnValue({
      content: 'Translate hello',
      model: { id: 'model-a' },
      settings: {}
    })
    mocks.fetchChatCompletion.mockImplementation(async ({ onChunkReceived }) => {
      onChunkReceived?.({ type: ChunkType.TEXT_DELTA, text: '你好' })
      onChunkReceived?.({ type: ChunkType.TEXT_COMPLETE, text: '你好' })
    })

    const result = await translateText('hello', targetLanguage)

    expect(mocks.settings.get).toHaveBeenCalledWith({ id: 'translate:auto-disable-thinking' })
    expect(mocks.getDefaultTranslateAssistant).toHaveBeenCalledWith(
      targetLanguage,
      'hello',
      {
        reasoning_effort: 'default'
      },
      ''
    )
    expect(result).toBe('你好')
  })

  it('falls back to minimize-thinking when setting read fails', async () => {
    const targetLanguage = { langCode: 'zh-cn', value: 'Chinese' } as any
    mocks.settings.get.mockRejectedValue(new Error('db offline'))
    mocks.getDefaultTranslateAssistant.mockReturnValue({
      content: 'Translate hello',
      model: { id: 'model-a' },
      settings: {}
    })
    mocks.fetchChatCompletion.mockImplementation(async ({ onChunkReceived }) => {
      onChunkReceived?.({ type: ChunkType.TEXT_DELTA, text: '你好' })
      onChunkReceived?.({ type: ChunkType.TEXT_COMPLETE, text: '你好' })
    })

    const result = await translateText('hello', targetLanguage)

    expect(mocks.getDefaultTranslateAssistant).toHaveBeenCalledWith(
      targetLanguage,
      'hello',
      {
        reasoning_effort: 'none'
      },
      ''
    )
    expect(result).toBe('你好')
  })
})
