import 'katex/dist/katex.min.css'

import { PlusOutlined, SendOutlined, SwapOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { CopyIcon } from '@renderer/components/Icons'
import LanguageSelect from '@renderer/components/LanguageSelect'
import ModelSelectButton from '@renderer/components/ModelSelectButton'
import { isEmbeddingModel, isRerankModel, isTextToImageModel } from '@renderer/config/models'
import { LanguagesEnum, UNKNOWN } from '@renderer/config/translate'
import { useCodeStyle } from '@renderer/context/CodeStyleProvider'
import db from '@renderer/databases'
import { useDefaultModel } from '@renderer/hooks/useAssistant'
import { useDrag } from '@renderer/hooks/useDrag'
import { useFiles } from '@renderer/hooks/useFiles'
import { useOcr } from '@renderer/hooks/useOcr'
import { useTemporaryValue } from '@renderer/hooks/useTemporaryValue'
import { useSettings } from '@renderer/hooks/useSettings'
import { useTimer } from '@renderer/hooks/useTimer'
import useTranslate from '@renderer/hooks/useTranslate'
import { estimateTextTokens } from '@renderer/services/TokenService'
import { saveTranslateHistory, translateText } from '@renderer/services/TranslateService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setTranslateAbortKey, setTranslating as setTranslatingAction } from '@renderer/store/runtime'
import { setTranslatedContent as setTranslatedContentAction, setTranslateInput } from '@renderer/store/translate'
import type { FileMetadata, SupportedOcrFile } from '@renderer/types'
import {
  type AutoDetectionMethod,
  isSupportedOcrFile,
  type Model,
  type TranslateHistory,
  type TranslateLanguage
} from '@renderer/types'
import { getFileExtension, isTextFile, runAsyncFunction, uuid } from '@renderer/utils'
import { abortCompletion } from '@renderer/utils/abortController'
import { isAbortError } from '@renderer/utils/error'
import { formatErrorMessage } from '@renderer/utils/error'
import { getFilesFromDropEvent, getTextFromDropEvent } from '@renderer/utils/input'
import {
  createInputScrollHandler,
  createOutputScrollHandler,
  detectLanguage,
  determineTargetLanguage
} from '@renderer/utils/translate'
import { processLatexBrackets } from '@renderer/utils/markdown'
import { imageExts, MB, textExts } from '@shared/config/constant'
import { Button, Flex, FloatButton, Popover, Tooltip, Typography } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import TextArea from 'antd/es/input/TextArea'
import { isEmpty, throttle } from 'lodash'
import {
  Check,
  CirclePause,
  Columns2,
  FolderClock,
  GripVertical,
  Rows2,
  Settings2,
  SpellCheck,
  UploadIcon
} from 'lucide-react'
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import TurndownService from 'turndown'

import TranslateHistoryList from './TranslateHistory'
import TranslateSettings from './TranslateSettings'

const logger = loggerService.withContext('TranslatePage')

// cache variables
let _sourceLanguage: TranslateLanguage | 'auto' = 'auto'
let _targetLanguage = LanguagesEnum.enUS

const DraggableDivider: FC<{
  isVertical: boolean
  onResize: (size: number) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}> = ({ isVertical, onResize, containerRef }) => {
  const dividerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [isVertical]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current) return

      const container = (dividerRef.current?.parentElement as HTMLDivElement | null) || containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()

      if (isVertical) {
        const minHeight = 200
        const maxHeightPercent = Math.max(30, ((rect.height - minHeight) / rect.height) * 100)
        const newSize = ((e.clientY - rect.top) / rect.height) * 100
        onResize(Math.max(30, Math.min(maxHeightPercent, newSize)))
      } else {
        const availableWidth = rect.width
        const minWidth = window.innerWidth < 600 ? 250 : window.innerWidth < 800 ? 280 : 320
        const maxWidthPercent = Math.max(30, ((availableWidth - minWidth) / availableWidth) * 100)
        const newSize = ((e.clientX - rect.left) / availableWidth) * 100
        onResize(Math.max(30, Math.min(maxWidthPercent, newSize)))
      }
    },
    [isVertical, onResize, containerRef]
  )

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [handleMouseMove])

  return (
    <DividerContainer ref={dividerRef} $isVertical={isVertical} onMouseDown={handleMouseDown}>
      <DividerHandle $isVertical={isVertical}>
        <GripVertical size={16} />
      </DividerHandle>
    </DividerContainer>
  )
}

const TranslatePage: FC = () => {
  // hooks
  const { t } = useTranslation()
  const { translateModel, setTranslateModel } = useDefaultModel()
  const { prompt, getLanguageByLangcode, settings } = useTranslate()
  const { autoCopy } = settings
  const { shikiMarkdownIt } = useCodeStyle()
  const { mathEngine, mathEnableSingleDollar } = useSettings()
  const { onSelectFile, selecting, clearFiles } = useFiles({ extensions: [...imageExts, ...textExts] })
  const { ocr } = useOcr()
  const { setTimeoutTimer } = useTimer()

  // states
  // const [text, setText] = useState(_text)
  const [renderedMarkdown, setRenderedMarkdown] = useState<string>('')
  const [copied, setCopied] = useTemporaryValue(false, 2000)
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false)
  const [isScrollSyncEnabled, setIsScrollSyncEnabled] = useState(false)
  const [isBidirectional, setIsBidirectional] = useState(false)
  const [enableMarkdown, setEnableMarkdown] = useState(false)
  const [bidirectionalPair, setBidirectionalPair] = useState<[TranslateLanguage, TranslateLanguage]>([
    LanguagesEnum.enUS,
    LanguagesEnum.zhCN
  ])
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState<TranslateLanguage | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState<TranslateLanguage | 'auto'>(_sourceLanguage)
  const [targetLanguage, setTargetLanguage] = useState<TranslateLanguage>(_targetLanguage)
  const [autoDetectionMethod, setAutoDetectionMethod] = useState<AutoDetectionMethod>('franc')
  const [isProcessing, setIsProcessing] = useState(false)

  // redux states
  const text = useAppSelector((state) => state.translate.translateInput)
  const translatedContent = useAppSelector((state) => state.translate.translatedContent)
  const translating = useAppSelector((state) => state.runtime.translating)
  const abortKey = useAppSelector((state) => state.runtime.translateAbortKey)

  // ref
  const contentContainerRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<TextAreaRef>(null)
  const outputTextRef = useRef<HTMLDivElement>(null)
  const isProgrammaticScroll = useRef(false)
  // Ensure settings are loaded before acting on global shortcut triggers
  const [settingsReady, setSettingsReady] = useState(false)
  const pendingShortcutRef = useRef<string | null>(null)

  const dispatch = useAppDispatch()
  const location = useLocation()
  const navigate = useNavigate()

  _sourceLanguage = sourceLanguage
  _targetLanguage = targetLanguage

  // Resizable layout states
  const [panelSize, setPanelSize] = useState<number>(50)
  const [isVerticalLayout, setIsVerticalLayout] = useState<boolean>(false)
  const [manualLayoutOverride, setManualLayoutOverride] = useState<'auto' | 'horizontal' | 'vertical'>('auto')

  // 控制翻译模型切换
  const handleModelChange = (model: Model) => {
    setTranslateModel(model)
    db.settings.put({ id: 'translate:model', value: model.id })
  }

  const notifyHtmlConversion = useCallback(() => {
    window.toast.success(t('translate.info.html_conversion'))
  }, [t])

  const turndownService = useMemo(() => {
    const service = new TurndownService({
      codeBlockStyle: 'fenced',
      fence: '```'
    })
    return service
  }, [])

  const convertHtmlToMarkdownWithNotification = useCallback(
    (html: string) => {
      try {
        const converted = turndownService.turndown(html)
        if (converted && converted.trim()) {
          notifyHtmlConversion()
        }
        return converted
      } catch (error) {
        logger.debug('Turndown conversion failed', error as Error)
        return ''
      }
    },
    [notifyHtmlConversion, turndownService]
  )

  const readClipboardForTranslate = useCallback(async (): Promise<string> => {
    const readFromNativeClipboard = (): string => {
      const clipboardApi = window.api?.clipboard
      if (!clipboardApi) {
        return ''
      }

      try {
        const html = clipboardApi.readHtml?.()
        if (html && html.trim()) {
          const converted = convertHtmlToMarkdownWithNotification(html)
          if (converted.trim()) {
            return converted
          }
        }
      } catch (error) {
        logger.debug('Native clipboard HTML read failed', error as Error)
      }

      try {
        const plain = clipboardApi.readText?.()
        if (plain && plain.trim()) {
          return plain
        }
      } catch (error) {
        logger.debug('Native clipboard text read failed', error as Error)
      }

      return ''
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const tryRichClipboard = async (): Promise<string> => {
        const read = (navigator.clipboard as Clipboard & { read?: () => Promise<ClipboardItem[]> }).read
        if (typeof read !== 'function') {
          return ''
        }

        try {
          const items = await read.call(navigator.clipboard)

          for (const item of items) {
            if (item.types.includes('text/html')) {
              const blob = await item.getType('text/html')
              const html = await blob.text()
              if (html && html.trim()) {
                const converted = convertHtmlToMarkdownWithNotification(html)
                if (converted.trim()) {
                  return converted
                }
              }
            }
          }

          for (const item of items) {
            if (item.types.includes('text/plain')) {
              const blob = await item.getType('text/plain')
              const text = await blob.text()
              if (text && text.trim()) {
                if (text.trim()) {
                  return text
                }
              }
            }
          }
        } catch (error) {
          logger.debug('Rich clipboard read failed', error as Error)
        }

        return ''
      }

      const richContent = await tryRichClipboard()
      if (richContent && richContent.trim()) {
        return richContent
      }

      try {
        const plain = await navigator.clipboard.readText()
        if (plain && plain.trim()) {
          return plain
        }
      } catch (error) {
        logger.debug('Plain clipboard read failed', error as Error)
      }
    } else {
      logger.debug('Navigator clipboard unavailable, using native clipboard fallback')
    }

    return readFromNativeClipboard()
  }, [convertHtmlToMarkdownWithNotification])

  // 控制翻译状态
  const setText = useCallback(
    (input: string) => {
      dispatch(setTranslateInput(input))
    },
    [dispatch]
  )

  const setTranslatedContent = useCallback(
    (content: string) => {
      dispatch(setTranslatedContentAction(content))
    },
    [dispatch]
  )

  const setTranslating = useCallback(
    (translating: boolean) => {
      dispatch(setTranslatingAction(translating))
    },
    [dispatch]
  )

  // 控制复制行为
  const copy = useCallback(
    async (text: string) => {
      let lastError: unknown

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          return
        } catch (error) {
          lastError = error
          logger.debug('Navigator clipboard write failed', error as Error)
        }
      }

      try {
        const fallbackWrite = window.api?.clipboard?.writeText
        if (fallbackWrite) {
          fallbackWrite(text)
          setCopied(true)
          return
        }
      } catch (error) {
        lastError = error
        logger.error('Native clipboard write failed', error as Error)
      }

      if (lastError) {
        throw lastError
      }

      throw new Error('Clipboard write is not available in this environment.')
    },
    [setCopied]
  )

  const onCopy = useCallback(async () => {
    try {
      await copy(translatedContent)
    } catch (error) {
      logger.error('Failed to copy text to clipboard:', error as Error)
      window.toast.error(t('common.copy_failed'))
    }
  }, [copy, t, translatedContent])

  /**
   * 翻译文本并保存历史记录，包含完整的异常处理，不会抛出异常
   * @param text - 需要翻译的文本
   * @param actualSourceLanguage - 源语言
   * @param actualTargetLanguage - 目标语言
   */
  const translate = useCallback(
    async (
      text: string,
      actualSourceLanguage: TranslateLanguage,
      actualTargetLanguage: TranslateLanguage
    ): Promise<void> => {
      try {
        if (translating) {
          return
        }

        let translated: string
        const abortKey = uuid()
        dispatch(setTranslateAbortKey(abortKey))

        // use a throttled updater for streaming, ensure we flush and set final content afterward
        const throttledUpdate = throttle(setTranslatedContent, 100)
        try {
          translated = await translateText(text, actualTargetLanguage, throttledUpdate, abortKey)
        } catch (e) {
          if (isAbortError(e)) {
            window.toast.info(t('translate.info.aborted'))
          } else {
            logger.error('Failed to translate text', e as Error)
            window.toast.error(t('translate.error.failed') + ': ' + formatErrorMessage(e))
          }
          setTranslating(false)
          return
        }

        // Ensure any trailing throttled updates have been applied and state matches final translated result
        if (typeof (throttledUpdate as any).flush === 'function') {
          ;(throttledUpdate as any).flush()
        }
        setTranslatedContent(translated)

        // Ensure any trailing throttled updates have been applied and state matches final translated result
        if (typeof (throttledUpdate as any).flush === 'function') {
          ;(throttledUpdate as any).flush()
        }
        setTranslatedContent(translated)

        window.toast.success(t('translate.complete'))
        if (autoCopy) {
          // Copy the freshly finished translation immediately (no need to wait for Redux store propagation)
          setTimeoutTimer(
            'auto-copy',
            async () => {
              await copy(translated)
            },
            0
          )
        }

        try {
          await saveTranslateHistory(text, translated, actualSourceLanguage.langCode, actualTargetLanguage.langCode)
        } catch (e) {
          logger.error('Failed to save translate history', e as Error)
          window.toast.error(t('translate.history.error.save') + ': ' + formatErrorMessage(e))
        }
      } catch (e) {
        logger.error('Failed to translate', e as Error)
        window.toast.error(t('translate.error.unknown') + ': ' + formatErrorMessage(e))
      }
    },
    [autoCopy, copy, dispatch, setTimeoutTimer, setTranslatedContent, setTranslating, t, translating]
  )

  // 控制翻译按钮是否可用
  const couldTranslate = useMemo(() => {
    return !(
      !text.trim() ||
      (sourceLanguage !== 'auto' && sourceLanguage.langCode === UNKNOWN.langCode) ||
      targetLanguage.langCode === UNKNOWN.langCode ||
      (isBidirectional &&
        (bidirectionalPair[0].langCode === UNKNOWN.langCode || bidirectionalPair[1].langCode === UNKNOWN.langCode)) ||
      isProcessing
    )
  }, [bidirectionalPair, isBidirectional, isProcessing, sourceLanguage, targetLanguage.langCode, text])

  // 控制翻译按钮，翻译前进行校验
  const onTranslate = useCallback(async () => {
    if (!couldTranslate) return
    if (!text.trim()) return
    if (!translateModel) {
      window.toast.error(t('translate.error.not_configured'))
      return
    }

    setTranslating(true)

    try {
      // 确定源语言：如果用户选择了特定语言，使用用户选择的；如果选择'auto'，则自动检测
      let actualSourceLanguage: TranslateLanguage
      if (sourceLanguage === 'auto') {
        const candidateLangCodes = isBidirectional
          ? Array.from(
              new Set(
                bidirectionalPair
                  .map((lang) => lang.langCode)
                  .filter((langCode) => langCode !== UNKNOWN.langCode)
              )
            )
          : undefined
        const detectionOptions = candidateLangCodes && candidateLangCodes.length > 0 ? { candidates: candidateLangCodes } : undefined

        logger.debug('Detecting source language for translate flow', {
          hasCandidates: Boolean(detectionOptions?.candidates?.length),
          candidateLangCodes
        })

        const detectedLangCode = await detectLanguage(text, detectionOptions)
        logger.debug('detectLanguage returned', {
          detectedLangCode,
          candidateLangCodes
        })

        actualSourceLanguage = getLanguageByLangcode(detectedLangCode)
        if (actualSourceLanguage.langCode === UNKNOWN.langCode) {
          logger.warn('Detected language code could not be resolved', {
            detectedLangCode,
            candidateLangCodes,
            textPreview: text.slice(0, 120)
          })
        }
        setDetectedLanguage(actualSourceLanguage)
      } else {
        if (sourceLanguage.langCode === UNKNOWN.langCode) {
          logger.warn('User-selected source language is UNKNOWN, continuing with UNKNOWN fallback')
        }
        actualSourceLanguage = sourceLanguage
      }

      const result = determineTargetLanguage(actualSourceLanguage, targetLanguage, isBidirectional, bidirectionalPair)
      if (!result.success) {
        let errorMessage = ''
        if (result.errorType === 'same_language') {
          errorMessage = t('translate.language.same')
        } else if (result.errorType === 'not_in_pair') {
          errorMessage = t('translate.language.not_pair')
        }

        window.toast.warning(errorMessage)
        return
      }

      const actualTargetLanguage = result.language as TranslateLanguage
      if (isBidirectional) {
        setTargetLanguage(actualTargetLanguage)
      }

      await translate(text, actualSourceLanguage, actualTargetLanguage)
    } catch (error) {
      logger.error('Translation error:', error as Error)
      window.toast.error(t('translate.error.failed') + ': ' + formatErrorMessage(error))
      return
    } finally {
      setTranslating(false)
    }
  }, [
    bidirectionalPair,
    couldTranslate,
    getLanguageByLangcode,
    isBidirectional,
    setTranslating,
    sourceLanguage,
    t,
    targetLanguage,
    text,
    translate,
    translateModel
  ])

  // 控制停止翻译
  const onAbort = async () => {
    if (!abortKey || !abortKey.trim()) {
      logger.error('Failed to abort. Invalid abortKey.')
      return
    }
    abortCompletion(abortKey)
  }

  // Auto paste and translate when navigated with ?paste=1
  const onTranslateRef = useRef(onTranslate)
  useEffect(() => {
    onTranslateRef.current = onTranslate
  }, [onTranslate])

  useEffect(() => {
    const triggerFromQuery = async () => {
      try {
        const params = new URLSearchParams(location.search || '')
        const shouldPaste = params.get('paste') === '1'
        if (!shouldPaste) return

        // prevent duplicate triggers for the same navigation
        const nonce = params.get('_') || ''
        const key = `translate:paste:nonce:${nonce}`
        if (nonce && sessionStorage.getItem(key)) return

        // Shared guard to prevent double-triggering with hash-based effect and debounce
        const running = sessionStorage.getItem('translate:paste:running') === '1'
        const now = Date.now()
        const lastTs = Number(sessionStorage.getItem('translate:paste:lastTs') || '0')
        if (running || now - lastTs < 1000) return
        sessionStorage.setItem('translate:paste:running', '1')

        const clip = await readClipboardForTranslate()
        if (clip && clip.trim()) {
          // Force auto-detect for global shortcut flow
          if (sourceLanguage !== 'auto') {
            setSourceLanguage('auto')
            db.settings.put({ id: 'translate:source:language', value: 'auto' })
          }
          setDetectedLanguage(null)
          if (!settingsReady) {
            // Defer action until settings loaded to ensure bidirectional logic is applied
            pendingShortcutRef.current = clip
          } else {
            setText(clip)
            // give state a tick to update
            setTimeout(() => {
              onTranslateRef.current()
            }, 0)
          }
        }

        if (nonce) sessionStorage.setItem(key, '1')
        sessionStorage.setItem('translate:paste:lastTs', String(now))
        // Clear query to avoid re-triggers
        if (location.search) {
          navigate('/translate', { replace: true })
        }
        // release guard shortly after
        setTimeout(() => sessionStorage.removeItem('translate:paste:running'), 500)
      } catch {
        // Ignore errors from URL parameter parsing
      }
    }

    triggerFromQuery()
  }, [location.search, readClipboardForTranslate, setText, sourceLanguage, settingsReady])

  // 控制双向翻译切换
  const toggleBidirectional = (value: boolean) => {
    setIsBidirectional(value)
    db.settings.put({ id: 'translate:bidirectional:enabled', value })
  }

  // 控制历史记录点击
  const onHistoryItemClick = (
    history: TranslateHistory & { _sourceLanguage: TranslateLanguage; _targetLanguage: TranslateLanguage }
  ) => {
    setText(history.sourceText)
    setTranslatedContent(history.targetText)
    // Intentionally DO NOT change current language selections when loading history.
    // This preserves user's existing source (including 'auto') and target language choices
    // so they can continue translating new content without re-enabling auto-detect.
    setHistoryDrawerVisible(false)
  }

  // 控制语言切换按钮
  /** 与自动检测相关的交换条件检查 */
  const couldExchangeAuto = useMemo(
    () =>
      (sourceLanguage === 'auto' && detectedLanguage && detectedLanguage.langCode !== UNKNOWN.langCode) ||
      sourceLanguage !== 'auto',
    [detectedLanguage, sourceLanguage]
  )

  const couldExchange = useMemo(() => couldExchangeAuto && !isBidirectional, [couldExchangeAuto, isBidirectional])

  const handleExchange = useCallback(() => {
    if (sourceLanguage === 'auto' && !couldExchangeAuto) {
      return
    }
    const source = sourceLanguage === 'auto' ? detectedLanguage : sourceLanguage
    if (!source) {
      window.toast.error(t('translate.error.invalid_source'))
      return
    }
    if (source.langCode === UNKNOWN.langCode) {
      window.toast.error(t('translate.error.detect.unknown'))
      return
    }
    const target = targetLanguage
    setSourceLanguage(target)
    setTargetLanguage(source)
  }, [couldExchangeAuto, detectedLanguage, sourceLanguage, t, targetLanguage])

  useEffect(() => {
    isEmpty(text) && setTranslatedContent('')
  }, [setTranslatedContent, text])

  // Render markdown content when result or enableMarkdown changes
  // 控制Markdown渲染
  useEffect(() => {
    if (!enableMarkdown || !translatedContent) {
      setRenderedMarkdown('')
      return
    }

    let disposed = false
    const shouldRenderMath = mathEngine === 'KaTeX'
    const markdownSource = shouldRenderMath ? processLatexBrackets(translatedContent) : translatedContent

    const renderOptions = shouldRenderMath
      ? { math: { engine: 'katex' as const, allowSingleDollar: mathEnableSingleDollar } }
      : undefined

    shikiMarkdownIt(markdownSource, renderOptions)
      .then((rendered) => {
        if (!disposed) {
          setRenderedMarkdown(rendered)
        }
      })
      .catch((error) => {
        logger.error('Failed to render markdown', error as Error)
        if (!disposed) {
          const fallback = markdownSource
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
          setRenderedMarkdown(fallback)
        }
      })

    return () => {
      disposed = true
    }
  }, [enableMarkdown, mathEnableSingleDollar, mathEngine, shikiMarkdownIt, translatedContent])

  // 控制设置加载
  useEffect(() => {
    runAsyncFunction(async () => {
      const targetLang = await db.settings.get({ id: 'translate:target:language' })
      targetLang && setTargetLanguage(getLanguageByLangcode(targetLang.value))

      const sourceLang = await db.settings.get({ id: 'translate:source:language' })
      sourceLang &&
        setSourceLanguage(sourceLang.value === 'auto' ? sourceLang.value : getLanguageByLangcode(sourceLang.value))

      const bidirectionalPairSetting = await db.settings.get({ id: 'translate:bidirectional:pair' })
      if (bidirectionalPairSetting) {
        const langPair = bidirectionalPairSetting.value
        let source: undefined | TranslateLanguage
        let target: undefined | TranslateLanguage

        if (Array.isArray(langPair) && langPair.length === 2 && langPair[0] !== langPair[1]) {
          source = getLanguageByLangcode(langPair[0])
          target = getLanguageByLangcode(langPair[1])
        }

        if (source && target) {
          setBidirectionalPair([source, target])
        } else {
          const defaultPair: [TranslateLanguage, TranslateLanguage] = [LanguagesEnum.enUS, LanguagesEnum.zhCN]
          setBidirectionalPair(defaultPair)
          db.settings.put({
            id: 'translate:bidirectional:pair',
            value: [defaultPair[0].langCode, defaultPair[1].langCode]
          })
        }
      }

      const bidirectionalSetting = await db.settings.get({ id: 'translate:bidirectional:enabled' })
      setIsBidirectional(bidirectionalSetting ? bidirectionalSetting.value : false)

      const scrollSyncSetting = await db.settings.get({ id: 'translate:scroll:sync' })
      setIsScrollSyncEnabled(scrollSyncSetting ? scrollSyncSetting.value : false)

      const markdownSetting = await db.settings.get({ id: 'translate:markdown:enabled' })
      setEnableMarkdown(markdownSetting ? markdownSetting.value : false)

      const layoutOverrideSetting = await db.settings.get({ id: 'translate:layout:override' })
      setManualLayoutOverride(layoutOverrideSetting ? layoutOverrideSetting.value : 'auto')

      const autoDetectionMethodSetting = await db.settings.get({ id: 'translate:detect:method' })

      if (autoDetectionMethodSetting) {
        setAutoDetectionMethod(autoDetectionMethodSetting.value)
      } else {
        setAutoDetectionMethod('franc')
        db.settings.put({ id: 'translate:detect:method', value: 'franc' })
      }
      // Mark settings as ready so that global shortcut flows can proceed with correct bidirectional state
      setSettingsReady(true)
    })
  }, [getLanguageByLangcode])

  // If a global shortcut arrived before settings were ready, process it now
  useEffect(() => {
    if (!settingsReady) return
    const clip = pendingShortcutRef.current
    if (clip && clip.trim()) {
      pendingShortcutRef.current = null
      setText(clip)
      setTimeout(() => {
        onTranslateRef.current()
      }, 0)
    }
  }, [settingsReady, setText])

  // Load saved panel size
  useEffect(() => {
    try {
      const savedSize = localStorage.getItem('translate-panel-size')
      if (savedSize) {
        const num = parseFloat(savedSize)
        if (!Number.isNaN(num) && num > 0 && num < 100) setPanelSize(num)
      }
    } catch {
      // Ignore errors from localStorage access
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('translate-panel-size', String(panelSize))
    } catch {
      // Ignore errors from localStorage access
    }
  }, [panelSize])

  // Derive layout mode
  useEffect(() => {
    const handleResize = () => {
      if (manualLayoutOverride !== 'auto') {
        setIsVerticalLayout(manualLayoutOverride === 'vertical')
        return
      }
      const w = window.innerWidth
      const h = window.innerHeight
      const aspect = w / h
      const shouldVertical = w < 900 || aspect < 1 || h > w * 1
      setIsVerticalLayout(shouldVertical)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [manualLayoutOverride])

  // 控制设置同步
  const updateAutoDetectionMethod = async (method: AutoDetectionMethod) => {
    try {
      await db.settings.put({ id: 'translate:detect:method', value: method })
      setAutoDetectionMethod(method)
    } catch (e) {
      logger.error('Failed to update auto detection method setting.', e as Error)
      window.toast.error(t('translate.error.detect.update_setting') + formatErrorMessage(e))
    }
  }

  // 控制Enter触发翻译
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isEnterPressed = e.key === 'Enter'
    if (isEnterPressed && !e.nativeEvent.isComposing && !e.shiftKey && e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      onTranslate()
    }
  }

  // 控制双向滚动
  const handleInputScroll = createInputScrollHandler(outputTextRef, isProgrammaticScroll, isScrollSyncEnabled)
  const handleOutputScroll = createOutputScrollHandler(textAreaRef, isProgrammaticScroll, isScrollSyncEnabled)

  // Toggle layout and persist override
  const toggleLayout = () => {
    let next: 'auto' | 'vertical' | 'horizontal'
    if (manualLayoutOverride === 'auto') {
      next = 'vertical'
    } else if (manualLayoutOverride === 'vertical') {
      next = 'horizontal'
    } else {
      next = 'auto'
    }
    setManualLayoutOverride(next)
    db.settings.put({ id: 'translate:layout:override', value: next })
  }

  // 获取目标语言显示
  const getLanguageDisplay = () => {
    try {
      if (isBidirectional) {
        return (
          <Flex align="center" style={{ minWidth: 160 }}>
            <BidirectionalLanguageDisplay>
              {`${bidirectionalPair[0].label()} ⇆ ${bidirectionalPair[1].label()}`}
            </BidirectionalLanguageDisplay>
          </Flex>
        )
      }
    } catch (error) {
      logger.error('Error getting language display:', error as Error)
      setBidirectionalPair([LanguagesEnum.enUS, LanguagesEnum.zhCN])
    }

    return (
      <LanguageSelect
        style={{ width: 200 }}
        value={targetLanguage.langCode}
        onChange={(value) => {
          setTargetLanguage(getLanguageByLangcode(value))
          db.settings.put({ id: 'translate:target:language', value })
        }}
      />
    )
  }

  // 控制模型选择器
  const modelPredicate = useCallback(
    (m: Model) => !isEmbeddingModel(m) && !isRerankModel(m) && !isTextToImageModel(m),
    []
  )

  // 控制token估计
  const tokenCount = useMemo(() => estimateTextTokens(text + prompt), [prompt, text])

  // Auto-paste and translate when navigated with ?paste=1
  useEffect(() => {
    let aborted = false
    const url = new URL(window.location.href)
    const shouldPaste = url.hash.includes('/translate') && url.hash.includes('paste=1')
    if (!shouldPaste) return

    if (translating) {
      if (location.search) {
        navigate('/translate', { replace: true })
      }
      return
    }

    const run = async () => {
      try {
        // Shared guard to prevent double-triggering with the other effect
        const running = sessionStorage.getItem('translate:paste:running') === '1'
        const now = Date.now()
        const lastTs = Number(sessionStorage.getItem('translate:paste:lastTs') || '0')
        if (running || now - lastTs < 1000) return
        sessionStorage.setItem('translate:paste:running', '1')
        const clip = await readClipboardForTranslate()
        if (aborted) return
        if (clip && clip.trim().length > 0) {
          // Force auto-detect for global shortcut flow
          if (sourceLanguage !== 'auto') {
            setSourceLanguage('auto')
            db.settings.put({ id: 'translate:source:language', value: 'auto' })
          }
          setDetectedLanguage(null)
          setText(clip)
          // wait a tick for state to propagate
          setTimeout(() => {
            void onTranslate()
          }, 0)
          sessionStorage.setItem('translate:paste:lastTs', String(now))
        }
      } catch (e) {
        // ignore clipboard errors silently
      } finally {
        // release guard shortly after
        setTimeout(() => sessionStorage.removeItem('translate:paste:running'), 500)
      }
    }
    run()

    return () => {
      aborted = true
    }
    // trigger when location changes to /translate?paste=1
  }, [location, onTranslate, readClipboardForTranslate, setText, sourceLanguage])

  const readFile = useCallback(
    async (file: FileMetadata) => {
      const _readFile = async () => {
        let isText: boolean
        try {
          // 检查文件是否为文本文件
          isText = await isTextFile(file.path)
        } catch (e) {
          logger.error('Failed to check if file is text.', e as Error)
          window.toast.error(t('translate.files.error.check_type') + ': ' + formatErrorMessage(e))
          return
        }

        if (!isText) {
          window.toast.error(t('common.file.not_supported', { type: getFileExtension(file.path) }))
          logger.error('Unsupported file type.')
          return
        }

        // the threshold may be too large
        if (file.size > 5 * MB) {
          window.toast.error(t('translate.files.error.too_large') + ' (0 ~ 5 MB)')
        } else {
          try {
            const result = await window.api.fs.readText(file.path)
            setText(text + result)
          } catch (e) {
            logger.error('Failed to read text file.', e as Error)
            window.toast.error(t('translate.files.error.unknown') + ': ' + formatErrorMessage(e))
          }
        }
      }
      const promise = _readFile()
      window.toast.loading({ title: t('translate.files.reading'), promise })
    },
    [setText, t, text]
  )

  const ocrFile = useCallback(
    async (file: SupportedOcrFile) => {
      const ocrResult = await ocr(file)
      setText(text + ocrResult.text)
    },
    [ocr, setText, text]
  )

  // 统一的文件处理
  const processFile = useCallback(
    async (file: FileMetadata) => {
      // extensible, only image for now
      const shouldOCR = isSupportedOcrFile(file)

      if (shouldOCR) {
        await ocrFile(file)
      } else {
        await readFile(file)
      }
    },
    [ocrFile, readFile]
  )

  // 点击上传文件按钮
  const handleSelectFile = useCallback(async () => {
    if (selecting) return
    setIsProcessing(true)
    try {
      const [file] = await onSelectFile({ multipleSelections: false })
      if (!file) {
        return
      }
      await processFile(file)
    } catch (e) {
      logger.error('Unknown error when selecting file.', e as Error)
      window.toast.error(t('translate.files.error.unknown') + ': ' + formatErrorMessage(e))
    } finally {
      clearFiles()
      setIsProcessing(false)
    }
  }, [clearFiles, onSelectFile, processFile, selecting, t])

  const getSingleFile = useCallback(
    (files: FileMetadata[] | FileList): FileMetadata | File | null => {
      if (files.length === 0) return null
      if (files.length > 1) {
        // 多文件上传时显示提示信息
        window.toast.error(t('translate.files.error.multiple'))
        return null
      }
      return files[0]
    },
    [t]
  )

  // 拖动上传文件
  const {
    isDragging,
    setIsDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop: preventDrop
  } = useDrag<HTMLDivElement>()

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      setIsProcessing(true)
      setIsDragging(false)
      const process = async () => {
        // const supportedFiles = await filterSupportedFiles(_files, extensions)
        const data = await getTextFromDropEvent(e).catch((err) => {
          logger.error('getTextFromDropEvent', err)
          window.toast.error(t('translate.files.error.unknown'))
          return null
        })
        if (data === null) {
          return
        }
        setText(text + data)

        const droppedFiles = await getFilesFromDropEvent(e).catch((err) => {
          logger.error('handleDrop:', err)
          window.toast.error(t('translate.files.error.unknown'))
          return null
        })

        if (droppedFiles) {
          const file = getSingleFile(droppedFiles) as FileMetadata
          if (!file) return
          processFile(file)
        }
      }
      await process()
      setIsProcessing(false)
    },
    [getSingleFile, processFile, setIsDragging, setText, t, text]
  )

  const {
    isDragging: isDraggingOnInput,
    handleDragEnter: handleDragEnterInput,
    handleDragLeave: handleDragLeaveInput,
    handleDragOver: handleDragOverInput,
    handleDrop
  } = useDrag<HTMLDivElement>(onDrop)

  // 粘贴上传文件
  const onPaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (isProcessing) return
      setIsProcessing(true)

      // Try to get HTML content from clipboard
      const clipboardHtml = event.clipboardData.getData('text/html')
      const clipboardText = event.clipboardData.getData('text')

      // If we have HTML content (formatted text), convert it to Markdown
      if (!isEmpty(clipboardHtml)) {
        event.preventDefault()
        try {
          const markdown = convertHtmlToMarkdownWithNotification(clipboardHtml)
          if (markdown && markdown.trim()) {
            // Insert the markdown at current cursor position
            const textarea = textAreaRef.current?.resizableTextArea?.textArea
            if (textarea) {
              const start = textarea.selectionStart || 0
              const end = textarea.selectionEnd || 0
              const beforeText = text.substring(0, start)
              const afterText = text.substring(end)
              setText(beforeText + markdown + afterText)

              // Set cursor position after the inserted markdown
              setTimeout(() => {
                textarea.setSelectionRange(start + markdown.length, start + markdown.length)
                textarea.focus()
              }, 0)
            } else {
              // Fallback: just append to the end
              setText(text + markdown)
            }
          }
        } catch (e) {
          logger.error('Failed to convert HTML to Markdown', e as Error)
          // Fall back to plain text if conversion fails
          if (!isEmpty(clipboardText)) {
            // Let default behavior handle it
          }
        }
        setIsProcessing(false)
        return
      }

      if (!isEmpty(clipboardText)) {
        // depend default. this branch is only for preventing files when clipboard contains text
      } else if (event.clipboardData.files && event.clipboardData.files.length > 0) {
        event.preventDefault()
        const files = event.clipboardData.files
        const file = getSingleFile(files) as File
        if (!file) return
        try {
          // 使用新的API获取文件路径
          const filePath = window.api.file.getPathForFile(file)
          let selectedFile: FileMetadata | null

          // 如果没有路径，可能是剪贴板中的图像数据
          if (!filePath) {
            if (file.type.startsWith('image/')) {
              const tempFilePath = await window.api.file.createTempFile(file.name)
              const arrayBuffer = await file.arrayBuffer()
              const uint8Array = new Uint8Array(arrayBuffer)
              await window.api.file.write(tempFilePath, uint8Array)
              selectedFile = await window.api.file.get(tempFilePath)
            } else {
              window.toast.info(t('common.file.not_supported', { type: getFileExtension(filePath) }))
              return
            }
          } else {
            // 有路径的情况
            selectedFile = await window.api.file.get(filePath)
          }

          if (!selectedFile) {
            window.toast.error(t('translate.files.error.unknown'))
            return
          }
          await processFile(selectedFile)
        } catch (error) {
          logger.error('onPaste:', error as Error)
          window.toast.error(t('chat.input.file_error'))
        }
      }
      setIsProcessing(false)
    },
    [convertHtmlToMarkdownWithNotification, getSingleFile, isProcessing, processFile, t]
  )
  return (
    <Container
      id="translate-page"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={preventDrop}>
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none', gap: 10 }}>{t('translate.title')}</NavbarCenter>
      </Navbar>
      <ContentContainer id="content-container" ref={contentContainerRef} $historyDrawerVisible={historyDrawerVisible}>
        <TranslateHistoryList
          onHistoryItemClick={onHistoryItemClick}
          isOpen={historyDrawerVisible}
          onClose={() => setHistoryDrawerVisible(false)}
        />
        <OperationBar>
          <InnerOperationBar style={{ justifyContent: 'flex-start' }}>
            <Tooltip
              title={
                manualLayoutOverride === 'auto'
                  ? 'Auto Layout'
                  : manualLayoutOverride === 'vertical'
                    ? 'Vertical Layout'
                    : 'Horizontal Layout'
              }
              placement="bottom">
              <Button
                className="nodrag"
                color="default"
                variant="text"
                type="text"
                icon={
                  manualLayoutOverride === 'auto' ? (
                    <SpellCheck size={16} />
                  ) : manualLayoutOverride === 'vertical' ? (
                    <Rows2 size={16} />
                  ) : (
                    <Columns2 size={16} />
                  )
                }
                onClick={toggleLayout}
              />
            </Tooltip>
            <Button
              className="nodrag"
              color="default"
              variant={historyDrawerVisible ? 'filled' : 'text'}
              type="text"
              icon={<FolderClock size={18} />}
              onClick={() => setHistoryDrawerVisible(!historyDrawerVisible)}
            />
            <LanguageSelect
              showSearch
              style={{ width: 200 }}
              value={sourceLanguage !== 'auto' ? sourceLanguage.langCode : 'auto'}
              optionFilterProp="label"
              onChange={(value) => {
                if (value !== 'auto') setSourceLanguage(getLanguageByLangcode(value))
                else setSourceLanguage('auto')
                db.settings.put({ id: 'translate:source:language', value })
              }}
              extraOptionsBefore={[
                {
                  value: 'auto',
                  label: detectedLanguage
                    ? `${t('translate.detected.language')} (${detectedLanguage.label()})`
                    : t('translate.detected.language')
                }
              ]}
            />
            <Tooltip title={t('translate.exchange.label')} placement="bottom">
              <Button
                type="text"
                icon={<SwapOutlined />}
                style={{ margin: '0 -2px' }}
                onClick={handleExchange}
                disabled={!couldExchange}
              />
            </Tooltip>
            {getLanguageDisplay()}
            <TranslateButton
              translating={translating}
              onTranslate={onTranslate}
              couldTranslate={couldTranslate}
              onAbort={onAbort}
            />
          </InnerOperationBar>
          <InnerOperationBar style={{ justifyContent: 'flex-end' }}>
            <ModelSelectButton
              model={translateModel}
              onSelectModel={handleModelChange}
              modelFilter={modelPredicate}
              tooltipProps={{ placement: 'bottom' }}
            />
            <Button type="text" icon={<Settings2 size={18} />} onClick={() => setSettingsVisible(true)} />
          </InnerOperationBar>
        </OperationBar>
        <AreaContainer $isVertical={isVerticalLayout} $panelSize={panelSize}>
          <InputContainer
            style={isDraggingOnInput ? { border: '2px dashed var(--color-primary)' } : undefined}
            onDragEnter={handleDragEnterInput}
            onDragLeave={handleDragLeaveInput}
            onDragOver={handleDragOverInput}
            onDrop={handleDrop}>
            {(isDragging || isDraggingOnInput) && (
              <InputContainerDraggingHintContainer>
                <UploadIcon color="var(--color-text-3)" />
                {t('translate.files.drag_text')}
              </InputContainerDraggingHintContainer>
            )}
            <FloatButton
              style={{ position: 'absolute', left: 10, bottom: 10, width: 35, height: 35 }}
              className="float-button"
              icon={<PlusOutlined />}
              tooltip={t('common.upload_files')}
              shape="circle"
              type="primary"
              onClick={handleSelectFile}
            />
            <Textarea
              ref={textAreaRef}
              variant="borderless"
              placeholder={t('translate.input.placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              onScroll={handleInputScroll}
              onPaste={onPaste}
              disabled={translating}
              spellCheck={false}
              allowClear
            />
            <Footer>
              <Popover content={t('chat.input.estimated_tokens.tip')}>
                <Typography.Text style={{ color: 'var(--color-text-3)', paddingRight: 8 }}>
                  {tokenCount}
                </Typography.Text>
              </Popover>
            </Footer>
          </InputContainer>

          <DraggableDivider
            isVertical={isVerticalLayout}
            onResize={(s) => setPanelSize(s)}
            containerRef={contentContainerRef}
          />

          <OutputContainer>
            <CopyButton
              type="text"
              size="small"
              className="copy-button"
              onClick={() => onCopy()}
              disabled={!translatedContent}
              icon={copied ? <Check size={16} color="var(--color-primary)" /> : <CopyIcon size={16} />}
            />
            <OutputText ref={outputTextRef} onScroll={handleOutputScroll} className={'selectable'}>
              {!translatedContent ? (
                <div style={{ color: 'var(--color-text-3)', userSelect: 'none' }}>
                  {t('translate.output.placeholder')}
                </div>
              ) : enableMarkdown ? (
                <div className="markdown" dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />
              ) : (
                <div className="plain">{translatedContent}</div>
              )}
            </OutputText>
          </OutputContainer>
        </AreaContainer>
      </ContentContainer>

      <TranslateSettings
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        isScrollSyncEnabled={isScrollSyncEnabled}
        setIsScrollSyncEnabled={setIsScrollSyncEnabled}
        isBidirectional={isBidirectional}
        setIsBidirectional={toggleBidirectional}
        enableMarkdown={enableMarkdown}
        setEnableMarkdown={setEnableMarkdown}
        bidirectionalPair={bidirectionalPair}
        setBidirectionalPair={setBidirectionalPair}
        translateModel={translateModel}
        autoDetectionMethod={autoDetectionMethod}
        setAutoDetectionMethod={updateAutoDetectionMethod}
      />
    </Container>
  )
}

const Container = styled.div`
  flex: 1;
`

const ContentContainer = styled.div<{ $historyDrawerVisible: boolean }>`
  height: calc(100vh - var(--navbar-height));
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  padding: 12px;
  position: relative;
  [navbar-position='left'] & {
    padding: 12px 16px;
  }
  min-height: 0;
  overflow: hidden;
`

const AreaContainer = styled.div<{ $isVertical: boolean; $panelSize: number }>`
  display: flex;
  flex: 1;
  gap: 0;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  flex-direction: ${({ $isVertical }) => ($isVertical ? 'column' : 'row')};

  ${({ $isVertical, $panelSize }) =>
    $isVertical
      ? `
    & > *:first-child {
      height: ${$panelSize}%;
      min-height: 200px;
    }
    & > *:last-child {
      height: ${100 - $panelSize}%;
      min-height: 200px;
    }
  `
      : `
    & > *:first-child {
      width: ${$panelSize}%;
      min-width: 320px;
  height: 100%;
  min-height: 0;
    }
    & > *:last-child {
      width: ${100 - $panelSize}%;
      min-width: 320px;
  height: 100%;
  min-height: 0;
    }
  `}

  @media (max-width: 800px) {
    ${({ $isVertical }) =>
      !$isVertical &&
      `
      & > *:first-child { min-width: 280px; }
      & > *:last-child { min-width: 280px; }
    `}
  }

  @media (max-width: 600px) {
    ${({ $isVertical }) =>
      !$isVertical &&
      `
      & > *:first-child { min-width: 250px; }
      & > *:last-child { min-width: 250px; }
    `}
  }
`

const DividerContainer = styled.div<{ $isVertical: boolean }>`
  ${({ $isVertical }) =>
    $isVertical
      ? `
    height: 6px;
    width: 100%;
    cursor: row-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 10;

    &:hover { background-color: var(--color-primary-bg); }
  `
      : `
    width: 6px;
    height: 100%;
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 10;

    &:hover { background-color: var(--color-primary-bg); }
  `}
`

const DividerHandle = styled.div<{ $isVertical: boolean }>`
  ${({ $isVertical }) =>
    $isVertical
      ? `
    width: 40px;
    height: 4px;
    background-color: var(--color-border);
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;

    svg { transform: rotate(90deg); width: 12px; height: 12px; color: var(--color-text-3); }
  `
      : `
    width: 4px;
    height: 40px;
    background-color: var(--color-border);
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;

    svg { width: 12px; height: 12px; color: var(--color-text-3); }
  `}
`

const InputContainer = styled.div`
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 10px 5px;
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  overflow: hidden;
  .float-button {
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
  }

  &:hover {
    .float-button {
      opacity: 1;
    }
  }
`

const InputContainerDraggingHintContainer = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-3);
`

const Textarea = styled(TextArea)`
  display: flex;
  flex: 1;
  border-radius: 0;
  font-size: 16px;
  .ant-input {
    resize: none;
    padding: 5px 16px;
  }
  .ant-input-clear-icon {
    font-size: 16px;
  }
`

const Footer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
`

const OutputContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
  background-color: var(--color-background-soft);
  border-radius: 10px;
  padding: 10px 5px;
  height: calc(100vh - var(--navbar-height) - 70px);
  overflow: hidden;

  & > div > .markdown > pre {
    background-color: var(--color-background-mute) !important;
  }

  &:hover .copy-button {
    opacity: 1;
    visibility: visible;
  }
`

const CopyButton = styled(Button)`
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease-in-out,
    visibility 0.2s ease-in-out;
`

const OutputText = styled.div`
  min-height: 0;
  flex: 1;
  padding: 5px 16px;
  overflow-y: auto;

  overscroll-behavior: contain;
  font-size: 16px;
  .plain {
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .markdown {
    /* for shiki code block overflow */
    .line * {
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }
  }
`

const TranslateButton = ({
  translating,
  onTranslate,
  couldTranslate,
  onAbort
}: {
  translating: boolean
  onTranslate: () => void
  couldTranslate: boolean
  onAbort: () => void
}) => {
  const { t } = useTranslation()
  return (
    <Tooltip
      mouseEnterDelay={0.5}
      placement="bottom"
      styles={{ body: { fontSize: '12px' } }}
      title={
        <div style={{ textAlign: 'center' }}>
          Enter: {t('translate.button.translate')}
          <br />
          Shift + Enter: {t('translate.tooltip.newline')}
        </div>
      }>
      {!translating && (
        <Button type="primary" onClick={onTranslate} disabled={!couldTranslate} icon={<SendOutlined />}>
          {t('translate.button.translate')}
        </Button>
      )}
      {translating && (
        <Button danger type="primary" onClick={onAbort} icon={<CirclePause size={14} />}>
          {t('common.stop')}
        </Button>
      )}
    </Tooltip>
  )
}

const BidirectionalLanguageDisplay = styled.div`
  padding: 4px 11px;
  border-radius: 6px;
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  font-size: 14px;
  width: 100%;
  text-align: center;
`

const OperationBar = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding-bottom: 4px;
  min-width: 0;
`

const InnerOperationBar = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  min-width: 0;
`

export default TranslatePage
