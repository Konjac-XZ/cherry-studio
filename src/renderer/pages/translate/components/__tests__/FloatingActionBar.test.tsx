import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import FloatingActionBar from '../FloatingActionBar'

vi.mock('@cherrystudio/ui', () => ({
  NormalTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

describe('FloatingActionBar', () => {
  it('shares one compact surface and preserves the prepared oversized top-right hotspot', () => {
    render(
      <FloatingActionBar
        actions={[
          { key: 'one', label: 'One', onClick: vi.fn(), icon: <span>1</span> },
          { key: 'two', label: 'Two', onClick: vi.fn(), icon: <span>2</span> }
        ]}
      />
    )

    const surface = screen.getByTestId('floating-actions')
    expect(surface).toHaveClass('before:-top-2', 'before:-right-2')
    expect(surface.className).toContain('before:w-[calc(200%+32px)]')
    expect(surface.className).toContain('before:h-[calc(200%+32px)]')
    expect(surface).toHaveClass('opacity-0', 'hover:opacity-100', 'delay-300', 'hover:delay-0')
    expect(surface.className).not.toContain('focus-within')
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
