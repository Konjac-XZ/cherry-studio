import { describe, expect, it } from 'vitest'

import { makeModel } from '@main/ai/__tests__/fixtures'
import { MODEL_CAPABILITY } from '@shared/data/types/model'

import {
  gateTranslateSamplingParameters,
  hasTranslateReasoningOverride,
  isSameTranslateLanguageFamily,
  translateCustomParametersToRecord
} from '../translateRequestOptions'

describe('translateRequestOptions', () => {
  it('normalizes sampling aliases, preserves provider overrides, and rejects invalid sampling values', () => {
    const model = makeModel()
    expect(gateTranslateSamplingParameters({ temperature: 0.2, top_p: 0.8, seed: 42 }, model, 'none')).toEqual({
      temperature: 0.2,
      topP: 0.8,
      seed: 42
    })
    expect(gateTranslateSamplingParameters({ topP: 0.7, top_p: 0.8 }, model, 'none')).toEqual({ topP: 0.7 })
    expect(() => gateTranslateSamplingParameters({ temperature: 'hot' }, model, 'none')).toThrow()
    expect(() => gateTranslateSamplingParameters({ top_p: 2 }, model, 'none')).toThrow()
  })

  it('applies model sampling gates when none resolves to the lowest supported thinking tier', () => {
    const model = makeModel({
      id: 'anthropic::claude-sonnet-4-5',
      providerId: 'anthropic',
      capabilities: [MODEL_CAPABILITY.REASONING],
      reasoning: { controls: [{ kind: 'effort', values: ['low', 'high'] }], selectableEfforts: ['low', 'high'] }
    })
    expect(gateTranslateSamplingParameters({ temperature: 0.2, seed: 42 }, model, 'none')).toEqual({ seed: 42 })
    expect(gateTranslateSamplingParameters({ top_p: 0.8 }, model, 'none')).toEqual({ topP: 0.95 })
    expect(gateTranslateSamplingParameters({ temperature: 0.2, topP: 0.8 }, model, 'default')).toEqual({
      temperature: 0.2
    })
  })

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
