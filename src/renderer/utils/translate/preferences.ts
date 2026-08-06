const DEFAULT_TRANSLATE_FONT_SIZE = 16
const MIN_TRANSLATE_FONT_SIZE = 12
const MAX_TRANSLATE_FONT_SIZE = 24

export const normalizePersistedTranslateFontSize = (value: unknown) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= MIN_TRANSLATE_FONT_SIZE &&
  value <= MAX_TRANSLATE_FONT_SIZE
    ? value
    : DEFAULT_TRANSLATE_FONT_SIZE

export const normalizeEditedTranslateFontSize = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_TRANSLATE_FONT_SIZE
  return Math.min(MAX_TRANSLATE_FONT_SIZE, Math.max(MIN_TRANSLATE_FONT_SIZE, Math.round(numeric)))
}
