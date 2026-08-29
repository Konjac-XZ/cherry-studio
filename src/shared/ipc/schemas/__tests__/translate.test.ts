import { describe, expect, it } from 'vitest'

import { translateRequestSchemas } from '../translate'

describe('translate.open IPC schema', () => {
  const open = translateRequestSchemas['translate.open']
  const base = {
    streamId: 'translate:stream-1',
    text: 'hello',
    targetLangCode: 'en-us' as const
  }

  it('accepts a canonical translation trace scope', () => {
    const input = open.input.parse({
      ...base,
      traceTopicId: 'translate:123e4567-e89b-42d3-a456-426614174000',
      traceId: '0123456789abcdef0123456789abcdef'
    })
    const output = open.output.parse({
      streamId: base.streamId,
      traceId: '0123456789abcdef0123456789abcdef'
    })

    expect(input.traceTopicId).toBe('translate:123e4567-e89b-42d3-a456-426614174000')
    expect(output.traceId).toBe('0123456789abcdef0123456789abcdef')
  })

  it.each([
    'topic:123e4567-e89b-42d3-a456-426614174000',
    'translate:../trace',
    'translate:123e4567-e89b-42d3-a456-426614174000/child',
    'translate:123E4567-E89B-42D3-A456-426614174000'
  ])('rejects an external or path-like trace topic: %s', (traceTopicId) => {
    expect(open.input.safeParse({ ...base, traceTopicId }).success).toBe(false)
  })

  it.each(['ABCDEF0123456789ABCDEF0123456789', '0123456789abcdef', 'g123456789abcdef0123456789abcdef'])(
    'rejects malformed trace id: %s',
    (traceId) => {
      expect(open.input.safeParse({ ...base, traceId }).success).toBe(false)
      expect(open.output.safeParse({ streamId: base.streamId, traceId }).success).toBe(false)
    }
  )

  it('rejects a trace id without its translation trace topic', () => {
    expect(open.input.safeParse({ ...base, traceId: '0123456789abcdef0123456789abcdef' }).success).toBe(false)
  })
})
