import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type * as CherryStudioUi from '@cherrystudio/ui'

import TranslateOutputPane from '../TranslateOutputPane'

const mocks = vi.hoisted(() => ({
  codeViewer: vi.fn(),
  t: vi.fn((key: string) => key)
}))

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn()
  },
  useTranslation: () => ({ t: mocks.t })
}))

vi.mock('@renderer/utils/style', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')
}))

vi.mock('@renderer/hooks/useCodeStyle', () => ({
  useCmTheme: () => 'light'
}))

vi.mock('@renderer/components/CodeViewer', () => ({
  default: (props: { value: string; wrapped: boolean }) => {
    mocks.codeViewer(props)
    return <pre data-wrapped={props.wrapped}>{props.value}</pre>
  }
}))

vi.mock('@cherrystudio/ui', async (importOriginal) => importOriginal<typeof CherryStudioUi>())

const baseProps = () => ({
  translatedContent: '',
  enableMarkdown: false,
  translating: false,
  copied: false,
  onCopy: vi.fn(),
  onScroll: vi.fn()
})

describe('TranslateOutputPane', () => {
  it('shows the V1 placeholder while the output is empty', () => {
    render(<TranslateOutputPane {...baseProps()} />)

    expect(screen.getByText('translate.output.placeholder')).toBeInTheDocument()
  })

  it('shows translated content with its word and token counter', () => {
    const props = baseProps()
    props.translatedContent = 'partial output'

    render(<TranslateOutputPane {...props} wordCount={2} tokenCount={7} />)

    expect(screen.getByText('partial output')).toBeInTheDocument()
    expect(screen.getByText('2 translate.counter.words / 7 translate.counter.tokens')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeEnabled()
  })

  it('shows the processing indicator while waiting for output', () => {
    const props = baseProps()
    props.translating = true

    render(<TranslateOutputPane {...props} />)

    expect(screen.getByText('translate.processing')).toBeInTheDocument()
  })

  it('renders Markdown and LaTeX delimiters through KaTeX', () => {
    const props = baseProps()
    props.enableMarkdown = true
    props.translatedContent = ['Inline $x^2$ and \\(y^2\\).', '', '$$', 'z^2', '$$', '', '\\[', 'w^2', '\\]'].join('\n')

    const { container, rerender } = render(<TranslateOutputPane {...props} />)

    expect(container.querySelector('[data-ui~="translate.output"] .markdown')).not.toBeNull()
    expect(container.querySelector('.markdown')?.closest('.overflow-x-auto')).not.toBeNull()
    expect(container.querySelectorAll('.katex')).toHaveLength(4)
    expect(container.querySelectorAll('.katex-display')).toHaveLength(2)
    expect(container.querySelector('.katex-error')).toBeNull()

    props.enableMarkdown = false
    rerender(<TranslateOutputPane {...props} />)
    expect(container.querySelector('.katex')).toBeNull()
    expect(screen.getByText(/Inline \$x\^2\$/)).toBeInTheDocument()
  })

  it('renders Markdown tables without Streamdown action chrome', () => {
    const props = baseProps()
    props.enableMarkdown = true
    props.translatedContent = '| Name | Value |\n| --- | --- |\n| Alpha | 1 |'

    const { container } = render(<TranslateOutputPane {...props} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(container.querySelector('.markdown [data-streamdown="table-wrapper"]')).toBeNull()
    expect(container.querySelector('.markdown button')).toBeNull()
  })

  it.each([
    { language: 'text', source: 'A very long translated line' },
    { language: 'latex', source: String.raw`\section{A very long translated line}` }
  ])('toggles wrapping for $language source code', async ({ language, source }) => {
    const user = userEvent.setup()
    const props = baseProps()
    props.enableMarkdown = true
    props.translatedContent = ['```' + language, source, '```'].join('\n')

    const { container } = render(<TranslateOutputPane {...props} />)

    if (language === 'latex') {
      expect(screen.queryByRole('button', { name: 'code_block.wrap.off' })).not.toBeInTheDocument()
      await user.click(await screen.findByRole('button', { name: 'preview.source' }))
      await user.click(screen.getByRole('button', { name: 'code_block.more' }))
    }

    const unwrapButton = await screen.findByRole('button', { name: 'code_block.wrap.off' })
    expect(screen.getByText(source)).toBeInTheDocument()
    expect(container.querySelector('pre')).toHaveAttribute('data-wrapped', 'true')

    await user.click(unwrapButton)

    const wrapButton = screen.getByRole('button', { name: 'code_block.wrap.on' })
    expect(container.querySelector('pre')).toHaveAttribute('data-wrapped', 'false')

    await user.click(wrapButton)

    expect(screen.getByRole('button', { name: 'code_block.wrap.off' })).toBeInTheDocument()
    expect(container.querySelector('pre')).toHaveAttribute('data-wrapped', 'true')
  })
  it('shows completed structured JSON ahead of Markdown when explicitly enabled', () => {
    const props = baseProps()
    props.translatedContent = '{"message":"line 1\\nline 2"}'
    props.enableMarkdown = true

    const { container } = render(
      <TranslateOutputPane
        {...props}
        enableJsonStructure
        jsonStructureCopyBlankLineBetweenRows={false}
        jsonStructureCopySeparator="colon-space"
      />
    )

    expect(screen.getByTestId('json-structure-view')).toBeInTheDocument()
    expect(container.querySelector('.katex')).toBeNull()
  })

  it('keeps rendering streaming JSON as text until translation completes', () => {
    const props = baseProps()
    props.translatedContent = '{"value":1}'
    props.translating = true

    render(<TranslateOutputPane {...props} enableJsonStructure />)

    expect(screen.queryByTestId('json-structure-view')).not.toBeInTheDocument()
    expect(screen.getByText('{"value":1}')).toBeInTheDocument()
  })

  it('copies a manual body-text selection as semantic HTML', () => {
    const props = baseProps()
    props.enableMarkdown = true
    props.translatedContent = 'Ordinary **emphasized** body text.'
    render(<TranslateOutputPane {...props} />)
    const body = screen.getByText('emphasized')
    const range = document.createRange()
    range.selectNodeContents(body)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    const data = new Map<string, string>()
    const event = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { setData: (type: string, value: string) => data.set(type, value) }
    })
    fireEvent(body, event)
    selection.removeAllRanges()
    expect(data.get('text/plain')).toBe('emphasized')
    const html = document.createElement('div')
    html.innerHTML = data.get('text/html') ?? ''
    expect(html.querySelector('p strong')?.textContent).toBe('emphasized')
    expect(html.querySelector('h1, [style], [class], [data-streamdown]')).toBeNull()
  })
})
