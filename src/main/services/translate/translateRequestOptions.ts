import * as z from 'zod'

import { getTemperature, getTopP } from '@main/ai/utils/modelParameters'
import { normalizeRequestedSelection, resolveSelection } from '@main/ai/utils/reasoningSerializers'
import type { TranslateCustomParameters, TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import type { Model } from '@shared/data/types/model'
import type { ReasoningEffortOption } from '@shared/types/aiSdk'

export { hasTranslateReasoningOverride } from '@shared/utils/translateRequestOptions'

export function gateTranslateSamplingParameters(
  parameters: Record<string, unknown>,
  model: Model,
  effort: ReasoningEffortOption
): Record<string, unknown> {
  const { temperature, topP, top_p, ...rest } = parameters
  const settings = {
    temperature: z.number().min(0).max(2).optional().parse(temperature) ?? 1,
    enableTemperature: temperature !== undefined,
    topP:
      z
        .number()
        .min(0)
        .max(1)
        .optional()
        .parse(topP ?? top_p) ?? 1,
    enableTopP: topP !== undefined || top_p !== undefined
  }
  const selection = resolveSelection(normalizeRequestedSelection(effort, model), model)
  const kind = selection === undefined || selection === 'default' ? 'omit' : selection === 'none' ? 'off' : 'effort'
  const gatedTemperature = getTemperature(settings, model, { kind })
  const gatedTopP = getTopP(settings, model, { kind })
  return {
    ...rest,
    ...(gatedTemperature !== undefined && { temperature: gatedTemperature }),
    ...(gatedTopP !== undefined && { topP: gatedTopP })
  }
}

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

/** Chinese script variants are one native-language family for direction-model selection. */
export function isSameTranslateLanguageFamily(
  left: TranslateLangCode | null | undefined,
  right: TranslateLangCode | null | undefined
): boolean {
  if (!left || !right || left === 'unknown' || right === 'unknown') return false
  if (left === right) return true
  return left.startsWith('zh-') && right.startsWith('zh-')
}
