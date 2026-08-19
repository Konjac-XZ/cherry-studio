import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import TranslateOutputPane from '../TranslateOutputPane'

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn()
  },
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@renderer/utils/style', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')
}))

vi.mock('@cherrystudio/ui', () => ({
  Scrollbar: ({ children, ref, ...props }: React.ComponentProps<'div'> & { ref?: React.Ref<HTMLDivElement> }) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ),
  NormalTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

const baseProps = () => ({
  translatedContent: '',
  renderedMarkdown: '',
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

  it('shows translated content and a copy button without an extra footer', () => {
    const props = baseProps()
    props.translatedContent = 'partial output'

    render(<TranslateOutputPane {...props} />)

    expect(screen.getByText('partial output')).toBeInTheDocument()
    expect(screen.queryByText('14')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeEnabled()
  })

  it('shows the processing indicator while waiting for output', () => {
    const props = baseProps()
    props.translating = true

    render(<TranslateOutputPane {...props} />)

    expect(screen.getByText('translate.processing')).toBeInTheDocument()
  })

  it('shows completed structured JSON ahead of Markdown when explicitly enabled', () => {
    const props = baseProps()
    props.translatedContent = '{"message":"line 1\\nline 2"}'
    props.renderedMarkdown = '<strong>markdown</strong>'
    props.enableMarkdown = true

    render(
      <TranslateOutputPane
        {...props}
        enableJsonStructure
        jsonStructureCopyBlankLineBetweenRows={false}
        jsonStructureCopySeparator="colon-space"
      />
    )

    expect(screen.getByTestId('json-structure-view')).toBeInTheDocument()
    expect(screen.queryByText('markdown')).not.toBeInTheDocument()
  })

  it('keeps rendering streaming JSON as text until translation completes', () => {
    const props = baseProps()
    props.translatedContent = '{"value":1}'
    props.translating = true

    render(<TranslateOutputPane {...props} enableJsonStructure />)

    expect(screen.queryByTestId('json-structure-view')).not.toBeInTheDocument()
    expect(screen.getByText('{"value":1}')).toBeInTheDocument()
  })
})
