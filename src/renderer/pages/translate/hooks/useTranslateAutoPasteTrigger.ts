import { loggerService } from '@logger'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import type { TranslationRunOverride } from './useTranslationFlowRunner'

const logger = loggerService.withContext('TranslatePage/AutoPasteTrigger')
const RUNNING_KEY = 'translate:paste:running'
const LAST_TIMESTAMP_KEY = 'translate:paste:lastTs'
const RECENT_TRIGGER_WINDOW_MS = 1_000
const RUNNING_GUARD_RELEASE_MS = 500

type Params = {
  busy: boolean
  ready: boolean
  readClipboardForTranslate: () => Promise<string>
  prepareInput: (text: string) => void
  setSourceLanguageToAuto: () => Promise<unknown>
  trigger: (
    options?: { forceRefresh?: boolean; polish?: boolean },
    sourceTextOverride?: string,
    runOverride?: TranslationRunOverride
  ) => Promise<void>
}

const readStringSearchValue = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * Consumes the one-shot `?paste=1&_=${nonce}` route command.
 *
 * Clipboard selection remains owned by the prepared Translate clipboard policy;
 * this hook only coordinates route dedupe, page readiness, Auto source reset, and
 * one invocation of the already-extracted translation flow.
 */
export const useTranslateAutoPasteTrigger = ({
  busy,
  prepareInput,
  readClipboardForTranslate,
  ready,
  setSourceLanguageToAuto,
  trigger
}: Params): void => {
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const navigate = useNavigate()
  const handledNonceRef = useRef(new Set<string>())

  const paste = readStringSearchValue(search.paste)
  const nonce = readStringSearchValue(search._)

  useEffect(() => {
    if (paste !== '1' || !ready) return

    const nonceKey = nonce ? `translate:paste:nonce:${nonce}` : ''
    const alreadyHandled =
      (nonce !== '' && handledNonceRef.current.has(nonce)) ||
      (nonceKey !== '' && sessionStorage.getItem(nonceKey) === '1')

    const clearRouteCommand = () => {
      void navigate({ to: '/app/translate', replace: true })
    }

    if (alreadyHandled || busy) {
      clearRouteCommand()
      return
    }

    const now = Date.now()
    const lastTimestamp = Number(sessionStorage.getItem(LAST_TIMESTAMP_KEY) ?? '0')
    if (sessionStorage.getItem(RUNNING_KEY) === '1' || now - lastTimestamp < RECENT_TRIGGER_WINDOW_MS) {
      clearRouteCommand()
      return
    }

    let cancelled = false
    let guardTimer: ReturnType<typeof setTimeout> | undefined
    sessionStorage.setItem(RUNNING_KEY, '1')

    const releaseGuard = () => {
      guardTimer = setTimeout(() => sessionStorage.removeItem(RUNNING_KEY), RUNNING_GUARD_RELEASE_MS)
    }

    const run = async () => {
      try {
        const text = await readClipboardForTranslate()
        if (cancelled) return

        if (text.trim()) {
          await setSourceLanguageToAuto()
          if (cancelled) return
          prepareInput(text)
          await trigger(undefined, text, { sourceLanguage: 'auto' })
        }

        if (nonce) {
          handledNonceRef.current.add(nonce)
          sessionStorage.setItem(nonceKey, '1')
        }
        sessionStorage.setItem(LAST_TIMESTAMP_KEY, String(now))
      } catch (error) {
        logger.warn('Failed to consume Translate Clipboard route command', error as Error)
      } finally {
        if (!cancelled) clearRouteCommand()
        releaseGuard()
      }
    }

    void run()
    return () => {
      cancelled = true
      if (guardTimer) clearTimeout(guardTimer)
      sessionStorage.removeItem(RUNNING_KEY)
    }
  }, [busy, navigate, nonce, paste, prepareInput, readClipboardForTranslate, ready, setSourceLanguageToAuto, trigger])
}
