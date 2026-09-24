import { mockUsePreference, MockUsePreferenceUtils } from '@test-mocks/renderer/usePreference'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { toast } from '@renderer/services/toast'
import { TRANSLATE_PROMPT } from '@shared/ai/prompts'
import { parsePersistedLangCode } from '@shared/data/preference/preferenceTypes'
import type { TranslateLanguage } from '@shared/data/types/translate'

const translateLanguageMutationsMock = vi.hoisted(() => ({
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn()
}))
const translateGlossaryMock = vi.hoisted(() => ({
  entries: [] as any[],
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn()
}))
const mergeViewTestState = vi.hoisted(() => ({ configs: [] as any[] }))
const codeStyleMock = vi.hoisted(() => ({ activeCmTheme: [] as any[] }))

let mockLanguages: TranslateLanguage[] = []

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn()
  },
  useTranslation: () => ({
    t: (key: string, options?: { index?: number }) =>
      key === 'translate.settings.regex_rules.preview_issue_rule' ? `${key} ${options?.index}` : key,
    i18n: { language: 'en-us' }
  })
}))

vi.mock('@renderer/hooks/translate', () => ({
  useLanguages: () => ({ languages: mockLanguages }),
  useTranslateGlossary: () => translateGlossaryMock,
  useTranslateLanguages: () => translateLanguageMutationsMock
}))

const modelCatalogMock = vi.hoisted(() => ({
  models: [] as Array<{ id: string; providerId: string; name: string }>
}))
const providerCatalogMock = vi.hoisted(() => ({ providers: [] as Array<{ id: string; name: string }> }))

vi.mock('@renderer/hooks/useModel', () => ({
  useModels: () => ({ models: modelCatalogMock.models })
}))

vi.mock('@renderer/hooks/useProvider', () => ({
  useProviders: () => ({ providers: providerCatalogMock.providers })
}))

vi.mock('@renderer/components/Avatar/ModelAvatar', () => ({
  default: ({ model }: { model: { name: string } }) => <span data-testid="model-avatar">{model.name}</span>
}))

vi.mock('@codemirror/view', () => ({
  EditorView: {
    contentAttributes: { of: (value: unknown) => ({ kind: 'contentAttributes', value }) },
    editable: { of: (value: unknown) => ({ kind: 'editable', value }) },
    lineWrapping: { kind: 'lineWrapping' },
    theme: (value: unknown) => ({ kind: 'theme', value }),
    updateListener: { of: (value: unknown) => ({ kind: 'updateListener', value }) }
  },
  placeholder: (value: unknown) => ({ kind: 'placeholder', value })
}))

vi.mock('@codemirror/state', () => ({
  EditorState: { readOnly: { of: (value: unknown) => ({ kind: 'readOnly', value }) } }
}))

vi.mock('@codemirror/merge', () => ({
  MergeView: class MockMergeView {
    a: any
    b: any
    dom: HTMLDivElement

    constructor(config: any) {
      mergeViewTestState.configs.push(config)
      this.dom = document.createElement('div')
      this.dom.className = 'cm-mergeView'
      config.parent?.appendChild(this.dom)
      this.a = this.createEditor(config.a, false)
      this.b = this.createEditor(config.b, true)
    }

    createEditor(config: any, readOnly: boolean) {
      const extensions = (config.extensions ?? []).flat()
      const attributes = extensions.find((extension: any) => extension?.kind === 'contentAttributes')?.value ?? {}
      const placeholder = extensions.find((extension: any) => extension?.kind === 'placeholder')?.value
      const updateListener = extensions.find((extension: any) => extension?.kind === 'updateListener')?.value
      const textarea = document.createElement('textarea')
      textarea.value = config.doc ?? ''
      textarea.readOnly = readOnly
      if (placeholder) textarea.placeholder = placeholder
      for (const [name, value] of Object.entries(attributes)) textarea.setAttribute(name, String(value))
      this.dom.appendChild(textarea)

      const editor = {
        state: { doc: { toString: () => textarea.value } },
        dispatch: ({ changes }: { changes: { insert: string } }) => {
          textarea.value = changes.insert
        }
      }
      textarea.addEventListener('input', () => {
        updateListener?.({ docChanged: true, state: editor.state })
      })
      return editor
    }

    destroy() {
      this.dom.remove()
    }
  }
}))

vi.mock('@renderer/hooks/useCodeStyle', () => ({
  useCodeStyle: () => codeStyleMock
}))

vi.mock('@renderer/utils/style', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')
}))

vi.mock('@renderer/components/ModelSelector', () => ({
  getProviderDisplayName: (provider: { name: string }) => provider.name,
  ModelSelector: ({
    trigger,
    fixedTopOption,
    onSelect
  }: {
    trigger: React.ReactNode
    fixedTopOption?: { label: React.ReactNode; selected: boolean; onSelect: () => void }
    onSelect: (value: string) => void
  }) => (
    <>
      {trigger}
      {fixedTopOption ? (
        <>
          <button
            type="button"
            data-testid="model-selector-fixed-option"
            aria-pressed={fixedTopOption.selected}
            onClick={fixedTopOption.onSelect}>
            {fixedTopOption.label}
          </button>
          <button
            type="button"
            data-testid="model-selector-direction-model"
            onClick={() => onSelect('openai::directional')}>
            directional model
          </button>
        </>
      ) : null}
    </>
  )
}))

vi.mock('@renderer/components/translate/LanguagePicker', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <button type="button" data-testid={`language-picker-${value}`} onClick={() => onChange('zh-cn')}>
      {value}
    </button>
  )
}))

vi.mock('@renderer/components/translate/IconButton', () => ({
  default: ({
    children,
    active,
    size,
    tooltip,
    ...props
  }: React.ComponentProps<'button'> & { active?: boolean; size?: string; tooltip?: React.ReactNode }) => {
    void active
    void size
    void tooltip
    return (
      <button type="button" {...props}>
        {children}
      </button>
    )
  }
}))

vi.mock('@cherrystudio/ui', () => ({
  Alert: ({ children, ...props }: React.ComponentProps<'div'> & { type?: string; showIcon?: boolean }) => {
    const { type, showIcon, ...divProps } = props
    void type
    void showIcon
    return (
      <div role="alert" {...divProps}>
        {children}
      </div>
    )
  },
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  ConfirmDialog: ({ onConfirm, title }: { onConfirm?: () => void | Promise<void>; title?: string }) => (
    <button type="button" data-testid={`confirm-${title ?? 'unknown'}`} onClick={() => void onConfirm?.()}>
      {title}
    </button>
  ),
  Dialog: ({
    children,
    open,
    onOpenChange
  }: {
    children: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) =>
    open ? (
      <div role="dialog">
        <button type="button" aria-label="mock-close-dialog" onClick={() => onOpenChange?.(false)} />
        {children}
      </div>
    ) : null,
  DialogContent: ({ children, className }: React.ComponentProps<'div'>) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogHeader: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  Field: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FieldDescription: ({ children, ...props }: React.ComponentProps<'p'>) => <p {...props}>{children}</p>,
  FieldLabel: ({ children, ...props }: React.ComponentProps<'label'>) => <label {...props}>{children}</label>,
  HelpTooltip: () => null,
  Input: ({ ...props }: React.ComponentProps<'input'>) => <input {...props} />,
  InputGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  InputGroupAddon: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  InputGroupButton: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  InputGroupInput: ({ ...props }: React.ComponentProps<'input'>) => <input {...props} />,
  NormalTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PageSidePanel: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  PageSidePanelItem: ({
    title,
    description,
    action,
    children
  }: {
    title: React.ReactNode
    description?: React.ReactNode
    action?: React.ReactNode
    children?: React.ReactNode
  }) => (
    <div>
      <div>{title}</div>
      {description && <div>{description}</div>}
      {action}
      {children}
    </div>
  ),
  PageSidePanelSection: ({
    title,
    actions,
    children
  }: {
    title: React.ReactNode
    actions?: React.ReactNode
    children: React.ReactNode
  }) => (
    <section>
      <div>{title}</div>
      {actions}
      {children}
    </section>
  ),
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SegmentedControl: <TValue extends string>({
    options,
    onValueChange
  }: {
    options: { value: TValue; label: React.ReactNode }[]
    onValueChange?: (value: TValue) => void
  }) => (
    <div role="radiogroup">
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onValueChange?.(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  ),
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (value: boolean) => void }) => (
    <button type="button" aria-pressed={checked} onClick={() => onCheckedChange(!checked)} />
  ),
  Textarea: {
    Input: ({
      onValueChange,
      ...props
    }: React.ComponentProps<'textarea'> & { onValueChange?: (value: string) => void }) => (
      <textarea {...props} onChange={(event) => onValueChange?.(event.target.value)} />
    )
  },
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

import TranslateSettings, { TranslateSettingsPanelContent } from '@renderer/components/translate/TranslateSettings'

const getPromptTextarea = () => screen.getByRole('textbox', { name: 'translate.settings.prompt.native_to_other' })
const getAddLanguageButton = () => screen.getByRole('button', { name: 'common.add common.language' })
const openAddLanguageForm = () => {
  fireEvent.click(getAddLanguageButton())
}

const submitCustomLanguage = ({ value, langCode }: { value?: string; langCode?: string }) => {
  openAddLanguageForm()
  if (value !== undefined) {
    fireEvent.change(screen.getByPlaceholderText('settings.translate.custom.value.placeholder'), {
      target: { value }
    })
  }
  if (langCode !== undefined) {
    fireEvent.change(screen.getByPlaceholderText('settings.translate.custom.langCode.placeholder'), {
      target: { value: langCode }
    })
  }
  const form = screen.getByPlaceholderText('settings.translate.custom.value.placeholder').closest('.space-y-3')
  if (!form) throw new Error('custom language form not found')
  fireEvent.click(within(form as HTMLElement).getByRole('button', { name: 'common.add' }))
}

const setBasePreferenceMocks = () => {
  MockUsePreferenceUtils.setMultiplePreferenceValues({
    'feature.translate.page.bidirectional_pair': ['en-us', 'zh-cn'],
    'feature.translate.page.enable_markdown': false,
    'feature.translate.page.auto_copy': false,
    'feature.translate.auto_detection_method': 'auto',
    'feature.translate.page.scroll_sync': false,
    'feature.translate.page.bidirectional_enabled': true,
    'feature.translate.model_prompt': TRANSLATE_PROMPT,
    'feature.translate.prompt.native_to_other': TRANSLATE_PROMPT,
    'feature.translate.prompt.other_to_native': TRANSLATE_PROMPT,
    'feature.translate.prompt.polish': TRANSLATE_PROMPT,
    'feature.translate.native_language': null,
    'feature.translate.page.font_size': 16,
    'feature.translate.page.layout_override': 'auto',
    'feature.translate.polish.enabled': false,
    'feature.translate.page.json_structure_view': true,
    'feature.translate.page.json_structure_copy_separator': 'colon-space',
    'feature.translate.page.json_structure_copy_blank_line': false,
    'feature.translate.post_processing.enabled': true,
    'feature.translate.post_processing.english_straight_quotes': false,
    'feature.translate.post_processing.zh_smart_quotes': false,
    'feature.translate.post_processing.zh_text_spacing': false,
    'feature.translate.model.native_to_other_follows_global': true,
    'feature.translate.model.other_to_native_follows_global': true,
    'feature.translate.request.custom_parameters': [],
    'feature.translate.request.polish_custom_parameters': [],
    'feature.translate.reasoning.translate_auto_disable': true,
    'feature.translate.reasoning.polish_auto_disable': true,
    'feature.translate.post_processing.regex_rules': []
  })
}

const createCustomLanguage = (langCode: string, value: string, emoji = '🌐'): TranslateLanguage => ({
  value,
  langCode: parsePersistedLangCode(langCode),
  emoji,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
})

describe('TranslateSettings', () => {
  const setBidirectionalPair = vi.fn().mockResolvedValue(undefined)
  const setAutoDetectionMethod = vi.fn().mockResolvedValue(undefined)
  const setEnableMarkdown = vi.fn().mockResolvedValue(undefined)
  const setAutoCopy = vi.fn().mockResolvedValue(undefined)
  const setFormatMarkdownOnPaste = vi.fn().mockResolvedValue(undefined)
  const setScrollSync = vi.fn().mockResolvedValue(undefined)
  const setBidirectionalEnabled = vi.fn().mockResolvedValue(undefined)
  const setModelPrompt = vi.fn().mockResolvedValue(undefined)
  const setNativeToOtherModel = vi.fn().mockResolvedValue(undefined)
  const setNativeFollowsGlobal = vi.fn().mockResolvedValue(undefined)
  const fallbackSetter = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    MockUsePreferenceUtils.resetMocks()
    mockLanguages = []
    modelCatalogMock.models = []
    providerCatalogMock.providers = []
    translateGlossaryMock.entries = []
    mergeViewTestState.configs = []

    setBidirectionalPair.mockReset()
    setAutoDetectionMethod.mockReset()
    setEnableMarkdown.mockReset()
    setAutoCopy.mockReset()
    setFormatMarkdownOnPaste.mockReset()
    setScrollSync.mockReset()
    setBidirectionalEnabled.mockReset()
    setModelPrompt.mockReset()
    setNativeToOtherModel.mockReset()
    setNativeFollowsGlobal.mockReset()
    fallbackSetter.mockReset()

    setBasePreferenceMocks()

    const settersByPreference = new Map<string, typeof fallbackSetter>([
      ['feature.translate.page.bidirectional_pair', setBidirectionalPair],
      ['feature.translate.auto_detection_method', setAutoDetectionMethod],
      ['feature.translate.page.enable_markdown', setEnableMarkdown],
      ['feature.translate.page.auto_copy', setAutoCopy],
      ['feature.translate.page.format_markdown_on_paste', setFormatMarkdownOnPaste],
      ['feature.translate.page.scroll_sync', setScrollSync],
      ['feature.translate.page.bidirectional_enabled', setBidirectionalEnabled],
      ['feature.translate.model_prompt', setModelPrompt],
      ['feature.translate.model.native_to_other_id', setNativeToOtherModel],
      ['feature.translate.model.native_to_other_follows_global', setNativeFollowsGlobal]
    ])
    mockUsePreference.mockImplementation((key: string) => {
      return [MockUsePreferenceUtils.getPreferenceValue(key as any), settersByPreference.get(key) ?? fallbackSetter]
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('warns and blocks pair persistence when selecting the same bidirectional language', () => {
    render(<TranslateSettings visible onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('language-picker-en-us'))

    expect(toast.warning).toHaveBeenCalledWith('translate.language.same')
    expect(setBidirectionalPair).not.toHaveBeenCalled()
  })

  it('persists selected auto detection method', async () => {
    render(<TranslateSettings visible onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('translate.detect.method.llm.label'))

    await waitFor(() => expect(setAutoDetectionMethod).toHaveBeenCalledWith('llm'))
  })

  it('persists the Markdown formatter toggle from Miscellaneous settings', async () => {
    render(<TranslateSettings visible onClose={vi.fn()} />)

    const item = screen.getByText('translate.settings.format_markdown_on_paste').parentElement
    if (!item) throw new Error('Markdown formatter setting item not found')
    fireEvent.click(within(item).getByRole('button'))

    await waitFor(() => expect(setFormatMarkdownOnPaste).toHaveBeenCalledWith(true))
  })

  it('renders settings in a modal dialog and closes through the dialog lifecycle', () => {
    const onClose = vi.fn()
    const { rerender } = render(<TranslateSettings visible onClose={onClose} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'translate.settings.title' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'mock-close-dialog' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<TranslateSettings visible={false} onClose={onClose} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps dialog margins and lets each desktop column size its cards independently', () => {
    render(<TranslateSettings visible onClose={vi.fn()} />)

    const dialogContent = screen.getByTestId('dialog-content')
    expect(dialogContent).toHaveClass('w-[calc(100%-2rem)]', 'sm:w-[calc(100%-3rem)]', 'sm:max-w-[960px]')
    // Dialog-scoped tooltip portals must escape the shell while the inner content areas retain scrolling.
    expect(dialogContent).toHaveClass('overflow-visible')
    expect(dialogContent.className).not.toContain('h-[min(')
    expect(screen.getByTestId('translate-settings-card-container')).toHaveClass('@container/translate-settings')
    expect(screen.getByTestId('translate-settings-card-grid')).toHaveClass(
      'grid-cols-1',
      '@[800px]/translate-settings:grid-cols-2'
    )
    expect(screen.getByTestId('translate-settings-left-column')).toHaveClass(
      '@[800px]/translate-settings:flex',
      '@[800px]/translate-settings:flex-col'
    )
    expect(screen.getByTestId('translate-settings-right-column')).toHaveClass(
      '@[800px]/translate-settings:flex',
      '@[800px]/translate-settings:flex-col'
    )
  })

  it('opens advanced settings from the header, moves JSON settings there, and returns to the main view', () => {
    render(<TranslateSettings visible onClose={vi.fn()} />)

    const dialogContent = screen.getByTestId('dialog-content')
    const dialogHeader = screen.getByTestId('translate-settings-header')
    expect(screen.queryByRole('textbox', { name: 'translate.settings.prompt.native_to_other' })).toBeNull()
    expect(screen.queryByText('translate.settings.group_json_view')).toBeNull()
    expect(dialogHeader).toHaveClass('h-14', 'flex-row', 'items-center')
    expect(dialogHeader.className).not.toContain('relative')
    expect(screen.getByTestId('translate-settings-header-actions')).toHaveClass('ml-auto', 'flex', 'items-center')
    expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'settings.moresetting.label' }))

    expect(screen.getByTestId('dialog-content')).toBe(dialogContent)
    expect(screen.getByTestId('translate-settings-header')).toBe(dialogHeader)
    expect(screen.getByRole('heading', { name: 'settings.moresetting.label' })).toBeInTheDocument()
    expect(screen.getByText('translate.settings.group_json_view')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'translate.settings.prompt.other_to_native' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'translate.settings.prompt.native_to_other' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'translate.settings.prompt.polish' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'common.back' }))

    expect(screen.getByTestId('dialog-content')).toBe(dialogContent)
    expect(screen.getByRole('heading', { name: 'translate.settings.title' })).toBeInTheDocument()
    expect(screen.queryByText('translate.settings.group_json_view')).toBeNull()
  })

  it('groups before and after regex rules in one card and places JSON settings immediately after it', async () => {
    render(<TranslateSettings visible onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'settings.moresetting.label' }))

    const beforeGroup = screen.getByRole('group', { name: 'translate.settings.regex_rules.before_translation' })
    expect(screen.getByRole('group', { name: 'translate.settings.regex_rules.after_translation' })).toBeInTheDocument()

    const regexTitle = screen.getByText('translate.settings.regex_rules.title')
    const jsonTitle = screen.getByText('translate.settings.group_json_view')
    expect(regexTitle.compareDocumentPosition(jsonTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(within(beforeGroup).getByRole('button', { name: 'common.add' }))
    await waitFor(() =>
      expect(fallbackSetter).toHaveBeenCalledWith([
        expect.objectContaining({ stage: 'before', pattern: '', flags: 'g', replacement: '' })
      ])
    )
  })

  it('previews each regex stage against temporary input through a selected rule step', async () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.post_processing.regex_rules', [
      { id: 'before-1', pattern: 'foo', replacement: 'bar', flags: 'g', enabled: true, stage: 'before' },
      { id: 'before-2', pattern: 'bar', replacement: 'baz', flags: 'g', enabled: true, stage: 'before' },
      { id: 'after-1', pattern: 'hello', replacement: 'world', flags: 'g', enabled: true, stage: 'after' }
    ])
    render(<TranslateSettings visible onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'settings.moresetting.label' }))

    const beforeGroup = screen.getByRole('group', { name: 'translate.settings.regex_rules.before_translation' })
    const afterGroup = screen.getByRole('group', { name: 'translate.settings.regex_rules.after_translation' })
    expect(within(beforeGroup).getByRole('button', { name: 'common.preview' })).toBeInTheDocument()
    expect(within(afterGroup).getByRole('button', { name: 'common.preview' })).toBeInTheDocument()

    fireEvent.click(within(beforeGroup).getByRole('button', { name: 'common.preview' }))

    expect(
      screen.getByRole('heading', {
        name: 'common.preview · translate.settings.regex_rules.before_translation'
      })
    ).toBeInTheDocument()
    expect(screen.getByTestId('dialog-content')).toHaveClass('sm:max-w-[1280px]')
    expect(screen.getByTestId('dialog-content')).not.toHaveClass('sm:max-w-[960px]')
    const source = screen.getByRole('textbox', { name: 'translate.settings.regex_rules.preview_source' })
    const result = screen.getByRole('textbox', { name: 'translate.settings.regex_rules.preview_diff' })
    const diff = screen.getByRole('region', { name: 'translate.settings.regex_rules.preview_diff' })
    // These classes are the overflow contract: long pasted text and long rule lists stay inside the preview shell.
    expect(screen.getByTestId('regex-preview-layout')).toHaveClass('h-[min(620px,calc(100vh-8rem))]', 'min-h-0')
    expect(screen.getByTestId('regex-preview-steps')).toHaveClass('min-h-0', 'overflow-y-auto')
    expect(source).not.toHaveAttribute('readonly')
    expect(result).toHaveAttribute('readonly')
    expect(source).toHaveAttribute('placeholder', 'translate.settings.regex_rules.preview_source_placeholder')
    expect(result).toHaveAttribute('placeholder', 'translate.settings.regex_rules.preview_result_placeholder')
    expect(diff).toHaveClass('min-h-0', 'overflow-hidden')
    expect(diff.firstElementChild).toHaveClass('divide-x', 'border-b', 'bg-background-subtle')
    expect(mergeViewTestState.configs[0]).toEqual(
      expect.objectContaining({
        orientation: 'a-b',
        a: expect.objectContaining({
          extensions: expect.arrayContaining([expect.objectContaining({ kind: 'lineWrapping' })])
        }),
        b: expect.objectContaining({
          extensions: expect.arrayContaining([
            expect.objectContaining({ kind: 'editable', value: false }),
            expect.objectContaining({ kind: 'lineWrapping' }),
            expect.objectContaining({ kind: 'readOnly', value: true })
          ])
        })
      })
    )
    const sourceUpdateListener = mergeViewTestState.configs[0].a.extensions
      .flat()
      .find((extension: any) => extension?.kind === 'updateListener')?.value
    void act(() => sourceUpdateListener({ docChanged: true, state: { doc: { toString: () => 'foo' } } }))
    await waitFor(() => expect(result).toHaveValue('baz'))

    const firstRuleButton = screen.getAllByText('translate.settings.regex_rules.preview_rule')[0].closest('button')
    if (!firstRuleButton) throw new Error('First regex preview step was not rendered as a button')
    fireEvent.click(firstRuleButton)
    await waitFor(() => expect(result).toHaveValue('bar'))

    fireEvent.click(screen.getByRole('button', { name: 'common.back' }))
    expect(screen.getByRole('heading', { name: 'settings.moresetting.label' })).toBeInTheDocument()
  })

  it('shows skipped regex rule errors while later valid rules still affect the preview', async () => {
    const user = userEvent.setup()
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.post_processing.regex_rules', [
      { id: 'flags', pattern: 'foo', replacement: 'x', flags: 'z', enabled: true, stage: 'before' },
      { id: 'pattern', pattern: '[', replacement: 'x', flags: 'g', enabled: true, stage: 'before' },
      { id: 'replacement', pattern: 'foo', replacement: String.raw`\xZ`, flags: 'g', enabled: true, stage: 'before' },
      { id: 'disabled', pattern: '[', replacement: 'x', flags: 'z', enabled: false, stage: 'before' },
      { id: 'valid', pattern: 'foo', replacement: 'bar', flags: 'g', enabled: true, stage: 'before' }
    ])
    render(<TranslateSettings visible onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'settings.moresetting.label' }))
    await user.click(
      within(screen.getByRole('group', { name: 'translate.settings.regex_rules.before_translation' })).getByRole(
        'button',
        { name: 'common.preview' }
      )
    )

    const sourceUpdateListener = mergeViewTestState.configs[0].a.extensions
      .flat()
      .find((extension: any) => extension?.kind === 'updateListener')?.value
    void act(() => sourceUpdateListener({ docChanged: true, state: { doc: { toString: () => 'foo' } } }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('translate.settings.regex_rules.preview_issues')).toBeInTheDocument()
    expect(within(alert).getByText('translate.settings.regex_rules.preview_issue_rule 1')).toBeInTheDocument()
    expect(within(alert).getByText('translate.settings.regex_rules.preview_issue_rule 2')).toBeInTheDocument()
    expect(within(alert).getByText('translate.settings.regex_rules.preview_issue_rule 3')).toBeInTheDocument()
    expect(within(alert).queryByText('translate.settings.regex_rules.preview_issue_rule 4')).toBeNull()
    expect(within(alert).getByText('translate.settings.regex_rules.preview_issue_field.flags')).toBeInTheDocument()
    expect(within(alert).getByText('translate.settings.regex_rules.preview_issue_field.pattern')).toBeInTheDocument()
    expect(
      within(alert).getByText('translate.settings.regex_rules.preview_issue_field.replacement')
    ).toBeInTheDocument()
    expect(alert).toHaveTextContent(/Invalid|invalid/)
    expect(screen.getByRole('textbox', { name: 'translate.settings.regex_rules.preview_diff' })).toHaveValue('bar')

    await user.click(screen.getByRole('button', { name: /translate\.settings\.regex_rules\.preview_source/ }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('selects follow-global or a direction model from the same model menu', async () => {
    render(<TranslateSettings visible onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByTestId('model-selector-fixed-option')[0])
    await waitFor(() => expect(setNativeFollowsGlobal).toHaveBeenCalledWith(true))

    fireEvent.click(screen.getAllByTestId('model-selector-direction-model')[0])
    await waitFor(() => {
      expect(setNativeToOtherModel).toHaveBeenCalledWith('openai::directional')
      expect(setNativeFollowsGlobal).toHaveBeenCalledWith(false)
    })
  })

  it('shows the effective model and provider in each configured model selector', () => {
    modelCatalogMock.models = [
      { id: 'deepseek::v4', providerId: 'deepseek', name: 'DeepSeek V4 Flash' },
      { id: 'qwen::3.5', providerId: 'qwen', name: 'Qwen3.5 Flash' }
    ]
    providerCatalogMock.providers = [
      { id: 'deepseek', name: 'DeepSeek' },
      { id: 'qwen', name: 'Qwen' }
    ]
    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_id': 'deepseek::v4',
      'feature.translate.model.native_to_other_id': 'openai::directional',
      'feature.translate.model.other_to_native_id': 'openai::directional',
      'feature.translate.model.polish_id': 'qwen::3.5'
    })

    render(<TranslateSettings visible onClose={vi.fn()} />)

    expect(screen.getAllByTestId('model-avatar').map((avatar) => avatar.textContent)).toEqual([
      'DeepSeek V4 Flash',
      'DeepSeek V4 Flash',
      'DeepSeek V4 Flash',
      'Qwen3.5 Flash'
    ])
    expect(screen.getAllByText('|')).toHaveLength(2)
    expect(screen.getByText('DeepSeek')).toHaveAttribute('title', 'DeepSeek')
    expect(screen.getByText('Qwen')).toHaveAttribute('title', 'Qwen')
  })
})

describe('TranslateSettingsPanelContent', () => {
  const setPersisted = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    MockUsePreferenceUtils.resetMocks()
    mockLanguages = []
    modelCatalogMock.models = []
    translateGlossaryMock.entries = []

    setPersisted.mockReset()
    translateLanguageMutationsMock.add.mockReset()
    translateLanguageMutationsMock.add.mockResolvedValue(undefined)
    translateLanguageMutationsMock.update.mockReset()
    translateLanguageMutationsMock.update.mockResolvedValue(undefined)
    translateLanguageMutationsMock.remove.mockReset()
    translateLanguageMutationsMock.remove.mockResolvedValue(undefined)

    MockUsePreferenceUtils.setMultiplePreferenceValues({
      'feature.translate.model_prompt': TRANSLATE_PROMPT,
      'feature.translate.prompt.native_to_other': TRANSLATE_PROMPT,
      'feature.translate.prompt.other_to_native': TRANSLATE_PROMPT,
      'feature.translate.prompt.polish': TRANSLATE_PROMPT,
      'feature.translate.request.custom_parameters': [],
      'feature.translate.request.polish_custom_parameters': [],
      'feature.translate.reasoning.translate_auto_disable': true,
      'feature.translate.reasoning.polish_auto_disable': true,
      'feature.translate.post_processing.regex_rules': []
    })
    mockUsePreference.mockImplementation((key: string) => {
      if (key === 'feature.translate.prompt.native_to_other') {
        return [MockUsePreferenceUtils.getPreferenceValue('feature.translate.prompt.native_to_other'), setPersisted]
      }
      return [MockUsePreferenceUtils.getPreferenceValue(key as any), vi.fn().mockResolvedValue(undefined)]
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows a scoped notice when custom parameters override reasoning policy', () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.request.custom_parameters', [
      { name: 'reasoning_effort', type: 'string', value: 'high' }
    ])

    render(<TranslateSettingsPanelContent />)

    expect(screen.getAllByRole('note')).toHaveLength(1)
    expect(screen.getByRole('note')).toHaveTextContent('translate.settings.custom_body.reasoning_override')
  })

  it('does not persist the default prompt when the saved prompt loads after mount', () => {
    const { rerender } = render(<TranslateSettingsPanelContent />)

    MockUsePreferenceUtils.setPreferenceValue('feature.translate.prompt.native_to_other', 'saved custom prompt')
    rerender(<TranslateSettingsPanelContent />)

    expect(getPromptTextarea()).toHaveValue('saved custom prompt')
    expect(setPersisted).not.toHaveBeenCalled()
  })

  it('debounces user prompt edits before persisting', async () => {
    vi.useFakeTimers()
    render(<TranslateSettingsPanelContent />)

    fireEvent.change(getPromptTextarea(), { target: { value: 'new custom prompt' } })

    await act(async () => vi.advanceTimersByTime(399))
    expect(setPersisted).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTime(1))
    expect(setPersisted).toHaveBeenCalledWith('new custom prompt')
  })

  it('preserves in-progress edit when a remote prompt value arrives mid-edit', () => {
    vi.useFakeTimers()
    const { rerender } = render(<TranslateSettingsPanelContent />)

    fireEvent.change(getPromptTextarea(), { target: { value: 'user typing' } })
    expect(getPromptTextarea()).toHaveValue('user typing')

    // Remote update arrives before the 400ms debounce fires; the in-progress edit must win.
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.prompt.native_to_other', 'external update')
    rerender(<TranslateSettingsPanelContent />)

    expect(getPromptTextarea()).toHaveValue('user typing')
    expect(setPersisted).not.toHaveBeenCalled()
  })

  it('flushes pending prompt edit on unmount even if the debounce timer has not fired', () => {
    vi.useFakeTimers()
    const { unmount } = render(<TranslateSettingsPanelContent />)

    fireEvent.change(getPromptTextarea(), { target: { value: 'pending value' } })
    expect(setPersisted).not.toHaveBeenCalled()

    unmount()

    expect(setPersisted).toHaveBeenCalledTimes(1)
    expect(setPersisted).toHaveBeenCalledWith('pending value')
  })

  it('shows validation error and skips add when custom language name is empty', () => {
    render(<TranslateSettingsPanelContent />)

    submitCustomLanguage({ langCode: 'x-test' })

    expect(screen.getByText('settings.translate.custom.error.value.empty')).toBeInTheDocument()
    expect(translateLanguageMutationsMock.add).not.toHaveBeenCalled()
  })

  it('shows validation error and skips add when custom language code is empty', () => {
    render(<TranslateSettingsPanelContent />)

    submitCustomLanguage({ value: 'Klingon' })

    expect(screen.getByText('settings.translate.custom.error.langCode.empty')).toBeInTheDocument()
    expect(translateLanguageMutationsMock.add).not.toHaveBeenCalled()
  })

  it('shows validation error and skips add when custom language code is invalid', () => {
    render(<TranslateSettingsPanelContent />)

    submitCustomLanguage({ value: 'Klingon', langCode: 'invalid_code' })

    expect(screen.getByText('settings.translate.custom.error.langCode.invalid')).toBeInTheDocument()
    expect(translateLanguageMutationsMock.add).not.toHaveBeenCalled()
  })

  it('shows validation error and skips add when custom language code conflicts with builtin language', () => {
    render(<TranslateSettingsPanelContent />)

    submitCustomLanguage({ value: 'English Variant', langCode: 'en-us' })

    expect(screen.getByText('settings.translate.custom.error.langCode.builtin')).toBeInTheDocument()
    expect(translateLanguageMutationsMock.add).not.toHaveBeenCalled()
  })

  it('shows validation error and skips add when custom language code already exists', () => {
    mockLanguages = [createCustomLanguage('xk-la', 'Klingon')]
    render(<TranslateSettingsPanelContent />)

    submitCustomLanguage({ value: 'Klingon Alt', langCode: 'xk-la' })

    expect(screen.getByText('settings.translate.custom.error.langCode.exists')).toBeInTheDocument()
    expect(translateLanguageMutationsMock.add).not.toHaveBeenCalled()
  })

  it('submits normalized custom language payload when inputs are valid', async () => {
    render(<TranslateSettingsPanelContent />)

    submitCustomLanguage({ value: ' Klingon ', langCode: 'XK-LA' })

    await waitFor(() =>
      expect(translateLanguageMutationsMock.add).toHaveBeenCalledWith({
        value: 'Klingon',
        langCode: 'xk-la',
        emoji: '🌐'
      })
    )
  })

  it('updates custom language row and keeps normalized payload', async () => {
    mockLanguages = [createCustomLanguage('xk-la', 'Klingon', '🖖')]
    render(<TranslateSettingsPanelContent />)

    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }))
    fireEvent.change(screen.getByDisplayValue('Klingon'), { target: { value: ' Klingon Prime ' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'common.save' }))
    })

    await waitFor(() => expect(translateLanguageMutationsMock.update).toHaveBeenCalledWith('xk-la', expect.any(Object)))
    expect(translateLanguageMutationsMock.update).toHaveBeenCalledWith('xk-la', {
      value: 'Klingon Prime',
      emoji: '🖖'
    })
  })

  it('cancels custom language editing without calling update', () => {
    mockLanguages = [createCustomLanguage('xk-la', 'Klingon', '🖖')]
    render(<TranslateSettingsPanelContent />)

    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    expect(translateLanguageMutationsMock.update).not.toHaveBeenCalled()
  })

  it('deletes custom language after confirm', async () => {
    mockLanguages = [createCustomLanguage('xk-la', 'Klingon', '🖖')]
    render(<TranslateSettingsPanelContent />)

    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }))
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-settings.translate.custom.delete.title'))
    })

    await waitFor(() => expect(translateLanguageMutationsMock.remove).toHaveBeenCalledWith('xk-la'))
  })
})
