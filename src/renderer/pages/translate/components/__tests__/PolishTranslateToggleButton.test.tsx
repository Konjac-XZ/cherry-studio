import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import PolishTranslateToggleButton from '../PolishTranslateToggleButton'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@cherrystudio/ui', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  )
}))

describe('PolishTranslateToggleButton', () => {
  it('toggles persistently on primary click and runs one-shot polish on middle click', () => {
    const onToggle = vi.fn()
    const onTranslateOnce = vi.fn()
    render(<PolishTranslateToggleButton enabled={false} onToggle={onToggle} onTranslateOnce={onTranslateOnce} />)
    const button = screen.getByRole('button', { name: 'translate.button.polish_and_translate' })

    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledOnce()

    fireEvent.mouseDown(button, { button: 1 })
    fireEvent(button, new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(onTranslateOnce).toHaveBeenCalledOnce()
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
