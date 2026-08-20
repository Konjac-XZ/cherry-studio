import pangu from 'pangu'

const CHINESE_UI_LOCALES = new Set(['zh-cn', 'zh-tw'])

export function normalizeChineseSpacing(text: string, locale?: string): string {
  if (!locale || !CHINESE_UI_LOCALES.has(locale.toLowerCase())) return text

  const spaced = pangu.spacingText(text)
  return typeof spaced === 'string' ? spaced : text
}
