/**
 * Main-process translate service.
 *
 * Stateless orchestration — resolves the configured translate model + builds
 * the interpolated prompt from main-side preferences/DataApi, then hands the
 * stream off to `AiStreamManager.streamPrompt` with a `WebContentsListener`
 * keyed by a fresh `translate:${uuid}` streamId.
 *
 * Renderer subscribers consume `ai.stream.chunk` / `done` / `error` events
 * filtered by that streamId; abort flows back through `ai.stream.abort`.
 *
 * Per CLAUDE.md's lifecycle-decision guide this is a **direct-import
 * singleton**, not a `BaseService` — no long-lived resources, no persistent
 * side effects. The thin IpcApi handler lives in
 * `src/main/ipc/handlers/translate.ts`.
 */

import { randomBytes } from 'node:crypto'

import { application } from '@application'
import { loggerService } from '@logger'
import { startAiChildTurnSpan } from '@main/ai/observability'
import { modelService } from '@main/data/services/ModelService'
import { buildCustomizedDictionary, translateGlossaryService } from '@main/data/services/TranslateGlossaryService'
import { translateLanguageService } from '@main/data/services/TranslateLanguageService'
import {
  isTranslateLangCode,
  type TranslateCustomParameters,
  type TranslateLangCode
} from '@shared/data/preference/preferenceTypes'
import { createUniqueModelId, isUniqueModelId, parseUniqueModelId, type UniqueModelId } from '@shared/data/types/model'
import type { TranslateLanguage, TranslateOperation } from '@shared/data/types/translate'
import type { ReasoningEffortOption } from '@shared/types/aiSdk'
import { isNonChatModel, isQwenMTModel } from '@shared/utils/model'

import {
  PersistenceListener,
  type StreamListener,
  TraceFlushListener,
  TranslationBackend,
  WebContentsListener
} from '../../ai/streamManager'
import {
  gateTranslateSamplingParameters,
  hasTranslateReasoningOverride,
  isSameTranslateLanguageFamily,
  translateCustomParametersToRecord
} from './translateRequestOptions'

const logger = loggerService.withContext('TranslateService')

const NOT_CONFIGURED_ERROR = 'translate.error.not_configured'

/**
 * Namespaced prefix every translate stream uses for its `streamId` /
 * `topicId`. Defensive: ensures `ai.stream.abort({ topicId })` cannot collide
 * with a real chat topic id, and lets a future debugger filter logs by
 * "translate streams" without inspecting payloads. Kept in sync with the
 * renderer-side literal in `TranslateService.ts`.
 */
const TRANSLATE_STREAM_PREFIX = 'translate:'

export interface TranslateOpenRequest {
  /**
   * Renderer-generated streamId — must be prefixed `translate:`. The renderer
   * subscribes to `ai.stream.chunk` / `ai.stream.done` / `ai.stream.error` keyed
   * by this id **before** invoking `open`, so the first chunk cannot land
   * before the listener is attached.
   */
  streamId: string
  /** Source text to translate. */
  text: string
  /**
   * Target language code. Main is the single authority for the DTO lookup —
   * it resolves via `translateLanguageService.getByLangCode`, so renderers
   * never have to pre-fetch the DTO just to call translate.
   */
  targetLangCode: TranslateLangCode
  /** Defaults to translation; polish is the optional first stage of the page flow. */
  operation?: TranslateOperation
  /** Model frozen by `plan`; invalid/stale values fail rather than silently switching mid-run. */
  modelId?: UniqueModelId
  /**
   * When present, attach a `PersistenceListener` + `TranslationBackend` to
   * the stream so the final accumulated translation is written onto this
   * message's `data.parts` as a `data-translation` part. Used by the
   * MessageMenubar "translate this reply" flow. Omit for orphan callers
   * (ActionTranslate, TranslatePage) — they keep the chunks-only contract.
   */
  messageId?: string
  /**
   * Optional source language passed through to the persisted
   * `data-translation` part. Renderers that already detected the source
   * (e.g. selection translate) can preserve it on the message row.
   */
  sourceLangCode?: TranslateLangCode
  /** Stable trace ownership for one Translate-page run. */
  traceTopicId?: string
  /** Existing container trace reused by a later stage in the same run. */
  traceId?: string
}

export interface TranslateOpenResult {
  /** Streaming id; renderer filters `ai.stream.*` events by this. */
  streamId: string
  traceId?: string
}

export interface TranslatePlanRequest {
  targetLangCode: TranslateLangCode
  operation?: TranslateOperation
}

interface ResolvedPayload {
  uniqueModelId: UniqueModelId
  /** Final prompt content. For Qwen MT this is the raw source text (the model handles language pairing). */
  content: string
  reasoningEffort: ReasoningEffortOption
  customParameters: Record<string, unknown>
}

interface ResolvedTranslateModel {
  uniqueModelId: UniqueModelId
  model: NonNullable<ReturnType<typeof modelService.getByKey>>
}

export class TranslateService {
  plan(req: TranslatePlanRequest): { modelId: UniqueModelId } {
    if (!isTranslateLangCode(req.targetLangCode) || req.targetLangCode === 'unknown') {
      throw new Error(`Invalid target language: ${req.targetLangCode}`)
    }
    const targetLanguage = translateLanguageService.getByLangCode(req.targetLangCode)
    return { modelId: this.resolveTranslatePayload('', targetLanguage, req.operation ?? 'translate').uniqueModelId }
  }

  /**
   * IPC entry-point (called from `AiService.onInit`). Resolves the model +
   * prompt, then dispatches the stream through `AiStreamManager.streamPrompt`.
   * Returns the `streamId` synchronously so the renderer can subscribe to
   * `ai.stream.chunk` / `ai.stream.done` / `ai.stream.error` before chunks
   * start flowing.
   */
  open(sender: Electron.WebContents, req: TranslateOpenRequest): TranslateOpenResult {
    if (!req.streamId.startsWith(TRANSLATE_STREAM_PREFIX)) {
      throw new Error(`streamId must be prefixed '${TRANSLATE_STREAM_PREFIX}' (got '${req.streamId}')`)
    }
    if (!isTranslateLangCode(req.targetLangCode) || req.targetLangCode === 'unknown') {
      throw new Error(`Invalid target language: ${req.targetLangCode}`)
    }
    const targetLanguage = translateLanguageService.getByLangCode(req.targetLangCode)
    const operation = req.operation ?? 'translate'
    const { uniqueModelId, content, reasoningEffort, customParameters } = this.resolveTranslatePayload(
      req.text,
      targetLanguage,
      operation,
      req.modelId
    )

    const traceTopicId = application.get('PreferenceService').get('app.developer_mode.enabled')
      ? req.traceTopicId
      : undefined
    const traceId = traceTopicId ? (req.traceId ?? randomBytes(16).toString('hex')) : undefined
    const turnTrace =
      traceId && traceTopicId
        ? startAiChildTurnSpan(
            'ai.turn',
            {
              attributes: {
                'cs.topic_id': traceTopicId,
                'cs.trigger': 'translate',
                'cs.model_id': uniqueModelId,
                'cs.role': 'assistant',
                'cs.translate.operation': operation,
                'cs.stream_id': req.streamId
              }
            },
            { topicId: traceTopicId, modelName: parseUniqueModelId(uniqueModelId).modelId },
            traceId
          )
        : undefined

    const listeners: StreamListener[] = []
    // Built first so the persistence listener can surface a persist failure through it:
    // TranslationBackend has no markTerminalError, so without this a post-stream persist
    // failure would leave the renderer on a `success` it already received and silently lose
    // the translation on reload.
    const wcListener = new WebContentsListener(sender, req.streamId)
    if (req.messageId) {
      listeners.push(
        new PersistenceListener({
          topicId: req.streamId,
          backend: new TranslationBackend({
            messageId: req.messageId,
            targetLanguage: req.targetLangCode,
            sourceLanguage: req.sourceLangCode
          }),
          onPersistFailed: (error) => wcListener.onError({ error, status: 'error', isTopicDone: true })
        })
      )
    }
    if (traceTopicId) listeners.push(new TraceFlushListener(traceTopicId))
    listeners.push(wcListener)

    const streamManager = application.get('AiStreamManager')
    try {
      streamManager.streamPrompt({
        streamId: req.streamId,
        ...(traceTopicId && { traceTopicId, rootSpan: turnTrace?.rootSpan }),
        uniqueModelId,
        prompt: content,
        listener: listeners,
        reasoningEffort,
        ...(Object.keys(customParameters).length > 0 && { callOverrides: { customParameters } })
      })
    } catch (error) {
      turnTrace?.end('error', error instanceof Error ? error : new Error(String(error)))
      throw error
    }

    logger.debug('translate stream opened', {
      streamId: req.streamId,
      uniqueModelId,
      operation,
      messageId: req.messageId ?? null,
      reasoningEffort,
      hasCustomParameters: Object.keys(customParameters).length > 0
    })
    return { streamId: req.streamId, ...(traceId && { traceId }) }
  }

  /**
   * Resolve the configured translate model + interpolate the translate prompt.
   *
   * Reads `feature.translate.model_id` from Preference and fetches the
   * matching model row via the main `modelService`. Qwen MT models bypass
   * prompt interpolation (the model handles language pairing itself) —
   * matches the renderer-side v1 behaviour.
   */
  resolveTranslatePayload(
    text: string,
    targetLanguage: TranslateLanguage,
    operation: TranslateOperation = 'translate',
    frozenModelId?: UniqueModelId
  ): ResolvedPayload {
    const preferenceService = application.get('PreferenceService')
    const nativeLanguage = preferenceService.get('feature.translate.native_language')
    const towardNative = isSameTranslateLanguageFamily(targetLanguage.langCode, nativeLanguage)
    const globalTranslateId = preferenceService.get('feature.translate.model_id')

    const resolved = frozenModelId
      ? this.resolveEligibleModel(frozenModelId)
      : operation === 'polish'
        ? this.resolveFirstEligibleModel([
            preferenceService.get('feature.translate.model.polish_id'),
            preferenceService.get('feature.translate.model.polish_global_id'),
            globalTranslateId
          ])
        : this.resolveFirstEligibleModel([
            ...(preferenceService.get(
              towardNative
                ? 'feature.translate.model.other_to_native_follows_global'
                : 'feature.translate.model.native_to_other_follows_global'
            )
              ? []
              : [
                  preferenceService.get(
                    towardNative
                      ? 'feature.translate.model.other_to_native_id'
                      : 'feature.translate.model.native_to_other_id'
                  )
                ]),
            globalTranslateId
          ])

    if (!resolved) throw new Error(NOT_CONFIGURED_ERROR)

    const prompt = preferenceService.get(
      operation === 'polish'
        ? 'feature.translate.prompt.polish'
        : towardNative
          ? 'feature.translate.prompt.other_to_native'
          : 'feature.translate.prompt.native_to_other'
    )
    const customizedDictionary = prompt.includes('{{customized_dictionary}}')
      ? buildCustomizedDictionary(
          translateGlossaryService.list({ targetLanguage: targetLanguage.langCode, enabled: true }),
          text
        )
      : ''
    const content =
      operation === 'translate' && isQwenMTModel(resolved.model)
        ? text
        : prompt
            .replaceAll('{{target_language}}', targetLanguage.value)
            .replaceAll('{{text}}', text)
            .replaceAll('{{customized_dictionary}}', customizedDictionary)

    const parameters: TranslateCustomParameters = preferenceService.get(
      operation === 'polish'
        ? 'feature.translate.request.polish_custom_parameters'
        : 'feature.translate.request.custom_parameters'
    )
    const autoDisableReasoning = preferenceService.get(
      operation === 'polish'
        ? 'feature.translate.reasoning.polish_auto_disable'
        : 'feature.translate.reasoning.translate_auto_disable'
    )
    const hasReasoningOverride = hasTranslateReasoningOverride(parameters)
    const reasoningEffort = hasReasoningOverride ? 'default' : autoDisableReasoning ? 'none' : 'default'

    logger.debug('resolved translate reasoning effort', {
      operation,
      providerId: resolved.model.providerId,
      modelId: resolved.model.id,
      apiModelId: resolved.model.apiModelId ?? null,
      selectableEfforts: resolved.model.reasoning?.selectableEfforts ?? [],
      autoDisableReasoning,
      hasReasoningOverride,
      reasoningEffort
    })

    return {
      uniqueModelId: resolved.uniqueModelId,
      content,
      customParameters: gateTranslateSamplingParameters(
        translateCustomParametersToRecord(parameters),
        resolved.model,
        reasoningEffort
      ),
      reasoningEffort
    }
  }

  private resolveFirstEligibleModel(candidates: Array<string | null | undefined>): ResolvedTranslateModel | undefined {
    for (const candidate of candidates) {
      const resolved = this.resolveEligibleModel(candidate)
      if (resolved) return resolved
    }

    // Mirrors the v1 policy's last-resort available-model fallback. This only
    // runs when every configured identity is stale, malformed, or non-chat.
    try {
      const fallback = modelService.list({ enabled: true }).find((model) => !isNonChatModel(model))
      if (fallback) {
        return {
          uniqueModelId: isUniqueModelId(fallback.id)
            ? fallback.id
            : createUniqueModelId(fallback.providerId, fallback.apiModelId ?? fallback.id),
          model: fallback
        }
      }
    } catch (error) {
      logger.warn('failed to resolve an available translate model fallback', { error })
    }
    return undefined
  }

  private resolveEligibleModel(value: string | null | undefined): ResolvedTranslateModel | undefined {
    if (!value || !isUniqueModelId(value)) return undefined
    const { providerId, modelId } = parseUniqueModelId(value)
    try {
      const model = modelService.getByKey(providerId, modelId)
      if (!model || isNonChatModel(model)) return undefined
      return { uniqueModelId: createUniqueModelId(providerId, modelId), model }
    } catch {
      return undefined
    }
  }
}

export const translateService = new TranslateService()
