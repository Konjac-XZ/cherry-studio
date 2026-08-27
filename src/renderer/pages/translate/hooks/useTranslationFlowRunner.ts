import { loggerService } from '@logger'
import type { useTranslateHistory, UseTranslateResult } from '@renderer/hooks/translate'
import type { useTimer } from '@renderer/hooks/useTimer'
import { toast } from '@renderer/services/toast'
import {
  executePreparedTranslation,
  prepareTranslation,
  type TranslationMode
} from '@renderer/services/translation/TranslationUseCase'
import { formatErrorMessageWithPrefix } from '@renderer/utils/error'
import { determineTargetLanguage, getTranslateModifierLabel, resolveTranslatePlan } from '@renderer/utils/translate'
import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import type { TranslateHistory } from '@shared/data/types/translate'
import type { TFunction } from 'i18next'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef } from 'react'

const logger = loggerService.withContext('TranslatePage/TranslationFlowRunner')

export type TranslateFlowStage =
  | 'idle'
  | 'detecting'
  | 'planning'
  | 'cache'
  | 'polishing'
  | 'translating'
  | 'processing'

type TranslationHistoryPort = Pick<ReturnType<typeof useTranslateHistory>, 'add' | 'findBySourceText' | 'findCached'>

export type TranslationRunOverride = {
  isBidirectional?: boolean
  replaceActive?: boolean
  sourcePreprocessed?: boolean
  sourceLanguage?: TranslateLangCode | 'auto'
  targetLanguage?: TranslateLangCode
}

type UseTranslationFlowRunnerParams = {
  autoCopy: boolean
  bidirectionalPair: [TranslateLangCode, TranslateLangCode]
  cancel: UseTranslateResult['cancel']
  copy: (text: string) => Promise<void>
  detectLanguage: (text: string, signal?: AbortSignal) => Promise<TranslateLangCode>
  flowStage: TranslateFlowStage
  history: TranslationHistoryPort
  isBidirectional: boolean
  isDetecting: boolean
  isTranslating: boolean
  mode: TranslationMode
  nativeLanguage: TranslateLangCode | null
  preprocessTranslation: (text: string) => string
  processTranslation: (raw: string, targetLanguage: TranslateLangCode) => string
  runTranslate: UseTranslateResult['translate']
  selectedModelAvailable: boolean
  setDetectedLanguage: Dispatch<SetStateAction<TranslateLangCode | null>>
  setFlowStage: Dispatch<SetStateAction<TranslateFlowStage>>
  setIsDetecting: (value: boolean) => void
  setOutputTargetLanguage: Dispatch<SetStateAction<TranslateLangCode>>
  setReportedOutputTokens: Dispatch<SetStateAction<number | undefined>>
  setRawOutput: Dispatch<SetStateAction<string>>
  setSourceText: (value: string) => void
  setTranslateOutput: (value: string) => void
  setTimeoutTimer: ReturnType<typeof useTimer>['setTimeoutTimer']
  smoothComplete: (value: string) => Promise<void>
  smoothReset: (value?: string) => void
  sourceLanguage: TranslateLangCode | 'auto'
  sourceText: string
  t: TFunction
  targetLanguage: TranslateLangCode
}

export const useTranslationFlowRunner = ({
  autoCopy,
  bidirectionalPair,
  cancel,
  copy,
  detectLanguage,
  flowStage,
  history,
  isBidirectional,
  isDetecting,
  isTranslating,
  mode,
  nativeLanguage,
  preprocessTranslation,
  processTranslation,
  runTranslate,
  selectedModelAvailable,
  setDetectedLanguage,
  setFlowStage,
  setIsDetecting,
  setOutputTargetLanguage,
  setReportedOutputTokens,
  setRawOutput,
  setSourceText,
  setTranslateOutput,
  setTimeoutTimer,
  smoothComplete,
  smoothReset,
  sourceLanguage,
  sourceText,
  t,
  targetLanguage
}: UseTranslationFlowRunnerParams) => {
  const activeFlowRef = useRef(0)
  const activeFlowControllerRef = useRef<AbortController | null>(null)
  const activeModeRef = useRef<TranslationMode | null>(null)

  useEffect(
    () => () => {
      activeFlowRef.current += 1
      activeFlowControllerRef.current?.abort()
      activeFlowControllerRef.current = null
      cancel()
    },
    [cancel]
  )

  const showCached = useCallback(
    (cached: TranslateHistory, actualTargetLanguage: TranslateLangCode) => {
      const processed = processTranslation(cached.targetText, actualTargetLanguage)
      setRawOutput(cached.targetText)
      setReportedOutputTokens(undefined)
      setOutputTargetLanguage(actualTargetLanguage)
      setTranslateOutput(processed)
      toast.info(t('translate.info.reused_cached', { modifier: getTranslateModifierLabel() }))
    },
    [processTranslation, setOutputTargetLanguage, setRawOutput, setReportedOutputTokens, setTranslateOutput, t]
  )

  const onTranslate = useCallback(
    async (
      forceRefresh = false,
      sourceTextOverride?: string,
      modeOverride?: TranslationMode,
      runOverride: TranslationRunOverride = {}
    ) => {
      const effectiveSourceText = sourceTextOverride ?? sourceText
      const replacingActive = runOverride.replaceActive ?? false
      if (
        !effectiveSourceText.trim() ||
        !selectedModelAvailable ||
        (!replacingActive && (flowStage !== 'idle' || isDetecting || isTranslating))
      )
        return

      const effectiveMode = modeOverride ?? (replacingActive ? activeModeRef.current : null) ?? mode
      const effectiveSourceLanguage = runOverride.sourceLanguage ?? sourceLanguage
      const effectiveTargetLanguage = runOverride.targetLanguage ?? targetLanguage
      const effectiveBidirectional = runOverride.isBidirectional ?? isBidirectional
      const processedSourceText = runOverride.sourcePreprocessed
        ? effectiveSourceText
        : preprocessTranslation(effectiveSourceText)
      if (processedSourceText !== effectiveSourceText) {
        setSourceText(processedSourceText)
      }
      const flowId = activeFlowRef.current + 1
      activeFlowRef.current = flowId
      activeFlowControllerRef.current?.abort()
      const controller = new AbortController()
      activeFlowControllerRef.current = controller
      activeModeRef.current = effectiveMode
      const { signal } = controller
      const isCurrent = () => activeFlowRef.current === flowId

      try {
        if (effectiveSourceLanguage !== 'auto' && sourceLanguage !== 'auto') {
          setDetectedLanguage(null)
        }

        setFlowStage(
          effectiveSourceLanguage === 'auto' && effectiveMode === 'translate' && !forceRefresh
            ? 'cache'
            : effectiveSourceLanguage === 'auto'
              ? 'detecting'
              : 'planning'
        )

        const prepared = await prepareTranslation(
          {
            bidirectionalPair,
            forceRefresh,
            isBidirectional: effectiveBidirectional,
            mode: effectiveMode,
            nativeLanguage,
            sourceLanguage: effectiveSourceLanguage,
            sourceText: processedSourceText,
            targetLanguage: effectiveTargetLanguage
          },
          {
            detectLanguage: async (text, detectionSignal) => {
              setFlowStage('detecting')
              setIsDetecting(true)
              try {
                return await detectLanguage(text, detectionSignal)
              } finally {
                if (isCurrent()) setIsDetecting(false)
              }
            },
            determineTargetLanguage,
            findBySourceText: async (text) => {
              setFlowStage('cache')
              return history.findBySourceText(text)
            },
            findCached: async (cacheKey) => {
              setFlowStage('cache')
              return history.findCached(cacheKey)
            },
            plan: async (actualTargetLanguage, operation) => {
              setFlowStage('planning')
              return resolveTranslatePlan(actualTargetLanguage, operation)
            }
          },
          signal
        )
        if (!isCurrent()) return

        if (prepared.status === 'same_language' || prepared.status === 'not_in_pair') {
          setDetectedLanguage(
            sourceLanguage === 'auto'
              ? effectiveSourceLanguage === 'auto'
                ? prepared.sourceLanguage
                : effectiveSourceLanguage
              : null
          )
          toast.warning(
            t(prepared.status === 'same_language' ? 'translate.language.same' : 'translate.language.not_pair')
          )
          return
        }
        setDetectedLanguage(
          sourceLanguage === 'auto'
            ? effectiveSourceLanguage === 'auto'
              ? prepared.value.sourceLanguage
              : effectiveSourceLanguage
            : null
        )
        if (prepared.status === 'cache_hit') {
          showCached(prepared.history, prepared.value.targetLanguage)
          return
        }

        const result = await executePreparedTranslation(
          prepared.value,
          {
            postProcess: processTranslation,
            saveHistory: async (input) => {
              await history.add(input)
            },
            translate: async ({
              modelId,
              operation,
              sourceLanguage: actualSource,
              targetLanguage: actualTarget,
              text,
              signal: executionSignal
            }) =>
              runTranslate(
                text,
                actualTarget,
                {
                  modelId,
                  operation,
                  sourceLangCode: actualSource,
                  ...(operation === 'translate' && { onOutputTokens: setReportedOutputTokens })
                },
                executionSignal
              )
          },
          {
            onProgress: (progress) => {
              if (!isCurrent()) return
              switch (progress.stage) {
                case 'polishing_started':
                  setFlowStage('polishing')
                  smoothReset('')
                  break
                case 'translation_started':
                  setFlowStage('translating')
                  setReportedOutputTokens(undefined)
                  smoothReset('')
                  break
                case 'display_ready':
                  setFlowStage('processing')
                  break
              }
            },
            signal
          }
        )
        if (!isCurrent() || !result) return

        setRawOutput(result.rawText)
        setOutputTargetLanguage(prepared.value.targetLanguage)
        await smoothComplete(result.displayText)
        if (!isCurrent()) return
        toast.success(t('translate.complete'))

        if (result.historyError) {
          // History failures must not turn a completed translation into a failed run.
          toast.error(t('translate.history.error.add'))
        }

        if (autoCopy) {
          setTimeoutTimer(
            'auto-copy',
            async () => {
              if (!isCurrent()) return
              try {
                await copy(result.displayText)
              } catch (error) {
                logger.error('Failed to auto copy translated text', error as Error)
                toast.error(t('translate.error.auto_copy_failed'))
              }
            },
            100
          )
        }
      } catch (error) {
        if (isCurrent()) {
          logger.error('Translation flow failed', error as Error)
          toast.error(formatErrorMessageWithPrefix(error, t('translate.error.failed')))
        }
      } finally {
        if (isCurrent()) {
          setIsDetecting(false)
          activeFlowControllerRef.current = null
          activeModeRef.current = null
          setFlowStage('idle')
        }
      }
    },
    [
      autoCopy,
      bidirectionalPair,
      copy,
      detectLanguage,
      flowStage,
      history,
      isBidirectional,
      isDetecting,
      isTranslating,
      mode,
      nativeLanguage,
      preprocessTranslation,
      processTranslation,
      runTranslate,
      selectedModelAvailable,
      setDetectedLanguage,
      setFlowStage,
      setIsDetecting,
      setOutputTargetLanguage,
      setReportedOutputTokens,
      setRawOutput,
      setSourceText,
      setTimeoutTimer,
      showCached,
      smoothComplete,
      smoothReset,
      sourceLanguage,
      sourceText,
      t,
      targetLanguage
    ]
  )

  const onAbort = useCallback(() => {
    if (flowStage === 'idle' && !isTranslating && !isDetecting) return
    activeFlowRef.current += 1
    activeFlowControllerRef.current?.abort()
    activeFlowControllerRef.current = null
    cancel()
    setIsDetecting(false)
    setFlowStage('idle')
    toast.info(t('translate.info.aborted'))
  }, [cancel, flowStage, isDetecting, isTranslating, setFlowStage, setIsDetecting, t])

  const abortSilently = useCallback(() => {
    activeFlowRef.current += 1
    activeFlowControllerRef.current?.abort()
    activeFlowControllerRef.current = null
    cancel()
    setIsDetecting(false)
    setFlowStage('idle')
  }, [cancel, setFlowStage, setIsDetecting])

  return { abortSilently, onAbort, onTranslate }
}
