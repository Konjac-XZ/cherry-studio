import { ipcApi } from '@renderer/ipc'
import { isTranslateLangCode, type TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import type { CherryUIMessageChunk } from '@shared/data/types/message'
import type { UniqueModelId } from '@shared/data/types/model'
import type { TranslateLanguage, TranslateOperation } from '@shared/data/types/translate'
import { t } from 'i18next'
import { v4 as uuid } from 'uuid'

/** Must stay in sync with main-side prefix (validated in `translateService.open`). */
const TRANSLATE_STREAM_PREFIX = 'translate:'

export interface TranslateTextOptions {
  operation?: TranslateOperation
  sourceLangCode?: TranslateLangCode
  modelId?: UniqueModelId
  onOutputTokens?: (outputTokens: number) => void
  traceTopicId?: string
  traceId?: string
  onTraceReady?: (traceId: string) => void
}

export const resolveTranslatePlan = async (
  targetLangCode: TranslateLangCode,
  operation: TranslateOperation = 'translate'
): Promise<UniqueModelId> => {
  const result = await ipcApi.request('translate.plan', { targetLangCode, operation })
  return result.modelId
}

/**
 * Translate `text` to `targetLanguage` via main's `translate.open` IPC.
 * Per-chunk `onResponse(accumulated, isComplete)` lets the caller pace the
 * display (see `useSmoothStream`). `signal` aborts via the `ai.stream.abort` route.
 */
export const translateText = async (
  text: string,
  targetLanguage: TranslateLangCode | TranslateLanguage,
  onResponse?: (text: string, isComplete: boolean) => void,
  signal?: AbortSignal,
  options?: TranslateTextOptions
): Promise<string> => {
  if (signal?.aborted) {
    throw new DOMException('Translation aborted before start', 'AbortError')
  }

  const targetLangCode = typeof targetLanguage === 'string' ? targetLanguage : targetLanguage.langCode
  if (!isTranslateLangCode(targetLangCode) || targetLangCode === 'unknown') {
    throw new Error(`Invalid target language: ${targetLangCode}`)
  }

  const streamId = `${TRANSLATE_STREAM_PREFIX}${uuid()}`

  let accumulated = ''
  let cleaned = false
  const unsubscribers: Array<() => void> = []

  let abortListener: (() => void) | undefined
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    for (const off of unsubscribers) {
      try {
        off()
      } catch {
        // listener unsub never throws meaningfully
      }
    }
    if (signal && abortListener) signal.removeEventListener('abort', abortListener)
  }

  return new Promise<string>((resolve, reject) => {
    if (signal) {
      abortListener = () => {
        cleanup()
        reject(new DOMException('Translation aborted', 'AbortError'))
        void ipcApi.request('ai.stream.abort', { topicId: streamId }).catch(() => {
          // Local cancellation must settle even if main cannot acknowledge it.
        })
      }
      signal.addEventListener('abort', abortListener, { once: true })
    }
    // Subscribe **before** calling main. Main starts the stream synchronously
    // inside `translate.open`, so the first chunk can land between `open()`'s
    // resolve and any post-await subscriber registration.
    unsubscribers.push(
      ipcApi.on('ai.stream.chunk', ({ topicId, chunk }) => {
        if (cleaned || topicId !== streamId) return
        if (chunk?.type === 'message-metadata') {
          const outputTokens = (chunk as Extract<CherryUIMessageChunk, { type: 'message-metadata' }>).messageMetadata
            ?.stats?.outputTokens
          if (typeof outputTokens === 'number' && Number.isFinite(outputTokens) && outputTokens > 0) {
            options?.onOutputTokens?.(outputTokens)
          }
          return
        }
        if (
          chunk &&
          (chunk as { type?: string }).type === 'text-delta' &&
          typeof (chunk as { delta?: unknown }).delta === 'string'
        ) {
          accumulated += (chunk as { delta: string }).delta
          onResponse?.(accumulated, false)
        }
      })
    )

    unsubscribers.push(
      ipcApi.on('ai.stream.done', ({ topicId, status }) => {
        if (cleaned || topicId !== streamId) return
        if (status !== 'success') {
          cleanup()
          reject(new DOMException('Translation stream paused', 'AbortError'))
          return
        }
        const trimmed = accumulated.trim()
        cleanup()
        if (!trimmed) {
          reject(new Error(t('translate.error.empty')))
          return
        }
        onResponse?.(trimmed, true)
        resolve(trimmed)
      })
    )

    unsubscribers.push(
      ipcApi.on('ai.stream.error', ({ topicId, error }) => {
        if (cleaned || topicId !== streamId) return
        cleanup()
        // Preserve error.name (e.g. 'AbortError') so downstream
        // `isAbortError(...)` classifies user stops correctly.
        const err = new Error(error?.message ?? 'Translation stream error')
        if (error?.name) err.name = error.name
        reject(err)
      })
    )

    ipcApi
      .request('translate.open', {
        streamId,
        text,
        targetLangCode,
        ...(options?.operation && { operation: options.operation }),
        ...(options?.sourceLangCode && { sourceLangCode: options.sourceLangCode }),
        ...(options?.modelId && { modelId: options.modelId }),
        ...(options?.traceTopicId && { traceTopicId: options.traceTopicId }),
        ...(options?.traceId && { traceId: options.traceId })
      })
      .then(({ traceId }) => {
        if (!cleaned && traceId) options?.onTraceReady?.(traceId)
      })
      .catch((openError: unknown) => {
        cleanup()
        reject(openError instanceof Error ? openError : new Error(String(openError)))
      })
  })
}
