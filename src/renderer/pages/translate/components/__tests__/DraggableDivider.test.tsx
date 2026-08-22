import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import DraggableDivider from '../DraggableDivider'

describe('DraggableDivider', () => {
  it.each([
    ['horizontal layout', false],
    ['vertical layout', true]
  ])('resets the panes to an even split on double-click in %s', (_, vertical) => {
    const onChange = vi.fn()

    render(<DraggableDivider containerRef={{ current: null }} vertical={vertical} value={70} onChange={onChange} />)

    fireEvent.doubleClick(screen.getByRole('separator'))

    expect(onChange).toHaveBeenLastCalledWith(50)
  })
})
