import type { MouseEvent } from 'react'
import { useCallback, useEffect, useRef } from 'react'

import type { TranslationMode } from '@renderer/services/translation'

import type { TranslationRunOverride } from './useTranslationFlowRunner'

type TranslateTriggerOptions = {
  forceRefresh?: boolean
  polish?: boolean
}

type Params = {
  persistentPolishEnabled: boolean
  run: (
    forceRefresh?: boolean,
    sourceTextOverride?: string,
    modeOverride?: TranslationMode,
    runOverride?: TranslationRunOverride
  ) => Promise<void>
}

/** Restores the prepared V1 invocation precedence without coupling it to the page. */
export const useTranslateInvocationMode = ({ persistentPolishEnabled, run }: Params) => {
  const altKeyHeldRef = useRef(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') altKeyHeldRef.current = true
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') altKeyHeldRef.current = false
    }
    const onBlur = () => {
      altKeyHeldRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      altKeyHeldRef.current = false
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const trigger = useCallback(
    (options?: TranslateTriggerOptions, sourceTextOverride?: string, runOverride?: TranslationRunOverride) => {
      const mode: TranslationMode =
        options?.polish || altKeyHeldRef.current || persistentPolishEnabled ? 'polish_then_translate' : 'translate'
      return runOverride
        ? run(options?.forceRefresh ?? false, sourceTextOverride, mode, runOverride)
        : run(options?.forceRefresh ?? false, sourceTextOverride, mode)
    },
    [persistentPolishEnabled, run]
  )

  const handlePrimaryClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      trigger({
        forceRefresh: (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey,
        polish: event.altKey
      }),
    [trigger]
  )

  return { handlePrimaryClick, trigger, triggerPolishOnce: () => trigger({ polish: true }) }
}
