export type JsonStructureCopySeparator = 'chinese-colon' | 'chinese-colon-newline' | 'colon-newline' | 'colon-space'

const JSON_SELECTION_BOUNDARY_PATTERN = /(\r?\n[ \t]*:[ \t]*\r?\n)|(\r?\n)/g

const COPY_SEPARATOR_TEXT: Record<JsonStructureCopySeparator, string> = {
  'colon-space': ': ',
  'colon-newline': ':\n',
  'chinese-colon': '：',
  'chinese-colon-newline': '：\n'
}

export const normalizeJsonStructureSelection = (
  text: string,
  copySeparator: JsonStructureCopySeparator,
  blankLineBetweenRows: boolean
): string =>
  text.replace(
    JSON_SELECTION_BOUNDARY_PATTERN,
    (match, columnSeparator: string | undefined, rowSeparator: string | undefined) => {
      if (columnSeparator) return COPY_SEPARATOR_TEXT[copySeparator]
      return blankLineBetweenRows && rowSeparator ? `${rowSeparator}${rowSeparator}` : match
    }
  )
