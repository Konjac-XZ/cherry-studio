/**
 * `useWorkspaceTranslate` — single owner of the translate-call boilerplate.
 *
 * Replaces the repeated `isTranslating` flag + try/catch + isAbortError
 * suppression + toast/log wiring that every translate consumer used to
 * hand-roll. See GitHub issue #14533 for motivation.
 *
 * Behaviour:
 *   - Only one translation is in flight at a time. Calling `translate()`
 *     while another is running aborts the previous one and starts fresh.
 *   - User-initiated aborts (`isAbortError(err)` or `cancel()`) resolve to
 *     `undefined` silently — no log, no toast — so consumers can rely on
 *     `if (result)` to gate success-side effects.
 *   - Non-abort errors are always logged via `loggerService`; the toast and
 *     the rethrow are opt-out via `options`.
 *   - Unmounting aborts component-owned calls. Calls delegated to a stable
 *     task owner survive Activity cleanup and are cancelled explicitly.
 *
 * Callers that need rich rendering can use `onResponse` to mirror the streamed
 * accumulated text into their own view state.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'

import { loggerService } from '@logger'
import { toast } from '@renderer/services/toast'
import type { TranslationTaskOwner } from '@renderer/services/translation'
import { formatErrorMessageWithPrefix, isAbortError } from '@renderer/utils/error'
import { translateText, type TranslateTextOptions } from '@renderer/utils/translate'
import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import type { TranslateLanguage } from '@shared/data/types/translate'

const TRANSLATE_ERROR_KEY_PATTERN = /\btranslate\.error\.[a-zA-Z0-9_.-]+\b/

function localizeTranslateError(error: unknown, t: (key: string) => string): unknown {
  if (!(error instanceof Error)) return error

  const key = error.message.match(TRANSLATE_ERROR_KEY_PATTERN)?.[0]
  if (!key) return error

  const localizedError = new Error(t(key))
  localizedError.name = error.name
  localizedError.stack = error.stack
  localizedError.cause = error.cause
  return localizedError
}

export interface UseWorkspaceTranslateOptions {
  /** Default: true. Set false to suppress the default error toast. */
  showErrorToast?: boolean
  /** Default: 'translate.error.failed'. i18n key used as the toast prefix. */
  errorPrefixI18nKey?: string
  /**
   * Default: false. When true, non-abort errors rethrow after logging/toasting
   * so callers that need to keep popovers / modals open for retry can catch.
   */
  rethrowError?: boolean
  /** Optional progressive callback — passed through to {@link translateText}. */
  onResponse?: (text: string, isComplete: boolean) => void
  /** Logger context name. Default: 'useWorkspaceTranslate'. */
  loggerContext?: string
  /** Stable owner for runs that must survive the host component's Activity lifecycle. */
  taskOwner?: TranslationTaskOwner | null
}

export interface UseWorkspaceTranslateResult {
  /**
   * Run a translation. Resolves with the trimmed text on success and
   * `undefined` on user-initiated abort or on a swallowed error
   * (when `rethrowError` is false).
   */
  translate: (
    text: string,
    targetLanguage: TranslateLangCode | TranslateLanguage,
    runOptions?: TranslateTextOptions,
    signal?: AbortSignal
  ) => Promise<string | undefined>
  isTranslating: boolean
  /** Abort the in-flight translation. No-op when nothing is running. */
  cancel: () => void
}

export function useWorkspaceTranslate(options?: UseWorkspaceTranslateOptions): UseWorkspaceTranslateResult {
  const { t } = useTranslation()
  const taskOwner = options?.taskOwner ?? null
  const [localIsTranslating, setLocalIsTranslating] = useState(false)
  const ownerIsTranslating = useSyncExternalStore(
    taskOwner?.subscribe ?? NO_SUBSCRIPTION,
    taskOwner?.isBusy ?? NEVER_BUSY,
    taskOwner?.isBusy ?? NEVER_BUSY
  )
  const isTranslating = taskOwner ? ownerIsTranslating : localIsTranslating

  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  // Tracks the abort key of the currently in-flight translation. `null` when
  // nothing is running or the active translation has been cancelled /
  // superseded. Used as the source-of-truth for "is this call still ours?"
  // checks against late-resolving IPC promises. Paired with `activeControllerRef`
  // which owns the actual AbortSignal threaded into `translateText` →
  // `streamAbort`.
  const activeAbortKeyRef = useRef<string | null>(null)
  const activeControllerRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    if (taskOwner) {
      taskOwner.abortTasks()
      activeAbortKeyRef.current = null
      activeControllerRef.current = null
      return
    }
    if (!activeAbortKeyRef.current) return
    // Clear the ref first so the in-flight translate's continuation sees
    // "you've been cancelled" and discards its result even if the abort
    // doesn't unwind the underlying IPC immediately.
    activeAbortKeyRef.current = null
    activeControllerRef.current?.abort()
    activeControllerRef.current = null
    setLocalIsTranslating(false)
  }, [taskOwner])

  const translate = useCallback<UseWorkspaceTranslateResult['translate']>(
    async (text, targetLanguage, runOptions, externalSignal) => {
      // A new call supersedes any in-flight one — keeps semantics simple
      // (one translation per hook instance) and matches the existing stop-button
      // behaviour in TranslatePage.
      activeControllerRef.current?.abort()
      const controller = new AbortController()
      activeControllerRef.current = controller
      activeAbortKeyRef.current = uuid()
      const abortKey = activeAbortKeyRef.current
      const finishTask = taskOwner?.addTask(controller)

      if (!taskOwner) setLocalIsTranslating(true)

      const onExternalAbort = () => {
        controller.abort(externalSignal?.reason)
        if (activeAbortKeyRef.current === abortKey) {
          activeAbortKeyRef.current = null
          activeControllerRef.current = null
          if (!taskOwner) setLocalIsTranslating(false)
        }
      }
      if (externalSignal?.aborted) {
        onExternalAbort()
        finishTask?.()
        return undefined
      }
      externalSignal?.addEventListener('abort', onExternalAbort, { once: true })

      // Gate the progressive callback so a late `onResponse` from a
      // cancelled / superseded run doesn't write into consumer state.
      const onResponse = optionsRef.current?.onResponse
      const guardedOnResponse = onResponse
        ? (chunkText: string, isComplete: boolean) => {
            if (controller.signal.aborted || activeAbortKeyRef.current !== abortKey) return
            onResponse(chunkText, isComplete)
          }
        : undefined
      const guardedRunOptions = runOptions
        ? {
            ...runOptions,
            ...(runOptions.onOutputTokens && {
              onOutputTokens: (outputTokens: number) => {
                if (controller.signal.aborted || activeAbortKeyRef.current !== abortKey) return
                runOptions.onOutputTokens?.(outputTokens)
              }
            }),
            ...(runOptions.onTraceReady && {
              onTraceReady: (traceId: string) => {
                if (controller.signal.aborted || activeAbortKeyRef.current !== abortKey) return
                runOptions.onTraceReady?.(traceId)
              }
            })
          }
        : undefined

      const wasSuperseded = () => controller.signal.aborted || activeAbortKeyRef.current !== abortKey
      const finishIfActive = () => {
        finishTask?.()
        if (activeAbortKeyRef.current === abortKey) {
          activeAbortKeyRef.current = null
          activeControllerRef.current = null
          if (!taskOwner) setLocalIsTranslating(false)
        }
      }

      try {
        const result = await translateText(
          text,
          targetLanguage,
          guardedOnResponse,
          controller.signal,
          guardedRunOptions
        )
        if (wasSuperseded()) {
          // Cancelled or superseded mid-flight — discard the result so the
          // caller's `if (result)` success branch stays gated.
          return undefined
        }
        return result
      } catch (error) {
        if (wasSuperseded() || isAbortError(error)) {
          // User-initiated cancel — swallow silently.
          return undefined
        }
        const opts = optionsRef.current
        const showErrorToast = opts?.showErrorToast ?? true
        const errorPrefixI18nKey = opts?.errorPrefixI18nKey ?? 'translate.error.failed'
        loggerService
          .withContext(opts?.loggerContext ?? 'useWorkspaceTranslate')
          .error('Translation failed', error as Error)
        if (showErrorToast) {
          toast.error(formatErrorMessageWithPrefix(localizeTranslateError(error, t), t(errorPrefixI18nKey)))
        }
        if (opts?.rethrowError) throw localizeTranslateError(error, t)
        return undefined
      } finally {
        externalSignal?.removeEventListener('abort', onExternalAbort)
        finishIfActive()
      }
    },
    [t, taskOwner]
  )

  // Component-owned calls abort on unmount. A stable task owner retains the
  // controller across Activity cleanup and exposes explicit cancellation.
  useEffect(() => {
    if (taskOwner) return
    return () => {
      activeAbortKeyRef.current = null
      activeControllerRef.current?.abort()
      activeControllerRef.current = null
    }
  }, [taskOwner])

  return { translate, isTranslating, cancel }
}

const NEVER_BUSY = () => false
const NO_SUBSCRIPTION = () => () => {}
