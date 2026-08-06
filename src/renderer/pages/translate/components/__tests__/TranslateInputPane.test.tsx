import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TranslateInputPane from '../TranslateInputPane'

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
  onCopy: vi.fn(),
  onPasteFromClipboard: vi.fn(async () => 'pasted'),
  htmlConversionEnabled: true,
  onToggleHtmlConversion: vi.fn(),
  onCancelOcr: vi.fn(),
  disabled: false,
  ocrProcessing: false,
  selecting: false
})

describe('TranslateInputPane', () => {
  afterEach(() => {
    dragState.isDragging = false
  })

  it('disables file upload while the parent pane is disabled', () => {
    const props = baseProps()
    render(<TranslateInputPane {...props} disabled />)

    fireEvent.click(screen.getByRole('button', { name: 'translate.files.upload' }))

    expect(screen.getByRole('button', { name: 'translate.files.upload' })).toBeDisabled()
    expect(props.onSelectFile).not.toHaveBeenCalled()
  })

  it('shows the input value and hides the upload area once input has text', () => {
    const props = baseProps()
    props.text = 'hello'

    render(<TranslateInputPane {...props} />)

    expect(screen.queryByRole('button', { name: 'translate.files.upload' })).not.toBeInTheDocument()
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

  it('exposes the persisted HTML conversion state and toggle', () => {
    const props = baseProps()
    render(<TranslateInputPane {...props} />)
    const toggle = screen.getByRole('button', { name: 'translate.html_conversion' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(toggle)

    expect(props.onToggleHtmlConversion).toHaveBeenCalledOnce()
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
