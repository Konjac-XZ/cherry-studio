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

vi.mock('@renderer/config/prompts', () => ({
  TRANSLATE_NATIVE_LANGUAGE_PROMPT: 'native {{text}}',
  TRANSLATE_PROMPT: 'translate {{text}} to {{target_language}}'
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
      }
    })
  })

  it('prefers an explicit reasoning override from the caller', () => {
    mocks.getModelSupportedReasoningEffortOptions.mockReturnValue(['none', 'low', 'medium'])

    const assistant = getDefaultTranslateAssistant({ langCode: 'zh-cn', value: 'Chinese' } as any, 'hello', {
      reasoning_effort: 'default'
    })

    expect(assistant.settings?.reasoning_effort).toBe('default')
  })

  it('falls back to none when the model supports disabling reasoning', () => {
    mocks.getModelSupportedReasoningEffortOptions.mockReturnValue(['none', 'low', 'medium'])

    const assistant = getDefaultTranslateAssistant({ langCode: 'zh-cn', value: 'Chinese' } as any, 'hello')

    expect(assistant.settings?.reasoning_effort).toBe('none')
  })

  it('falls back to default when the model cannot disable reasoning', () => {
    mocks.getModelSupportedReasoningEffortOptions.mockReturnValue(['low', 'medium'])

    const assistant = getDefaultTranslateAssistant({ langCode: 'zh-cn', value: 'Chinese' } as any, 'hello')

    expect(assistant.settings?.reasoning_effort).toBe('default')
  })
})
