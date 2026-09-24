import { describe, expect, it } from 'vitest'

import type { CherryMessagePart } from '@shared/data/types/message'

import { ASSISTANT_REPLY_BEAUTIFY_SETTINGS, postProcessAssistantReplyParts } from '../assistantReplyPostProcessing'

describe('postProcessAssistantReplyParts', () => {
  it('processes every text part while preserving non-text parts and their order', () => {
    const file = { type: 'file', mediaType: 'image/png', url: 'file://image.png' } as CherryMessagePart
    const parts = [
      { type: 'text', text: '他说 "hello世界"。' },
      file,
      { type: 'text', text: '第二段with English。' }
    ] as CherryMessagePart[]

    const result = postProcessAssistantReplyParts(parts, ASSISTANT_REPLY_BEAUTIFY_SETTINGS)

    expect(result.changed).toBe(true)
    expect(result.parts[1]).toBe(file)
    expect(result.parts.map((part) => (part.type === 'text' ? part.text : part.type))).toEqual([
      '他说“hello 世界”。',
      'file',
      '第二段 with English。'
    ])
    expect(result.text).toBe('他说“hello 世界”。\n\n第二段 with English。')
  })

  it('returns the original text unchanged when processing is disabled', () => {
    const parts = [{ type: 'text', text: 'hello世界' }] as CherryMessagePart[]

    expect(postProcessAssistantReplyParts(parts, null)).toEqual({
      changed: false,
      parts,
      text: 'hello世界'
    })
  })
})
