import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'

import type { Model, UniqueModelId } from '@shared/data/types/model'

interface UseMentionedModelSelectorParams {
  /** Whether the mentioned-model selector UI is in use (chat home / placement). */
  enabled: boolean | undefined
  runtimeModel: Model | undefined
  runtimeModelPending: boolean
  selectedAssistantId: string | null
  topicId: string
  mentionedModels: Model[]
  setMentionedModels: (models: Model[]) => void
  persistedModelIds?: UniqueModelId[]
  availableModels?: readonly Model[]
  availableModelsPending?: boolean
  onPersistModelIds?: (modelIds: UniqueModelId[]) => void | Promise<unknown>
  preserveExplicitSelectionOnRuntimeChange?: boolean
  /** Applies a single model to the assistant (the composer's `handleModelSelect`). */
  onModelSelect: (model: Model | undefined) => void | Promise<unknown>
}

interface UseMentionedModelSelectorResult {
  mentionedModelSelectorValue: Model[]
  mentionedModelMultiSelectMode: boolean
  handleMentionedModelsSelect: (models: Model[]) => void
  handleMentionedModelMultiSelectModeChange: (enabled: boolean) => void
  handleMentionedModelSelectorRestore: () => void
  restoreMentionedModelDraft: (models: Model[], multiSelectMode: boolean) => void
  restoreMentionedModelSelection: (selectorModels: Model[], mentionedModels: Model[], multiSelectMode: boolean) => void
}

const haveSameModelIds = (left: readonly Model[], right: readonly Model[]): boolean =>
  left.length === right.length && left.every((model, index) => model.id === right[index]?.id)

/**
 * Owns the chat composer's mentioned-model multi-select machinery: the selector value,
 * the multi-select toggle, and the (re)initialization that syncs it to the active
 * topic/assistant/model. Extracted verbatim from ChatComposer — chat-only.
 */
export function useChatMentionedModels({
  enabled,
  runtimeModel,
  runtimeModelPending,
  selectedAssistantId,
  topicId,
  mentionedModels,
  setMentionedModels,
  persistedModelIds = [],
  availableModels = [],
  availableModelsPending = false,
  onPersistModelIds,
  preserveExplicitSelectionOnRuntimeChange,
  onModelSelect
}: UseMentionedModelSelectorParams): UseMentionedModelSelectorResult {
  const [mentionedModelMultiSelectMode, setMentionedModelMultiSelectMode] = useState(false)
  const [mentionedModelSelectorValue, setMentionedModelSelectorValue] = useState<Model[]>([])
  const mentionedModelSelectorInitKeyRef = useRef<string | null>(null)
  const mentionedModelMultiSelectModeRef = useRef(mentionedModelMultiSelectMode)
  const mentionedModelSelectorValueRef = useRef(mentionedModelSelectorValue)
  const mentionedModelsRef = useRef(mentionedModels)
  const selectorScopeKeyRef = useRef<string | null>(null)
  const persistedResolutionKeyRef = useRef<string | null>(null)
  mentionedModelMultiSelectModeRef.current = mentionedModelMultiSelectMode
  mentionedModelSelectorValueRef.current = mentionedModelSelectorValue
  mentionedModelsRef.current = mentionedModels

  const persistModels = useCallback(
    (models: readonly Model[]) => {
      if (!onPersistModelIds || !selectedAssistantId) return
      void onPersistModelIds(Array.from(new Set(models.map((model) => model.id))))
    },
    [onPersistModelIds, selectedAssistantId]
  )

  const initializeMentionedModelSelector = useEffectEvent(
    (isInitialSelection: boolean, preserveExplicitSelection: boolean, selectedModel?: Model) => {
      const currentMentionedModels = mentionedModelsRef.current
      const keepCurrentSelection = preserveExplicitSelection && currentMentionedModels.length > 0
      setMentionedModelSelectorValue(
        keepCurrentSelection || (isInitialSelection && currentMentionedModels.length > 1)
          ? currentMentionedModels
          : selectedModel
            ? [selectedModel]
            : []
      )
      setMentionedModelMultiSelectMode(false)

      if (!isInitialSelection && currentMentionedModels.length > 0 && !keepCurrentSelection) {
        setMentionedModels([])
      }
    }
  )

  useEffect(() => {
    if (!enabled) {
      mentionedModelSelectorInitKeyRef.current = null
      selectorScopeKeyRef.current = null
      persistedResolutionKeyRef.current = null
      setMentionedModelSelectorValue((currentModels) => (currentModels.length === 0 ? currentModels : []))
      setMentionedModelMultiSelectMode((currentEnabled) => (currentEnabled ? false : currentEnabled))
      return
    }

    if (!runtimeModel && runtimeModelPending) {
      return
    }

    if (selectedAssistantId && persistedModelIds.length > 0 && availableModelsPending) {
      return
    }

    const selectorScopeKey = `${topicId}:${selectedAssistantId ?? 'no-assistant'}`
    const persistedIdSet = new Set(persistedModelIds)
    const resolvedPersistedModels = availableModels.filter((model) => persistedIdSet.has(model.id))
    const resolvedPersistedIds = resolvedPersistedModels.map((model) => model.id)
    const persistedResolutionKey = `${selectorScopeKey}:${persistedModelIds.join(',')}=>${resolvedPersistedIds.join(',')}`
    const isSameSelectorScope = selectorScopeKeyRef.current === selectorScopeKey

    if (selectedAssistantId && persistedResolutionKeyRef.current !== persistedResolutionKey) {
      const isFirstSelectorScope = selectorScopeKeyRef.current === null
      const currentMentionedModels = mentionedModelsRef.current
      const restoredModels =
        resolvedPersistedModels.length > 0 || !isFirstSelectorScope ? resolvedPersistedModels : currentMentionedModels
      persistedResolutionKeyRef.current = persistedResolutionKey
      selectorScopeKeyRef.current = selectorScopeKey
      mentionedModelSelectorInitKeyRef.current = `${selectorScopeKey}:${runtimeModel?.id ?? 'no-model'}`
      if (!haveSameModelIds(currentMentionedModels, restoredModels)) setMentionedModels(restoredModels)
      setMentionedModelSelectorValue(restoredModels.length > 0 ? restoredModels : runtimeModel ? [runtimeModel] : [])
      if (!isSameSelectorScope) setMentionedModelMultiSelectMode(false)
      if (resolvedPersistedIds.length !== persistedModelIds.length) {
        void onPersistModelIds?.(resolvedPersistedIds)
      }
      return
    }

    const initializationKey = `${selectorScopeKey}:${runtimeModel?.id ?? 'no-model'}`
    if (mentionedModelSelectorInitKeyRef.current === initializationKey) return

    const isInitialSelection = mentionedModelSelectorInitKeyRef.current === null
    mentionedModelSelectorInitKeyRef.current = initializationKey
    selectorScopeKeyRef.current = selectorScopeKey
    initializeMentionedModelSelector(
      isInitialSelection,
      Boolean(preserveExplicitSelectionOnRuntimeChange && isSameSelectorScope),
      runtimeModel
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `useEffectEvent` reads latest mentioned models; this effect is keyed by topic/assistant/model.
  }, [
    runtimeModel,
    runtimeModelPending,
    selectedAssistantId,
    topicId,
    enabled,
    preserveExplicitSelectionOnRuntimeChange,
    persistedModelIds,
    availableModels,
    availableModelsPending,
    onPersistModelIds,
    setMentionedModels
  ])

  const handleMentionedModelsSelect = useCallback(
    (nextModels: Model[]) => {
      setMentionedModelSelectorValue(nextModels)
      if (mentionedModelMultiSelectModeRef.current) {
        setMentionedModels(nextModels)
        persistModels(nextModels)
        return
      }

      setMentionedModels(nextModels)
      const [nextModel] = nextModels
      if (nextModel) {
        void Promise.resolve(onModelSelect(nextModel)).then(() => persistModels([]))
      } else {
        persistModels([])
      }
    },
    [onModelSelect, persistModels, setMentionedModels]
  )

  const handleMentionedModelMultiSelectModeChange = useCallback(
    (nextEnabled: boolean) => {
      mentionedModelMultiSelectModeRef.current = nextEnabled
      setMentionedModelMultiSelectMode(nextEnabled)

      if (nextEnabled) {
        return
      }

      const collapsedModels = mentionedModelSelectorValueRef.current.slice(0, 1)
      setMentionedModelSelectorValue(collapsedModels)
      setMentionedModels(collapsedModels)
      persistModels(collapsedModels)
    },
    [persistModels, setMentionedModels]
  )

  const handleMentionedModelSelectorRestore = useCallback(() => {
    mentionedModelMultiSelectModeRef.current = false
    setMentionedModelMultiSelectMode(false)
    setMentionedModelSelectorValue(runtimeModel ? [runtimeModel] : [])
    setMentionedModels([])
    persistModels([])
  }, [persistModels, runtimeModel, setMentionedModels])

  const restoreMentionedModelSelection = useCallback(
    (selectorModels: Model[], restoredMentionedModels: Model[], multiSelectMode: boolean) => {
      mentionedModelsRef.current = restoredMentionedModels
      mentionedModelSelectorValueRef.current = selectorModels
      mentionedModelMultiSelectModeRef.current = multiSelectMode
      setMentionedModels(restoredMentionedModels)
      setMentionedModelSelectorValue(selectorModels)
      setMentionedModelMultiSelectMode(multiSelectMode)
    },
    [setMentionedModels]
  )

  const restoreMentionedModelDraft = useCallback(
    (models: Model[], multiSelectMode: boolean) => {
      restoreMentionedModelSelection(models, models, multiSelectMode)
    },
    [restoreMentionedModelSelection]
  )

  return {
    mentionedModelSelectorValue,
    mentionedModelMultiSelectMode,
    handleMentionedModelsSelect,
    handleMentionedModelMultiSelectModeChange,
    handleMentionedModelSelectorRestore,
    restoreMentionedModelDraft,
    restoreMentionedModelSelection
  }
}
