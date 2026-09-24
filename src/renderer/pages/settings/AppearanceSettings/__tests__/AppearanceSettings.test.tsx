import { MockUsePreferenceUtils } from '@test-mocks/renderer/usePreference'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { popup } from '@renderer/services/popup'
import { toast } from '@renderer/services/toast'
import { type MenuPresentationMode, ThemeMode } from '@shared/data/preference/preferenceTypes'
import { V1_CUSTOM_CSS_MARKER } from '@shared/utils/customCssMigration'

import AppearanceSettings, { confirmMenuPresentationModeChange } from '../AppearanceSettings'

const t = (key: string) => key

const i18nMock = vi.hoisted(() => ({
  language: 'zh-CN',
  resolvedLanguage: 'zh-CN'
}))

vi.mock('@renderer/i18n/resolver', () => ({
  default: i18nMock
}))

vi.mock('@renderer/hooks/translate', () => ({
  useLanguages: () => ({
    languages: [
      { emoji: '🇨🇳', langCode: 'zh-cn', value: 'Chinese' },
      { emoji: '🇰🇷', langCode: 'ko-kr', value: 'Korean' }
    ],
    getLabel: (language: { value: string }) => language.value
  })
}))

const mocks = vi.hoisted(() => ({ request: vi.fn() }))
const themeMocks = vi.hoisted(() => ({ setTheme: vi.fn() }))
const userThemeMocks = vi.hoisted(() => ({ setUserTheme: vi.fn() }))
vi.mock('@renderer/ipc', () => ({ ipcApi: { request: mocks.request } }))

vi.mock('../components/FontCombobox', async () => {
  const React = await import('react')

  return {
    default: ({ ariaLabel, defaultLabel, fonts, onChange, value }: any) =>
      React.createElement(
        'select',
        {
          'aria-label': ariaLabel,
          value,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)
        },
        React.createElement('option', { value: '' }, defaultLabel),
        fonts.map((font: string) => React.createElement('option', { key: font, value: font }, font))
      )
  }
})

vi.mock('@cherrystudio/ui', async () => {
  const React = await import('react')
  const passthrough =
    (tag: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(tag, props, children)

  const Button = ({ children, onPress, ...props }: any) =>
    React.createElement('button', { ...props, onClick: onPress ?? props.onClick }, children)

  const PopoverContext = React.createContext({
    open: false,
    onOpenChange: undefined as undefined | ((open: boolean) => void)
  })
  const SelectContext = React.createContext({
    onValueChange: undefined as undefined | ((value: string) => void),
    value: undefined as string | undefined
  })

  return {
    Button,
    CodeEditor: ({ value, ...props }: any) =>
      React.createElement('textarea', { ...props, value: value ?? '', readOnly: true }),
    Combobox: ({ options = [], popoverClassName, renderOption, value, ...props }: any) => {
      const cleanProps = { ...props }
      delete cleanProps.emptyText
      delete cleanProps.searchPlacement
      delete cleanProps.triggerStyle

      return React.createElement(
        'div',
        { 'data-popover-class-name': popoverClassName },
        React.createElement(
          'select',
          { ...cleanProps, value: value ?? '', readOnly: true },
          options.map((option: any) =>
            React.createElement('option', { key: option.value, value: option.value }, option.label)
          )
        ),
        renderOption
          ? React.createElement(
              'div',
              { 'data-testid': 'combobox-options' },
              options.map((option: any) => React.createElement('div', { key: option.value }, renderOption(option)))
            )
          : null
      )
    },
    CustomTag: passthrough('span'),
    Flex: passthrough('div'),
    InfoTooltip: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    Input: (props: any) => React.createElement('input', props),
    MenuItem: ({ active, icon, label, onClick, ...props }: any) => {
      const cleanProps = { ...props }
      delete cleanProps.labelClassName

      return React.createElement(
        'button',
        { ...cleanProps, 'aria-pressed': active, onClick, type: 'button' },
        icon,
        label
      )
    },
    MenuList: passthrough('div'),
    PageHeader: ({ title }: { title: string }) => React.createElement('h1', null, title),
    Popover: ({ children, open = false, onOpenChange }: any) =>
      React.createElement(PopoverContext.Provider, { value: { open, onOpenChange } }, children),
    PopoverContent: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
    PopoverTrigger: ({ children, asChild }: any) =>
      asChild && React.isValidElement(children) ? children : React.createElement('div', null, children),
    RowFlex: passthrough('div'),
    // Mirrors the real control's radiogroup/radio semantics so tests address it the way
    // assistive technology does, rather than through whatever DOM the mock happens to emit.
    SegmentedControl: ({ options = [], value, onValueChange, ...props }: any) =>
      React.createElement(
        'div',
        { 'aria-label': props['aria-label'], role: 'radiogroup' },
        options.map((option: any) =>
          React.createElement(
            'button',
            {
              'aria-checked': value === option.value,
              key: option.value,
              onClick: () => onValueChange?.(option.value),
              role: 'radio',
              type: 'button'
            },
            option.label
          )
        )
      ),
    Select: ({ children, onValueChange, value }: any) =>
      React.createElement(SelectContext.Provider, { value: { onValueChange, value } }, children),
    SelectContent: passthrough('div'),
    SelectItem: ({ children, value, ...props }: any) => {
      const context = React.use(SelectContext)
      return React.createElement(
        'button',
        {
          ...props,
          'data-value': value,
          onClick: () => context.onValueChange?.(value),
          role: 'option',
          type: 'button'
        },
        children
      )
    },
    SelectTrigger: ({ children, size, ...props }: any) =>
      React.createElement('button', { ...props, 'data-size': size, role: 'combobox', type: 'button' }, children),
    SelectValue: () => null,
    Switch: ({ checked, onCheckedChange, ...props }: any) =>
      React.createElement('input', {
        ...props,
        checked: Boolean(checked),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => onCheckedChange?.(event.target.checked),
        type: 'checkbox'
      }),
    Tooltip: ({ children, className, classNames, content, title }: any) =>
      React.createElement(
        'div',
        {
          className: [className, classNames?.placeholder].filter(Boolean).join(' ') || undefined,
          ...(content || title ? { 'data-title': content || title } : {})
        },
        children
      )
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t
  })
}))

vi.mock('@renderer/hooks/useTheme', () => ({
  useTheme: () => ({
    settedTheme: 'light',
    setTheme: themeMocks.setTheme,
    theme: 'light'
  })
}))

vi.mock('@renderer/hooks/useCodeStyle', () => ({
  useCodeStyle: () => ({
    activeCmTheme: 'light'
  }),
  useCmTheme: () => 'light'
}))

vi.mock('@renderer/hooks/useUserTheme', () => ({
  default: () => ({
    setUserTheme: userThemeMocks.setUserTheme,
    userTheme: { colorPrimary: '#1677ff', userCodeFontFamily: '', userFontFamily: '' }
  })
}))

vi.mock('@renderer/hooks/useTimer', () => ({
  useTimer: () => ({
    setTimeoutTimer: vi.fn()
  })
}))

vi.mock('@renderer/components/chat/settings/ChatPreferenceSections', () => ({
  default: () => <div data-testid="chat-preference-sections" />
}))

vi.mock('@renderer/components/SettingsPrimitives', async () => {
  const React = await import('react')
  const passthrough =
    (tag: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(tag, props, children)

  return {
    SettingDescription: passthrough('p'),
    SettingDivider: passthrough('hr'),
    SettingGroup: passthrough('section'),
    SettingRow: passthrough('div'),
    SettingRowTitle: passthrough('div'),
    SettingsContentBody: passthrough('main'),
    SettingsContentColumn: passthrough('main'),
    SettingTitle: passthrough('h2')
  }
})

vi.mock('@renderer/components/Scrollbar', () => ({
  default: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>
}))

vi.mock('@renderer/components/icons/ResetIcon', () => ({
  default: (props: any) => <span data-testid="reset-icon" {...props} />
}))

vi.mock('../components/ThemeColorPicker', () => ({
  default: ({ ariaLabel, value }: { ariaLabel?: string; value?: string }) => (
    <button aria-label={ariaLabel} type="button">
      {value ?? 'theme-color'}
    </button>
  )
}))
vi.mock('@renderer/utils/error', () => ({
  formatErrorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error))
}))

describe('AppearanceSettings menu presentation mode', () => {
  const setMenuPresentationMode = vi.fn<(mode: MenuPresentationMode) => Promise<void>>()
  const setTimeoutTimer = vi.fn<(key: string, callback: () => void, delay: number) => void>()

  beforeEach(() => {
    vi.clearAllMocks()
    setMenuPresentationMode.mockResolvedValue(undefined)
    // Confirm resolves true so the confirmed branch runs; a test that needs the decline
    // path overrides with mockResolvedValueOnce(false).
    vi.mocked(popup.confirm).mockImplementation(async () => true)
  })

  it('does nothing when the selected mode is already active', () => {
    void confirmMenuPresentationModeChange({
      currentMode: 'cherry',
      mode: 'cherry',
      setMenuPresentationMode,
      setTimeoutTimer,
      t
    })

    expect(popup.confirm).not.toHaveBeenCalled()
  })

  it('saves the selected mode and schedules relaunch after confirmation', async () => {
    await confirmMenuPresentationModeChange({
      currentMode: 'cherry',
      mode: 'native',
      setMenuPresentationMode,
      setTimeoutTimer,
      t
    })

    expect(popup.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'settings.general.common.menu.presentation_mode.restart.title',
        content: 'settings.general.common.menu.presentation_mode.restart.content',
        okText: 'common.confirm',
        cancelText: 'common.cancel',
        centered: true
      })
    )

    expect(setMenuPresentationMode).toHaveBeenCalledWith('native')
    expect(setTimeoutTimer).toHaveBeenCalledWith('handleMenuPresentationModeChange', expect.any(Function), 500)

    setTimeoutTimer.mock.calls[0][1]()
    expect(window.api.application.relaunch).toHaveBeenCalled()
  })

  it('surfaces save failures without scheduling relaunch', async () => {
    const error = new Error('save failed')
    setMenuPresentationMode.mockRejectedValue(error)

    await expect(
      confirmMenuPresentationModeChange({
        currentMode: 'cherry',
        mode: 'native',
        setMenuPresentationMode,
        setTimeoutTimer,
        t
      })
    ).rejects.toThrow('save failed')

    expect(toast.error).toHaveBeenCalledWith('save failed')
    expect(setTimeoutTimer).not.toHaveBeenCalled()
    expect(window.api.application.relaunch).not.toHaveBeenCalled()
  })
})

describe('AppearanceSettings selectors', () => {
  beforeEach(() => {
    MockUsePreferenceUtils.resetMocks()
    i18nMock.language = 'zh-CN'
    i18nMock.resolvedLanguage = 'zh-CN'
    mocks.request.mockReset()
    themeMocks.setTheme.mockReset()
    userThemeMocks.setUserTheme.mockReset()
    mocks.request.mockImplementation((route: string) => {
      if (route === 'system.get_fonts') return Promise.resolve([])
      if (route === 'app.adjust_zoom') return Promise.resolve(1)
      return Promise.resolve(undefined)
    })
  })

  it('shows the resolved i18n language when no app language preference is saved', async () => {
    MockUsePreferenceUtils.setPreferenceValue('app.language', null)

    render(<AppearanceSettings />)

    await waitFor(() => {
      expect(mocks.request).toHaveBeenCalledWith('system.get_fonts')
      expect(mocks.request).toHaveBeenCalledWith('app.adjust_zoom', { delta: 0 })
    })

    expect(screen.getByRole('combobox', { name: /中文/ })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /English/ })).not.toBeInTheDocument()
  })

  it('persists the user native language from the display and language section', async () => {
    MockUsePreferenceUtils.setPreferenceValue('feature.translate.native_language', null)

    render(<AppearanceSettings />)

    expect(screen.getByText('translate.settings.native_language')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: /Korean/ }))

    await waitFor(() => {
      expect(MockUsePreferenceUtils.getPreferenceValue('feature.translate.native_language')).toBe('ko-kr')
    })
  })

  it('does not render manual chat layout switches', async () => {
    render(<AppearanceSettings />)

    await waitFor(() => {
      expect(mocks.request).toHaveBeenCalledWith('system.get_fonts')
      expect(mocks.request).toHaveBeenCalledWith('app.adjust_zoom', { delta: 0 })
    })

    expect(screen.queryByText('settings.messages.layout.conversation')).not.toBeInTheDocument()
    expect(screen.queryByText('settings.messages.layout.work')).not.toBeInTheDocument()
  })

  it('loads the font list once and saves global and code font selections independently', async () => {
    mocks.request.mockImplementation((route: string) => {
      if (route === 'system.get_fonts') return Promise.resolve(['Arial', 'JetBrains Mono'])
      if (route === 'app.adjust_zoom') return Promise.resolve(1)
      return Promise.resolve(undefined)
    })

    render(<AppearanceSettings />)

    const globalFont = await screen.findByRole('combobox', { name: 'settings.display.font.global' })
    const codeFont = await screen.findByRole('combobox', { name: 'settings.display.font.code' })

    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: 'Arial' })).toHaveLength(2)
    })
    expect(mocks.request.mock.calls.filter(([route]) => route === 'system.get_fonts')).toHaveLength(1)

    fireEvent.change(globalFont, { target: { value: 'Arial' } })
    expect(userThemeMocks.setUserTheme).toHaveBeenLastCalledWith(
      expect.objectContaining({ userFontFamily: 'Arial', userCodeFontFamily: '' })
    )

    fireEvent.change(codeFont, { target: { value: 'JetBrains Mono' } })
    expect(userThemeMocks.setUserTheme).toHaveBeenLastCalledWith(
      expect.objectContaining({ userFontFamily: '', userCodeFontFamily: 'JetBrains Mono' })
    )
  })

  it('shows every theme as a visual choice and switches from the preview', async () => {
    render(<AppearanceSettings />)

    await waitFor(() => {
      expect(mocks.request).toHaveBeenCalledWith('system.get_fonts')
    })

    const lightThemeButton = screen.getByRole('button', { name: 'settings.theme.light' })
    const lightThemePreview = lightThemeButton.firstElementChild
    const lightThemeLabel = lightThemePreview?.nextElementSibling

    expect(lightThemeButton).toHaveAttribute('aria-pressed', 'true')
    expect(lightThemePreview).toHaveClass(
      'border-primary',
      'ring-2',
      'group-focus-visible:border-ring',
      'group-focus-visible:bg-accent'
    )
    expect(lightThemePreview).not.toHaveClass('group-focus-visible:ring-3', 'group-focus-visible:ring-ring/50')
    expect(lightThemeLabel).toHaveTextContent('settings.theme.light')
    expect(screen.getByRole('button', { name: 'settings.theme.dark' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'settings.theme.system' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'settings.theme.dark' }))

    expect(themeMocks.setTheme).toHaveBeenCalledWith(ThemeMode.dark)
  })

  it('places the theme group before the display and language group', () => {
    const { container } = render(<AppearanceSettings />)
    const groupTitles = Array.from(container.querySelectorAll('section > h2')).map((heading) => heading.textContent)

    expect(groupTitles.slice(0, 2)).toEqual([
      'settings.theme.title',
      'settings.general.common.sections.display_language'
    ])
  })

  it('routes each list position row to its own module preference', async () => {
    MockUsePreferenceUtils.setPreferenceValue('topic.tab.position', 'left')
    MockUsePreferenceUtils.setPreferenceValue('agent.session.position', 'left')

    render(<AppearanceSettings />)

    const chatGroup = screen.getByRole('radiogroup', { name: 'settings.display.list_position.chat' })
    fireEvent.click(within(chatGroup).getByRole('radio', { name: 'settings.topic.position.right' }))

    await waitFor(() => {
      expect(MockUsePreferenceUtils.getPreferenceValue('topic.tab.position')).toBe('right')
    })
    expect(MockUsePreferenceUtils.getPreferenceValue('agent.session.position')).toBe('left')

    const workGroup = screen.getByRole('radiogroup', { name: 'settings.display.list_position.work' })
    fireEvent.click(within(workGroup).getByRole('radio', { name: 'settings.topic.position.right' }))

    await waitFor(() => {
      expect(MockUsePreferenceUtils.getPreferenceValue('agent.session.position')).toBe('right')
    })
  })

  it('shows migration guidance for marked v1 custom CSS', () => {
    MockUsePreferenceUtils.setPreferenceValue('ui.custom_css', `${V1_CUSTOM_CSS_MARKER}\nbody { color: red; }`)

    render(<AppearanceSettings />)

    expect(screen.getByText('settings.display.custom.css.migration_notice')).toBeInTheDocument()
  })

  it('does not show migration guidance for unmarked custom CSS', () => {
    MockUsePreferenceUtils.setPreferenceValue('ui.custom_css', 'body { color: red; }')

    render(<AppearanceSettings />)

    expect(screen.queryByText('settings.display.custom.css.migration_notice')).not.toBeInTheDocument()
  })
})
