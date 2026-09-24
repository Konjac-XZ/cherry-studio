import { describe, expect, it } from 'vitest'

import { clampTranslatePanelSize, getTranslatePanelBounds } from '@renderer/utils/translate'

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
})
