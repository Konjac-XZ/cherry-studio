import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'

export const TRANSLATE_TOOLBAR_COMPACT_WIDTH = 900
export const isTranslateToolbarCompact = (width: number) => width <= TRANSLATE_TOOLBAR_COMPACT_WIDTH

export const useTranslateToolbarVisibility = (): {
  compact: boolean
  toolbarRef: RefObject<HTMLDivElement | null>
} => {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(() => isTranslateToolbarCompact(window.innerWidth))

  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    const update = (width: number) => {
      if (width > 0) setCompact(isTranslateToolbarCompact(width))
    }
    update(toolbar.getBoundingClientRect().width)

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => update(toolbar.getBoundingClientRect().width || window.innerWidth)
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }

    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width))
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [])

  return { compact, toolbarRef }
}
