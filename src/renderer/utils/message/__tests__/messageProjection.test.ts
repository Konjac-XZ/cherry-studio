import { describe, expect, it } from 'vitest'

import { isMessageVisibleInConversation, sharedMessageToUIMessage } from '../messageProjection'

describe('sharedMessageToUIMessage', () => {
  it('projects persisted assistant turn options into UI metadata', () => {
    const message = sharedMessageToUIMessage({
      id: 'assistant-1',
      topicId: 'topic-1',
      parentId: 'user-1',
      role: 'assistant',
      data: {
        parts: [],
        turnOptions: { reasoningEffort: 'high', fastMode: true }
      },
      searchableText: '',
      status: 'success',
      siblingsGroupId: 0,
      modelId: 'provider::model',
      messageSnapshot: null,
      stats: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })

    expect(message.metadata?.turnOptions).toEqual({ reasoningEffort: 'high', fastMode: true })
  })

  it('projects presentation visibility without removing the persisted content', () => {
    const message = sharedMessageToUIMessage({
      id: 'user-1',
      topicId: 'topic-1',
      parentId: 'root-1',
      role: 'user',
      data: {
        parts: [{ type: 'text', text: 'keep this in context' }],
        presentation: { hiddenInChat: true }
      },
      searchableText: 'keep this in context',
      status: 'success',
      siblingsGroupId: 0,
      modelId: null,
      messageSnapshot: null,
      stats: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z'
    })

    expect(message.parts).toEqual([{ type: 'text', text: 'keep this in context' }])
    expect(message.metadata).toMatchObject({
      hiddenInChat: true,
      updatedAt: '2026-01-01T00:00:01.000Z'
    })
    expect(isMessageVisibleInConversation(message)).toBe(false)
  })
})
