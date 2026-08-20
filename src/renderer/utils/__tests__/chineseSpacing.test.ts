import { describe, expect, it } from 'vitest'

import { normalizeChineseSpacing } from '../chineseSpacing'

describe('normalizeChineseSpacing', () => {
  it.each([
    ['zh-CN', '2.8万', '2.8 万'],
    ['zh-TW', '2.8萬', '2.8 萬'],
    ['zh-CN', '1分钟1.2秒', '1 分钟 1.2 秒'],
    ['zh-TW', '1分鐘1.2秒', '1 分鐘 1.2 秒'],
    ['zh-CN', '2分钟前', '2 分钟前'],
    ['zh-TW', '2分鐘前', '2 分鐘前'],
    ['zh-CN', '8月', '8 月']
  ])('normalizes product-generated %s display text', (locale, input, expected) => {
    expect(normalizeChineseSpacing(input, locale)).toBe(expected)
  })

  it('is idempotent', () => {
    const once = normalizeChineseSpacing('1 分钟 1.2 秒', 'zh-CN')
    expect(normalizeChineseSpacing(once, 'zh-CN')).toBe(once)
  })

  it.each(['en-US', 'de-DE', undefined])('leaves non-Chinese locale output unchanged', (locale) => {
    expect(normalizeChineseSpacing('1minute', locale)).toBe('1minute')
  })
})
