import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TranslateInputPane from '../../custom/components/TranslateInputPane'

const dragState = vi.hoisted(() => ({ isDragging: false }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@renderer/hooks/useDrag', () => ({
  useDrag: (onDrop: (event: React.DragEvent<HTMLDivElement>) => void) => ({
    isDragging: dragState.isDragging,
    handleDragEnter: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDragOver: vi.fn(),
    handleDrop: onDrop
  })
}))

vi.mock('@renderer/utils/style', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')
}))

vi.mock('@cherrystudio/ui', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Scrollbar: ({ children, ref, ...props }: React.ComponentProps<'div'> & { ref?: React.Ref<HTMLDivElement> }) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ),
  NormalTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

const baseProps = () => ({
  text: '',
  onTextChange: vi.fn(),
  onKeyDown: vi.fn(),
  onScroll: vi.fn(),
  onPaste: vi.fn(),
  onDrop: vi.fn(),
  onSelectFile: vi.fn(),
  onPasteFromClipboard: vi.fn(async () => 'pasted'),
  onCancelOcr: vi.fn(),
  disabled: false,
  ocrProcessing: false,
  selecting: false
})

describe('TranslateInputPane', () => {
  afterEach(() => {
    dragState.isDragging = false
  })

  it('hides file upload while the parent pane is disabled', () => {
    const props = baseProps()
    render(<TranslateInputPane {...props} disabled />)

    expect(screen.queryByRole('button', { name: 'translate.files.upload' })).not.toBeInTheDocument()
    expect(props.onSelectFile).not.toHaveBeenCalled()
  })

  it('hides file upload while a file selection is in progress', () => {
    render(<TranslateInputPane {...baseProps()} selecting />)

    expect(screen.queryByRole('button', { name: 'translate.files.upload' })).not.toBeInTheDocument()
  })

  it('shows the input value and keeps the compact upload action available', () => {
    const props = baseProps()
    props.text = 'hello'

    render(<TranslateInputPane {...props} />)

    expect(screen.getByRole('button', { name: 'translate.files.upload' })).toBeEnabled()
    expect(screen.getByRole('textbox')).toHaveValue('hello')
  })

  it('pastes clipboard text at the current caret', async () => {
    const props = baseProps()
    props.text = 'hello'
    render(<TranslateInputPane {...props} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.setSelectionRange(2, 2)

    fireEvent.click(screen.getByRole('button', { name: 'translate.paste' }))

    await waitFor(() => expect(props.onTextChange).toHaveBeenCalledWith('hepastedllo'))
  })

  it('clears the input and restores textarea focus', async () => {
    const props = baseProps()
    props.text = 'hello'

    render(<TranslateInputPane {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'common.clear' }))

    expect(props.onTextChange).toHaveBeenCalledWith('')
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus())
  })

  it('keeps the compact clear action available but disabled when there is no text', () => {
    render(<TranslateInputPane {...baseProps()} />)

    expect(screen.getByRole('button', { name: 'common.clear' })).toBeDisabled()
  })

  it('shows the drop indicator while a file is dragged over the pane', () => {
    dragState.isDragging = true

    render(<TranslateInputPane {...baseProps()} />)

    expect(screen.getByText('translate.files.drag_text')).toBeInTheDocument()
  })

  it.each(['translate.detecting', 'translate.polishing', 'translate.processing'])(
    'fades the source pane while showing the %s work status',
    (busyLabel) => {
      render(<TranslateInputPane {...baseProps()} disabled busyLabel={busyLabel} />)

      expect(screen.getByTestId('translate-input-busy-overlay')).toHaveClass(
        'animate-in',
        'fade-in-0',
        'bg-background/70',
        'backdrop-blur-[1px]'
      )
      expect(screen.getByRole('status')).toHaveTextContent(busyLabel)
    }
  )

  it('does not show the OCR processing overlay by default', () => {
    render(<TranslateInputPane {...baseProps()} />)

    expect(screen.queryByText('ocr.processing')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.cancel' })).not.toBeInTheDocument()
  })

  it('shows the OCR processing overlay and supports cancellation', () => {
    const props = { ...baseProps(), ocrProcessing: true }

    render(<TranslateInputPane {...props} />)

    expect(screen.getByRole('status')).toHaveTextContent('ocr.processing')

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    expect(props.onCancelOcr).toHaveBeenCalledTimes(1)
  })
})
