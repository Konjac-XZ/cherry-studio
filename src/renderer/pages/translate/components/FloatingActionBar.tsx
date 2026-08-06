import type { ReactNode } from 'react'

import IconButton from './IconButton'

export type FloatingAction = {
  disabled?: boolean
  icon: ReactNode
  key: string
  label: string
  onClick: () => void
}

type Props = {
  actions: FloatingAction[]
  className?: string
}

/**
 * Compact pane-local actions with an intentionally oversized hover target.
 * Opacity alone keeps the hotspot interactive; keyboard focus does not pin
 * the surface visible, matching the prepared V1 interaction contract.
 */
const FloatingActionBar = ({ actions, className }: Props) => (
  <div
    data-testid="floating-actions"
    data-ui="translate.floating-actions"
    className={`before:-top-2 before:-right-2 absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-lg border border-border-subtle bg-background p-0.5 opacity-0 shadow-sm transition-opacity delay-300 duration-200 before:absolute before:h-[calc(200%+32px)] before:w-[calc(200%+32px)] before:content-[''] hover:opacity-100 hover:delay-0 ${className ?? ''}`}>
    {actions.map((action) => (
      <IconButton
        key={action.key}
        size="sm"
        className="relative z-10"
        onClick={action.onClick}
        disabled={action.disabled}
        aria-label={action.label}>
        {action.icon}
      </IconButton>
    ))}
  </div>
)

export default FloatingActionBar
