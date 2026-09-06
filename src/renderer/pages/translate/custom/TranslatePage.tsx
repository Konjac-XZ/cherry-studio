import { Avatar, AvatarFallback, Button } from '@cherrystudio/ui'
import { useIcon } from '@cherrystudio/ui/icons'
import { useCache } from '@data/hooks/useCache'
import { useMultiplePreferences, usePreference } from '@data/hooks/usePreference'
import { loggerService } from '@logger'
import { useRightPanelActions, useRightPanelState } from '@renderer/components/chat/panes/Shell'
// Direct `Selector/model` path: the `Selector` barrel re-exports `ModelSelector`
// via a nested `export *`, which tsgo fails to resolve on main's program (it
// resolves fine on feat's full program and via this path). Revert to the barrel
// once main converges with feat. The `Selector` dir is byte-identical to feat.
import { ModelSelector } from '@renderer/components/ModelSelector'
import { Navbar } from '@renderer/components/Navbar'
import TranslateSettings from '@renderer/components/translate/TranslateSettings'
import {
  detectLanguageOrUnknown,
  useDetectLang,
  useTranslateClipboardRead,
  useTranslateClipboardWatch,
  useTranslateClipboardWrite
} from '@renderer/hooks/translate'
import { useCodeStyle } from '@renderer/hooks/useCodeStyle'
import { useModels } from '@renderer/hooks/useModel'
import { useSmoothStream } from '@renderer/hooks/useSmoothStream'
import { useTimer } from '@renderer/hooks/useTimer'
import { ipcApi, useIpcOn } from '@renderer/ipc'
import { useWorkspaceTranslateHistory } from '@renderer/pages/translate/custom/hooks/useWorkspaceTranslateHistory'
import { toast } from '@renderer/services/toast'
import { translationWorkspaceService } from '@renderer/services/translation'
import type { FileMetadata } from '@renderer/types/file'
import { formatErrorMessageWithPrefix } from '@renderer/utils/error'
import { getModelLogoRef } from '@renderer/utils/model'
import { cn } from '@renderer/utils/style'
import {
  applyRegexReplacementRules,
  applyTranslationPostProcessors,
  determineTargetLanguage,
  getTranslateModifierLabel,
  isEquivalentBidirectionalLanguage,
  normalizePersistedTranslateFontSize
} from '@renderer/utils/translate'
import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import {
  BABELDOC_MINIMUM_VERSION,
  BABELDOC_TOOL_NAME,
  getBabelDocInstallationStatus
} from '@shared/data/presets/binaryTools'
import { isUniqueModelId, type Model as SelectorModel, type UniqueModelId } from '@shared/data/types/model'
import type { TranslateHistory } from '@shared/data/types/translate'
import { AbsoluteFilePathSchema } from '@shared/types/file'
import { isGatewayRoutableModel, isNonChatModel } from '@shared/utils/model'
import { isEmpty } from 'es-toolkit/compat'
import {
  CirclePause,
  ClipboardCheck,
  CodeXml,
  Columns2,
  History,
  Languages,
  LoaderCircle,
  Rows2,
  SlidersHorizontal,
  SpellCheck,
  WandSparkles
} from 'lucide-react'
import type { FC, MouseEvent as ReactMouseEvent } from 'react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import DraggableDivider from '../components/DraggableDivider'
import FlipButton from '../components/FlipButton'
import OcrJobWatcher from '../components/OcrJobWatcher'
import PolishTranslateToggleButton from '../components/PolishTranslateToggleButton'
import { TRANSLATE_TRACE_PANE_ID, TranslateRightPane } from '../components/TranslateRightPane'
import TranslateToolbarToggleButton from '../components/TranslateToolbarToggleButton'
import { useTranslateAutoPasteTrigger } from '../hooks/useTranslateAutoPasteTrigger'
import { type TranslateBusyStatus, useTranslateBusyLabel } from '../hooks/useTranslateBusyLabel'
import { useTranslateCounters, useTranslateOutputCounters } from '../hooks/useTranslateCounters'
import { useTranslateFileInput } from '../hooks/useTranslateFileInput'
import { useTranslateInvocationMode } from '../hooks/useTranslateInvocationMode'
import { useTranslateLanguageControls } from '../hooks/useTranslateLanguageControls'
import { useTranslateLayout } from '../hooks/useTranslateLayout'
import { useTranslateToolbarVisibility } from '../hooks/useTranslateToolbarVisibility'
import { type TranslateFlowStage, useTranslationFlowRunner } from '../hooks/useTranslationFlowRunner'
import type {
  BabelDocAvailability,
  PdfTranslationFile,
  PdfTranslationHandle,
  PdfTranslationOutput,
  PdfTranslationStatus
} from '../pdf/PdfTranslationView'
import type { TranslationFiles } from '../translationFiles'
import TranslateHistoryList from './components/TranslateHistory'
import TranslateInputPane from './components/TranslateInputPane'
import TranslateLanguageBar from './components/TranslateLanguageBar'
import TranslateOutputPane from './components/TranslateOutputPane'
import { useWorkspaceTranslate } from './hooks/useWorkspaceTranslate'

const PdfTranslationView = lazy(() => import('../pdf/PdfTranslationView'))

const logger = loggerService.withContext('TranslatePage')

const useBabelDoc = (enabled: boolean) => {
  const { t } = useTranslation()
  const [availability, setAvailability] = useState<BabelDocAvailability>('checking')
  const [installing, setInstalling] = useState(false)
  const [availabilityRevision, setAvailabilityRevision] = useState(0)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    setAvailability('checking')
    void ipcApi
      .request('binary.get_tool_snapshots', [BABELDOC_TOOL_NAME])
      .then((snapshots) => {
        if (!cancelled) setAvailability(getBabelDocInstallationStatus(snapshots[BABELDOC_TOOL_NAME]))
      })
      .catch((error) => {
        if (cancelled) return
        logger.error('Failed to get BabelDOC installation state', error as Error)
        setAvailability('missing')
      })

    return () => {
      cancelled = true
    }
  }, [availabilityRevision, enabled])

  useIpcOn('binary.availability_changed', () => {
    if (enabled) setAvailabilityRevision((revision) => revision + 1)
  })

  const install = useCallback(async () => {
    if (installing) return
    setInstalling(true)
    try {
      await ipcApi.request('binary.install_tool', {
        name: BABELDOC_TOOL_NAME,
        ...(availability === 'outdated' ? { targetVersion: BABELDOC_MINIMUM_VERSION } : {})
      })
      setAvailability('available')
    } catch (error) {
      logger.error('Failed to install BabelDOC', error as Error)
      setAvailability((current) => (current === 'checking' ? 'missing' : current))
      toast.error(formatErrorMessageWithPrefix(error, t('settings.dependencies.installError')))
    } finally {
      setInstalling(false)
    }
  }, [availability, installing, t])

  const refresh = useCallback(() => setAvailabilityRevision((revision) => revision + 1), [])

  return { availability, installing, install, refresh }
}
const getModelInitial = (model: SelectorModel) => model.name.trim().charAt(0) || 'M'

const TranslatePageContent: FC = () => {
  const { t } = useTranslation()
  const rightPanelActions = useRightPanelActions()
  const rightPanelState = useRightPanelState()
  const [translateModelId, setTranslateModelId] = usePreference('feature.translate.model_id')
  const { models, isLoading: modelsLoading } = useModels({ enabled: true })
  const detectLanguage = useDetectLang()
  const translateHistory = useWorkspaceTranslateHistory()
  const { shikiMarkdownIt } = useCodeStyle()
  const { setTimeoutTimer } = useTimer()
  const [sourceLanguage, setSourceLanguage] = usePreference('feature.translate.page.source_language')
  const [targetLanguage, setTargetLanguage] = usePreference('feature.translate.page.target_language')
  const [autoCopy] = usePreference('feature.translate.page.auto_copy')
  const [htmlConversionEnabled, setHtmlConversionEnabled] = usePreference(
    'feature.translate.page.html_conversion_on_paste'
  )
  const [markdownFormattingEnabled] = usePreference('feature.translate.page.format_markdown_on_paste')
  const [bidirectionalPair] = usePreference('feature.translate.page.bidirectional_pair')
  const [nativeLanguage] = usePreference('feature.translate.native_language')
  const [isScrollSyncEnabled] = usePreference('feature.translate.page.scroll_sync')
  const [isBidirectional] = usePreference('feature.translate.page.bidirectional_enabled')
  const [enableMarkdown] = usePreference('feature.translate.page.enable_markdown')
  const [flowSettings, updateFlowSettings] = useMultiplePreferences({
    polishEnabled: 'feature.translate.polish.enabled',
    postProcessingEnabled: 'feature.translate.post_processing.enabled',
    englishStraightQuotes: 'feature.translate.post_processing.english_straight_quotes',
    zhSmartQuotes: 'feature.translate.post_processing.zh_smart_quotes',
    zhTextSpacing: 'feature.translate.post_processing.zh_text_spacing',
    regexRules: 'feature.translate.post_processing.regex_rules',
    jsonStructureView: 'feature.translate.page.json_structure_view',
    jsonCopySeparator: 'feature.translate.page.json_structure_copy_separator',
    jsonCopyBlankLine: 'feature.translate.page.json_structure_copy_blank_line',
    fontSize: 'feature.translate.page.font_size',
    layoutOverride: 'feature.translate.page.layout_override',
    nativeToOtherModelId: 'feature.translate.model.native_to_other_id',
    nativeToOtherFollowsGlobal: 'feature.translate.model.native_to_other_follows_global',
    otherToNativeModelId: 'feature.translate.model.other_to_native_id',
    otherToNativeFollowsGlobal: 'feature.translate.model.other_to_native_follows_global',
    nativeToOtherPrompt: 'feature.translate.prompt.native_to_other',
    otherToNativePrompt: 'feature.translate.prompt.other_to_native',
    polishPrompt: 'feature.translate.prompt.polish'
  })

  const [translateInput, setTranslateInput] = useCache('translate.input')
  const [translateOutput, setTranslateOutput] = useCache('translate.output')
  const [isDetecting, setIsDetecting] = useCache('translate.detecting')

  const {
    complete: smoothComplete,
    reset: smoothReset,
    update: smoothUpdate
  } = useSmoothStream({
    onUpdate: setTranslateOutput
  })
  const onStreamResponse = useCallback((value: string) => smoothUpdate(value, false), [smoothUpdate])

  const {
    translate: runTranslate,
    isTranslating,
    cancel
  } = useWorkspaceTranslate({
    loggerContext: 'TranslatePage',
    rethrowError: true,
    showErrorToast: false,
    onResponse: (value, isComplete) => {
      const snapshot = translationWorkspaceService.getSnapshot()
      translationWorkspaceService.update(snapshot.runId, {
        rawOutput: value,
        status: isComplete ? 'processing' : 'running'
      })
      onStreamResponse(value)
    },
    taskOwner: translationWorkspaceService
  })

  const [renderedMarkdown, setRenderedMarkdown] = useState<string>('')
  const [rawOutput, setRawOutput] = useState(translateOutput)
  const [reportedOutputTokens, setReportedOutputTokens] = useState<number | undefined>()
  const [outputTargetLanguage, setOutputTargetLanguage] = useState<TranslateLangCode>(targetLanguage)
  const [flowStage, setFlowStage] = useState<TranslateFlowStage>('idle')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState<TranslateLangCode | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrJobId, setOcrJobId] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<PdfTranslationFile | null>(null)
  const [restoredPdf, setRestoredPdf] = useState<{ output: PdfTranslationOutput; key: string } | null>(null)
  const [pdfStatus, setPdfStatus] = useState<PdfTranslationStatus>({ phase: 'idle', running: false })
  const [pdfHandleReady, setPdfHandleReady] = useState(false)
  const [pdfTextFallbackActive, setPdfTextFallbackActive] = useState(false)
  const handleSettingsMouseDown = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button === 1) event.preventDefault()
  }, [])
  const handleSettingsAuxClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.button !== 1) return
      event.preventDefault()
      event.stopPropagation()
      if (rightPanelState.isActive(TRANSLATE_TRACE_PANE_ID)) {
        rightPanelActions.close()
        return
      }
      if (!rightPanelActions.tryOpen(TRANSLATE_TRACE_PANE_ID, { userInitiated: true })) return
      setSettingsOpen(false)
      setHistoryOpen(false)
    },
    [rightPanelActions, rightPanelState]
  )
  const [pdfTextOcrRequired, setPdfTextOcrRequired] = useState(false)
  const [isPdfTextExtracting, setIsPdfTextExtracting] = useState(false)
  const workspaceSnapshot = useSyncExternalStore(
    translationWorkspaceService.subscribe,
    translationWorkspaceService.getSnapshot,
    translationWorkspaceService.getSnapshot
  )
  const isOcrRunning = ocrJobId !== null
  const isPdfMode = pdfFile !== null
  const isTranslationRunning = isTranslating || pdfStatus.running
  const babelDoc = useBabelDoc(isPdfMode)
  const { tokenCount, wordCount } = useTranslateCounters({
    input: translateInput,
    nativeLanguage,
    nativeToOtherPrompt: flowSettings.nativeToOtherPrompt,
    otherToNativePrompt: flowSettings.otherToNativePrompt,
    polishEnabled: flowSettings.polishEnabled,
    polishPrompt: flowSettings.polishPrompt,
    targetLanguage
  })
  const { tokenCount: outputTokenCount, wordCount: outputWordCount } = useTranslateOutputCounters(
    translateOutput,
    reportedOutputTokens
  )

  const inputScrollRef = useRef<HTMLDivElement>(null)
  const outputTextRef = useRef<HTMLDivElement>(null)
  const isProgrammaticScroll = useRef(false)
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const forcePlainTextPasteRef = useRef(false)
  const pdfHandleRef = useRef<PdfTranslationHandle | null>(null)
  const pdfTextCacheRef = useRef<{ filePath: string; text: string } | null>(null)
  const pdfTextRequestIdRef = useRef(0)
  const pdfTextFallbackStartedRef = useRef(false)
  const prePdfOutputRef = useRef<string | null>(null)
  const prePdfRawOutputRef = useRef<string | null>(null)
  const rawOutputRef = useRef(rawOutput)
  const translateOutputRef = useRef(translateOutput)
  const preprocessedSourceTextRef = useRef<string | null>(null)
  rawOutputRef.current = rawOutput
  translateOutputRef.current = translateOutput

  const beforeTranslationRegexRules = useMemo(
    () => flowSettings.regexRules.filter((rule) => rule.stage === 'before'),
    [flowSettings.regexRules]
  )
  const afterTranslationRegexRules = useMemo(
    () => flowSettings.regexRules.filter((rule) => rule.stage !== 'before'),
    [flowSettings.regexRules]
  )
  const preprocessTranslation = useCallback(
    (source: string) => applyRegexReplacementRules(source, beforeTranslationRegexRules),
    [beforeTranslationRegexRules]
  )
  const preprocessTranslationForRun = useCallback(
    (source: string) => (preprocessedSourceTextRef.current === source ? source : preprocessTranslation(source)),
    [preprocessTranslation]
  )

  useEffect(() => {
    preprocessedSourceTextRef.current = null
  }, [preprocessTranslation])

  const processTranslation = useCallback(
    (raw: string, actualTargetLanguage: TranslateLangCode) =>
      applyTranslationPostProcessors(raw, {
        enabled: flowSettings.postProcessingEnabled,
        markdownEnabled: enableMarkdown,
        targetLanguage: actualTargetLanguage,
        features: {
          enMarkdownStraightQuotes: flowSettings.englishStraightQuotes,
          zhCnMarkdownSmartQuotes: flowSettings.zhSmartQuotes,
          zhMarkdownTextSpacing: flowSettings.zhTextSpacing
        },
        regexReplacementRules: afterTranslationRegexRules
      }),
    [
      enableMarkdown,
      flowSettings.englishStraightQuotes,
      flowSettings.postProcessingEnabled,
      afterTranslationRegexRules,
      flowSettings.zhSmartQuotes,
      flowSettings.zhTextSpacing
    ]
  )

  const selectedModelId = useMemo(
    () => (translateModelId && isUniqueModelId(translateModelId) ? translateModelId : undefined),
    [translateModelId]
  )

  const modelsById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models])
  const selectedModel = selectedModelId ? modelsById.get(selectedModelId) : undefined
  const effectiveToolbarTargetLanguage = useMemo(() => {
    const effectiveSourceLanguage = sourceLanguage === 'auto' ? detectedLanguage : sourceLanguage
    if (!isBidirectional || !effectiveSourceLanguage) return targetLanguage

    const result = determineTargetLanguage(
      effectiveSourceLanguage,
      targetLanguage,
      true,
      bidirectionalPair,
      nativeLanguage
    )
    return result.success ? result.language : targetLanguage
  }, [bidirectionalPair, detectedLanguage, isBidirectional, nativeLanguage, sourceLanguage, targetLanguage])
  const towardNative = Boolean(
    nativeLanguage && isEquivalentBidirectionalLanguage(effectiveToolbarTargetLanguage, nativeLanguage)
  )
  const directionalModelId = towardNative ? flowSettings.otherToNativeModelId : flowSettings.nativeToOtherModelId
  const directionalModelFollowsGlobal = towardNative
    ? flowSettings.otherToNativeFollowsGlobal
    : flowSettings.nativeToOtherFollowsGlobal
  const effectiveDirectionalModelId =
    !directionalModelFollowsGlobal &&
    directionalModelId &&
    isUniqueModelId(directionalModelId) &&
    modelsById.has(directionalModelId)
      ? directionalModelId
      : selectedModelId
  const isUsingNonGlobalTranslationModel =
    !isPdfMode && Boolean(selectedModelId && effectiveDirectionalModelId !== selectedModelId)
  const isSelectedPdfModelRoutable = !!selectedModel && isGatewayRoutableModel(selectedModel)
  const selectedModelIcon = useIcon(selectedModel ? getModelLogoRef(selectedModel) : undefined)

  const safePersist = useCallback(
    async (persistPromise: Promise<unknown>, actionName: string) => {
      try {
        await persistPromise
      } catch (error) {
        logger.error(`Failed to persist ${actionName}`, error as Error)
        toast.error(t('common.save_failed'))
      }
    },
    [t]
  )

  const appendTranslateInput = useCallback(
    (text: string) => {
      if (isEmpty(text)) return
      preprocessedSourceTextRef.current = null
      // Functional update resolves against the latest stored value, so a prior
      // synchronous setTranslateInput(value) is reflected here without a ref.
      setTranslateInput((prev) => prev + text)
      setDetectedLanguage(null)
    },
    [setTranslateInput]
  )

  const handleInputChange = useCallback(
    (value: string) => {
      preprocessedSourceTextRef.current = null
      setTranslateInput(value)
      setDetectedLanguage(null)
      if (isEmpty(value)) {
        setRawOutput('')
        setTranslateOutput('')
      }
    },
    [setTranslateInput, setTranslateOutput]
  )

  const { readClipboardForTranslate, readClipboardPlainTextForWatch } = useTranslateClipboardRead({
    htmlConversionEnabled,
    markdownFormattingEnabled,
    preprocessText: preprocessTranslation
  })
  const { copied, copy, lastWrittenRef } = useTranslateClipboardWrite()

  const onCopyOutput = useCallback(async () => {
    try {
      await copy(translateOutput)
    } catch (error) {
      logger.error('Failed to copy text to clipboard:', error as Error)
      toast.error(t('common.copy_failed'))
    }
  }, [copy, t, translateOutput])

  const {
    abortSilently: abortTextTranslationSilently,
    onAbort: abortTextTranslation,
    onTranslate: runTextTranslation
  } = useTranslationFlowRunner({
    autoCopy,
    bidirectionalPair,
    cancel,
    copy,
    detectLanguage: (text, signal) =>
      detectLanguageOrUnknown(
        text,
        detectLanguage,
        (error) => {
          logger.error('Failed to detect language', error as Error)
        },
        signal
      ),
    flowStage,
    history: translateHistory,
    isBidirectional,
    isDetecting,
    isTranslating,
    mode: flowSettings.polishEnabled ? 'polish_then_translate' : 'translate',
    nativeLanguage,
    preprocessTranslation: preprocessTranslationForRun,
    processTranslation,
    runTranslate,
    selectedModelAvailable: selectedModelId !== undefined,
    setDetectedLanguage,
    setFlowStage,
    setIsDetecting,
    setOutputTargetLanguage,
    setReportedOutputTokens,
    setRawOutput,
    setSourceText: setTranslateInput,
    setTranslateOutput,
    setTimeoutTimer,
    smoothComplete,
    smoothReset,
    sourceLanguage,
    sourceText: translateInput,
    t,
    targetLanguage
  })

  const {
    handlePrimaryClick,
    trigger: onPrimaryTranslate,
    triggerPolishOnce
  } = useTranslateInvocationMode({
    persistentPolishEnabled: flowSettings.polishEnabled,
    run: runTextTranslation
  })
  const isFlowBusy = flowStage !== 'idle' || isTranslating || isDetecting
  const busyStatus: TranslateBusyStatus | null =
    isDetecting || flowStage === 'detecting'
      ? 'detecting'
      : flowStage === 'polishing'
        ? 'polishing'
        : isFlowBusy || isProcessing
          ? 'processing'
          : null
  const translateBusyLabel = useTranslateBusyLabel(busyStatus)

  const resetPdfMode = useCallback(() => {
    pdfTextRequestIdRef.current += 1
    pdfHandleRef.current = null
    pdfTextCacheRef.current = null
    if (pdfTextFallbackActive || pdfTextFallbackStartedRef.current) abortTextTranslationSilently()
    if (pdfTextFallbackStartedRef.current) {
      const restoredRawOutput = prePdfRawOutputRef.current ?? ''
      rawOutputRef.current = restoredRawOutput
      setRawOutput(restoredRawOutput)
      setTranslateOutput(prePdfOutputRef.current ?? '')
    }
    pdfTextFallbackStartedRef.current = false
    prePdfOutputRef.current = null
    prePdfRawOutputRef.current = null
    setPdfHandleReady(false)
    setPdfStatus({ phase: 'idle', running: false })
    setPdfTextFallbackActive(false)
    setPdfTextOcrRequired(false)
    setIsPdfTextExtracting(false)
    setIsProcessing(false)
    setReportedOutputTokens(undefined)
    setPdfFile(null)
    setRestoredPdf(null)
    // A completed text-fallback run belongs to the PDF workspace that is being
    // closed. Clear its terminal snapshot so a later React render cannot
    // hydrate the discarded PDF output back into the text editor.
    translationWorkspaceService.clearTerminal()
  }, [abortTextTranslationSilently, pdfTextFallbackActive, setTranslateOutput])

  const translatePdfText = useCallback(async () => {
    if (!pdfFile || !selectedModelId || isProcessing || isFlowBusy) return

    const requestId = ++pdfTextRequestIdRef.current
    pdfTextFallbackStartedRef.current = true
    if (prePdfOutputRef.current === null) prePdfOutputRef.current = translateOutput
    setPdfTextFallbackActive(true)
    setPdfTextOcrRequired(false)
    setIsPdfTextExtracting(true)
    setIsProcessing(true)

    try {
      const cached = pdfTextCacheRef.current
      const extractedText =
        cached?.filePath === pdfFile.path ? cached.text : await window.api.file.readExternal(pdfFile.path, true)
      if (pdfTextRequestIdRef.current !== requestId) return
      pdfTextCacheRef.current = { filePath: pdfFile.path, text: extractedText }

      if (!extractedText.trim()) {
        setPdfTextOcrRequired(true)
        return
      }

      await onPrimaryTranslate(undefined, extractedText, { isBidirectional: false })
    } catch (error) {
      if (pdfTextRequestIdRef.current !== requestId) return
      logger.error('Failed to extract PDF text', error as Error)
      setPdfTextFallbackActive(false)
      toast.error(formatErrorMessageWithPrefix(error, t('translate.files.error.unknown')))
    } finally {
      if (pdfTextRequestIdRef.current === requestId) {
        setIsPdfTextExtracting(false)
        setIsProcessing(false)
      }
    }
  }, [isFlowBusy, isProcessing, onPrimaryTranslate, pdfFile, selectedModelId, t, translateOutput])

  const onTranslate = useCallback(async () => {
    if (!pdfFile) {
      await onPrimaryTranslate()
      return
    }
    if (babelDoc.availability === 'checking' || babelDoc.installing || targetLanguage === 'unknown') return
    if (babelDoc.availability === 'available') {
      if (!isSelectedPdfModelRoutable || pdfStatus.running) return
      const targetResult = determineTargetLanguage(sourceLanguage, targetLanguage, false, bidirectionalPair)
      if (!targetResult.success) {
        toast.warning(
          targetResult.errorType === 'same_language' ? t('translate.language.same') : t('translate.language.not_pair')
        )
        return
      }
      pdfHandleRef.current?.start(targetLanguage)
      return
    }
    await translatePdfText()
  }, [
    babelDoc.availability,
    babelDoc.installing,
    bidirectionalPair,
    isSelectedPdfModelRoutable,
    onPrimaryTranslate,
    pdfFile,
    pdfStatus.running,
    sourceLanguage,
    t,
    targetLanguage,
    translatePdfText
  ])

  const onAbort = useCallback(() => {
    if (pdfStatus.running) {
      pdfHandleRef.current?.cancel()
      toast.info(t('translate.info.aborted'))
      return
    }
    if (pdfTextFallbackActive) {
      pdfTextRequestIdRef.current += 1
      setIsPdfTextExtracting(false)
      setIsProcessing(false)
    }
    abortTextTranslation()
  }, [abortTextTranslation, pdfStatus.running, pdfTextFallbackActive, t])

  useTranslateAutoPasteTrigger({
    notReadyReason: modelsLoading ? 'models-loading' : 'model-unavailable',
    readClipboardForTranslate,
    ready: !modelsLoading && selectedModelId !== undefined,
    trigger: onPrimaryTranslate
  })

  const { couldExchange, couldFlip, handleExchange, handleFlip } = useTranslateLanguageControls({
    bidirectionalPair,
    busy: isFlowBusy || isProcessing || isOcrRunning,
    detectedLanguage,
    input: translateInput,
    isBidirectional,
    nativeLanguage,
    output: translateOutput,
    persistLanguages: (nextSource, nextTarget) => {
      void safePersist(
        Promise.all([setSourceLanguage(nextSource), setTargetLanguage(nextTarget)]),
        'translate exchanged languages'
      )
    },
    persistTargetLanguage: (nextTarget) => {
      void safePersist(setTargetLanguage(nextTarget), 'translate flipped target language')
    },
    runTranslation: runTextTranslation,
    setDetectedLanguage,
    setInput: setTranslateInput,
    setOutput: setTranslateOutput,
    setOutputTargetLanguage,
    setRawOutput,
    sourceLanguage,
    targetLanguage
  })

  const clipboardWatch = useTranslateClipboardWatch({
    busy: flowStage !== 'idle' || isDetecting || isTranslating || isProcessing || isOcrRunning,
    lastWrittenRef,
    readClipboardForTranslate,
    readClipboardPlainTextForWatch,
    onText: async (text) => {
      if (translationWorkspaceService.isBusy()) return false
      await onPrimaryTranslate(undefined, text, { sourcePreprocessed: true, updateSource: true })
      return true
    }
  })

  const onHistoryItemClick = useCallback(
    (history: TranslateHistory, files?: TranslationFiles) => {
      const historyTarget = history.targetLanguage ?? targetLanguage
      if (history.kind === 'file' && (!files?.source?.path || !files.target?.path)) {
        toast.error(t('translate.history.file.unavailable'))
        return
      }
      const restoredText = history.kind === 'text' ? processTranslation(history.targetText, historyTarget) : ''
      abortTextTranslationSilently()
      setOcrJobId(null)
      smoothReset('')

      if (history.kind === 'file' && files?.source?.path && files.target?.path) {
        resetPdfMode()
        setRestoredPdf({ output: { outputPath: files.target.path, fileName: history.targetText }, key: history.id })
        setPdfFile({ name: history.sourceText, path: files.source.path })
      } else {
        resetPdfMode()
        setTranslateInput(history.sourceText)
        setRawOutput(history.targetText)
        setReportedOutputTokens(undefined)
        setOutputTargetLanguage(historyTarget)
        smoothReset(restoredText)
      }

      setDetectedLanguage(null)
      setHistoryOpen(false)
    },
    [
      abortTextTranslationSilently,
      processTranslation,
      resetPdfMode,
      setReportedOutputTokens,
      setTranslateInput,
      smoothReset,
      t,
      targetLanguage
    ]
  )

  useEffect(() => {
    if (isTranslating || flowStage !== 'idle') return
    if (rawOutput !== rawOutputRef.current) return
    if (rawOutput) setTranslateOutput(processTranslation(rawOutput, outputTargetLanguage))
  }, [flowStage, isTranslating, outputTargetLanguage, processTranslation, rawOutput, setTranslateOutput])

  const appliedWorkspaceRevisionRef = useRef<number | null>(null)
  useEffect(() => {
    if (appliedWorkspaceRevisionRef.current === workspaceSnapshot.revision) return
    appliedWorkspaceRevisionRef.current = workspaceSnapshot.revision
    if (workspaceSnapshot.kind !== 'text' || workspaceSnapshot.runId === 0) return
    if (workspaceSnapshot.detectedLanguage) setDetectedLanguage(workspaceSnapshot.detectedLanguage)
    if (workspaceSnapshot.targetLanguage && workspaceSnapshot.targetLanguage !== 'unknown') {
      setOutputTargetLanguage(workspaceSnapshot.targetLanguage)
    }
    if (workspaceSnapshot.rawOutput) setRawOutput(workspaceSnapshot.rawOutput)

    if (workspaceSnapshot.status === 'success' && workspaceSnapshot.displayOutput) {
      smoothReset(workspaceSnapshot.displayOutput)
      setTranslateOutput(workspaceSnapshot.displayOutput)
      setFlowStage('idle')
      setIsDetecting(false)
    } else if (workspaceSnapshot.status === 'cancelled' || workspaceSnapshot.status === 'error') {
      setRawOutput(workspaceSnapshot.rawOutput)
      smoothReset(workspaceSnapshot.rawOutput)
      setFlowStage('idle')
      setIsDetecting(false)
    }
  }, [setIsDetecting, setTranslateOutput, smoothReset, workspaceSnapshot])

  const { cycleLayout, inputScrollHandler, isVerticalLayout, outputScrollHandler, panelSize, setPanelSize } =
    useTranslateLayout({
      inputScrollRef,
      isProgrammaticScroll,
      isScrollSyncEnabled,
      layoutOverride: flowSettings.layoutOverride,
      onLayoutOverrideChange: (layoutOverride) =>
        void safePersist(updateFlowSettings({ layoutOverride }), 'translate layout override'),
      outputScrollRef: outputTextRef
    })

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      if (!enableMarkdown || !translateOutput) {
        setRenderedMarkdown('')
        return
      }
      const markdown = await shikiMarkdownIt(translateOutput)
      if (!cancelled) {
        setRenderedMarkdown(markdown)
      }
    }
    void render()
    return () => {
      cancelled = true
    }
  }, [enableMarkdown, shikiMarkdownIt, translateOutput])

  const modelSelectorFilter = useCallback(
    (model: SelectorModel) =>
      !isNonChatModel(model) && (!isPdfMode || babelDoc.availability === 'missing' || isGatewayRoutableModel(model)),
    [babelDoc.availability, isPdfMode]
  )

  const handleModelIdSelect = useCallback(
    (modelId: UniqueModelId | undefined) => {
      void safePersist(setTranslateModelId(modelId ?? null), 'translate model id')
    },
    [safePersist, setTranslateModelId]
  )

  // V2 File Processing owns OCR execution. Translate only tracks the job id;
  // dismissing the overlay intentionally fences a late result rather than
  // pretending that the backend job itself was cancelled.
  const clearOcrJob = useCallback((jobId: string) => {
    const snapshot = translationWorkspaceService.getSnapshot()
    if (snapshot.kind === 'ocr' && snapshot.jobId === jobId && snapshot.status === 'running') {
      translationWorkspaceService.failOcr(jobId, new Error('OCR job did not produce text'))
    }
    setOcrJobId(null)
  }, [])
  const handleOcrStarted = useCallback((jobId: string) => {
    translationWorkspaceService.beginOcr(jobId)
    setOcrJobId(jobId)
  }, [])
  const cancelOcrJob = useCallback(() => {
    translationWorkspaceService.cancel()
    setOcrJobId(null)
  }, [])
  const handleOcrCompleted = useCallback(
    (jobId: string, text: string) => {
      translationWorkspaceService.completeOcr(jobId, text)
      appendTranslateInput(text)
    },
    [appendTranslateInput]
  )

  const handlePdfSelected = useCallback(
    (file: FileMetadata) => {
      pdfTextRequestIdRef.current += 1
      pdfTextCacheRef.current = null
      pdfTextFallbackStartedRef.current = false
      prePdfOutputRef.current = translateOutputRef.current
      prePdfRawOutputRef.current = rawOutput
      setPdfHandleReady(false)
      setPdfStatus({ phase: 'idle', running: false })
      setPdfTextFallbackActive(false)
      setPdfTextOcrRequired(false)
      setIsPdfTextExtracting(false)
      setRestoredPdf(null)
      setPdfFile({ name: file.name, path: AbsoluteFilePathSchema.parse(file.path) })
    },
    [rawOutput]
  )

  const {
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleSelectFile,
    onDrop,
    onPaste,
    preventDrop,
    selecting
  } = useTranslateFileInput({
    appendText: appendTranslateInput,
    forcePlainTextPasteRef,
    htmlConversionEnabled,
    markdownFormattingEnabled,
    isTextPreprocessed: (text) => preprocessedSourceTextRef.current === text,
    onTextPreprocessed: (text) => {
      preprocessedSourceTextRef.current = text
    },
    preprocessText: preprocessTranslation,
    isOcrRunning,
    isProcessing,
    isTranslating,
    onOcrStarted: handleOcrStarted,
    onPdfSelected: handlePdfSelected,
    setIsProcessing,
    setText: (value) => {
      setDetectedLanguage(null)
      setTranslateInput(value)
    }
  })

  const handlePdfHandleChange = useCallback((handle: PdfTranslationHandle | null) => {
    pdfHandleRef.current = handle
    setPdfHandleReady(handle !== null)
  }, [])
  const handlePdfStatusChange = useCallback((status: PdfTranslationStatus) => setPdfStatus(status), [])
  const pdfModelReady =
    babelDoc.availability === 'available'
      ? pdfHandleReady && isSelectedPdfModelRoutable
      : babelDoc.availability === 'missing' && !!selectedModelId
  const couldTranslate = isPdfMode
    ? pdfModelReady &&
      !babelDoc.installing &&
      targetLanguage !== 'unknown' &&
      !pdfStatus.running &&
      !isFlowBusy &&
      !isProcessing
    : !isEmpty(translateInput) && !!selectedModelId && !isFlowBusy && !isProcessing && !isOcrRunning
  const { compact: compactToolbar, toolbarRef } = useTranslateToolbarVisibility()
  const layoutLabel =
    flowSettings.layoutOverride === 'auto'
      ? t('translate.settings.layout.auto')
      : flowSettings.layoutOverride === 'vertical'
        ? t('translate.settings.layout.vertical')
        : t('translate.settings.layout.horizontal')

  return (
    <div className="flex h-full min-w-0 overflow-hidden bg-background">
      <div
        data-ui="translate.view"
        className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={preventDrop}>
        {ocrJobId && (
          <OcrJobWatcher
            key={ocrJobId}
            jobId={ocrJobId}
            onCompleted={(text) => handleOcrCompleted(ocrJobId, text)}
            onSettled={clearOcrJob}
          />
        )}
        <Navbar />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          <div ref={toolbarRef} className="flex shrink-0 items-center justify-between gap-1.5 px-3 pt-3 pb-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={cycleLayout}
                aria-label={layoutLabel}
                title={layoutLabel}
                className="size-8">
                {flowSettings.layoutOverride === 'auto' ? (
                  <SpellCheck size={16} />
                ) : isVerticalLayout ? (
                  <Rows2 size={16} />
                ) : (
                  <Columns2 size={16} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  'size-8',
                  historyOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => {
                  setHistoryOpen((open) => !open)
                  setSettingsOpen(false)
                }}
                aria-label={t('translate.history.title')}
                aria-pressed={historyOpen}>
                <History size={18} />
              </Button>
              {!compactToolbar && (
                <TranslateLanguageBar
                  className="px-0 py-0 lg:px-0"
                  sourceLanguage={sourceLanguage}
                  onSourceChange={(language) => {
                    setDetectedLanguage(null)
                    void safePersist(setSourceLanguage(language), 'translate source language')
                  }}
                  targetLanguage={targetLanguage}
                  onTargetChange={(language) =>
                    void safePersist(setTargetLanguage(language), 'translate target language')
                  }
                  detectedLanguage={detectedLanguage}
                  isBidirectional={isPdfMode ? false : isBidirectional}
                  bidirectionalPair={bidirectionalPair}
                  disabled={isFlowBusy || isProcessing || isOcrRunning}
                  couldExchange={couldExchange}
                  onExchange={handleExchange}
                />
              )}
              {!compactToolbar && <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border-subtle" />}
              <div className="flex shrink-0 items-center gap-1.5">
                {isTranslationRunning || isFlowBusy ? (
                  <button
                    type="button"
                    onClick={onAbort}
                    className="flex h-8 items-center gap-1.5 rounded-md bg-secondary px-3 text-secondary-foreground text-sm transition-all hover:bg-secondary-hover focus-visible:bg-secondary-hover focus-visible:outline-none">
                    <CirclePause size={14} className="lucide-custom" />
                    <span>{t('common.stop')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => void (isPdfMode ? onTranslate() : handlePrimaryClick(event))}
                    disabled={!couldTranslate}
                    title={t('translate.tooltip.force_refresh', { modifier: getTranslateModifierLabel() })}
                    className={cn(
                      'flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-all focus-visible:outline-none',
                      couldTranslate
                        ? 'bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:bg-neutral-800'
                        : 'cursor-not-allowed bg-muted text-foreground-disabled'
                    )}>
                    <Languages size={16} className="lucide-custom" />
                    <span>{t('translate.button.translate')}</span>
                  </button>
                )}
                <FlipButton couldFlip={!isPdfMode && couldFlip} onFlip={() => void handleFlip()} />
                <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border-subtle" />
                <PolishTranslateToggleButton
                  enabled={flowSettings.polishEnabled}
                  disabled={isPdfMode || isFlowBusy || isProcessing || isOcrRunning}
                  onToggle={() =>
                    void safePersist(
                      updateFlowSettings({ polishEnabled: !flowSettings.polishEnabled }),
                      'translate polish enabled'
                    )
                  }
                  onTranslateOnce={() => void triggerPolishOnce()}
                />
                <TranslateToolbarToggleButton
                  enabled={clipboardWatch.enabled}
                  tone="clipboardWatch"
                  size="icon-sm"
                  onClick={clipboardWatch.toggle}
                  aria-label={t('translate.clipboard_watch')}>
                  <ClipboardCheck size={16} />
                </TranslateToolbarToggleButton>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <ModelSelector
                multiple={false}
                selectionType="id"
                value={selectedModelId}
                onSelect={handleModelIdSelect}
                filter={modelSelectorFilter}
                showTagFilter={false}
                showPinnedModels
                align="end"
                selectedItemScrollAlign="center"
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={selectedModel?.name ?? t('translate.settings.model_placeholder')}
                    title={selectedModel?.name ?? t('translate.settings.model_placeholder')}
                    className={cn(
                      'size-8 rounded-full p-0 shadow-none hover:bg-accent',
                      isUsingNonGlobalTranslationModel && 'saturate-0'
                    )}>
                    {selectedModel ? (
                      selectedModelIcon ? (
                        <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full">
                          <selectedModelIcon.Avatar size={24} />
                        </span>
                      ) : (
                        <Avatar className="size-6 rounded-full">
                          <AvatarFallback className="text-[11px]">{getModelInitial(selectedModel)}</AvatarFallback>
                        </Avatar>
                      )
                    ) : (
                      <Avatar className="size-6 rounded-full">
                        <AvatarFallback className="text-[11px]">M</AvatarFallback>
                      </Avatar>
                    )}
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  'size-8',
                  settingsOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                onMouseDown={handleSettingsMouseDown}
                onAuxClick={handleSettingsAuxClick}
                onClick={() =>
                  setSettingsOpen((open) => {
                    const next = !open
                    if (next) setHistoryOpen(false)
                    return next
                  })
                }
                aria-label={t('translate.settings.title')}
                aria-pressed={settingsOpen}>
                <SlidersHorizontal size={18} />
              </Button>
              <TranslateToolbarToggleButton
                enabled={flowSettings.postProcessingEnabled}
                tone="postProcessing"
                size="icon-sm"
                onClick={() =>
                  void safePersist(
                    updateFlowSettings({ postProcessingEnabled: !flowSettings.postProcessingEnabled }),
                    'translate post-processing enabled'
                  )
                }
                aria-label={t('translate.post_processing.enable')}>
                <WandSparkles size={16} />
              </TranslateToolbarToggleButton>
              <TranslateToolbarToggleButton
                enabled={htmlConversionEnabled}
                tone="htmlConversion"
                size="icon-sm"
                onClick={() =>
                  void safePersist(setHtmlConversionEnabled(!htmlConversionEnabled), 'HTML conversion on paste')
                }
                aria-label={t('translate.html_conversion')}>
                <CodeXml size={16} />
              </TranslateToolbarToggleButton>
            </div>
          </div>

          {pdfFile ? (
            <Suspense
              fallback={
                <div className="flex min-h-0 flex-1 items-center justify-center" aria-busy="true">
                  <LoaderCircle size={20} className="animate-spin text-foreground-muted" />
                </div>
              }>
              <PdfTranslationView
                key={restoredPdf?.key ?? pdfFile.path}
                file={pdfFile}
                restoredOutput={restoredPdf?.output}
                modelId={isSelectedPdfModelRoutable ? selectedModelId : undefined}
                sourceLangCode={sourceLanguage}
                babelDocAvailability={babelDoc.availability}
                babelDocInstalling={babelDoc.installing}
                textFallback={
                  pdfTextFallbackActive
                    ? {
                        ocrRequired: pdfTextOcrRequired,
                        content: (
                          <TranslateOutputPane
                            ref={outputTextRef}
                            translatedContent={translateOutput}
                            renderedMarkdown={renderedMarkdown}
                            enableMarkdown={enableMarkdown}
                            enableJsonStructure={flowSettings.jsonStructureView}
                            jsonStructureCopySeparator={flowSettings.jsonCopySeparator}
                            jsonStructureCopyBlankLineBetweenRows={flowSettings.jsonCopyBlankLine}
                            translating={isFlowBusy || isPdfTextExtracting}
                            fontSize={normalizePersistedTranslateFontSize(flowSettings.fontSize)}
                            copied={copied}
                            onCopy={onCopyOutput}
                            onScroll={outputScrollHandler}
                            tokenCount={outputTokenCount}
                            wordCount={outputWordCount}
                          />
                        )
                      }
                    : undefined
                }
                onClose={resetPdfMode}
                onHandleChange={handlePdfHandleChange}
                onStatusChange={handlePdfStatusChange}
                onInstallBabelDoc={() => void babelDoc.install()}
                onBabelDocUnavailable={babelDoc.refresh}
              />
            </Suspense>
          ) : (
            <div
              ref={paneContainerRef}
              className="grid min-h-0 flex-1 gap-0 overflow-hidden px-3 pt-1.5 pb-3 [--translate-pane-min-width:320px] max-[600px]:[--translate-pane-min-width:250px] max-[800px]:[--translate-pane-min-width:280px]"
              style={
                isVerticalLayout
                  ? {
                      gridTemplateRows: `minmax(200px, ${panelSize}%) 6px minmax(200px, 1fr)`,
                      gridTemplateColumns: 'minmax(0, 1fr)'
                    }
                  : {
                      gridTemplateColumns: `minmax(var(--translate-pane-min-width), ${panelSize}%) 6px minmax(var(--translate-pane-min-width), 1fr)`,
                      gridTemplateRows: 'minmax(0, 1fr)'
                    }
              }>
              <section className="flex min-h-0 min-w-0 flex-col">
                <TranslateInputPane
                  ref={inputScrollRef}
                  text={translateInput}
                  onTextChange={handleInputChange}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'v') {
                      forcePlainTextPasteRef.current = true
                      return
                    }
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault()
                      void onPrimaryTranslate()
                    }
                  }}
                  onScroll={inputScrollHandler}
                  onPaste={onPaste}
                  onDrop={onDrop}
                  onSelectFile={handleSelectFile}
                  onPasteFromClipboard={readClipboardForTranslate}
                  onCancelOcr={cancelOcrJob}
                  disabled={isTranslating || isDetecting || isProcessing || isOcrRunning}
                  ocrProcessing={isOcrRunning}
                  selecting={selecting}
                  busyLabel={translateBusyLabel}
                  fontSize={normalizePersistedTranslateFontSize(flowSettings.fontSize)}
                  tokenCount={tokenCount}
                  wordCount={wordCount}
                />
              </section>

              <DraggableDivider
                containerRef={paneContainerRef}
                vertical={isVerticalLayout}
                value={panelSize}
                onChange={setPanelSize}
              />

              <section className="flex min-h-0 min-w-0 flex-col">
                <TranslateOutputPane
                  ref={outputTextRef}
                  translatedContent={translateOutput}
                  renderedMarkdown={renderedMarkdown}
                  enableMarkdown={enableMarkdown}
                  enableJsonStructure={flowSettings.jsonStructureView}
                  jsonStructureCopySeparator={flowSettings.jsonCopySeparator}
                  jsonStructureCopyBlankLineBetweenRows={flowSettings.jsonCopyBlankLine}
                  translating={isFlowBusy}
                  fontSize={normalizePersistedTranslateFontSize(flowSettings.fontSize)}
                  copied={copied}
                  onCopy={onCopyOutput}
                  onScroll={outputScrollHandler}
                  tokenCount={outputTokenCount}
                  wordCount={outputWordCount}
                />
              </section>
            </div>
          )}
          <TranslateHistoryList
            isOpen={historyOpen}
            onClose={() => setHistoryOpen(false)}
            onHistoryItemClick={onHistoryItemClick}
          />
          <TranslateSettings visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </div>
      <TranslateRightPane.Viewport />
    </div>
  )
}

const TranslatePage: FC = () => (
  <TranslateRightPane.Scope>
    <TranslatePageContent />
  </TranslateRightPane.Scope>
)

export default TranslatePage
