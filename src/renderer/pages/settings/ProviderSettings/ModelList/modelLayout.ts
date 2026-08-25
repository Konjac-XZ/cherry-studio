import type { GroupedSortableVirtualListDragPayload } from '@renderer/components/VirtualList'
import type { Model } from '@shared/data/types/model'
import { getEffectiveModelGroup } from '@shared/utils/model'

import type { ModelListGroupItem, ModelListGroupSection } from './useProviderModelList'

export type ModelListLayoutDragPayload = GroupedSortableVirtualListDragPayload<
  ModelListGroupSection,
  ModelListGroupItem
>

export type ModelListLayoutResult = {
  groupChanges: Array<{ id: Model['id']; group: string }>
  models: Model[]
}

export function applyModelGroupRename(
  models: readonly Model[],
  sourceGroup: string,
  targetGroup: string
): ModelListLayoutResult | null {
  const normalizedTargetGroup = targetGroup.trim()
  if (!normalizedTargetGroup || normalizedTargetGroup === sourceGroup) return null

  const groupChanges: ModelListLayoutResult['groupChanges'] = []
  const nextModels = models.map((model) => {
    if (getEffectiveModelGroup(model) !== sourceGroup) return model

    groupChanges.push({ id: model.id, group: normalizedTargetGroup })
    return { ...model, group: normalizedTargetGroup }
  })

  return groupChanges.length > 0 ? { groupChanges, models: nextModels } : null
}

function cloneSections(sections: ModelListGroupSection[]): ModelListGroupSection[] {
  return sections.map((section) => ({ ...section, items: [...section.items] }))
}

function flattenSections(sections: ModelListGroupSection[]): Model[] {
  return sections.flatMap(({ items }) => items.map(({ model }) => model))
}

export function applyModelListLayoutDrag(
  sections: ModelListGroupSection[],
  payload: ModelListLayoutDragPayload
): ModelListLayoutResult | null {
  const nextSections = cloneSections(sections)

  if (payload.type === 'group') {
    if (payload.sourceIndex === payload.targetIndex) return null
    const [moving] = nextSections.splice(payload.sourceIndex, 1)
    if (!moving) return null
    nextSections.splice(payload.targetIndex, 0, moving)
    return { groupChanges: [], models: flattenSections(nextSections) }
  }

  if (payload.activeId === payload.overId) return null

  const sourceSection = nextSections.find((section) => section.groupName === String(payload.sourceGroupId))
  const targetSection = nextSections.find((section) => section.groupName === String(payload.targetGroupId))
  if (!sourceSection || !targetSection) return null

  const sourceItemIndex = sourceSection.items.findIndex(({ model }) => model.id === payload.activeId)
  if (sourceItemIndex < 0) return null
  const [moving] = sourceSection.items.splice(sourceItemIndex, 1)
  if (!moving) return null

  let insertIndex = targetSection.items.length
  if (payload.overType === 'item' && payload.overItem) {
    const targetItemIndex = targetSection.items.findIndex(({ model }) => model.id === payload.overItem?.model.id)
    if (targetItemIndex >= 0) {
      insertIndex = targetItemIndex + (payload.position === 'after' ? 1 : 0)
    }
  }
  const changedGroup = sourceSection.groupName !== targetSection.groupName
  const movedItem = changedGroup ? { ...moving, model: { ...moving.model, group: targetSection.groupName } } : moving
  targetSection.items.splice(insertIndex, 0, movedItem)

  const nonEmptySections = nextSections.filter(({ items }) => items.length > 0)
  return {
    groupChanges: changedGroup ? [{ id: movedItem.model.id, group: targetSection.groupName }] : [],
    models: flattenSections(nonEmptySections)
  }
}
