import { ConfirmDialog, EmptyState } from '@cherrystudio/ui'
import { loggerService } from '@logger'
import EditNameDialog from '@renderer/components/EditNameDialog'
import LoadingIcon from '@renderer/components/icons/LoadingIcon'
import {
  GroupedSortableVirtualList,
  type GroupedSortableVirtualListDragPayload
} from '@renderer/components/VirtualList'
import { toast } from '@renderer/services/toast'
import { cn } from '@renderer/utils/style'
import type { Model, UniqueModelId } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'
import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { modelListClasses } from '../primitives/ProviderSettingsPrimitives'
import { getModelOperationErrorMessage } from './errorMessage'
import { useModelHealthStatus } from './modelHealthStatusCache'
import { applyModelListLayoutDrag } from './modelLayout'
import ModelListGroup from './ModelListGroup'
import { useModelListHealthRun } from './modelListHealthContext'
import ModelListItem from './ModelListItem'
import type { ModelListGroupItem, ModelListGroupSection } from './useProviderModelList'

const logger = loggerService.withContext('ModelListSections')
const MODEL_LIST_GROUP_ROW_ESTIMATE = 38
const MODEL_LIST_MODEL_ROW_ESTIMATE = 44
const MODEL_LIST_GROUP_SEPARATOR_HEIGHT = 10

type HealthAwareModelListItemProps = Omit<React.ComponentProps<typeof ModelListItem>, 'modelStatus'>

const HealthAwareModelListItem: React.FC<HealthAwareModelListItemProps> = (props) => {
  const modelStatus = useModelHealthStatus(props.model.id)
  return <ModelListItem {...props} modelStatus={modelStatus} />
}

interface ModelListSectionsProps {
  provider?: Provider
  isLoading: boolean
  hasNoModels: boolean
  hasVisibleModels: boolean
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
  bulkActionDisabled?: boolean
  expansionCommand?: { expanded: boolean; version: number }
  onContinueApiSetup?: () => void
}

const ModelListSections: React.FC<ModelListSectionsProps> = ({
  provider,
  isLoading,
  hasNoModels,
  hasVisibleModels,
  enabledSections,
  disabled,
  reorderDisabled,
  pendingModelIds,
  defaultModelIds,
  onEditModel,
  onDeleteModel,
  onDeleteModels,
  groupNames,
  renameDisabled,
  onRenameGroup,
  onUpdateLayout,
  bulkActionDisabled,
  expansionCommand,
  onContinueApiSetup
}) => {
  const { t } = useTranslation()
  const { apiKeyEntries, savingKeyId, toggleApiKey } = useModelListHealthRun()
  const [groupOpenOverrides, setGroupOpenOverrides] = useState<Record<string, boolean>>({})
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [mergeCandidate, setMergeCandidate] = useState<{ sourceGroup: string; targetGroup: string } | null>(null)
  const [isSubmittingGroupRename, setIsSubmittingGroupRename] = useState(false)

  useEffect(() => {
    if (!expansionCommand) return
    setGroupOpenOverrides(
      Object.fromEntries(enabledSections.map(({ groupName }) => [groupName, expansionCommand.expanded]))
    )
  }, [enabledSections, expansionCommand])

  const toggleGroupOpen = useCallback((groupName: string, defaultOpen: boolean) => {
    setGroupOpenOverrides((current) => ({
      ...current,
      [groupName]: !(current[groupName] ?? defaultOpen)
    }))
  }, [])

  const groups = useMemo(
    () =>
      enabledSections.map((section, index) => {
        const defaultOpen = index <= 5
        const open = groupOpenOverrides[section.groupName] ?? defaultOpen
        return {
          group: section,
          header: { defaultOpen, open, section },
          items: open ? section.items : [],
          footer: section.groupName
        }
      }),
    [enabledSections, groupOpenOverrides]
  )

  const handleDragEnd = useCallback(
    (payload: GroupedSortableVirtualListDragPayload<ModelListGroupSection, ModelListGroupItem>) => {
      const result = applyModelListLayoutDrag(enabledSections, payload)
      if (!result) return

      void onUpdateLayout(result.models, result.groupChanges).catch((error) => {
        logger.error('Failed to update provider model layout', { error })
        toast.error(
          getModelOperationErrorMessage(error, {
            fallback: t('settings.models.manage.layout_save_failed'),
            modelInUseByKnowledgeBase: t('settings.models.manage.model_in_use_by_knowledge_base'),
            modelInUseAsDefault: t('settings.models.manage.sync_apply_default_in_use')
          })
        )
      })
    },
    [enabledSections, onUpdateLayout, t]
  )

  const persistGroupRename = useCallback(
    async (sourceGroup: string, targetGroup: string) => {
      setIsSubmittingGroupRename(true)
      try {
        await onRenameGroup(sourceGroup, targetGroup)
      } catch (error) {
        logger.error('Failed to rename provider model group', { sourceGroup, targetGroup, error })
        toast.error(t('settings.models.manage.group_rename_failed'))
      } finally {
        setIsSubmittingGroupRename(false)
      }
    },
    [onRenameGroup, t]
  )

  const handleRenameSubmit = useCallback(
    async (targetGroup: string) => {
      if (!renameTarget) return

      if (groupNames.has(targetGroup)) {
        setMergeCandidate({ sourceGroup: renameTarget, targetGroup })
        setRenameTarget(null)
        return
      }

      await persistGroupRename(renameTarget, targetGroup)
    },
    [groupNames, persistGroupRename, renameTarget]
  )

  const handleMergeConfirm = useCallback(async () => {
    if (!mergeCandidate) return
    await persistGroupRename(mergeCandidate.sourceGroup, mergeCandidate.targetGroup)
  }, [mergeCandidate, persistGroupRename])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <LoadingIcon color="var(--muted-foreground)" />
      </div>
    )
  }

  if (hasNoModels) {
    return (
      <EmptyState
        compact
        title={t('settings.models.empty')}
        description={t(
          onContinueApiSetup ? 'settings.provider.api_setup.models_empty_hint' : 'settings.models.empty_hint'
        )}
        actionLabel={onContinueApiSetup ? t('settings.provider.api_setup.continue_models') : undefined}
        onAction={onContinueApiSetup}
        className="min-h-40"
      />
    )
  }

  if (!hasVisibleModels) {
    return <div className={modelListClasses.emptyState}>{t('common.no_results')}</div>
  }

  return (
    <>
      <GroupedSortableVirtualList
        groups={groups}
        className={modelListClasses.listScroller}
        role="list"
        disabled={reorderDisabled}
        dragHandle
        dragCapabilities={{ groups: true, items: true, itemSameGroup: true, itemCrossGroup: true }}
        getGroupId={(section) => section.groupName}
        getItemId={({ model }) => model.id}
        estimateGroupHeaderSize={() => MODEL_LIST_GROUP_ROW_ESTIMATE}
        estimateItemSize={() => MODEL_LIST_MODEL_ROW_ESTIMATE}
        estimateGroupFooterSize={() => MODEL_LIST_GROUP_SEPARATOR_HEIGHT}
        overscan={10}
        onDragEnd={handleDragEnd}
        renderGroupHeader={({ defaultOpen, open, section }) => (
          <ModelListGroup
            groupName={section.groupName}
            items={section.items}
            defaultOpen={defaultOpen}
            open={open}
            disabled={disabled}
            reorderDisabled={reorderDisabled}
            renameDisabled={renameDisabled || isSubmittingGroupRename}
            bulkActionDisabled={bulkActionDisabled}
            pendingModelIds={pendingModelIds}
            defaultModelIds={defaultModelIds}
            onDeleteModels={onDeleteModels}
            onRenameGroup={setRenameTarget}
            onToggleOpen={() => toggleGroupOpen(section.groupName, defaultOpen)}
          />
        )}
        renderItem={({ model }, _itemIndex, section, _groupIndex, itemIndexInGroup) => (
          <div
            className={cn(
              modelListClasses.virtualModelRow,
              itemIndexInGroup === section.items.length - 1 && modelListClasses.virtualModelRowLast
            )}>
            <HealthAwareModelListItem
              provider={provider}
              model={model}
              apiKeyEntries={apiKeyEntries}
              savingKeyId={savingKeyId}
              onToggleApiKey={toggleApiKey}
              onEdit={onEditModel}
              onDelete={onDeleteModel}
              disabled={disabled || pendingModelIds.has(model.id)}
              reorderDisabled={reorderDisabled}
              isDefaultModel={defaultModelIds.has(model.id)}
            />
          </div>
        )}
        renderGroupFooter={() => <div aria-hidden style={{ height: MODEL_LIST_GROUP_SEPARATOR_HEIGHT }} />}
      />
      <EditNameDialog
        open={renameTarget !== null}
        title={t('settings.models.manage.rename_group_title')}
        submitLabel={t('settings.models.manage.rename_group')}
        initialName={renameTarget ?? ''}
        selectOnFocus
        onSubmit={handleRenameSubmit}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      />
      <ConfirmDialog
        open={mergeCandidate !== null}
        title={t('settings.models.manage.merge_group_title')}
        description={
          mergeCandidate
            ? t('settings.models.manage.merge_group_description', {
                sourceGroup: mergeCandidate.sourceGroup,
                targetGroup: mergeCandidate.targetGroup
              })
            : undefined
        }
        confirmText={t('settings.models.manage.merge_group_confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={isSubmittingGroupRename}
        onConfirm={handleMergeConfirm}
        onOpenChange={(open) => {
          if (!open) setMergeCandidate(null)
        }}
      />
    </>
  )
}

export default ModelListSections
