import { normalizeChineseSpacing } from './chineseSpacing'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

type DateValue = Date | number | string

export interface DateFormatter {
  format(value: Date | number): string
}

export function createDateFormatter(language: string | undefined, options: Intl.DateTimeFormatOptions): DateFormatter {
  const formatter = new Intl.DateTimeFormat(language, options)
  return {
    format: (value) => normalizeChineseSpacing(formatter.format(value), language)
  }
}

export const formatRelativeDay = (offset: number, language: string) =>
  normalizeChineseSpacing(new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(offset, 'day'), language)

function toDate(value: DateValue): Date {
  return value instanceof Date ? value : new Date(value)
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDate(value: DateValue): string {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}/${padDatePart(date.getMonth() + 1)}/${padDatePart(date.getDate())}`
}

export function formatMonth(value: DateValue): string {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}/${padDatePart(date.getMonth() + 1)}`
}

export function formatShortMonth(value: DateValue, language: string): string {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ''

  return createDateFormatter(language, { month: 'short' }).format(date)
}

export function formatDateTime(
  value: DateValue,
  options: { includeSeconds?: boolean; includeMilliseconds?: boolean } = {}
): string {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ''

  const timeParts = [padDatePart(date.getHours()), padDatePart(date.getMinutes())]
  if (options.includeSeconds || options.includeMilliseconds) timeParts.push(padDatePart(date.getSeconds()))

  const milliseconds = options.includeMilliseconds ? `.${String(date.getMilliseconds()).padStart(3, '0')}` : ''
  return `${formatDate(date)} ${timeParts.join(':')}${milliseconds}`
}

export function createDurationFormatter(language?: string): (durationMs: number) => string {
  const millisecondFormatter = new Intl.NumberFormat(language, {
    style: 'unit',
    unit: 'millisecond',
    unitDisplay: 'narrow',
    maximumFractionDigits: 0
  })
  const secondFormatter = new Intl.NumberFormat(language, {
    style: 'unit',
    unit: 'second',
    unitDisplay: 'narrow',
    maximumFractionDigits: 1
  })
  const minuteFormatter = new Intl.NumberFormat(language, {
    style: 'unit',
    unit: 'minute',
    unitDisplay: 'narrow',
    maximumFractionDigits: 0
  })
  const durationListFormatter = new Intl.ListFormat(language, { style: 'narrow', type: 'unit' })

  return (durationMs) => {
    if (durationMs < 1000) {
      return normalizeChineseSpacing(millisecondFormatter.format(Math.round(durationMs)), language)
    }

    const roundedTenths = Math.round(durationMs / 100)
    if (roundedTenths < 600) {
      return normalizeChineseSpacing(secondFormatter.format(roundedTenths / 10), language)
    }

    const minutes = Math.floor(roundedTenths / 600)
    const seconds = (roundedTenths % 600) / 10
    const duration = durationListFormatter.format([minuteFormatter.format(minutes), secondFormatter.format(seconds)])
    return normalizeChineseSpacing(duration, language)
  }
}

export function getLocaleFirstDayOfWeek(language?: string): number {
  const locale = new Intl.Locale(language ?? Intl.DateTimeFormat().resolvedOptions().locale) as Intl.Locale & {
    getWeekInfo(): { firstDay: number }
  }
  // Intl uses 1=Monday … 7=Sunday; Date#getDay uses 0=Sunday … 6=Saturday.
  return locale.getWeekInfo().firstDay % 7
}

export const formatRelativeTime = (value: string, language: string, now = Date.now()) => {
  const diffMs = new Date(value).getTime() - now
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })

  // Pick the unit from the *rounded* magnitude, not the raw threshold: 59m54s rounds to 60 minutes,
  // which must roll up to "1 hour ago" rather than render "60 minutes ago" (and likewise 23h59m -> a
  // day, not "24 hours ago"). Rounding the magnitude keeps both directions on the same unit —
  // `Math.round` breaks ties toward +∞, so a signed test would put -11.5 months and +11.5 months on
  // different units. Months and years use fixed averages; Intl has no calendar-aware relative unit.
  const magnitude = Math.abs(diffMs)
  const sign = diffMs < 0 ? -1 : 1
  const inUnit = (unitMs: number) => sign * Math.round(magnitude / unitMs)
  const format = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
    normalizeChineseSpacing(formatter.format(value, unit), language)

  if (Math.round(magnitude / MINUTE_MS) < 60) return format(inUnit(MINUTE_MS), 'minute')
  if (Math.round(magnitude / HOUR_MS) < 24) return format(inUnit(HOUR_MS), 'hour')
  if (Math.round(magnitude / DAY_MS) < 30) return format(inUnit(DAY_MS), 'day')
  if (Math.round(magnitude / MONTH_MS) < 12) return format(inUnit(MONTH_MS), 'month')
  return format(inUnit(YEAR_MS), 'year')
}
