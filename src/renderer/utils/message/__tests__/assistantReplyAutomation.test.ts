import { describe, expect, it } from 'vitest'

import type { CherryUIMessage, MessageStatus } from '@shared/data/types/message'

import {
  getAssistantRepliesForUser,
  isHighestPriorityAssistantReply,
  shouldHideOriginatingUserMessage
} from '../assistantReplyAutomation'

function reply(id: string, modelId: string, status: MessageStatus = 'pending'): CherryUIMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text: id }],
    metadata: { parentId: 'user-1', modelId, status }
  }
}

describe('assistant reply automation policy', () => {
  it('selects the first available mentioned model as the only automation owner', () => {
    const modelB = reply('reply-b', 'provider::b')
    const modelA = reply('reply-a', 'provider::a')
    const siblings = [modelB, modelA]

    expect(isHighestPriorityAssistantReply(modelA, siblings, { mentionedModelIds: ['provider::a'] })).toBe(true)
    expect(isHighestPriorityAssistantReply(modelB, siblings, { mentionedModelIds: ['provider::a'] })).toBe(false)
  })

  it('hides the user only after every sibling is terminal and one succeeded', () => {
    const first = reply('reply-a', 'provider::a')
    const second = reply('reply-b', 'provider::b')
    const terminal = new Map<string, MessageStatus>([['reply-a', 'success']])

    expect(shouldHideOriginatingUserMessage([first, second], terminal)).toBe(false)
    terminal.set('reply-b', 'error')
    expect(shouldHideOriginatingUserMessage([first, second], terminal)).toBe(true)
    terminal.set('reply-a', 'error')
    expect(shouldHideOriginatingUserMessage([first, second], terminal)).toBe(false)
  })

  it('groups only direct assistant children of the originating user', () => {
    const direct = reply('direct', 'provider::a')
    const nested = { ...reply('nested', 'provider::b'), metadata: { parentId: 'assistant-1' } }
    const user = { id: 'user-1', role: 'user', parts: [] } as CherryUIMessage

    expect(getAssistantRepliesForUser([user, direct, nested], user.id)).toEqual([direct])
  })
})
