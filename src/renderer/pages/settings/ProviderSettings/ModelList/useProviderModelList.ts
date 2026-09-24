import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'

import { usePreference } from '@data/hooks/usePreference'
import { computeMinimalMoves } from '@renderer/data/utils/reorder'
import { useModelMutations, useModels } from '@renderer/hooks/useModel'
import { type Model, type UniqueModelId, parseUniqueModelId } from '@shared/data/types/model'
import { groupModelsByLayout } from '@shared/utils/model'

import { PROVIDER_SETTINGS_MODEL_SWR_OPTIONS } from '../hooks/providerSetting/constants'
import { applyModelGroupRename } from './modelLayout'
import {
  calculateModelListDerivedState,
  countModelsInGroups,
  groupModels,
  type ModelGroups,
  type ModelListCapabilityCounts,
  type ModelListCapabilityFilter
} from './modelListDerivedState'

export interface ModelListGroupItem {
  model: Model
}

export interface ModelListGroupSection {
  groupName: string
  items: ModelListGroupItem[]
}

export interface ProviderModelListHeaderSurface {
  modelCount: number
  hasVisibleModels: boolean
  hasNoModels: boolean
  searchText: string
  setSearchText: (text: string) => void
  selectedTypeFilter: ModelListCapabilityFilter
  setSelectedTypeFilter: (filter: ModelListCapabilityFilter) => void
  typeCounts: ModelListCapabilityCounts
}

export interface ProviderModelListSectionsSurface {
  isLoading: boolean
  hasNoModels: boolean
  hasVisibleModels: boolean
  displayEnabledModelCount: number
  enabledSections: ModelListGroupSection[]
  disabled: boolean
  reorderDisabled: boolean
  pendingModelIds: Set<string>
  defaultModelIds: Set<UniqueModelId>
  onEditModel: (model: Model) => void
  onDeleteModel: (model: Model) => Promise<void>
  onDeleteModels: (models: Model[]) => Promise<void>
  groupNames: Set<string>
  renameDisabled: boolean
  onRenameGroup: (sourceGroup: string, targetGroup: string) => Promise<void>
  onUpdateLayout: (models: Model[], groupChanges: Array<{ id: UniqueModelId; group: string }>) => Promise<void>
}

interface UseProviderModelListArgs {
  providerId: string
  /** Parent-owned coordination input for the single effect of disabling list interactions. */
  disabled?: boolean
}

type DisplayedSectionState = {
  groups: ModelGroups
  displayEnabledModelCount: number
}

const toGroupSections = (groups: ModelGroups): ModelListGroupSection[] => {
  return Object.entries(groups).map(([groupName, models]) => ({
    groupName,
    items: models.map((model) => ({ model }))
  }))
}

const withPrunedModelIds = <T>(entries: Record<string, T>, validIds: Set<string>) => {
  let changed = false
  const next: Record<string, T> = {}

  for (const [modelId, value] of Object.entries(entries)) {
    if (!validIds.has(modelId)) {
      changed = true
      continue
    }

    next[modelId] = value
  }

  return changed ? next : entries
}

export function useProviderModelList({ providerId, disabled = false }: UseProviderModelListArgs) {
  const {
    models,
    isLoading: isModelsLoading,
    refetch: refetchModels
  } = useModels({ providerId }, { swrOptions: PROVIDER_SETTINGS_MODEL_SWR_OPTIONS })
  const { deleteModel, deleteModels, isUpdatingLayout, updateProviderModelLayout } = useModelMutations()
  const [defaultModelId] = usePreference('chat.default_model_id')
  const [quickAssistantModelId] = usePreference('feature.quick_assistant.model_id')
  const [translateModelId] = usePreference('feature.translate.model_id')
  const [searchInputText, setSearchInputText] = useState('')
  const searchText = useDeferredValue(searchInputText)
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<ModelListCapabilityFilter>('all')
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [optimisticDeletedByModelId, setOptimisticDeletedByModelId] = useState<Record<string, true>>({})
  const [pendingModelIdMap, setPendingModelIdMap] = useState<Record<string, true>>({})
  const [optimisticLayoutModels, setOptimisticLayoutModels] = useState<Model[] | null>(null)
  const defaultModelIds = useMemo(
    () =>
      new Set(
        [defaultModelId, quickAssistantModelId, translateModelId].filter(
          (modelId): modelId is UniqueModelId => modelId != null
        )
      ),
    [defaultModelId, quickAssistantModelId, translateModelId]
  )

  const layoutModels = useMemo(() => optimisticLayoutModels ?? [...models], [models, optimisticLayoutModels])
  const optimisticModels = useMemo(
    () => layoutModels.filter((model) => !optimisticDeletedByModelId[model.id]),
    [layoutModels, optimisticDeletedByModelId]
  )

  const derivedState = useMemo(
    () =>
      calculateModelListDerivedState({
        models: optimisticModels,
        searchText,
        selectedCapabilityFilter: selectedTypeFilter,
        modelStatuses: []
      }),
    [optimisticModels, searchText, selectedTypeFilter]
  )

  useEffect(() => {
    const validModelIds = new Set(models.map((model) => model.id))

    setPendingModelIdMap((current) => withPrunedModelIds(current, validModelIds))
    setOptimisticDeletedByModelId((current) => withPrunedModelIds(current, validModelIds))
    setOptimisticLayoutModels(null)
  }, [models])

  const displayState = useMemo<DisplayedSectionState>(() => {
    const groups = groupModels(derivedState.filteredModels)

    return {
      groups,
      displayEnabledModelCount: countModelsInGroups(groups)
    }
  }, [derivedState.filteredModels])

  const openEditModelDrawer = useCallback(
    (model: Model) => {
      if (!disabled) setEditingModel(model)
    },
    [disabled]
  )

  const closeEditModelDrawer = useCallback(() => {
    setEditingModel(null)
  }, [])

  const confirmModelsDeleted = useCallback(
    async (modelIds: readonly UniqueModelId[]) => {
      try {
        const refreshedModels = (await refetchModels()) as readonly Model[] | undefined
        if (!refreshedModels) return false

        const refreshedModelIds = new Set(refreshedModels.map((model) => model.id))
        return modelIds.every((modelId) => !refreshedModelIds.has(modelId))
      } catch {
        return false
      }
    },
    [refetchModels]
  )

  const onDeleteModel = useCallback(
    async (model: Model) => {
      if (disabled) return
      if (defaultModelIds.has(model.id)) {
        return
      }

      const { modelId } = parseUniqueModelId(model.id)

      setOptimisticDeletedByModelId((current) => ({ ...current, [model.id]: true }))
      setPendingModelIdMap((current) => ({ ...current, [model.id]: true }))

      try {
        await deleteModel(model.providerId, modelId)
      } catch (error) {
        const deletionConfirmed = await confirmModelsDeleted([model.id])

        setOptimisticDeletedByModelId((current) => {
          const next = { ...current }
          delete next[model.id]
          return next
        })

        if (!deletionConfirmed) throw error
      } finally {
        setPendingModelIdMap((current) => {
          const next = { ...current }
          delete next[model.id]
          return next
        })
      }
    },
    [confirmModelsDeleted, defaultModelIds, deleteModel, disabled]
  )

  const onDeleteModels = useCallback(
    async (modelsToDelete: Model[]) => {
      if (disabled) return
      const deletableModels = modelsToDelete.filter((model) => !defaultModelIds.has(model.id))
      if (deletableModels.length === 0) {
        return
      }
      const deletableModelIds = deletableModels.map((model) => model.id)

      setOptimisticDeletedByModelId((current) => {
        const next = { ...current }

        for (const model of deletableModels) {
          next[model.id] = true
        }

        return next
      })
      setPendingModelIdMap((current) => {
        const next = { ...current }

        for (const model of deletableModels) {
          next[model.id] = true
        }

        return next
      })

      try {
        await deleteModels(deletableModelIds)
      } catch (error) {
        const deletionConfirmed = await confirmModelsDeleted(deletableModelIds)

        setOptimisticDeletedByModelId((current) => {
          const next = { ...current }

          for (const modelId of deletableModelIds) {
            delete next[modelId]
          }

          return next
        })

        if (!deletionConfirmed) throw error
      } finally {
        setPendingModelIdMap((current) => {
          const next = { ...current }

          for (const model of deletableModels) {
            delete next[model.id]
          }

          return next
        })
      }
    },
    [confirmModelsDeleted, defaultModelIds, deleteModels, disabled]
  )

  const onUpdateLayout = useCallback(
    async (nextModels: Model[], groupChanges: Array<{ id: UniqueModelId; group: string }>) => {
      if (disabled || isUpdatingLayout) return
      const moves = computeMinimalMoves(layoutModels, nextModels).map((move) => ({
        ...move,
        id: move.id as UniqueModelId
      }))
      if (moves.length === 0 && groupChanges.length === 0) return

      setOptimisticLayoutModels(nextModels)
      try {
        const updatedModels = await updateProviderModelLayout(providerId, { moves, groupChanges })
        setOptimisticLayoutModels(updatedModels)
      } catch (error) {
        setOptimisticLayoutModels(null)
        throw error
      }
    },
    [disabled, isUpdatingLayout, layoutModels, providerId, updateProviderModelLayout]
  )

  const onRenameGroup = useCallback(
    async (sourceGroup: string, targetGroup: string) => {
      const result = applyModelGroupRename(layoutModels, sourceGroup, targetGroup)
      if (!result) return

      await onUpdateLayout(result.models, result.groupChanges)
    },
    [layoutModels, onUpdateLayout]
  )

  const enabledSections = useMemo(() => toGroupSections(displayState.groups), [displayState.groups])
  const pendingModelIds = useMemo(() => new Set(Object.keys(pendingModelIdMap)), [pendingModelIdMap])
  const groupNames = useMemo(
    () => new Set(groupModelsByLayout(layoutModels).map(({ groupName }) => groupName)),
    [layoutModels]
  )

  const header: ProviderModelListHeaderSurface = {
    modelCount: derivedState.modelCount,
    hasVisibleModels: derivedState.hasVisibleModels,
    hasNoModels: derivedState.hasNoModels,
    searchText: searchInputText,
    setSearchText: setSearchInputText,
    selectedTypeFilter,
    setSelectedTypeFilter,
    typeCounts: derivedState.capabilityModelCounts
  }

  const sections: ProviderModelListSectionsSurface = {
    isLoading: isModelsLoading && models.length === 0,
    hasNoModels: derivedState.hasNoModels,
    hasVisibleModels: derivedState.hasVisibleModels,
    displayEnabledModelCount: displayState.displayEnabledModelCount,
    enabledSections,
    disabled: disabled || isUpdatingLayout,
    reorderDisabled:
      disabled ||
      isUpdatingLayout ||
      pendingModelIds.size > 0 ||
      Boolean(searchText.trim()) ||
      selectedTypeFilter !== 'all',
    pendingModelIds,
    defaultModelIds,
    onEditModel: openEditModelDrawer,
    onDeleteModel,
    onDeleteModels,
    groupNames,
    renameDisabled: disabled || isUpdatingLayout || pendingModelIds.size > 0,
    onRenameGroup,
    onUpdateLayout
  }

  return {
    header,
    sections,
    editDrawer: {
      open: editingModel !== null,
      model: editingModel,
      onClose: closeEditModelDrawer
    }
  }
}

export type ProviderModelListSurface = ReturnType<typeof useProviderModelList>
