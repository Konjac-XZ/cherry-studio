import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { loggerService } from '@logger'

import type { TranslationRunOverride } from './useTranslationFlowRunner'

const logger = loggerService.withContext('TranslatePage/AutoPasteTrigger')

type Params = {
  notReadyReason: 'models-loading' | 'model-unavailable'
  ready: boolean
  readClipboardForTranslate: () => Promise<string>
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
  notReadyReason,
  readClipboardForTranslate,
  ready,
  trigger
}: Params): void => {
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const navigate = useNavigate()
  const handledNonceRef = useRef(new Set<string>())
  const latestRef = useRef({
    navigate,
    readClipboardForTranslate,
    trigger
  })
  latestRef.current = {
    navigate,
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

    if (alreadyHandled) {
      logger.info('Translate Clipboard route command was skipped', {
        nonce: nonce || null,
        reason: 'already-handled'
      })
      clearRouteCommand()
      return
    }

    let cancelled = false

    const run = async () => {
      try {
        const text = await latestRef.current.readClipboardForTranslate()
        if (cancelled) return

        logger.info('Translate Clipboard clipboard read completed', {
          nonce: nonce || null,
          textLength: text.length
        })

        if (text.trim()) {
          logger.info('Translate Clipboard translation dispatch started', { nonce: nonce || null })

          const pending = latestRef.current.trigger(undefined, text, {
            replaceActive: true,
            updateSource: true,
            sourcePreprocessed: true
          })
          if (nonce) {
            handledNonceRef.current.add(nonce)
            sessionStorage.setItem(nonceKey, '1')
          }
          await pending
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
      } catch (error) {
        logger.warn('Failed to consume Translate Clipboard route command', error as Error)
      } finally {
        if (!cancelled) clearRouteCommand()
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [nonce, pasteRequested, ready])
}
