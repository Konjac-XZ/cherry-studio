import {
  clampTranslatePanelSize,
  findEqualizedTranslatePanelSize,
  getTranslatePanelBounds
} from '@renderer/utils/translate'
import { describe, expect, it, vi } from 'vitest'

describe('translate layout geometry', () => {
  it('uses responsive horizontal trailing-pane minimum widths', () => {
    expect(getTranslatePanelBounds(false, 1000, 900).maximum).toBe(68)
    expect(getTranslatePanelBounds(false, 1000, 700).maximum).toBe(72)
    expect(getTranslatePanelBounds(false, 1000, 500).maximum).toBe(75)
  })

  it('keeps vertical panes at least 30 percent and 200 pixels', () => {
    expect(clampTranslatePanelSize(10, true, 1000, 1200)).toBe(30)
    expect(clampTranslatePanelSize(95, true, 1000, 1200)).toBe(80)
  })

  it('chooses the candidate with the closest scrollable lengths', () => {
    const measure = vi.fn((candidate: number) => ({ input: candidate * 10, output: 900 - candidate * 10 }))
    expect(findEqualizedTranslatePanelSize(70, measure)).toBe(45)
    expect(measure).toHaveBeenCalledWith(30)
    expect(measure).toHaveBeenCalledWith(70)
  })

  it('resets to an even split when neither pane scrolls', () => {
    expect(findEqualizedTranslatePanelSize(68, () => ({ input: 0, output: 0 }))).toBe(50)
  })
})
