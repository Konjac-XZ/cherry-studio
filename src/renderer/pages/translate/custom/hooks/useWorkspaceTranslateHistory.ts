import { useCallback } from 'react'

import { dataApiService } from '@data/DataApiService'
import { useMutation } from '@data/hooks/useDataApi'
import { loggerService } from '@logger'
import type { CreateTranslateHistoryDto, UpdateTranslateHistoryDto } from '@shared/data/api/schemas/translate'
import { toPersistedLangCodeOrNull, type TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import type { UniqueModelId } from '@shared/data/types/model'

import { useWorkspaceMutationFeedback, type WorkspaceMutationFeedbackOptions } from './useWorkspaceMutationFeedback'

const logger = loggerService.withContext('translate/useWorkspaceTranslateHistory')

export type AddWorkspaceTranslateHistoryInput = {
  sourceText: string
  targetText: string
  sourceLanguage: TranslateLangCode | null
  targetLanguage: TranslateLangCode | null
  modelId?: UniqueModelId | null
  cacheKey?: string
}

export type UpdateWorkspaceTranslateHistoryInput = {
  sourceText?: string
  targetText?: string
  sourceLanguage?: TranslateLangCode | null
  targetLanguage?: TranslateLangCode | null
  modelId?: UniqueModelId | null
  star?: boolean
}

export const useWorkspaceTranslateHistory = (options?: {
  add?: WorkspaceMutationFeedbackOptions
  update?: WorkspaceMutationFeedbackOptions
  remove?: WorkspaceMutationFeedbackOptions
  clear?: WorkspaceMutationFeedbackOptions
}) => {
  const { trigger: addTrigger } = useMutation('POST', '/translate/histories', {
    refresh: ['/translate/histories']
  })
  const { trigger: updateTrigger } = useMutation('PATCH', '/translate/histories/:id', {
    refresh: ['/translate/histories']
  })
  const { trigger: removeTrigger } = useMutation('DELETE', '/translate/histories/:id', {
    refresh: ['/translate/histories']
  })
  const { trigger: clearTrigger } = useMutation('DELETE', '/translate/histories', {
    refresh: ['/translate/histories']
  })

  const addMutation = useWorkspaceMutationFeedback(
    useCallback(
      (data: AddWorkspaceTranslateHistoryInput) => {
        const body: CreateTranslateHistoryDto = {
          sourceText: data.sourceText,
          targetText: data.targetText,
          sourceLanguage: toPersistedLangCodeOrNull(data.sourceLanguage),
          targetLanguage: toPersistedLangCodeOrNull(data.targetLanguage),
          modelId: data.modelId,
          cacheKey: data.cacheKey
        }
        return addTrigger({ body })
      },
      [addTrigger]
    ),
    options?.add,
    {
      logger,
      errorLogMessage: 'Failed to add translate history',
      successToastKey: 'translate.history.success.add',
      errorToastKey: 'translate.history.error.add',
      defaults: { showSuccessToast: false, showErrorToast: true, rethrowError: true }
    }
  )

  const updateMutation = useWorkspaceMutationFeedback(
    useCallback(
      (id: string, data: UpdateWorkspaceTranslateHistoryInput) => {
        const body: UpdateTranslateHistoryDto = {}
        if (data.sourceText !== undefined) body.sourceText = data.sourceText
        if (data.targetText !== undefined) body.targetText = data.targetText
        if ('sourceLanguage' in data) {
          body.sourceLanguage = toPersistedLangCodeOrNull(data.sourceLanguage)
        }
        if ('targetLanguage' in data) {
          body.targetLanguage = toPersistedLangCodeOrNull(data.targetLanguage)
        }
        if ('modelId' in data) body.modelId = data.modelId
        if (data.star !== undefined) body.star = data.star
        return updateTrigger({ params: { id }, body })
      },
      [updateTrigger]
    ),
    options?.update,
    {
      logger,
      errorLogMessage: 'Failed to update translate history',
      successToastKey: 'translate.history.success.update',
      errorToastKey: 'translate.history.error.save',
      defaults: { showSuccessToast: false, showErrorToast: true, rethrowError: true }
    }
  )

  const removeMutation = useWorkspaceMutationFeedback(
    useCallback((id: string) => removeTrigger({ params: { id } }), [removeTrigger]),
    options?.remove,
    {
      logger,
      errorLogMessage: 'Failed to delete translate history',
      successToastKey: 'translate.history.success.delete',
      errorToastKey: 'translate.history.error.delete',
      defaults: { showSuccessToast: false, showErrorToast: true, rethrowError: true }
    }
  )

  const clearMutation = useWorkspaceMutationFeedback(
    useCallback(() => clearTrigger(), [clearTrigger]),
    options?.clear,
    {
      logger,
      errorLogMessage: 'Failed to clear translate history',
      successToastKey: 'translate.history.success.clear',
      errorToastKey: 'translate.history.error.clear',
      defaults: { showSuccessToast: false, showErrorToast: true, rethrowError: true }
    }
  )

  return {
    add: addMutation,
    update: updateMutation,
    remove: removeMutation,
    clear: clearMutation,
    findCached: useCallback(async (cacheKey: string) => {
      const response = await dataApiService.get('/translate/histories', { query: { cacheKey, limit: 1 } })
      return response.items[0]
    }, []),
    findBySourceText: useCallback(async (sourceText: string) => {
      const response = await dataApiService.get('/translate/histories', { query: { sourceText, limit: 100 } })
      return response.items
    }, [])
  }
}
