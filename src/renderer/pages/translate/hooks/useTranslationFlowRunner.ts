import { loggerService } from '@logger'
import type { useWorkspaceTranslateHistory } from '@renderer/pages/translate/custom/hooks/useWorkspaceTranslateHistory'
import { toast } from '@renderer/services/toast'
import {
  executePreparedTranslation,
  prepareTranslation,
  type TranslationMode,
  type TranslationWorkspacePdfContext,
  translationWorkspaceService
} from '@renderer/services/translation'
import { formatErrorMessageWithPrefix } from '@renderer/utils/error'
import { determineTargetLanguage, getTranslateModifierLabel, resolveTranslatePlan } from '@renderer/utils/translate'
import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import type { TranslateHistory } from '@shared/data/types/translate'
import type { TFunction } from 'i18next'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useRef } from 'react'

import type { UseWorkspaceTranslateResult } from '../custom/hooks/useWorkspaceTranslate'

const logger = loggerService.withContext('TranslatePage/TranslationFlowRunner')

export type TranslateFlowStage =
  | 'idle'
  | 'detecting'
  | 'planning'
  | 'cache'
  | 'polishing'
  | 'translating'
  | 'processing'

type TranslationHistoryPort = Pick<
  ReturnType<typeof useWorkspaceTranslateHistory>,
  'add' | 'findBySourceText' | 'findCached'
>

export type TranslationRunOverride = {
  isBidirectional?: boolean
  replaceActive?: boolean
  updateSource?: boolean
  sourcePreprocessed?: boolean
  sourceLanguage?: TranslateLangCode | 'auto'
  targetLanguage?: TranslateLangCode
  pdfContext?: TranslationWorkspacePdfContext
}

type UseTranslationFlowRunnerParams = {
  autoCopy: boolean
  bidirectionalPair: [TranslateLangCode, TranslateLangCode]
  cancel: UseWorkspaceTranslateResult['cancel']
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
  runTranslate: UseWorkspaceTranslateResult['translate']
  selectedModelAvailable: boolean
  setDetectedLanguage: Dispatch<SetStateAction<TranslateLangCode | null>>
  setFlowStage: Dispatch<SetStateAction<TranslateFlowStage>>
  setIsDetecting: (value: boolean) => void
  setOutputTargetLanguage: Dispatch<SetStateAction<TranslateLangCode>>
  setReportedOutputTokens: Dispatch<SetStateAction<number | undefined>>
  setRawOutput: Dispatch<SetStateAction<string>>
  setSourceText: (value: string) => void
  setTranslateOutput: (value: string) => void
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
  sourceLanguage,
  sourceText,
  t,
  targetLanguage
}: UseTranslationFlowRunnerParams) => {
  const activeFlowRef = useRef(0)
  const activeFlowControllerRef = useRef<AbortController | null>(null)
  const activeModeRef = useRef<TranslationMode | null>(null)

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
        (!replacingActive &&
          (translationWorkspaceService.isBusy() || flowStage !== 'idle' || isDetecting || isTranslating))
      )
        return

      const effectiveMode = modeOverride ?? (replacingActive ? activeModeRef.current : null) ?? mode
      const effectiveSourceLanguage = runOverride.sourceLanguage ?? sourceLanguage
      const effectiveTargetLanguage = runOverride.targetLanguage ?? targetLanguage
      const effectiveBidirectional = runOverride.isBidirectional ?? isBidirectional
      const workspaceRunId = translationWorkspaceService.begin('text', {
        pdfContext: runOverride.pdfContext,
        sourceText: effectiveSourceText,
        targetLanguage: effectiveTargetLanguage
      })
      const traceTopicId = translationWorkspaceService.getSnapshot().traceTopicId
      const flowId = activeFlowRef.current + 1
      activeFlowRef.current = flowId
      activeFlowControllerRef.current?.abort()
      const controller = new AbortController()
      activeFlowControllerRef.current = controller
      const finishWorkspaceTask = translationWorkspaceService.addTask(controller)
      let workspaceTaskFinished = false
      const finishWorkspace = () => {
        if (workspaceTaskFinished) return
        workspaceTaskFinished = true
        finishWorkspaceTask()
      }
      activeModeRef.current = effectiveMode
      const { signal } = controller
      const isCurrent = () =>
        activeFlowRef.current === flowId && translationWorkspaceService.getSnapshot().runId === workspaceRunId

      try {
        const processedSourceText = runOverride.sourcePreprocessed
          ? effectiveSourceText
          : preprocessTranslation(effectiveSourceText)
        if (runOverride.updateSource || processedSourceText !== effectiveSourceText) setSourceText(processedSourceText)
        if (!processedSourceText.trim()) throw new Error(t('translate.error.empty'))
        if (runOverride.updateSource) {
          setRawOutput('')
          setDetectedLanguage(null)
        }
        translationWorkspaceService.update(workspaceRunId, { sourceText: processedSourceText })
        if (effectiveSourceLanguage !== 'auto' && sourceLanguage !== 'auto') {
          setDetectedLanguage(null)
        }

        const initialStage =
          effectiveSourceLanguage === 'auto' && effectiveMode === 'translate' && !forceRefresh
            ? 'cache'
            : effectiveSourceLanguage === 'auto'
              ? 'detecting'
              : 'planning'
        setFlowStage(initialStage)
        translationWorkspaceService.update(workspaceRunId, { stage: initialStage })

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
              translationWorkspaceService.update(workspaceRunId, { stage: 'detecting' })
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
              translationWorkspaceService.update(workspaceRunId, { stage: 'cache' })
              return history.findBySourceText(text)
            },
            findCached: async (cacheKey) => {
              setFlowStage('cache')
              translationWorkspaceService.update(workspaceRunId, { stage: 'cache' })
              return history.findCached(cacheKey)
            },
            plan: async (actualTargetLanguage, operation) => {
              setFlowStage('planning')
              translationWorkspaceService.update(workspaceRunId, { stage: 'planning' })
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
          translationWorkspaceService.update(workspaceRunId, { status: 'cancelled', stage: 'idle' })
          return
        }
        setDetectedLanguage(
          sourceLanguage === 'auto'
            ? effectiveSourceLanguage === 'auto'
              ? prepared.value.sourceLanguage
              : effectiveSourceLanguage
            : null
        )
        translationWorkspaceService.update(workspaceRunId, {
          detectedLanguage:
            effectiveSourceLanguage === 'auto' ? prepared.value.sourceLanguage : effectiveSourceLanguage,
          targetLanguage: prepared.value.targetLanguage
        })
        if (prepared.status === 'cache_hit') {
          showCached(prepared.history, prepared.value.targetLanguage)
          translationWorkspaceService.complete(workspaceRunId, {
            rawOutput: prepared.history.targetText,
            displayOutput: processTranslation(prepared.history.targetText, prepared.value.targetLanguage)
          })
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
                  traceTopicId,
                  traceId:
                    translationWorkspaceService.getSnapshot().runId === workspaceRunId
                      ? translationWorkspaceService.getSnapshot().traceId
                      : undefined,
                  onTraceReady: (traceId) => translationWorkspaceService.update(workspaceRunId, { traceId }),
                  ...(operation === 'translate' && {
                    onOutputTokens: (outputTokens: number) => {
                      setReportedOutputTokens(outputTokens)
                      translationWorkspaceService.update(workspaceRunId, { outputTokens })
                    }
                  })
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
                  translationWorkspaceService.update(workspaceRunId, { stage: 'polishing', status: 'running' })
                  break
                case 'translation_started':
                  setFlowStage('translating')
                  setRawOutput('')
                  setReportedOutputTokens(undefined)
                  translationWorkspaceService.update(workspaceRunId, {
                    rawOutput: '',
                    stage: 'translating',
                    status: 'running'
                  })
                  break
                case 'display_ready':
                  setFlowStage('processing')
                  translationWorkspaceService.update(workspaceRunId, {
                    rawOutput: progress.rawText,
                    displayOutput: progress.displayText,
                    stage: 'processing',
                    status: 'processing'
                  })
                  break
              }
            },
            signal
          }
        )
        if (!isCurrent()) return
        if (!result) {
          translationWorkspaceService.update(workspaceRunId, { status: 'cancelled', stage: 'idle' })
          return
        }

        setRawOutput(result.rawText)
        setOutputTargetLanguage(prepared.value.targetLanguage)
        translationWorkspaceService.update(workspaceRunId, {
          rawOutput: result.rawText,
          displayOutput: result.displayText,
          historyError: result.historyError
        })
        translationWorkspaceService.complete(workspaceRunId, {
          rawOutput: result.rawText,
          displayOutput: result.displayText,
          historyError: result.historyError
        })
        finishWorkspace()
        if (autoCopy) {
          if (!isCurrent()) return
          try {
            await copy(result.displayText)
          } catch (error) {
            logger.error('Failed to auto copy translated text', error as Error)
            toast.error(t('translate.error.auto_copy_failed'))
          }
        }
        if (!isCurrent()) return
        toast.success(t('translate.complete'))

        if (result.historyError) {
          // History failures must not turn a completed translation into a failed run.
          toast.error(t('translate.history.error.add'))
        }
      } catch (error) {
        if (isCurrent()) {
          if (signal.aborted) return
          translationWorkspaceService.fail(workspaceRunId, error)
          logger.error('Translation flow failed', error as Error)
          toast.error(formatErrorMessageWithPrefix(error, t('translate.error.failed')))
        }
      } finally {
        finishWorkspace()
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
      showCached,
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
