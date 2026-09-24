import { describe, expect, it } from 'vitest'

import { composeLocale } from '@renderer/i18n/composeLocale'

describe('composeLocale', () => {
  it('applies downstream English, locale, and explicit override layers in order', () => {
    const upstream = { existing: 'upstream', untouched: 'base' }
    const customEnglish = { added: 'English fallback' }
    const customLocale = { added: 'Localized' }
    const overrides = { existing: 'intentional override' }

    expect(composeLocale(upstream, customEnglish, customLocale, overrides)).toEqual({
      existing: 'intentional override',
      untouched: 'base',
      added: 'Localized'
    })
    expect(upstream).toEqual({ existing: 'upstream', untouched: 'base' })
  })

  it('uses downstream English when a locale has no sparse translation', () => {
    expect(composeLocale({}, { added: 'English fallback' })).toEqual({ added: 'English fallback' })
  })
})
