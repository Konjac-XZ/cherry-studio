import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { readUIMessageStream, streamText, type UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

const encodeSse = (chunks: unknown[]): string =>
  [...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`), 'data: [DONE]\n\n'].join('')

const createStreamingModel = (chunks: unknown[]) => {
  const provider = createOpenAICompatible({
    name: 'glm-compatible-test',
    baseURL: 'https://example.invalid/v1',
    apiKey: 'test-key',
    fetch: async () =>
      new Response(encodeSse(chunks), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
  })

  return provider.chatModel('glm-5.3')
}

const reasoningChunk = (reasoningContent: string, toolCalls: unknown[] = []) => ({
  id: 'completion-id',
  model: 'glm-5.3',
  choices: [
    {
      index: 0,
      delta: {
        content: null,
        reasoning_content: reasoningContent,
        tool_calls: toolCalls
      },
      finish_reason: null
    }
  ]
})

const textChunk = (content: string) => ({
  id: 'completion-id',
  model: 'glm-5.3',
  choices: [{ index: 0, delta: { content }, finish_reason: null }]
})

const finishChunk = (finishReason: 'stop' | 'tool_calls') => ({
  id: 'completion-id',
  model: 'glm-5.3',
  choices: [{ index: 0, delta: {}, finish_reason: finishReason }]
})

const collectRelevantStreamParts = async (chunks: unknown[]) => {
  const result = streamText({ model: createStreamingModel(chunks), prompt: 'Say hello.' })
  const parts: Array<{ type: string; text?: string }> = []

  for await (const part of result.fullStream) {
    if (part.type === 'reasoning-start' || part.type === 'reasoning-end' || part.type === 'tool-call') {
      parts.push({ type: part.type })
    } else if (part.type === 'reasoning-delta') {
      parts.push({ type: part.type, text: part.text })
    }
  }

  return parts
}

const readFinalMessage = async (chunks: unknown[]): Promise<UIMessage> => {
  const result = streamText({ model: createStreamingModel(chunks), prompt: 'Say hello.' })
  let finalMessage: UIMessage | undefined

  for await (const message of readUIMessageStream({ stream: result.toUIMessageStream() })) finalMessage = message
  if (!finalMessage) throw new Error('Expected the UI message stream to emit a message')
  return finalMessage
}

// Guards patches/@ai-sdk__openai-compatible@2.0.62.patch. GLM-compatible
// streams repeat an empty tool_calls array while reasoning is still active.
describe('patched @ai-sdk/openai-compatible reasoning stream', () => {
  it('keeps repeated empty tool_calls arrays inside one reasoning part', async () => {
    const chunks = [
      reasoningChunk('The'),
      reasoningChunk(' user'),
      reasoningChunk(' understands'),
      textChunk('Hello!'),
      finishChunk('stop')
    ]

    expect(await collectRelevantStreamParts(chunks)).toEqual([
      { type: 'reasoning-start' },
      { type: 'reasoning-delta', text: 'The' },
      { type: 'reasoning-delta', text: ' user' },
      { type: 'reasoning-delta', text: ' understands' },
      { type: 'reasoning-end' }
    ])

    const finalMessage = await readFinalMessage(chunks)
    const reasoningParts = finalMessage.parts.filter((part) => part.type === 'reasoning')
    const textParts = finalMessage.parts.filter((part) => part.type === 'text')

    expect(reasoningParts).toHaveLength(1)
    expect(reasoningParts[0]).toMatchObject({ type: 'reasoning', text: 'The user understands', state: 'done' })
    expect(textParts).toHaveLength(1)
    expect(textParts[0]).toMatchObject({ type: 'text', text: 'Hello!', state: 'done' })
  })

  it('ends reasoning before a non-empty tool_calls array', async () => {
    const parts = await collectRelevantStreamParts([
      reasoningChunk('Need a tool'),
      reasoningChunk('', [
        {
          index: 0,
          id: 'tool-call-id',
          type: 'function',
          function: { name: 'lookup', arguments: '{}' }
        }
      ]),
      finishChunk('tool_calls')
    ])

    expect(parts).toEqual([
      { type: 'reasoning-start' },
      { type: 'reasoning-delta', text: 'Need a tool' },
      { type: 'reasoning-end' },
      { type: 'tool-call' }
    ])
  })
})
