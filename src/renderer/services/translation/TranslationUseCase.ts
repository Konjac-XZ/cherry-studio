import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import type { UniqueModelId } from '@shared/data/types/model'
import type { TranslateHistory, TranslateOperation } from '@shared/data/types/translate'
import {
  createPolishTranslateHistoryCacheKey,
  createTranslateHistoryCacheKey,
  normalizeTranslateHistoryText
} from '@shared/utils/translateHistory'

export type TranslationMode = 'translate' | 'polish_then_translate'

export type TranslationPreparationCommand = {
  bidirectionalPair: [TranslateLangCode, TranslateLangCode]
  forceRefresh?: boolean
  isBidirectional: boolean
  mode: TranslationMode
  nativeLanguage: TranslateLangCode | null
  sourceLanguage: TranslateLangCode | 'auto'
  sourceText: string
  targetLanguage: TranslateLangCode
}

export type TranslationPreparationPorts = {
  detectLanguage: (text: string, signal?: AbortSignal) => Promise<TranslateLangCode>
  determineTargetLanguage: (
    sourceLanguage: TranslateLangCode,
    targetLanguage: TranslateLangCode,
    isBidirectional: boolean,
    pair: [TranslateLangCode, TranslateLangCode],
    nativeLanguage?: TranslateLangCode | null
  ) => { success: true; language: TranslateLangCode } | { success: false; errorType?: 'same_language' | 'not_in_pair' }
  findBySourceText: (sourceText: string) => Promise<TranslateHistory[]>
  findCached: (cacheKey: string) => Promise<TranslateHistory | undefined>
  plan: (targetLanguage: TranslateLangCode, operation: TranslateOperation) => Promise<UniqueModelId>
}

export type PreparedTranslation = {
  cacheKey: string
  mode: TranslationMode
  polishModelId?: UniqueModelId
  sourceLanguage: TranslateLangCode
  sourceText: string
  targetLanguage: TranslateLangCode
  translateModelId: UniqueModelId
}

export type TranslationPreparationResult =
  | { status: 'ready'; value: PreparedTranslation }
  | { status: 'cache_hit'; history: TranslateHistory; value: PreparedTranslation }
  | { status: 'same_language'; sourceLanguage: TranslateLangCode }
  | { status: 'not_in_pair'; sourceLanguage: TranslateLangCode }

export type TranslationExecutionProgress =
  | { stage: 'polishing_started' }
  | { content: string; stage: 'polishing_update' }
  | { content: string; stage: 'polishing_completed' }
  | { stage: 'translation_started' }
  | { content: string; stage: 'translation_update' }
  | { displayText: string; rawText: string; stage: 'display_ready' }

export type TranslationExecutionPorts = {
  postProcess: (content: string, targetLanguage: TranslateLangCode) => string
  saveHistory: (input: {
    cacheKey: string
    modelId: UniqueModelId
    sourceLanguage: TranslateLangCode
    sourceText: string
    targetLanguage: TranslateLangCode
    targetText: string
  }) => Promise<void>
  translate: (input: {
    modelId: UniqueModelId
    onUpdate?: (content: string) => void
    operation: TranslateOperation
    signal?: AbortSignal
    sourceLanguage: TranslateLangCode
    targetLanguage: TranslateLangCode
    text: string
  }) => Promise<string | undefined>
}

export type TranslationExecutionResult = {
  displayText: string
  historyError?: unknown
  polishedText?: string
  rawText: string
}

const throwIfAborted = (signal?: AbortSignal) => {
  if (!signal?.aborted) return
  throw new DOMException('Translation aborted', 'AbortError')
}

const buildPreparedTranslation = async (
  command: TranslationPreparationCommand,
  ports: TranslationPreparationPorts,
  sourceLanguage: TranslateLangCode,
  targetLanguage: TranslateLangCode,
  signal?: AbortSignal
): Promise<PreparedTranslation> => {
  const translateModelId = await ports.plan(targetLanguage, 'translate')
  throwIfAborted(signal)
  const polishModelId =
    command.mode === 'polish_then_translate' ? await ports.plan(targetLanguage, 'polish') : undefined
  throwIfAborted(signal)

  const cacheKey = polishModelId
    ? createPolishTranslateHistoryCacheKey({
        sourceText: command.sourceText,
        sourceLanguage,
        targetLanguage,
        modelId: translateModelId,
        polishModelId
      })
    : createTranslateHistoryCacheKey({
        sourceText: command.sourceText,
        sourceLanguage,
        targetLanguage,
        modelId: translateModelId
      })

  return {
    cacheKey,
    mode: command.mode,
    polishModelId,
    sourceLanguage,
    sourceText: command.sourceText,
    targetLanguage,
    translateModelId
  }
}

const isCompatibleHistory = (history: TranslateHistory, value: PreparedTranslation): boolean => {
  if (history.cacheKey === value.cacheKey) return true
  if (value.mode !== 'translate' || history.kind !== 'text' || history.modelId !== value.translateModelId) return false

  // A plain request can reuse any polish model, but must retain the translation identity.
  const prefix = `polish-translate:${value.translateModelId}:`
  const suffix = `:${value.sourceLanguage}:${value.targetLanguage}:${normalizeTranslateHistoryText(value.sourceText)}`
  return Boolean(
    history.cacheKey?.startsWith(prefix) &&
    history.cacheKey.endsWith(suffix) &&
    history.cacheKey.length > prefix.length + suffix.length
  )
}

const findCompatibleHistoryBeforeDetection = async (
  command: TranslationPreparationCommand,
  ports: TranslationPreparationPorts,
  signal?: AbortSignal
): Promise<{ history: TranslateHistory; value: PreparedTranslation } | undefined> => {
  if (command.sourceLanguage !== 'auto' || command.mode !== 'translate' || command.forceRefresh) return undefined

  const histories = await ports.findBySourceText(command.sourceText)
  throwIfAborted(signal)
  for (const history of histories) {
    throwIfAborted(signal)
    if (!history.sourceLanguage || !history.targetLanguage || !history.cacheKey) continue

    const target = ports.determineTargetLanguage(
      history.sourceLanguage,
      command.targetLanguage,
      command.isBidirectional,
      command.bidirectionalPair,
      command.nativeLanguage
    )
    if (!target.success || target.language !== history.targetLanguage) continue

    const value = await buildPreparedTranslation(command, ports, history.sourceLanguage, history.targetLanguage, signal)
    if (isCompatibleHistory(history, value)) return { history, value }
  }
  return undefined
}

export const prepareTranslation = async (
  command: TranslationPreparationCommand,
  ports: TranslationPreparationPorts,
  signal?: AbortSignal
): Promise<TranslationPreparationResult> => {
  const compatible = await findCompatibleHistoryBeforeDetection(command, ports, signal)
  if (compatible) return { status: 'cache_hit', ...compatible }

  const sourceLanguage =
    command.sourceLanguage === 'auto' ? await ports.detectLanguage(command.sourceText, signal) : command.sourceLanguage
  throwIfAborted(signal)

  const target = ports.determineTargetLanguage(
    sourceLanguage,
    command.targetLanguage,
    command.isBidirectional && sourceLanguage !== 'unknown',
    command.bidirectionalPair,
    command.sourceLanguage === 'auto' ? command.nativeLanguage : null
  )
  if (!target.success) return { status: target.errorType ?? 'same_language', sourceLanguage }

  const value = await buildPreparedTranslation(command, ports, sourceLanguage, target.language, signal)
  if (!command.forceRefresh) {
    const history = await ports.findCached(value.cacheKey)
    throwIfAborted(signal)
    if (history) return { status: 'cache_hit', history, value }

    if (command.mode === 'translate' && command.sourceLanguage !== 'auto') {
      const histories = await ports.findBySourceText(command.sourceText)
      throwIfAborted(signal)
      const polishedHistory = histories.find((entry) => isCompatibleHistory(entry, value))
      if (polishedHistory) return { status: 'cache_hit', history: polishedHistory, value }
    }
  }

  return { status: 'ready', value }
}

export const executePreparedTranslation = async (
  command: PreparedTranslation,
  ports: TranslationExecutionPorts,
  options: { onProgress?: (progress: TranslationExecutionProgress) => void; signal?: AbortSignal } = {}
): Promise<TranslationExecutionResult | undefined> => {
  let textToTranslate = command.sourceText
  let polishedText: string | undefined

  if (command.mode === 'polish_then_translate') {
    if (!command.polishModelId) throw new Error('A polish model is required for polish-then-translate mode')
    options.onProgress?.({ stage: 'polishing_started' })
    polishedText = await ports.translate({
      text: textToTranslate,
      sourceLanguage: command.sourceLanguage,
      targetLanguage: command.targetLanguage,
      operation: 'polish',
      modelId: command.polishModelId,
      signal: options.signal,
      onUpdate: (content) => options.onProgress?.({ content, stage: 'polishing_update' })
    })
    throwIfAborted(options.signal)
    if (!polishedText) return undefined
    textToTranslate = polishedText
    options.onProgress?.({ content: polishedText, stage: 'polishing_completed' })
  }

  options.onProgress?.({ stage: 'translation_started' })
  const rawText = await ports.translate({
    text: textToTranslate,
    sourceLanguage: command.sourceLanguage,
    targetLanguage: command.targetLanguage,
    operation: 'translate',
    modelId: command.translateModelId,
    signal: options.signal,
    onUpdate: (content) => options.onProgress?.({ content, stage: 'translation_update' })
  })
  throwIfAborted(options.signal)
  if (!rawText) return undefined

  throwIfAborted(options.signal)
  const displayText = ports.postProcess(rawText, command.targetLanguage)
  throwIfAborted(options.signal)
  options.onProgress?.({ displayText, rawText, stage: 'display_ready' })

  let historyError: unknown
  try {
    throwIfAborted(options.signal)
    await ports.saveHistory({
      cacheKey: command.cacheKey,
      modelId: command.translateModelId,
      sourceLanguage: command.sourceLanguage,
      sourceText: command.sourceText,
      targetLanguage: command.targetLanguage,
      targetText: rawText
    })
  } catch (error) {
    throwIfAborted(options.signal)
    historyError = error
  }
  throwIfAborted(options.signal)

  return { displayText, historyError, polishedText, rawText }
}
