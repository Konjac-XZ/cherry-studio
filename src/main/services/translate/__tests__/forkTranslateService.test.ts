import { MockMainPreferenceServiceUtils } from '@test-mocks/main/PreferenceService'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MODEL_CAPABILITY } from '@shared/data/types/model'
import type { TranslateLanguage } from '@shared/data/types/translate'

// `application.get('PreferenceService')` is mocked globally via
// tests/main.setup.ts. We only need to override `AiStreamManager` so we can
// assert on the streamPrompt call.
const streamPromptMock = vi.fn(() => ({ mode: 'started' as const, activeExecutions: [] }))

vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  return mockApplicationFactory({
    AiStreamManager: { streamPrompt: streamPromptMock }
  } as never)
})

const getByKeyMock = vi.fn()
const listModelsMock = vi.fn()
vi.mock('@main/data/services/ModelService', () => ({
  modelService: { getByKey: getByKeyMock, list: listModelsMock }
}))

const glossaryListMock = vi.fn()
vi.mock('@main/data/services/TranslateGlossaryService', () => ({
  translateGlossaryService: { list: glossaryListMock },
  buildCustomizedDictionary: (entries: Array<{ sourcePhrase: string; targetPhrase: string }>) =>
    entries.map((entry) => `${entry.sourcePhrase} -> ${entry.targetPhrase}`).join('\n')
}))

const getByLangCodeMock = vi.fn()
vi.mock('@main/data/services/TranslateLanguageService', () => ({
  translateLanguageService: { getByLangCode: getByLangCodeMock }
}))

const messageGetByIdMock = vi.fn()
const messageUpdateMock = vi.fn()
vi.mock('@main/data/services/MessageService', () => ({
  messageService: { getById: messageGetByIdMock, update: messageUpdateMock }
}))

// `WebContentsListener` writes to `event.sender.send(...)` — stub it so the
// test doesn't need a real WebContents.
vi.mock('../../../ai/streamManager/listeners/WebContentsListener', () => ({
  WebContentsListener: class {
    id: string
    onError = vi.fn()

    constructor(
      readonly sender: unknown,
      readonly streamId: string
    ) {
      this.id = `wc:test:${streamId}`
    }
  }
}))

const { TerminalPersistenceError } = await import('../../../ai/streamManager/listeners/PersistenceListener')
const { translateService } = await import('../forkTranslateService')

const TARGET: TranslateLanguage = {
  langCode: 'en-us',
  value: 'English',
  emoji: '🇺🇸',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
} as unknown as TranslateLanguage

const fakeSender = { id: 1 } as unknown as Electron.WebContents

beforeEach(() => {
  MockMainPreferenceServiceUtils.resetMocks()
  getByKeyMock.mockReset()
  listModelsMock.mockReset()
  listModelsMock.mockReturnValue([])
  glossaryListMock.mockReset()
  glossaryListMock.mockReturnValue([])
  getByLangCodeMock.mockReset()
  messageGetByIdMock.mockReset()
  messageUpdateMock.mockReset()
  streamPromptMock.mockReset()
  streamPromptMock.mockReturnValue({ mode: 'started' as const, activeExecutions: [] })
})

describe('translateService.resolveTranslatePayload', () => {
  it('interpolates {{target_language}} and {{text}} into the configured prompt', async () => {
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model_id', 'openai::gpt-4o')
    MockMainPreferenceServiceUtils.setPreferenceValue(
      'feature.translate.prompt.native_to_other',
      'Translate to {{target_language}}: {{text}}'
    )
    getByKeyMock.mockReturnValue({
      id: 'openai::gpt-4o',
      providerId: 'openai',
      apiModelId: 'gpt-4o',
      name: 'GPT-4o',
      capabilities: []
    })

    const payload = translateService.resolveTranslatePayload('hello', TARGET)

    expect(payload.uniqueModelId).toBe('openai::gpt-4o')
    expect(payload.content).toBe('Translate to English: hello')
    expect(getByKeyMock).toHaveBeenCalledWith('openai', 'gpt-4o')
  })

  it('injects target-language glossary terms only when the prompt requests the dictionary', () => {
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model_id', 'openai::gpt-4o')
    MockMainPreferenceServiceUtils.setPreferenceValue(
      'feature.translate.prompt.native_to_other',
      'Glossary:\n{{customized_dictionary}}\nTranslate {{text}}'
    )
    getByKeyMock.mockReturnValue({
      id: 'openai::gpt-4o',
      providerId: 'openai',
      apiModelId: 'gpt-4o',
      name: 'GPT-4o',
      capabilities: []
    })
    glossaryListMock.mockReturnValue([{ sourcePhrase: 'OpenAI', targetPhrase: '开放人工智能' }])

    const payload = translateService.resolveTranslatePayload('OpenAI model', TARGET)

    expect(glossaryListMock).toHaveBeenCalledWith({ targetLanguage: 'en-us', enabled: true })
    expect(payload.content).toContain('OpenAI -> 开放人工智能')
  })

  it('skips interpolation for Qwen MT models — passes raw source text', async () => {
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model_id', 'dashscope::qwen-mt-turbo')
    MockMainPreferenceServiceUtils.setPreferenceValue(
      'feature.translate.prompt.native_to_other',
      'Translate to {{target_language}}: {{text}}'
    )
    getByKeyMock.mockReturnValue({
      id: 'dashscope::qwen-mt-turbo',
      providerId: 'dashscope',
      apiModelId: 'qwen-mt-turbo',
      name: 'Qwen MT Turbo',
      capabilities: []
    })

    const payload = translateService.resolveTranslatePayload('原文', TARGET)

    expect(payload.uniqueModelId).toBe('dashscope::qwen-mt-turbo')
    expect(payload.content).toBe('原文')
  })

  it('uses the other-to-native override for equivalent Chinese variants', () => {
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.native_language', 'zh-cn')
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model_id', 'openai::global')
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model.other_to_native_follows_global', false)
    MockMainPreferenceServiceUtils.setPreferenceValue(
      'feature.translate.model.other_to_native_id',
      'anthropic::directional'
    )
    MockMainPreferenceServiceUtils.setPreferenceValue(
      'feature.translate.prompt.other_to_native',
      'TO {{target_language}}: {{text}}'
    )
    getByKeyMock.mockImplementation((providerId: string, modelId: string) => ({
      id: `${providerId}::${modelId}`,
      providerId,
      apiModelId: modelId,
      name: modelId,
      capabilities: []
    }))

    const payload = translateService.resolveTranslatePayload('hello', {
      ...TARGET,
      langCode: 'zh-tw',
      value: '繁體中文'
    } as TranslateLanguage)

    expect(payload.uniqueModelId).toBe('anthropic::directional')
    expect(payload.content).toBe('TO 繁體中文: hello')
    expect(getByKeyMock).toHaveBeenCalledWith('anthropic', 'directional')
  })

  it('falls back from a stale directional override to the global translate model', () => {
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model_id', 'openai::global')
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model.native_to_other_follows_global', false)
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model.native_to_other_id', 'missing::gone')
    getByKeyMock.mockImplementation((providerId: string, modelId: string) => {
      if (providerId === 'missing') throw new Error('deleted')
      return {
        id: `${providerId}::${modelId}`,
        providerId,
        apiModelId: modelId,
        name: modelId,
        capabilities: []
      }
    })

    expect(translateService.resolveTranslatePayload('hello', TARGET).uniqueModelId).toBe('openai::global')
  })

  it('resolves polish override, prompt, custom parameters, and custom reasoning precedence', () => {
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model_id', 'openai::translate')
    MockMainPreferenceServiceUtils.setPreferenceValue(
      'feature.translate.model.polish_global_id',
      'openai::polish-global'
    )
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model.polish_id', 'anthropic::polish-override')
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.prompt.polish', 'Polish: {{text}}')
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.reasoning.polish_auto_disable', true)
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.request.polish_custom_parameters', [
      { name: 'temperature', type: 'number', value: 0.1 },
      { name: 'enable_thinking', type: 'boolean', value: false }
    ])
    getByKeyMock.mockImplementation((providerId: string, modelId: string) => ({
      id: `${providerId}::${modelId}`,
      providerId,
      apiModelId: modelId,
      name: modelId,
      capabilities: []
    }))

    const payload = translateService.resolveTranslatePayload('draft', TARGET, 'polish')

    expect(payload).toMatchObject({
      uniqueModelId: 'anthropic::polish-override',
      content: 'Polish: draft',
      reasoningEffort: 'default',
      customParameters: { temperature: 0.1, enable_thinking: false }
    })
  })

  it('throws translate.error.not_configured when the translate model preference is unset', async () => {
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model_id', '')

    expect(() => translateService.resolveTranslatePayload('source', TARGET)).toThrow('translate.error.not_configured')
    expect(getByKeyMock).not.toHaveBeenCalled()
  })

  it('throws translate.error.not_configured when the model row is missing', async () => {
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model_id', 'openai::gpt-4o')
    getByKeyMock.mockImplementation(() => {
      throw new Error('not found')
    })

    expect(() => translateService.resolveTranslatePayload('source', TARGET)).toThrow('translate.error.not_configured')
  })
})

describe('translateService.open', () => {
  beforeEach(() => {
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.model_id', 'openai::gpt-4o')
    MockMainPreferenceServiceUtils.setPreferenceValue(
      'feature.translate.prompt.native_to_other',
      'Translate to {{target_language}}: {{text}}'
    )
    getByKeyMock.mockReturnValue({
      id: 'openai::gpt-4o',
      providerId: 'openai',
      apiModelId: 'gpt-4o',
      name: 'GPT-4o',
      capabilities: []
    })
    getByLangCodeMock.mockReturnValue(TARGET)
  })

  it('uses the renderer-supplied streamId, resolves the DTO, and dispatches via streamManager.streamPrompt', async () => {
    const streamId = 'translate:caller-supplied-id'
    const result = translateService.open(fakeSender, {
      streamId,
      text: 'hello',
      targetLangCode: 'en-us'
    })

    expect(getByLangCodeMock).toHaveBeenCalledWith('en-us')
    expect(result.streamId).toBe(streamId)
    expect(streamPromptMock).toHaveBeenCalledTimes(1)
    const arg = (
      streamPromptMock.mock.calls as unknown as Array<
        [
          {
            streamId: string
            uniqueModelId: string
            prompt: string
            reasoningEffort?: string
            listener: { id: string } | Array<{ id: string }>
          }
        ]
      >
    )[0][0]
    expect(arg.streamId).toBe(streamId)
    expect(arg.uniqueModelId).toBe('openai::gpt-4o')
    expect(arg.prompt).toBe('Translate to English: hello')
    // Prefer thinking off, or the lowest supported tier when the model cannot turn it off.
    expect(arg.reasoningEffort).toBe('none')
    const listeners = Array.isArray(arg.listener) ? arg.listener : [arg.listener]
    expect(listeners).toHaveLength(1)
    expect(listeners[0].id).toBe(`wc:test:${streamId}`)
  })

  it('forwards operation-specific custom parameters at call scope', () => {
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.request.custom_parameters', [
      { name: 'temperature', type: 'number', value: 0.25 }
    ])

    translateService.open(fakeSender, {
      streamId: 'translate:custom-parameters',
      text: 'hello',
      targetLangCode: 'en-us'
    })

    expect(streamPromptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        callOverrides: { customParameters: { temperature: 0.25 } },
        reasoningEffort: 'none'
      })
    )
  })

  it('gates sampling against the frozen model without adopting the upstream global parameter settings', () => {
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.request.custom_parameters', [
      { name: 'temperature', type: 'number', value: 0.25 },
      { name: 'top_p', type: 'number', value: 0.8 },
      { name: 'seed', type: 'number', value: 42 }
    ])
    MockMainPreferenceServiceUtils.setPreferenceValue('feature.translate.reasoning_effort', 'high')
    getByKeyMock.mockReturnValue({
      id: 'anthropic::claude-sonnet-4-5',
      providerId: 'anthropic',
      apiModelId: 'claude-sonnet-4-5',
      name: 'Claude Sonnet 4.5',
      capabilities: [MODEL_CAPABILITY.REASONING],
      reasoning: { controls: [{ kind: 'effort', values: ['low', 'high'] }], selectableEfforts: ['low', 'high'] }
    })

    translateService.open(fakeSender, {
      streamId: 'translate:frozen-sampling',
      text: 'hello',
      targetLangCode: 'en-us',
      modelId: 'anthropic::claude-sonnet-4-5'
    })

    expect(streamPromptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        uniqueModelId: 'anthropic::claude-sonnet-4-5',
        callOverrides: { customParameters: { seed: 42 } },
        reasoningEffort: 'none'
      })
    )
  })

  it('ignores renderer trace input when developer mode is disabled', () => {
    const result = translateService.open(fakeSender, {
      streamId: 'translate:untraced',
      text: 'hello',
      targetLangCode: 'en-us',
      traceTopicId: 'translate:123e4567-e89b-42d3-a456-426614174000',
      traceId: '0123456789abcdef0123456789abcdef'
    })

    expect(result.traceId).toBeUndefined()
    expect(streamPromptMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ traceTopicId: expect.anything(), rootSpan: expect.anything() })
    )
    const arg = (streamPromptMock.mock.calls as unknown as Array<[{ listener: Array<{ id: string }> }]>)[0][0]
    expect(arg.listener.map((listener) => listener.id)).not.toContain(
      'persistence:trace:translate:123e4567-e89b-42d3-a456-426614174000'
    )
  })

  it('creates and then reuses one container trace across translation stages in developer mode', () => {
    MockMainPreferenceServiceUtils.setPreferenceValue('app.developer_mode.enabled', true)
    const traceTopicId = 'translate:123e4567-e89b-42d3-a456-426614174000'
    const first = translateService.open(fakeSender, {
      streamId: 'translate:polish-stage',
      text: 'draft',
      targetLangCode: 'en-us',
      operation: 'polish',
      traceTopicId
    })
    const second = translateService.open(fakeSender, {
      streamId: 'translate:translate-stage',
      text: 'polished',
      targetLangCode: 'en-us',
      operation: 'translate',
      traceTopicId,
      traceId: first.traceId
    })

    expect(first.traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(second.traceId).toBe(first.traceId)
    const calls = streamPromptMock.mock.calls as unknown as Array<
      [{ traceTopicId?: string; rootSpan?: unknown; listener: Array<{ id: string }> }]
    >
    expect(calls).toHaveLength(2)
    for (const [input] of calls) {
      expect(input.traceTopicId).toBe(traceTopicId)
      expect(input.rootSpan).toBeDefined()
      expect(input.listener.map((listener) => listener.id)).toContain(`persistence:trace:${traceTopicId}`)
    }
  })

  it('stacks a PersistenceListener when the request carries a messageId', async () => {
    const streamId = 'translate:msg-bound'
    translateService.open(fakeSender, {
      streamId,
      text: 'hello',
      targetLangCode: 'en-us',
      messageId: 'msg-42'
    })

    expect(streamPromptMock).toHaveBeenCalledTimes(1)
    const arg = (
      streamPromptMock.mock.calls as unknown as Array<[{ listener: { id: string } | Array<{ id: string }> }]>
    )[0][0]
    const listeners = Array.isArray(arg.listener) ? arg.listener : [arg.listener]
    expect(listeners).toHaveLength(2)
    // Persistence listener is registered FIRST so terminal-event dispatch
    // (which awaits each listener serially in the manager) finishes the DB
    // write before `WebContentsListener.onDone` sends `Ai_StreamDone`. The
    // renderer can then trust the standard done IPC as "safe to refresh".
    expect(listeners[0].id).toContain('persistence:translation')
    expect(listeners[1].id).toBe(`wc:test:${streamId}`)
  })

  it('surfaces a persist failure to the renderer via WebContentsListener.onError (C1)', async () => {
    // TranslationBackend has no markTerminalError, so the only live-renderer signal on a
    // persist failure is onPersistFailed → wcListener.onError. Force the persist to throw.
    messageGetByIdMock.mockImplementation(() => {
      throw new Error('db down')
    })

    const streamId = 'translate:persist-fail'
    translateService.open(fakeSender, { streamId, text: 'hello', targetLangCode: 'en-us', messageId: 'm1' })

    const arg = (streamPromptMock.mock.calls as unknown as Array<[{ listener: any }]>)[0][0]
    const listeners = Array.isArray(arg.listener) ? arg.listener : [arg.listener]
    const persistence = listeners.find((l: { id: string }) => l.id.includes('persistence'))
    const wc = listeners.find((l: { id: string }) => l.id.startsWith('wc:'))

    await expect(
      persistence.onDone({
        finalMessage: { id: 'x', role: 'assistant', parts: [{ type: 'text', text: 'hola' }] },
        status: 'success'
      })
    ).rejects.toBeInstanceOf(TerminalPersistenceError)

    expect(wc.onError).toHaveBeenCalledTimes(1)
    expect(wc.onError).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', isTopicDone: true }))
  })

  it('rejects a streamId that does not carry the translate prefix', async () => {
    expect(() =>
      translateService.open(fakeSender, {
        streamId: 'agent-session:bogus',
        text: 'hello',
        targetLangCode: 'en-us'
      })
    ).toThrow(/translate:/)
    expect(getByLangCodeMock).not.toHaveBeenCalled()
    expect(streamPromptMock).not.toHaveBeenCalled()
  })

  it('throws for an invalid lang code without touching the DTO service or stream manager', async () => {
    expect(() =>
      translateService.open(fakeSender, {
        streamId: 'translate:abc',
        text: 'hello',
        targetLangCode: 'not-a-real-code' as any
      })
    ).toThrow('Invalid target language: not-a-real-code')
    expect(getByLangCodeMock).not.toHaveBeenCalled()
    expect(streamPromptMock).not.toHaveBeenCalled()
  })

  it('throws for the "unknown" sentinel', async () => {
    expect(() =>
      translateService.open(fakeSender, {
        streamId: 'translate:abc',
        text: 'hello',
        targetLangCode: 'unknown' as any
      })
    ).toThrow('Invalid target language: unknown')
    expect(getByLangCodeMock).not.toHaveBeenCalled()
  })
})
