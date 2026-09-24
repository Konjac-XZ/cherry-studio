import { ChevronRight, GripVertical, Plus, EyeOff, MoreVertical } from 'lucide-react'
import { type ReactNode, useId, type KeyboardEvent, type MouseEvent, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ReorderableList } from '@cherrystudio/ui'
import { CommandContextMenu, type CommandContextMenuExtraItem, CommandPopupMenu } from '@renderer/components/command'
import { getProviderLabelKey } from '@renderer/i18n/label'
import { ProviderAvatar } from '@renderer/pages/settings/ProviderSettings/components/ProviderAvatar'
import { providerListClasses } from '@renderer/pages/settings/ProviderSettings/primitives/ProviderSettingsPrimitives'
import { cn } from '@renderer/utils/style'
import type { Provider } from '@shared/data/types/provider'

import type { ProviderListContentItemState } from './ProviderListContent'

export interface ProviderListGroupProps {
  presetProviderId: string
  members: Provider[]
  /**
   * Full unfiltered provider cache — `<ReorderableList>` needs the complete
   * list as `items` so `computeMinimalMoves` produces a permutation of the
   * cache. Passing the filtered view here breaks reorder under any active
   * filter (the default `enabled` filter included). `members` is the rendered
   * subset.
   */
  items: Provider[]
  expanded: boolean
  containsSelected: boolean
  onToggle: () => void
  onAddAnother?: (template: Provider) => void
  onDragStateChange: (dragging: boolean) => void
  onReorder: (reorderedProviders: Provider[]) => void | Promise<void>
  onReorderError?: (error: unknown) => void
  onHide?: () => void
  renderItem: (provider: Provider, index: number, state: ProviderListContentItemState) => ReactNode
}

/**
 * Collapsible sidebar group for ≥2 providers sharing a `presetProviderId`.
 *
 * The header is the group's outer drag surface and still toggles expansion on
 * click. Children render through the same `<ReorderableList>` the flat list
 * uses, so in-group drag-reorder and the parent's orderKey diffing keep
 * working unchanged.
 */
export default function ProviderListGroup({
  presetProviderId,
  members,
  items,
  expanded,
  containsSelected,
  onToggle,
  onAddAnother,
  onDragStateChange,
  onReorder,
  onReorderError,
  onHide,
  renderItem
}: ProviderListGroupProps) {
  const { t } = useTranslation()
  const bodyId = useId()
  const label = t(getProviderLabelKey(presetProviderId))
  const headerHighlight = !expanded && containsSelected
  const hasEnabledMember = members.some((member) => member.isEnabled)
  const menuItems = useMemo<readonly CommandContextMenuExtraItem[]>(
    () =>
      onHide
        ? [
            {
              type: 'item',
              id: 'hide',
              label: t('settings.provider.hide.action'),
              icon: <EyeOff size={14} />,
              destructive: true,
              onSelect: onHide
            }
          ]
        : [],
    [onHide, t]
  )

  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  const handleMenuClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
  }

  return (
    <div className="w-full">
      <CommandContextMenu location="webcontents.context" extraItems={menuItems} disabled={!onHide}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-controls={bodyId}
          data-testid={`provider-list-group-${presetProviderId}`}
          data-has-selected={containsSelected ? 'true' : 'false'}
          onClick={onToggle}
          onKeyDown={handleHeaderKeyDown}
          className={cn(
            providerListClasses.groupHeader,
            headerHighlight && providerListClasses.groupHeaderHasSelected
          )}>
          <div className={providerListClasses.itemMain}>
            <span
              aria-hidden
              data-testid={`provider-list-group-drag-handle-${presetProviderId}`}
              className={providerListClasses.itemDragHandle}>
              <GripVertical size={16} />
            </span>
            <div className={providerListClasses.itemIdentity}>
              <ProviderAvatar
                provider={{ id: presetProviderId, name: label }}
                size={26}
                className={providerListClasses.itemAvatar}
                displayContext="provider-list"
              />
              <span className={cn(providerListClasses.itemLabel, 'text-foreground')}>{label}</span>
            </div>
          </div>
          <div className={cn(providerListClasses.groupTrailing, onHide && 'size-5')}>
            {hasEnabledMember && (
              <span
                aria-hidden
                data-testid={`provider-list-group-enabled-dot-${presetProviderId}`}
                className={providerListClasses.groupEnabledDot}
              />
            )}
            {onHide ? (
              <CommandPopupMenu
                location="webcontents.context"
                extraItems={menuItems}
                align="end"
                contentClassName={providerListClasses.itemMenuContent}>
                <button
                  type="button"
                  aria-label={t('common.more')}
                  data-testid={`provider-list-group-menu-${presetProviderId}`}
                  onClick={handleMenuClick}
                  className={providerListClasses.itemMoreActions}>
                  <MoreVertical size={14} />
                </button>
              </CommandPopupMenu>
            ) : null}
            <ChevronRight
              size={12}
              data-testid={`provider-list-group-chevron-${presetProviderId}`}
              className={cn(
                providerListClasses.groupChevron,
                expanded && providerListClasses.groupChevronOpen,
                hasEnabledMember && 'absolute opacity-0',
                onHide
                  ? 'group-focus-within/row:opacity-0 group-hover/row:opacity-0'
                  : hasEnabledMember && providerListClasses.groupChevronHiddenUntilHover
              )}
            />
          </div>
        </div>
      </CommandContextMenu>
      {expanded && (
        <div
          id={bodyId}
          className={providerListClasses.groupBody}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}>
          <ReorderableList
            items={items}
            visibleItems={members}
            getId={(provider) => provider.id}
            onDragStateChange={onDragStateChange}
            onReorder={onReorder}
            onReorderError={onReorderError}
            className="w-full"
            gap="0.5rem"
            restrictions={{ scrollableAncestor: true }}
            renderItem={renderItem}
          />
          {onAddAnother && members[0] && (
            <button
              type="button"
              data-testid={`provider-list-group-add-${presetProviderId}`}
              onClick={() => onAddAnother(members[0])}
              className={providerListClasses.groupAddRow}>
              <Plus size={12} />
              <span className="truncate">{t('settings.provider.duplicate.add_another', { name: label })}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
