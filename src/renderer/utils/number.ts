import i18n from '@renderer/i18n/resolver'

import { normalizeChineseSpacing } from './chineseSpacing'

const compactFormatters = new Map<string, Intl.NumberFormat>()

function getCompactFormatter(locale: string): Intl.NumberFormat {
  let formatter = compactFormatters.get(locale)

  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
    compactFormatters.set(locale, formatter)
  }

  return formatter
}

export function formatCompactNumber(value: number, locale: string = i18n.resolvedLanguage ?? i18n.language): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  return normalizeChineseSpacing(getCompactFormatter(locale).format(value), locale)
}
