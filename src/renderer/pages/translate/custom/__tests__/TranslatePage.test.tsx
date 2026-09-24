import { MockUseCacheUtils } from '@test-mocks/renderer/useCache'
import { MockUsePreferenceUtils } from '@test-mocks/renderer/usePreference'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as TranslateHooks from '@renderer/hooks/translate'
import { toast } from '@renderer/services/toast'
import { translationWorkspaceService } from '@renderer/services/translation'
import type * as TranslateUtils from '@renderer/utils/translate'
import type * as TranslateTextModule from '@renderer/utils/translate/translateText'
import type { BinaryToolSnapshot } from '@shared/types/binary'
import type { AbsoluteFilePath } from '@shared/types/file'

import type { TranslationFiles } from '../../translationFiles'

const fileMock = vi.hoisted(() => ({
  onSelectFile: vi.fn(),
  readText: vi.fn(),
  readExternal: vi.fn(),
  startJob: vi.fn(),
  getFileExtension: vi.fn(() => 'txt'),
  isTextFile: vi.fn(),
  getPathForFile: vi.fn(),
  createTempFile: vi.fn(),
  write: vi.fn(),
  get: vi.fn()
}))

const useJobMock = vi.hoisted(() => vi.fn())
const uuidMock = vi.hoisted(() => vi.fn(() => 'abort-key'))
const ipcRequestMock = vi.hoisted(() => vi.fn())
const ipcEventHandlers = vi.hoisted(() => new Map<string, (payload: unknown) => void>())
const babeldocInstalledSnapshot: BinaryToolSnapshot = {
  name: 'babeldoc-stream',
  availability: { source: 'mise', path: '/shims/babeldoc-stream' },
  application: { status: 'applied', version: '0.6.4.post4' }
}
const binaryMock = vi.hoisted(() => ({
  snapshots: {
    'babeldoc-stream': {
      name: 'babeldoc-stream',
      availability: { source: 'mise', path: '/shims/babeldoc-stream' },
      application: { status: 'applied', version: '0.6.4.post4' }
    }
  } as Record<string, BinaryToolSnapshot>
}))

const dropMock = vi.hoisted(() => ({
  getFilesFromDropEvent: vi.fn(),
  getTextFromDropEvent: vi.fn()
}))

const translateCoreMock = vi.hoisted(() => ({
  addHistory: vi.fn(),
  findBySourceText: vi.fn(),
  findCached: vi.fn(),
  resolveTranslatePlan: vi.fn(),
  detectLanguage: vi.fn(),
  translateText: vi.fn(),
  isAbortError: vi.fn(),
  formatErrorMessageWithPrefix: vi.fn((_: unknown, prefix: string) => prefix)
}))
const smoothStreamUpdateMock = vi.hoisted(() => vi.fn())
const smoothStreamCompleteMock = vi.hoisted(() => vi.fn<(_: string) => Promise<void>>())
const smoothStreamResetMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())
const clipboardWriteTextMock = vi.hoisted(() => vi.fn())
const modelSelectorMock = vi.hoisted(() => vi.fn())
const languageBarMock = vi.hoisted(() => vi.fn())
const translateInputPaneMock = vi.hoisted(() => vi.fn())
const translateOutputPaneMock = vi.hoisted(() => vi.fn())
const routeMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>
}))

const fireMiddleAuxClick = (element: Element) => {
  const event = new MouseEvent('auxclick', { bubbles: true, button: 1, cancelable: true })
  fireEvent(element, event)
  return event
}

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => routeMocks.navigate,
  useSearch: () => routeMocks.search
}))

const pdfViewMock = vi.hoisted(() => vi.fn())
const pdfHandleMock = vi.hoisted(() => ({ cancel: vi.fn(), start: vi.fn() }))
const historyFilesMock = vi.hoisted(() => ({
  files: {
    source: { entryId: 'entry-source', path: '/tmp/paper.pdf' as AbsoluteFilePath },
    target: { entryId: 'entry-target', path: '/tmp/files/entry-target.pdf' as AbsoluteFilePath }
  } as TranslationFiles
}))

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn()
  },
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@cherrystudio/ui', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
      <button type="button" {...props}>
        {children}
      </button>
    )
  }
})

vi.mock('@cherrystudio/ui/icons', () => ({
  resolveIconRef: () => undefined,
  useIcon: () => undefined
}))

vi.mock('@renderer/components/Navbar', () => ({
  Navbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NavbarCenter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('@renderer/components/ModelSelector', () => ({
  ModelSelector: (props: { trigger: React.ReactNode }) => {
    modelSelectorMock(props)
    return <>{props.trigger}</>
  }
}))

vi.mock('@renderer/components/chat/trace/TracePane', () => ({
  TracePane: ({ payload }: { payload: { topicId: string; traceId: string } }) => (
    <div data-testid="translate-trace-pane" data-topic-id={payload.topicId} data-trace-id={payload.traceId} />
  )
}))

vi.mock('@renderer/hooks/translate', async (importOriginal) => ({
  ...(await importOriginal<typeof TranslateHooks>()),
  detectLanguageOrUnknown: async (
    text: string,
    detectLanguage: (text: string) => Promise<string>,
    onError: (error: unknown) => void
  ) => {
    try {
      return await detectLanguage(text)
    } catch (error) {
      onError(error)
      return 'unknown'
    }
  },
  useTranslateHistory: () => ({
    add: translateCoreMock.addHistory,
    findBySourceText: translateCoreMock.findBySourceText,
    findCached: translateCoreMock.findCached
  })
}))

vi.mock('@renderer/pages/translate/custom/hooks/useWorkspaceTranslateHistory', () => ({
  useWorkspaceTranslateHistory: () => ({
    add: translateCoreMock.addHistory,
    findBySourceText: translateCoreMock.findBySourceText,
    findCached: translateCoreMock.findCached
  })
}))

vi.mock('@renderer/hooks/translate/useDetectLang', () => ({
  useDetectLang: () => translateCoreMock.detectLanguage
}))

vi.mock('@renderer/hooks/useDrag', () => ({
  useDrag: (onDrop?: (event: React.DragEvent<HTMLDivElement>) => void) => ({
    isDragging: false,
    handleDragEnter: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDragOver: vi.fn(),
    handleDrop: onDrop ?? vi.fn()
  })
}))

vi.mock('@renderer/hooks/useFiles', () => ({
  useFiles: () => ({
    onSelectFile: fileMock.onSelectFile,
    selecting: false,
    clearFiles: vi.fn()
  })
}))

vi.mock('@renderer/hooks/useJob', () => ({
  useJob: useJobMock
}))

vi.mock('@renderer/hooks/useModel', () => ({
  useModels: () => ({
    models: [
      {
        id: 'openai::gpt-4.1',
        providerId: 'openai',
        name: 'GPT-4.1',
        capabilities: [],
        isHidden: false
      },
      {
        id: 'anthropic::directional',
        providerId: 'anthropic',
        name: 'Directional',
        capabilities: [],
        isHidden: false
      }
    ]
  })
}))

vi.mock('@renderer/hooks/useTemporaryValue', () => ({
  useTemporaryValue: () => [false, vi.fn()]
}))

vi.mock('@renderer/hooks/useSmoothStream', () => ({
  useSmoothStream: ({ onUpdate }: { onUpdate: (text: string) => void }) => ({
    complete: async (text: string) => {
      smoothStreamUpdateMock(text, true)
      await smoothStreamCompleteMock(text)
      onUpdate(text)
    },
    reset: (text = '') => {
      smoothStreamResetMock(text)
      onUpdate(text)
    },
    update: (text: string, isComplete: boolean) => {
      smoothStreamUpdateMock(text, isComplete)
      onUpdate(text)
    }
  })
}))

vi.mock('@renderer/ipc', () => ({
  ipcApi: {
    request: ipcRequestMock,
    on: (event: string, handler: (payload: unknown) => void) => {
      ipcEventHandlers.set(event, handler)
      return () => {
        if (ipcEventHandlers.get(event) === handler) ipcEventHandlers.delete(event)
      }
    }
  },
  useIpcOn: (event: string, handler: (payload: unknown) => void) => {
    ipcEventHandlers.set(event, handler)
  }
}))

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      error: loggerErrorMock,
      warn: loggerWarnMock,
      info: vi.fn(),
      debug: vi.fn()
    })
  }
}))

vi.mock('@renderer/utils/style', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')
}))

vi.mock('@renderer/utils/file', () => ({
  getFileExtension: fileMock.getFileExtension,
  isTextFile: fileMock.isTextFile
}))

vi.mock('@renderer/utils/uuid', () => ({
  uuid: uuidMock
}))

vi.mock('@renderer/utils/error', () => ({
  formatErrorMessageWithPrefix: translateCoreMock.formatErrorMessageWithPrefix,
  isAbortError: translateCoreMock.isAbortError
}))

vi.mock('@renderer/utils/input', () => ({
  getFilesFromDropEvent: dropMock.getFilesFromDropEvent,
  getTextFromDropEvent: dropMock.getTextFromDropEvent
}))

vi.mock('@renderer/utils/translate', async (importOriginal) => ({
  ...(await importOriginal<typeof TranslateUtils>()),
  createInputScrollHandler: () => vi.fn(),
  createOutputScrollHandler: () => vi.fn(),
  resolveTranslatePlan: translateCoreMock.resolveTranslatePlan,
  translateText: translateCoreMock.translateText
}))

vi.mock('../../components/IconButton', () => ({
  default: (props: React.ComponentProps<'button'> & { active?: boolean; size?: string }) => {
    const { active, children, size, ...buttonProps } = props
    void active
    void size
    return (
      <button type="button" {...buttonProps}>
        {children}
      </button>
    )
  }
}))

vi.mock('../components/TranslateHistory', () => ({
  default: ({
    isOpen,
    onHistoryItemClick
  }: {
    isOpen: boolean
    onHistoryItemClick: (
      history: {
        id?: string
        kind: 'text' | 'file'
        sourceText: string
        targetText: string
        sourceLanguage: string | null
        targetLanguage: string | null
      },
      files?: TranslationFiles
    ) => void
  }) =>
    isOpen ? (
      <div data-testid="translate-history-open">
        <button
          type="button"
          aria-label="reuse-known-language-history"
          onClick={() =>
            onHistoryItemClick({
              kind: 'text',
              sourceText: 'history source',
              targetText: '历史译文',
              sourceLanguage: 'en-us',
              targetLanguage: 'zh-cn'
            })
          }
        />
        <button
          type="button"
          aria-label="reuse-null-target-history"
          onClick={() =>
            onHistoryItemClick({
              kind: 'text',
              sourceText: 'hello',
              targetText: '你好',
              sourceLanguage: null,
              targetLanguage: null
            })
          }
        />
        <button
          type="button"
          aria-label="reuse-pdf-history"
          onClick={() =>
            onHistoryItemClick(
              {
                id: 'history-pdf',
                kind: 'file',
                sourceText: 'paper.pdf',
                targetText: 'paper.zh-CN.pdf',
                sourceLanguage: null,
                targetLanguage: null
              },
              historyFilesMock.files
            )
          }
        />
      </div>
    ) : null
}))

vi.mock('../components/TranslateInputPane', () => ({
  default: ({
    text,
    onTextChange,
    onKeyDown,
    onPaste,
    onSelectFile,
    onDrop,
    onCancelOcr,
    disabled,
    ocrProcessing,
    busyLabel
  }: {
    text: string
    onTextChange: (value: string) => void
    onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
    onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
    onSelectFile: () => void
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void
    onCancelOcr: () => void
    disabled?: boolean
    ocrProcessing?: boolean
    busyLabel?: string | null
  }) => {
    translateInputPaneMock({ onSelectFile })
    return (
      <div data-testid="translate-input-pane" onDrop={onDrop}>
        <textarea
          aria-label="translate.input.placeholder"
          disabled={disabled}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
        <button type="button" aria-label="translate.files.upload" onClick={onSelectFile} />
        {busyLabel && !ocrProcessing && (
          <div role="status" data-testid="translate-input-busy-overlay">
            {busyLabel}
          </div>
        )}
        {ocrProcessing && (
          <div data-testid="translate-input-ocr-processing">
            ocr.processing
            <button type="button" onClick={() => onCancelOcr()}>
              common.cancel
            </button>
          </div>
        )}
      </div>
    )
  }
}))

vi.mock('../components/TranslateLanguageBar', () => ({
  default: (props: { detectedLanguage: string | null; isBidirectional: boolean; sourceLanguage: string }) => {
    languageBarMock(props)
    return null
  }
}))

vi.mock('../components/TranslateOutputPane', () => ({
  default: (props: { translating: boolean; translatedContent: string; tokenCount: number; wordCount: number }) => {
    translateOutputPaneMock(props)
    return (
      <div data-testid="translate-output-pane">
        {props.translating && <span>translate.processing</span>}
        <span data-testid="translate-output-content">{props.translatedContent}</span>
      </div>
    )
  }
}))

vi.mock('@renderer/components/translate/TranslateSettings', () => ({
  default: ({ visible }: { visible: boolean }) => (visible ? <div data-testid="translate-settings-open" /> : null)
}))

vi.mock('../../pdf/PdfTranslationView', () => {
  const MockPdfTranslationView = (props: {
    file: { name: string; path: string }
    modelId?: string
    sourceLangCode: string
    babelDocAvailability: 'checking' | 'available' | 'missing' | 'outdated'
    babelDocInstalling: boolean
    textFallback?: { content: React.ReactNode; ocrRequired: boolean }
    restoredOutput?: { outputPath: string; fileName: string } | null
    onClose: () => void
    onHandleChange: (handle: typeof pdfHandleMock | null) => void
    onStatusChange: (status: { phase: 'idle'; running: false }) => void
    onInstallBabelDoc: () => void
  }) => {
    const { onHandleChange, onStatusChange } = props
    const [stateFilePath] = useState(props.file.path)
    pdfViewMock(props)
    useEffect(() => {
      onHandleChange(pdfHandleMock)
      onStatusChange({ phase: 'idle', running: false })
      return () => onHandleChange(null)
    }, [onHandleChange, onStatusChange])
    return (
      <div
        data-testid="pdf-translation-view"
        data-file-path={props.file.path}
        data-state-file-path={stateFilePath}
        data-restored-output={props.restoredOutput?.outputPath}>
        <span data-testid="babeldoc-availability">{props.babelDocAvailability}</span>
        {(props.babelDocAvailability === 'missing' || props.babelDocAvailability === 'outdated') &&
          !props.textFallback && (
            <button
              type="button"
              aria-label={
                props.babelDocAvailability === 'outdated'
                  ? 'translate.pdf.action.update_babeldoc'
                  : 'translate.pdf.action.install_babeldoc'
              }
              onClick={props.onInstallBabelDoc}
            />
          )}
        {props.textFallback?.content}
        <button type="button" aria-label="translate.pdf.action.close" onClick={props.onClose} />
      </div>
    )
  }
  return { default: MockPdfTranslationView }
})

import TranslatePage from '../TranslatePage'

describe('TranslatePage', () => {
  beforeEach(() => {
    translationWorkspaceService.resetForTests()
    routeMocks.navigate.mockReset()
    routeMocks.search = {}
    sessionStorage.clear()
    MockUseCacheUtils.resetMocks()
    MockUsePreferenceUtils.resetMocks()
    MockUseCacheUtils.setCacheValue('translate.input', '')
    MockUseCacheUtils.setCacheValue('translate.output', '')
    MockUseCacheUtils.setCacheValue('translate.detecting', false)
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': null,
      'feature.translate.model.native_to_other_follows_global': true,
      'feature.translate.model.native_to_other_id': null,
      'feature.translate.model.other_to_native_follows_global': true,
      'feature.translate.model.other_to_native_id': null,
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.target_language': 'zh-cn',
      'feature.translate.model_prompt': '',
      'feature.translate.page.auto_copy': false,
      'feature.translate.page.bidirectional_pair': ['en-us', 'zh-cn'],
      'feature.translate.page.scroll_sync': false,
      'feature.translate.page.bidirectional_enabled': false,
      'feature.translate.page.enable_markdown': false,
      'feature.translate.polish.enabled': false,
      'feature.translate.post_processing.enabled': true,
      'feature.translate.post_processing.english_straight_quotes': false,
      'feature.translate.post_processing.zh_smart_quotes': false,
      'feature.translate.post_processing.zh_text_spacing': false,
      'feature.translate.post_processing.regex_rules': [],
      'feature.translate.page.json_structure_view': false,
      'feature.translate.page.json_structure_copy_separator': 'colon-space',
      'feature.translate.page.json_structure_copy_blank_line': false,
      'feature.translate.page.font_size': 16,
      'feature.translate.page.layout_override': 'auto'
    })
    fileMock.onSelectFile.mockReset()
    fileMock.readText.mockReset()
    fileMock.readExternal.mockReset()
    fileMock.startJob.mockReset()
    fileMock.getFileExtension.mockReset()
    fileMock.getFileExtension.mockReturnValue('txt')
    fileMock.isTextFile.mockResolvedValue(true)
    fileMock.getPathForFile.mockReset()
    fileMock.createTempFile.mockReset()
    fileMock.write.mockReset()
    fileMock.write.mockResolvedValue(undefined)
    fileMock.get.mockReset()
    fileMock.startJob.mockResolvedValue({
      id: 'job-ocr-1',
      type: 'file-processing.background',
      status: 'pending'
    })
    ipcRequestMock.mockReset()
    ipcEventHandlers.clear()
    binaryMock.snapshots = { 'babeldoc-stream': babeldocInstalledSnapshot }
    ipcRequestMock.mockImplementation((channel: string, payload?: unknown) => {
      if (channel === 'file_processing.start_job') return fileMock.startJob(payload)
      if (channel === 'binary.get_tool_snapshots') return Promise.resolve(binaryMock.snapshots)
      if (channel === 'binary.install_tool') return Promise.resolve(undefined)
      if (channel === 'translate.clipboard.read') return Promise.resolve({ html: '', text: 'hello' })
      return Promise.resolve(undefined)
    })
    fileMock.readExternal.mockResolvedValue('document content')
    uuidMock.mockReset()
    uuidMock.mockReturnValue('abort-key')
    useJobMock.mockReset()
    useJobMock.mockReturnValue({ data: undefined, isTerminal: false })
    dropMock.getFilesFromDropEvent.mockReset()
    dropMock.getFilesFromDropEvent.mockResolvedValue(null)
    dropMock.getTextFromDropEvent.mockReset()
    dropMock.getTextFromDropEvent.mockResolvedValue(null)
    translateCoreMock.addHistory.mockReset()
    translateCoreMock.addHistory.mockResolvedValue(undefined)
    translateCoreMock.detectLanguage.mockReset()
    translateCoreMock.detectLanguage.mockResolvedValue('en-us')
    translateCoreMock.findCached.mockReset()
    translateCoreMock.findCached.mockResolvedValue(undefined)
    translateCoreMock.findBySourceText.mockReset()
    translateCoreMock.findBySourceText.mockResolvedValue([])
    translateCoreMock.resolveTranslatePlan.mockReset()
    translateCoreMock.resolveTranslatePlan.mockResolvedValue('openai::gpt-4.1')
    translateCoreMock.translateText.mockReset()
    translateCoreMock.translateText.mockResolvedValue('translated text')
    smoothStreamUpdateMock.mockReset()
    smoothStreamCompleteMock.mockReset()
    smoothStreamCompleteMock.mockResolvedValue(undefined)
    smoothStreamResetMock.mockReset()
    translateCoreMock.isAbortError.mockReset()
    translateCoreMock.isAbortError.mockReturnValue(false)
    translateCoreMock.formatErrorMessageWithPrefix.mockReset()
    translateCoreMock.formatErrorMessageWithPrefix.mockImplementation((_: unknown, prefix: string) => prefix)
    loggerWarnMock.mockReset()
    loggerErrorMock.mockReset()
    clipboardWriteTextMock.mockReset()
    modelSelectorMock.mockReset()
    languageBarMock.mockReset()
    translateInputPaneMock.mockReset()
    translateOutputPaneMock.mockReset()
    clipboardWriteTextMock.mockResolvedValue(undefined)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024, writable: true })
    pdfViewMock.mockReset()
    pdfHandleMock.cancel.mockReset()
    pdfHandleMock.start.mockReset()
    historyFilesMock.files = {
      source: { entryId: 'entry-source', path: '/tmp/paper.pdf' as AbsoluteFilePath },
      target: { entryId: 'entry-target', path: '/tmp/files/entry-target.pdf' as AbsoluteFilePath }
    }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteTextMock
      }
    })
    ;(window as any).api = {
      file: {
        readExternal: fileMock.readExternal,
        getPathForFile: fileMock.getPathForFile,
        createTempFile: fileMock.createTempFile,
        write: fileMock.write,
        get: fileMock.get
      },
      fs: {
        readText: fileMock.readText
      }
    }
  })

  afterEach(() => {
    cleanup()
    translationWorkspaceService.resetForTests()
  })

  it('hides the model tag filter on the inline selector', () => {
    render(<TranslatePage />)

    expect(modelSelectorMock).toHaveBeenCalledWith(expect.objectContaining({ showTagFilter: false }))
  })

  it('keeps primary actions and the model control in a narrow toolbar', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 899, writable: true })

    render(<TranslatePage />)

    expect(modelSelectorMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'translate.button.translate' })).toBeInTheDocument()
  })

  it('desaturates the global-model shortcut while the current direction uses another model', () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.model.other_to_native_follows_global': false,
      'feature.translate.model.other_to_native_id': 'anthropic::directional',
      'feature.translate.native_language': 'zh-cn',
      'feature.translate.page.target_language': 'zh-cn'
    })

    render(<TranslatePage />)

    expect(screen.getByRole('button', { name: 'GPT-4.1' })).toHaveClass('saturate-0')
  })

  it('keeps the global-model shortcut saturated when the direction follows global', () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.model.other_to_native_follows_global': true,
      'feature.translate.model.other_to_native_id': 'anthropic::directional',
      'feature.translate.native_language': 'zh-cn',
      'feature.translate.page.target_language': 'zh-cn'
    })

    render(<TranslatePage />)

    expect(screen.getByRole('button', { name: 'GPT-4.1' })).not.toHaveClass('saturate-0')
  })

  it('uses a black fill and white text for the enabled translate action', async () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.model_id', 'openai::gpt-4.1')
    const { rerender } = render(<TranslatePage />)

    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)

    const translateButton = screen.getByRole('button', { name: 'translate.button.translate' })
    await waitFor(() => expect(translateButton).toBeEnabled())
    expect(translateButton).toHaveClass('bg-neutral-900', 'text-white', 'hover:bg-neutral-800')
    expect(translateButton).not.toHaveClass('bg-primary', 'text-primary-foreground')
  })

  it('keeps the input and output panes side by side with a draggable divider by default', () => {
    render(<TranslatePage />)

    const inputSection = screen.getByTestId('translate-input-pane').parentElement
    const outputSection = screen.getByTestId('translate-output-pane').parentElement

    expect(inputSection?.parentElement).toHaveStyle({
      gridTemplateColumns:
        'minmax(var(--translate-pane-min-width), 50%) 6px minmax(var(--translate-pane-min-width), 1fr)'
    })
    expect(outputSection?.parentElement).toBe(inputSection?.parentElement)
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical')
  })

  it('appends selected file text to the latest input after async read completes', async () => {
    let resolveRead: (value: string) => void = () => {}
    fileMock.onSelectFile.mockResolvedValue([{ path: '/tmp/input.txt', size: 10 }])
    fileMock.readText.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveRead = resolve
      })
    )

    const { rerender } = render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))
    await waitFor(() => expect(fileMock.readText).toHaveBeenCalledWith('/tmp/input.txt'))

    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), {
      target: { value: 'typed while reading ' }
    })
    rerender(<TranslatePage />)

    await act(async () => {
      resolveRead('file content')
    })

    await waitFor(() => {
      expect(MockUseCacheUtils.getCacheValue('translate.input')).toBe('typed while reading file content')
    })
    rerender(<TranslatePage />)
    expect(screen.getByLabelText('translate.input.placeholder')).toHaveValue('typed while reading file content')
  })

  it('reconnects an OCR job after remount and appends its text once', async () => {
    fileMock.onSelectFile.mockResolvedValue([{ path: '/tmp/image.png', size: 10, type: 'image' }])

    const { unmount } = render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() =>
      expect(fileMock.startJob).toHaveBeenCalledWith({
        feature: 'image_to_text',
        file: { kind: 'path', path: '/tmp/image.png' }
      })
    )
    expect(toast.loading).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByTestId('translate-input-ocr-processing')).toHaveTextContent('ocr.processing')
    )
    await waitFor(() => expect(screen.getByLabelText('translate.input.placeholder')).toBeDisabled())
    expect(fileMock.readText).not.toHaveBeenCalled()
    unmount()

    useJobMock.mockReturnValue({
      data: {
        id: 'job-ocr-1',
        type: 'file-processing.background',
        status: 'completed',
        output: { artifact: { kind: 'text', format: 'plain', text: 'recognized image text' } },
        error: null
      },
      isTerminal: true
    })
    const remounted = render(<TranslatePage />)

    await waitFor(() => expect(MockUseCacheUtils.getCacheValue('translate.input')).toBe('recognized image text'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('translate.files.ocr_completed'))
    await waitFor(() => expect(screen.queryByTestId('translate-input-ocr-processing')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText('translate.input.placeholder')).not.toBeDisabled())
    remounted.rerender(<TranslatePage />)
    expect(screen.getByLabelText('translate.input.placeholder')).toHaveValue('recognized image text')
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('treats a completed OCR job without a text artifact as a failure', async () => {
    fileMock.onSelectFile.mockResolvedValue([{ path: '/tmp/image.png', size: 10, type: 'image' }])

    const { rerender } = render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(fileMock.startJob).toHaveBeenCalledTimes(1))
    expect(toast.loading).not.toHaveBeenCalled()

    useJobMock.mockReturnValue({
      data: {
        id: 'job-ocr-1',
        type: 'file-processing.background',
        status: 'completed',
        output: { artifact: { kind: 'file', format: 'markdown', path: '/tmp/ocr.md' } },
        error: null
      },
      isTerminal: true
    })
    rerender(<TranslatePage />)

    expect(translateCoreMock.formatErrorMessageWithPrefix).toHaveBeenCalledWith(
      expect.any(Error),
      'translate.files.error.ocr'
    )
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('translate.files.error.ocr'))
    expect(toast.closeToast).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText('translate.input.placeholder')).not.toBeDisabled())
    expect(MockUseCacheUtils.getCacheValue('translate.input')).toBe('')
  })

  it('locally cancels OCR from the overlay and ignores a later completed snapshot', async () => {
    fileMock.onSelectFile.mockResolvedValue([{ path: '/tmp/image.png', size: 10, type: 'image' }])

    const { rerender } = render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(fileMock.startJob).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByLabelText('translate.input.placeholder')).toBeDisabled())
    expect(screen.getByTestId('translate-input-ocr-processing')).toHaveTextContent('ocr.processing')

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => expect(screen.queryByTestId('translate-input-ocr-processing')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText('translate.input.placeholder')).not.toBeDisabled())

    useJobMock.mockReturnValue({
      data: {
        id: 'job-ocr-1',
        type: 'file-processing.background',
        status: 'completed',
        output: { artifact: { kind: 'text', format: 'plain', text: 'late recognized text' } },
        error: null
      },
      isTerminal: true
    })
    rerender(<TranslatePage />)

    expect(MockUseCacheUtils.getCacheValue('translate.input')).toBe('')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('opens selected PDFs in layout-preserving translation mode instead of extracting text', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1'
    })
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'input.pdf', path: '/tmp/input.pdf', size: 10, type: 'document' }])

    render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() =>
      expect(screen.getByTestId('pdf-translation-view')).toHaveAttribute('data-file-path', '/tmp/input.pdf')
    )
    expect(pdfViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ file: { name: 'input.pdf', path: '/tmp/input.pdf' } })
    )
    expect(fileMock.readExternal).not.toHaveBeenCalled()
    expect(fileMock.startJob).not.toHaveBeenCalled()

    const translateButton = screen.getByRole('button', { name: 'translate.button.translate' })
    await waitFor(() => expect(translateButton).toBeEnabled())
    fireEvent.click(translateButton)

    expect(pdfHandleMock.start).toHaveBeenCalledWith('zh-cn')
  })

  it('restores the native PDF shell from the active workspace context', async () => {
    translationWorkspaceService.begin('pdf', {
      jobId: 'pdf-job',
      pdfContext: {
        sourceFileName: 'restored.pdf',
        sourcePath: '/tmp/restored.pdf' as AbsoluteFilePath,
        textFallback: false
      },
      stage: 'translating',
      status: 'running'
    })

    render(<TranslatePage />)

    await waitFor(() =>
      expect(screen.getByTestId('pdf-translation-view')).toHaveAttribute('data-file-path', '/tmp/restored.pdf')
    )
    expect(pdfViewMock).toHaveBeenLastCalledWith(expect.objectContaining({ textFallback: undefined }))
  })

  it('restores a PDF text fallback shell and returns to the saved text when closed', async () => {
    MockUseCacheUtils.setCacheValue('translate.input', 'previous input')
    MockUseCacheUtils.setCacheValue('translate.output', 'previous display')
    translationWorkspaceService.begin('text', {
      pdfContext: {
        sourceFileName: 'fallback.pdf',
        sourcePath: '/tmp/fallback.pdf' as AbsoluteFilePath,
        textFallback: true,
        previousRawOutput: 'previous raw',
        previousDisplayOutput: 'previous display'
      },
      rawOutput: 'partial fallback translation',
      sourceText: 'PDF extracted text',
      stage: 'translating',
      status: 'running'
    })

    render(<TranslatePage />)

    await waitFor(() =>
      expect(screen.getByTestId('pdf-translation-view')).toHaveAttribute('data-file-path', '/tmp/fallback.pdf')
    )
    await waitFor(() =>
      expect(screen.getByTestId('translate-output-content')).toHaveTextContent('partial fallback translation')
    )

    fireEvent.click(screen.getByRole('button', { name: 'translate.pdf.action.close' }))
    await waitFor(() => expect(MockUseCacheUtils.getCacheValue('translate.input')).toBe('previous input'))
    await waitFor(() => expect(MockUseCacheUtils.getCacheValue('translate.output')).toBe('previous display'))
  })

  it('discards PDF view state when a different PDF replaces the selected file', async () => {
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile
      .mockResolvedValueOnce([{ name: 'first.pdf', path: '/tmp/first.pdf', size: 10, type: 'document' }])
      .mockResolvedValueOnce([{ name: 'second.pdf', path: '/tmp/second.pdf', size: 10, type: 'document' }])

    render(<TranslatePage />)
    const selectFile = translateInputPaneMock.mock.calls.at(-1)?.[0].onSelectFile as () => Promise<void>

    await act(selectFile)
    await waitFor(() =>
      expect(screen.getByTestId('pdf-translation-view')).toHaveAttribute('data-state-file-path', '/tmp/first.pdf')
    )

    await act(selectFile)
    await waitFor(() =>
      expect(screen.getByTestId('pdf-translation-view')).toHaveAttribute('data-file-path', '/tmp/second.pdf')
    )
    expect(screen.getByTestId('pdf-translation-view')).toHaveAttribute('data-state-file-path', '/tmp/second.pdf')
  })

  it('warns and skips layout-preserving translation when source and target language are the same', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'en-us'
    })
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'input.pdf', path: '/tmp/input.pdf', size: 10, type: 'document' }])

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(screen.getByTestId('babeldoc-availability')).toHaveTextContent('available'))
    const translateButton = screen.getByRole('button', { name: 'translate.button.translate' })
    await waitFor(() => expect(translateButton).toBeEnabled())
    fireEvent.click(translateButton)

    // A same-language layout translation is a no-op that still spawns BabelDOC and bills a run —
    // guard it exactly like the text path, so it never reaches the sidecar.
    expect(toast.warning).toHaveBeenCalledWith('translate.language.same')
    expect(pdfHandleMock.start).not.toHaveBeenCalled()
  })

  it('falls back to streamed text translation when BabelDOC is not installed', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn'
    })
    binaryMock.snapshots = {}
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'input.pdf', path: '/tmp/input.pdf', size: 10, type: 'document' }])
    fileMock.readExternal.mockResolvedValue('PDF extracted text')
    translateCoreMock.translateText.mockImplementationOnce(
      async (_text: string, _targetLanguage: string, onResponse?: (text: string, isComplete: boolean) => void) => {
        onResponse?.('streamed translation', false)
        return 'translated text'
      }
    )

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(screen.getByTestId('babeldoc-availability')).toHaveTextContent('missing'))
    const translateButton = screen.getByRole('button', { name: 'translate.button.translate' })
    await waitFor(() => expect(translateButton).toBeEnabled())
    fireEvent.click(translateButton)

    await waitFor(() => expect(fileMock.readExternal).toHaveBeenCalledWith('/tmp/input.pdf', true))
    await waitFor(() =>
      expect(translateCoreMock.translateText).toHaveBeenCalledWith(
        'PDF extracted text',
        'zh-cn',
        expect.any(Function),
        expect.any(AbortSignal),
        expect.objectContaining({
          modelId: 'openai::gpt-4.1',
          operation: 'translate',
          sourceLangCode: 'en-us'
        })
      )
    )
    expect(pdfHandleMock.start).not.toHaveBeenCalled()
    expect(screen.getByTestId('translate-output-content')).toHaveTextContent('translated text')

    fireEvent.click(screen.getByRole('button', { name: 'translate.pdf.action.close' }))
    await waitFor(() => expect(MockUseCacheUtils.getCacheValue('translate.input')).toBe(''))
    await waitFor(() => expect(MockUseCacheUtils.getCacheValue('translate.output')).toBe(''))
  })

  it('unlocks the PDF text fallback UI immediately when translation is stopped', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn'
    })
    binaryMock.snapshots = {}
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'input.pdf', path: '/tmp/input.pdf', size: 10, type: 'document' }])
    fileMock.readExternal.mockResolvedValue('PDF extracted text')
    translateCoreMock.translateText.mockReturnValueOnce(new Promise<string>(() => {}))

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(screen.getByTestId('babeldoc-availability')).toHaveTextContent('missing'))
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'common.stop' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'common.stop' }))

    expect(toast.info).toHaveBeenCalledWith('translate.info.aborted')
    await waitFor(() => expect(screen.queryByText('translate.processing')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'translate.button.translate' })).toBeEnabled()
  })

  it('does not start PDF text fallback translation after closing during language detection', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.target_language': 'zh-cn'
    })
    binaryMock.snapshots = {}
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'input.pdf', path: '/tmp/input.pdf', size: 10, type: 'document' }])
    fileMock.readExternal.mockResolvedValue('PDF extracted text')
    let resolveDetection!: (language: string) => void
    translateCoreMock.detectLanguage.mockReturnValue(
      new Promise((resolve) => {
        resolveDetection = resolve
      })
    )

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))
    await waitFor(() => expect(screen.getByTestId('babeldoc-availability')).toHaveTextContent('missing'))
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))
    await waitFor(() => expect(translateCoreMock.detectLanguage).toHaveBeenCalledWith('PDF extracted text'))

    fireEvent.click(screen.getByRole('button', { name: 'translate.pdf.action.close' }))
    await act(async () => resolveDetection('en-us'))

    expect(translateCoreMock.translateText).not.toHaveBeenCalled()
  })

  it('installs BabelDOC Stream from the PDF prompt without starting translation', async () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.model_id', 'openai::gpt-4.1')
    binaryMock.snapshots = {}
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'input.pdf', path: '/tmp/input.pdf', size: 10, type: 'document' }])

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(screen.getByTestId('babeldoc-availability')).toHaveTextContent('missing'))
    fireEvent.click(screen.getByRole('button', { name: 'translate.pdf.action.install_babeldoc' }))

    await waitFor(() => expect(ipcRequestMock).toHaveBeenCalledWith('binary.install_tool', { name: 'babeldoc-stream' }))
    await waitFor(() => expect(screen.getByTestId('babeldoc-availability')).toHaveTextContent('available'))
    expect(pdfHandleMock.start).not.toHaveBeenCalled()
  })

  it('updates an outdated BabelDOC before layout-preserving translation', async () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.model_id', 'openai::gpt-4.1')
    binaryMock.snapshots = {
      'babeldoc-stream': {
        name: 'babeldoc-stream',
        availability: { source: 'mise', path: '/shims/babeldoc-stream' },
        application: { status: 'applied', version: '0.6.4.post1' }
      }
    }
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'input.pdf', path: '/tmp/input.pdf', size: 10, type: 'document' }])

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(screen.getByTestId('babeldoc-availability')).toHaveTextContent('outdated'))
    fireEvent.click(screen.getByRole('button', { name: 'translate.pdf.action.update_babeldoc' }))

    await waitFor(() =>
      expect(ipcRequestMock).toHaveBeenCalledWith('binary.install_tool', {
        name: 'babeldoc-stream',
        targetVersion: '0.6.4.post4'
      })
    )
  })

  it('keeps text fallback available when inline BabelDOC installation fails', async () => {
    const installError = new Error('install failed')
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn'
    })
    binaryMock.snapshots = {}
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'input.pdf', path: '/tmp/input.pdf', size: 10, type: 'document' }])
    ipcRequestMock.mockImplementation((channel: string) => {
      if (channel === 'binary.get_tool_snapshots') return Promise.resolve(binaryMock.snapshots)
      if (channel === 'binary.install_tool') return Promise.reject(installError)
      return Promise.resolve(undefined)
    })

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(screen.getByTestId('babeldoc-availability')).toHaveTextContent('missing'))
    fireEvent.click(screen.getByRole('button', { name: 'translate.pdf.action.install_babeldoc' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('settings.dependencies.installError'))
    expect(screen.getByTestId('babeldoc-availability')).toHaveTextContent('missing')
    await waitFor(() => expect(screen.getByRole('button', { name: 'translate.button.translate' })).toBeEnabled())
  })

  it('reports OCR as required when text fallback extracts no content', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.target_language': 'zh-cn'
    })
    binaryMock.snapshots = {}
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'scan.pdf', path: '/tmp/scan.pdf', size: 10, type: 'document' }])
    fileMock.readExternal.mockResolvedValue('  ')

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    const translateButton = screen.getByRole('button', { name: 'translate.button.translate' })
    await waitFor(() => expect(translateButton).toBeEnabled())
    fireEvent.click(translateButton)

    await waitFor(() =>
      expect(pdfViewMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ textFallback: expect.objectContaining({ ocrRequired: true }) })
      )
    )
    expect(translateCoreMock.translateText).not.toHaveBeenCalled()
  })

  it('clears extracted PDF text cache when a different PDF is selected', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn'
    })
    binaryMock.snapshots = {}
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile
      .mockResolvedValueOnce([{ name: 'first.pdf', path: '/tmp/first.pdf', size: 10, type: 'document' }])
      .mockResolvedValueOnce([{ name: 'second.pdf', path: '/tmp/second.pdf', size: 10, type: 'document' }])
    fileMock.readExternal.mockImplementation(async (filePath: string) =>
      filePath.includes('first') ? 'first PDF text' : 'second PDF text'
    )

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))
    const translateButton = screen.getByRole('button', { name: 'translate.button.translate' })
    await waitFor(() => expect(translateButton).toBeEnabled())
    fireEvent.click(translateButton)
    await waitFor(() => expect(fileMock.readExternal).toHaveBeenCalledWith('/tmp/first.pdf', true))

    fireEvent.click(screen.getByRole('button', { name: 'translate.pdf.action.close' }))
    await waitFor(() => expect(MockUseCacheUtils.getCacheValue('translate.input')).toBe(''))
    await waitFor(() => expect(MockUseCacheUtils.getCacheValue('translate.output')).toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))
    await waitFor(() =>
      expect(screen.getByTestId('pdf-translation-view')).toHaveAttribute('data-file-path', '/tmp/second.pdf')
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'translate.button.translate' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(fileMock.readExternal).toHaveBeenCalledWith('/tmp/second.pdf', true))
    expect(fileMock.readExternal).toHaveBeenCalledTimes(2)
  })

  it('previews a selected PDF but keeps translation disabled until a model is selected', async () => {
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'input.pdf', path: '/tmp/input.pdf', size: 10, type: 'document' }])

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(screen.getByTestId('pdf-translation-view')).toBeInTheDocument())
    expect(pdfViewMock).toHaveBeenCalledWith(expect.objectContaining({ modelId: undefined }))
    expect(screen.getByRole('button', { name: 'translate.button.translate' })).toBeDisabled()
  })

  it('uses explicit language controls and requires a concrete target in PDF mode', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.bidirectional_enabled': true,
      'feature.translate.page.target_language': 'unknown'
    })
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'input.pdf', path: '/tmp/input.pdf', size: 10, type: 'document' }])

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(screen.getByTestId('pdf-translation-view')).toBeInTheDocument())
    expect(languageBarMock).toHaveBeenLastCalledWith(expect.objectContaining({ isBidirectional: false }))
    expect(screen.getByRole('button', { name: 'translate.button.translate' })).toBeDisabled()
    expect(pdfHandleMock.start).not.toHaveBeenCalled()
  })

  it('filters models that the API gateway cannot route while translating PDFs', async () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.model_id', 'openai::gpt-4.1')
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([{ name: 'input.pdf', path: '/tmp/input.pdf', size: 10, type: 'document' }])

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(screen.getByTestId('pdf-translation-view')).toBeInTheDocument())
    const filter = modelSelectorMock.mock.calls.at(-1)?.[0].filter as (model: {
      capabilities: string[]
      providerId: string
    }) => boolean
    expect(filter({ capabilities: [], providerId: 'corp:west' })).toBe(false)
  })

  it('shows an unavailable error when startJob rejects before an OCR job exists', async () => {
    const ocrError = new Error('Default file processor for image_to_text is not configured')
    fileMock.onSelectFile.mockResolvedValue([{ path: '/tmp/image.png', size: 10, type: 'image' }])
    fileMock.startJob.mockRejectedValueOnce(ocrError)
    translateCoreMock.formatErrorMessageWithPrefix.mockImplementationOnce((_error: unknown, prefix: string) => {
      return `${prefix}: Default file processor for image_to_text is not configured`
    })

    render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() =>
      expect(translateCoreMock.formatErrorMessageWithPrefix).toHaveBeenCalledWith(ocrError, 'translate.files.error.ocr')
    )
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'translate.files.error.ocr: Default file processor for image_to_text is not configured'
      )
    )
    expect(toast.loading).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText('translate.input.placeholder')).not.toBeDisabled())
  })

  it('shows an OCR error and unlocks the page when the observed OCR job fails', async () => {
    fileMock.onSelectFile.mockResolvedValue([{ path: '/tmp/image.png', size: 10, type: 'image' }])

    const { rerender } = render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(screen.getByLabelText('translate.input.placeholder')).toBeDisabled())
    useJobMock.mockReturnValue({
      data: {
        id: 'job-ocr-1',
        type: 'file-processing.background',
        status: 'failed',
        output: null,
        error: { message: 'OCR failed' }
      },
      isTerminal: true
    })
    rerender(<TranslatePage />)

    expect(translateCoreMock.formatErrorMessageWithPrefix).toHaveBeenCalledWith(
      expect.any(Error),
      'translate.files.error.ocr'
    )
    const formattedError = translateCoreMock.formatErrorMessageWithPrefix.mock.calls.at(-1)?.[0] as Error | undefined
    expect(formattedError?.message).toBe('OCR failed')
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('translate.files.error.ocr'))
    expect(toast.closeToast).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText('translate.input.placeholder')).not.toBeDisabled())
  })

  it('surfaces an error and unlocks the page when the OCR job becomes unobservable', async () => {
    fileMock.onSelectFile.mockResolvedValue([{ path: '/tmp/image.png', size: 10, type: 'image' }])

    const { rerender } = render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    await waitFor(() => expect(screen.getByLabelText('translate.input.placeholder')).toBeDisabled())
    useJobMock.mockReturnValue({
      data: null,
      isTerminal: false,
      error: new Error('job not found')
    })
    rerender(<TranslatePage />)

    expect(translateCoreMock.formatErrorMessageWithPrefix).toHaveBeenCalledWith(
      expect.any(Error),
      'translate.files.error.ocr'
    )
    const formattedError = translateCoreMock.formatErrorMessageWithPrefix.mock.calls.at(-1)?.[0] as Error | undefined
    expect(formattedError?.message).toBe('job not found')
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('translate.files.error.ocr'))
    await waitFor(() => expect(screen.queryByTestId('translate-input-ocr-processing')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText('translate.input.placeholder')).not.toBeDisabled())
  })

  it('starts an image_to_text job for an image dropped onto the input pane', async () => {
    dropMock.getFilesFromDropEvent.mockResolvedValue([{ path: '/tmp/x.png', size: 10, type: 'image' }])

    render(<TranslatePage />)

    fireEvent.drop(screen.getByTestId('translate-input-pane'))

    await waitFor(() =>
      expect(fileMock.startJob).toHaveBeenCalledWith({
        feature: 'image_to_text',
        file: { kind: 'path', path: '/tmp/x.png' }
      })
    )
  })

  it('starts an image_to_text job for a pasted image without a file path', async () => {
    fileMock.getPathForFile.mockReturnValue('')
    fileMock.createTempFile.mockResolvedValue('/tmp/pasted.png')
    fileMock.get.mockResolvedValue({ path: '/tmp/pasted.png', size: 10, type: 'image' })

    render(<TranslatePage />)

    const pastedImage = {
      name: 'pasted.png',
      type: 'image/png',
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
    }
    fireEvent.paste(screen.getByLabelText('translate.input.placeholder'), {
      clipboardData: {
        getData: () => '',
        files: [pastedImage]
      }
    })

    await waitFor(() =>
      expect(fileMock.startJob).toHaveBeenCalledWith({
        feature: 'image_to_text',
        file: { kind: 'path', path: '/tmp/pasted.png' }
      })
    )
    // Pasted images have no path → temp-file fallback (createTempFile + write) runs before the job starts.
    expect(fileMock.createTempFile).toHaveBeenCalledWith('pasted.png')
    expect(fileMock.write).toHaveBeenCalled()
  })

  it('ignores empty text data when handling drops', async () => {
    dropMock.getTextFromDropEvent.mockResolvedValue('')

    render(<TranslatePage />)

    fireEvent.drop(screen.getByTestId('translate-input-pane'))

    await waitFor(() => expect(dropMock.getTextFromDropEvent).toHaveBeenCalled())
    expect(screen.getByLabelText('translate.input.placeholder')).toHaveValue('')
  })

  it('keeps translating enabled for plain-text paste without entering file-processing state', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'zh-cn',
      'feature.translate.page.target_language': 'en-us'
    })

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.paste(screen.getByLabelText('translate.input.placeholder'), {
      clipboardData: {
        getData: () => 'pasted text',
        files: []
      }
    })
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(translateCoreMock.translateText).toHaveBeenCalledTimes(1))
  })

  it('keeps authoritative Markdown when pasted HTML only contains editor wrappers', () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.page.html_conversion_on_paste', true)
    const view = render(<TranslatePage />)
    const textarea = view.getByLabelText('translate.input.placeholder')

    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (type: string) =>
          type === 'text/html' ? '<div><span># Heading</span><br><span>- item</span></div>' : '# Heading\n\n- item',
        files: []
      }
    })

    view.rerender(<TranslatePage />)
    expect(view.getByLabelText('translate.input.placeholder')).toHaveValue('# Heading\n\n- item')
  })

  it('formats pasted Markdown when the preference is enabled', () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.page.format_markdown_on_paste', true)
    const view = render(<TranslatePage />)
    const textarea = view.getByLabelText('translate.input.placeholder')

    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? '# Heading\ntext\n\n* item' : ''),
        files: []
      }
    })

    view.rerender(<TranslatePage />)
    expect(view.getByLabelText('translate.input.placeholder')).toHaveValue('# Heading\n\ntext\n\n- item')
  })

  it('applies before-translation regex rules once before formatting pasted Markdown', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn',
      'feature.translate.page.format_markdown_on_paste': true,
      'feature.translate.post_processing.regex_rules': [
        { id: 'before-1', pattern: 'text', replacement: 'text text', flags: 'g', enabled: true, stage: 'before' },
        {
          id: 'before-2',
          pattern: '\\* item',
          replacement: '* normalized',
          flags: 'gm',
          enabled: true,
          stage: 'before'
        }
      ]
    })
    const view = render(<TranslatePage />)
    const textarea = view.getByLabelText('translate.input.placeholder')

    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? '# Heading\ntext\n\n* item' : ''),
        files: []
      }
    })

    view.rerender(<TranslatePage />)
    expect(view.getByLabelText('translate.input.placeholder')).toHaveValue('# Heading\n\ntext text\n\n- normalized')

    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))
    await waitFor(() =>
      expect(translateCoreMock.translateText).toHaveBeenCalledWith(
        '# Heading\n\ntext text\n\n- normalized',
        'zh-cn',
        expect.any(Function),
        expect.any(AbortSignal),
        expect.objectContaining({ operation: 'translate' })
      )
    )
  })

  it('uses plain text for the one paste following Ctrl/Cmd+Shift+V', () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.page.format_markdown_on_paste', true)
    const view = render(<TranslatePage />)
    const textarea = view.getByLabelText('translate.input.placeholder')
    fireEvent.keyDown(textarea, { ctrlKey: true, shiftKey: true, key: 'v' })

    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (type: string) =>
          type === 'text/html' ? '<strong>rich text</strong>' : '# plain Markdown\ntext\n\n* item',
        files: []
      }
    })

    view.rerender(<TranslatePage />)
    expect(view.getByLabelText('translate.input.placeholder')).toHaveValue('# plain Markdown\ntext\n\n* item')
  })

  it('routes the primary action through polish then translate when persistent polish mode is enabled', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'zh-cn',
      'feature.translate.page.target_language': 'en-us',
      'feature.translate.polish.enabled': true
    })
    translateCoreMock.translateText.mockImplementationOnce(
      async (
        _text: string,
        _targetLanguage: string,
        _onResponse: unknown,
        _signal: AbortSignal,
        options: { onTraceReady?: (traceId: string) => void }
      ) => {
        options.onTraceReady?.('0123456789abcdef0123456789abcdef')
        return 'translated text'
      }
    )

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'rough text' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(translateCoreMock.translateText).toHaveBeenCalledTimes(2))
    expect(translateCoreMock.translateText).toHaveBeenNthCalledWith(
      1,
      'rough text',
      'en-us',
      expect.any(Function),
      expect.any(AbortSignal),
      expect.objectContaining({ operation: 'polish', traceTopicId: expect.stringMatching(/^translate:/) })
    )
    expect(translateCoreMock.translateText).toHaveBeenNthCalledWith(
      2,
      'translated text',
      'en-us',
      expect.any(Function),
      expect.any(AbortSignal),
      expect.objectContaining({
        operation: 'translate',
        traceId: '0123456789abcdef0123456789abcdef',
        traceTopicId: expect.stringMatching(/^translate:/)
      })
    )
    const firstScope = translateCoreMock.translateText.mock.calls[0][4] as { traceTopicId: string }
    const secondScope = translateCoreMock.translateText.mock.calls[1][4] as { traceTopicId: string }
    expect(secondScope.traceTopicId).toBe(firstScope.traceTopicId)
  })

  it('shows warning and skips translate when source and target language are the same', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'zh-cn',
      'feature.translate.page.target_language': 'zh-cn'
    })

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('translate.language.same'))
    expect(translateCoreMock.translateText).not.toHaveBeenCalled()
  })

  it('continues translating with the selected target when auto detection returns unknown', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.target_language': 'en-us'
    })
    translateCoreMock.detectLanguage.mockResolvedValueOnce('unknown')

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() =>
      expect(translateCoreMock.translateText).toHaveBeenCalledWith(
        'hello',
        'en-us',
        expect.any(Function),
        expect.any(AbortSignal),
        expect.objectContaining({
          modelId: 'openai::gpt-4.1',
          operation: 'translate',
          sourceLangCode: 'unknown'
        })
      )
    )
    expect(toast.error).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(translateCoreMock.addHistory).toHaveBeenCalledWith({
        sourceText: 'hello',
        targetText: 'translated text',
        sourceLanguage: 'unknown',
        targetLanguage: 'en-us',
        modelId: 'openai::gpt-4.1',
        cacheKey: 'translate:openai::gpt-4.1:unknown:en-us:hello'
      })
    )
  })

  it('keeps the post-processed result behind the smooth stream completion boundary', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn',
      'feature.translate.post_processing.regex_rules': [
        { pattern: 'OpenAI', replacement: 'AI', flags: 'g', enabled: true }
      ]
    })
    translateCoreMock.translateText.mockImplementationOnce(
      async (_text: string, _targetLanguage: string, onResponse?: (text: string, isComplete: boolean) => void) => {
        onResponse?.('OpenAI translated text', true)
        return 'OpenAI translated text'
      }
    )

    let resolveCompletion!: () => void
    smoothStreamCompleteMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCompletion = resolve
      })
    )

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(smoothStreamUpdateMock).toHaveBeenCalledWith('OpenAI translated text', false))
    await waitFor(() => expect(smoothStreamCompleteMock).toHaveBeenCalledWith('AI translated text'))
    expect(smoothStreamResetMock).toHaveBeenCalledWith('')
    expect(screen.getByTestId('translate-output-content')).toHaveTextContent('OpenAI translated text')
    expect(screen.queryByText('translate.processing')).not.toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()

    await act(async () => {
      resolveCompletion()
    })

    await waitFor(() => expect(screen.getByTestId('translate-output-content')).toHaveTextContent('AI translated text'))
    await waitFor(() => expect(screen.queryByText('translate.processing')).not.toBeInTheDocument())
    expect(toast.success).toHaveBeenCalledWith('translate.complete')

    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))
    await waitFor(() => expect(smoothStreamResetMock).toHaveBeenCalledTimes(2))
  })

  it('shows and auto-copies a cached translation immediately without replaying the smooth stream', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn',
      'feature.translate.page.auto_copy': true
    })
    translateCoreMock.findCached.mockResolvedValueOnce({
      id: '01900000-0000-7000-8000-000000000000',
      kind: 'text',
      sourceText: 'hello',
      targetText: '缓存译文',
      sourceLanguage: 'en-us',
      targetLanguage: 'zh-cn',
      modelId: 'openai::gpt-4.1',
      cacheKey: 'translate:openai::gpt-4.1:en-us:zh-cn:hello',
      star: false,
      createdAt: '2026-09-18T00:00:00.000Z',
      updatedAt: '2026-09-18T00:00:00.000Z'
    })

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(screen.getByTestId('translate-output-content')).toHaveTextContent('缓存译文'))
    await waitFor(() => expect(clipboardWriteTextMock).toHaveBeenCalledWith('缓存译文'))
    expect(smoothStreamResetMock).toHaveBeenLastCalledWith('缓存译文')
    expect(translateCoreMock.translateText).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith('translate.info.reused_cached')
  })

  it('shows upstream output tokens in the translated pane', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn'
    })
    translateCoreMock.translateText.mockImplementationOnce(
      async (
        _text: string,
        _targetLanguage: string,
        _onResponse: unknown,
        _signal: AbortSignal,
        options?: { onOutputTokens?: (outputTokens: number) => void }
      ) => {
        options?.onOutputTokens?.(11)
        return 'translated text'
      }
    )

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() =>
      expect(translateOutputPaneMock).toHaveBeenLastCalledWith(expect.objectContaining({ tokenCount: 11 }))
    )
  })

  it('uses the before-translation regex result in the source pane and history', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn',
      'feature.translate.post_processing.regex_rules': [
        { id: 'before-1', pattern: 'hello', replacement: 'normalized', flags: 'g', enabled: true, stage: 'before' }
      ]
    })
    let resolveTranslate!: (value: string) => void
    translateCoreMock.translateText.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveTranslate = resolve
      })
    )

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() =>
      expect(translateCoreMock.translateText).toHaveBeenCalledWith(
        'normalized',
        'zh-cn',
        expect.any(Function),
        expect.any(AbortSignal),
        expect.objectContaining({ operation: 'translate' })
      )
    )
    expect(screen.getByLabelText('translate.input.placeholder')).toHaveValue('normalized')
    expect(screen.getByLabelText('translate.input.placeholder')).toBeDisabled()
    expect(screen.getByTestId('translate-input-busy-overlay')).toHaveTextContent('translate.processing')

    await act(async () => resolveTranslate('translated text'))

    await waitFor(() =>
      expect(translateCoreMock.addHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceText: 'normalized',
          cacheKey: 'translate:openai::gpt-4.1:en-us:zh-cn:normalized'
        })
      )
    )
  })

  it('releases the workspace when preprocessing removes all source text', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn',
      'feature.translate.post_processing.regex_rules': [
        { pattern: 'hello', replacement: '', flags: 'g', enabled: true, stage: 'before' }
      ]
    })
    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(translationWorkspaceService.getSnapshot().status).toBe('error'))
    expect(translationWorkspaceService.isBusy()).toBe(false)
    expect(translateCoreMock.translateText).not.toHaveBeenCalled()
    expect(translateCoreMock.addHistory).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('preprocesses once before Markdown formatting throughout the global clipboard shortcut flow', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.target_language': 'zh-cn',
      'feature.translate.page.format_markdown_on_paste': true,
      'feature.translate.post_processing.regex_rules': [
        { id: 'before-1', pattern: 'text', replacement: 'text text', flags: 'g', enabled: true, stage: 'before' },
        {
          id: 'before-2',
          pattern: '\\* item',
          replacement: '* normalized',
          flags: 'gm',
          enabled: true,
          stage: 'before'
        }
      ]
    })
    routeMocks.search = { paste: 1, _: 'global-shortcut-regex' }
    ipcRequestMock.mockImplementation((channel: string) => {
      if (channel === 'binary.get_tool_snapshots') return Promise.resolve(binaryMock.snapshots)
      if (channel === 'translate.clipboard.read') {
        return Promise.resolve({ html: '', text: '# Heading\ntext\n\n* item' })
      }
      return Promise.resolve(undefined)
    })

    render(<TranslatePage />)

    await waitFor(() =>
      expect(translateCoreMock.translateText).toHaveBeenCalledWith(
        '# Heading\n\ntext text\n\n- normalized',
        'zh-cn',
        expect.any(Function),
        expect.any(AbortSignal),
        expect.objectContaining({ operation: 'translate', sourceLangCode: 'en-us' })
      )
    )
    expect(translateCoreMock.detectLanguage).toHaveBeenCalledWith('# Heading\n\ntext text\n\n- normalized')
    expect(screen.getByLabelText('translate.input.placeholder')).toHaveValue('# Heading\n\ntext text\n\n- normalized')
    await waitFor(() =>
      expect(translateCoreMock.addHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceText: '# Heading\n\ntext text\n\n- normalized',
          cacheKey: 'translate:openai::gpt-4.1:en-us:zh-cn:# Heading text text - normalized'
        })
      )
    )
  })

  it('preserves a manually selected source language throughout the global clipboard shortcut flow', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn'
    })
    routeMocks.search = { paste: 1, _: 'global-shortcut-manual-source' }
    ipcRequestMock.mockImplementation((channel: string) => {
      if (channel === 'binary.get_tool_snapshots') return Promise.resolve(binaryMock.snapshots)
      if (channel === 'translate.clipboard.read') return Promise.resolve({ html: '', text: 'hello' })
      return Promise.resolve(undefined)
    })

    render(<TranslatePage />)

    await waitFor(() =>
      expect(translateCoreMock.translateText).toHaveBeenCalledWith(
        'hello',
        'zh-cn',
        expect.any(Function),
        expect.any(AbortSignal),
        expect.objectContaining({ operation: 'translate', sourceLangCode: 'en-us' })
      )
    )
    expect(translateCoreMock.detectLanguage).not.toHaveBeenCalled()
    expect(MockUsePreferenceUtils.getPreferenceValue('feature.translate.page.source_language')).toBe('en-us')
  })

  it('clears the detecting state before the translation request finishes', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.target_language': 'zh-cn'
    })
    let resolveTranslate!: (value: string) => void
    translateCoreMock.translateText.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveTranslate = resolve
      })
    )

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(translateCoreMock.detectLanguage).toHaveBeenCalledWith('hello'))
    await waitFor(() => expect(translateCoreMock.translateText).toHaveBeenCalledTimes(1))
    expect(MockUseCacheUtils.getCacheValue('translate.detecting')).toBe(false)

    await act(async () => resolveTranslate('translated text'))
  })

  it('continues translating with the selected target when auto detection throws', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.target_language': 'en-us'
    })
    const detectError = new Error('detect failed')
    translateCoreMock.detectLanguage.mockRejectedValueOnce(detectError)

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() =>
      expect(translateCoreMock.translateText).toHaveBeenCalledWith(
        'hello',
        'en-us',
        expect.any(Function),
        expect.any(AbortSignal),
        expect.objectContaining({
          modelId: 'openai::gpt-4.1',
          operation: 'translate',
          sourceLangCode: 'unknown'
        })
      )
    )
    expect(toast.error).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(translateCoreMock.addHistory).toHaveBeenCalledWith({
        sourceText: 'hello',
        targetText: 'translated text',
        sourceLanguage: 'unknown',
        targetLanguage: 'en-us',
        modelId: 'openai::gpt-4.1',
        cacheKey: 'translate:openai::gpt-4.1:unknown:en-us:hello'
      })
    )
  })

  it('continues translating with the selected target when auto detection returns unknown in bidirectional mode', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.target_language': 'en-us',
      'feature.translate.page.bidirectional_enabled': true,
      'feature.translate.page.bidirectional_pair': ['en-us', 'zh-cn']
    })
    translateCoreMock.detectLanguage.mockResolvedValueOnce('unknown')

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() =>
      expect(translateCoreMock.translateText).toHaveBeenCalledWith(
        'hello',
        'en-us',
        expect.any(Function),
        expect.any(AbortSignal),
        expect.objectContaining({
          modelId: 'openai::gpt-4.1',
          operation: 'translate',
          sourceLangCode: 'unknown'
        })
      )
    )
    expect(toast.warning).not.toHaveBeenCalledWith('translate.language.not_pair')
    await waitFor(() =>
      expect(translateCoreMock.addHistory).toHaveBeenCalledWith({
        sourceText: 'hello',
        targetText: 'translated text',
        sourceLanguage: 'unknown',
        targetLanguage: 'en-us',
        modelId: 'openai::gpt-4.1',
        cacheKey: 'translate:openai::gpt-4.1:unknown:en-us:hello'
      })
    )
  })

  it('translates detected native-language text to the other bidirectional language', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.bidirectional_enabled': true,
      'feature.translate.page.bidirectional_pair': ['en-us', 'zh-cn'],
      'feature.translate.native_language': 'zh-cn'
    })
    translateCoreMock.detectLanguage.mockResolvedValueOnce('zh-cn')

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: '你好' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() =>
      expect(translateCoreMock.translateText).toHaveBeenCalledWith(
        '你好',
        'en-us',
        expect.any(Function),
        expect.any(AbortSignal),
        expect.objectContaining({
          modelId: 'openai::gpt-4.1',
          operation: 'translate',
          sourceLangCode: 'zh-cn'
        })
      )
    )
    expect(translateCoreMock.detectLanguage).toHaveBeenCalledWith('你好')
    await waitFor(() =>
      expect(translateCoreMock.addHistory).toHaveBeenCalledWith({
        sourceText: '你好',
        targetText: 'translated text',
        sourceLanguage: 'zh-cn',
        targetLanguage: 'en-us',
        modelId: 'openai::gpt-4.1',
        cacheKey: 'translate:openai::gpt-4.1:zh-cn:en-us:你好'
      })
    )
  })

  it('flips a wrong bidirectional detection by aborting and retranslating with the corrected direction', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.target_language': 'zh-cn',
      'feature.translate.page.bidirectional_enabled': true,
      'feature.translate.page.bidirectional_pair': ['en-us', 'zh-cn']
    })
    translateCoreMock.detectLanguage.mockResolvedValue('zh-cn')
    let firstSignal: AbortSignal | undefined
    translateCoreMock.translateText
      .mockImplementationOnce(
        (_text: string, _target: string, _onResponse: unknown, signal?: AbortSignal) =>
          new Promise<string>((_resolve, reject) => {
            firstSignal = signal
            signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
          })
      )
      .mockResolvedValueOnce('corrected translation')

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: '你好' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(firstSignal).toBeDefined())
    const flip = await screen.findByRole('button', { name: 'translate.flip.label' })
    await waitFor(() => expect(flip).toBeEnabled())
    fireEvent.click(flip)

    await waitFor(() => expect(translateCoreMock.translateText).toHaveBeenCalledTimes(2))
    expect(firstSignal?.aborted).toBe(true)
    expect(languageBarMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ detectedLanguage: 'en-us', sourceLanguage: 'auto' })
    )
    expect(translateCoreMock.translateText).toHaveBeenNthCalledWith(
      2,
      '你好',
      'zh-cn',
      expect.any(Function),
      expect.any(AbortSignal),
      expect.objectContaining({ sourceLangCode: 'en-us' })
    )
    expect(toast.success).toHaveBeenCalledWith('translate.flip.success')
  })

  it('invalidates the detected language when the source text changes', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.target_language': 'zh-cn',
      'feature.translate.page.bidirectional_enabled': true,
      'feature.translate.page.bidirectional_pair': ['en-us', 'zh-cn']
    })
    translateCoreMock.detectLanguage.mockResolvedValueOnce('zh-cn')

    const { rerender } = render(<TranslatePage />)
    const input = screen.getByLabelText('translate.input.placeholder')
    fireEvent.change(input, { target: { value: '你好' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    const flip = await screen.findByRole('button', { name: 'translate.flip.label' })
    await waitFor(() => expect(flip).toBeEnabled())

    fireEvent.change(input, { target: { value: 'hello' } })
    rerender(<TranslatePage />)

    expect(flip).toBeDisabled()
  })

  it('does not reuse a prior detection when opening a legacy history entry', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.target_language': 'zh-cn',
      'feature.translate.page.bidirectional_enabled': true,
      'feature.translate.page.bidirectional_pair': ['en-us', 'zh-cn']
    })
    translateCoreMock.detectLanguage.mockResolvedValueOnce('zh-cn')

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: '你好' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    const flip = await screen.findByRole('button', { name: 'translate.flip.label' })
    await waitFor(() => expect(flip).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: 'translate.history.title' }))
    fireEvent.click(screen.getByRole('button', { name: 'reuse-null-target-history' }))

    expect(flip).toBeDisabled()
  })

  it('swallows abort errors from translate without showing success-side effects', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'zh-cn',
      'feature.translate.page.target_language': 'en-us'
    })
    const abortError = new Error('aborted')
    translateCoreMock.translateText.mockRejectedValueOnce(abortError)
    translateCoreMock.isAbortError.mockImplementationOnce((error: unknown) => error === abortError)

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(translateCoreMock.translateText).toHaveBeenCalledTimes(1))
    expect(toast.success).not.toHaveBeenCalled()
    expect(translateCoreMock.addHistory).not.toHaveBeenCalled()
    await waitFor(() => expect(translationWorkspaceService.isBusy()).toBe(false))
    expect(translationWorkspaceService.getSnapshot().status).toBe('cancelled')
  })

  it.each(['', 'partial translation'])(
    'preserves output "%s" on failure and permits an immediate retry',
    async (partial) => {
      MockUsePreferenceUtils.setMultiplePreferenceValues({
        'feature.translate.model_id': 'openai::gpt-4.1',
        'feature.translate.page.source_language': 'zh-cn',
        'feature.translate.page.target_language': 'en-us'
      })
      const translateError = new Error('translate failed')
      translateCoreMock.translateText.mockImplementationOnce(
        async (_text: string, _target: string, onResponse?: (text: string, done: boolean) => void) => {
          if (partial) onResponse?.(partial, false)
          throw translateError
        }
      )
      translateCoreMock.formatErrorMessageWithPrefix.mockImplementationOnce((_error: unknown, prefix: string) => {
        return `${prefix}: reason`
      })

      const { rerender } = render(<TranslatePage />)
      fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
      rerender(<TranslatePage />)
      fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('translate.error.failed: reason'))
      expect(translationWorkspaceService.getSnapshot()).toMatchObject({ status: 'error', error: translateError })
      expect(translationWorkspaceService.isBusy()).toBe(false)
      expect(MockUseCacheUtils.getCacheValue('translate.output')).toBe(partial)
      expect(toast.error).toHaveBeenCalledTimes(1)
      expect(translateCoreMock.addHistory).not.toHaveBeenCalled()
      translateCoreMock.translateText.mockResolvedValueOnce('retry succeeded')
      fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))
      await waitFor(() => expect(translationWorkspaceService.getSnapshot().status).toBe('success'))
    }
  )

  it('triggers translate on Cmd/Ctrl+Enter keyboard shortcut', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'zh-cn',
      'feature.translate.page.target_language': 'en-us'
    })
    translateCoreMock.translateText.mockResolvedValueOnce('keyboard translated')

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)

    fireEvent.keyDown(screen.getByLabelText('translate.input.placeholder'), { key: 'Enter', ctrlKey: true })

    await waitFor(() => expect(translateCoreMock.translateText).toHaveBeenCalledTimes(1))
  })

  it('ignores duplicate translate trigger while translating is in progress', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'zh-cn',
      'feature.translate.page.target_language': 'en-us'
    })
    let resolveTranslate: (value: string) => void = () => {}
    translateCoreMock.translateText.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveTranslate = resolve
      })
    )

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'common.stop' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'common.stop' }))

    await waitFor(() => expect(translateCoreMock.translateText).toHaveBeenCalledTimes(1))
    await act(async () => {
      resolveTranslate('done')
    })
  })

  it('restores streaming text and output tokens after an in-flight workspace remount', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'zh-cn',
      'feature.translate.page.target_language': 'en-us'
    })
    let signal: AbortSignal | undefined
    let onResponse: ((text: string, isComplete: boolean) => void) | undefined
    let onOutputTokens: ((value: number) => void) | undefined
    let resolveTranslate!: (value: string) => void
    translateCoreMock.translateText.mockImplementationOnce(
      (
        _text: string,
        _targetLanguage: string,
        response?: (text: string, isComplete: boolean) => void,
        abortSignal?: AbortSignal,
        options?: { onOutputTokens?: (value: number) => void }
      ) => {
        signal = abortSignal
        onResponse = response
        onOutputTokens = options?.onOutputTokens
        return new Promise<string>((resolve) => {
          resolveTranslate = resolve
        })
      }
    )

    const { rerender, unmount } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))
    await waitFor(() => expect(signal).toBeDefined())
    act(() => onResponse?.('visible prefix', false))
    await waitFor(() => expect(screen.getByTestId('translate-output-content')).toHaveTextContent('visible prefix'))
    unmount()

    expect(signal?.aborted).toBe(false)
    act(() => {
      onResponse?.('visible prefix and hidden suffix', false)
      onOutputTokens?.(17)
    })

    render(<TranslatePage />)
    await waitFor(() =>
      expect(screen.getByTestId('translate-output-content')).toHaveTextContent('visible prefix and hidden suffix')
    )
    await waitFor(() =>
      expect(translateOutputPaneMock).toHaveBeenLastCalledWith(expect.objectContaining({ tokenCount: 17 }))
    )
    expect(screen.getByRole('button', { name: 'common.stop' })).toBeInTheDocument()

    await act(async () => resolveTranslate('visible prefix and hidden suffix'))
    await waitFor(() => expect(translationWorkspaceService.getSnapshot().status).toBe('success'))
    expect(translateCoreMock.addHistory).toHaveBeenCalledTimes(1)
  })

  it('cancels in-flight translation when stop is clicked', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'zh-cn',
      'feature.translate.page.target_language': 'en-us'
    })
    let signal: AbortSignal | undefined
    translateCoreMock.translateText.mockImplementationOnce(
      (_text: string, _targetLanguage: string, _onResponse?: unknown, abortSignal?: AbortSignal) => {
        signal = abortSignal
        return new Promise<string>(() => {})
      }
    )

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'common.stop' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'common.stop' }))

    expect(signal?.aborted).toBe(true)
    expect(toast.info).toHaveBeenCalledWith('translate.info.aborted')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'common.stop' })).not.toBeInTheDocument())
    expect(screen.queryByText('translate.processing')).not.toBeInTheDocument()
  })

  it('ignores dropped and pasted files while translation is running', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'zh-cn',
      'feature.translate.page.target_language': 'en-us'
    })
    let resolveTranslate: (value: string) => void = () => {}
    translateCoreMock.translateText.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveTranslate = resolve
      })
    )
    dropMock.getFilesFromDropEvent.mockResolvedValue([{ path: '/tmp/replacement.png', size: 10, type: 'image' }])

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'common.stop' })).toBeInTheDocument())

    fireEvent.drop(screen.getByTestId('translate-input-pane'))
    fireEvent.paste(screen.getByLabelText('translate.input.placeholder'), {
      clipboardData: {
        getData: () => '',
        files: [{ name: 'replacement.png', type: 'image/png' }]
      }
    })

    expect(dropMock.getTextFromDropEvent).not.toHaveBeenCalled()
    expect(dropMock.getFilesFromDropEvent).not.toHaveBeenCalled()
    expect(fileMock.getPathForFile).not.toHaveBeenCalled()

    await act(async () => {
      resolveTranslate('done')
    })
  })

  it('keeps streamed translation text when stop is clicked', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'zh-cn',
      'feature.translate.page.target_language': 'en-us',
      'feature.translate.page.auto_copy': true
    })
    const abortError = new Error('aborted')
    let signal: AbortSignal | undefined
    translateCoreMock.translateText.mockImplementationOnce(
      (
        _text: string,
        _targetLanguage: string,
        onResponse?: (text: string, isComplete: boolean) => void,
        abortSignal?: AbortSignal
      ) => {
        signal = abortSignal
        onResponse?.('partial text', false)

        return new Promise<string>((_resolve, reject) => {
          abortSignal?.addEventListener('abort', () => reject(abortError), { once: true })
        })
      }
    )
    translateCoreMock.isAbortError.mockImplementation((error: unknown) => error === abortError)

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(screen.getByTestId('translate-output-content')).toHaveTextContent('partial text'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'common.stop' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'common.stop' }))

    expect(signal?.aborted).toBe(true)
    await waitFor(() => expect(screen.getByTestId('translate-output-content')).toHaveTextContent('partial text'))
    expect(MockUseCacheUtils.getCacheValue('translate.output')).toBe('partial text')
    expect(toast.info).toHaveBeenCalledWith('translate.info.aborted')
    expect(toast.success).not.toHaveBeenCalled()
    expect(translateCoreMock.addHistory).not.toHaveBeenCalled()
  })

  it('auto-copies a successful translation before the page can be hidden', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'zh-cn',
      'feature.translate.page.target_language': 'en-us',
      'feature.translate.page.auto_copy': true
    })

    const { rerender } = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'hello' } })
    rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))

    await waitFor(() => expect(clipboardWriteTextMock).toHaveBeenCalledWith('translated text'))

    await waitFor(() =>
      expect(translateCoreMock.addHistory).toHaveBeenCalledWith({
        sourceText: 'hello',
        targetText: 'translated text',
        sourceLanguage: 'zh-cn',
        targetLanguage: 'en-us',
        modelId: 'openai::gpt-4.1',
        cacheKey: 'translate:openai::gpt-4.1:zh-cn:en-us:hello'
      })
    )
    expect(toast.success).toHaveBeenCalledWith('translate.complete')
  })

  it('keeps the current target language when reusing history with a null target language', async () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.page.target_language', 'ja-jp')

    render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.history.title' }))
    fireEvent.click(screen.getByRole('button', { name: 'reuse-null-target-history' }))

    await waitFor(() => {
      expect(MockUsePreferenceUtils.getPreferenceValue('feature.translate.page.target_language')).toBe('ja-jp')
    })
    expect(MockUsePreferenceUtils.getPreferenceValue('feature.translate.page.source_language')).toBe('auto')
    expect(MockUseCacheUtils.getCacheValue('translate.input')).toBe('hello')
    expect(MockUseCacheUtils.getCacheValue('translate.output')).toBe('你好')
  })

  it('reusing history cancels the old task and preserves both language preferences', async () => {
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'auto',
      'feature.translate.page.target_language': 'ja-jp',
      'feature.translate.page.auto_copy': true
    })
    let finish!: (value: string) => void
    let lateChunk!: (value: string, complete: boolean) => void
    let signal!: AbortSignal
    translateCoreMock.translateText.mockImplementationOnce((_text, _language, response, abortSignal) => {
      lateChunk = response
      signal = abortSignal
      return new Promise<string>((resolve) => {
        finish = resolve
      })
    })
    const view = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'old source' } })
    view.rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))
    await waitFor(() => expect(translateCoreMock.translateText).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'translate.history.title' }))
    expect(signal.aborted).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'reuse-known-language-history' }))
    await act(async () => {
      lateChunk('late old output', true)
      finish('late old output')
    })

    expect(signal.aborted).toBe(true)
    expect(MockUseCacheUtils.getCacheValue('translate.input')).toBe('history source')
    expect(MockUseCacheUtils.getCacheValue('translate.output')).toBe('历史译文')
    expect(MockUsePreferenceUtils.getPreferenceValue('feature.translate.page.source_language')).toBe('auto')
    expect(MockUsePreferenceUtils.getPreferenceValue('feature.translate.page.target_language')).toBe('ja-jp')
    expect(translationWorkspaceService.isBusy()).toBe(false)
    expect(translateCoreMock.addHistory).not.toHaveBeenCalled()
  })

  it('replaces a live IPC translation only after the shortcut has read valid text', async () => {
    const { translateText } = await vi.importActual<typeof TranslateTextModule>(
      '@renderer/utils/translate/translateText'
    )
    translateCoreMock.translateText.mockImplementation(translateText)
    let nextId = 0
    uuidMock.mockImplementation(() => `stream-${++nextId}`)
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'openai::gpt-4.1',
      'feature.translate.page.source_language': 'en-us',
      'feature.translate.page.target_language': 'zh-cn'
    })
    let resolveRead!: (value: { html: string; text: string }) => void
    const streams: string[] = []
    ipcRequestMock.mockImplementation((route: string, input: { streamId?: string }) => {
      if (route === 'binary.get_tool_snapshots') return Promise.resolve(binaryMock.snapshots)
      if (route === 'translate.open') {
        streams.push(input.streamId!)
        return Promise.resolve({ streamId: input.streamId })
      }
      if (route === 'translate.clipboard.read')
        return new Promise((resolve) => {
          resolveRead = resolve
        })
      return Promise.resolve(undefined)
    })
    const view = render(<TranslatePage />)
    fireEvent.change(screen.getByLabelText('translate.input.placeholder'), { target: { value: 'old source' } })
    view.rerender(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.button.translate' }))
    await waitFor(() => expect(streams).toHaveLength(1))
    await act(async () =>
      ipcEventHandlers.get('ai.stream.chunk')?.({
        topicId: streams[0],
        chunk: { type: 'text-delta', delta: 'old partial' }
      })
    )
    routeMocks.search = { paste: 1, _: 'replacement' }
    view.rerender(<TranslatePage />)
    await waitFor(() => expect(resolveRead).toBeTypeOf('function'))
    expect(MockUseCacheUtils.getCacheValue('translate.input')).toBe('old source')
    expect(MockUseCacheUtils.getCacheValue('translate.output')).toBe('old partial')
    expect(ipcRequestMock).not.toHaveBeenCalledWith('ai.stream.abort', expect.anything())
    await act(async () => resolveRead({ html: '', text: 'new source' }))
    await waitFor(() => expect(streams).toHaveLength(2))
    expect(ipcRequestMock).toHaveBeenCalledWith('ai.stream.abort', { topicId: streams[0] })
    await act(async () => {
      ipcEventHandlers.get('ai.stream.chunk')?.({ topicId: streams[0], chunk: { type: 'text-delta', delta: 'stale' } })
      ipcEventHandlers.get('ai.stream.chunk')?.({
        topicId: streams[1],
        chunk: { type: 'text-delta', delta: 'new output' }
      })
      ipcEventHandlers.get('ai.stream.done')?.({ topicId: streams[1], status: 'success' })
    })
    await waitFor(() => expect(translationWorkspaceService.getSnapshot().status).toBe('success'))
    expect(MockUseCacheUtils.getCacheValue('translate.input')).toBe('new source')
    expect(MockUseCacheUtils.getCacheValue('translate.output')).toBe('new output')
    expect(translateCoreMock.addHistory).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ sourceText: 'new source', targetText: 'new output' })
    )
  })

  it('does not mutate an unknown target selector when manually reusing history', async () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.page.target_language', 'unknown')

    render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.history.title' }))
    fireEvent.click(screen.getByRole('button', { name: 'reuse-null-target-history' }))

    await waitFor(() => {
      expect(MockUsePreferenceUtils.getPreferenceValue('feature.translate.page.target_language')).toBe('unknown')
    })
  })

  it('restores the side-by-side preview when reusing a PDF history entry', async () => {
    render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.history.title' }))
    fireEvent.click(screen.getByRole('button', { name: 'reuse-pdf-history' }))

    const view = await screen.findByTestId('pdf-translation-view')
    expect(view).toHaveAttribute('data-file-path', '/tmp/paper.pdf')
    expect(view).toHaveAttribute('data-restored-output', '/tmp/files/entry-target.pdf')
    // A PDF row's texts are file names — they must not land in the text panes.
    expect(MockUseCacheUtils.getCacheValue('translate.input')).not.toBe('paper.pdf')
  })

  it('reports a PDF history entry whose files are gone instead of opening an empty preview', async () => {
    historyFilesMock.files = { source: null, target: null }

    render(<TranslatePage />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.history.title' }))
    fireEvent.click(screen.getByRole('button', { name: 'reuse-pdf-history' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('translate.history.file.unavailable'))
    expect(screen.queryByTestId('pdf-translation-view')).toBeNull()
  })

  it('keeps the current PDF open when a history entry is only partially available', async () => {
    fileMock.getFileExtension.mockReturnValue('.pdf')
    fileMock.onSelectFile.mockResolvedValue([
      { name: 'current.pdf', path: '/tmp/current.pdf', size: 10, type: 'document' }
    ])
    historyFilesMock.files = {
      source: null,
      target: { entryId: 'entry-target', path: '/tmp/files/entry-target.pdf' as AbsoluteFilePath }
    }

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))
    await waitFor(() =>
      expect(screen.getByTestId('pdf-translation-view')).toHaveAttribute('data-file-path', '/tmp/current.pdf')
    )

    fireEvent.click(screen.getByRole('button', { name: 'translate.history.title' }))
    fireEvent.click(screen.getByRole('button', { name: 'reuse-pdf-history' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('translate.history.file.unavailable'))
    expect(screen.getByTestId('pdf-translation-view')).toHaveAttribute('data-file-path', '/tmp/current.pdf')
  })

  it('keeps history and settings drawers mutually exclusive and exposes open state through aria-pressed', () => {
    render(<TranslatePage />)
    const historyButton = screen.getByRole('button', { name: 'translate.history.title' })
    const settingsButton = screen.getByRole('button', { name: 'translate.settings.title' })

    expect(historyButton).toHaveAttribute('aria-pressed', 'false')
    expect(settingsButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('translate-history-open')).toBeNull()
    expect(screen.queryByTestId('translate-settings-open')).toBeNull()

    fireEvent.click(historyButton)
    expect(historyButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('translate-history-open')).toBeInTheDocument()

    fireEvent.click(settingsButton)
    expect(settingsButton).toHaveAttribute('aria-pressed', 'true')
    expect(historyButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('translate-history-open')).toBeNull()
    expect(screen.getByTestId('translate-settings-open')).toBeInTheDocument()

    fireEvent.click(historyButton)
    expect(historyButton).toHaveAttribute('aria-pressed', 'true')
    expect(settingsButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('translate-history-open')).toBeInTheDocument()
    expect(screen.queryByTestId('translate-settings-open')).toBeNull()

    fireEvent.click(historyButton)
    expect(historyButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('translate-history-open')).toBeNull()
  })

  it('opens and closes a ready trace panel with middle click while preserving left-click settings', async () => {
    MockUsePreferenceUtils.setPreferenceValue('app.developer_mode.enabled', true)
    const runId = translationWorkspaceService.begin('text')
    translationWorkspaceService.update(runId, { traceId: '0123456789abcdef0123456789abcdef' })
    const traceTopicId = translationWorkspaceService.getSnapshot().traceTopicId
    render(<TranslatePage />)
    const settingsButton = screen.getByRole('button', { name: 'translate.settings.title' })

    fireEvent.click(settingsButton)
    expect(screen.getByTestId('translate-settings-open')).toBeInTheDocument()

    const mouseDown = new MouseEvent('mousedown', { bubbles: true, button: 1, cancelable: true })
    fireEvent(settingsButton, mouseDown)
    const auxClick = fireMiddleAuxClick(settingsButton)
    expect(mouseDown.defaultPrevented).toBe(true)
    expect(auxClick.defaultPrevented).toBe(true)
    const tracePane = await screen.findByTestId('translate-trace-pane')
    expect(tracePane).toHaveAttribute('data-topic-id', traceTopicId)
    expect(tracePane).toHaveAttribute('data-trace-id', '0123456789abcdef0123456789abcdef')
    expect(screen.queryByTestId('translate-settings-open')).toBeNull()

    let replacementRunId = 0
    act(() => {
      replacementRunId = translationWorkspaceService.begin('text')
    })
    await waitFor(() => expect(screen.queryByTestId('translate-trace-pane')).toBeNull())
    act(() => {
      translationWorkspaceService.update(replacementRunId, { traceId: 'fedcba9876543210fedcba9876543210' })
    })
    const replacementPane = await screen.findByTestId('translate-trace-pane')
    expect(replacementPane).toHaveAttribute('data-trace-id', 'fedcba9876543210fedcba9876543210')

    fireMiddleAuxClick(settingsButton)
    await waitFor(() => expect(screen.queryByTestId('translate-trace-pane')).toBeNull())

    fireEvent.click(settingsButton)
    expect(screen.getByTestId('translate-settings-open')).toBeInTheDocument()
  })

  it('silently ignores middle click until a trace is ready', () => {
    MockUsePreferenceUtils.setPreferenceValue('app.developer_mode.enabled', true)
    render(<TranslatePage />)
    const settingsButton = screen.getByRole('button', { name: 'translate.settings.title' })

    fireEvent.click(settingsButton)
    fireMiddleAuxClick(settingsButton)

    expect(screen.getByTestId('translate-settings-open')).toBeInTheDocument()
    expect(screen.queryByTestId('translate-trace-pane')).toBeNull()
  })
})
