import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getModelSupportedReasoningEffortOptions: vi.fn(),
  getState: vi.fn(),
  dispatch: vi.fn(),
  t: vi.fn((key: string) => key),
  uuid: vi.fn(() => 'topic-1'),
  addAssistant: vi.fn()
}))

vi.mock('@renderer/config/models', () => ({
  getModelSupportedReasoningEffortOptions: mocks.getModelSupportedReasoningEffortOptions
}))

vi.mock('@renderer/config/models/qwen', () => ({
  isQwenMTModel: () => false
}))

vi.mock('@data/PreferenceService', () => ({
  preferenceService: {
    get: vi.fn(async () => 'translate {{text}} to {{target_language}} {{customized_dictionary}}')
  }
}))

vi.mock('@renderer/config/translate', () => ({
  UNKNOWN: { langCode: 'unknown', value: 'Unknown' }
}))

vi.mock('@renderer/hooks/useStore', () => ({
  getStoreProviders: () => []
}))

vi.mock('@renderer/i18n', () => ({
  default: {
    t: mocks.t
  }
}))

vi.mock('@renderer/store', () => ({
  default: {
    getState: mocks.getState,
    dispatch: mocks.dispatch
  }
}))

vi.mock('@renderer/store/assistants', () => ({
  addAssistant: mocks.addAssistant
}))

vi.mock('@renderer/services/TranslationProcessingService', () => ({
  runTranslationPreProcessors: vi.fn(async () => ({ dictionary: '' }))
}))

vi.mock('uuid', () => ({
  v4: mocks.uuid
}))

import { getDefaultTranslateAssistant } from '../AssistantService'

describe('AssistantService.getDefaultTranslateAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getState.mockReturnValue({
      llm: {
        defaultModel: { id: 'default-model', provider: 'provider-a' },
        quickModel: null,
        translateModel: { id: 'translate-model', provider: 'provider-a' }
      },
      settings: {
        userNativeLanguage: 'en-us',
        nativeLanguageTranslateModelPrompt: '',
        otherLanguageTranslateModelPrompt: '',
        translateModelPrompt: 'translate {{text}} to {{target_language}}'
      },
      assistants: {
        defaultAssistant: {
          settings: {}
        }
      },
      translate: {
        settings: {
          autoCopy: false,
          customParameters: []
        }
      }
    })
  })

  it('prefers an explicit reasoning override from the caller', async () => {
    mocks.getModelSupportedReasoningEffortOptions.mockReturnValue(['none', 'low', 'medium'])

    const assistant = await getDefaultTranslateAssistant({ langCode: 'zh-cn', value: 'Chinese' } as any, 'hello', {
      reasoning_effort: 'default'
    })

    expect(assistant.settings?.reasoning_effort).toBe('default')
  })

  it('falls back to none when the model supports disabling reasoning', async () => {
    mocks.getModelSupportedReasoningEffortOptions.mockReturnValue(['none', 'low', 'medium'])

    const assistant = await getDefaultTranslateAssistant({ langCode: 'zh-cn', value: 'Chinese' } as any, 'hello')

    expect(assistant.settings?.reasoning_effort).toBe('none')
  })

  it('falls back to default when the model cannot disable reasoning', async () => {
    mocks.getModelSupportedReasoningEffortOptions.mockReturnValue(['low', 'medium'])

    const assistant = await getDefaultTranslateAssistant({ langCode: 'zh-cn', value: 'Chinese' } as any, 'hello')

    expect(assistant.settings?.reasoning_effort).toBe('default')
  })

  it('lets custom request body override minimized thinking defaults', async () => {
    mocks.getModelSupportedReasoningEffortOptions.mockReturnValue(['none', 'low', 'medium'])
    mocks.getState.mockReturnValue({
      llm: {
        defaultModel: { id: 'default-model', provider: 'provider-a' },
        quickModel: null,
        translateModel: { id: 'translate-model', provider: 'provider-a' }
      },
      settings: {
        userNativeLanguage: 'en-us',
        nativeLanguageTranslateModelPrompt: '',
        otherLanguageTranslateModelPrompt: '',
        translateModelPrompt: 'translate {{text}} to {{target_language}}'
      },
      assistants: {
        defaultAssistant: {
          settings: {}
        }
      },
      translate: {
        settings: {
          autoCopy: false,
          customParameters: [{ name: 'reasoningEffort', value: 'high', type: 'string' }]
        }
      }
    })

    const assistant = await getDefaultTranslateAssistant({ langCode: 'zh-cn', value: 'Chinese' } as any, 'hello')

    expect(assistant.settings?.reasoning_effort).toBe('default')
  })
})
