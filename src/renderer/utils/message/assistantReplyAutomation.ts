import type { AssistantSettings } from '@shared/data/types/assistant'
import type { CherryUIMessage, MessageStatus } from '@shared/data/types/message'

const TERMINAL_STATUSES = new Set<MessageStatus>(['success', 'error', 'paused'])

export function getAssistantRepliesForUser(
  messages: readonly CherryUIMessage[],
  userMessageId: string
): CherryUIMessage[] {
  return messages.filter((message) => message.role === 'assistant' && message.metadata?.parentId === userMessageId)
}

export function isHighestPriorityAssistantReply(
  current: CherryUIMessage,
  siblings: readonly CherryUIMessage[],
  settings?: Pick<AssistantSettings, 'mentionedModelIds'> | null
): boolean {
  const priority = settings?.mentionedModelIds ?? []
  if (priority.length === 0) return siblings[0]?.id === current.id

  for (const modelId of priority) {
    const candidate = siblings.find((message) => message.metadata?.modelId === modelId)
    if (candidate) return candidate.id === current.id
  }

  return siblings[0]?.id === current.id
}

export function shouldHideOriginatingUserMessage(
  replies: readonly CherryUIMessage[],
  terminalStatusByMessageId: ReadonlyMap<string, MessageStatus>
): boolean {
  if (replies.length === 0) return false

  const statuses = replies.map(
    (reply) => terminalStatusByMessageId.get(reply.id) ?? reply.metadata?.status ?? 'pending'
  )
  return statuses.every((status) => TERMINAL_STATUSES.has(status)) && statuses.includes('success')
}
