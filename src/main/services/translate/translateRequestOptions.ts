import type { TranslateCustomParameters, TranslateLangCode } from '@shared/data/preference/preferenceTypes'
export { hasTranslateReasoningOverride } from '@shared/utils/translateRequestOptions'

/**
 * Convert the persisted parameter editor shape into the request dictionary
 * consumed by the AI runtime. Mirrors assistant custom-parameter semantics,
 * while also accepting already-decoded JSON values from migrated state.
 */
export function translateCustomParametersToRecord(parameters: TranslateCustomParameters): Record<string, unknown> {
  return parameters.reduce<Record<string, unknown>>((result, parameter) => {
    const name = parameter.name.trim()
    if (!name) return result

    if (parameter.type !== 'json') {
      result[name] = parameter.value
      return result
    }

    const value = parameter.value
    if (value === 'undefined') {
      result[name] = undefined
      return result
    }
    if (typeof value !== 'string') {
      result[name] = value
      return result
    }

    try {
      result[name] = JSON.parse(value)
    } catch {
      result[name] = value
    }
    return result
  }, {})
}

/**
 * A persisted model-specific reasoning parameter must win over the generic
 * auto-disable switch. The broad body/container names are intentional: their
 * nested contents may carry a provider's reasoning dialect.
 */
/** Chinese script variants are one native-language family for direction-model selection. */
export function isSameTranslateLanguageFamily(
  left: TranslateLangCode | null | undefined,
  right: TranslateLangCode | null | undefined
): boolean {
  if (!left || !right || left === 'unknown' || right === 'unknown') return false
  if (left === right) return true
  return left.startsWith('zh-') && right.startsWith('zh-')
}
