import type { RefObject } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createInputScrollHandler, createOutputScrollHandler } from '@renderer/utils/translate'

type TranslateLayoutOverride = 'auto' | 'horizontal' | 'vertical'

type Params = {
  inputScrollRef: RefObject<HTMLDivElement | null>
  isProgrammaticScroll: RefObject<boolean>
  isScrollSyncEnabled: boolean
  layoutOverride: TranslateLayoutOverride
  onLayoutOverrideChange: (value: TranslateLayoutOverride) => void
  outputScrollRef: RefObject<HTMLDivElement | null>
}

const readInitialPanelSize = () => {
  try {
    const saved = Number.parseFloat(localStorage.getItem('translate-panel-size') ?? '')
    return Number.isFinite(saved) && saved >= 20 && saved <= 80 ? saved : 50
  } catch {
    return 50
  }
}

export const useTranslateLayout = ({
  inputScrollRef,
  isProgrammaticScroll,
  isScrollSyncEnabled,
  layoutOverride,
  onLayoutOverrideChange,
  outputScrollRef
}: Params) => {
  const [panelSize, setPanelSize] = useState(readInitialPanelSize)
  const [viewportSize, setViewportSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))

  const isVerticalLayout =
    layoutOverride === 'vertical' ||
    (layoutOverride === 'auto' &&
      (viewportSize.width < 900 || viewportSize.width / Math.max(1, viewportSize.height) < 1))

  useEffect(() => {
    const handleResize = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('translate-panel-size', String(panelSize))
    } catch {
      // Panel geometry remains usable when storage is unavailable.
    }
  }, [panelSize])

  const cycleLayout = useCallback(() => {
    onLayoutOverrideChange(
      layoutOverride === 'auto' ? 'vertical' : layoutOverride === 'vertical' ? 'horizontal' : 'auto'
    )
  }, [layoutOverride, onLayoutOverrideChange])

  const inputScrollHandler = useMemo(
    () => createInputScrollHandler(inputScrollRef, outputScrollRef, isProgrammaticScroll, isScrollSyncEnabled),
    [inputScrollRef, isProgrammaticScroll, isScrollSyncEnabled, outputScrollRef]
  )
  const outputScrollHandler = useMemo(
    () => createOutputScrollHandler(outputScrollRef, inputScrollRef, isProgrammaticScroll, isScrollSyncEnabled),
    [inputScrollRef, isProgrammaticScroll, isScrollSyncEnabled, outputScrollRef]
  )

  return {
    cycleLayout,
    inputScrollHandler,
    isVerticalLayout,
    outputScrollHandler,
    panelSize,
    setPanelSize
  }
}
