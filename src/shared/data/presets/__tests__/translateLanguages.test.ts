import { describe, expect, it } from 'vitest'

import { BUILTIN_LANGUAGE } from '../translateLanguages'

describe('translate language presets', () => {
  it('uses the prepared Taiwan flag for Traditional Chinese', () => {
    expect(BUILTIN_LANGUAGE.zhTW).toMatchObject({ langCode: 'zh-tw', emoji: '🇹🇼' })
  })
})
