import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import JsonStructureView from '../JsonStructureView'

describe('JsonStructureView', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the full hierarchy with decoded primitive values', () => {
    const { container } = render(
      <JsonStructureView
        blankLineBetweenRows={false}
        copySeparator="colon-space"
        value={{
          message: 'line 1\n\t他说 "hello" \\ Cherry',
          nested: { items: ['first', { value: false }] },
          emptyObject: {},
          emptyArray: []
        }}
      />
    )

    expect(container.querySelector('[data-json-path="$"]')).toBeNull()
    expect(container.querySelector('[data-json-path="$/message"] [data-value-type="string"]')?.textContent).toBe(
      'line 1\n\t他说 "hello" \\ Cherry'
    )
    expect(container.querySelector('[data-json-path="$/nested/items/[1]/value"]')).toHaveTextContent('false')
    expect(container.querySelector('[data-json-path="$/nested/items/[1]/value"]')).toHaveAttribute('data-depth', '3')
    expect(container.querySelector('[data-json-path="$/emptyObject"]')).toHaveTextContent('{}')
    expect(container.querySelector('[data-json-path="$/emptyArray"]')).toHaveTextContent('[]')
  })

  it('keeps HTML-like strings as safe React text', () => {
    const { container } = render(
      <JsonStructureView
        blankLineBetweenRows={false}
        copySeparator="colon-space"
        value={{ html: '<img src=x onerror=alert(1)>' }}
      />
    )

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  })

  it('writes normalized structured selection text to the native clipboard event', () => {
    const setData = vi.fn()
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => '规则描述\n:\n规则内容\n偏差描述\n:\n偏差内容'
    } as Selection)
    render(
      <JsonStructureView
        blankLineBetweenRows={true}
        copySeparator="chinese-colon-newline"
        value={{ 规则描述: '规则内容', 偏差描述: '偏差内容' }}
      />
    )

    const nativeCopyAllowed = fireEvent.copy(screen.getByTestId('json-structure-view'), {
      clipboardData: { setData }
    })

    expect(nativeCopyAllowed).toBe(false)
    expect(setData).toHaveBeenCalledWith('text/plain', '规则描述：\n规则内容\n\n偏差描述：\n偏差内容')
  })

  it('leaves native clipboard behavior untouched for a single value selection', () => {
    const setData = vi.fn()
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '规则内容' } as Selection)
    render(
      <JsonStructureView blankLineBetweenRows={false} copySeparator="colon-space" value={{ 规则描述: '规则内容' }} />
    )

    const nativeCopyAllowed = fireEvent.copy(screen.getByTestId('json-structure-view'), {
      clipboardData: { setData }
    })

    expect(nativeCopyAllowed).toBe(true)
    expect(setData).not.toHaveBeenCalled()
  })
})
