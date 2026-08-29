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
  notReadyReason: 'models-loading' | 'model-unavailable'
  ready: boolean
  readClipboardForTranslate: () => Promise<string>
  prepareInput: (text: string) => void
  trigger: (
    options?: { forceRefresh?: boolean; polish?: boolean },
    sourceTextOverride?: string,
    runOverride?: TranslationRunOverride
  ) => Promise<void>
}

const readStringSearchValue = (value: unknown): string => (typeof value === 'string' ? value : '')
const isPasteRouteCommand = (value: unknown): boolean => value === 1 || value === '1'

/**
 * Consumes the one-shot `?paste=1&_=${nonce}` route command.
 *
 * Clipboard selection remains owned by the prepared Translate clipboard policy;
 * this hook only coordinates route dedupe, page readiness, and one invocation of
 * the already-extracted translation flow.
 */
export const useTranslateAutoPasteTrigger = ({
  busy,
  notReadyReason,
  prepareInput,
  readClipboardForTranslate,
  ready,
  trigger
}: Params): void => {
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const navigate = useNavigate()
  const handledNonceRef = useRef(new Set<string>())
  const latestRef = useRef({
    busy,
    navigate,
    prepareInput,
    readClipboardForTranslate,
    trigger
  })
  latestRef.current = {
    busy,
    navigate,
    prepareInput,
    readClipboardForTranslate,
    trigger
  }

  const pasteRequested = isPasteRouteCommand(search.paste)
  const nonce = readStringSearchValue(search._)

  useEffect(() => {
    if (!pasteRequested || ready) return

    logger.info('Translate Clipboard route command is waiting for page readiness', {
      nonce: nonce || null,
      reason: notReadyReason
    })
  }, [nonce, notReadyReason, pasteRequested, ready])

  useEffect(() => {
    if (!pasteRequested || !ready) return

    logger.info('Translate Clipboard route command is ready to consume', { nonce: nonce || null })

    const nonceKey = nonce ? `translate:paste:nonce:${nonce}` : ''
    const alreadyHandled =
      (nonce !== '' && handledNonceRef.current.has(nonce)) ||
      (nonceKey !== '' && sessionStorage.getItem(nonceKey) === '1')

    const clearRouteCommand = () => {
      void latestRef.current.navigate({ to: '/app/translate', replace: true })
    }

    if (alreadyHandled || latestRef.current.busy) {
      logger.info('Translate Clipboard route command was skipped', {
        nonce: nonce || null,
        reason: alreadyHandled ? 'already-handled' : 'page-busy'
      })
      clearRouteCommand()
      return
    }

    const now = Date.now()
    const lastTimestamp = Number(sessionStorage.getItem(LAST_TIMESTAMP_KEY) ?? '0')
    if (sessionStorage.getItem(RUNNING_KEY) === '1' || now - lastTimestamp < RECENT_TRIGGER_WINDOW_MS) {
      logger.info('Translate Clipboard route command was skipped', {
        nonce: nonce || null,
        reason: sessionStorage.getItem(RUNNING_KEY) === '1' ? 'translation-running' : 'recent-trigger'
      })
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
        const text = await latestRef.current.readClipboardForTranslate()
        if (cancelled) return

        logger.info('Translate Clipboard clipboard read completed', {
          nonce: nonce || null,
          textLength: text.length
        })

        if (text.trim()) {
          const { prepareInput: prepareLatestInput } = latestRef.current
          prepareLatestInput(text)
          logger.info('Translate Clipboard translation dispatch started', { nonce: nonce || null })

          await latestRef.current.trigger(undefined, text, { sourcePreprocessed: true })
          logger.info('Translate Clipboard translation dispatch completed', { nonce: nonce || null })
        } else {
          logger.info('Translate Clipboard route command had no translatable clipboard text', {
            nonce: nonce || null
          })
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
  }, [nonce, pasteRequested, ready])
}
