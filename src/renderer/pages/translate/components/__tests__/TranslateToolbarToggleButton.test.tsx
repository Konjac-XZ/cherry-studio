import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import TranslateToolbarToggleButton from '../TranslateToolbarToggleButton'

describe('TranslateToolbarToggleButton', () => {
  it.each([
    ['clipboardWatch', 'text-[#0f8f7d]'],
    ['polish', 'text-[#9a6700]'],
    ['postProcessing', 'text-[#7c3aed]'],
    ['htmlConversion', 'text-[#2463ff]']
  ] as const)('uses the V1 %s outline color only while enabled', (tone, activeClass) => {
    const { rerender } = render(
      <TranslateToolbarToggleButton enabled tone={tone} aria-label={tone}>
        icon
      </TranslateToolbarToggleButton>
    )
    const button = screen.getByRole('button', { name: tone })

    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveClass(activeClass)
    expect(button).not.toHaveClass('text-foreground-disabled')

    rerender(
      <TranslateToolbarToggleButton enabled={false} tone={tone} aria-label={tone}>
        icon
      </TranslateToolbarToggleButton>
    )

    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveClass('text-foreground-disabled')
    expect(button).not.toHaveClass(activeClass)
  })

  it.each([
    ['clipboardWatch', '剪贴板监听'],
    ['polish', '润色'],
    ['postProcessing', '后处理'],
    ['htmlConversion', 'HTML 转换']
  ] as const)('updates the %s tooltip with the feature state', (tone, feature) => {
    const { rerender } = render(
      <TranslateToolbarToggleButton enabled tone={tone} aria-label={feature}>
        icon
      </TranslateToolbarToggleButton>
    )
    const button = screen.getByRole('button', { name: feature })

    expect(button).toHaveAttribute('title', `${feature}已启用`)

    rerender(
      <TranslateToolbarToggleButton enabled={false} tone={tone} aria-label={feature}>
        icon
      </TranslateToolbarToggleButton>
    )

    expect(button).toHaveAttribute('title', `${feature}已禁用`)
  })
})
