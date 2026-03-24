import { describe, expect, it, vi } from 'vitest'

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      verbose: vi.fn(),
      warn: vi.fn()
    })
  }
}))

vi.mock('@renderer/config/models', () => ({
  isQwenMTModel: vi.fn(() => false)
}))

vi.mock('@renderer/config/prompts', () => ({
  LANG_DETECT_PROMPT: ''
}))

vi.mock('@renderer/databases', () => ({
  default: {
    settings: {
      get: vi.fn()
    }
  }
}))

vi.mock('@renderer/i18n', () => ({
  default: {
    t: (key: string) => key
  }
}))

vi.mock('@renderer/services/ApiService', () => ({
  fetchChatCompletion: vi.fn()
}))

vi.mock('@renderer/services/AssistantService', () => ({
  getDefaultAssistant: vi.fn(() => ({})),
  getQuickModel: vi.fn(() => ({ id: 'quick-model' }))
}))

vi.mock('@renderer/services/ModelService', () => ({
  hasModel: vi.fn(() => true)
}))

vi.mock('@renderer/services/TokenService', () => ({
  estimateTextTokens: vi.fn(() => 0)
}))

vi.mock('@renderer/services/TranslateService', () => ({
  getAllCustomLanguages: vi.fn(async () => [])
}))

vi.mock('@renderer/types/chunk', () => ({
  ChunkType: {
    TEXT_DELTA: 'text-delta'
  }
}))

vi.mock('franc-min', () => ({
  franc: vi.fn(() => 'eng')
}))

import { LanguagesEnum, UNKNOWN } from '@renderer/config/translate'

import { determineTargetLanguage } from '../translate'

describe('utils/translate determineTargetLanguage', () => {
  const bidirectionalPair: [typeof LanguagesEnum.enUS, typeof LanguagesEnum.zhCN] = [LanguagesEnum.enUS, LanguagesEnum.zhCN]

  it('swaps to the other language when source is in the bidirectional pair', () => {
    const result = determineTargetLanguage(LanguagesEnum.enUS, LanguagesEnum.enUS, true, bidirectionalPair, LanguagesEnum.zhCN)

    expect(result).toEqual({
      success: true,
      language: LanguagesEnum.zhCN,
      mode: 'pair_swap'
    })
  })

  it('treats simplified and traditional chinese as the same native family inside the pair', () => {
    const result = determineTargetLanguage(LanguagesEnum.zhTW, LanguagesEnum.enUS, true, bidirectionalPair, LanguagesEnum.zhCN)

    expect(result).toEqual({
      success: true,
      language: LanguagesEnum.enUS,
      mode: 'pair_swap'
    })
  })

  it('falls back to the user native language when source is outside the pair', () => {
    const result = determineTargetLanguage(LanguagesEnum.jaJP, LanguagesEnum.enUS, true, bidirectionalPair, LanguagesEnum.zhCN)

    expect(result).toEqual({
      success: true,
      language: LanguagesEnum.zhCN,
      mode: 'native_fallback'
    })
  })

  it('falls back to the first pair language when native language is unavailable', () => {
    const result = determineTargetLanguage(LanguagesEnum.jaJP, LanguagesEnum.enUS, true, bidirectionalPair, UNKNOWN)

    expect(result).toEqual({
      success: true,
      language: LanguagesEnum.enUS,
      mode: 'native_fallback'
    })
  })

  it('falls back to the pair when native language matches the detected third language', () => {
    const result = determineTargetLanguage(LanguagesEnum.jaJP, LanguagesEnum.enUS, true, bidirectionalPair, LanguagesEnum.jaJP)

    expect(result).toEqual({
      success: true,
      language: LanguagesEnum.enUS,
      mode: 'native_fallback'
    })
  })

  it('does not route chinese variant mismatches back into the native language fallback', () => {
    const result = determineTargetLanguage(
      LanguagesEnum.zhTW,
      LanguagesEnum.enUS,
      true,
      [LanguagesEnum.enUS, LanguagesEnum.jaJP],
      LanguagesEnum.zhCN
    )

    expect(result).toEqual({
      success: true,
      language: LanguagesEnum.enUS,
      mode: 'native_fallback'
    })
  })

  it('rejects non-bidirectional same-language translations', () => {
    const result = determineTargetLanguage(LanguagesEnum.enUS, LanguagesEnum.enUS, false, bidirectionalPair, LanguagesEnum.zhCN)

    expect(result).toEqual({
      success: false,
      errorType: 'same_language'
    })
  })
})
