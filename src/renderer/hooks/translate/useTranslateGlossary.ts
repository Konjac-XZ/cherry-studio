import { useCallback } from 'react'

import { useMutation, useQuery } from '@data/hooks/useDataApi'
import type {
  CreateTranslateGlossaryEntryDto,
  TranslateGlossaryQuery,
  UpdateTranslateGlossaryEntryDto
} from '@shared/data/api/schemas/translate'

export function useTranslateGlossary(query?: TranslateGlossaryQuery) {
  const { data, error, isLoading, refetch } = useQuery('/translate/glossary', {
    query,
    swrOptions: { keepPreviousData: true }
  })
  const { trigger: createTrigger } = useMutation('POST', '/translate/glossary', { refresh: ['/translate/glossary'] })
  const { trigger: updateTrigger } = useMutation('PATCH', '/translate/glossary/:id', {
    refresh: ['/translate/glossary']
  })
  const { trigger: deleteTrigger } = useMutation('DELETE', '/translate/glossary/:id', {
    refresh: ['/translate/glossary']
  })

  return {
    entries: data ?? [],
    error,
    isLoading,
    refetch,
    create: useCallback((body: CreateTranslateGlossaryEntryDto) => createTrigger({ body }), [createTrigger]),
    update: useCallback(
      (id: string, body: UpdateTranslateGlossaryEntryDto) => updateTrigger({ params: { id }, body }),
      [updateTrigger]
    ),
    remove: useCallback((id: string) => deleteTrigger({ params: { id } }), [deleteTrigger])
  }
}
