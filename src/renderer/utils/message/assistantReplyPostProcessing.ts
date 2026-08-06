import { applyTranslationPostProcessors } from '@renderer/utils/translate'
import type { AssistantSettings } from '@shared/data/types/assistant'
import type { CherryMessagePart } from '@shared/data/types/message'

export type AssistantReplyPostProcessingSettings = Pick<
  AssistantSettings,
  'zhCnMarkdownSmartQuotes' | 'zhMarkdownTextSpacing'
>

export const ASSISTANT_REPLY_BEAUTIFY_SETTINGS: AssistantReplyPostProcessingSettings = {
  zhCnMarkdownSmartQuotes: true,
  zhMarkdownTextSpacing: true
}

export interface AssistantReplyPostProcessingResult {
  changed: boolean
  parts: CherryMessagePart[]
  text: string
}

export function isAssistantReplyPostProcessingEnabled(settings?: AssistantReplyPostProcessingSettings | null): boolean {
  return Boolean(settings?.zhCnMarkdownSmartQuotes || settings?.zhMarkdownTextSpacing)
}

export function postProcessAssistantReplyParts(
  parts: readonly CherryMessagePart[],
  settings?: AssistantReplyPostProcessingSettings | null
): AssistantReplyPostProcessingResult {
  const enabled = isAssistantReplyPostProcessingEnabled(settings)
  let changed = false
  const text: string[] = []

  const nextParts = parts.map((part) => {
    if (part.type !== 'text') return part

    let processed = part.text
    if (enabled) {
      try {
        processed = applyTranslationPostProcessors(part.text, {
          enabled: true,
          markdownEnabled: true,
          targetLanguage: 'zh-cn',
          features: {
            enMarkdownStraightQuotes: false,
            zhCnMarkdownSmartQuotes: Boolean(settings?.zhCnMarkdownSmartQuotes),
            zhMarkdownTextSpacing: Boolean(settings?.zhMarkdownTextSpacing)
          },
          regexReplacementRules: []
        })
      } catch {
        processed = part.text
      }
    }

    text.push(processed)
    if (processed === part.text) return part
    changed = true
    return { ...part, text: processed }
  })

  return {
    changed,
    parts: changed ? nextParts : [...parts],
    text: text.join('\n\n')
  }
}
