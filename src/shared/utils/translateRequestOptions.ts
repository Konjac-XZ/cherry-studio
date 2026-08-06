import type { TranslateCustomParameters } from '@shared/data/preference/preferenceTypes'

const REASONING_PARAMETER_NAMES = new Set([
  'reasoningeffort',
  'reasoning_effort',
  'reasoning',
  'thinking',
  'enable_thinking',
  'thinking_budget',
  'disable_reasoning',
  'extra_body',
  'chat_template_kwargs'
])

const REASONING_PARAMETER_PREFIXES = ['reasoning.', 'thinking.', 'extra_body.', 'chat_template_kwargs.']

/** True when a provider-specific request parameter must take precedence over generic reasoning policy. */
export function hasTranslateReasoningOverride(parameters: TranslateCustomParameters): boolean {
  return parameters.some((parameter) => {
    const name = parameter.name.trim().toLowerCase()
    return REASONING_PARAMETER_NAMES.has(name) || REASONING_PARAMETER_PREFIXES.some((prefix) => name.startsWith(prefix))
  })
}
