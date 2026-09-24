import { describe, expect, it } from 'vitest'

import type { Model } from '@shared/data/types/model'

import { applyModelGroupRename, applyModelListLayoutDrag, type ModelListLayoutDragPayload } from '../modelLayout'
import type { ModelListGroupSection } from '../useProviderModelList'

function model(id: string, group: string): Model {
  return {
    id: `provider::${id}`,
    providerId: 'provider',
    apiModelId: id,
    name: id,
    group,
    capabilities: [],
    supportsStreaming: true,
    isEnabled: true,
    isHidden: false
  }
}

function sections(): ModelListGroupSection[] {
  return [
    { groupName: 'A', items: [{ model: model('a1', 'A') }, { model: model('a2', 'A') }] },
    { groupName: 'B', items: [{ model: model('b1', 'B') }, { model: model('b2', 'B') }] }
  ]
}

function payload(values: Partial<ModelListLayoutDragPayload>): ModelListLayoutDragPayload {
  return values as ModelListLayoutDragPayload
}

describe('applyModelListLayoutDrag', () => {
  it('moves a group as one stable model block', () => {
    const result = applyModelListLayoutDrag(sections(), payload({ type: 'group', sourceIndex: 1, targetIndex: 0 }))

    expect(result?.models.map(({ id }) => id)).toEqual(['provider::b1', 'provider::b2', 'provider::a1', 'provider::a2'])
    expect(result?.groupChanges).toEqual([])
  })

  it('reorders a model within its group without changing the group', () => {
    const source = sections()
    const result = applyModelListLayoutDrag(
      source,
      payload({
        type: 'item',
        activeId: 'provider::a1',
        sourceGroupId: 'A',
        targetGroupId: 'A',
        overType: 'item',
        overItem: source[0].items[1],
        position: 'after'
      })
    )

    expect(result?.models.map(({ id }) => id)).toEqual(['provider::a2', 'provider::a1', 'provider::b1', 'provider::b2'])
    expect(result?.groupChanges).toEqual([])
  })

  it('moves a model across groups without mutating the source layout', () => {
    const source = sections()
    const result = applyModelListLayoutDrag(
      source,
      payload({
        type: 'item',
        activeId: 'provider::a2',
        sourceGroupId: 'A',
        targetGroupId: 'B',
        overType: 'item',
        overItem: source[1].items[1],
        position: 'before'
      })
    )

    expect(result?.models.map(({ id }) => id)).toEqual(['provider::a1', 'provider::b1', 'provider::a2', 'provider::b2'])
    expect(result?.groupChanges).toEqual([{ id: 'provider::a2', group: 'B' }])
    expect(source[0].items[1].model.group).toBe('A')
  })

  it('removes an emptied source group and appends to a group-header drop target', () => {
    const source = sections()
    source[0].items = [source[0].items[0]]
    const result = applyModelListLayoutDrag(
      source,
      payload({
        type: 'item',
        activeId: 'provider::a1',
        sourceGroupId: 'A',
        targetGroupId: 'B',
        overType: 'group',
        position: 'before'
      })
    )

    expect(result?.models.map(({ id }) => id)).toEqual(['provider::b1', 'provider::b2', 'provider::a1'])
  })
})

describe('applyModelGroupRename', () => {
  it('renames every source-group model without changing model order', () => {
    const source = sections().flatMap(({ items }) => items.map(({ model }) => model))
    const result = applyModelGroupRename(source, 'A', 'Renamed')

    expect(result?.models.map(({ id }) => id)).toEqual(source.map(({ id }) => id))
    expect(result?.groupChanges).toEqual([
      { id: 'provider::a1', group: 'Renamed' },
      { id: 'provider::a2', group: 'Renamed' }
    ])
    expect(result?.models.map(({ group }) => group)).toEqual(['Renamed', 'Renamed', 'B', 'B'])
    expect(source.map(({ group }) => group)).toEqual(['A', 'A', 'B', 'B'])
  })

  it('writes an explicit group when renaming a derived group', () => {
    const source = [model('reasoning-alpha', ''), model('reasoning-beta', '')].map((item) => ({
      ...item,
      group: undefined
    }))
    const result = applyModelGroupRename(source, 'reasoning', 'Custom')

    expect(result?.groupChanges).toEqual([
      { id: 'provider::reasoning-alpha', group: 'Custom' },
      { id: 'provider::reasoning-beta', group: 'Custom' }
    ])
  })

  it('ignores empty, unchanged, and missing source groups', () => {
    const source = sections().flatMap(({ items }) => items.map(({ model }) => model))

    expect(applyModelGroupRename(source, 'A', '   ')).toBeNull()
    expect(applyModelGroupRename(source, 'A', ' A ')).toBeNull()
    expect(applyModelGroupRename(source, 'Missing', 'Renamed')).toBeNull()
  })
})
