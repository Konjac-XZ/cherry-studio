import { cn } from '@renderer/utils/style'
import { clampTranslatePanelSize } from '@renderer/utils/translate'
import type { PointerEvent, RefObject } from 'react'
import { useCallback } from 'react'

type Props = {
  containerRef: RefObject<HTMLDivElement | null>
  vertical: boolean
  value: number
  onChange: (percent: number) => void
  onEqualizeScroll?: () => void
}

const DraggableDivider = ({ containerRef, vertical, value, onChange, onEqualizeScroll }: Props) => {
  const updateFromPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const bounds = containerRef.current?.getBoundingClientRect()
      if (!bounds) return
      const axisSize = vertical ? bounds.height : bounds.width
      if (axisSize <= 0) return
      const offset = vertical ? event.clientY - bounds.top : event.clientX - bounds.left
      onChange(clampTranslatePanelSize((offset / axisSize) * 100, vertical, axisSize, window.innerWidth))
    },
    [containerRef, onChange, vertical]
  )

  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      tabIndex={0}
      className={cn(
        'group relative z-10 shrink-0 touch-none bg-border-subtle outline-none transition-colors hover:bg-primary/50 focus-visible:bg-primary/50',
        vertical ? 'h-1 cursor-row-resize' : 'w-1 cursor-col-resize'
      )}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        updateFromPointer(event)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event)
      }}
      onDoubleClick={(event) => {
        event.preventDefault()
        if (!vertical) onEqualizeScroll?.()
      }}
      onKeyDown={(event) => {
        const delta =
          event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : event.key === 'ArrowRight' || event.key === 'ArrowDown'
              ? 1
              : 0
        if (!delta) return
        event.preventDefault()
        const bounds = containerRef.current?.getBoundingClientRect()
        if (!bounds) return
        onChange(
          clampTranslatePanelSize(value + delta, vertical, vertical ? bounds.height : bounds.width, window.innerWidth)
        )
      }}
    />
  )
}

export default DraggableDivider
