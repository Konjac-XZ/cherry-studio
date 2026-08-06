import { jsonrepair } from 'jsonrepair'

export type JsonStructure = Record<string, unknown> | unknown[]

const FENCED_JSON_PATTERN =
  /^(?<fence>`{3,}|~{3,})[ \t]*(?:json|jsonc|json5)?[ \t]*\r?\n(?<body>[\s\S]*?)\r?\n\k<fence>$/i
const NESTED_FENCE_PATTERN = /(?:^|\r?\n)[ \t]*(?:`{3,}|~{3,})/
const LEADING_PROPERTY_PATTERN = /^"(?:\\.|[^"\\])*"\s*:\s*(?=[{[])/

const normalizeJsonFormatterQuotes = (candidate: string): string => candidate.replace(/[“”]/g, '"')

const removeLeadingProperty = (candidate: string): string => {
  const match = LEADING_PROPERTY_PATTERN.exec(normalizeJsonFormatterQuotes(candidate))
  return match ? candidate.slice(match[0].length) : candidate
}

const getCandidate = (content: string): string | null => {
  const trimmed = content.replace(/^\uFEFF/, '').trim()
  if (!trimmed) return null

  const unwrapped = removeLeadingProperty(trimmed)
  if (unwrapped.startsWith('{') || unwrapped.startsWith('[')) return unwrapped

  const match = FENCED_JSON_PATTERN.exec(trimmed)
  const body = match?.groups?.body?.trim()
  if (!body || NESTED_FENCE_PATTERN.test(body)) return null

  const unwrappedBody = removeLeadingProperty(body)
  return unwrappedBody.startsWith('{') || unwrappedBody.startsWith('[') ? unwrappedBody : null
}

const hasContentAfterRoot = (candidate: string): boolean => {
  const stack: string[] = []
  let quoteEnd: string | null = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let index = 0; index < candidate.length; index += 1) {
    const character = candidate[index]
    const nextCharacter = candidate[index + 1]

    if (lineComment) {
      if (character === '\n' || character === '\r') lineComment = false
      continue
    }

    if (blockComment) {
      if (character === '*' && nextCharacter === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quoteEnd) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quoteEnd) {
        quoteEnd = null
      }
      continue
    }

    if (character === '/' && nextCharacter === '/') {
      lineComment = true
      index += 1
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      blockComment = true
      index += 1
      continue
    }

    if (character === '"' || character === "'") {
      quoteEnd = character
      continue
    }

    if (character === '“') {
      quoteEnd = '”'
      continue
    }

    if (character === '‘') {
      quoteEnd = '’'
      continue
    }

    if (character === '{' || character === '[') {
      stack.push(character)
      continue
    }

    if (character !== '}' && character !== ']') continue

    const expectedOpening = character === '}' ? '{' : '['
    if (stack.at(-1) !== expectedOpening) continue
    stack.pop()

    if (stack.length === 0) {
      const trailingContent = candidate.slice(index + 1).trim()
      return trailingContent !== '' && trailingContent !== ','
    }
  }

  return false
}

const isJsonStructure = (value: unknown): value is JsonStructure =>
  value !== null &&
  typeof value === 'object' &&
  (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype)

const parseAndValidate = (candidate: string): JsonStructure | null => {
  const value = JSON.parse(candidate) as unknown
  if (!isJsonStructure(value)) return null

  const expectsArray = candidate.startsWith('[')
  return Array.isArray(value) === expectsArray ? value : null
}

export const parseJsonStructure = (content: string): JsonStructure | null => {
  const candidate = getCandidate(content)
  if (!candidate) return null

  try {
    if (hasContentAfterRoot(candidate)) return null
    return parseAndValidate(candidate)
  } catch {
    const normalizedCandidate = normalizeJsonFormatterQuotes(candidate)
    if (hasContentAfterRoot(normalizedCandidate)) return null

    try {
      return parseAndValidate(normalizedCandidate)
    } catch {
      try {
        return parseAndValidate(jsonrepair(normalizedCandidate))
      } catch {
        return null
      }
    }
  }
}

export const getJsonStructureForDisplay = (
  content: string,
  enabled: boolean,
  translating: boolean
): JsonStructure | null => (enabled && !translating && content ? parseJsonStructure(content) : null)
