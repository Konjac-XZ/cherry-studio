import { describe, expect, it } from 'vitest'

import { getTranslateModifierLabel } from '@renderer/utils/translate'

describe('translate platform labels', () => {
  it('uses Cmd on Apple platforms and Ctrl elsewhere', () => {
    expect(getTranslateModifierLabel({ platform: 'MacIntel', userAgent: '' })).toBe('Cmd')
    expect(getTranslateModifierLabel({ platform: '', userAgent: 'Mozilla/5.0 (iPhone)' })).toBe('Cmd')
    expect(getTranslateModifierLabel({ platform: 'Win32', userAgent: '' })).toBe('Ctrl')
  })
})
