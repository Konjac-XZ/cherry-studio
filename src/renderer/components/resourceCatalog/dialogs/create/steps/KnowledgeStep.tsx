import { useCallback } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { KnowledgeBaseField } from '@renderer/components/resourceCatalog/dialogs/components/EditDialogShared'
import { openRoute } from '@renderer/services/mainWindowNavigation'

import type { ResourceCreateWizardFormValues } from '../types'

type KnowledgeStepProps = {
  form: UseFormReturn<ResourceCreateWizardFormValues>
  isSubmitting?: boolean
  portalContainer: HTMLElement | null
}

/**
 * Attach knowledge bases. Mirrors the edit dialog's knowledge sub-form —
 * picker popover + linked list — bound to `knowledgeBaseIds`.
 */
export function KnowledgeStep({ form, isSubmitting = false, portalContainer }: KnowledgeStepProps) {
  const openKnowledgePage = useCallback(() => {
    if (isSubmitting) return
    openRoute('/app/knowledge')
  }, [isSubmitting])

  return (
    <KnowledgeBaseField
      form={form}
      portalContainer={portalContainer}
      formLabel={false}
      labelClassName="font-medium"
      disabled={isSubmitting}
      onOpenKnowledgePage={openKnowledgePage}
    />
  )
}
