// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/components/VirtualList', async () => {
  const React = await import('react')

  return {
    DynamicVirtualList: ({ children, list, ref, role, scrollerProps }: any) => {
      React.useImperativeHandle(ref, () => ({ scrollToIndex: vi.fn() }))

      return React.createElement(
        'div',
        { ...scrollerProps, role },
        list.slice(0, 12).map((item: unknown, index: number) => children(item, index))
      )
    }
  }
})

import FontCombobox from '../FontCombobox'

const fonts = Array.from({ length: 360 }, (_, index) => `Font ${index.toString().padStart(3, '0')}`)

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const renderFontCombobox = (props: Partial<React.ComponentProps<typeof FontCombobox>> = {}) => {
  const onChange = vi.fn()

  render(
    <FontCombobox
      ariaLabel="Global font"
      defaultFontFamily="system-ui"
      defaultLabel="Default font"
      emptyText="No results"
      fonts={fonts}
      onChange={onChange}
      placeholder="Select font"
      value=""
      {...props}
    />
  )

  return { input: screen.getByRole('combobox', { name: 'Global font' }), onChange }
}

describe('FontCombobox', () => {
  it('mounts only the virtual viewport for a large font list while keeping font previews', async () => {
    const { input } = renderFontCombobox()

    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(12)
    })
    expect(screen.queryByRole('option', { name: 'Font 200' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Font 000' }).querySelector('span')).toHaveStyle({
      fontFamily: 'Font 000'
    })
  })

  it('searches the complete font collection and selects a match outside the initial viewport', async () => {
    const { input, onChange } = renderFontCombobox()

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Font 200' } })

    const match = await screen.findByRole('option', { name: 'Font 200' })
    expect(screen.getAllByRole('option')).toHaveLength(1)

    fireEvent.click(match)
    expect(onChange).toHaveBeenCalledWith('Font 200')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('supports keyboard navigation, selection, and dismissal', async () => {
    const { input, onChange } = renderFontCombobox()

    fireEvent.focus(input)
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', expect.stringMatching(/option-0$/)))

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', expect.stringMatching(/option-1$/)))
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('Font 000')
    expect(input).toHaveAttribute('aria-expanded', 'false')

    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the selected font in the resting trigger and reports empty searches', async () => {
    const { input } = renderFontCombobox({ value: 'Font 200' })

    expect(input).toHaveValue('Font 200')
    expect(input).toHaveStyle({ fontFamily: 'Font 200' })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'missing font' } })

    expect(await screen.findByText('No results')).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })
})
