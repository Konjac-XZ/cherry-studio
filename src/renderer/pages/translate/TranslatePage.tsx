import { Avatar, AvatarFallback, Button } from '@cherrystudio/ui'
import { useIcon } from '@cherrystudio/ui/icons'
import { useCache } from '@data/hooks/useCache'
import { useMultiplePreferences, usePreference } from '@data/hooks/usePreference'
import { loggerService } from '@logger'
// Direct `Selector/model` path: the `Selector` barrel re-exports `ModelSelector`
// via a nested `export *`, which tsgo fails to resolve on main's program (it
// resolves fine on feat's full program and via this path). Revert to the barrel
// once main converges with feat. The `Selector` dir is byte-identical to feat.
import { ModelSelector } from '@renderer/components/ModelSelector'
import { Navbar } from '@renderer/components/Navbar'
import {
  detectLanguageOrUnknown,
  useDetectLang,
  useTranslate,
  useTranslateClipboardRead,
  useTranslateClipboardWatch,
  useTranslateClipboardWrite,
  useTranslateHistory
} from '@renderer/hooks/translate'
import { useCodeStyle } from '@renderer/hooks/useCodeStyle'
import { useModels } from '@renderer/hooks/useModel'
import { useNotesSettings } from '@renderer/hooks/useNotesSettings'
import { useSmoothStream } from '@renderer/hooks/useSmoothStream'
import { useTimer } from '@renderer/hooks/useTimer'
import { exportContentToNotes } from '@renderer/services/ExportService'
import { toast } from '@renderer/services/toast'
import { getModelLogoRef } from '@renderer/utils/model'
import { cn } from '@renderer/utils/style'
import {
  applyTranslationPostProcessors,
  getTranslateModifierLabel,
  normalizePersistedTranslateFontSize
} from '@renderer/utils/translate'
import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import { isUniqueModelId, type Model as SelectorModel, type UniqueModelId } from '@shared/data/types/model'
import type { TranslateHistory } from '@shared/data/types/translate'
import { isNonChatModel } from '@shared/utils/model'
import { isEmpty } from 'es-toolkit/compat'
import {
  CirclePause,
  ClipboardCheck,
  ClipboardCopy,
  Columns2,
  History,
  Languages,
  Rows2,
  SlidersHorizontal
} from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import DraggableDivider from './components/DraggableDivider'
import FlipButton from './components/FlipButton'
import OcrJobWatcher from './components/OcrJobWatcher'
import PolishTranslateToggleButton from './components/PolishTranslateToggleButton'
import TranslateHistoryList from './components/TranslateHistory'
import TranslateInputPane from './components/TranslateInputPane'
import TranslateLanguageBar from './components/TranslateLanguageBar'
import TranslateOutputPane from './components/TranslateOutputPane'
import { useTranslateAutoPasteTrigger } from './hooks/useTranslateAutoPasteTrigger'
import { useTranslateCounters } from './hooks/useTranslateCounters'
import { useTranslateFileInput } from './hooks/useTranslateFileInput'
import { useTranslateInvocationMode } from './hooks/useTranslateInvocationMode'
import { useTranslateLanguageControls } from './hooks/useTranslateLanguageControls'
import { useTranslateLayout } from './hooks/useTranslateLayout'
import { useTranslateToolbarVisibility } from './hooks/useTranslateToolbarVisibility'
import { type TranslateFlowStage, useTranslationFlowRunner } from './hooks/useTranslationFlowRunner'
import TranslateSettings from './TranslateSettings'

const logger = loggerService.withContext('TranslatePage')
const PRIORITIZED_PROVIDER_IDS = ['cherryai', 'openai', 'anthropic', 'google', 'gemini', 'openrouter']
const TRANSLATION_RESULT_TITLE_MAX_LENGTH = 80
const getModelInitial = (model: SelectorModel) => model.name.trim().charAt(0) || 'M'

const getTitleFromTranslationResult = (translationResult: string) =>
  translationResult.trim().split(/\r?\n/, 1)[0].slice(0, TRANSLATION_RESULT_TITLE_MAX_LENGTH)

const TranslatePage: FC = () => {
  const { t } = useTranslation()
  const [translateModelId, setTranslateModelId] = usePreference('feature.translate.model_id')
  const { models, isLoading: modelsLoading } = useModels({ enabled: true })
  const detectLanguage = useDetectLang()
  const translateHistory = useTranslateHistory()
  const { notesPath } = useNotesSettings()
  const { shikiMarkdownIt } = useCodeStyle()
  const { setTimeoutTimer } = useTimer()
  const [sourceLanguage, setSourceLanguage] = usePreference('feature.translate.page.source_language')
  const [targetLanguage, setTargetLanguage] = usePreference('feature.translate.page.target_language')
  const [autoCopy] = usePreference('feature.translate.page.auto_copy')
  const [htmlConversionEnabled, setHtmlConversionEnabled] = usePreference(
    'feature.translate.page.html_conversion_on_paste'
  )
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
    nativeToOtherPrompt: 'feature.translate.prompt.native_to_other',
    otherToNativePrompt: 'feature.translate.prompt.other_to_native',
    polishPrompt: 'feature.translate.prompt.polish'
  })

  const [translateInput, setTranslateInput] = useCache('translate.input')
  const [translateOutput, setTranslateOutput] = useCache('translate.output')
  const [isDetecting, setIsDetecting] = useCache('translate.detecting')

  const { reset: smoothReset, update: smoothUpdate } = useSmoothStream({ onUpdate: setTranslateOutput })

  const {
    translate: runTranslate,
    isTranslating,
    cancel
  } = useTranslate({
    loggerContext: 'TranslatePage',
    onResponse: smoothUpdate
  })

  const [renderedMarkdown, setRenderedMarkdown] = useState<string>('')
  const [rawOutput, setRawOutput] = useState(translateOutput)
  const [outputTargetLanguage, setOutputTargetLanguage] = useState<TranslateLangCode>(targetLanguage)
  const [flowStage, setFlowStage] = useState<TranslateFlowStage>('idle')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState<TranslateLangCode | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrJobId, setOcrJobId] = useState<string | null>(null)
  const isOcrRunning = ocrJobId !== null
  const { tokenCount, wordCount } = useTranslateCounters({
    input: translateInput,
    nativeLanguage,
    nativeToOtherPrompt: flowSettings.nativeToOtherPrompt,
    otherToNativePrompt: flowSettings.otherToNativePrompt,
    polishEnabled: flowSettings.polishEnabled,
    polishPrompt: flowSettings.polishPrompt,
    targetLanguage
  })

  const inputScrollRef = useRef<HTMLDivElement>(null)
  const outputTextRef = useRef<HTMLDivElement>(null)
  const isProgrammaticScroll = useRef(false)
  const paneContainerRef = useRef<HTMLDivElement>(null)
  const forcePlainTextPasteRef = useRef(false)

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
        regexReplacementRules: flowSettings.regexRules
      }),
    [
      enableMarkdown,
      flowSettings.englishStraightQuotes,
      flowSettings.postProcessingEnabled,
      flowSettings.regexRules,
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
      // Functional update resolves against the latest stored value, so a prior
      // synchronous setTranslateInput(value) is reflected here without a ref.
      setTranslateInput((prev) => prev + text)
    },
    [setTranslateInput]
  )

  const handleInputChange = useCallback(
    (value: string) => {
      setTranslateInput(value)
      if (isEmpty(value)) {
        setRawOutput('')
        setTranslateOutput('')
      }
    },
    [setTranslateInput, setTranslateOutput]
  )

  const { readClipboardForTranslate, readClipboardPlainTextForWatch } = useTranslateClipboardRead({
    htmlConversionEnabled
  })
  const { copied, copy, lastWrittenRef } = useTranslateClipboardWrite()

  const onCopyInput = useCallback(async () => {
    if (!translateInput) return
    try {
      await copy(translateInput)
    } catch (error) {
      logger.error('Failed to copy source text:', error as Error)
      toast.error(t('common.copy_failed'))
    }
  }, [copy, t, translateInput])

  const onCopyOutput = useCallback(async () => {
    try {
      await copy(translateOutput)
    } catch (error) {
      logger.error('Failed to copy text to clipboard:', error as Error)
      toast.error(t('common.copy_failed'))
    }
  }, [copy, t, translateOutput])

  const onExportOutputToNotes = useCallback(() => {
    const translationResult = translateOutput.trim()
    if (!translationResult) return

    void exportContentToNotes(getTitleFromTranslationResult(translationResult), translationResult, notesPath).catch(
      (error) => {
        logger.error('Failed to export output to notes:', error as Error)
      }
    )
  }, [notesPath, translateOutput])

  const { onAbort, onTranslate } = useTranslationFlowRunner({
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
    processTranslation,
    runTranslate,
    selectedModelAvailable: selectedModelId !== undefined,
    setDetectedLanguage,
    setFlowStage,
    setIsDetecting,
    setOutputTargetLanguage,
    setRawOutput,
    setTranslateOutput,
    setTimeoutTimer,
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
    run: onTranslate
  })

  const isFlowBusy = flowStage !== 'idle' || isTranslating || isDetecting
  const prepareShortcutInput = useCallback(
    (text: string) => {
      setTranslateInput(text)
      setRawOutput('')
      setTranslateOutput('')
      setDetectedLanguage(null)
    },
    [setTranslateInput, setTranslateOutput]
  )

  useTranslateAutoPasteTrigger({
    busy: isFlowBusy || isProcessing || isOcrRunning,
    prepareInput: prepareShortcutInput,
    readClipboardForTranslate,
    ready: !modelsLoading,
    setSourceLanguageToAuto: () => setSourceLanguage('auto'),
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
    runTranslation: onTranslate,
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
      setTranslateInput(text)
      setRawOutput('')
      setTranslateOutput('')
      setDetectedLanguage(null)
      await onPrimaryTranslate(undefined, text)
    }
  })

  const onHistoryItemClick = useCallback(
    (history: TranslateHistory) => {
      const historyTarget = history.targetLanguage ?? targetLanguage
      setTranslateInput(history.sourceText)
      setRawOutput(history.targetText)
      setOutputTargetLanguage(historyTarget)
      setTranslateOutput(processTranslation(history.targetText, historyTarget))
      setHistoryOpen(false)
    },
    [processTranslation, setTranslateInput, setTranslateOutput, targetLanguage]
  )

  useEffect(() => {
    if (isTranslating || flowStage === 'polishing' || flowStage === 'translating') return
    if (rawOutput) setTranslateOutput(processTranslation(rawOutput, outputTargetLanguage))
  }, [flowStage, isTranslating, outputTargetLanguage, processTranslation, rawOutput, setTranslateOutput])

  const {
    cycleLayout,
    equalizeHorizontalScrollLength,
    inputScrollHandler,
    isVerticalLayout,
    outputScrollHandler,
    panelSize,
    setPanelSize
  } = useTranslateLayout({
    inputScrollRef,
    isProgrammaticScroll,
    isScrollSyncEnabled,
    layoutOverride: flowSettings.layoutOverride,
    onLayoutOverrideChange: (layoutOverride) =>
      void safePersist(updateFlowSettings({ layoutOverride }), 'translate layout override'),
    outputScrollRef: outputTextRef,
    paneContainerRef
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

  const modelSelectorFilter = useCallback((model: SelectorModel) => !isNonChatModel(model), [])

  const handleModelIdSelect = useCallback(
    (modelId: UniqueModelId | undefined) => {
      void safePersist(setTranslateModelId(modelId ?? null), 'translate model id')
    },
    [safePersist, setTranslateModelId]
  )

  // V2 File Processing owns OCR execution. Translate only tracks the job id;
  // dismissing the overlay intentionally fences a late result rather than
  // pretending that the backend job itself was cancelled.
  const clearOcrJob = useCallback(() => setOcrJobId(null), [])

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
    isOcrRunning,
    isProcessing,
    isTranslating,
    onOcrStarted: setOcrJobId,
    setIsProcessing,
    setText: setTranslateInput
  })

  const couldTranslate = !isEmpty(translateInput) && !!selectedModelId && !isFlowBusy && !isProcessing && !isOcrRunning
  const { compact: compactToolbar, toolbarRef } = useTranslateToolbarVisibility()

  return (
    <div
      data-ui="translate.view"
      className="relative flex h-full flex-col overflow-hidden bg-background"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={preventDrop}>
      {ocrJobId && (
        <OcrJobWatcher key={ocrJobId} jobId={ocrJobId} onCompleted={appendTranslateInput} onSettled={clearOcrJob} />
      )}
      <Navbar />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div ref={toolbarRef} className="flex shrink-0 items-center gap-2 border-border-subtle border-b p-3">
          {!compactToolbar && (
            <TranslateLanguageBar
              className="px-0 py-0 lg:px-0"
              sourceLanguage={sourceLanguage}
              onSourceChange={(language) => void safePersist(setSourceLanguage(language), 'translate source language')}
              targetLanguage={targetLanguage}
              onTargetChange={(language) => void safePersist(setTargetLanguage(language), 'translate target language')}
              detectedLanguage={detectedLanguage}
              isBidirectional={isBidirectional}
              bidirectionalPair={bidirectionalPair}
              couldExchange={couldExchange}
              onExchange={handleExchange}
            />
          )}
          {!compactToolbar && <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border-subtle" />}
          {isFlowBusy ? (
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
              onClick={(event) => void handlePrimaryClick(event)}
              disabled={!couldTranslate}
              title={t('translate.tooltip.force_refresh', { modifier: getTranslateModifierLabel() })}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-all focus-visible:outline-none',
                couldTranslate
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'cursor-not-allowed bg-muted text-foreground-disabled'
              )}>
              <Languages size={14} className="lucide-custom" />
              <span>{t('translate.button.translate')}</span>
            </button>
          )}
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border-subtle" />
          <FlipButton couldFlip={couldFlip} onFlip={() => void handleFlip()} />
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border-subtle" />
          <PolishTranslateToggleButton
            enabled={flowSettings.polishEnabled}
            disabled={isFlowBusy || isProcessing || isOcrRunning}
            onToggle={() =>
              void safePersist(
                updateFlowSettings({ polishEnabled: !flowSettings.polishEnabled }),
                'translate polish enabled'
              )
            }
            onTranslateOnce={() => void triggerPolishOnce()}
          />
          <span className="flex-1" />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={clipboardWatch.toggle}
              className={clipboardWatch.enabled ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}
              aria-label={t('translate.clipboard_watch')}
              aria-pressed={clipboardWatch.enabled}
              title={t('translate.clipboard_watch')}>
              {clipboardWatch.enabled ? <ClipboardCheck size={14} /> : <ClipboardCopy size={14} />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={cycleLayout}
              aria-label={`Layout: ${flowSettings.layoutOverride}`}
              title={`Layout: ${flowSettings.layoutOverride}`}>
              {isVerticalLayout ? <Rows2 size={14} /> : <Columns2 size={14} />}
            </Button>
            {!compactToolbar && (
              <ModelSelector
                multiple={false}
                selectionType="id"
                value={selectedModelId}
                onSelect={handleModelIdSelect}
                filter={modelSelectorFilter}
                showTagFilter={false}
                showPinnedModels
                prioritizedProviderIds={PRIORITIZED_PROVIDER_IDS}
                align="end"
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={selectedModel?.name ?? t('translate.settings.model_placeholder')}
                    title={selectedModel?.name ?? t('translate.settings.model_placeholder')}
                    className="size-8 rounded-full p-0 shadow-none hover:bg-accent">
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
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className={historyOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}
              onClick={() =>
                setHistoryOpen((open) => {
                  const next = !open
                  if (next) setSettingsOpen(false)
                  return next
                })
              }
              aria-label={t('translate.history.title')}
              aria-pressed={historyOpen}>
              <History size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className={settingsOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}
              onClick={() =>
                setSettingsOpen((open) => {
                  const next = !open
                  if (next) setHistoryOpen(false)
                  return next
                })
              }
              aria-label={t('translate.settings.title')}
              aria-pressed={settingsOpen}>
              <SlidersHorizontal size={14} />
            </Button>
          </div>
        </div>

        <div
          ref={paneContainerRef}
          className="grid min-h-0 flex-1"
          style={
            isVerticalLayout
              ? { gridTemplateRows: `${panelSize}% 4px minmax(0, 1fr)`, gridTemplateColumns: 'minmax(0, 1fr)' }
              : { gridTemplateColumns: `${panelSize}% 4px minmax(0, 1fr)`, gridTemplateRows: 'minmax(0, 1fr)' }
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
              onCopy={onCopyInput}
              onPasteFromClipboard={readClipboardForTranslate}
              htmlConversionEnabled={htmlConversionEnabled}
              onToggleHtmlConversion={() =>
                void safePersist(setHtmlConversionEnabled(!htmlConversionEnabled), 'HTML conversion on paste')
              }
              onCancelOcr={clearOcrJob}
              disabled={isTranslating || isDetecting || isProcessing || isOcrRunning}
              ocrProcessing={isOcrRunning}
              selecting={selecting}
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
            onEqualizeScroll={equalizeHorizontalScrollLength}
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
              onExportToNotes={onExportOutputToNotes}
              onScroll={outputScrollHandler}
            />
          </section>
        </div>
        <TranslateHistoryList
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onHistoryItemClick={onHistoryItemClick}
        />
        <TranslateSettings visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </div>
  )
}

export default TranslatePage
