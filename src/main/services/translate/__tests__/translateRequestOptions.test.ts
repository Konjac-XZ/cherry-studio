import { describe, expect, it } from 'vitest'

import {
  hasTranslateReasoningOverride,
  isSameTranslateLanguageFamily,
  translateCustomParametersToRecord
} from '../translateRequestOptions'

describe('translateRequestOptions', () => {
  it('decodes persisted custom parameters and trims names', () => {
    expect(
      translateCustomParametersToRecord([
        { name: ' temperature ', type: 'number', value: 0.2 },
        { name: 'chat_template_kwargs', type: 'json', value: '{"enable_thinking":false}' },
        { name: 'alreadyDecoded', type: 'json', value: { nested: true } },
        { name: 'rawInvalidJson', type: 'json', value: '{oops' },
        { name: 'removed', type: 'json', value: 'undefined' },
        { name: '   ', type: 'string', value: 'ignored' }
      ])
    ).toEqual({
      temperature: 0.2,
      chat_template_kwargs: { enable_thinking: false },
      alreadyDecoded: { nested: true },
      rawInvalidJson: '{oops',
      removed: undefined
    })
  })

  it('recognizes direct and nested provider reasoning overrides', () => {
    expect(hasTranslateReasoningOverride([{ name: 'enable_thinking', type: 'boolean', value: false }])).toBe(true)
    expect(hasTranslateReasoningOverride([{ name: 'extra_body.reasoning', type: 'string', value: 'none' }])).toBe(true)
    expect(hasTranslateReasoningOverride([{ name: 'temperature', type: 'number', value: 0.2 }])).toBe(false)
  })

  it('treats simplified and traditional Chinese as the same direction family', () => {
    expect(isSameTranslateLanguageFamily('zh-cn', 'zh-tw')).toBe(true)
    expect(isSameTranslateLanguageFamily('zh-tw', 'zh-cn')).toBe(true)
    expect(isSameTranslateLanguageFamily('en-us', 'en-us')).toBe(true)
    expect(isSameTranslateLanguageFamily('en-us', 'zh-cn')).toBe(false)
    expect(isSameTranslateLanguageFamily('unknown', 'zh-cn')).toBe(false)
  })
})
