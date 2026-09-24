import { sortBy, toPairs } from 'es-toolkit/compat'

import type { ModelWithStatus } from '@renderer/pages/settings/ProviderSettings/types/healthCheck'
import type { Model } from '@shared/data/types/model'
import { ENDPOINT_TYPE, parseUniqueModelId } from '@shared/data/types/model'
import {
  deriveModelGroupName,
  groupModelsByLayout,
  isEmbeddingModel,
  isGenerateAudioModel,
  isGenerateImageModel,
  isGenerateVideoModel,
  isNonChatModel,
  isRerankModel,
  isSpeechToTextModel
} from '@shared/utils/model'

import { normalizeModelGroupName } from './grouping'
import { filterProviderSettingModelsByKeywords, getDuplicateProviderSettingModelNames } from './utils'

export type ModelGroups = Record<string, Model[]>

// The manage/pull drawer filters by model TYPE (primary purpose), not by the
// overlapping capability flags. Order mirrors the drawer's tab row.
export const MODEL_LIST_CAPABILITY_FILTERS = [
  'all',
  'text',
  'image',
  'embedding',
  'audio',
  'video',
  'rerank',
  'speech',
  'transcription'
] as const

export type ModelListCapabilityFilter = (typeof MODEL_LIST_CAPABILITY_FILTERS)[number]
export type ModelListCapabilityCounts = Record<ModelListCapabilityFilter, number>

export type ModelListDerivedState = {
  filteredModels: Model[]
  capabilityOptions: readonly ModelListCapabilityFilter[]
  capabilityModelCounts: ModelListCapabilityCounts
  duplicateModelNames: Set<string>
  modelCount: number
  hasVisibleModels: boolean
  hasNoModels: boolean
  modelStatusMap: Map<string, ModelWithStatus>
}

export const MODEL_COUNT_THRESHOLD = 10

interface GroupModelsOptions {
  preferModelGroup?: boolean
}

type CalculateModelListDerivedStateInput = {
  models: Model[]
  searchText: string
  selectedCapabilityFilter: ModelListCapabilityFilter
  modelStatuses: ModelWithStatus[]
}

export const groupModels = (
  models: Model[],
  preserveGroupOrder = false,
  options: GroupModelsOptions = {}
): ModelGroups => {
  if (!options.preferModelGroup) {
    return Object.fromEntries(
      groupModelsByLayout(models).map(({ groupName, models: groupModels }) => [groupName, groupModels])
    )
  }

  const grouped = models.reduce<ModelGroups>((acc, model) => {
    const modelId = model.apiModelId ?? parseUniqueModelId(model.id).modelId
    const inferredGroup = deriveModelGroupName(modelId)
    const storedGroup = model.group?.trim()
    const hasLegacyProviderGroup =
      inferredGroup !== undefined &&
      storedGroup !== model.providerId &&
      storedGroup?.toLowerCase() === model.providerId.toLowerCase()
    const preferredGroup = hasLegacyProviderGroup ? inferredGroup : model.group
    const groupName = normalizeModelGroupName(preferredGroup, inferredGroup ?? model.providerId)
    ;(acc[groupName] ??= []).push(model)
    return acc
  }, {})

  if (preserveGroupOrder) return grouped
  return sortBy(toPairs(grouped), [0]).reduce((acc, [key, value]) => {
    acc[key] = value
    return acc
  }, {} as ModelGroups)
}

// Text-to-speech is the only audio-output sub-kind we can single out from
// generic audio generation today (the `AUDIO_GENERATION` capability backs
// both); the dedicated endpoint is the distinguishing signal.
const isTextToSpeechModel = (model: Model): boolean =>
  model.endpointTypes?.includes(ENDPOINT_TYPE.OPENAI_TEXT_TO_SPEECH) ?? false

export const matchesCapabilityFilter = (model: Model, selectedCapabilityFilter: ModelListCapabilityFilter): boolean => {
  switch (selectedCapabilityFilter) {
    case 'text':
      return !isNonChatModel(model)
    case 'image':
      return isGenerateImageModel(model)
    case 'embedding':
      return isEmbeddingModel(model)
    case 'audio':
      // "Generate audio", excluding text-to-speech (which has its own tab).
      return isGenerateAudioModel(model) && !isTextToSpeechModel(model)
    case 'video':
      return isGenerateVideoModel(model)
    case 'rerank':
      return isRerankModel(model)
    case 'speech':
      return isTextToSpeechModel(model)
    case 'transcription':
      return isSpeechToTextModel(model)
    default:
      return true
  }
}

export const applyModelFilters = (
  models: Model[],
  searchText: string,
  selectedCapabilityFilter: ModelListCapabilityFilter
): Model[] => {
  const searchedModels = searchText ? filterProviderSettingModelsByKeywords(searchText, models) : models
  if (selectedCapabilityFilter === 'all') {
    return searchedModels
  }

  return searchedModels.filter((model) => matchesCapabilityFilter(model, selectedCapabilityFilter))
}

export const countModelsInGroups = (groups: ModelGroups): number => {
  return Object.values(groups).reduce((acc, group) => acc + group.length, 0)
}

export const getCapabilityModelCounts = (models: Model[]): ModelListCapabilityCounts => {
  const counts = Object.fromEntries(
    MODEL_LIST_CAPABILITY_FILTERS.map((filter) => [filter, 0])
  ) as ModelListCapabilityCounts
  counts.all = models.length

  for (const model of models) {
    for (const filter of MODEL_LIST_CAPABILITY_FILTERS) {
      if (filter !== 'all' && matchesCapabilityFilter(model, filter)) {
        counts[filter] += 1
      }
    }
  }

  return counts
}

export const calculateModelListDerivedState = ({
  models,
  searchText,
  selectedCapabilityFilter,
  modelStatuses
}: CalculateModelListDerivedStateInput): ModelListDerivedState => {
  const filteredModels = applyModelFilters(models, searchText, selectedCapabilityFilter)

  return {
    filteredModels,
    capabilityOptions: MODEL_LIST_CAPABILITY_FILTERS,
    capabilityModelCounts: getCapabilityModelCounts(applyModelFilters(models, searchText, 'all')),
    duplicateModelNames: getDuplicateProviderSettingModelNames(models),
    modelCount: filteredModels.length,
    hasVisibleModels: filteredModels.length > 0,
    hasNoModels: models.length === 0,
    modelStatusMap: new Map(modelStatuses.map((status) => [status.model.id, status]))
  }
}
